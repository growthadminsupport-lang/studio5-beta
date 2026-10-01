# GrowTH API

**Status:** v1, generated from the routes in `backend/src` on 2026-10-01. It replaces the draft
contract v0.1 of 2026-09-14.

The interactive specification is **Swagger UI at `/docs`** on the backend. It lists every request
body and validation rule, and the raw OpenAPI JSON is at `/docs-json`. This file is the map:
conventions, who may call what, and the rules that a schema cannot express. Roles and flows are
explained in `docs/user-flows.md`.

| Environment | Backend | Frontend |
| --- | --- | --- |
| Local | `http://localhost:3001` | `http://localhost:5173` |
| Production | `https://growth-api-*.onrender.com` (Render service `growth-api`) | `https://studio5-beta.vercel.app` |

The frontend reads the backend URL from `VITE_API_URL`. Routes have no `/api` prefix.

---

## 1. Conventions

- **JSON in and out.** The two uploads (X-ray, avatar) use `multipart/form-data` with a field
  named `file`. Field names are `camelCase`, IDs are UUID strings, and timestamps are ISO 8601 UTC.
- **Errors** always carry `{ "statusCode", "message" }`. `message` is written for the user, and
  the frontend shows it as-is (`errorMessage()` in `frontend/src/lib/api.js`).
- **Status codes:** `400` invalid input, `401` not signed in or token expired, `403` signed in
  but not allowed, `404` not found, `409` conflict (e.g. email taken, already a member), `410`
  invite expired, used or revoked, `429` rate limited.

### Authentication

- `POST /auth/login`, `/auth/register` and `/auth/google` return
  `{ accessToken, refreshToken, user }`.
- Send `Authorization: Bearer <accessToken>` on every route not marked *public* below. The access
  token lives `JWT_ACCESS_EXPIRES_IN` (15 minutes in production).
- On a `401`, call `POST /auth/refresh` with `{ refreshToken }`. You get a new pair; the old
  refresh token is revoked (rotation). Refresh tokens are stored hashed and last
  `JWT_REFRESH_EXPIRES_IN` (7 days).
- The frontend keeps the refresh token in `localStorage` when "Remember me" is ticked, otherwise in
  `sessionStorage`. The access token stays in memory. Only one refresh runs at a time, and
  parallel `401`s wait for it.
- Google sign-in sends the Google Identity Services ID token as `{ credential }`. The backend
  verifies it against `GOOGLE_CLIENT_ID`.

### Rate limits

All routes share a limit of 120 requests per minute per client IP. The count is stored in
Postgres (`rate_limits`), so it survives restarts. These routes are tighter:

| Route | Limit |
| --- | --- |
| `POST /auth/login`, `POST /auth/google` | 10 / minute |
| `POST /auth/register` | 5 / 10 minutes |
| `POST /auth/forgot-password` | 3 / 5 minutes |
| `POST /auth/reset-password` | 10 / minute |
| `POST /children/:id/invites` | 10 / 10 minutes |
| `GET /invites/:token` | 30 / minute |
| `POST /support/contact`, `POST /support/report` | 5 / 10 minutes |

`/health` is not throttled, so the keep-awake ping never uses up the limit.

---

## 2. Who may do what

Two kinds of role decide access:

- **Account role**, on the user: `USER`, `DOCTOR` or `ADMIN`. A `DOCTOR` also has
  `doctorStatus` `PENDING`, `APPROVED` or `REJECTED`.
- **Role on one child**, on the link between a person and a child (`ChildGuardian.role`):
  `PARENT`, `CARETAKER` or `DOCTOR`. The same account can be a parent of one child and a caretaker
  of another.

Every child route calls `ChildrenService.access(childId, userId, capability)`. It checks the link
against `backend/src/children/child-access.ts`. A `DOCTOR` link counts only while the account is
an approved doctor. If the caller has no link to the child, or a link without the capability, the
route returns `403` with a message that names what the role cannot do.

