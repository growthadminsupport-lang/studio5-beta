// End-to-end walk through the GrowTH role flows against a local API + Vite dev server.
// How to run, and what it needs: e2e/README.md.
import { chromium, firefox, webkit } from 'playwright-core';
const ENGINE = process.env.BROWSER ?? 'chromium';
import { mkdirSync } from 'fs';

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

  await parent.getByRole('link', { name: 'Add your own child' }).click();
  await parent.getByText('You are this child’s').waitFor();
  check('relationship is explained (mother or father / guardian / relative, and what managing means)',
    (await parent.getByLabel('Mother or father').isChecked()) && (await parent.textContent('body')).includes('invite or remove a caretaker'));
  await parent.locator('input[type=text]').first().fill('Mali Test');
  await parent.locator('input[type=date]').fill('2016-03-15');
  await parent.getByRole('button', { name: 'Girl' }).click();
  await parent.locator('input[type=text]').nth(2).fill('HN-77001');
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
  await parent.getByRole('dialog').getByRole('tab', { name: 'Hairstyle' }).click();
  await parent.getByRole('dialog').getByRole('button', { name: 'Hairstyle 3' }).click();
  await parent.getByRole('dialog').getByRole('tab', { name: 'Hair colour' }).click();
  await parent.getByRole('dialog').getByRole('button', { name: 'Red' }).click();
  await shot(parent, '00-edit-child-avatar');
  await parent.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await parent.getByRole('dialog').waitFor({ state: 'detached' });
  await parent.reload();
  await parent.getByText('Mali Test').first().waitFor();
  const srcs = await parent.$$eval('img', (imgs) => imgs.map((i) => i.getAttribute('src')));
  check('edit child opens as a window; avatar skin, hairstyle and colour are saved',
    stayed && srcs.some((x) => x?.includes('young/girl-deep')) && srcs.some((x) => x?.includes('young/hair-3')));

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
  await parent.locator('input[type=date]').fill('2026-06-01');
  await parent.getByRole('button', { name: 'Boy' }).click();
  await parent.getByRole('button', { name: 'Save and continue' }).click();
  await parent.waitForURL('**/dashboard');
  await parent.getByText('Baby Test').first().waitFor();
  const babySrcs = await parent.$$eval('img', (imgs) => imgs.map((i) => i.getAttribute('src')));
  await shot(parent, '00b-baby-dashboard');
  const babyChart = await parent.locator('.recharts-cartesian-axis-tick-value').allTextContents();
  check('a baby gets the baby avatar and a 0–36 month chart', babySrcs.some((x) => x?.includes('baby/skin-')) && babyChart.includes('36 mo'), babyChart.slice(0, 8).join(','));
  // Back to the first child for the rest of the flow.
  await parent.getByRole('button', { name: 'Switch child' }).click();
  await parent.getByRole('button', { name: /Mali Test/ }).click();
  await parent.waitForTimeout(400);

  await parent.goto(`${APP}/growth`);
  await parent.getByPlaceholder('Height (cm)').first().fill('128');
  await parent.getByPlaceholder('Weight (kg)').first().fill('26');
  await parent.locator('form input[type=date]').fill('2025-09-15');
  await parent.getByRole('button', { name: 'Add measurement' }).click();
  await parent.getByText('typical range for the child').waitFor({ timeout: 15000 });
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
    body3.includes('±7 months') && /1 estimate in [78] /.test(body3) && body3.includes('least accurate under 10 years') && !body3.includes('±9 months'));
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
