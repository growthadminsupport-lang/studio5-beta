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
| Served as | GitHub release [`model-v2`](https://github.com/growthadminsupport-lang/studio5-beta/releases/tag/model-v2): `refine9.onnx`, two rotation maps, `refine9.json` and `SHA256SUMS` |

The validation set was also used to choose refine9 from nine runs, so these figures are
research validation, not an independent test. See TOR §6.3 in `docs/tor-compliance.md`.

The ML team's comparison (1,425 validation images, 4-view TTA, 2026-10-02):

| Metric | refine5 B3 | **refine9 B5** (in use) | refine10 B7 (latest run) |
| --- | --- | --- | --- |
| MAE, months ↓ | 8.120 | **7.425** | 20.488 |
| MSE ↓ | 115.14 | **97.28** | 751.01 |
| R² ↑ | 0.9338 | **0.9441** | 0.5683 |
| Within ±12 months ↑ | 76.8 % | **80.2 %** | 38.7 % |
| Within ±6 months ↑ | 48.4 % | **52.6 %** | 20.6 % |
| Male MAE ↓ | 7.57 | **7.14** | 20.12 |
| Female MAE ↓ | 8.77 | **7.76** | 20.92 |

refine10 is the newest run but much worse, so refine9 stays. The model is about 0.6 months less
accurate for girls than for boys.

**Production runs with `BONE_AGE_TTA=off`** (one view instead of four, 3.8× faster). Every
figure above was measured with four views on the validation set. On the 200 held-out RSNA
**test** images, through the app's own pipeline, one view scores MAE **6.63 months** (87.0 %
within a year) and four views 6.50 (86.0 %), so one view costs 0.13 months. Details, by sex and
age band: [`docs/model-evaluation.md`](../../docs/model-evaluation.md).

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
| `export.py` | Checkpoint → `out/refine9.onnx` (checked against torch), plus `out/refine9_rot±5.i32`, `out/refine9.json` (the model card the backend reports) and `SHA256SUMS` |
| `golden.py` | Regenerates `backend/test/fixtures/refine9-golden.json`, the cv2 and torchvision reference that the Node unit tests compare against |

The Node side is `backend/src/bone-age/refine9.preprocess.ts` (CLAHE, resize, TTA views),
`refine9.worker.ts` (decode, preprocessing and ONNX Runtime, off the main thread) and
`bone-age.inference.ts` (upload check, queue, model card).

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

Through the full upload path (header check, 2048 px cap at prediction), images larger than
2048 px moved by up to 0.25 months. `npm run verify:model` re-runs this check against a torch
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
the film (not the hand). The server keeps the bytes it receives and never re-encodes them:
re-encoding as lossless WebP cost about 2 s per upload and made JPEGs 1.2–1.6× larger.

## Running cost

On one thread of an Ampere ARM core, one TTA prediction takes about 4.5 s (4 × B5 passes).
The whole prediction (decode, CLAHE, resize, the 4 ONNX passes) runs in a worker thread:
`onnxruntime-node` computes on the calling thread, so on the main thread every pass stalled
all requests for about a second. In the worker the main thread's longest stall is 1 ms, and
`/health` answered within 12 ms throughout the browser test. Predictions are queued one at a
time. Measured on the API: peak RSS 424 MB with `MALLOC_ARENA_MAX=2` and sharp's cache off,
against Render free's 512 MB. Five uploads at once peaked at 365 MB in the service alone.

Render's free CPU is a fraction of a core, so a prediction there takes longer. The upload
returns at once and the page polls. If it is too slow, `BONE_AGE_TTA=off` runs one view,
which is four times faster but not what the MAE was measured with.

The model's version and accuracy come from `refine9.json` next to the weights, so values left
in the Render dashboard by the previous model cannot mislabel results. Records made by the
retired B0 keep B0's accuracy (8.78 months) and a note that its calibration was never
confirmed.

## Re-running

```bash
python -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python export.py      # downloads and checks the checkpoint, writes out/
gh release upload model-v2 out/* --clobber --repo growthadminsupport-lang/studio5-beta
```
