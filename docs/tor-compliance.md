# TOR compliance audit

Every requirement in `data-knowledge/ProjectBeta_TOR.pdf`, checked against what is built in
`studio5-beta`. Re-audited **2026-10-01** after the assembly: the team's frontend
(`studio5-frontend`), the backend from `project_stu5`, and the client's role changes of
2026-09-30. It supersedes the audit of 2026-08-23 (commit `c15186d` in `project_stu5`).

Status key: 🟢 done · 🟡 partial or deviates · 🔴 not built · ⚪ not our side · ✂️ dropped by the client

**Headline:**

- The software meets 21 of 24 functional requirements outright.
- The other three deviate on purpose: FR-8 (BMI from 2 years) and two client-directed role changes (FR-15 and FR-18).
- Several requirements now differ from the TOR because the client changed the product, not because we fell short. Each one needs a written sign-off. They are listed in §0 so they can be signed in one go.
- The remaining gaps are mostly documents and videos, not code.

---

## 0. Client-directed changes, 2026-09-30

The client described the real product as three kinds of user plus an admin portal. The TOR
assumes one: a parent. These changes are deliberate and built. They need the Client
Representative's written agreement, because each one changes a numbered requirement.

| # | Change | TOR item affected | What the app does now |
| --- | --- | --- | --- |
| C1 | Three per-child roles: **parent**, **caretaker**, **doctor** | FR-4, FR-24 | A parent invites a caretaker or the child's doctor by QR code or email. The link is single-use and expires in 7 days. Access is checked per role on the server (`child-access.ts`). |
| C2 | **Only the doctor uploads X-rays** | FR-15 ("upload … for a selected child" by the user) | Parents and caretakers cannot upload. The doctor uploads, runs the AI, reviews the result and keeps the history. |
| C3 | **Parents and caretakers see bone-age status only** | FR-18 (result with margin of error shown to the user) | Families see the doctor's reading (Normal / Advanced / Delayed) and note. The months, the gap and the margin of error are shown to the doctor. The server strips them from family responses. |
| C4 | **Caretakers do not see puberty results** | FR-13, FR-14 | A caretaker can fill in the questionnaire and sees "submitted". The parent and the doctor are notified in the app and by email, and they see the result. |
| C5 | **Doctor accounts are approved by an admin** | new | A doctor registers with a licence number and hospital. They cannot follow any child until an admin approves them. |
| C6 | **Admin portal** | new (FR-20 content upkeep) | Approve doctors, write and publish articles, one inbox for contact messages and problem reports, usage statistics, anonymised CSV export. |
| C7 | **Find a child by hospital number (HN)** | new | A doctor searches only their own patients. Caretakers never see the HN. |
| C8 | **Promotional work dropped:** D7 promotional video, D9 social clips, and the Home page's promo section | D7, D9 | Removed from the app. No promotional work from now on (D9 confirmed as promotional on 2026-10-01). |

The flows and permission matrix are in `docs/user-flows.md`, and the API is in `docs/api.md`.

---

## 1. Functional requirements (Section 4)

### 4.1 Account and profile

| FR | Requirement | Status |
| --- | --- | --- |
| FR-1 | Register with full name, email, password, **and phone number** | 🟢 **Back in line.** The register form asks for a phone number and it is saved. It can be edited in Profile. It is optional in the form. |
| FR-2 | Terms and privacy accepted before account creation | 🟢 Enforced on the server (`acceptedTerms` must be `true`), on the Google path too |
| FR-3 | Log in and out securely | 🟢 15-minute access tokens and rotating 7-day refresh tokens, stored hashed. A password reset or change signs out every other session. |
| FR-4 | Add child profiles: name, sex, DOB, relationship | 🟢 Plus an optional HN (C7) |
| FR-5 | View, edit, switch between multiple children | 🟢 Caretakers see children grouped by family; doctors search by HN |

ℹ️ **FR-1:** the 2026-08-23 audit flagged that the phone number had been removed. The team's
frontend asks for it again. If the client wants it *required* rather than optional, it is a
one-line change in `RegisterForm.jsx` and `register.dto.ts`.

### 4.2 Growth tracking

| FR | Requirement | Status |
| --- | --- | --- |
| FR-6 | Record a growth entry: date, height, weight | 🟢 Plus head circumference for under-3s. Parent, caretaker and doctor can all record. |
| FR-7 | Percentile and SDS for height-for-age and weight-for-age | 🟢 CDC 2000 LMS, verified byte-exact against the CDC tables |
| FR-8 | **For children aged five and above**, BMI + BMI-for-age SDS + plain-language status | 🟡 **Deviates:** starts at **two** years |
| FR-9 | Line charts for height, weight, BMI vs percentile curves | 🟢 The child's own points over the CDC curves |
| FR-10 | Plain-language guidance after each entry, flagging notable results, not a diagnosis | 🟢 |
| FR-11 | Complete history of past entries | 🟢 Editable and deletable |

