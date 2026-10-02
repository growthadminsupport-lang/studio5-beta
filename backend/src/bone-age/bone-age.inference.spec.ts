import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { BoneAgeInferenceService } from './bone-age.inference';
import {
  clahe,
  REFINE9_SIZE,
  resizeSquash,
  toModelInput,
  ttaViews,
} from './refine9.preprocess';

/**
 * Preprocessing is checked against real cv2 and torchvision output
 * (test/fixtures/refine9-golden.json, from ai-service/refine9/golden.py).
 *
 * Running the model itself is not tested here: Jest builds typed arrays in its own VM
 * context and onnxruntime rejects them ("a float32 tensor's data must be type of
 * Float32Array"). `npm run build && npm run verify:model` runs the real weights under node.
 */
const golden = JSON.parse(
  readFileSync(
    join(__dirname, '../../test/fixtures/refine9-golden.json'),
    'utf8',
  ),
) as Record<string, string> & { h: number; w: number };
const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, 'base64'));

const differing = (a: Uint8Array, b: Uint8Array) => {
  let n = 0;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d) n++;
    max = Math.max(max, d);
  }
  return { share: n / a.length, max };
};

describe('refine9 preprocessing', () => {
  it('CLAHE matches OpenCV to within one grey level', () => {
    const out = clahe(bytes(golden.input), golden.h, golden.w);
    const d = differing(out, bytes(golden.clahe));
    expect(d.max).toBeLessThanOrEqual(1);
    expect(d.share).toBeLessThan(0.01);
  });

  it('the antialiased resize matches torchvision to within one grey level', () => {
    const out = resizeSquash(bytes(golden.clahe), golden.h, golden.w, 45);
    const d = differing(out, bytes(golden.resized45));
    expect(d.max).toBeLessThanOrEqual(1);
    expect(d.share).toBeLessThan(0.01);
  });

  it('squashes any aspect ratio to a normalised 3 x 456 x 456 tensor', () => {
    const out = toModelInput(bytes(golden.input), golden.h, golden.w);
    expect(out.length).toBe(3 * REFINE9_SIZE * REFINE9_SIZE);
    // Black in channel 0 normalises to -mean/std.
    expect(Math.min(...out.subarray(0, 1000))).toBeGreaterThanOrEqual(
      -0.485 / 0.229 - 1e-6,
    );
  });

  it('builds the original, mirrored and rotated views', () => {
    const S = REFINE9_SIZE;
    const base = new Float32Array(3 * S * S).map((_, i) => i);
    const identity = Int32Array.from({ length: S * S }, (_, i) => i);
    const outside = new Int32Array(S * S).fill(-1);
    const [orig, flipped, same, empty] = ttaViews(base, [identity, outside]);
    expect(orig).toBe(base);
    expect(flipped[0]).toBe(base[S - 1]);
    expect(same[S * S + 5]).toBe(base[S * S + 5]);
    expect(empty.every((v) => v === 0)).toBe(true);
  });
});

describe('BoneAgeInferenceService', () => {
  const config = (values: Record<string, string> = {}) =>
    ({ get: (k: string) => values[k] }) as unknown as ConfigService;

  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bone-age-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** A model folder with a stub ONNX file is enough for everything but running it. */
  const modelDir = (card: object) => {
    writeFileSync(join(dir, 'm.json'), JSON.stringify(card));
    return config({ BONE_AGE_MODEL: join(dir, 'm.onnx') });
  };

  it('reports nothing about a model it could not load', async () => {
    const svc = new BoneAgeInferenceService(
      config({ BONE_AGE_MODEL: join(dir, 'nope.onnx') }),
    );
    await svc.onModuleInit();
    expect(svc.isReady).toBe(false);
    expect(svc.status).toMatchObject({
      modelVersion: null,
      maeMonths: null,
    });
    expect(svc.status.detail).toContain('nope.onnx');
    expect(svc.status.detail).toContain('nope.json');
    expect(svc.status.detail).toContain('nope_rot+5.i32');
  });

  it('ignores the old BONE_AGE_MODEL_PATH a dashboard may still hold', async () => {
    const svc = new BoneAgeInferenceService(
      config({ BONE_AGE_MODEL_PATH: 'models/bone_age.onnx' }),
    );
    await svc.onModuleInit();
    expect(svc.status.detail ?? '').not.toContain('bone_age.onnx');
  });

  it("gives each record its own model's accuracy, flagging retired B0 results", () => {
    const svc = new BoneAgeInferenceService(config());
    expect(
      svc.accuracyFor('effnetb0-v1-rsna (provisional calibration)'),
    ).toEqual({ maeMonths: 8.78, accuracyWithin12Months: 0.731, legacy: true });
    expect(svc.accuracyFor('effnetb5-refine9-rsna-tta').legacy).toBe(false);
  });

  it("reports each result's measured test-set accuracy for the mode that produced it", () => {
    const svc = new BoneAgeInferenceService(config());
    const card = {
      modelVersion: 'effnetb5-refine9-rsna',
      maeMonths: 7.43,
      accuracyWithin12Months: 0.802,
      validationSamples: 1425,
    };
    // Loading needs a real model; the card is all accuracyFor reads.
    (svc as unknown as { card: object }).card = card;
    expect(svc.accuracyFor('effnetb5-refine9-rsna').maeMonths).toBe(7.43);

    (svc as unknown as { card: object }).card = {
      ...card,
      testSet: {
        single: { maeMonths: 6.63, accuracyWithin12Months: 0.87, samples: 200 },
        tta: { maeMonths: 6.5, accuracyWithin12Months: 0.86, samples: 200 },
      },
    };
    expect(svc.accuracyFor('effnetb5-refine9-rsna')).toMatchObject({
      maeMonths: 6.63,
      accuracyWithin12Months: 0.87,
    });
    expect(svc.accuracyFor('effnetb5-refine9-rsna-tta').maeMonths).toBe(6.5);
  });

  describe('validateUpload', () => {
    const svc = () => new BoneAgeInferenceService(modelDir({}));
    const image = (format: 'jpeg' | 'png' | 'webp') =>
      sharp({
        create: { width: 40, height: 60, channels: 3, background: '#333' },
      })
        .toFormat(format)
        .toBuffer();

    it('keeps a WebP upload as it is, under the same name', async () => {
      const file = join(dir, 'a.webp');
      const bytes = await image('webp');
      writeFileSync(file, bytes);
      await expect(svc().validateUpload(file)).resolves.toBe(file);
      expect(readFileSync(file).equals(bytes)).toBe(true);
    });

    it('names the file by its real format, not the one the client sent', async () => {
      const file = join(dir, 'a.html');
      writeFileSync(file, await image('png'));
      const stored = await svc().validateUpload(file);
      expect(stored).toBe(join(dir, 'a.png'));
      expect(existsSync(file)).toBe(false);
    });

    it('refuses something that is not an image', async () => {
      const file = join(dir, 'a.png');
      writeFileSync(file, '<script>alert(1)</script>');
      await expect(svc().validateUpload(file)).rejects.toThrow(
        /Could not read the image/,
      );
    });

    it('refuses image formats the model pipeline does not take', async () => {
      const file = join(dir, 'a.gif');
      writeFileSync(
        file,
        await sharp({
          create: { width: 4, height: 4, channels: 3, background: '#000' },
        })
          .gif()
          .toBuffer(),
      );
      await expect(svc().validateUpload(file)).rejects.toThrow(/gif image/);
    });
  });
});
