/**
 * refine9's validation transform, ported from the ML team's `train.py` (branch Backend+AI):
 *
 *   apply_clahe -> transforms.Resize((456, 456)) -> ConvertImageDtype -> 3 channels -> Normalize
 *
 * and the test-time augmentation in their `evaluate.py` (original, horizontal flip, +5 deg,
 * -5 deg, averaged). Checked against the Python pipeline on six real hand radiographs: the
 * averaged prediction agrees to within 0.013 months (ai-service/refine9/README.md).
 *
 * Two things here are easy to get wrong and both move the answer by months, not decimals:
 * - The model reads **channel 0** of the decoded image, as `apply_clahe` does. A luminance
 *   conversion of a tinted image is a different input.
 * - refine9 was trained on **whole, uncropped frames squashed to 456 x 456**. The older
 *   crop-to-hand + letterbox pipeline in the same file belongs to refine8; applying it here
 *   shifted one test image by 3.7 months.
 */

export const REFINE9_SIZE = 456;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const f32 = Math.fround;

function reflect101(i: number, n: number): number {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i : 2 * n - 2 - i;
  return i;
}

/** saturate_cast<uchar>(float): round half to even, then clamp. */
function saturate(v: number): number {
  let r = Math.round(v);
  if (Math.abs(v % 1) === 0.5 && r % 2 !== 0) r -= 1;
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

/**
 * cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(), following OpenCV's
 * CLAHE_Impl: reflect-101 padding to whole tiles, integer clip limit, excess redistributed
 * evenly with the remainder stepped across the histogram, float32 bilinear blending between
 * tile LUTs. Matches cv2 to within one grey level on about 0.01 % of pixels (SIMD rounding).
 */
export function clahe(
  src: Uint8Array,
  H: number,
  W: number,
  clipLimit = 2.0,
  tiles = 8,
): Uint8Array {
  let ext = src;
  let EH = H;
  let EW = W;
  if (!(W % tiles === 0 && H % tiles === 0)) {
    // OpenCV pads both axes whenever either is uneven, by `tiles - (n % tiles)` (a whole
    // extra tile on an axis that was already even). Kept as is: it changes the tile size.
    EH = H + (tiles - (H % tiles));
    EW = W + (tiles - (W % tiles));
    ext = new Uint8Array(EH * EW);
    for (let y = 0; y < EH; y++) {
      const sy = reflect101(y, H) * W;
      for (let x = 0; x < EW; x++) ext[y * EW + x] = src[sy + reflect101(x, W)];
    }
  }
  const tw = EW / tiles;
  const th = EH / tiles;
  const tileArea = tw * th;
  const lutScale = f32(255 / tileArea);
  const clip = Math.max(Math.trunc((clipLimit * tileArea) / 256), 1);

  const lut = new Uint8Array(tiles * tiles * 256);
  const hist = new Int32Array(256);
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      hist.fill(0);
      for (let y = ty * th; y < (ty + 1) * th; y++) {
        const row = y * EW;
        for (let x = tx * tw; x < (tx + 1) * tw; x++) hist[ext[row + x]]++;
      }
      let clipped = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clip) {
          clipped += hist[i] - clip;
          hist[i] = clip;
        }
      }
      const batch = Math.trunc(clipped / 256);
      let residual = clipped - batch * 256;
      for (let i = 0; i < 256; i++) hist[i] += batch;
      if (residual !== 0) {
        const step = Math.max(Math.trunc(256 / residual), 1);
        for (let i = 0; i < 256 && residual > 0; i += step, residual--)
          hist[i]++;
      }
      let sum = 0;
      const base = (ty * tiles + tx) * 256;
      for (let i = 0; i < 256; i++) {
        sum += hist[i];
        lut[base + i] = saturate(f32(sum * lutScale));
      }
    }
  }

  const out = new Uint8Array(H * W);
  const invTw = f32(1 / tw);
  const invTh = f32(1 / th);
  const ind1 = new Int32Array(W);
  const ind2 = new Int32Array(W);
  const xa = new Float32Array(W);
  const xa1 = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const txf = f32(f32(x * invTw) - 0.5);
    const tx1 = Math.floor(txf);
    const a = f32(txf - tx1);
    ind1[x] = Math.max(tx1, 0) * 256;
    ind2[x] = Math.min(tx1 + 1, tiles - 1) * 256;
    xa[x] = a;
    xa1[x] = f32(1 - a);
  }
  for (let y = 0; y < H; y++) {
    const tyf = f32(f32(y * invTh) - 0.5);
    const ty1 = Math.floor(tyf);
    const ya = f32(tyf - ty1);
    const ya1 = f32(1 - ya);
    const p1 = Math.max(ty1, 0) * tiles * 256;
    const p2 = Math.min(ty1 + 1, tiles - 1) * tiles * 256;
    for (let x = 0; x < W; x++) {
      const v = src[y * W + x];
      // Fused multiply-add, as OpenCV's SIMD path does: the closest match of the variants tried.
      const r1 = f32(
        lut[p1 + ind1[x] + v] * xa1[x] + f32(lut[p1 + ind2[x] + v] * xa[x]),
      );
      const r2 = f32(
        lut[p2 + ind1[x] + v] * xa1[x] + f32(lut[p2 + ind2[x] + v] * xa[x]),
      );
      out[y * W + x] = saturate(f32(r1 * ya1 + f32(r2 * ya)));
    }
  }
  return out;
}

