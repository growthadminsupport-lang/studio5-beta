# Bone-age model: held-out test-set evaluation

TOR §6.3 asks for the MAE on a held-out test set with no overlap with training, and for the
limitations by age and sex. The ML team's figures (MAE 7.43 months, 80.2 % within a year) come
from the RSNA validation images, which were also used to choose refine9 from nine runs. So they
are not a held-out result, and they were measured with four-view test-time augmentation (TTA),
while production runs one view (`BONE_AGE_TTA=off`). This page measures both modes on data the
model has never seen, through GrowTH's own pipeline.

## Data

- **RSNA Pediatric Bone Age Challenge 2017, test set:** 200 left-hand radiographs (100 boys,
  100 girls), aged 11 months to 18 years. Its reference bone ages are the consensus of six reviewers
  from the challenge (Halabi et al., *Radiology*, 2019; online 2018). It is public:
  `https://s3.amazonaws.com/east1.public.rsna.org/AI/2017/Bone+Age+Test+Set.zip`
  (170 MB: PNG images plus `Bone age ground truth.xlsx`).
- **No overlap:** refine9 was trained on the 12,611 RSNA training images and selected on the
  1,425 validation images (`ai-service/refine9/README.md`). The 200 test images are a separate
  set released for the challenge's final scoring. This rests on the ML team's description of
  their training, which names only the training and validation sets.
- The images are not committed: RSNA's terms allow research use, not redistribution.

## Method

`backend/scripts/eval-test-set.mjs` runs each image through `BoneAgeInferenceService`, the
same code the API uses: header validation, the worker thread, CLAHE and squash resize, the
ONNX model, with the sex input from the label file. It ran with TTA off and on, on 2 October
2026, on one ARM (Ampere A1) core, model release `model-v2`.

It starts where the server does. The browser's film crop and 2048 px downsize
(`frontend/src/lib/xray.js`) are not part of it. RSNA images are film-only scans, so the crop
would mostly do nothing, but that is not measured.

## Results

Error is predicted minus reference, in months. A positive signed error means the model reads
older than the reference.

**One view (`BONE_AGE_TTA=off`, what production runs):**

| | n | MAE | median abs. error | RMSE | mean signed error | within 6 months | within 12 months | worst |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All | 200 | **6.63** | 4.92 | 8.60 | +0.63 | 58.5 % | **87.0 %** | 30.69 |
| Boys | 100 | 6.29 | 4.71 | 8.22 | −0.87 | 62.0 % | 90.0 % | 26.00 |
| Girls | 100 | 6.97 | 5.23 | 8.96 | +2.14 | 55.0 % | 84.0 % | 30.69 |
| Under 5 years | 14 | 7.87 | 7.37 | 9.47 | +3.82 | 42.9 % | 78.6 % | 18.37 |
| 5 to 10 years | 53 | 8.10 | 5.58 | 10.49 | +4.99 | 52.8 % | 77.4 % | 30.69 |
| 10 to 15 years | 108 | 5.60 | 4.71 | 7.05 | −0.29 | 63.0 % | 93.5 % | 23.24 |
| 15 years and over | 25 | 7.29 | 5.02 | 9.67 | −6.40 | 60.0 % | 84.0 % | 26.00 |

**Four views (`BONE_AGE_TTA=on`):**

| | n | MAE | median abs. error | RMSE | mean signed error | within 6 months | within 12 months | worst |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All | 200 | **6.50** | 5.18 | 8.37 | +0.98 | 56.5 % | **86.0 %** | 29.58 |
| Boys | 100 | 5.98 | 4.76 | 7.71 | −0.65 | 58.0 % | 89.0 % | 24.40 |
| Girls | 100 | 7.03 | 5.33 | 8.98 | +2.61 | 55.0 % | 83.0 % | 29.58 |
| Under 5 years | 14 | 8.83 | 7.42 | 10.28 | +5.00 | 35.7 % | 71.4 % | 18.51 |
| 5 to 10 years | 53 | 7.93 | 6.15 | 10.13 | +5.19 | 47.2 % | 73.6 % | 29.58 |
| 10 to 15 years | 108 | 5.45 | 4.62 | 6.91 | −0.04 | 63.0 % | 93.5 % | 20.79 |
| 15 years and over | 25 | 6.73 | 5.16 | 8.81 | −5.79 | 60.0 % | 88.0 % | 24.40 |

