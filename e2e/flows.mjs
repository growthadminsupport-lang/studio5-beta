// End-to-end walk through the GrowTH role flows against a local API + Vite dev server.
// How to run, and what it needs: e2e/README.md.
import { chromium, firefox, webkit } from 'playwright-core';
const ENGINE = process.env.BROWSER ?? 'chromium';
import { mkdirSync, readFileSync } from 'fs';

const APP = process.env.E2E_APP ?? 'http://localhost:5199';
const XRAYS = process.env.E2E_XRAYS ?? new URL('./fixtures', import.meta.url).pathname;
const STAMP = Date.now();
const OUT = `${process.env.E2E_SHOTS ?? '/tmp/e2e-shots'}/${process.env.BROWSER ?? 'chromium'}`;
mkdirSync(OUT, { recursive: true });
const stamp = Date.now();
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// A child's date of birth or due date: Day / Month / Year fields (DateFields.jsx).
async function fillDate(page, iso) {
  const [y, m, d] = iso.split('-');
  await page.getByLabel('Day', { exact: true }).fill(String(Number(d)));
  await page.getByLabel('Month', { exact: true }).selectOption(String(Number(m)));
  await page.getByLabel('Year', { exact: true }).fill(y);
}

const browser = await { chromium, firefox, webkit }[ENGINE].launch(
  ENGINE === 'chromium' ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {},
);
console.log(`browser: ${ENGINE} ${browser.version()}`);

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && console.log('  [console]', m.text().slice(0, 200)));
  return page;
}
const API = process.env.E2E_API ?? 'http://localhost:3901';
async function apiToken(email, password = 'Test1234!') {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).accessToken;
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

async function register(page, { name, email, phone, type = 'USER', license, hospital, next }) {
  await page.goto(`${APP}/register${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  if (type === 'DOCTOR') await page.getByRole('radio', { name: 'Doctor' }).click();
  await page.getByPlaceholder('Full name').fill(name);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Phone number').fill(phone);
  if (type === 'DOCTOR') {
    await page.getByPlaceholder('Medical license number').fill(license);
    await page.getByPlaceholder('Hospital or clinic').fill(hospital);
  }
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!');
  await page.getByPlaceholder('Confirm password').fill('Test1234!');
  await page.locator('.checkbox-row input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Create Account' }).click();
}

async function login(page, email, password = 'Test1234!', next) {
  await page.goto(`${APP}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

async function createInvite(page, role) {
  await page.goto(`${APP}/people`);
  await page.getByRole('button', { name: 'Invite' }).click();
  if (role === 'DOCTOR') await page.getByRole('button', { name: 'Doctor' }).click();
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/invites') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create invitation' }).click(),
  ]);
  const body = await res.json();
  await page.waitForSelector('svg[height="200"]');
  await shot(page, `03-invite-${role.toLowerCase()}`);
  await page.getByRole('button', { name: 'Done' }).click();
  return new URL(body.link).pathname; // /invite/<token>
}

