import { readFileSync } from 'fs';
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

  it('reports refine9 and its measured accuracy by default', () => {
    const svc = new BoneAgeInferenceService(config());
    expect(svc.status).toMatchObject({
      modelVersion: 'effnetb5-refine9-rsna-tta',
      maeMonths: 7.43,
      accuracyWithin12Months: 0.802,
    });
  });

  it('marks the version when test-time augmentation is switched off', () => {
    const svc = new BoneAgeInferenceService(config({ BONE_AGE_TTA: 'off' }));
    expect(svc.modelVersion).toBe('effnetb5-refine9-rsna');
  });

  it('stays unready, without throwing, when the model files are missing', async () => {
    const svc = new BoneAgeInferenceService(
      config({ BONE_AGE_MODEL_PATH: 'models/nope.onnx' }),
    );
    await svc.onModuleInit();
    expect(svc.isReady).toBe(false);
    expect(svc.status.detail).toContain('nope.onnx');
    expect(svc.status.detail).toContain('nope_rot+5.i32');
  });
});