**Time per image** (median, one ARM core): 1.2 s with one view, 4.4 s with four.

**In the ML team's metrics**, for comparison with their validation table
(`ai-service/refine9/README.md`: MAE 7.425, MSE 97.28, R² 0.9441, four views):

| | MAE | MSE | R² |
| --- | --- | --- | --- |
| Test set, one view | 6.63 | 73.99 | 0.960 |
| Test set, four views | 6.50 | 70.03 | 0.962 |

R² is given to three decimals: with 200 images the fourth is noise.

## What this means

- **The TOR target is met on held-out data.** MAE 6.63 months against a target of 8 to 10.
  It is better than the validation figure of 7.43. A likely reason is the reference: the test
  set's is a six-reviewer consensus, less noisy than the single clinical readings behind the
  validation labels. With 200 images, the figure is also less precise. For scale, the best
  challenge entries scored about 4.3 months on this same test set.
- **One view is enough.** Four views improve the MAE by 0.13 months for 3.8 times the CPU. On
  the same images the two modes differ by 1.35 months on average, and TTA is closer to the
  reference on only 52 % of them. `BONE_AGE_TTA=off` stays.
- **The error depends on age: estimates are pulled toward the middle.**
  - Under 10 years the model reads older, by about 4 to 5 months on average.
  - From 15 years it reads younger, by about 6 months.
  - Between 10 and 15 it is most accurate (MAE 5.6, 93.5 % within a year).
  - The doctor's result view says this in a sentence (`BoneAgePage.jsx`).
  - The young bands are small samples: 14 children under 5.
- **By sex:** boys 6.29, girls 6.97. Girls are read older on average (+2.1 months).
- **The largest errors** (20 to 31 months, 8 images) are mostly 7- to 10-year-old girls read
  older and 16- to 18-year-old boys read younger, plus two 12-year-olds read younger. Errors
  near two years happen, which is why the result is a prompt to discuss with the doctor and
  not a finding.
- **Not a Thai population.** RSNA images are from two US children's hospitals. Bone maturation
  differs between populations, so a local check on Thai radiographs is still needed before any
  clinical claim (TOR §6.3, `client-questions.md`).

## What the app shows

`refine9.json` (release `model-v2`) carries these figures under `testSet.single` and
`testSet.tta`. Each result shows the accuracy of the mode that produced it: the API reads the
mode from the record's `modelVersion` (`-tta` suffix), not from today's setting. Before this,
every result showed the four-view validation figures.

## Reproduce

```bash
curl -LO "https://s3.amazonaws.com/east1.public.rsna.org/AI/2017/Bone+Age+Test+Set.zip"
unzip Bone+Age+Test+Set.zip
python -c "import pandas as pd; d = pd.read_excel('Bone Age Test Set/Bone age ground truth.xlsx'); \
  d.columns = ['id', 'sex', 'age']; d.to_csv('labels.csv', index=False)"   # needs openpyxl

cd backend && npm run build
export EVAL_DIR="$PWD/../Bone Age Test Set/Test Set Images" EVAL_LABELS=$PWD/../labels.csv
EVAL_OUT=tta-off.csv BONE_AGE_TTA=off npm run eval:model
EVAL_OUT=tta-on.csv BONE_AGE_TTA=on npm run eval:model
python ../ai-service/refine9/summarise_eval.py tta-off.csv tta-on.csv
```

Results are deterministic: a rerun of the first images gave the same predictions to three decimals.