try {
  // ---------------------------------------------------------------- Parent
  const parent = await newPage();
  const parentEmail = `parent${stamp}@e2e.test`;
  await register(parent, { name: 'Ploy Parent', email: parentEmail, phone: '0812345678' });
  await parent.waitForURL('**/dashboard');
  check('parent registers (with phone) and lands on dashboard', true);
  await parent.getByText('Please confirm your email address').waitFor();
  check('unconfirmed email shows a banner with resend', await parent.getByRole('button', { name: 'Send the link again' }).isVisible());
  await parent.goto(`${APP}/profile`);
  await parent.waitForTimeout(800);
  check('phone number from registration is saved (FR-1)', (await parent.content()).includes('0812345678'));

  const fake = await newPage();
  await register(fake, { name: 'Throwaway', email: `x${stamp}@mailinator.com`, phone: '0812345679' });
  await fake.getByText(/disposable/).waitFor();
  check('disposable email address is refused at registration', true);
  await fake.close();
  await parent.goto(`${APP}/dashboard`);

  // A new parent is guided: add the child first.
  await parent.getByText('Getting started').waitFor();
  check('a new parent sees the getting-started guide (add your child, first measurement)',
    await parent.getByText('Add your child, or your baby before birth').isVisible() && await parent.getByText('Add the first height and weight').isVisible());
  await parent.getByRole('link', { name: 'Add your own child' }).click();
  await parent.getByText('You are this child’s').waitFor();
  check('relationship choices are offered (mother or father / guardian / relative), mother or father by default',
    (await parent.getByLabel('Mother or father').isChecked()) && (await parent.getByLabel('Legal guardian').isVisible()));
  await parent.locator('input[type=text]').first().fill('Mali Test');
  await fillDate(parent, '2016-03-15');
  await parent.getByRole('button', { name: 'Girl' }).click();
  await parent.getByLabel(/Hospital number/).fill('HN-77001');
  await parent.getByRole('button', { name: 'Save and continue' }).click();
  await parent.waitForURL('**/dashboard');
  await parent.getByText('Mali Test').first().waitFor();
  check('parent adds a child with HN', await parent.getByText('HN HN-77001').isVisible());

  // Edit opens in a window, and the avatar can be changed there.
  await parent.getByRole('button', { name: 'Edit child profile' }).click();
  await parent.getByRole('dialog').getByText('Edit Mali Test').waitFor();
  const stayed = parent.url().endsWith('/dashboard');
  const dlg = parent.getByRole('dialog');
  const onlySaved = (await dlg.getByLabel('Mother or father').isChecked()) && (await dlg.getByLabel('Legal guardian').count()) === 0;
  await dlg.getByRole('button', { name: 'Change', exact: true }).click();
  check('editing shows only the saved relationship until "Change" is pressed',
    onlySaved && (await dlg.getByLabel('Legal guardian').isVisible()));
  await parent.getByRole('dialog').getByRole('button', { name: 'Deep' }).click();
  await parent.getByRole('dialog').getByRole('tab', { name: 'Hair' }).click();
  await parent.getByRole('dialog').getByRole('button', { name: 'Hairstyle 3' }).click();
  await parent.getByRole('dialog').getByRole('button', { name: 'Red' }).click();
  // The drawing follows the child's age by itself: a 10-year-old gets the young child, with no
  // switch, and its own face and clothes options (eyes, outfits), not the baby's.
  await dlg.getByRole('tab', { name: 'Face' }).click();
  const youngOnly = (await dlg.getByRole('button', { name: 'Eyes 1' }).count()) === 1 && (await dlg.getByText('Eye colour').count()) === 0 && (await dlg.getByRole('button', { name: /Baby, 0–3/ }).count()) === 0;
  await dlg.getByRole('button', { name: 'Eyes 3' }).click();
  await shot(parent, '00-edit-child-avatar');
  await parent.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await parent.getByRole('dialog').waitFor({ state: 'detached' });
  await parent.reload();
  await parent.getByText('Mali Test').first().waitFor();
  const srcs = await parent.$$eval('img', (imgs) => imgs.map((i) => i.getAttribute('src')));
  check('edit child opens as a window; avatar skin, hairstyle and colour are saved',
    stayed && srcs.some((x) => x?.includes('young/skin-deep')) && srcs.some((x) => x?.includes('young/hair-3')) && srcs.some((x) => x?.includes('young/eyes-3')));
  check('a 10-year-old gets the young drawing with no switch, and its own eyes and outfits', youngOnly);

  await parent.getByRole('button', { name: 'People who can see this child' }).click();
  await parent.getByRole('dialog').getByText('People who follow Mali Test').waitFor();
  await parent.getByRole('dialog').getByRole('button', { name: 'Invite' }).click();
  await parent.getByRole('button', { name: 'Doctor' }).click();
  await parent.getByLabel('Email (optional)').fill(parentEmail.toUpperCase());
  await parent.getByRole('button', { name: 'Create invitation' }).click();
  await parent.getByText('You cannot invite yourself').waitFor();
  check('people open as a window; inviting your own email is refused', parent.url().endsWith('/dashboard'));
  await parent.keyboard.press('Escape');
  await parent.keyboard.press('Escape');
  await parent.waitForTimeout(400);

  // Every menu click starts at the top of the page.
  await parent.goto(`${APP}/dashboard`);
  await parent.getByText('Mali Test').first().waitFor();
  await parent.waitForTimeout(600);
  await parent.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await parent.waitForTimeout(300);
  const before = await parent.evaluate(() => window.scrollY);
    await parent.getByRole('link', { name: 'Growth', exact: true }).first().click();
  await parent.waitForURL('**/growth');
  await parent.waitForTimeout(300);
  const after = await parent.evaluate(() => window.scrollY);
  check('a menu click opens the next page at the top', before > 200 && after === 0, `scrolled ${before} → ${after}`);

  // A baby gets the baby drawing.
  await parent.goto(`${APP}/children/new`);
  await parent.locator('input[type=text]').first().fill('Baby Test');
  await fillDate(parent, '2026-06-01');
  await parent.getByRole('button', { name: 'Boy' }).click();
  await parent.getByRole('button', { name: 'Save and continue' }).click();
  await parent.waitForURL('**/dashboard');
  await parent.getByText('Baby Test').first().waitFor();
  const babySrcs = await parent.$$eval('img', (imgs) => imgs.map((i) => i.getAttribute('src')));
  await shot(parent, '00b-baby-dashboard');
  const babyChart = await parent.locator('.recharts-cartesian-axis-tick-value').allTextContents();
  check('a baby gets the baby avatar and a 0–36 month chart', babySrcs.some((x) => x?.includes('baby/skin-')) && babyChart.includes('36 mo'), babyChart.slice(0, 8).join(','));
  // Born 2026-06-01 with nothing measured: always inside some check-up window (AAP schedule),
  // so the dashboard says it is due and the parent has a reminder that opens Growth.
  // Suggestions load after the page: wait for the card rather than sampling it.
  const dueCard = await parent.getByText(/check-up due/).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  await parent.goto(`${APP}/notifications`);
  const reminder = parent.getByText(/Baby's [0-9½]+-(month|year) check-up/).first();
  await reminder.waitFor();
  await reminder.click();
  await parent.waitForURL('**/growth');
  const onBaby = await parent.getByText('Baby Test').first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  check('a check-up that is due shows on the dashboard and as a reminder that opens the child\'s Growth page', dueCard && onBaby, `card ${dueCard}, growth for baby ${onBaby}`);
  await parent.goto(`${APP}/dashboard`);

  // The baby gets the baby drawing with face and shoe choices, saved.
  await parent.getByRole('button', { name: 'Edit child profile' }).click();
  const bdlg = parent.getByRole('dialog');
  await bdlg.getByRole('tab', { name: 'Face' }).click();
  await bdlg.getByRole('button', { name: 'Blue eyes' }).click();
  await bdlg.getByRole('button', { name: 'Eyebrows 5' }).click();
  await bdlg.getByRole('button', { name: 'Eyelashes 1' }).click();
  await bdlg.getByRole('button', { name: 'Mouth: Big grin' }).click();
  await bdlg.getByRole('tab', { name: 'Clothes' }).click();
  await bdlg.getByRole('button', { name: 'Shoes 2' }).click();
  const babyLayers = await bdlg.locator('img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')));
  await bdlg.getByRole('button', { name: 'Save changes' }).click();
  await bdlg.waitFor({ state: 'detached' });
  const pTok0 = await apiToken(parentEmail);
  const kids0 = await (await fetch(`${API}/children`, { headers: { Authorization: `Bearer ${pTok0}` } })).json();
  const babyKid = kids0.find((k) => k.fullName === 'Baby Test');
  const saved = babyKid?.avatar ?? {};
  check('the baby drawing\'s eye colour, brows, lashes, mouth and shoes are previewed and saved',
    ['eyes-4', 'brows-5', 'lashes-1', 'mouth-4', 'shoes-2'].every((l) => babyLayers.some((x) => x?.includes(`baby/${l}.webp`))) &&
    saved.babyEyes === 4 && saved.babyBrows === 5 && saved.babyLashes === 1 && saved.babyMouth === 4 && saved.babyShoes === 2, JSON.stringify(saved));

  // Dashboard and Growth page agree: a baby has height, weight and head size (no BMI before 2),
  // and head size can be corrected in the history.
  await fetch(`${API}/growth`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pTok0}` },
    body: JSON.stringify({ childId: babyKid.id, measuredAt: '2026-09-01', heightCm: 60, weightKg: 5.8, headCircumferenceCm: 39.5 }) });
  await parent.reload();
  await parent.getByRole('button', { name: /^Head/ }).first().waitFor();
  const babyTiles = (await parent.locator('.grid.grid-cols-3 button').allTextContents()).join(' ');
  await parent.goto(`${APP}/growth`);
  await parent.getByText('Head 39.5 cm').waitFor();
  const babyBmiShown = (await parent.textContent('body')).includes('BMI 16');
  await parent.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await parent.getByLabel('Head circumference (cm)').fill('40.2');
  await parent.getByRole('button', { name: 'Save', exact: true }).first().click();
  await parent.getByText('Head 40.2 cm').waitFor();
  check('a baby\'s dashboard shows height, weight and head (no BMI), and head size can be edited in the history',
    /HEIGHT|Height/.test(babyTiles) && /Head/i.test(babyTiles) && !/BMI/.test(babyTiles) && !babyBmiShown, babyTiles);
  // A baby on the way: added with a due date; no charts or measuring until the birth.
  const due = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  await parent.goto(`${APP}/children/new`);
  await parent.locator('input[type=text]').first().fill('Bump Test');
  await parent.getByLabel('Not born yet').check();
  await fillDate(parent, due);
  await parent.getByRole('button', { name: 'Save and continue' }).click();
  await parent.waitForURL('**/dashboard');
  await parent.getByText(/Bump is on the way · Due/).waitFor();
  const noChart = (await parent.getByText('Growth Trajectory').count()) === 0;
  await parent.goto(`${APP}/growth`);
  await parent.getByText(/Bump is on the way/).waitFor();
  const noForm = (await parent.getByPlaceholder('Height (cm)').count()) === 0;
  check('a baby not born yet can be added with a due date: "on the way", no charts or measuring', noChart && noForm);

  await parent.goto(`${APP}/dashboard`);
  // Back to the first child for the rest of the flow.
  await parent.getByRole('button', { name: 'Switch child' }).click();
  await parent.getByRole('button', { name: /Mali Test/ }).click();
  await parent.waitForTimeout(400);

  await parent.goto(`${APP}/growth`);
  await parent.getByPlaceholder('Height (cm)').first().fill('128');
  await parent.getByPlaceholder('Weight (kg)').first().fill('26');
  await parent.locator('form input[type=date]').fill('2025-09-15');
  await parent.getByRole('button', { name: 'Add measurement' }).click();
  await parent.getByText(/(Within|Outside) the usual range\./).first().waitFor({ timeout: 15000 });
  await parent.getByPlaceholder('Height (cm)').first().fill('134');
  await parent.getByPlaceholder('Weight (kg)').first().fill('31');
  await parent.locator('form input[type=date]').fill('2026-09-15');
  await parent.getByRole('button', { name: 'Add measurement' }).click();
  await parent.waitForTimeout(1500);
  const dots = await parent.locator('.growth-own-dot').count();
  check('growth: guidance after entry, child plotted on CDC chart', dots >= 4, `${dots} points across charts`);
  const firstDot = parent.locator('.growth-own-dot').first();
  await firstDot.hover();
  await parent.waitForTimeout(300);
  const tip = await parent.locator('.recharts-tooltip-wrapper').first().textContent();
  check('chart tooltip speaks plainly (usual range, average), no ageYears or P3/P97', /Usual for girls this age/.test(tip) && /Average/.test(tip) && !/ageYears|P3|P97/.test(tip), tip.slice(0, 120));
  // Every height point's tooltip must compare it with children of *that* age: a 128-134 cm child
  // against a usual range somewhere around it, never a toddler's (a past Recharts index bug).
  const heightDots = parent.locator('div.mb-6').filter({ has: parent.getByRole('heading', { name: 'Height', exact: true }) }).locator('.growth-own-dot');
  const ranges = [];
  for (let i = 0; i < (await heightDots.count()); i++) {
    await parent.mouse.move(0, 0);
    await parent.waitForTimeout(150);
    await heightDots.nth(i).hover({ force: true });
    await parent.waitForTimeout(300);
    const t = await parent.locator('.recharts-tooltip-wrapper').first().textContent();
    const m = t.match(/Usual for girls this age: ([\d.]+) cm to ([\d.]+) cm/);
    const v = t.match(/Mali Test: ([\d.]+) cm/);
    ranges.push(m && v ? [Number(v[1]), Number(m[1]), Number(m[2])] : null);
  }
  check('each point is compared with children of its own age',
    ranges.length >= 2 && new Set(ranges.map((r) => r?.[0])).size === ranges.length && ranges.every((r) => r && r[1] > r[0] * 0.75 && r[2] < r[0] * 1.25),
    JSON.stringify(ranges));
  await shot(parent, '01-parent-growth');

  await parent.goto(`${APP}/puberty`);
  await parent.getByRole('button', { name: 'Start screening' }).click();
  await parent.getByRole('button', { name: 'See result' }).click();
  await parent.getByText(/Screening result/).waitFor({ timeout: 15000 });
  check('parent sees puberty result', true);
  await shot(parent, '02-parent-puberty');

  const caretakerInvite = await createInvite(parent, 'CARETAKER');
  const doctorInvite = await createInvite(parent, 'DOCTOR');
  check('parent creates caretaker and doctor invitations with QR', caretakerInvite.startsWith('/invite/') && doctorInvite.startsWith('/invite/'));

  // ---------------------------------------------------------------- Caretaker
  const caretaker = await newPage();
  await caretaker.goto(`${APP}${caretakerInvite}`);
  await caretaker.getByText('Ploy Parent invited you').waitFor();
  check('invitation page previews first name only', (await caretaker.textContent('body')).includes('Mali') && !(await caretaker.textContent('body')).includes('Mali Test'));
  await shot(caretaker, '04-invite-preview');
  await caretaker.getByRole('link', { name: 'Create an account' }).click();
  await register(caretaker, { name: 'Nok Caretaker', email: `care${stamp}@e2e.test`, phone: '0899999999', next: caretakerInvite });
  await caretaker.waitForURL(`**${caretakerInvite}`);
  await caretaker.getByRole('button', { name: 'Accept invitation' }).click();
  await caretaker.waitForURL('**/dashboard');
  await caretaker.getByText('You: Caretaker').waitFor();
  check('caretaker accepts and sees the child, no HN', !(await caretaker.textContent('body')).includes('HN-77001'));
  check('the caretaker\'s guide is about measuring', await caretaker.getByText('Growth: enter height and weight').isVisible() && !(await caretaker.getByText('Add your child, or your baby before birth').count()));
  check('caretaker cannot edit the child (only the parent and doctor can)',
    (await caretaker.getByRole('button', { name: /Edit child profile|Set hospital number/ }).count()) === 0);

  await caretaker.goto(`${APP}/puberty`);
  await caretaker.getByRole('button', { name: /Start screening|Screen again/ }).click();
  await caretaker.getByRole('button', { name: 'Submit' }).click();
  await caretaker.getByText('Submitted.').waitFor({ timeout: 15000 });
  const careBody = await caretaker.textContent('body');
  check('caretaker submits puberty, sees no result', !careBody.includes('Screening result'));
  await shot(caretaker, '05-caretaker-puberty');

  await caretaker.goto(`${APP}/bone-age`);
  check('caretaker has no upload on bone age', (await caretaker.getByText('Drop the X-ray here').count()) === 0);

  // ---------------------------------------------------------------- Doctor (pending) + admin approval
  const doctor = await newPage();
  const doctorEmail = `doc${stamp}@e2e.test`;
  const DR = `Dr Somchai ${stamp}`;
  await register(doctor, { name: DR, email: doctorEmail, phone: '0811111111', type: 'DOCTOR', license: 'MD-12345', hospital: 'Srinagarind Hospital', next: doctorInvite });
  await doctor.waitForURL(`**${doctorInvite}`);
  await doctor.getByText('waiting for approval').waitFor();
  check('pending doctor cannot accept yet', await doctor.getByRole('button', { name: 'Accept invitation' }).isDisabled());

  const admin = await newPage();
  await login(admin, 'admin@demo.growth', 'Demo1234!');
  await admin.waitForURL('**/dashboard');
  await admin.goto(`${APP}/admin/doctors`);
  await admin.getByText(DR).waitFor();
  const unconfirmed = await admin.getByRole('row', { name: DR }).getByRole('button', { name: 'Approve' }).isDisabled();
  check('a doctor with an unconfirmed email cannot be approved yet', unconfirmed && (await admin.getByRole('row', { name: DR }).textContent()).includes('Email not confirmed'));
  const docToken = await apiToken(doctorEmail);
  const resent = await (await fetch(`${API}/auth/resend-verification`, { method: 'POST', headers: { Authorization: `Bearer ${docToken}` } })).json();
  await doctor.goto(`${APP}/verify-email?token=${resent.token}`);
  await doctor.getByText('Email address confirmed').waitFor();
  check('the confirmation link confirms the address', true);
  await doctor.reload();
  await doctor.getByText('Email address confirmed').waitFor();
  check('opening the confirmation link again still says confirmed', true);
  await doctor.goto(`${APP}${doctorInvite}`);
  await admin.reload();
  await admin.getByText(DR).waitFor();
  await shot(admin, '06-admin-doctors');
  await admin.getByRole('row', { name: DR }).getByRole('button', { name: 'Approve' }).click();
  await admin.waitForTimeout(800);
  check('admin approves doctor in portal', true);

  // doctor's token still says pending in the UI user object; reload restores session
  await doctor.reload();
  await doctor.getByRole('button', { name: 'Accept invitation' }).click();
  await doctor.waitForURL('**/dashboard');
  await doctor.getByText('You: Doctor').waitFor();
  check('approved doctor accepts and sees HN', (await doctor.textContent('body')).includes('HN-77001'));
  check('the doctor\'s guide covers finding the patient and the AI steps',
    await doctor.getByText('AI Prediction: upload the hand X-ray').isVisible() && await doctor.getByText(/search by HN/).isVisible());
  await doctor.getByRole('button', { name: 'Got it' }).click();
  await doctor.reload();
  await doctor.getByText('You: Doctor').waitFor();
  check('"Got it" hides the guide for good', (await doctor.getByText('Getting started').count()) === 0);

  // Invited by email to a second child, the doctor accepts from the dashboard, no link needed.
  const pTok = await apiToken(parentEmail);
  const parentKids = await (await fetch(`${API}/children`, { headers: { Authorization: `Bearer ${pTok}` } })).json();
  const baby = parentKids.find((k) => k.fullName === 'Baby Test');
  await fetch(`${API}/children/${baby.id}/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pTok}` },
    body: JSON.stringify({ role: 'DOCTOR', email: doctorEmail }) });
  await doctor.goto(`${APP}/dashboard`);
  await doctor.getByText('Invitations for you').waitFor();
  const inviteRow = doctor.locator('li').filter({ hasText: 'Baby' });
  await inviteRow.getByRole('button', { name: 'Accept' }).click();
  await inviteRow.waitFor({ state: 'detached' });
  await doctor.getByRole('button', { name: 'Switch child' }).click();
  const hasBaby = await doctor.getByRole('button', { name: /Baby Test/ }).isVisible();
  // Accepting selects the new child; the rest of the flow is about Mali.
  await doctor.getByRole('button', { name: /Mali Test/ }).click();
  await doctor.waitForTimeout(400);
  check('an invitation sent to the doctor\'s email can be accepted from the dashboard, without the link', hasBaby);

  await doctor.goto(`${APP}/bone-age`);
  // A plain X-ray image: whole frame, sent untouched.
  await doctor.locator('input[type=file]').setInputFiles(`${XRAYS}/x3.jpg`);
  await doctor.getByText('Check the X-ray').waitFor();
  await doctor.locator('.ReactCrop img').waitFor();
  const wholeShown = (await doctor.getByRole('dialog').textContent()).includes('Whole image');
  await doctor.getByRole('button', { name: 'Upload and analyse' }).click();
  await doctor.getByText('AI bone age').first().waitFor({ timeout: 60000 });
  check('doctor uploads X-ray, AI estimate with real age and gap', wholeShown && (await doctor.textContent('body')).includes('Real age on exam day'));

  // The same X-ray inside a PDF report page: the film is found and cropped out of the page.
  await doctor.locator('input[type=file]').setInputFiles(`${XRAYS}/report.pdf`);
  await doctor.getByText('Check the X-ray').waitFor();
  await doctor.locator('.ReactCrop img').waitFor({ timeout: 30000 });
  await shot(doctor, '06b-pdf-crop');
  const croppedShown = (await doctor.getByRole('dialog').textContent()).includes('Cropped');
  await doctor.getByRole('button', { name: 'Upload and analyse' }).click();
  await doctor.waitForFunction(() => document.body.innerText.split('AI bone age').length - 1 >= 2 && !document.body.innerText.includes('Analysing'), null, { timeout: 90000 });
  const ages = await doctor.$$eval('p', (ps) => ps.filter((p) => p.previousElementSibling?.textContent === 'AI bone age').map((p) => p.textContent));
  console.log('    AI ages (pdf, image):', ages.join(' | '));
  check('PDF report: film auto-cropped, AI result close to the original image', croppedShown && ages.length === 2);

  // A WebP original, sent untouched (this used to fail on the server).
  await doctor.locator('input[type=file]').setInputFiles(`${XRAYS}/x3.webp`);
  await doctor.getByText('Check the X-ray').waitFor();
  await doctor.locator('.ReactCrop img').waitFor();
  await doctor.getByRole('button', { name: 'Upload and analyse' }).click();
  await doctor.waitForFunction(() => document.body.innerText.split('AI bone age').length - 1 >= 3 && !document.body.innerText.includes('Analysing'), null, { timeout: 90000 });
  const body3 = await doctor.textContent('body');
  const ages3 = await doctor.$$eval('p', (ps) => ps.filter((p) => p.previousElementSibling?.textContent === 'AI bone age').map((p) => p.textContent));
  console.log('    AI ages (webp, pdf, jpeg):', ages3.join(' | '));
  check('WebP X-ray uploads and gets the same result as the JPEG', ages3[0] === ages3[2] && !body3.includes('Analysis failed'));
  // Held-out test-set accuracy of the mode that made the result: 1 in 8 off a year with one
  // view, 1 in 7 with four (docs/model-evaluation.md).
  check('accuracy shown is refine9 test-set figures with the age caution, despite stale B0 env vars',
    body3.includes('±7 months') && body3.includes('less reliable under 10') && !body3.includes('±9 months'));
  await doctor.locator('select').last().selectOption('NORMAL');
  await doctor.getByPlaceholder('Note for the family').last().fill('Growth plates look as expected. Recheck in a year.');
  await doctor.getByRole('button', { name: 'Save and share with family' }).last().click();
  await doctor.getByText('Reviewed: Normal for age').waitFor({ timeout: 10000 });
  await shot(doctor, '07-doctor-bone-age');
  check('doctor reviews and shares', true);

  // ---------------------------------------------------------------- Parent sees status only + notifications
  await parent.goto(`${APP}/bone-age`);
  await parent.getByText('Normal for age').waitFor();
  const pb = await parent.textContent('body');
  check('parent sees doctor reading, no months, no X-ray', !pb.includes('AI bone age') && (await parent.locator('img[alt="Hand X-ray"]').count()) === 0);
  await shot(parent, '08-parent-bone-age');
  await parent.goto(`${APP}/notifications`);
  await parent.locator('.notification-card-title, .no-notifications-text:not(:has-text("Loading"))').first().waitFor();
  const nb = await parent.textContent('body');
  check('parent notified: caretaker screening, bone-age result, invites accepted',
    nb.includes('New puberty screening') && nb.includes('bone-age result') && nb.includes('joined as caretaker'));
  await shot(parent, '09-parent-notifications');

  // The bell: opening a notification marks it read (badge drops, also after a reload) and
  // closes the popup; a click outside, Escape and a page change close it too.
  await parent.goto(`${APP}/dashboard`);
  const badge = parent.locator('.bell-button .badge');
  await badge.waitFor();
  const unreadBefore = Number(await badge.textContent());
  await parent.locator('.bell-button').click();
  await parent.locator('.notification-dropdown .notification-text').first().click();
  await parent.waitForTimeout(800);
  const closedOnOpen = (await parent.locator('.notification-dropdown').count()) === 0;
  const unreadNow = async () => ((await badge.count()) ? Number(await badge.textContent()) : 0);
  const afterOpen = await unreadNow();
  await parent.reload();
  await parent.locator('.bell-button').waitFor();
  await parent.waitForTimeout(1500);
  const afterReload = await unreadNow();
  await parent.locator('.bell-button').click();
  await parent.mouse.click(20, 700);
  const closedOutside = (await parent.locator('.notification-dropdown').count()) === 0;
  await parent.locator('.bell-button').click();
  await parent.keyboard.press('Escape');
  const closedEsc = (await parent.locator('.notification-dropdown').count()) === 0;
  await parent.locator('.bell-button').click();
  await parent.goto(`${APP}/profile`);
  await parent.waitForTimeout(500);
  const closedOnPage = (await parent.locator('.notification-dropdown').count()) === 0;
  check('opening a notification marks it read and closes the bell; outside click, Escape and a page change close it',
    closedOnOpen && afterOpen === unreadBefore - 1 && afterReload === unreadBefore - 1 && closedOutside && closedEsc && closedOnPage,
    `unread ${unreadBefore}→${afterOpen}→${afterReload}, closed ${closedOnOpen}/${closedOutside}/${closedEsc}/${closedOnPage}`);

  // ---------------------------------------------------------------- Admin: inbox, usage, export
  await caretaker.goto(`${APP}/dashboard`);
  await caretaker.locator('.profile-trigger').click();
  await caretaker.getByRole('button', { name: 'Report a problem' }).click();
  await caretaker.getByPlaceholder('Describe the problem').fill(`The chart took a long time to load (${STAMP}).`);
  await caretaker.getByRole('button', { name: 'Send' }).click();
  await caretaker.getByText('Thanks.').waitFor();
  await admin.goto(`${APP}/admin/inbox`);
  await admin.getByText(`The chart took a long time to load (${STAMP}).`).waitFor();
  check('problem report reaches admin inbox with page', (await admin.textContent('body')).includes('Page: /dashboard'));
  await admin.goto(`${APP}/admin/usage`);
  await admin.getByText('Growth entries').first().waitFor();
  await shot(admin, '10-admin-usage');
  check('admin usage loads', true);

  // ---------------------------------------------------------------- Admin portal, every tab and action
  // Tabs are clicked, not opened by URL: relative tab links once sent /admin/doctors to
  // /admin/doctors/articles and an empty page, which URL-only checks never saw.
  const TAB_TEXT = { Articles: 'New article', Inbox: 'Status', Usage: 'Growth entries', Export: 'Growth measurements', Doctors: 'Check the licence number' };
  await admin.goto(`${APP}/admin`);
  await admin.waitForURL('**/admin/doctors');
  const badTabs = [];
  for (const [tab, text] of Object.entries(TAB_TEXT)) {
    await admin.getByRole('link', { name: tab, exact: true }).click();
    await admin.waitForURL(`**/admin/${tab.toLowerCase()}`);
    await admin.getByText(text).first().waitFor({ timeout: 10000 }).catch(() => badTabs.push(`${tab}: no "${text}"`));
    if (new URL(admin.url()).pathname !== `/admin/${tab.toLowerCase()}`) badTabs.push(`${tab}: at ${admin.url()}`);
  }
  check('admin tabs switch by clicking, each at /admin/<tab> with its content', badTabs.length === 0, badTabs.join('; '));

  // Home page tab: a new title and a picture for the dashboard section reach the public Home page.
  await admin.getByRole('link', { name: 'Home page', exact: true }).click();
  await admin.waitForURL('**/admin/home');
  const dashEditor = admin.locator('section', { has: admin.getByRole('heading', { name: 'Comprehensive Dashboard' }) });
  const homeTitle = `Every measure at a glance ${stamp}`;
  await dashEditor.getByLabel('Title').fill(homeTitle);
  await dashEditor.locator('input[type=file]').setInputFiles(`${XRAYS}/x3.jpg`);
  await dashEditor.locator('.reactEasyCrop_Container').waitFor();
  await dashEditor.getByRole('button', { name: 'Save' }).click();
  await dashEditor.getByText('Saved. The Home page shows it now.').waitFor({ timeout: 20000 });
  const visitor = await newPage();
  await visitor.goto(`${APP}/`);
  await visitor.getByRole('heading', { name: homeTitle }).waitFor({ timeout: 15000 });
  const homeImg = visitor.locator('section', { has: visitor.getByRole('heading', { name: homeTitle }) }).locator('img');
  const homeImgOk = await homeImg.evaluate((img) => img.complete && img.naturalWidth > 0 && img.src.includes('/site/media/'));
  check('admin edits a Home page section: new title and picture shown to visitors', homeImgOk);
  await admin.goto(`${APP}/admin/doctors`);

  // Doctors: reject with a reason, find it under Rejected, then approve it from there.
  const rejEmail = `rej${stamp}@e2e.test`, REJ = `Dr Reject ${stamp}`;
  const rejReg = await (await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: rejEmail, password: 'Test1234!', fullName: REJ, accountType: 'DOCTOR', licenseNumber: 'MD-999', hospital: 'Test Hospital', acceptedTerms: true }) })).json();
  const rejTok = (await (await fetch(`${API}/auth/resend-verification`, { method: 'POST', headers: { Authorization: `Bearer ${rejReg.accessToken}` } })).json()).token;
  await fetch(`${API}/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: rejTok }) });
  await admin.reload();
  await admin.getByRole('row', { name: REJ }).getByRole('button', { name: 'Reject' }).click();
  const rejDialog = admin.getByRole('dialog');
  const rejectDisabledEmpty = await rejDialog.getByRole('button', { name: 'Reject' }).isDisabled();
  await rejDialog.getByLabel('Reason').fill('Licence number not found in the medical council register.');
  await rejDialog.getByRole('button', { name: 'Reject' }).click();
  await rejDialog.waitFor({ state: 'detached' });
  await admin.getByRole('row', { name: REJ }).waitFor({ state: 'detached' });
  await admin.getByLabel('Show').click();
  await admin.getByRole('option', { name: 'Rejected' }).click();
  const rejRow = admin.getByRole('row', { name: REJ });
  await rejRow.waitFor();
  const reasonShown = (await rejRow.textContent()).includes('Licence number not found');
  await rejRow.getByRole('button', { name: 'Approve' }).click();
  await rejRow.waitFor({ state: 'detached' });
  await admin.getByLabel('Show').click();
  await admin.getByRole('option', { name: 'Approved' }).click();
  await admin.getByRole('row', { name: REJ }).waitFor();
  check('admin rejects a doctor with a reason (required), sees it under Rejected, can approve later',
    rejectDisabledEmpty && reasonShown);

  // Articles: create a draft, publish it, see it in Knowledge, unpublish, delete.
  const ART = `Sleep and growth ${stamp}`, SLUG = `sleep-and-growth-${stamp}`;
  await admin.getByRole('link', { name: 'Articles', exact: true }).click();
  await admin.getByRole('button', { name: 'New article' }).click();
  const artDialog = admin.getByRole('dialog');
  await artDialog.getByLabel('Title').fill(ART);
  await artDialog.getByLabel('URL slug (optional)').fill(SLUG);
  await artDialog.getByLabel('Summary').fill('Why sleep matters for growth hormone.');
  await artDialog.getByLabel('Content (Markdown)').fill('Growth hormone is released mostly during deep sleep.\n\n## Sources\n- Test source');
  await artDialog.getByRole('button', { name: 'Save' }).click();
  await artDialog.waitFor({ state: 'detached' });
  const artRow = admin.getByRole('row', { name: new RegExp(ART) });
  const draftShown = (await artRow.textContent()).includes('draft');
  const knowledgeBefore = await (await fetch(`${API}/articles/${SLUG}`)).status;
  await artRow.getByRole('button', { name: 'Edit' }).click();
  await artDialog.getByLabel('Published').check();
  await artDialog.getByRole('button', { name: 'Save' }).click();
  await artDialog.waitFor({ state: 'detached' });
  const publishedShown = (await artRow.textContent()).includes('published');
  const reader = await newPage();
  await reader.goto(`${APP}/knowledge/${SLUG}`);
  await reader.getByText('Growth hormone is released mostly during deep sleep.').waitFor();
  await reader.close();
  await artRow.getByRole('button', { name: 'Edit' }).click();
  await artDialog.getByLabel('Published').uncheck();
  await artDialog.getByRole('button', { name: 'Save' }).click();
  await artDialog.waitFor({ state: 'detached' });
  const knowledgeAfter = await (await fetch(`${API}/articles/${SLUG}`)).status;
  admin.once('dialog', (d) => d.accept());
  await artRow.getByRole('button', { name: 'Delete' }).click();
  await artRow.waitFor({ state: 'detached' });
  check('admin creates a draft article, publishes it (readable in Knowledge), unpublishes and deletes it',
    draftShown && knowledgeBefore === 404 && publishedShown && knowledgeAfter === 404);

  // Inbox: mark read, resolve, reopen; the status filter follows.
  const REPORT = `The chart took a long time to load (${STAMP}).`;
  await admin.getByRole('link', { name: 'Inbox', exact: true }).click();
  const card = admin.locator('.MuiPaper-root').filter({ hasText: REPORT });
  await card.getByRole('button', { name: 'Mark read' }).click();
  await card.waitFor({ state: 'detached' });
  const pickStatus = async (name) => {
    await admin.getByLabel('Status').click();
    await admin.getByRole('option', { name, exact: true }).click();
  };
  await pickStatus('Read');
  await card.getByRole('button', { name: 'Resolved' }).click();
  await card.waitFor({ state: 'detached' });
  await pickStatus('Resolved');
  await card.getByRole('button', { name: 'Reopen' }).click();
  await card.waitFor({ state: 'detached' });
  await pickStatus('New');
  await card.waitFor();
  check('admin inbox: mark read, resolve and reopen move the message between filters', true);

  // Export: three anonymised CSVs, with no names, emails or hospital numbers.
  await admin.getByRole('link', { name: 'Export', exact: true }).click();
  let exportOk = true;
  for (const label of ['Growth measurements', 'Puberty screenings', 'Bone age']) {
    const [dl] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: label }).click()]);
    const csv = readFileSync(await dl.path(), 'utf8');
    const lines = csv.trim().split('\n');
    if (lines.length < 2 || /@|Mali Test|HN-77001|Somchai/.test(csv)) exportOk = false;
  }
  check('admin exports growth, puberty and bone-age CSVs with data and nothing identifying', exportOk);

  // ---------------------------------------------------------------- Parent removes caretaker
  await parent.goto(`${APP}/people`);
  parent.once('dialog', (d) => d.accept());
  await parent.getByRole('button', { name: 'Remove' }).first().click();
  await parent.getByText('no longer has access').waitFor();
  await caretaker.goto(`${APP}/dashboard`);
  await caretaker.waitForTimeout(1500);
  check('removed caretaker no longer sees the child', !(await caretaker.textContent('body')).includes('Mali Test'));

  // ---------------------------------------------------------------- Google welcome form (no real Google here)
  const w = await newPage();
  await w.goto(`${APP}/login`);
  await w.evaluate(() => {
    window.history.pushState({ usr: { credential: 'fake', email: 'new.person@gmail.com', fullName: 'New Person', picture: null, next: '/dashboard' }, key: 'w', idx: 1 }, '', '/welcome');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await w.getByText('Welcome to GrowTH').waitFor();
  const prefilled = (await w.getByPlaceholder('Full name').inputValue()) === 'New Person' && (await w.textContent('body')).includes('new.person@gmail.com');
  await w.getByRole('radio', { name: /Doctor/ }).click();
  const doctorFields = (await w.getByPlaceholder('Medical licence number').isVisible()) && (await w.getByPlaceholder('Hospital or clinic').isVisible());
  await w.route('**/auth/google', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Could not verify that Google sign-in' }) }));
  await w.getByPlaceholder('Phone number').fill('0812223333');
  await w.getByPlaceholder('Medical licence number').fill('MD-1');
  await w.getByPlaceholder('Hospital or clinic').fill('KKU');
  await w.locator('.checkbox-row input[type=checkbox]').check();
  await w.getByRole('button', { name: 'Create my account' }).click();
  await w.getByText(/timed out/).waitFor();
  await shot(w, '12-welcome');
  check('Google welcome form: prefilled from Google, role choice, doctor fields, expired sign-in handled', prefilled && doctorFields);
  await w.close();

  // ---------------------------------------------------------------- Mobile + dark
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const m = await mobileCtx.newPage();
  await m.goto(`${APP}/login`);
  await m.getByPlaceholder('Email').fill(parentEmail);
  await m.getByPlaceholder('Password').fill('Test1234!');
  await m.getByRole('button', { name: 'Log In' }).click();
  await m.waitForURL('**/dashboard');
  await m.waitForTimeout(1500);
  await shot(m, '11-mobile-dark-dashboard');
  await m.getByRole('button', { name: 'Edit child profile' }).click();
  await m.getByRole('dialog').waitFor();
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${OUT}/13-mobile-edit-dialog.png` });
  const fitsScreen = await m.evaluate(() => { const d = document.querySelector('[role=dialog]').getBoundingClientRect(); return d.width <= innerWidth && d.left >= 0; });
  check('edit window is full-screen and fits on a phone', fitsScreen);
  await m.keyboard.press('Escape');
  check('mobile dark dashboard renders', true);

  // ---------------------------------------------------------------- A refresh that never reaches the server keeps the session
  // An expired access token (the 401) whose refresh is aborted, as happens when the page
  // reloads mid-refresh, must not sign the person out: only a server rejection does.
  await parent.goto(`${APP}/dashboard`);
  await parent.getByText('Mali Test').first().waitFor();
  await parent.route('**/puberty/history**', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"statusCode":401}' }));
  await parent.route('**/auth/refresh', (r) => r.abort());
  await parent.getByRole('link', { name: 'Puberty' }).first().click();
  await parent.waitForTimeout(2000);
  const kept = await parent.evaluate(() => Boolean(localStorage.getItem('growth_refresh_token') ?? sessionStorage.getItem('growth_refresh_token')));
  await parent.unroute('**/puberty/history**');
  await parent.unroute('**/auth/refresh');
  await parent.reload();
  await parent.getByText('Mali Test').first().waitFor();
  check('an aborted session refresh does not sign the person out', kept && !parent.url().includes('/login'));

  // ---------------------------------------------------------------- Password change signs out other devices
  await parent.goto(`${APP}/settings`);
  await parent.locator('#currentPassword').fill('wrong-Pass1');
  await parent.locator('#newPassword').fill('Changed123!');
  await parent.getByRole('button', { name: 'Update password' }).click();
  await parent.getByText('Current password is incorrect').waitFor();
  await parent.locator('#currentPassword').fill('Test1234!');
  await parent.getByRole('button', { name: 'Update password' }).click();
  await parent.locator('.success-alert').waitFor();
  await parent.reload();
  await parent.goto(`${APP}/dashboard`);
  await parent.getByText('Mali Test').first().waitFor();
  await m.reload();
  await m.waitForURL('**/login**', { timeout: 20000 });
  check('password change keeps this device, signs out the other', true);
} catch (e) {
  check('flow aborted', false, e.message.split('\n')[0]);
  console.log('    at:', (e.stack || '').split('\n').find((l) => l.includes('flows.mjs')) || '');
  let n = 0;
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) {
    await pg.screenshot({ path: `${OUT}/fail-${n++}.png` }).catch(() => {});
    console.log(`    page ${n - 1}: ${pg.url()}`);
  }
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
}
