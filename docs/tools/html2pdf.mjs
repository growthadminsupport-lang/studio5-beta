import { chromium } from 'playwright-core';
const [, , html, pdf, title] = process.argv;
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + html); await p.waitForLoadState('networkidle');
await p.pdf({ path: pdf, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#64748b">${title} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
await b.close();
