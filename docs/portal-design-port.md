# Porting the approved portal design

Gate 0. The inventory, the truth verification, and what I propose for each
difference. Nothing has been styled.

The design is `design-reference/portal/254 Portal v2.dc.html`, 23 screens. Its
standards file is copied into the repository as `docs/PORTAL_DESIGN_STANDARDS.md`
and is the design authority for every portal surface from here.

**Why this document exists at all.** The design was drawn against a description
of the platform rather than against the platform, which is the right way to
design and the wrong thing to build from unexamined. Two of the six product
truths its standards file states are not true as built, and one of those two is
rendered as a column on a regulatory screen. A screen that states something
untrue is the failure this repository is most careful about, so the checking
came before the styling.

---

## 1. The truth verification

Six claims, checked against the code and the schema rather than against memory.

### TRUE: technicians are paid flat rate on submission, independent of the engineer's decision

`submitEvidence` in `src/lib/ops-field.ts:1208` writes the pay ledger row the
moment evidence is submitted, before any engineer has looked at it:

```
const { data: offer } = await db.from("eng_assignments")
  .select("tech_id, offer_amount_cents").eq("file_id", fileId).eq("state", "accepted")
...
await db.from("eng_tech_pay_ledger").insert({ ... amount_cents: offer.offer_amount_cents ... })
```

Nothing in the engineer's decision path touches `eng_tech_pay_ledger`. The only
other writers are the reads on the dashboard and roster, and `setLedgerStatus`,
which is an operator action. A unique partial index makes a replayed submit a
no-op rather than a second payment.

**One nuance the design already gets right and the standards file does not.**
The entitlement is *written* on submission; it is not *paid* on submission. The
row lands as `status: 'pending'` and an operator moves it to `approved` and then
`paid`. The prototype's technician pay screen says "Flat rate per job, written on
submission", which is exactly correct. The standards file says "paid", which is
not. Port the screen's wording, not the standards file's.

### PARTLY TRUE: engineer decisions are equal weight and pay the same

Equal weight: true in the sense that matters. `refundFor` in
`src/lib/ops-orders.ts` is written so a refusal never earns the firm more than a
seal, and `order-audit` enforces three invariants about it, one of which exists
precisely so an engineer is never deciding under financial pressure.

"Pay the same" cannot be verified, because **there is no engineer pay ledger.**
`eng_files.engineer_cost_cents` is a per file figure used for margin reporting.
There is no `eng_engineer_pay_ledger` table, no accrual on decision, and no
engineer equivalent of the technician's pay screen. So the statement is not
false, it is unimplemented: nothing pays engineers differently because nothing
pays engineers at all yet.

### PARTLY TRUE, AND THE SCREEN WOULD BE WRONG: declines refund everything except the disclosed $175 inspection fee

The rule as ruled and as built has **three** cases, not one, and the fourth was
added in Phase 7:

| What happened | The customer receives |
| --- | --- |
| Declined before any visit or review | **Full refund. Nothing retained.** |
| Declined after desk review, no visit | **Full refund. Nothing retained.** |
| Declined after a technician visited | Refund less the inspection fee, plus the engineer's findings |
| Cancelled by the firm | **Full refund**, including any inspection that had already happened |

The standards file's sentence describes only the third row and states it as the
rule for all declines. Rendered as written, a customer facing screen would tell
somebody who was declined without a visit that $175 was retained, when the
platform refunds them in full.

`$175` is also not a global constant. `inspectionFeeCents: 17500` is set per
catalog entry and appears on two service lines. A screen hard coding it would be
wrong the first time a third line carries a different fee, and the copy already
handles the case where the fee is not published at all.

### TRUE: protocols are versioned and a file is governed by the version it was captured under

`eng_protocol_templates` carries `version integer not null default 1` with
`unique (service_slug, version)`. `eng_files.protocol_template_id` references it
`on delete restrict`, added in 0002 with a comment saying why: a file mid capture
whose protocol vanished would show an empty checklist and a submit button that
refuses to explain itself. A file points at one template row, that row is one
version, and it cannot be removed from under the file.

### HALF TRUE, AND THE FALSE HALF IS ON A SCREEN: the responsible charge log is append only and embeds an evidence hash per decision

**Append only: true.** `eng_responsible_charge_log` carries
`eng_rcl_immutable before update or delete ... execute function eng_forbid_mutation()`.
`migration-audit` replays it and asserts the refusal.

