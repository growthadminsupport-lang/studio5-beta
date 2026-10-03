# Test record

TOR §6.5: functional testing before each milestone, on at least two browsers and one mobile
viewport, with a record kept. This is that record.

## 2026-10-03, admin portal walk-through and Knowledge phone layout

| Check | Result |
| --- | --- |
| Browser walk-through, now 47 checks (adds the full admin portal: tabs by clicking, doctor reject and re-approve, article draft, publish, unpublish and delete, inbox read, resolve and reopen, three CSV exports) | Chromium, Firefox, WebKit: **47 / 47** each |
| Knowledge, Home and article pages on phones (team's new layout) | No overflow at 390 px, light and dark; no word cut mid-letter at 320–600 px in Chromium and WebKit |

Found and fixed:
- Admin tabs added to the URL on every click (`/admin/doctors/articles/…`) and showed an
  empty page. React Router 7 resolves relative links inside the `/admin/*` route against the
  whole URL. The old checks opened each tab by URL, so they never clicked one.
- CSV export could be dropped by Firefox and Safari (detached link, URL revoked at once).
- The phone article list read the old hard-coded articles, not the API's.
- "Understanding" broke as "Understandin / g" on a 390 px phone.

## 2026-10-02 (evening), held-out model evaluation

| Check | Result |
| --- | --- |
| Bone-age model on the 200-image RSNA test set, through the app's pipeline (`npm run eval:model`) | MAE **6.63 months** with one view, 6.50 with four (`docs/model-evaluation.md`) |
| Backend unit tests (adds: each result reports the accuracy of the mode that produced it) | **106 / 106** |
| `npm run verify:model` with the new model card | all checks pass |
| Browser walk-through, 40 checks | Chromium **40 / 40**, Firefox **40 / 40**, WebKit **40 / 40** in 8 of 10 runs |

**Intermittent WebKit failures: two bugs found and fixed the same evening** (PR #11). Neither
failure was caught with logs, so tying them to these bugs is inferred: the bugs are proven
(each has a check that fails without its fix), and the WebKit failures stopped after the fixes
(0 in 10 runs, against 2 in 10 before).
- **Sign-out on reload.** A request that got a 401 started a session refresh; if the page
  reloaded or navigated meanwhile, the refresh was aborted, and the response handler ended the
  session anyway, deleting the stored token. The 2 October fix had covered the other path
  (start-up), not this one. Likely why only WebKit failed: it appears to run that handler
  while the page unloads, where the other browsers drop it; not confirmed. Now only a server rejection signs out. A new check aborts a refresh on purpose: without
  the fix it signs the parent out, with it they stay signed in.
- **"This confirmation link is invalid or has expired" for a confirmed address.** The link
  was single-use and the page sent it twice (React development mode), so whichever request
  came second failed. Real users hit the same with a second tab, phone then laptop, or a mail
  scanner that opens links first. The link now stays valid until it expires, and opening it
  again says "confirmed". This is the step where one of the failing runs stopped.

After both fixes: 42 checks, Chromium 42/42, Firefox 42/42, WebKit 42/42 in 5 consecutive
runs (and 5 more after the first fix alone). API end-to-end 35/35, unit 106/106.

## 2026-10-02 (afternoon), avatar picker, child card and phone layout

| Check | Result |
| --- | --- |
| Browser walk-through, now 40 checks (adds: editing shows only the saved relationship; a caretaker has no edit button) | Chromium, Firefox, WebKit: **40 / 40** each |
| Phone and tablet layout: 27 pages for parent, doctor, admin and signed-out visitors at 360, 390 and 768 px wide, in Chromium (mobile emulation) and WebKit. The script flags any element running past the screen edge. | **No overflow** |

Found and fixed:
- Hair colour did not apply to hairstyles drawn in black (baby styles 1, 2, 4 and 9). Their
  fringe stayed black whatever colour was picked. The hair layers are rebuilt with shading
  taken from each tone's rank, so every style takes the colour.
- The hairstyle picker cut the hair off at the circle; it now shows the whole figure. The
  clothes picker showed each outfit tiny inside an empty frame; it is now cropped to the outfit.
- On phones, the bottom tab bar covered the footer's last lines. The iPhone home-indicator
  inset was ignored because `viewport-fit=cover` was missing. Safari zoomed into every form
  field, because the text was under 16 px.
- On a 390 px phone the height card showed "137.5…"; the unit is now smaller, so it fits.

## 2026-10-02, release with Google onboarding, avatars, refine9 and R2 storage

Commit under test: `main` at the time of PR "Fix sign-out on reload", plus that fix.

| Suite | What it covers | Result |
| --- | --- | --- |
| Backend unit (`npm test`) | Growth maths (CDC 2000 LMS), puberty rules, bone-age rules and refine9 preprocessing against cv2/torchvision output, auth including Google sign-in, password reset | **105 / 105** |
| API end-to-end (`npm run test:e2e`, real Postgres) | The role permission matrix over HTTP, invitations, X-ray files, accounts, sessions | **35 / 35** |
| API end-to-end through Cloudflare R2's S3 API (local S3-compatible server) | Uploads kept in, served from and deleted from the bucket | **34 / 34** (PR #7) |
| Bone-age model parity (`npm run verify:model`) | Node result vs the ML team's PyTorch pipeline on six real hand radiographs | within **0.013 months** (0.25 through the 2048 px cap) |
| Browser walk-through (`e2e/flows.mjs`), 38 checks | Every role's flows end to end, including a 390 px phone screen in dark mode | see below |

| Browser | Engine | Result |
| --- | --- | --- |
| Chromium 153 | Blink (Chrome, Edge) | **38 / 38** |
| Firefox 155 | Gecko | **38 / 38** |
| WebKit 26.6 | WebKit (Safari) | **38 / 38** |

The three browsers run headless on Linux (ARM64). WebKit is the engine Safari uses, not
Safari itself; a manual check on an iPhone and a Mac is still worth doing before launch.

### Found and fixed during this round
- Reloading right after a password change, or two tabs refreshing the session at once, signed
  the person out in Firefox and WebKit. A cancelled refresh request was treated as a rejected
  token and the stored session was deleted. Now only a server rejection clears it, a rotated
  token is accepted again for 30 seconds, and the app retries once at start-up after a network
  failure.
- The registration phone number was never saved (FR-1).
- WebP X-ray uploads failed and deleted the file.
- The growth chart's tooltip compared a measurement with the wrong age's reference range
  (a 9-year-old's 137 cm was called "above the usual range" of 1-year-olds). Recharts matches
  a separate series to the tooltip by array index. The measurements now share the reference
  rows, and a new check hovers every point and verifies the range belongs to its age.

### Checked by hand on the live site (2026-10-02)
Real Google sign-in (welcome form, linking), real invitation and confirmation emails through
Resend: confirmed by the project lead.
