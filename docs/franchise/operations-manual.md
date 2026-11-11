# Operations manual and brand standards, assembled from the repository (FR7)

**Status: an internal working draft for Robert and his franchise attorney. Not an offer, and not
for a prospect.** FR13 stands: no franchise promises to anyone before the FDD issues.

**How it was assembled.** Robert's overnight order 2a of 2026-11-10 asked for the manual to be
built from what the repository already holds: protocols, academy courses, portal workflows,
content rules, NAP and GBP standards, and the firm line. Nothing here is invented.
- Each section states the rule as the repository states it and names the file that holds it.
- Where the repository says nothing, the section says so and lists it as a gap for Robert.
- The files are the authority. If this manual and a file disagree, the file wins, and this
  manual is the defect.

Written at main `0c67e0cb`.

## 1. The firm line: the registrant named beside the engineering

- **The registrant and its number, as one pair.** 254 Engineering LLC holds TBPELS firm
  registration F-29811, active until 2027-07-31 (`src/config/credentials.ts`).
  - The line the site prints is derived by `registrationLine()` in `src/lib/launch.ts`: "254
    Engineering LLC, TBPELS Firm F-29811".
  - The rule (`CLAUDE.md` section 1): **the number is only ever printed beside the name the
    register holds, and it is derived rather than typed** so it cannot be printed beside anything
    else.
- **The line a referral partner shows,** derived by `referredWorkLine()` in
  `src/lib/referred-work-line.ts`, Robert's ruling of 2026-11-08: "Referred work will be
  performed and sealed by 254 Engineering LLC, TBPELS Firm F-29811." It is in the future tense in
  every state of the launch gate, on his word, so it never becomes a present tense claim.
- **Regulated words.** "Engineer", "engineering" and "sealed" are regulated terms in Texas, and
  every sentence containing them is load bearing (`CLAUDE.md` section 1).
- **Partners and the 254 marks.** A partner works under its own name only, with the firm's
  registration disclosed, and never under a 254 mark (Robert's ruling on the partner program;
  `docs/audit-2026-10/FINDING-partners-under-a-254-mark-2026-10-15.md`).

**Gap for Robert: what a franchisee may say in its own name and advertising.** That is the TBPELS
opinion letter, FR1, which has not been requested. Until it is back, this manual states no
franchisee firm line.

## 2. Name, address, phone (NAP)

- **One home.** `src/config/contact.ts` is "the one place any of them may come from". The site,
  the schema.org markup, email footers, the capability statement and the Google Business Profile
  read it.
- **The phone** is held in E.164 and set by the `FIRM_PHONE` environment variable.
  - Display formatting is derived, never stored.
  - `e164Phone()` derives the value the structured data publishes.
- **The office:** 11103 San Pedro Ave, San Antonio, Texas 78216.
  - Hours, Monday to Sunday, 8:00 to 20:00, Central time.
  - The office moved to San Antonio on 2026-10-29 (`CLAUDE.md` section 2).
- **Location pages.** One per open office with a real street address, today `/san-antonio`
  (operator ruling of 2026-10-29).
  - `/corpus-christi` is a highlighted market. It prints no street address and claims no office
    until its address is set.
  - A page for a city the firm merely covers is the doorway pattern and is not built.

**Gap for Robert: a franchisee's office NAP.** The repository has no record of a franchisee's
name, address or phone. Platform items X1 (the franchisee tenant) and X5 (brand standards in the
product) are where it would live, and neither is on main.

## 3. Google Business Profile

From `docs/gbp-brief.md`.

- **Do not create the profile yet** (its section 1).
- **Never on the profile** (its section 4):
  - any statement that engineering services are currently offered or performed while the gate is
    shut;
  - any turnaround promise for sealed work;
  - any PE name, licence number or firm registration number not in `src/config/credentials.ts`;
  - any solicited or fabricated review;
  - any photograph that is not of the firm's own work, premises or people.
- **The description,** ready to paste, is in its section 5. It states capability rather than
  current service.

**Gap for Robert: franchisee profiles.** Whether a franchisee runs its own profile, under which
name, and who controls it. The repository is silent, and the answer depends on FR1.

## 4. Content and voice

Every rendered string follows the style laws in `CLAUDE.md` section 3:
- no long dashes, and no hyphen standing in for a comma or a colon;
- no emojis;
- nothing on the blocklist in `scripts/lib/voice-blocklist.mjs`;
- nothing fabricated: a number that cannot be traced to a primary source is called unverifiable.

The voice is direct, declarative and specific: an expert explaining plainly.

- **The regulatory gate** (`CLAUDE.md` section 1): until it opens, nothing may state or imply that
  engineering services are currently offered or performed. There are no turnaround promises for
  sealed work, and no invented credentials, counts, client examples or years of experience.
  `scripts/voice-audit.mjs` flags present tense service claims mechanically.
- **Articles** follow `docs/content-standard.md`:
  - the answer in the first 50 words;
  - question headings held to 40 percent of a page's headings;
  - one table;
  - primary sources, read in full before citing;
  - a visible Updated date from git history;
  - FAQPage markup built from the visible questions;
  - a link to order.
- **Three brands, one prohibition.** No page may share substantial copy, structure, headings or
  paraphrase with a sibling page on the same subject (`CLAUDE.md` section 2).
- **Reviews.** No review or rating markup until real third-party reviews exist (`CLAUDE.md`
  section 4).

**Gap for Robert:** whether a franchisee publishes any content of its own, and through what.
Nothing in the repository provides for it.

## 5. Visual brand

- `docs/design-v10/DESIGN_V10.md` holds the colour tokens and the typefaces (Robert's ruling of
  2026-09-29).
