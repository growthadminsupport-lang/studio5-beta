/**
 * The whole bone-age prediction, off the main thread: decode, refine9 preprocessing, and the
 * four ONNX passes.
 *
 * Both halves block the thread they run on. CLAHE and the resize are plain JavaScript (about
 * 250 ms per X-ray on one ARM core), and onnxruntime-node's `session.run` computes on the
 * calling thread (about 1 s per B5 pass). On the main thread that stalled every request, the
 * health check included, for over a second per pass, and several times longer on Render's
 * free CPU. Here only this worker is busy.
 *
 * Messages in:  { type: 'init', modelPath, threads }
 *               { type: 'predict', id, file, male, rotationMaps }
 * Messages out: { type: 'ready' } | { type: 'initError', error }
 *               { id, months } | { id, error }
 */
import { readFileSync } from 'fs';
import { parentPort } from 'worker_threads';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import {
  MAX_INPUT_PIXELS,
  MAX_SIDE,
  REFINE9_SIZE,
  toModelInput,
  ttaViews,
} from './refine9.preprocess';

sharp.cache(false);
sharp.concurrency(1);

let session: ort.InferenceSession | null = null;

const maps = new Map<string, Int32Array>();
function rotationMap(path: string): Int32Array {
  let map = maps.get(path);
  if (!map) {
    const buf = readFileSync(path);
    map = new Int32Array(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    );
    if (map.length !== REFINE9_SIZE * REFINE9_SIZE) {
      throw new Error(`${path} has ${map.length} entries, expected 456 x 456`);
    }
    maps.set(path, map);
  }
  return map;
}

/**
 * The image the model reads: EXIF orientation applied (as the browser preview shows it),
 * channel 0 (as the training code takes it), longest side at most 2048 px.
 */
async function modelViews(
  file: string,
  rotationMaps: string[],
): Promise<Float32Array[]> {
  const { data, info } = await sharp(file, {
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .rotate()
    .extractChannel(0)
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const base = toModelInput(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    info.height,
    info.width,
  );
  return rotationMaps.length
    ? ttaViews(base, rotationMaps.map(rotationMap))
    : [base];
}

/** Mean of the model's months over the views (the team's `tta_predict`). */
async function predict(
  file: string,
  male: boolean,
  rotationMaps: string[],
): Promise<number> {
  if (!session) throw new Error('model not loaded');
  const views = await modelViews(file, rotationMaps);
  // 1.0 is male, as in the training CSV's `male` column (dataset.py).
  const sex = new ort.Tensor('float32', new Float32Array([male ? 1 : 0]), [1]);
  let sum = 0;
  for (const view of views) {
    const out = await session.run({
      image: new ort.Tensor('float32', view, [
        1,
        3,
        REFINE9_SIZE,
        REFINE9_SIZE,
      ]),
      sex,
    });
    sum += Number((out.months.data as Float32Array)[0]);
  }
  return sum / views.length;
}

type Message =
  | { type: 'init'; modelPath: string; threads: number }
  | {
      type: 'predict';
      id: number;
      file: string;
      male: boolean;
      rotationMaps: string[];
    };

parentPort?.on('message', (msg: Message) => {
  const port = parentPort!;
  if (msg.type === 'init') {
    ort.InferenceSession.create(msg.modelPath, {
      // The arena keeps every activation buffer it ever allocated; without it a B5 pass
      // peaks around 175 MB above the API instead of 310 MB.
      enableCpuMemArena: false,
      enableMemPattern: false,
      intraOpNumThreads: msg.threads,
    })
      .then((s) => {
        session = s;
        port.postMessage({ type: 'ready' });
      })
      .catch((err: Error) =>
        port.postMessage({ type: 'initError', error: err.message }),
      );
    return;
  }
  predict(msg.file, msg.male, msg.rotationMaps)
    .then((months) => port.postMessage({ id: msg.id, months }))
    .catch((err: Error) =>
      port.postMessage({ id: msg.id, error: err.message }),
    );
});
