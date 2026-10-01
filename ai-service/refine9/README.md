# refine9: the bone-age model in production

Since 2026-10-01 the backend runs the ML team's **refine9** model in place of the original
EfficientNet-B0 (`model-v1`). This folder is how the team's PyTorch checkpoint becomes what
NestJS runs, and the record of how the port was checked.

| | |
| --- | --- |
| Source | ML team, branch `Backend+AI` of `growthadminsupport-lang/studio5-frontend`, `backend/bone_age_ai/` |
| Checkpoint | `best_model_refine9_b5_456.pth`, 115,444,602 bytes, SHA-256 `18ba920a…7491c`, from the team's release `refine9-b5-456-v1` |
| Network | EfficientNet-B5 backbone, image features + sex (1.0 = male) → 128 → 1. Outputs **months directly**, so there are no calibration constants |
| Input | 456 × 456, ImageNet normalisation |
| Validation | 1,425 RSNA validation images, 4-view TTA: **MAE 7.43 months, 80.2 % within 12 months** (was 8.78 and 73.1 % for B0) |
| Served as | GitHub release [`model-v2`](https://github.com/growthadminsupport-lang/studio5-beta/releases/tag/model-v2): `refine9.onnx` + two rotation maps + `SHA256SUMS` |

The validation set was also used to choose refine9 from nine runs, so these figures are
research validation, not an independent test. See TOR §6.3 in `docs/tor-compliance.md`.

## The pipeline, exactly as trained

From the team's `train.py`. Note that `refine9_b5_456` **overrides** the default transform
further down the file:

1. **Channel 0** of the decoded image (`apply_clahe` takes `img[0:1]`).
2. CLAHE, clip limit 2.0, 8 × 8 tiles (OpenCV).
3. `transforms.Resize((456, 456))`: antialiased bilinear, **squashed**, aspect ratio not kept.
4. ÷ 255, repeated to 3 channels, ImageNet mean/std.
5. TTA (`evaluate.py`): the original, a horizontal flip, and `TF.rotate` by +5° and −5° (nearest neighbour, zero fill). The four predictions are averaged.

The default transform in the same file crops to the hand and letterboxes. **That belongs to
refine8, not refine9.** Applying it to refine9 moved one test image by 3.7 months.

## Files

| File | What |
| --- | --- |
| `model.py`, `manifest.json` | Copied unchanged from the team's branch |
| `export.py` | Checkpoint → `out/refine9.onnx` (checked against torch), plus `out/refine9_rot±5.i32` and `SHA256SUMS` |
| `golden.py` | Regenerates `backend/test/fixtures/refine9-golden.json`, the cv2 and torchvision reference that the Node unit tests compare against |

The Node side is `backend/src/bone-age/refine9.preprocess.ts` (CLAHE, resize, TTA views) and
`bone-age.inference.ts` (ONNX Runtime, upload normalisation).

The rotation maps are what torchvision's `TF.rotate` does to an image whose pixels hold their
own index. Node replays them, so the rotated views match torch by construction rather than by
re-deriving the affine grid and its rounding.

## How the port was checked

There were six real hand radiographs from Wikimedia Commons (ages 2 to adult), and the team's
own Python pipeline ran on each with the real weights.

| Stage | Node vs Python |
| --- | --- |
| JPEG decode (sharp vs torchvision), channel 0 | identical |
| CLAHE | ±1 grey level on ~0.01 % of pixels (OpenCV SIMD rounding) |
| Resize | ±1 grey level on ~10 of 207,936 pixels |
| ONNX vs torch, same tensor | agree to 5 decimals |
| **Final TTA prediction** | **within 0.013 months** on all six |

Through the full upload path (lossless WebP storage, 2048 px cap), images larger than 2048 px
moved by up to 0.25 months. `npm run verify:model` re-runs this check against a torch
reference value (`VERIFY_IMAGE`, `VERIFY_EXPECT_MALE`).

Each upload step was also measured for how far it moves the answer:

| What happens to the image first | Shift |
| --- | --- |
| Downscale to 2048 px (images over 2048) | ≤ 0.25 months |
| Re-encode as JPEG quality 90 / 95 / 98 | up to 3.3 / 3.1 / 1.2 months |
| Lossless PNG or WebP | 0 |
| Greyscale (luminance) instead of channel 0, on a tinted image | 1.7 months |
| Crop tightly to the hand | up to 3.7 months |
| The same X-ray inside a PDF report, cropped to the film in the browser | about 1 month (PDF rendering resamples it) |

This is why the browser sends untouched originals when it can, otherwise lossless PNG cut to
the film (not the hand), and the server stores channel 0 as lossless WebP.

## Running cost

On one thread of an Ampere ARM core, one TTA prediction takes about 4.5 s (4 × B5 passes).
Measured on the API: peak RSS 413 MB with `MALLOC_ARENA_MAX=2` and sharp's cache off, against
Render free's 512 MB. Render's free CPU is a fraction of a core, so a prediction there takes
longer. The upload returns at once and the page polls. If it is too slow, `BONE_AGE_TTA=off`
runs one view, which is four times faster but not what the MAE was measured with.

## Re-running

```bash
python -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python export.py      # downloads and checks the checkpoint, writes out/
gh release upload model-v2 out/* --clobber --repo growthadminsupport-lang/studio5-beta
```