- `docs/PORTAL_DESIGN_STANDARDS.md` keeps everything else in force: voice, product truths,
  accessibility, the dash rule, shape and spacing.
- `DESIGN_SPEC.md` records the accessibility deviations.
- **Gold is an accent and never body text on a light surface,** and AA contrast wins wherever a
  design and accessibility disagree (`CLAUDE.md` section 2b).

## 6. Field operations

### The protocols

Every service line runs on a protocol the engineer of record signs in the portal. A protocol
signed there needs no scan, and any change to its text after signing voids it. Transcriptions
are carried verbatim, punctuation included (`CLAUDE.md` sections 1 and 3).

Transcribed in `src/content/protocols/`:

| Document | Title |
| --- | --- |
| 254-RC-001 | Roof Certification Protocol for Existing Roofs |
| 254-WS-001 | Windstorm Certification Protocol for Completed Construction (Form WPI-8E) |
| 254-WP-001 | Windstorm Inspection Protocol for Certificates of Compliance (Form WPI-8), Ongoing Construction |
| 254-MH-001 | Manufactured Home Foundation Certification Protocol |
| 254-RS-001 | Repair Specification Protocol for Existing Structures |
| 254-SL-001 | Solar Structural Letter Protocol for Existing Roofs |
| 254-FC-001 | Foundation Certification Protocol for Existing Foundations |
| 254-DS-001 | Structural Design Protocol for Residential and Light Commercial Work |
| 254-PL-001 | Structural Letter Protocol for Permits |

**Which are signed and in force is read from the signed record in the database, never from the
repository** (operator ruling 11, 2026-10-06), so this manual does not state it.

### Training: the academy

`src/content/academy/courses.ts`:

- **Duties, responsibilities and the signed protocols.** One lesson per protocol: roof
  certification and its photo procedure, WPI-8E completed construction, manufactured home
  foundation certification, solar structural letter, structural letter for a permit, repair
  specification, WPI-8 ongoing construction, and foundation certification.
- **Ladder use and fall protection on roofs.** Choosing and inspecting a ladder, setting up and
  climbing it, fall protection on low-slope and steep roofs, and training, certification of
  training and retraining.

A technician is certified on a protocol through workflow 254-WF-031 (`docs/workflows.md`). The
launch gate requires somebody trained on each protocol version in force for an offered line.

### A technician's onboarding

`src/content/onboarding-checklists.ts`:
- a vehicle insurance card or declarations page;
- a general liability certificate, or the waiver acknowledged instead;
- the firm's errors and omissions declarations page acknowledged;
- a W-9 recorded as held by Gusto, which stays a dispatch blocker (operator ruling of 2026-10-02).

### The job, start to finish

`docs/workflows.md`:

| Workflow | Name |
| --- | --- |
| 254-WF-010 | Dispatch a file to a technician |
| 254-WF-029 | Take an offered job |
| 254-WF-030 | Capture on site and submit the evidence |
| 254-WF-033 | Review a file and seal its letter (the engineer) |

- A photograph's hash is taken at capture.
- The server hashes the stored bytes and refuses a mismatch.
- A store app photograph stays in the app and never reaches the phone's photo library
  (`docs/mobile-store-build.md`).

**Gap for Robert:** how the engineer directly supervises technicians a franchisee employs (FR1 and
FR10), and the supervised inspections each franchisee's technicians need before dispatch.

## 7. Office operations

`docs/workflows.md` maps 36 workflows by role, from first contact to records retention:

- **Customer:** 254-WF-001 to 006.
- **Rep:** 007 to 014. The inbox, telephone orders, chasing what a job is missing, dispatch, the
  sales list, refunds, lookups, tasks and messages.
- **Operations manager:** 015 to 019. Deciding refunds, bringing on a technician, credentials and
  training, the firm's insurance, reports.
- **Administrator and owner:** 020 to 028. Staff accounts, second factor sign in, customer
  accounts, mending an order, opening the firm for work, production pay, keeping the platform
  running, retention and suppressions, the partner program.
- **Field technician:** 029 to 031.
- **Engineer:** 032 to 034.
- **Partner:** 035 and 036.

Every staff screen is held to the office-ready standard in `CLAUDE.md` section 2d: lists that
sort, filter, search and page; one global search; telephone links; a home screen per role; no
refresh; plain words; measured speed; print and CSV.

## 8. The engineer, and money

- **Sealing** (operator ruling of 2026-10-06, `CLAUDE.md` section 1):
  - only the engineer's own session, with a second factor, applies his seal;
  - no administrator path exists;
  - the document is hashed and locked at sealing;
  - every sealing is written to the append-only audit log.
- **The engineer sees no money except his own pay** on files assigned to him (`CLAUDE.md`
  section 6b-i).

**Gap for Robert:** what a franchisee owner may see. Platform item X2 proposes no firm money, no
other territory, no sealing and no price changes. It is not on main.

## 9. Records

- **The audit log is append-only.** Regulatory and financial tables refuse deletes at the database
  (`CLAUDE.md` section 6b).
- **Retention** is declared in `src/lib/retention-policy.ts`. Only machine telemetry may be
  deleted, with a 30 day floor (`CLAUDE.md` section 6c).

## Gaps for Robert, in one list

1. The franchisee firm line: what a franchisee may say in its own name (FR1).
2. A franchisee's office NAP, and where it is held (X1, X5).
3. Franchisee Google Business Profiles: whether, under which name, and who controls them.
4. Franchisee content: whether a franchisee publishes any.
5. Supervision of franchisee technicians by the engineer, and their supervised inspections
   (FR1, FR10).
6. What a franchisee owner may see in the portal (X2).
7. An owner's initial training program: hours, place, and who teaches it. The academy's two
   courses are technician courses.
