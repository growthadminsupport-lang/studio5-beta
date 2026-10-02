# Test record

TOR §6.5: functional testing before each milestone, on at least two browsers and one mobile
viewport, with a record kept. This is that record.

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