**Evidence hash per decision: false. Nothing computes one, and nothing stores
one.** There is no hash column on that table. Every occurrence of "hash" in the
schema is a credential: `invite_token_hash`, `token_hash`, `key_hash`, and the
scrypt password hash. There is no evidence hashing anywhere in the codebase.

The prototype's Responsible charge log screen has an **Evidence hash** column and
this footnote:

> Each entry embeds a hash of the evidence set exactly as it stood at the moment
> of the decision. Entries cannot be edited or removed.

The second sentence is true. The first is not. This is the single most important
finding at this gate: it is a fabricated cryptographic assurance, on the one
screen whose entire purpose is to be the regulatory record an engineer's licence
stands on, and the value shown would be invented.

### FALSE: roles are owner, engineer, technician and dispatcher

`ROLES` in `src/lib/ops-authz.ts` is `["admin", "engineer", "field_tech"]`, three
roles, labelled Administrator, Professional Engineer, Field Technician. There is
no dispatcher role and no owner role. Dispatch is a capability inside the admin
role, surfaced by `DispatchPanel` on a file, not a person who signs in.

The prototype mentions "Dispatcher" twice, both in the permissions matrix on the
unbuilt Settings screen.

---

## 2. The screen inventory

23 screens. Routes are under `/portal` unless stated.

| # | Screen | Route | Verdict |
| --- | --- | --- | --- |
| 1 | Sign in | `/portal/login` | EXISTS |
| 2 | Owner dashboard | `/portal` | EXISTS WITH DIFFERENCES |
| 3 | Engineer dashboard | `/portal` (role branch) | EXISTS WITH DIFFERENCES |
| 4 | Review queue | `/portal/review` | EXISTS WITH DIFFERENCES |
| 5 | Production | `/portal` (engineer ledger) | EXISTS |
| 6 | Engineer messages | `/portal/messages` | EXISTS |
| 7 | Responsible charge log | `/portal/charge-log` | EXISTS WITH DIFFERENCES |
| 8 | Protocols | `/portal/protocols` | EXISTS |
| 9 | Sealed letter | `/portal/documents` (document sheet) | EXISTS WITH DIFFERENCES |
| 10 | Evidence package | `/portal/review/[id]` | EXISTS |
| 11 | Technician home | `/portal` (technician branch) | EXISTS |
| 12 | Technician checklist | `/portal/jobs/[id]` | EXISTS |
| 13 | Technician jobs | `/portal/jobs` | EXISTS |
| 14 | Technician messages | `/portal/messages` | EXISTS |
| 15 | Technician pay | none | EXISTS WITH DIFFERENCES |
| 16 | Owner mobile | `/portal` at 390 | EXISTS |
| 17 | Engineer mobile | `/portal` at 390 | EXISTS |
| 18 | Technician onboarding | `/onboarding/[token]` | EXISTS |
| 19 | Public site | `/` | OUT OF SCOPE |
| 20 | Customer order | `/order/start/[slug]` | EXISTS |
| 21 | Customer tracking | `/order/[reference]` | EXISTS |
| 22 | 403 | none | NOT BUILT |
| 23 | 404 | `/portal` not-found | EXISTS WITH DIFFERENCES |

### The owner navigation does not match

The prototype's sidebar is Dashboard, Files, Dispatch, Clients, Billing, Reports,
Tasks, Compliance, Messages, Roster, Settings. Against the shipped `NAV`:

| Prototype item | Reality |
| --- | --- |
| Dashboard, Files, Clients, Billing, Tasks, Messages | EXIST |
| Dispatch | NOT a route. `DispatchPanel` is a panel on a file. |
| Roster | EXISTS as Technicians and People, split in two |
| Compliance | NOT a route. Nearest are Audit trail and Responsible charge. |
| Reports | NOT BUILT |
| Settings | NOT BUILT |

And the shipped nav has eleven items the prototype does not draw at all:
Certification, Documents, Orders, Accounts, Protocols, Onboarding, Job queue,
Platform status, Audit trail, Your profile, My jobs.

The prototype is a design for a smaller platform than the one that exists. That
is not a criticism of it; it means the port cannot be a one to one mapping and
the sidebar has to be rebuilt from the real `NAV` in the design's visual
language.

---

## 3. Every difference, and what I propose

Ordered by what it costs to get wrong.

### 3.1 The evidence hash column. Proposal: DROP THE ELEMENT.