⚠️ **FR-8:** BMI starts at 24 months, which is where the CDC table and the AAP Bright
Futures schedule start. At five, three years of valid data were thrown away. This is clinically
better but still a deviation, so put it to the client together with §0.

### 4.3 Puberty screening

| FR | Requirement | Status |
| --- | --- | --- |
| FR-12 | Structured guided questionnaire, appropriate to sex and age | 🟢 Branches by sex; answers are yes / no / not sure |
| FR-13 | Compile into a screening result, labelled as an aid not a diagnosis, with next steps | 🟢 Five outcomes, including "not enough information". Caretakers do not see it (C4). |
| FR-14 | View history of previous screenings | 🟢 Plus the 4-month follow-up plan. Caretakers see their submissions only (C4). |

### 4.4 AI bone age

| FR | Requirement | Status |
| --- | --- | --- |
| FR-15 | Upload a hand-and-wrist X-ray for a selected child | 🟡 **Client-directed (C2):** doctor only. PDF, JPEG, PNG or WebP. The browser renders a PDF, proposes a crop around the film that the doctor can adjust, and downsizes to 2048 px without lossy re-encoding. |
| FR-16 | Validate format and size, clear feedback on failure | 🟢 10 MB cap. Refused files are deleted, not kept. |
| FR-17 | Submit to the model and display the result in reasonable time | 🟡 refine9 runs in-process: about 4.5 s per X-ray on one ARM core. **Not yet measured on Render's free CPU.** The upload returns at once and the page polls; `BONE_AGE_TTA=off` is the 4× faster fallback. |
| FR-18 | Explanatory note: what it means, **its margin of error**, support-not-replace | 🟡 **Client-directed (C3):** the doctor sees the estimate, the real age, the gap and the margin of error (refine9: MAE 7.43 months; 80 % of estimates within 12 months). Families see the doctor's reading with a "discuss with your doctor" note. |
| FR-19 | Associate each prediction with the child profile and growth/screening history | 🟢 Stored against the child with the exam date. The dashboard shows growth, puberty and bone-age status together. |

**AI estimate vs real age.** The gap between the AI bone age and the child's real age is
computed on the server. Both use the same age function (`common/age.ts`, 30.4375-day months),
and the real age is taken **on the exam date**, not the upload date. A gap of more than ±24 months
suggests Advanced or Delayed. A gap of more than 36 months is flagged as implausible, which
usually means a wrong date of birth, a wrong exam date or a bad image.

### 4.5 Knowledge section

| FR | Requirement | Status |
| --- | --- | --- |
| FR-20 | Reference articles, attributed, no copyright infringement | 🟢 Five designed articles with the team's own illustrations, plus Markdown articles that admins write in the portal (C6). Confirm that no illustration is traced from an atlas (§9). |
| FR-21 | Organised and searchable/browsable by topic | 🟢 Search and category filter |

### 4.6 General

| FR | Requirement | Status |
| --- | --- | --- |
| FR-22 | Usable on desktop and mobile, responsive | 🟢 Tested at 390 px in dark mode |
| FR-23 | Plain parent-friendly language, with underlying figures available | 🟢 Figures are shown to whoever is allowed to see them (C3, C4) |
| FR-24 | A user can only access children linked to their own account | 🟢 Every child route goes through `ChildrenService.access(child, user, capability)`, including X-ray bytes. Covered by 24 e2e tests. |

**Score: 21 🟢 · 3 🟡 · 0 🔴.** Two of the 🟡 are client-directed (§0).

---

## 2. Deliverables (Section 5)

| D | Deliverable | Status |
| --- | --- | --- |
| D1 | UX/UI design package: Figma file, exported hi-fi screens, prototype link | 🟡 Figma project on the team Drive; exports in `design/mockups/`. **Add the Figma and prototype links to `docs/deliverables.md`.** |
| D2 | Web application (front end), deployed + repo | 🟢 `studio5-beta.vercel.app`, repo `growthadminsupport-lang/studio5-beta` |
| D3 | Backend, API, database: deployed, documented API, schema docs | 🟢 Render `growth-api` + Neon. Swagger at `/docs`, reference in `docs/api.md`, schema in `backend/prisma/schema.prisma`. |
| D4 | AI model: trained artifact, training + evaluation report with MAE, integrated | 🟡 The ML team's refine9 (EfficientNet-B5) is integrated and released (`model-v2`), with MAE 7.43 months. The Node port is checked against their PyTorch pipeline to within 0.013 months (`ai-service/refine9/README.md`). **No written training/evaluation report yet**, and no independent test set (§3, 6.3). |
| D5 | Doctor interview video | 🟢 `Final Doctor interview ver3.mp4` on the team Drive |
| D6 | 2D motion graphic narrative video | ⚪ Team status. Briefs in `docs/animation-briefs.md`. The logo motion is in the app, but it is not D6. |
| D7 | Application promotional video | ✂️ **Dropped by the client (C8)** |
| D8 | Application demonstration video | ⚪ Team status. Script in `docs/demo-script.md`; the flows in `docs/user-flows.md` are the shot list. |
| D9 | Short-form social clips | ✂️ **Dropped by the client (C8)**, as promotional work |
| D10 | Documentation set: system overview, **user manual for parents**, final report | 🟡 System overview, user flows, API and many technical docs exist. **No parent-facing user manual and no final report yet.** |
| D11 | Source files and handover package | 🟡 Everything is in one repo now. **The handover index is `docs/deliverables.md`**, which still needs the Drive links. |

