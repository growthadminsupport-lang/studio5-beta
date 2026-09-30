# GrowTH

GrowTH is a web app for tracking a child's growth. Parents, caretakers and the child's doctor
use it together: growth measurements plotted against CDC 2000 reference curves, a guided
puberty screening questionnaire, and an AI bone-age estimate from a hand-and-wrist X-ray.
Studio 5 project (Project Beta).

This repository assembles the team's work into one place:

| Path | What it is | Came from |
| --- | --- | --- |
| `frontend/` | React 19 + Vite 8 web app (Tailwind, MUI, Recharts) | `growthadminsupport-lang/studio5-frontend` |
| `backend/` | NestJS 11 API, Prisma 5 on Postgres, in-process ONNX bone-age inference | `MONNNNNNNNNNN/project_stu5` |
| `ai-service/` | Offline Python tooling: model training/evaluation and `.pt` to `.onnx` export | `project_stu5` |
| `data-knowledge/` | TOR, personas, storyboards, tech-stack diagram, source PDFs | `project_stu5` |
| `docs/` | API contract, TOR compliance audit, research and sources, diagrams | both |
| `design/` | Exported screen mockups | `project_stu5` |

Both source repositories were merged with their full history, so `git log` shows every
contributor's original commits.

## Tech stack

See `data-knowledge/Growth-techstack.jpg`.

- **Frontend:** React 19, Vite 8, MUI 9, Tailwind, Recharts 3, hosted on Vercel.
- **Backend:** NestJS 11 on Render, with global guards for rate limiting and JWT auth.
- **Database:** Neon Postgres through Prisma 5.
- **Bone age:** EfficientNet-B0 model run with `onnxruntime-node`, downloaded at build time from
  the `model-v1` GitHub release.
- **Email:** Resend (password reset, invitations, alerts). DNS on Cloudflare (`hacklgroups.com`).

## Running locally

Node 22 (`backend/.nvmrc`).

```bash
# API: needs a Postgres URL in backend/.env (see backend/.env.example)
cd backend && npm ci && npx prisma migrate dev && npx prisma db seed && npm run start:dev

# Web app, http://localhost:5173
cd frontend && npm ci && cp .env.example .env.local && npm run dev
```

Or everything in containers, app on http://localhost:8080: `docker compose up --build`.

Deployment is described in [`DEPLOY.md`](DEPLOY.md).
