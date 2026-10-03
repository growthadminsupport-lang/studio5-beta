// Seeds one realistic family through the API, then captures the screens the user manual shows.
import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
const APP = process.env.E2E_APP ?? 'http://localhost:5199', API = process.env.E2E_API ?? 'http://localhost:3901';
const OUT = new URL('../docs/manual/img', import.meta.url).pathname;
const J = { 'Content-Type': 'application/json' };
const api = async (path, { token, method = 'POST', body } = {}) => {
  const r = await fetch(API + path, { method, headers: { ...J, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${t.slice(0, 200)}`);
  return d;
};
const stamp = Date.now();
const email = `somsri${stamp}@e2e.test`;
const reg = await api('/auth/register', { body: { email, password: 'Test1234!', fullName: 'Somsri Wongsa', phoneNumber: '0812345678', acceptedTerms: true } });
const P = reg.accessToken;
const { token } = await api('/auth/resend-verification', { token: P });
await api('/auth/verify-email', { body: { token } });
const child = await api('/children', { token: P, body: { fullName: 'Ploy Wongsa', nickname: 'Ploy', sex: 'FEMALE', dateOfBirth: '2017-05-10', relation: 'PARENT', avatar: { skin: 'tan', youngHair: 3, babyHair: 2, hairColor: '#3b2416', babyOutfit: 1 } } });
for (const [d, h, w] of [['2019-05-12', 86.5, 12.1], ['2021-05-15', 103, 16.2], ['2023-05-20', 118, 21.4], ['2025-05-18', 130.5, 27.3], ['2026-09-20', 137, 31.5]]) {
  await api('/growth', { token: P, body: { childId: child.id, measuredAt: d, heightCm: h, weightKg: w } });
}
const inv = await api(`/children/${child.id}/invites`, { token: P, body: { role: 'DOCTOR' } });
const D = (await api('/auth/login', { body: { email: 'doctor@demo.growth', password: 'Demo1234!' } })).accessToken;
await api(`/invites/${inv.link.split('/invite/')[1]}/accept`, { token: D });
const form = new FormData();
form.append('childId', child.id); form.append('examDate', '2026-09-25');
form.append('file', new Blob([readFileSync(process.env.MANUAL_XRAY ?? new URL('./fixtures/x3.jpg', import.meta.url))], { type: 'image/jpeg' }), 'hand.jpg');
const up = await (await fetch(`${API}/bone-age/upload`, { method: 'POST', headers: { Authorization: `Bearer ${D}` }, body: form })).json();
for (let i = 0; i < 60; i++) { const r = await api(`/bone-age/${up.id}`, { token: D, method: 'GET' }); if (r.status !== 'PENDING') break; await new Promise((r) => setTimeout(r, 1000)); }
await api(`/bone-age/${up.id}`, { token: D, method: 'PATCH', body: { review: 'NORMAL', doctorNote: 'Bone age matches Ploy’s age. No follow-up needed; we will check again next year.' } });

const browser = await chromium.launch();
async function page(viewport = { width: 1280, height: 860 }, scheme = 'light') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5, colorScheme: scheme });
  return ctx.newPage();
}
async function signIn(p, e, pw) {
  await p.goto(`${APP}/login`); await p.getByPlaceholder('Email').fill(e); await p.getByPlaceholder('Password').fill(pw);
  await p.getByRole('button', { name: 'Log In' }).click(); await p.waitForURL('**/dashboard'); await p.waitForTimeout(1200);
}
const shot = (p, name, opts = {}) => p.screenshot({ path: `${OUT}/${name}.png`, ...opts });

const anon = await page();
await anon.goto(`${APP}/register`); await anon.waitForTimeout(800); await shot(anon, '01-register');
await anon.goto(`${APP}/login`); await anon.waitForTimeout(800); await shot(anon, '02-login');

const p = await page();
await signIn(p, email, 'Test1234!');
await shot(p, '03-dashboard');
await p.getByRole('button', { name: 'Edit child profile' }).click();
await p.getByRole('dialog').waitFor(); await p.waitForTimeout(600);
await p.getByRole('dialog').screenshot({ path: `${OUT}/04-edit-child.png` });
await p.getByRole('dialog').getByRole('tab', { name: 'Hair' }).click(); await p.waitForTimeout(500);
await p.getByRole('dialog').screenshot({ path: `${OUT}/05-avatar-hair.png` });
await p.getByRole('dialog').getByRole('button', { name: /Baby, 0–3/ }).click();
await p.getByRole('dialog').getByRole('tab', { name: 'Face' }).click(); await p.waitForTimeout(500);
// Tall enough for the whole editor, which is taller than the default window.
await p.setViewportSize({ width: 1280, height: 1500 }); await p.waitForTimeout(400);
await p.getByRole('dialog').locator('.rounded-2xl').first().screenshot({ path: `${OUT}/05b-avatar-face.png` });
await p.setViewportSize({ width: 1280, height: 860 });
await p.keyboard.press('Escape'); await p.waitForTimeout(400);

await p.goto(`${APP}/growth`); await p.waitForTimeout(1800);
await p.locator('.growth-own-dot').nth(4).hover(); await p.waitForTimeout(400);
await p.locator('.mb-6.rounded-2xl').filter({ hasText: 'Height' }).first().screenshot({ path: `${OUT}/06-growth-chart.png` });
await p.getByPlaceholder('Height (cm)').first().fill('137.5'); await p.getByPlaceholder('Weight (kg)').first().fill('31.8');
await p.getByRole('button', { name: 'Add measurement' }).click(); await p.waitForTimeout(1500);
await shot(p, '07-growth-entry');

await p.goto(`${APP}/puberty`); await p.waitForTimeout(800); await shot(p, '08-puberty-start');
await p.getByRole('button', { name: 'Start screening' }).click(); await p.waitForTimeout(500); await shot(p, '09-puberty-questions');
await p.getByRole('button', { name: 'See result' }).click(); await p.getByText(/Screening result/).waitFor(); await p.waitForTimeout(600);
await shot(p, '10-puberty-result');

await p.goto(`${APP}/dashboard`); await p.waitForTimeout(1000);
await p.getByRole('button', { name: 'People who can see this child' }).click(); await p.getByRole('dialog').waitFor(); await p.waitForTimeout(800);
await p.getByRole('dialog').screenshot({ path: `${OUT}/11-people.png` });
await p.getByRole('dialog').getByRole('button', { name: 'Invite' }).click(); await p.waitForTimeout(400);
await p.getByLabel('Email (optional)').fill('nanny.example@gmail.com');
await p.locator('.MuiDialog-paper').last().screenshot({ path: `${OUT}/12-invite-form.png` });
await p.getByRole('button', { name: 'Create invitation' }).click(); await p.waitForSelector('svg[height="200"]'); await p.waitForTimeout(400);
await p.locator('.MuiDialog-paper').last().screenshot({ path: `${OUT}/13-invite-qr.png` });
await p.getByRole('button', { name: 'Done' }).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(400);

await p.goto(`${APP}/bone-age`); await p.waitForTimeout(1200); await shot(p, '14-bone-age-family');
await p.goto(`${APP}/notifications`); await p.waitForTimeout(1200); await shot(p, '15-notifications');
await p.goto(`${APP}/settings`); await p.waitForTimeout(800); await shot(p, '16-settings');

const doc = await page();
await signIn(doc, 'doctor@demo.growth', 'Demo1234!');
await doc.getByRole('button', { name: 'Switch child' }).click(); await doc.getByRole('button', { name: /Ploy Wongsa/ }).last().click(); await doc.waitForTimeout(500);
await doc.goto(`${APP}/bone-age`); await doc.waitForTimeout(1500); await shot(doc, '17-bone-age-doctor');

const m = await page({ width: 390, height: 844 }, 'dark');
await signIn(m, email, 'Test1234!'); await shot(m, '18-mobile-dashboard');
await browser.close();
console.log('done', email);
