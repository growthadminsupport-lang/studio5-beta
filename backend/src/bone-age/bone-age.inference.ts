import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { rename } from 'fs/promises';
import { dirname, extname, join, parse } from 'path';
import { Worker } from 'worker_threads';
import sharp from 'sharp';
import { MAX_INPUT_PIXELS } from './refine9.preprocess';

/**
 * Bone-age inference, in-process, with the ML team's refine9 model: EfficientNet-B5 at
 * 456 x 456 plus the sex input, predicting months directly, averaged over four test-time
 * views. Conversion and parity checks: ai-service/refine9/README.md.
 *
 * It runs here rather than as a second service because Render's free tier bills instance
 * hours per workspace, so a second always-waking service burns them twice as fast and adds a
 * second cold start.
 *
 * What the model is (version, measured accuracy) is read from `<model>.json`, released with
 * the weights, not from environment variables: a dashboard value left over from the previous
 * model would otherwise label refine9's results with B0's accuracy.
 */

sharp.cache(false);

// A result outside this band means something upstream is wrong, not that a child is unusual.
const MIN_PLAUSIBLE_MONTHS = 0;
const MAX_PLAUSIBLE_MONTHS = 300;

const FORMATS: Record<string, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

interface ModelCard {
  modelVersion: string;
  maeMonths: number;
  accuracyWithin12Months: number;
  validationSamples: number;
}

export interface BoneAgeResult {
  boneAgeMonths: number;
  /** Before rounding; for comparing against the PyTorch pipeline. */
  exactMonths: number;
  modelVersion: string;
  inferenceMs: number;
}

type Job = {
  resolve: (months: number) => void;
  reject: (err: Error) => void;
};

