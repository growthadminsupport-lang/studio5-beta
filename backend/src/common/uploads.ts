import { Logger, NotFoundException, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { AwsClient } from 'aws4fetch';

/**
 * Uploaded files: X-rays (`bone-age/`), profile photos (`avatars/`) and the Home page's
 * pictures and videos (`site/`).
 *
 * Multer writes every upload to local disk first, and the bone-age model reads from there.
 * Render's free disk is wiped on each deploy, so when Cloudflare R2 is configured
 * (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) each file is also kept in
 * R2, which is the copy that lasts: images are streamed from it, and a file missing on local
 * disk after a deploy is fetched back from it before inference. Without R2 everything stays on
 * local disk, as before (fine for development; lost on redeploy in production).
 *
 * The bucket is private. Files are only ever read through the API's own access-checked routes;
 * there is no public R2 URL.
 *
 * Rows keep the same `/uploads/<dir>/<name>` value either way; only the name is used here.
 */

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.dcm': 'application/dicom',
};

const logger = new Logger('Uploads');

interface R2 {
  client: AwsClient;
  base: string;
}

let r2: R2 | null | undefined;
/** The R2 client, or null when not configured. Read once, from the environment. */
function bucket(): R2 | null {
  if (r2 !== undefined) return r2;
  const account = process.env.R2_ACCOUNT_ID;
  const key = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const name = process.env.R2_BUCKET;
  if (!account || !key || !secret || !name) {
    r2 = null;
    return r2;
  }
  const endpoint =
    process.env.R2_ENDPOINT ?? `https://${account}.r2.cloudflarestorage.com`;
  r2 = {
    client: new AwsClient({
      accessKeyId: key,
      secretAccessKey: secret,
      service: 's3',
      region: 'auto',
    }),
    base: `${endpoint.replace(/\/$/, '')}/${name}`,
  };
  logger.log(`Uploads are kept in R2 bucket "${name}"`);
  return r2;
}

/** Only for tests: forget the cached configuration. */
export function resetStorageForTests() {
  r2 = undefined;
}

export function isPersistentStorage() {
  return bucket() !== null;
}

const localPath = (dir: string, storedPath: string) =>
  join(UPLOADS_ROOT, dir, basename(storedPath));
const objectKey = (dir: string, storedPath: string) =>
  `${dir}/${encodeURIComponent(basename(storedPath))}`;
const contentType = (name: string) =>
  CONTENT_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream';

/**
 * Keeps an upload beyond this instance's disk (R2), once it has been accepted. Throws if R2 is
 * configured but refuses it: saving a record whose image will vanish on the next deploy would
 * be worse than asking the person to try again.
 */
export async function persistUpload(dir: string, storedPath: string) {
  const store = bucket();
  if (!store) return;
  const file = localPath(dir, storedPath);
  const res = await store.client.fetch(
    `${store.base}/${objectKey(dir, storedPath)}`,
    {
      method: 'PUT',
      body: await readFile(file),
      headers: { 'Content-Type': contentType(file) },
    },
  );
  if (!res.ok) {
    throw new Error(`storage refused the file (${res.status})`);
  }
}

/**
 * The upload as a local file, for code that needs a path (the bone-age model). Fetches it back
 * from R2 when this instance's disk no longer has it.
 */
export async function ensureLocal(
  dir: string,
  storedPath: string,
): Promise<string> {
  const file = localPath(dir, storedPath);
  if (existsSync(file)) return file;
  const store = bucket();
  if (!store) throw new Error('image is no longer on this server');
  const res = await store.client.fetch(
    `${store.base}/${objectKey(dir, storedPath)}`,
  );
  if (!res.ok) throw new Error(`image not found in storage (${res.status})`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/**
 * Streams a file stored under `uploads/<dir>/`, given the `/uploads/...` path recorded on
 * the row. Callers must have already authorized the request; this function only turns an
 * approved path into bytes.
 *
 * Taking `basename` of the stored value keeps the guarantee local: nothing here can be talked
 * into reading outside `uploads/<dir>`, on disk or in the bucket.
 *
 * A missing file is a 404 rather than a 500: without R2, the free Render disk is wiped on each
 * deploy, so a row can outlive its image.
 */
export async function streamUpload(
  dir: string,
  storedPath: string | null | undefined,
): Promise<StreamableFile> {
  if (!storedPath) {
    throw new NotFoundException('No image on file');
  }
  const type = contentType(storedPath);
  const file = localPath(dir, storedPath);
  if (existsSync(file)) {
    return new StreamableFile(createReadStream(file), {
      type,
      disposition: 'inline',
    });
  }
  const store = bucket();
  if (store) {
    const res = await store.client.fetch(
      `${store.base}/${objectKey(dir, storedPath)}`,
    );
    if (res.ok && res.body) {
      return new StreamableFile(
        Readable.fromWeb(res.body as unknown as WebReadableStream),
        { type, disposition: 'inline' },
      );
    }
  }
  throw new NotFoundException('Image is no longer available on the server');
}

/**
 * Deletes a stored upload, locally and in R2. Multer writes the file before the handler runs,
 * so a request that is then refused (wrong role, bad date) would otherwise leave an orphaned
 * radiograph. Never throws: failing to tidy up must not mask the error that caused it.
 */
export async function removeUpload(
  dir: string,
  storedPath: string | null | undefined,
) {
  if (!storedPath) return;
  await unlink(localPath(dir, storedPath)).catch(() => undefined);
  const store = bucket();
  if (!store) return;
  try {
    const res = await store.client.fetch(
      `${store.base}/${objectKey(dir, storedPath)}`,
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 404) {
      logger.warn(
        `R2 delete of ${dir}/${basename(storedPath)} returned ${res.status}`,
      );
    }
  } catch (err) {
    logger.warn(
      `R2 delete of ${dir}/${basename(storedPath)} failed: ${(err as Error).message}`,
    );
  }
}

/**
 * Sends a public upload with HTTP range support. Safari will not play a <video> from a server
 * that ignores `Range`, and streamUpload's StreamableFile always answers with the whole file.
 * Local files go through Express's sendFile, which handles ranges and conditional requests;
 * after a redeploy the file comes from R2, which is asked for the same range.
 *
 * The URL carries the file name, and a new upload gets a new name, so the response can be
 * cached for good. Only for files that are public anyway: no access check happens here.
 */
export async function sendPublicUpload(
  dir: string,
  storedPath: string,
  req: Request,
  res: Response,
) {
  const headers = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': contentType(storedPath),
  };
  const file = localPath(dir, storedPath);
  if (existsSync(file)) {
    res.sendFile(file, { headers, acceptRanges: true });
    return;
  }
  const store = bucket();
  if (!store) throw new NotFoundException('File is no longer on the server');
  const range = req.headers.range;
  const remote = await store.client.fetch(
    `${store.base}/${objectKey(dir, storedPath)}`,
    { headers: range ? { Range: range } : {} },
  );
  if (!remote.ok || !remote.body) {
    throw new NotFoundException('File is no longer available on the server');
  }
  res.status(remote.status);
  res.set({ ...headers, 'Accept-Ranges': 'bytes' });
  for (const name of ['Content-Length', 'Content-Range', 'ETag']) {
    const value = remote.headers.get(name);
    if (value) res.set(name, value);
  }
  Readable.fromWeb(remote.body as unknown as WebReadableStream).pipe(res);
}
