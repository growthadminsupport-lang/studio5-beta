/**
 * End-to-end check of the bone-age model against the real weights, under plain node (Jest's
 * VM realm breaks onnxruntime's typed-array check).
 *
 *     npm run build && npm run verify:model
 *     VERIFY_IMAGE=hand.jpg VERIFY_EXPECT_MALE=35.46 npm run verify:model
 *
 * VERIFY_EXPECT_MALE is what the ML team's own PyTorch pipeline (val_transform + tta_predict)
 * returns for that image; the Node chain must agree within 0.1 months
 * (0.35 for images over 2048 px, which are scaled down first). Get it from
 * ai-service/refine9 (see README there). Run this after changing preprocessing or the model.
 */

import { existsSync } from 'fs';
import { copyFile, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL =
  process.env.BONE_AGE_MODEL_PATH ?? join(root, 'models/refine9.onnx');
const IMAGE = process.env.VERIFY_IMAGE ?? join(root, 'test/fixtures/hand.png');
const EXPECT = process.env.VERIFY_EXPECT_MALE
  ? Number(process.env.VERIFY_EXPECT_MALE)
  : null;

if (!existsSync(MODEL)) {
  console.error(
    `no model at ${MODEL}\n  gh release download model-v2 --repo growthadminsupport-lang/studio5-beta --dir models`,
  );
  process.exit(1);
}

const { BoneAgeInferenceService } = await import(
  join(root, 'dist/bone-age/bone-age.inference.js')
);
const env = {
  BONE_AGE_MODEL_PATH: MODEL,
  BONE_AGE_TTA: process.env.BONE_AGE_TTA,
};
const svc = new BoneAgeInferenceService({ get: (k) => env[k] });
await svc.onModuleInit();

let failures = 0;
const check = (label, ok, detail) => {
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`,
  );
  if (!ok) failures++;
};

console.log(
  `\nmodel  : ${MODEL}\nimage  : ${IMAGE}\nstatus : ${JSON.stringify(svc.status)}\n`,
);
check('model loads', svc.isReady, svc.status.detail ?? undefined);

// The upload path: normalise to lossless greyscale WebP, then predict from that.
const dir = await mkdtemp(join(tmpdir(), 'verify-'));
const copy = join(dir, basename(IMAGE));
await copyFile(IMAGE, copy);
const stored = await svc.normaliseUpload(copy);
check('upload is stored as lossless WebP', stored.endsWith('.webp'));

const rss = () => Math.round(process.memoryUsage().rss / 1048576);
const male = await svc.predict(stored, 'MALE');
const female = await svc.predict(stored, 'FEMALE');
console.log(
  `\n  MALE   -> ${male.boneAgeMonths} months in ${male.inferenceMs} ms`,
);
console.log(
  `  FEMALE -> ${female.boneAgeMonths} months in ${female.inferenceMs} ms`,
);
console.log(`  RSS    -> ${rss()} MB\n`);

check(
  'result is inside 0-300 months',
  male.boneAgeMonths >= 0 && male.boneAgeMonths <= 300,
);
// If the sex input were ignored these would be identical.
check(
  'sex input reaches the model',
  male.boneAgeMonths !== female.boneAgeMonths,
  `${male.boneAgeMonths} vs ${female.boneAgeMonths}`,
);
if (EXPECT !== null) {
  // 0.1 months for float differences, plus up to 0.25 when an image over 2048 px is scaled
  // down before inference (MAX_SIDE in bone-age.inference.ts).
  check(
    'matches the PyTorch pipeline',
    Math.abs(male.exactMonths - EXPECT) <= 0.35,
    `${male.exactMonths.toFixed(3)} vs ${EXPECT.toFixed(3)}`,
  );
}

let rejected = false;
try {
  await svc.normaliseUpload(join(dir, 'missing.png'));
} catch {
  rejected = true;
}
check('an unreadable file is rejected', rejected);

console.log(
  failures ? `\n${failures} check(s) failed\n` : '\nall checks passed\n',
);
process.exit(failures ? 1 : 0);
