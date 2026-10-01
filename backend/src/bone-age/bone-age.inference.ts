import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { dirname, join, parse } from 'path';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { REFINE9_SIZE, toModelInput, ttaViews } from './refine9.preprocess';

/**
 * Bone-age inference, in-process, with the ML team's refine9 model: EfficientNet-B5 at
 * 456 x 456 plus the sex input, predicting months directly, averaged over four test-time
 * views. Validation MAE 7.43 months, 80.2 % within a year (1,425 RSNA validation images).
 *
 * It runs here rather than as a second service because Render's free tier bills instance
 * hours per workspace, so a second always-waking service burns them twice as fast and adds a
 * second cold start. The PyTorch checkpoint is converted to ONNX by
 * `ai-service/refine9/export.py`, which also writes the rotation maps used for the TTA views.
 */

// libvips keeps up to 50 MB of decoded images and a thread per core by default. On a 512 MB
// instance next to a B5 model that is headroom we do not have, and uploads are one at a time.
sharp.cache(false);
sharp.concurrency(1);

// Longest side kept for storage and inference. Uploads larger than this are scaled down
// first: it bounds memory on a 512 MB instance, and moved predictions by at most 0.25 months
// on the test radiographs (ai-service/refine9/README.md).
export const MAX_SIDE = 2048;
// Refuse decompression bombs before decoding.
const MAX_INPUT_PIXELS = 40_000_000;

// A result outside this band means something upstream is wrong, not that a child is unusual.
const MIN_PLAUSIBLE_MONTHS = 0;
const MAX_PLAUSIBLE_MONTHS = 300;

export interface BoneAgeResult {
  boneAgeMonths: number;
  /** Before rounding; for comparing against the PyTorch pipeline. */
  exactMonths: number;
  modelVersion: string;
  inferenceMs: number;
}

