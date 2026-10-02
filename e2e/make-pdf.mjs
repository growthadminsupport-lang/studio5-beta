// A one-page "radiology report" PDF with a real X-ray in it, for the PDF upload test.
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
const b64 = readFileSync(new URL('./fixtures/x3.jpg', import.meta.url)).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<html><body style="font-family:sans-serif;margin:40px">
<h2>Radiology report — Hand AP (left)</h2><p>Patient: TEST CHILD · HN 77001 · Exam date 2026-09-30</p>
<p>Findings: see image. This page is a test document for the GrowTH upload flow.</p>
<div style="text-align:center;margin-top:24px"><img src="data:image/jpeg;base64,${b64}" style="width:62%"></div>
<p style="margin-top:24px">Reported by: Dr Test · Signature ____________</p></body></html>`);
await page.pdf({ path: new URL('./fixtures/report.pdf', import.meta.url).pathname, format: 'A4', printBackground: true });
await browser.close();
console.log('ok');
