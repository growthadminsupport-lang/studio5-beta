# GrowTH user flows

How each kind of user moves through GrowTH, and what each is allowed to see and do. This is the
design the backend and frontend are built against, so review it before the code. It records what
the client asked for on 2026-09-30, which differs from the TOR in places; those differences are
listed at the end.

Rendered copies of every diagram, for slides and reports, are in [`user-flows/`](user-flows/)
(SVG and PNG).

## 1. Who uses GrowTH

| User | Who they are | How they get access to a child |
| --- | --- | --- |
| **Parent** | The child's parent or legal guardian | Creates the child profile |
| **Caretaker** | Nanny, grandparent, teacher: someone who looks after the child day to day | Invited by the parent (QR code or email) |
| **Doctor** | The child's own doctor | Invited by the parent, after an admin has approved the doctor's account |
| **Admin** | GrowTH staff | Separate admin portal; never sees an individual child's record |

A person can have different roles for different children: a parent of their own child can be a
caretaker for a niece. The role belongs to the **link between a person and a child**, not to the
account. The only account-level roles are *doctor* (because it must be approved) and *admin*.

## 2. What each role can do

| For one child | Parent | Caretaker | Doctor |
| --- | --- | --- | --- |
| Create the child, edit details, delete the child | ✅ | ❌ | ❌ (can set the HN) |
| Invite a caretaker or doctor, remove people | ✅ | ❌ | ❌ |
| **Growth**: add, edit, delete measurements; see charts and history | ✅ | ✅ | ✅ |
| **Puberty**: fill in the questionnaire | ✅ | ✅ | ✅ |
| **Puberty**: see the result, past results and the follow-up plan | ✅ | ❌ sees "Submitted" only | ✅ |
| **Bone age**: upload an X-ray, run the AI, edit the record | ❌ | ❌ | ✅ |
| **Bone age**: see the result | Status only | Status only | Full |
| How they find the child | Their child cards | Child cards, grouped by family | Search by **HN** |

**"Status only"** means the parent and caretaker see:

- the exam date,
- the doctor's status: **Normal**, **Advanced** or **Delayed** for the child's age,
- the doctor's note,
- "Please discuss this result with your doctor."

They do not see the estimated bone age in months, or the X-ray itself.

**Why the caretaker cannot see puberty results:** the result is sensitive and is the parent's to
read first. When a caretaker submits a questionnaire, the parent and the doctor are notified and
read the result themselves.

These rules are enforced by the server, not only hidden in the screen: a caretaker's request for
a puberty screening comes back without the result, and a parent's request for a bone-age record
comes back without the number or the image.

## 3. Parent

```mermaid
flowchart TD
    A([Open GrowTH]) --> B{Has an account?}
    B -- No --> C[Register: name, email, phone, password<br/>accept Terms and Privacy Notice]
    B -- Yes --> D[Log in: email + password, or Google]
    C --> E[Dashboard]
    D --> E
    E --> F{Any children yet?}
    F -- No --> G[Add child: name, sex, date of birth,<br/>relationship, HN optional]
    G --> H
    F -- Yes --> H[Pick a child card]
    H --> I[Child profile]
    I --> J[Growth]
    I --> K[Puberty]
    I --> L[Bone age]
    I --> M[People]

    J --> J1[Add height, weight, date<br/>head circumference if under 3]
    J1 --> J2[See percentile, SDS, BMI from age 2<br/>and plain-language guidance]
    J2 --> J3[Charts against CDC reference curves<br/>history: edit or delete an entry]

    K --> K1[Answer the questions for the child's sex and age<br/>Yes / No / Not sure]
    K1 --> K2[See result and next steps<br/>screening aid, not a diagnosis]
    K2 --> K3[Follow-up plan and past results]

    L --> L1{Any record from the doctor?}
    L1 -- No --> L2[Explains the doctor uploads the X-ray<br/>link to invite the doctor]
    L1 -- Yes --> L3[Status card: exam date, Normal / Advanced / Delayed,<br/>doctor's note]

    M --> M1[Invite caretaker or doctor]
    M1 --> M2[Show QR code, copy link,<br/>or send to an email address]
    M --> M3[See who has access<br/>remove a person]
```

## 4. Caretaker

```mermaid
flowchart TD
    A([Scan the parent's QR code<br/>or open the email link]) --> B[Invitation page:<br/>child's first name, invited by, role Caretaker]
    B --> C{Logged in?}
    C -- No --> D[Log in or register] --> E
    C -- Yes --> E[Accept invitation]
    E --> F[Dashboard: children grouped by family]
    F --> G[Pick a child]
    G --> H[Growth: add a measurement,<br/>see charts and history]
    G --> I[Puberty: fill in the questionnaire]
    I --> J[Screen: Submitted.<br/>The parent and doctor have been notified.]
    J -. notification .-> P[Parent]
    J -. notification .-> Q[Doctor]
    G --> K[Bone age: status card only]
```

## 5. Doctor

