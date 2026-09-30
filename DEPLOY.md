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
   Parenting Resources articles, upsert-only) and downloads the bone-age model from the
   `model-v1` GitHub release, so a deploy needs no manual migration or seed step.
2. Set the variables `render.yaml` declares with `sync: false` (dashboard → Environment):

   | Variable | Value | If unset |
   | --- | --- | --- |
   | `DATABASE_URL` | Neon connection string | The backend cannot start |
   | `CORS_ORIGIN` | Exact Vercel origin, e.g. `https://<project>.vercel.app`, no trailing slash | The browser blocks every API call |
   | `FRONTEND_URL` | The same Vercel origin | Reset-password links point at `localhost:5173` |
   | `RESEND_API_KEY` | Resend API key | Forgot-password returns 200 but no email is sent |
   | `MAIL_FROM` | Verified sender, e.g. `GrowTH <noreply@hacklgroups.com>` (domain verified in Resend, DNS records in Cloudflare) | Falls back to `onboarding@resend.dev` |
   | `GOOGLE_CLIENT_ID` | Google OAuth web client ID | Google sign-in is refused; email sign-in still works |

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

Leave `RESEND_API_KEY` unset locally: forgot-password then returns the reset token in the
response instead of emailing it.