@Injectable()
export class BoneAgeInferenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BoneAgeInferenceService.name);
  private card: ModelCard | null = null;
  private loadError: string | null = null;
  // One prediction at a time: four B5 passes in parallel would not fit a 512 MB instance.
  private queue: Promise<unknown> = Promise.resolve();
  private worker: Promise<Worker> | null = null;
  private jobs = new Map<number, Job>();
  private nextJob = 0;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const files = [this.modelPath, this.cardPath, ...this.rotationMaps];
    const missing = files.filter((p) => !existsSync(p));
    if (missing.length) {
      this.loadError = `missing ${missing.join(', ')}`;
      this.logger.warn(
        `Bone-age model files missing (${missing.join(', ')}); predictions stay PENDING.`,
      );
      return;
    }
    try {
      this.card = JSON.parse(readFileSync(this.cardPath, 'utf8')) as ModelCard;
      await this.startWorker();
      this.logger.log(
        `Bone-age model loaded from ${this.modelPath}: ${this.modelVersion}, MAE ${this.card.maeMonths} months`,
      );
    } catch (err) {
      this.card = null;
      this.loadError = (err as Error).message;
      this.logger.error(
        `Failed to load bone-age model from ${this.modelPath}`,
        err as Error,
      );
    }
  }

  async onModuleDestroy() {
    const worker = await this.worker?.catch(() => null);
    this.worker = null;
    await worker?.terminate();
  }

  /**
   * `BONE_AGE_MODEL`, not the old `BONE_AGE_MODEL_PATH`: a dashboard still holding the B0
   * path under the old name must not stop refine9 from loading.
   */
  private get modelPath(): string {
    return this.config.get<string>('BONE_AGE_MODEL') ?? 'models/refine9.onnx';
  }

  /** `refine9.onnx` -> `refine9<suffix>`, next to it. */
  private sibling(suffix: string): string {
    const { dir, name } = parse(this.modelPath);
    return join(dir, `${name}${suffix}`);
  }

  private get cardPath(): string {
    return this.sibling('.json');
  }

  /** Test-time augmentation, as the reported MAE was measured. Off only to save CPU. */
  private get useTta(): boolean {
    return this.config.get<string>('BONE_AGE_TTA') !== 'off';
  }

  private get rotationMaps(): string[] {
    return this.useTta
      ? [this.sibling('_rot+5.i32'), this.sibling('_rot-5.i32')]
      : [];
  }

  get modelVersion(): string {
    const base = this.card?.modelVersion ?? 'unknown';
    return this.useTta ? `${base}-tta` : base;
  }

  /**
   * The accuracy that goes with a stored result: the current model's, or the retired B0's for
   * records it produced. Those also carry `legacy`, because their months were converted with
   * calibration constants that were derived rather than supplied.
   */
  accuracyFor(modelVersion: string | null): {
    maeMonths: number | null;
    accuracyWithin12Months: number | null;
    legacy: boolean;
  } {
    if (modelVersion?.startsWith('effnetb0')) {
      return { maeMonths: 8.78, accuracyWithin12Months: 0.731, legacy: true };
    }
    return {
      maeMonths: this.card?.maeMonths ?? null,
      accuracyWithin12Months: this.card?.accuracyWithin12Months ?? null,
      legacy: false,
    };
  }

  /** The model loaded once; a crashed worker is restarted on the next prediction. */
  get isReady(): boolean {
    return this.card !== null && this.loadError === null;
  }

  get status() {
    return {
      ready: this.isReady,
      modelVersion: this.card ? this.modelVersion : null,
      /** Mean absolute error in months on the validation set: the "±" FR-18 shows. */
      maeMonths: this.card?.maeMonths ?? null,
      /** Share within a year, shown with the MAE because the mean hides the spread. */
      accuracyWithin12Months: this.card?.accuracyWithin12Months ?? null,
      detail: this.loadError,
    };
  }

  /**
   * Checks an upload from its header only (no decode, so it is quick) and names it by what it
   * really is. The bytes are kept as uploaded: the browser has already cropped and scaled
   * them, and the model reads channel 0 of the original at prediction time. Re-encoding was
   * slower, and for JPEGs larger, and a lossy one moved predictions by months.
   */
  async validateUpload(file: string): Promise<string> {
    let format: string | undefined;
    try {
      const meta = await sharp(file, {
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();
      if (!meta.width || !meta.height) throw new Error('no dimensions');
      if (meta.width * meta.height > MAX_INPUT_PIXELS) {
        throw new Error('over 40 megapixels');
      }
      format = meta.format;
    } catch (err) {
      throw new Error(
        `Could not read the image (${(err as Error).message}). Upload a JPEG, PNG or WebP, or a PDF from the app.`,
      );
    }
    const ext = format ? FORMATS[format] : undefined;
    if (!ext) {
      throw new Error(
        `This is a ${format ?? 'unknown'} image. Upload a JPEG, PNG or WebP, or a PDF from the app.`,
      );
    }
    if (extname(file).toLowerCase() === ext) return file;
    // The stored name decides the Content-Type it is served with, so it follows the bytes,
    // not the name the client sent.
    const named = join(dirname(file), `${parse(file).name}${ext}`);
    await rename(file, named);
    return named;
  }

  async predict(file: string, sex: 'MALE' | 'FEMALE'): Promise<BoneAgeResult> {
    const run = this.queue.then(() => this.predictNow(file, sex));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private get workerPath(): string {
    return join(__dirname, 'refine9.worker.js');
  }

  /**
   * Starts the worker and loads the model in it. Resolves once it is ready. If the worker
   * dies (out of memory, a native crash), the pending prediction fails and the next one
   * starts a new worker.
   */
  private startWorker(): Promise<Worker> {
    if (this.worker) return this.worker;
    this.worker = new Promise<Worker>((resolve, reject) => {
      if (!existsSync(this.workerPath)) {
        reject(new Error(`inference worker not built (${this.workerPath})`));
        return;
      }
      const worker = new Worker(this.workerPath);
      worker.unref();
      worker.on(
        'message',
        (msg: {
          type?: string;
          id?: number;
          months?: number;
          error?: string;
        }) => {
          if (msg.type === 'ready') return resolve(worker);
          if (msg.type === 'initError') return reject(new Error(msg.error));
          const job = this.jobs.get(msg.id!);
          if (!job) return;
          this.jobs.delete(msg.id!);
          if (msg.error) job.reject(new Error(msg.error));
          else job.resolve(msg.months!);
        },
      );
      const fail = (err: Error) => {
        reject(err);
        for (const job of this.jobs.values()) job.reject(err);
        this.jobs.clear();
        this.worker = null;
      };
      worker.on('error', fail);
      worker.on('exit', (code) =>
        fail(new Error(`inference worker exited (${code})`)),
      );
      worker.postMessage({
        type: 'init',
        modelPath: this.modelPath,
        threads: Number(this.config.get<string>('BONE_AGE_THREADS') ?? 1),
      });
    });
    this.worker.catch(() => (this.worker = null));
    return this.worker;
  }

  private async predictNow(
    file: string,
    sex: 'MALE' | 'FEMALE',
  ): Promise<BoneAgeResult> {
    if (!this.isReady) {
      throw new Error(this.loadError ?? 'model not loaded');
    }
    const started = Date.now();
    const worker = await this.startWorker();
    const id = this.nextJob++;
    const months = await new Promise<number>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      worker.postMessage({
        type: 'predict',
        id,
        file,
        male: sex === 'MALE',
        rotationMaps: this.rotationMaps,
      });
    });

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