---

## 3. Technical requirements (Section 6)

| § | Requirement | Status |
| --- | --- | --- |
| 6.1 | Responsive, major browsers, stable URL | 🟢 |
| 6.1 | Stack selected **and justified in the system overview document** | 🟡 Stack matches `data-knowledge/Growth-techstack.jpg`. The justification is spread across `diagrams.md` and `ai-integration.md` and needs consolidating into the D10 overview. |
| 6.2 | Data minimisation | 🟢 Caretakers do not receive HN or results. The admin export has no names, contacts, HN or exact dates. |
| 6.2 | Privacy notice **prior to registration** | 🟢 Linked from the register form. Rewritten on 2026-10-01 for roles, sharing, processors and the export. |
| 6.2 | X-rays stored securely, only accessible to the uploading account | 🟢 Readable only by the child's doctor, through a checked route. They are not static files. **⚠️ Stored on Render's ephemeral disk, so a redeploy loses them** (§5). |
| 6.2 | Passwords never plain text, industry-standard hashing | 🟢 bcrypt |
| 6.2 | Document what data is collected, stored, and deleted on request | 🟢 The privacy notice lists it. Deleting a child or account removes the rows **and** the X-ray and avatar files. |
| 6.3 | Documented train/test split, **no overlap** | 🔴 **No independent test set.** refine9 trained on the 12,611 RSNA training images. Its MAE comes from the 1,425 validation images, which were also used to choose it from nine runs. The RSNA test set (200 images) is the obvious held-out check. |
| 6.3 | MAE in months on held-out test set | 🟡 7.43 months and 80.2 % within a year, on validation rather than held-out test images (above). |
| 6.3 | Document augmentation/preprocessing and observed limitations by age or sex | 🟡 Preprocessing and augmentation are documented in `ai-service/refine9/README.md` and the team's `train.py`: CLAHE, 456 px, rotation ±15°, jitter, flip, and 4-view TTA. **Limitations by age and sex are not.** |
| 6.3 | UI itself presents bone age as a screening aid, not only in docs | 🟢 |
| 6.4 | Video production standards | ⚪ Videos are the team's part |
| 6.5 | Functional testing before each milestone, test record maintained | 🟢 96 unit tests (including the refine9 preprocessing against cv2/torchvision output), 24 API e2e tests (the role matrix over HTTP), and 22 scripted browser flows covering all four roles and a PDF upload. |
| 6.5 | Test on ≥2 browsers and ≥1 mobile viewport | 🟡 Chromium desktop and a 390 px mobile viewport. **Safari and Firefox are not tested yet.** |

---

## 4. Assumptions and constraints (Section 2A)

| Item | Status |
| --- | --- |
| 2A.2: reference dataset **confirmed with the Client Representative** | 🔴 **Still not done.** The app uses CDC 2000. Ask together with §0 (`client-questions.md` Q1). |
| 2A.2: RSNA dataset used under its public licence | 🟢 |
| 2A.3: free/open tooling only, no budget | 🟢 Vercel, Render, Neon and Resend free tiers, all on the GrowTH account |
| 2A.3: not for clinical deployment without further review | 🟢 Stated in the app and the Terms of Use |
| §3.4 / §9: no copyrighted atlas images reproduced | 🟢 for the app's own content. Check the article illustrations (FR-20). |

---

## 5. What to do

**Needs a client decision (one meeting)**

1. Sign off §0, changes C1 to C8.
2. Ratify **FR-8** (BMI from 2 years).
3. Confirm the growth reference under **§2A.2**.
4. Decide whether the phone number should be required (FR-1).

**Needs the ML team**

5. Write the training and evaluation report (D4, §6.3). It must cover:
   - the split
   - refine9's MAE on the RSNA **test** images, which were not used to choose it
   - errors by age band and sex
6. ~~Supply the real `AGE_MEAN` / `AGE_STD`~~ **Resolved 2026-10-01:** refine9 predicts months directly, so no calibration constants are needed and nothing is labelled provisional.

**Ours, small**

7. Test on Safari and Firefox (§6.5).
8. Write the parent user manual and the final report (D10).
9. Add the Drive links (Figma, prototype, D5, logo files) to `docs/deliverables.md` (D1, D11).
10. Time one refine9 prediction on Render after deploying (`inferenceMs` in the logs). If it is too slow, set `BONE_AGE_TTA=off`.
11. Move X-ray storage off the ephemeral disk before real use. Doctors now keep a history, so a redeploy wiping it matters more. A free option is Cloudflare R2 (10 GB free, no egress fees), which fits the existing Cloudflare account.