@Injectable()
export class BoneAgeInferenceService implements OnModuleInit {
  private readonly logger = new Logger(BoneAgeInferenceService.name);
  private session: ort.InferenceSession | null = null;
  private rotations: Int32Array[] = [];
  private loadError: string | null = null;
  // One inference at a time: four B5 passes in parallel would not fit a 512 MB instance.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const path = this.modelPath;
    const maps = [5, -5].map((a) => this.rotationMapPath(a));
    const missing = [path, ...(this.useTta ? maps : [])].filter(
      (p) => !existsSync(p),
    );
    if (missing.length) {
      this.loadError = `missing ${missing.join(', ')}`;
      this.logger.warn(
        `Bone-age model files missing (${missing.join(', ')}); predictions stay PENDING.`,
      );
      return;
    }
    try {
      this.session = await ort.InferenceSession.create(path, {
        // The arena keeps every activation buffer it ever allocated; without it a B5 pass
        // peaks around 175 MB above the API instead of 310 MB.
        enableCpuMemArena: false,
        enableMemPattern: false,
        intraOpNumThreads: Number(
          this.config.get<string>('BONE_AGE_THREADS') ?? 1,
        ),
      });
      if (this.useTta) {
        this.rotations = await Promise.all(
          maps.map(async (p) => {
            const buf = await readFile(p);
            const map = new Int32Array(
              buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
            );
            if (map.length !== REFINE9_SIZE * REFINE9_SIZE) {
              throw new Error(
                `${p} has ${map.length} entries, expected 456 x 456`,
              );
            }
            return map;
          }),
        );
      }
      this.logger.log(
        `Bone-age model loaded from ${path} (${this.modelVersion}, ${this.useTta ? '4-view TTA' : 'single view'})`,
      );
    } catch (err) {
      this.session = null;
      this.loadError = (err as Error).message;
      this.logger.error(
        `Failed to load bone-age model from ${path}`,
        err as Error,
      );
    }
  }

  private get modelPath(): string {
    return (
      this.config.get<string>('BONE_AGE_MODEL_PATH') ?? 'models/refine9.onnx'
    );
  }

  /** The torch-generated nearest-neighbour map for a rotation, stored next to the model. */
  private rotationMapPath(angle: number): string {
    const { dir, name } = parse(this.modelPath);
    return join(dir, `${name}_rot${angle > 0 ? '+' : ''}${angle}.i32`);
  }

  /** Test-time augmentation, as the reported MAE was measured. Off only to save CPU. */
  private get useTta(): boolean {
    return this.config.get<string>('BONE_AGE_TTA') !== 'off';
  }

  get modelVersion(): string {
    const base =
      this.config.get<string>('BONE_AGE_MODEL_VERSION') ??
      'effnetb5-refine9-rsna';
    return this.useTta ? `${base}-tta` : base;
  }

  /** Mean absolute error in months on the validation set: the "±" FR-18 shows the doctor. */
  get maeMonths(): number {
    return Number(this.config.get<string>('BONE_AGE_MAE_MONTHS') ?? 7.43);
  }

  /**
   * Share of validation predictions within a year, shown with the MAE because the mean hides
   * the spread: at 80 %, one estimate in five is out by more than a year.
   */
  get accuracyWithin12Months(): number {
    return Number(this.config.get<string>('BONE_AGE_ACCURACY_12M') ?? 0.802);
  }

  get isReady(): boolean {
    return this.session !== null;
  }

  get status() {
    return {
      ready: this.isReady,
      modelVersion: this.modelVersion,
      maeMonths: this.maeMonths,
      accuracyWithin12Months: this.accuracyWithin12Months,
      detail: this.loadError,
    };
  }

  /**
   * Turns an upload into what is kept: channel 0 (the model's only input), scaled to at most
   * 2048 px, as lossless greyscale WebP. Lossless matters: CLAHE amplifies compression noise,
   * and re-encoding one test image as JPEG moved its bone age by 3 months. Returns the new
   * path and deletes the original. Throws a readable error for files that are not images.
   */
  async normaliseUpload(file: string): Promise<string> {
    const target = join(dirname(file), `${parse(file).name}.webp`);
    try {
      const image = sharp(file, { limitInputPixels: MAX_INPUT_PIXELS });
      const { width = 0, height = 0 } = await image.metadata();
      if (!width || !height) throw new Error('no dimensions');
      await image
        // Applies EXIF orientation, as the browser preview does (lib/xray.js). A no-op for
        // scanner exports, which carry none.
        .rotate()
        .extractChannel(0)
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
        .webp({ lossless: true })
        .toFile(target);
    } catch (err) {
      await unlink(target).catch(() => undefined);
      throw new Error(
        `Could not read the image (${(err as Error).message}). Upload a JPEG, PNG or WebP, or a PDF from the app.`,
      );
    } finally {
      if (target !== file) await unlink(file).catch(() => undefined);
    }
    return target;
  }

  async predict(file: string, sex: 'MALE' | 'FEMALE'): Promise<BoneAgeResult> {
    const run = this.queue.then(() => this.predictNow(file, sex));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async predictNow(
    file: string,
    sex: 'MALE' | 'FEMALE',
  ): Promise<BoneAgeResult> {
    const session = this.session;
    if (!session) {
      throw new Error(this.loadError ?? 'model not loaded');
    }
    const started = Date.now();

    const { data, info } = await sharp(file, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .extractChannel(0)
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const base = toModelInput(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      info.height,
      info.width,
    );
    const views = this.useTta ? ttaViews(base, this.rotations) : [base];

    // 1.0 is male, as in the training CSV's `male` column (dataset.py).
    const sexTensor = new ort.Tensor(
      'float32',
      new Float32Array([sex === 'MALE' ? 1 : 0]),
      [1],
    );
    let sum = 0;
    for (const view of views) {
      const output = await session.run({
        image: new ort.Tensor('float32', view, [
          1,
          3,
          REFINE9_SIZE,
          REFINE9_SIZE,
        ]),
        sex: sexTensor,
      });
      sum += Number((output.months.data as Float32Array)[0]);
    }
    const months = sum / views.length;

    if (
      !Number.isFinite(months) ||
      months < MIN_PLAUSIBLE_MONTHS ||
      months > MAX_PLAUSIBLE_MONTHS
    ) {
      throw new Error(
        `model returned ${months.toFixed(1)} months, outside 0-300. Is this a hand X-ray?`,
      );
    }

    return {
      boneAgeMonths: Math.round(months),
      exactMonths: months,
      modelVersion: this.modelVersion,
      inferenceMs: Date.now() - started,
    };
  }
}