/** PyTorch's antialiased bilinear weights (`_compute_weights_aa`) along one axis. */
function aaWeights(inSize: number, outSize: number) {
  const scale = inSize / outSize;
  const support = scale >= 1 ? scale : 1;
  const invscale = scale >= 1 ? 1 / scale : 1;
  const res: { xmin: number; w: Float64Array }[] = [];
  for (let i = 0; i < outSize; i++) {
    const center = scale * (i + 0.5);
    const xmin = Math.max(Math.trunc(center - support + 0.5), 0);
    const xsize = Math.min(Math.trunc(center + support + 0.5), inSize) - xmin;
    const w = new Float64Array(xsize);
    let total = 0;
    for (let j = 0; j < xsize; j++) {
      const t = Math.abs((j + xmin - center + 0.5) * invscale);
      w[j] = t < 1 ? 1 - t : 0;
      total += w[j];
    }
    if (total !== 0) for (let j = 0; j < xsize; j++) w[j] /= total;
    res.push({ xmin, w });
  }
  return res;
}

/** transforms.Resize((size, size)) on a uint8 image: antialiased bilinear, aspect not kept. */
export function resizeSquash(
  src: Uint8Array,
  H: number,
  W: number,
  size = REFINE9_SIZE,
): Uint8Array {
  const wx = aaWeights(W, size);
  const wy = aaWeights(H, size);
  const tmp = new Float64Array(H * size);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < size; x++) {
      const { xmin, w } = wx[x];
      let s = 0;
      for (let j = 0; j < w.length; j++) s += w[j] * src[row + xmin + j];
      tmp[y * size + x] = s;
    }
  }
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    const { xmin, w } = wy[y];
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let j = 0; j < w.length; j++) s += w[j] * tmp[(xmin + j) * size + x];
      out[y * size + x] = Math.min(255, Math.max(0, Math.round(s)));
    }
  }
  return out;
}

/** Grey channel 0 of a decoded image -> normalised 3 x 456 x 456 tensor, planar (CHW). */
export function toModelInput(
  gray: Uint8Array,
  H: number,
  W: number,
): Float32Array {
  const S = REFINE9_SIZE;
  const P = S * S;
  const small = resizeSquash(clahe(gray, H, W), H, W, S);
  const out = new Float32Array(3 * P);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < P; i++)
      out[c * P + i] = (small[i] / 255 - MEAN[c]) / STD[c];
  }
  return out;
}

/**
 * The four test-time views `tta_predict` averages: as is, mirrored, and rotated by +5 and -5
 * degrees. Rotation is torchvision's nearest-neighbour `TF.rotate` with zero fill, replayed
 * from index maps that torch itself produced (ai-service/refine9/export.py), so it cannot
 * drift from the original by a rounding choice. `-1` in a map means "outside the frame".
 */
export function ttaViews(
  base: Float32Array,
  rotations: Int32Array[],
): Float32Array[] {
  const S = REFINE9_SIZE;
  const P = S * S;
  const flipped = new Float32Array(3 * P);
  const rotated = rotations.map(() => new Float32Array(3 * P));
  for (let c = 0; c < 3; c++) {
    const plane = c * P;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const o = plane + y * S + x;
        flipped[o] = base[plane + y * S + (S - 1 - x)];
        for (let r = 0; r < rotations.length; r++) {
          const from = rotations[r][y * S + x];
          rotated[r][o] = from < 0 ? 0 : base[plane + from];
        }
      }
    }
  }
  return [base, flipped, ...rotated];
}
