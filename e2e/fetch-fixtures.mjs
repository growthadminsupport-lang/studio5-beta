// Downloads the hand X-ray the browser test uploads, and makes its WebP copy. The image is
// Mikael Häggström's "X-ray of the hand of a 3 year old male - dorsoplantar" on Wikimedia
// Commons; it is fetched, not committed, so its licence stays with its source page.
import { mkdirSync, writeFileSync } from 'fs';
import sharp from 'sharp';

const TITLE = 'File:X-ray of the hand of a 3 year old male - dorsoplantar.jpg';
const UA = 'GrowTH-e2e/1.0 (growth.admin.support@gmail.com)';
const dir = new URL('./fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });

const api = new URL('https://commons.wikimedia.org/w/api.php');
api.search = new URLSearchParams({ action: 'query', titles: TITLE, prop: 'imageinfo', iiprop: 'url', format: 'json' });
const info = await (await fetch(api, { headers: { 'User-Agent': UA } })).json();
const url = Object.values(info.query.pages)[0].imageinfo[0].url;
const jpg = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
writeFileSync(new URL('x3.jpg', dir), jpg);
await sharp(jpg).webp({ lossless: true }).toFile(new URL('x3.webp', dir).pathname);
console.log('fixtures ready:', new URL('.', dir).pathname);