| Capability | Parent | Caretaker | Doctor |
| --- | --- | --- | --- |
| `child.read` (profile) | ✓ | ✓ | ✓ |
| `child.edit` (name, sex, date of birth) | ✓ | – | – |
| `child.setHn` / `child.readHn` (hospital number) | ✓ | – | ✓ |
| `child.delete` | ✓ | – | – |
| `members.manage` (invite, list and remove members) | ✓ | – | – |
| `growth.read` / `growth.write` | ✓ | ✓ | ✓ |
| `puberty.submit` | ✓ | ✓ | ✓ |
| `puberty.result` (outcome, history results, plan) | ✓ | – | ✓ |
| `boneAge.write` (upload, review, edit, delete) | – | – | ✓ |
| `boneAge.full` (months, X-ray, gap, unreviewed records) | – | – | ✓ |
| `boneAge.status` (doctor's reading only) | ✓ | ✓ | ✓ |

The server also shapes responses by role. Hiding a field in the UI is not enough:

- A caretaker's child has no `hn`.
- A caretaker's puberty screening has no outcome or answers. It returns only `id`, `childId`,
  `assessedAt`, `submittedByMe` and `resultShared: false`.
- A parent's or caretaker's bone-age record has only `id`, `childId`, `examDate`, `review`,
  `doctorNote` and `reviewedAt`. Records with no review yet are left out.

---

## 3. Routes

*Public* means no token is needed. Every other route needs `Authorization: Bearer`.

### Health

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | *Public.* `{ status: "ok" }`. Pinged by `.github/workflows/keep-backend-awake.yml`. |

### Auth and account

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | *Public.* `fullName`, `email`, `password`, `phoneNumber?`, `acceptedTerms: true`, and `accountType?` `USER` (default) or `DOCTOR`. A doctor also sends `licenseNumber` and `hospital` and starts as `PENDING`. |
| POST | `/auth/login` | *Public.* `email`, `password`. |
| POST | `/auth/google` | *Public.* `{ credential, acceptedTerms? }`. Creates the account on first use (terms required then), with a verified email. |
| POST | `/auth/refresh` | *Public.* `{ refreshToken }`. Rotates the pair. |
| POST | `/auth/logout` | *Public.* `{ refreshToken }`. Revokes it. |
| POST | `/auth/forgot-password` | *Public.* Always `200`, so it does not reveal which emails exist. Sends a reset link through Resend. |
| POST | `/auth/reset-password` | *Public.* `token`, `newPassword`. The token is single-use, 1 hour. Revokes every session. |
| POST | `/auth/change-password` | `currentPassword`, `newPassword`. A wrong current password is `400`. Revokes every session and returns a new `{ accessToken, refreshToken }` for this device. Refused for Google-only accounts, which have no password. |
| GET / PATCH | `/auth/profile` | Alias of `/users/me`, kept for older clients. |
| GET | `/users/me` | The signed-in user, including `role`, `doctorStatus`, `hospital`. Never the password hash. |
| PATCH | `/users/me` | `fullName`, `phoneNumber`. |
| DELETE | `/users/me` | Deletes the account and its avatar. Children where this account is the only parent are deleted with it, X-ray files included. |
| GET / POST | `/users/me/avatar` | Profile photo. JPEG/PNG/WebP, 5 MB. |

### Children and members

| Method | Path | Capability and notes |
| --- | --- | --- |
| GET | `/children` | Every child linked to the caller, each with `myRole` and `familyName`. Doctors may pass `?hn=`, which searches only their own patients. |
| POST | `/children` | Creates a child with the caller as `PARENT`. `fullName`, `sex`, `dateOfBirth`, `hn?`. |
| GET | `/children/:id` | `child.read` |
| PATCH | `/children/:id` | `child.edit` for details. `child.setHn` for `hn`, so a doctor may change the HN only. |
| DELETE | `/children/:id` | `child.delete`. With one parent, deletes the child, every record and the X-ray files. With two parents, removes only the caller's link. |
| GET | `/children/:id/members` | `members.manage`. Returns `members` and `pendingInvites`. |
| DELETE | `/children/:id/members/:userId` | A parent removes anyone except a parent. A caretaker or doctor may remove only themselves ("leave"). |
| POST | `/children/:id/invites` | `members.manage`. `role` `CARETAKER` or `DOCTOR`, `email?`. Returns `{ id, link, expiresAt, email, emailed }`. The link carries a random 24-byte token, stored only as a SHA-256 hash. It is single-use and lasts 7 days. |
| DELETE | `/children/:id/invites/:inviteId` | `members.manage`. Revokes a pending invite. |
| GET | `/invites/:token` | *Public.* Preview for the invite page: `childFirstName`, `invitedBy`, `role`, `expiresAt`, `state` (`valid`, `expired`, `used`, `revoked`). |
| POST | `/invites/:token/accept` | Links the caller to the child. Returns `410` if the invite is expired, used or revoked. Returns `403` if a `DOCTOR` invite meets an account that is not an approved doctor, `409` if the caller already has a role on the child, and `400` for the parent's own invite. The claim is transactional, so two people cannot both use one link. Notifies the parents. |

### Growth

| Method | Path | Capability and notes |
| --- | --- | --- |
| POST | `/growth` | `growth.write`. `childId`, `measuredAt`, `heightCm`, `weightKg`, `headCircumferenceCm?`. Returns the record with percentiles, SDS, BMI (from 2 years) and plain-language guidance. Records `recordedById`. |
| GET | `/growth?childId=` | `growth.read`. All records, newest first. |
| GET | `/growth/history`, `/growth/chart`, `/growth/statistics` | `growth.read`. The same data shaped for the history list, the chart and the dashboard. |
| GET | `/growth/reference-curve?childId=&measure=` | `growth.read`. CDC 2000 percentile curves for the child's sex. `measure` is `height`, `weight`, `bmi` or `headCircumference`. |
| GET | `/growth/bmi`, `/growth/percentile`, `/growth/sds` | Single calculations from query values (`sex`, `ageMonths`, `measure`, `value`). They read no child data. |
| GET / PATCH / DELETE | `/growth/:id` | `growth.read` / `growth.write`. |

### Puberty screening

| Method | Path | Capability and notes |
| --- | --- | --- |
| POST | `/puberty/questionnaire` | `puberty.submit`. `childId`, `answers`. A parent or doctor gets the result. A caretaker gets `{ submitted: true }`, and the parents and doctors are notified in the app and by email. |
| GET | `/puberty/history?childId=` | `child.read`. Full results for `puberty.result`. A caretaker gets submission receipts only. |
| GET | `/puberty/plan?childId=` | `puberty.result`. The 4-month follow-up plan. |
| GET | `/puberty/:id` | Shaped like history. |

### Bone age

| Method | Path | Capability and notes |
| --- | --- | --- |
| POST | `/bone-age/upload` | `boneAge.write`. Multipart `file` (JPEG/PNG, 10 MB), `childId`, `examDate?` (defaults to today). Runs the ONNX model and returns the doctor view below. |
| GET | `/bone-age/model-status` | Whether the model is loaded, its version, MAE and ±12-month accuracy. |
| GET | `/bone-age/history?childId=` | `boneAge.full` gets every record. `boneAge.status` gets reviewed records in the family shape. |
| GET | `/bone-age/:id` | Same shaping. |
| GET | `/bone-age/:id/image` | `boneAge.full`. Streams the X-ray. X-rays are never served as static files. |
| PATCH | `/bone-age/:id` | `boneAge.write`. `examDate`, `review` (`NORMAL`, `ADVANCED`, `DELAYED`), `doctorNote`. Setting a review notifies the parents and caretakers. |
| DELETE | `/bone-age/:id` | `boneAge.write`. Deletes the record and the file. |

**How the doctor view is computed** (`bone-age.rules.ts`, `common/age.ts`):

- `chronologicalAgeMonths` is the child's age **on the exam date**, not on the upload date. It
  uses the same month length as growth (30.4375 days), so the AI estimate and the real age are in
  the same units.
- `gapMonths` is the predicted bone age minus the real age.
- `suggestedReview` is `ADVANCED` when the gap is +24 months or more, `DELAYED` when it is −24 or
  less, and `NORMAL` otherwise. It is only a suggestion. The family sees the review that the
  doctor saves.
- `implausibleGap` is true when the gap is more than 36 months. This usually means a wrong date of
  birth, a wrong exam date or a bad image, and the UI asks the doctor to check it.
- `maeMonths` is the model's mean absolute error, shown next to every estimate.

### Content, notifications, support, suggestions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/articles?category=` | *Public.* Published articles. |
| GET | `/articles/:idOrSlug` | *Public.* One article, by UUID or slug. |
| GET | `/categories` | *Public.* |
| GET | `/search?q=` | *Public.* Searches article titles and bodies. |
| GET | `/notifications` | The caller's notifications. Each has `type`, `childId` and `isRead`. |
| PATCH | `/notifications/:id` | Marks one as read. |
| POST | `/notifications/read-all` | Marks all as read. |
| DELETE | `/notifications/:id`, `/notifications` | Dismisses one, or all. |
| POST | `/support/contact` | *Public.* `email`, `subject`, `message`. If a token is sent, the message is linked to that account. |
| POST | `/support/report` | In-app problem report: `message`, plus `context` (`page`, `childId`) that the frontend fills in. |
| GET | `/suggestions?childId=` | What to do next for one child, by priority. Shaped by role: a caretaker never sees puberty outcomes, and a family never sees AI numbers. |

### Admin portal

Every route needs an account with role `ADMIN`. `AdminGuard` reads the role from the database on
each request, so a demotion takes effect at once, without waiting for the token to expire.
Everyone else gets `403`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/doctors?status=` | Doctor accounts with licence and hospital. |
| PATCH | `/admin/doctors/:id` | `{ status: "APPROVED" \| "REJECTED" }`. Notifies the doctor in the app and by email. |
| GET / POST | `/admin/articles` | Every article, drafts included. Bodies are Markdown. |
| PATCH / DELETE | `/admin/articles/:id` | Edit, publish or unpublish, delete. |
| GET | `/admin/inbox?kind=&status=` | Contact messages and problem reports. |
| PATCH | `/admin/inbox/:id` | `{ status: "NEW" \| "READ" \| "RESOLVED" }`. |
| GET | `/admin/stats` | Users by role, doctors pending, children, and growth entries, screenings and X-rays per week. |
| GET | `/admin/export.csv?dataset=growth\|puberty\|bone-age` | Anonymised research export. It has no names, emails, phone numbers, HN, dates of birth or exact dates. Each child appears as an HMAC-SHA256 key (`EXPORT_SALT`), with sex, the month, age in months, and the measurements (growth: height, weight, BMI with percentiles and SDS; puberty: outcome; bone age: real age, AI age, gap, doctor review, model version). |

---

## 4. Backend environment variables

All of them are declared in `render.yaml`. Secrets are marked `sync: false` and set in the Render
dashboard.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Tokens |
| `CORS_ORIGIN` | The one allowed frontend origin, e.g. `https://studio5-beta.vercel.app` |
| `FRONTEND_URL` | Base for links in emails (reset, invite) |
| `RESEND_API_KEY`, `MAIL_FROM` | Email through Resend, sent from `hacklgroups.com` |
| `GOOGLE_CLIENT_ID` | Verifies Google sign-in tokens |
| `ADMIN_EMAIL` | Promoted to `ADMIN` by the seed, once that email has signed in with Google |
| `EXPORT_SALT` | Key for the anonymised export. Falls back to `JWT_ACCESS_SECRET` |
| `BONE_AGE_MODEL_PATH`, `BONE_AGE_MODEL_VERSION` | ONNX model. Downloaded at build time from the GitHub release `model-v1` |
| `BONE_AGE_MAE_MONTHS`, `BONE_AGE_ACCURACY_12M` | Measured accuracy, shown with every estimate |
| `BONE_AGE_AGE_MEAN`, `BONE_AGE_AGE_STD`, `BONE_AGE_CALIBRATION` | Model output scaling |

The frontend needs `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`, set in Vercel.
