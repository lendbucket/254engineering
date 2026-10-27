# Mobile app plan

Robert's instruction, 2026-10-27, 09:15 and 09:18 Central: write the mobile app
plan as a document only. It covers the roles (administrator, engineer, field
technician), the screens for each role, the shared API, sign in with a second
factor, the technician's offline needs, and the publisher as an open question.
No app code.

**Status: a plan. Nothing in it is built, and nothing here changes the platform.**
Every statement about the platform was read against main at `1b01119` on
2026-10-27, and the file or route is named beside it so the next reader can check
it again (CLAUDE.md 2c).

## 1. What the app is for, and what it may say

The portal already works in a phone browser. `src/components/portal/nav.ts` marks
a `primary` set of screens for the phone's bottom bar, and the technician's
capture screen already keeps photographs through a dead zone
(`src/lib/offline-queue.ts`). A native app earns its place only where the browser
falls short:

- **A cold start with no signal.** The offline queue protects a tab that stays
  open. It does not let a technician reopen the portal in a dead zone, and its own
  header says so.
- **The camera and location.** Native capture gives a dependable capture time,
  location and accuracy, and survives the operating system closing a background
  tab.
- **Notifications.** A new offer or a file returned for more evidence reaches the
  technician without an email.

**The gate applies to the app exactly as it applies to the site.** While
`isPrelaunch()` reads true, no screen, store listing, notification or screenshot
may say or imply that the firm performs or seals engineering work today (CLAUDE.md
section 1). The store listing is public copy and goes through the same voice and
placeholder rules as a page. The app renders the platform's own derived
sentences, `firmName()` and `registrationLine()` among them, and types none of its
own.

## 2. Roles and their screens

Roles are rows since 0018. `DEFAULT_ROLES` in `src/lib/ops-authz.ts` is the seed,
and the app reads the signed-in person's grants from the server rather than
carrying its own copy, so a grant changed in `/portal/roles` changes the app with
no release.

### 2.1 Field technician (`field_tech`, lands on `/portal/jobs`)

Grants today: `offers.list_own`, `offers.respond`, `files.list`,
`evidence.capture`, `evidence.start`, `evidence.submit`, `tasks.use`,
`messages.use`, `ledger.read_own`, and their own profile.

| Screen | Portal route today | What it calls |
| --- | --- | --- |
| My jobs: offers and assigned work | `/portal/jobs` | Rendered on the server. Accept and decline go to `POST /api/portal/field` (`accept_offer`, `decline_offer`). |
| A job: checklist, photos, readings, exceptions, submit | `/portal/jobs/[id]` (`CaptureClient.tsx`) | `POST /api/portal/field`: `sign_upload`, `record_capture`, `delete_capture`, `record_exception`, `withdraw_exception`, `submit_evidence` |
| Certification: why work is or is not offered | `/portal/certification` | Rendered on the server |
| Your pay | `/portal/pay` | Rendered on the server |
| Tasks and messages | `/portal/tasks`, `/portal/messages` | `POST /api/portal/comms` |
| Your profile | `/portal/profile` | Rendered on the server |

This role is the reason for the app, and phase 1 is built for it alone.

### 2.2 Engineer (`engineer`, lands on `/portal/review`)

Grants today: `files.list`, `files.update`, `files.transition`,
`evidence.review`, `documents.deliver`, `documents.read`, tasks, messages and his
own ledger and time. His licensed acts are not grants: `holdsLicence` answers them
from the role, so no administrator can grant them.

| Screen | Portal route today | What it calls |
| --- | --- | --- |
| Review queue and a file's evidence | `/portal/review` | `GET` and `POST /api/portal/review` |
| Waiting on owners | `/portal/waiting` | Rendered on the server |
| Responsible charge record | `/portal/charge-log` | Rendered on the server |
| Tasks and messages | `/portal/tasks`, `/portal/messages` | `POST /api/portal/comms` |

