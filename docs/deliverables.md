# Deliverables (TOR Section 5)

Where every deliverable is, and its status. This is the index for the handover package (D11).
The status and the open items come from [`tor-compliance.md`](./tor-compliance.md), last
audited 2026-10-01.

Large media (videos, Figma, source artwork) lives on the team's Google Drive, not in git. **This
repository is public**, so Drive items are named here but not linked. Open them from the shared
GrowTH Drive folder, owned by growth.admin.support@gmail.com.

| D | Deliverable | Status | Where |
| --- | --- | --- | --- |
| D1 | UX/UI design package | 🟡 | Figma project and prototype: team Drive. Hi-fi and low-fi exports: [`design/mockups/`](../design/mockups/) (46 PNG screens, desktop and mobile, plus SVG and zip). The Drive's `Growth-Studio5` UI-flow document. |
| D2 | Web application (front end) | 🟢 | https://studio5-beta.vercel.app · source in [`frontend/`](../frontend/) |
| D3 | Backend, API, database | 🟢 | Render service `growth-api`, Swagger at `/docs` on the API · [`api.md`](./api.md) · schema [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) · Neon (growth.admin org) |
| D4 | AI model + training and evaluation report | 🟡 | Model: refine9 (EfficientNet-B5), GitHub release [`model-v2`](https://github.com/growthadminsupport-lang/studio5-beta/releases/tag/model-v2), conversion and checks in [`ai-service/refine9/`](../ai-service/refine9/). Integration: [`ai-integration.md`](./ai-integration.md), [`model-updates.md`](./model-updates.md). Team write-up: `data-knowledge/Studio5%20Backend+Ai.pdf.pdf`. **The training and evaluation report is still owed by the ML team.** |
| D5 | Doctor interview video | 🟢 | Team Drive: `Final Doctor interview ver3.mp4` |
| D6 | 2D motion graphic narrative video | ⚪ | Team. Briefs: [`animation-briefs.md`](./animation-briefs.md). Storyboard: `data-knowledge/Video%20%E2%80%94%20Storyboard%20&%20Script%20(Draft).pdf.pdf` |
| D7 | Promotional video | ✂️ | Dropped by the client on 2026-09-30 |
| D8 | Demonstration video | ⚪ | Team. Script: [`demo-script.md`](./demo-script.md). Shot list: the role flows in [`user-flows.md`](./user-flows.md) |
| D9 | Short-form social clips | ✂️ | Dropped by the client as promotional work (2026-10-01) |
| D10 | Documentation set | 🟡 | See the documentation list below. **Parent user manual and final report not written yet.** |
| D11 | Source files and handover | 🟡 | This repository and this index. The logo, logo motion and avatar sources (PSD) are on the team Drive. Add the remaining Drive items here as they are finished. |

## Documentation in this repository

| Document | What it is for |
| --- | --- |
| [`../README.md`](../README.md) | What GrowTH is, the stack, how to run it locally |
| [`../DEPLOY.md`](../DEPLOY.md) | Hosting setup: Neon, Render, Vercel, Resend, Google sign-in |
| [`user-flows.md`](./user-flows.md) | Roles, the permission matrix, a flow for each role, invitations, notifications, edge cases |
| [`diagrams.md`](./diagrams.md) | System architecture and route map |
| [`api.md`](./api.md) | API reference: conventions, capabilities, every route, environment |
| [`tor-compliance.md`](./tor-compliance.md) | Requirement-by-requirement audit and the client-directed changes to sign off |
| [`growth-reference-sources.md`](./growth-reference-sources.md), [`measurement-schedule.md`](./measurement-schedule.md) | Why CDC 2000, and when children should be measured |
| [`ai-integration.md`](./ai-integration.md), [`model-updates.md`](./model-updates.md) | How the bone-age model is run, calibrated and replaced |
| [`sources-register.md`](./sources-register.md), [`research-checklist.md`](./research-checklist.md) | Every external source and the open research questions |
| [`client-questions.md`](./client-questions.md) | Decisions waiting on the client |
| [`process/`](./process/) | Team process notes |

## Still to produce

1. **Parent user manual (D10).** Base it on the parent and caretaker flows in `user-flows.md`, with screenshots from the live app.
2. **Final project report (D10).** It should consolidate the stack justification (TOR §6.1) now spread across `diagrams.md` and `ai-integration.md`.
3. **Model training and evaluation report (D4).** ML team. It must cover the split, which set the MAE comes from, augmentation, and errors by age and sex.
4. **Videos D6 and D8.** Team.
5. **Drive items in this index.** Add each item's exact Drive file and folder name once it is final.