Drop the column and rewrite the footnote to say only what is true: entries cannot
be edited or removed, enforced by a database trigger. Do not build hashing in a
presentation workstream. Do not render an empty column, and do not render a
placeholder, because a hash shaped placeholder on a regulatory record is worse
than an absent column.

Recorded in BACKLOG as a real thing worth building, with what it would take: a
canonical serialisation of the evidence set at decision time, a hash column, and
a way to re-verify a stored hash against the current evidence, which is the only
thing that makes the hash worth anything.

### 3.2 The refund sentence. Proposal: CHANGE THE DESIGN TO MATCH REALITY.

Any customer facing copy about declines states the three cases, or states the one
that applies to the order being looked at. `refundFor` already returns an
`explanation` string written for the customer; render that rather than composing
new copy, so the screen and the ledger cannot disagree.

Never hard code $175. Read the fee from the catalog entry, and use the existing
absent handling when it is not published.

### 3.3 The dispatcher role. Proposal: CHANGE THE DESIGN.

Three roles, named as `ROLE_LABEL` names them: Administrator, Professional
Engineer, Field Technician. The permissions matrix on the Settings screen is part
of unbuilt Settings and does not need porting.

### 3.4 Technician pay screen. Proposal: BUILD THE SURFACE, it is thin.

There is no `/portal/pay` route, but every figure the design shows already
exists: `eng_tech_pay_ledger` has amount, status and period, and the technician
dashboard already reads it. This is a route and a page over data that is already
computed, not new behaviour. Wording follows the prototype: "written on
submission".

### 3.5 The 403 screen. Proposal: CHANGE THE DESIGN.

The platform deliberately has no 403. Every portal route answers `notFound()`
when a role may not see it, and `security-audit` asserts that a refusal is
indistinguishable from a route that does not exist. A 403 saying "you do not have
permission to view this" confirms the page exists, which is a deliberate
regression, not a missing screen. Port its visual treatment into the 404 and drop
the 403.

### 3.6 The owner dashboard's ranked "Action required" list. Proposal: PORT WITHOUT THE RANKING.

The design ranks it with an SLA engine that does not exist. The platform has real
attention sources: orders needing attention, dead letter jobs, files past
`evidence_due_at`, and the queue. Port the list rendering those, unranked and
grouped by kind. Do not invent an SLA target to sort by.

### 3.7 Review queue columns. Proposal: PORT WITH TWO SUBSTITUTIONS.

`QueueRow` gives `evidence_submitted_at`, `county`, `twia_county`, `due_at` and
`revision_count`. The design's "waiting" column is derivable from
`evidence_submitted_at`. Its "12 of 12 items, complete" package summary is not on
`QueueRow` and would need a per row read; propose deriving it in `reviewQueue`
rather than rendering a guess.

### 3.8 Reports, Settings, Compliance, Dispatch as routes. Proposal: DROP FROM THE SIDEBAR.

Not built, and out of scope for a presentation workstream. Recorded in BACKLOG
with what the prototype already models, so the design is not lost.

### 3.9 Everything the prototype does not draw. Proposal: EXTEND THE LANGUAGE.

Certification, Documents, Orders, Accounts, Onboarding, Job queue, Platform
status, Audit trail, Profile, and the whole Phase 8 Section 1 customer account
surface all postdate or fall outside the design. They get the design's components
rather than being left in the old styling, and every invention is named in the
report rather than passed off as designed.

---

## 4. What Section 3 of the brief says not to build

Recorded in BACKLOG rather than built: command palette and global search index,
saved views, bulk table actions, SLA engine, reports module, per user
notification channels, dispatcher role, SSO and MFA, retention and legal hold,
QuickBooks export, feature flags and environment banner.

Two of these are load bearing for a screen as drawn, and are called out above:
the SLA engine under the dashboard's ranked list, and saved views under the
Files toolbar. Both screens port without the affordance.

---

## 5. What I am asking for at this gate

1. The evidence hash column: confirm DROP, and confirm the footnote is rewritten
   to claim only immutability.
2. The refund copy: confirm it renders `refundFor`'s own explanation rather than
   the standards file's sentence.
3. Three roles, not four: confirm.
4. The technician pay screen: build it, or leave it unported. It is the only
   proposal here that adds a route.
5. The 403: confirm it is dropped rather than built.
6. The sidebar: confirm it is rebuilt from the real `NAV` rather than the
   prototype's eleven items.
