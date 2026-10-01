// Turning whatever a doctor has (a PDF report, a phone photo of a film, a PACS export) into the
// image the bone-age model should see.
//
// The model (refine9) was trained on whole radiograph frames, so "cropping" here means cutting
// away what is not the film: page margins, report text, the light box. It must not crop to the
// hand itself; that moved test predictions by up to 3.7 months. The server reads channel 0 and
// keeps the image lossless, so nothing here converts to greyscale or re-encodes as JPEG.

export const MAX_SIDE = 2048;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PDF_RENDER_SIDE = 3072;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Renders page `pageNumber` of a PDF to a canvas. pdf.js is loaded only when a PDF arrives. */
async function pdfToCanvas(file, pageNumber) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PDF_RENDER_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return { canvas, pages: doc.numPages };
  } finally {
    doc.destroy();
  }
}

async function imageToCanvas(file) {
  // from-image applies EXIF rotation, as the server does (sharp .rotate()).
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

/**
 * Decodes a PDF page or an image into a canvas. Throws a message a doctor can act on.
 * Returns `{ canvas, pages, source }`, where source is the original file if it is an image.
 */
export async function loadXray(file, pageNumber = 1) {
  if (isPdf(file)) {
    try {
      const { canvas, pages } = await pdfToCanvas(file, pageNumber);
      return { canvas, pages, source: null };
    } catch {
      throw new Error('Could not open that PDF. Export the X-ray as an image, or try another PDF.');
    }
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use a PDF, JPEG, PNG or WebP file.');
  }
  try {
    return { canvas: await imageToCanvas(file), pages: 1, source: file };
  } catch {
    throw new Error('Could not read that image. Try exporting it again as JPEG or PNG.');
  }
}

/**
 * Finds the film on a page or a photo by peeling away bright margins from the outside in: a
 * row or column at the edge is "paper" when most of its pixels are near-white (a report page,
 * a light box). Text lines are mostly white, so they peel away too. A radiograph's edges are
 * dark, so a plain X-ray keeps its whole frame, which is what the model was trained on.
 * Returns a crop in percent.
 */
export function detectFilm(canvas) {
  const scale = Math.min(1, 512 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const bright = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bright[i] = data[i * 4] > 200 ? 1 : 0;

  const PAPER = 0.6;
  const rowIsPaper = (y, x0, x1) => {
    let n = 0;
    for (let x = x0; x < x1; x++) n += bright[y * w + x];
    return n / (x1 - x0) > PAPER;
  };
  const colIsPaper = (x, y0, y1) => {
    let n = 0;
    for (let y = y0; y < y1; y++) n += bright[y * w + x];
    return n / (y1 - y0) > PAPER;
  };

  let [x0, y0, x1, y1] = [0, 0, w, h];
  // A few passes: trimming the side margins makes the header text rows above the film
  // all-paper within the remaining columns, and so on.
  for (let pass = 0; pass < 4; pass++) {
    const before = `${x0},${y0},${x1},${y1}`;
    while (y1 - y0 > 1 && rowIsPaper(y0, x0, x1)) y0++;
    while (y1 - y0 > 1 && rowIsPaper(y1 - 1, x0, x1)) y1--;
    while (x1 - x0 > 1 && colIsPaper(x0, y0, y1)) x0++;
    while (x1 - x0 > 1 && colIsPaper(x1 - 1, y0, y1)) x1--;
    if (before === `${x0},${y0},${x1},${y1}`) break;
  }

  const crop = { unit: '%', x: (x0 / w) * 100, y: (y0 / h) * 100, width: ((x1 - x0) / w) * 100, height: ((y1 - y0) / h) * 100 };
  // Nothing found (an all-white page) or nearly everything is film: keep the whole image.
  if (crop.width < 15 || crop.height < 15 || crop.width * crop.height > 9200) {
    return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  }
  return crop;
}

export function isWholeFrame(crop) {
  return !crop || (crop.x <= 0.5 && crop.y <= 0.5 && crop.width >= 99.5 && crop.height >= 99.5);
}

/**
 * The file to upload. An image that is already small enough and not cropped goes up as it is,
 * byte for byte. Anything else is cut to the crop, scaled to at most 2048 px and saved as PNG,
 * which is lossless: a JPEG re-encode moved one test prediction by 3 months.
 */
export async function prepareUpload({ canvas, source }, crop) {
  const whole = isWholeFrame(crop);
  if (source && whole && Math.max(canvas.width, canvas.height) <= MAX_SIDE && source.size <= MAX_UPLOAD_BYTES) {
    return { file: source, width: canvas.width, height: canvas.height, untouched: true };
  }
  const c = whole ? { x: 0, y: 0, width: 100, height: 100 } : crop;
  const sx = Math.round((c.x / 100) * canvas.width);
  const sy = Math.round((c.y / 100) * canvas.height);
  const sw = Math.max(1, Math.round((c.width / 100) * canvas.width));
  const sh = Math.max(1, Math.round((c.height / 100) * canvas.height));
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not prepare the image in this browser.');
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error('The prepared image is over 10 MB. Crop closer to the film and try again.');
  }
  return {
    file: new File([blob], 'xray.png', { type: 'image/png' }),
    width: out.width,
    height: out.height,
    untouched: false,
  };
}