**Sealing stays in the browser on purpose, in phase 1 and maybe for good.** The
sealing rulings of 2026-10-06 (CLAUDE.md section 1) require four things. The seal
is applied only from the engineer's own authenticated session with a fresh second
factor. The seal and signature images are readable only by the sealing step. The
document is rendered, hashed and locked at sealing. Every sealing writes to the
audit log. `POST /api/portal/seal` checks the six digit code fresh for that act.
A phone app adds a device that can be lost while signed in, and a second place
where a rendered seal could be cached or captured in a screenshot. Each of the
four controls was mapped to 22 TAC 137.33 and 137.35 against the browser. A
mobile seal would need that mapping done again before any code is written. See
question 3.

### 2.3 Administrator (`admin`, lands on `/portal`)

The administrator holds the widest grant set. Most of it is desk work: price
book, roles, reports, refunds, audit trail. That work belongs on a 1440 pixel
screen under the office ready standard (CLAUDE.md 2d), not on a phone.

| Screen | Portal route today | Why it is on the phone |
| --- | --- | --- |
| Dashboard: what is due now | `/portal` | To see the day's state away from the desk |
| Files and search | `/portal/files`, `/portal/search` | To answer a call about a job |
| Messages and inbox | `/portal/messages`, `/portal/inbox` | To reply in the field |
| Platform status | `/portal/status` | To see an alert's cause |

Nothing that moves money, changes a role, edits the price book or touches
configuration goes in the app. It stays a browser action, behind the session and
second factor the browser already enforces.

## 3. The shared API

**What exists.** Every portal write already goes through a JSON `POST` route
under `src/app/api/portal/`, and each route dispatches on an `action` field. For
the technician that is `/api/portal/field`, and for the engineer it is
`/api/portal/review` and `/api/portal/seal`. These are reusable as they stand:
they take JSON, check the actor's grant on every call, and answer
`{ ok, error }`.

**What is missing.**

1. **Reads.** Most screens are rendered on the server, so their data never
   travels as JSON. The technician's job list, a job's checklist, certification
   status and pay all come from server functions in `ops-field.ts` and
   `ops-evidence.ts`. The app needs read routes for those, each calling the same
   function the page calls, so the two cannot disagree.
2. **A session a native client can hold.** See section 4.
3. **Versioning.** Today the portal and its routes ship together, so they cannot
   disagree. An app on a phone can run an old build for weeks. Mobile routes need
   a version in the path, or a header the server refuses when the version is too
   old. A refusal should say "update the app" in plain words, never fail with no
   explanation.
4. **Push notifications.** No route registers a device today.

**What it must not do.** The app holds no database credential. The portal never
has: there is no anon key and no `NEXT_PUBLIC_SUPABASE_URL` in this repository,
every `eng_` table has row level security with no policies, and
`src/lib/ops-session.ts` records why. The app talks only to the platform's own
routes, never to Supabase.

## 4. Sign in with a second factor

**Today.** The password is checked against Supabase Auth, and the server then
mints its own HMAC signed cookie, `eng_ops`, carrying the user id, the role and an
expiry (`src/lib/ops-session.ts`). A full session lasts twelve hours, and a half
authenticated one, waiting on the second factor, lasts ten minutes. The role in
the cookie is a cache: every route reloads the profile, so a suspension takes
effect at once. The second factor is TOTP, six digits every 30 seconds
(`src/lib/totp.ts`, pinned in CLAUDE.md 6c).

**Who must use it.** `eng_roles.mfa_requirement` is required for the engineer
(0070) and for the administrator, operations manager and rep (0093). The field
technician is optional, the default from 0024 (see question 5).

**What a native client needs, as a design question rather than a choice.** A
cookie works inside a web view, and a native screen needs a token it can store.
Whatever is chosen must keep four properties the cookie has today:

- It is signed by the platform, not by Supabase.
- Its role is re-read on every call.
- It expires on the same twelve hour clock.
- Rotating `OPS_SESSION_SECRET` ends it.

The token is stored only in the operating system's secure keystore.

**Device loss and revocation.** Today a session can be ended only by its expiry or
by rotating the secret, which signs everybody out. A phone that can be lost needs
a per device record that the administrator can revoke from `/portal/people`. It
must take effect on the next call, the same way a suspension does now.

## 5. Offline needs for the technician

**What must work with no signal.**

- **The day's jobs**, with each job's address, its checklist from the protocol in
  force, and the photo procedure. All of it is downloaded while the technician has
  signal, before they leave.
