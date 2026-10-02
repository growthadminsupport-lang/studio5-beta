# Browser end-to-end test

`flows.mjs` (38 checks) walks through the product the way people use it, in a real browser: a parent, a
caretaker, a doctor and an admin, each in their own browser context. It is the test record for
TOR §6.5 (`docs/test-record.md` has the latest results).

It covers registration and email confirmation, adding and editing children (avatars,
relationship), growth entries and the charts, puberty screening, invitations by QR and email,
caretaker and doctor access, doctor approval, X-ray upload (JPEG, WebP, a PDF report) with the
refine9 model, the doctor's review and what the family sees, notifications, the admin inbox
and usage, removing a member, the Google welcome form, a phone-sized screen in dark mode, and
password change across devices.

## Run it

Needs a local Postgres with the migrations applied and `SEED_DEMO=true` seeded (the admin
step signs in as `admin@demo.growth`), the API on port 3901 in development mode with the
model files in `backend/models/`, and the frontend dev server on 5199:

```bash
# API (development mode: the email-confirmation test reads the token from the API)
cd backend && NODE_ENV=development PORT=3901 CORS_ORIGIN=http://localhost:5199 \
  DATABASE_URL=... JWT_ACCESS_SECRET=dev JWT_ACCESS_EXPIRES_IN=15m npm run start:prod
# Frontend
cd frontend && VITE_API_URL=http://localhost:3901 npx vite --port 5199
# Test
cd e2e && npm install && npm run fixtures
BROWSER=chromium npm test     # or firefox, webkit (Safari's engine)
```

Browsers come from `npx playwright install chromium firefox webkit`. Screenshots go to
`/tmp/e2e-shots/<browser>/` (`E2E_SHOTS` to change). The auth rate limits are per IP, so clear
the `rate_limits` table between back-to-back runs.

On a machine without root (no `playwright install-deps`), the missing system libraries can be
unpacked from `.deb` files into a folder and passed with `LD_LIBRARY_PATH`; WebKit also needs
`EXTRA_LD_LIBRARY_PATH` patched into its `minibrowser-wpe/MiniBrowser` wrapper and
`GST_PLUGIN_SYSTEM_PATH` pointing at GStreamer's plugins, or it crashes on the first video.
