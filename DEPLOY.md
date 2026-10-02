# Deploying GrowTH

Split deploy: **frontend → Vercel**, **backend → Render**, **database → Neon**, all on free tiers.
Every account is owned by `growth.admin.support@gmail.com`.

## 1. Database — Neon

1. Create a free project at https://neon.tech in the Growth organization, region
   `aws-ap-southeast-1` (Singapore, next to the Render service).
2. Copy the pooled connection string:
   `postgresql://<user>:<password>@<host>/<db>?sslmode=require`
3. It goes into Render as `DATABASE_URL` in step 2.

## 2. Backend — Render

1. Connect the `growthadminsupport-lang/studio5-beta` repo at https://render.com
   (New → Blueprint). Render reads
   `render.yaml` at the repo root (Blueprint), and that file is the source of truth for the
   build and start commands. The build runs `prisma migrate deploy` and `prisma db seed` (the
   Parenting Resources articles, upsert-only) and downloads the bone-age model (refine9) from the
   `model-v2` GitHub release, checking its SHA-256, so a deploy needs no manual migration or seed step.
2. Set the variables `render.yaml` declares with `sync: false` (dashboard → Environment):

   | Variable | Value | If unset |
   | --- | --- | --- |
   | `DATABASE_URL` | Neon connection string | The backend cannot start |
   | `CORS_ORIGIN` | Exact Vercel origin, e.g. `https://<project>.vercel.app`, no trailing slash | The browser blocks every API call |
   | `FRONTEND_URL` | The same Vercel origin | Reset-password links point at `localhost:5173` |
   | `RESEND_API_KEY` | Resend API key | Forgot-password returns 200 but no email is sent |
   | `MAIL_FROM` | Verified sender, e.g. `GrowTH <noreply@hacklgroups.com>` (domain verified in Resend, DNS records in Cloudflare) | Falls back to `onboarding@resend.dev` |
   | `GOOGLE_CLIENT_ID` | Google OAuth web client ID | Google sign-in is refused; email sign-in still works |
   | `ADMIN_EMAIL` | `growth.admin.support@gmail.com` | Nobody can open the admin portal |

   Render generates `JWT_ACCESS_SECRET`. The bone-age calibration values are set in
   `render.yaml` itself.
3. Deploy, and note the backend URL (e.g. `https://growth-api-xxxx.onrender.com`).
4. Set it as the `BACKEND_URL` repository variable in GitHub (Settings → Secrets and variables →
   Actions → Variables) so the keep-awake workflow pings the right host.

Use Neon, not Render Postgres: a free Render Postgres database expires 30 days after it is
created.

**Known limitation:** avatars and bone-age X-rays are written to Render's local disk, which is
wiped on every redeploy (the free plan has no persistent volume). The database rows survive and
point at missing files, which the API reports as 404. Move uploads to object storage before
relying on them.

**Cold starts:** the free instance sleeps after ~15 minutes idle and takes 30-60s to wake. See
`.github/workflows/keep-backend-awake.yml` for what the scheduled ping does and does not do.

## 3. Frontend — Vercel

1. Project settings → Root Directory → `frontend`. The build command (`npm run build`) and
   output directory (`dist`) are auto-detected.
2. Environment variables:
   - `VITE_API_URL` → the Render backend URL from step 2.
   - `VITE_GOOGLE_CLIENT_ID` → the same client ID as the backend's `GOOGLE_CLIENT_ID`. Optional;
     the Google button is hidden without it. Add the Vercel origin under *Authorized JavaScript
     origins* in Google Cloud Console.
3. Redeploy. Vite inlines `VITE_*` values at build time, so changing one needs a redeploy.
4. Set Render's `CORS_ORIGIN` and `FRONTEND_URL` to this Vercel URL if you have not already.

## Admin account

1. Set `ADMIN_EMAIL` on Render.
2. Open the site and **Sign in with Google** as that address once. Google verifies the address;
   a password registration does not, and an unverified address is never promoted.
3. Redeploy (Manual Deploy → Deploy latest commit). The seed promotes the account, and the
   admin portal appears after signing in again.

## Local development

Everything in containers, app on http://localhost:8080:

```bash
docker compose up --build
```

Or with hot reload — Postgres in Docker, the app on the host (Node 22, see `.nvmrc`):

```bash
docker compose up -d db
cp backend/.env.example backend/.env
cd backend && npm ci && npx prisma migrate dev && npx prisma db seed && npm run start:dev
cd frontend && npm ci && npm run dev    # http://localhost:5173
```

The permission tests run the whole API against a real, migrated Postgres. They truncate every
table, so point them at a throwaway database:

```bash
cd backend && E2E_DATABASE_URL=postgresql://growth:growth_dev_pw@localhost:5432/growth_test npm run test:e2e
```

Set `SEED_DEMO=true` locally for one demo account per role (password `Demo1234!`).

Leave `RESEND_API_KEY` unset locally: forgot-password then returns the reset token in the
response instead of emailing it.

## File storage (Cloudflare R2)

X-rays and profile photos must outlive deploys: Render's free disk is wiped each time. The API
keeps every upload in a private R2 bucket when these four variables are set, and reads it back
from there. Free tier: 10 GB stored, 1 million writes and 10 million reads a month, no charge
for downloads. R2 needs a payment method on the Cloudflare account even on the free tier;
nothing is charged within those limits.

1. Cloudflare dashboard (the account that holds `hacklgroups.com`) → **R2 Object Storage**.
   Accept the R2 terms if asked.
2. **Create bucket** → name `growth-uploads`, location **Automatic**, storage class
   **Standard**. Leave it private: do not enable a public `r2.dev` URL or a custom domain.
   The API serves images itself, after checking who is asking.
3. R2 overview → **Account details** (right side) → copy the **Account ID**.
4. R2 overview → **API Tokens** → **Manage** (or "Manage R2 API Tokens") → **Create Account API
   token** (or "Create API token"):
   - Token name `growth-api`
   - Permissions **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** → `growth-uploads`
   - TTL: Forever
   - **Create**. Copy the **Access Key ID** and **Secret Access Key** now; the secret is
     shown only once. (Ignore the "Token value"; S3 clients use the key pair.)
5. Render → `growth-api` → **Environment** → add:

   | Variable | Value |
   | --- | --- |
   | `R2_ACCOUNT_ID` | the Account ID from step 3 |
   | `R2_ACCESS_KEY_ID` | Access Key ID from step 4 |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key from step 4 |
   | `R2_BUCKET` | `growth-uploads` |

   **Save, rebuild, and deploy**.
6. Check: the deploy log shows `Uploads are kept in R2 bucket "growth-uploads"` when the first
   upload arrives. Upload an X-ray as a doctor, redeploy, and open it again: it still shows.
   In Cloudflare the object appears under `bone-age/`.

Files uploaded before R2 was configured are not moved; they were on the old disk and are gone
after a redeploy (the app shows "no longer available").