- **Capture**: photographs, readings, measurements, documents, notes and
  exceptions, each queued with its capture time, location and accuracy. The
  browser queue already does this with IndexedDB (`src/lib/offline-queue.ts`),
  and the app keeps its rules:
  - The capture id is minted on the device, so a retry updates rather than
    duplicates. The unique index on `(file_id, client_capture_id)` enforces this.
  - The phone sends its own clock at the moment it syncs, so a photograph that
    waited for signal is not reported as a clock fault. This is proven by
    `scripts/proofs/a-queued-photo-is-not-a-clock-fault.mjs`.
  - An exception rides the same queue, because the item most likely to need one
    is the one where there is no signal.

**Conflict rules.**

- A capture is the technician's statement and is never overwritten by the server.
- A job reassigned or withdrawn while the phone was offline is refused at sync.
  The refusal names the job, and the captures stay on the phone until somebody in
  the office decides.
- A checklist whose protocol changed while the phone was offline is refused at
  submission, never merged.

**What is never done offline.**

- Submitting evidence for review. It needs the server to confirm that every
  required item arrived.
- Accepting or declining an offer.
- Anything that moves money.
- Anything licensed. Sealing, voiding and recording a determination are not on
  the phone at all in phase 1, and are never offline.

## 6. A lost phone

- **Encryption.** The queued photographs and the downloaded jobs hold customer
  addresses and photographs of their property. They are stored inside the app's
  encrypted storage, never in the shared photo library.
- **Clearing data.** The app clears its cached jobs at sign out and when a session
  is revoked.
- **The app lock.** A biometric or device passcode lock on opening the app is a
  convenience on top of the second factor, and never a replacement for it.

## 7. The publisher, an open question for Robert

Both stores show the publisher's name on the listing, and both ask an
organization account for a D-U-N-S number in that name.

- **The firm.** The firm on the board's record is 254 Engineering LLC (the
  register in `src/config/credentials.ts`, read through `firmName()`).
- **The brand.** "254 Engineering" is the brand on the wordmark, and the listing
  would carry the brand as the app's name.
- **The brand rule.** No partner or other entity may operate under a 254 mark.
  That points to the firm itself as the publisher, rather than a holding company
  or a developer's account.

**Question 1, the publisher.** Which legal entity publishes the app?
**Recommendation:** 254 Engineering LLC, under its own organization accounts at
Apple and Google, with its own D-U-N-S number, and the app named "254
Engineering". A publisher name that differs from the firm on the board's record
would be the same mismatch section 1 of CLAUDE.md exists to prevent: a reader
checking who stands behind the app would find a different name.

## 8. Other questions, each with a recommendation

2. **Native app, or the portal installed as a web app first?**
   **Recommendation:** first, make the portal installable with offline start. That
   is the backlog item `src/lib/offline-queue.ts` names. It closes the cold start
   gap with no store, no publisher and no second code base, and it tells us
   whether the native camera is still needed.
3. **Sealing on the phone.**
   **Recommendation:** no, until the four sealing controls have been mapped again
   for a phone and Robert has ruled on that mapping. The engineer reviews on the
   phone and seals at the desk.
4. **Which roles get the app in phase 1?**
   **Recommendation:** the field technician only, then the engineer's review queue
   without sealing, then the administrator's read-only views.
5. **A second factor for the field technician.** It is optional today, and the
   app would hold customer addresses and photographs on a device that can be lost.
   **Recommendation:** required for any technician who signs in on the app, by a
   migration, posted for a sitting like any other.
6. **Push notifications.**
   **Recommendation:** new offers and returned evidence only. Nothing about money,
   and nothing that could read as a service claim while the gate is shut.

## 9. Phase order

1. **Read routes for the technician**, each calling the function its page already
   calls, with a proof that the page and the route return the same thing. It also
   needs a versioning rule and a per device session that can be revoked.
2. **The installable portal with offline start** (question 2), measured on a real
   phone in a dead zone.
3. **A native technician app**, if phase 2 leaves a gap, with the publisher ruled
   (question 1) and the second factor required (question 5).
4. **The engineer's review queue** on the phone, without sealing.
5. **The administrator's read-only views.**

Each phase is a branch with its own board, and every new route goes into the
declared inventories in `docs/new-surface-checklist.md` before it is written.