```mermaid
flowchart TD
    A([Register as a doctor:<br/>name, email, phone, license number, hospital]) --> B[Account pending approval]
    B -. admin reviews .-> C{Approved?}
    C -- No --> C1[Rejected: shown the reason,<br/>can contact support]
    C -- Yes --> D[Doctor dashboard]
    E([Parent's QR code or email link]) --> F[Invitation page, role Doctor]
    F --> G{Approved doctor?}
    G -- No --> G1[Cannot accept yet:<br/>waiting for approval]
    G -- Yes --> H[Accept: child added to patient list]
    H --> D
    D --> I[Search patients by HN]
    I --> J[Open the child]
    J --> K[Growth: add or review]
    J --> L[Puberty: fill in or read results and plan]
    J --> M[Bone age]
    M --> M1[Upload hand-and-wrist X-ray<br/>JPEG or PNG, up to 10 MB]
    M1 --> M2[AI estimates the bone age<br/>shown with its margin of error]
    M2 --> M3[Doctor sets exam date, status<br/>Normal / Advanced / Delayed, and a note.<br/>The AI suggests the status; the doctor decides.]
    M3 --> M4[Save to the child's history]
    M4 -. notification .-> P[Parent and caretakers:<br/>a new bone-age result is available]
    M --> M5[History: open, edit, replace the X-ray, delete]
```

The AI's suggested status comes from the gap between bone age and the child's real age (two years
or more either way). That cut-off is not yet backed by a clinical source (see
`docs/product-flow.md`), which is one reason the doctor, not the AI, makes the final call.

## 6. Admin portal

```mermaid
flowchart TD
    A([Admin logs in]) --> B[Admin portal]
    B --> C[Doctors: pending list<br/>license, hospital]
    C --> C1[Approve or reject with a reason]
    C1 -. notification .-> D[Doctor]
    B --> E[Articles: create, edit, publish, unpublish<br/>title, category, body, sources]
    B --> F[Inbox: Contact messages and Problem reports]
    F --> F1[Read, reply by email, mark resolved]
    B --> G[Usage: users by role, children,<br/>growth entries, screenings, X-rays per week]
    B --> H[Export CSV]
    H --> H1[Anonymised: no names, emails, phone numbers or HN]
```

An admin manages the service, not the children. The portal has no screen that opens a child's
record, and the export contains no identifying details.

## 7. Invitations

```mermaid
sequenceDiagram
    actor P as Parent
    participant App as GrowTH
    actor I as Caretaker or doctor
    P->>App: Invite for child X, role Caretaker or Doctor (email optional)
    App-->>P: Link and QR code, valid 7 days, single use
    App-->>I: Email with the link (if an email was given)
    I->>App: Open link
    App-->>I: Preview: child's first name, invited by, role
    I->>App: Log in or register, then Accept
    App->>App: Check: not expired, not used, not revoked.<br/>Doctor role needs an approved doctor account.
    App-->>I: Child appears on their dashboard
    App-->>P: Notification: invitation accepted
```

- One link can be used once. To add two caretakers, the parent creates two invitations.
- The parent can cancel an unused invitation, and remove anyone who has access.
- The preview shows only the child's first name, so a leaked link reveals as little as possible.

## 8. Notifications

| When | Who is told | How |
| --- | --- | --- |
| A caretaker submits a puberty questionnaire | Parent(s) and doctor(s) | In the app and by email |
| A doctor saves or updates a bone-age result | Parent(s) and caretaker(s) | In the app and by email |
| Someone accepts an invitation | The parent who sent it | In the app |
| An admin approves or rejects a doctor | That doctor | In the app and by email |

## 9. Edge cases

| Situation | What happens |
| --- | --- |
| Invitation expired, already used, or cancelled | Invitation page explains which, and asks the parent to send a new one |
| Doctor opens an invitation before approval | Cannot accept; told it will work once approved. The link stays valid until it expires |
| Someone opens a doctor invitation with a normal account | Told this invitation is for a doctor account |
| Parent removes the doctor | Doctor loses access immediately. The bone-age records they made stay with the child |
| Parent deletes the child | Every caretaker and doctor loses access; the records are deleted |
| Two HNs look alike | The doctor only searches their own patients, so they cannot reach another doctor's child |
| X-ray unreadable, or the model is offline | The record is saved as failed with the reason; the doctor can retry |

## 10. Where this differs from the TOR

Asked for by the client on 2026-09-30. These need the Client Representative's written agreement
and are also recorded in `docs/tor-compliance.md`.

| TOR | TOR says | Now |
| --- | --- | --- |
| FR-15 | The parent uploads the X-ray | Only the child's doctor uploads it |
| FR-13, FR-14 | The user sees the puberty result and history | Parents and doctors do; caretakers see "Submitted" only |
| FR-18 | The bone-age result is shown with its margin of error | The doctor sees the estimate and margin of error; parents and caretakers see the doctor's status |
| §4.1 | One kind of user (the parent) | Parent, caretaker, doctor, plus an admin portal |
| D7 | Application promotional video | Removed from scope by the client |
