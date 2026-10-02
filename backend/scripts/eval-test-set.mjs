/**
 * Accuracy of the deployed bone-age pipeline on a labelled, held-out set of hand radiographs:
 * the same upload validation, preprocessing, worker and model the API uses, not the ML team's
 * Python. It starts where the server does, so the browser's film crop and 2048 px downsize
 * (frontend/src/lib/xray.js) are not part of what it measures. Writes one CSV row per image;
 * summarise with `ai-service/refine9/summarise_eval.py`.
 *
 *     npm run build
 *     EVAL_DIR=<images> EVAL_LABELS=labels.csv EVAL_OUT=tta-on.csv BONE_AGE_TTA=on \
 *       npm run eval:model
 *
 * EVAL_LABELS is a CSV with a header and columns id,sex,age: id is the file name without
 * extension, sex is M or F, age is the reference bone age in months. The RSNA 2017 test set
 * (200 images, ground truth from six radiologists) is public; see docs/model-evaluation.md.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { copyFile, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = process.env.BONE_AGE_MODEL ?? join(root, 'models/refine9.onnx');
const { EVAL_DIR, EVAL_LABELS, EVAL_OUT } = process.env;
if (!EVAL_DIR || !EVAL_LABELS || !EVAL_OUT) {
  console.error('set EVAL_DIR, EVAL_LABELS and EVAL_OUT');
  process.exit(1);
}

const rows = readFileSync(EVAL_LABELS, 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const [id, sex, age] = line.split(',');
    return { id, sex: sex.trim() === 'M' ? 'MALE' : 'FEMALE', age: Number(age) };
  });

const { BoneAgeInferenceService } = await import(
  join(root, 'dist/bone-age/bone-age.inference.js')
);
const env = { BONE_AGE_MODEL: MODEL, BONE_AGE_TTA: process.env.BONE_AGE_TTA };
const svc = new BoneAgeInferenceService({ get: (k) => env[k] });
await svc.onModuleInit();
if (!svc.isReady) {
  console.error('model not ready', svc.status);
  process.exit(1);
}

const dir = await mkdtemp(join(tmpdir(), 'eval-'));
// Rows are appended as they finish, and one unreadable image is logged rather than ending a
// run that takes a quarter of an hour with TTA.
writeFileSync(EVAL_OUT, 'id,sex,age,predicted,ms\n');
let done = 0;
let failed = 0;
let sumErr = 0;
for (const [i, r] of rows.entries()) {
  const src = ['png', 'jpg', 'jpeg']
    .map((ext) => join(EVAL_DIR, `${r.id}.${ext}`))
    .find(existsSync);
  try {
    if (!src) throw new Error('no image file');
    // Uploads are validated and kept as a copy, exactly as the API does.
    const copy = join(dir, `${r.id}${src.slice(src.lastIndexOf('.'))}`);
    await copyFile(src, copy);
    const stored = await svc.validateUpload(copy);
    const res = await svc.predict(stored, r.sex);
    sumErr += Math.abs(res.exactMonths - r.age);
    done++;
    appendFileSync(
      EVAL_OUT,
      [r.id, r.sex[0], r.age.toFixed(3), res.exactMonths.toFixed(3), res.inferenceMs].join(',') + '\n',
    );
  } catch (err) {
    failed++;
    console.error(`${r.id}: ${err.message}`);
  }
  if ((i + 1) % 20 === 0 && done) {
    console.log(`${i + 1}/${rows.length}  running MAE ${(sumErr / done).toFixed(2)} months`);
  }
}
await svc.onModuleDestroy();
console.log(`wrote ${done} rows to ${EVAL_OUT}${failed ? `; ${failed} image(s) failed` : ''}`);
process.exit(failed ? 1 : 0);
