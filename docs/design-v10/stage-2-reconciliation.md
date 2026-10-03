# Stage 2 read against the code, before anything is styled

Written 2026-10-03, before a line of stage 2 was restyled, because CLAUDE.md
section 2c says a design is drawn against a DESCRIPTION of the platform and
every claim it makes about money, contact or capability is wrong until it has
been read against the code.

The six screens: `V10E-queue`, `V10E-review`, `V10E-log`, `V10E-queue-phone`,
`V10A-dashboard`, `V10A-file`. `V10E-seal` is deliberately last and is not
reconciled here.

**The reconciliation runs in both directions.** Section 2c's own exception says
the rule is not "the design is always wrong": the prototype's reporting module
got absent versus zero right where this platform's file screen got it wrong. So
where the design is right and the code is thin, that is recorded as the code's
defect rather than the design's.

---

## The verdicts

### EXISTS, and the design is accurate

| Drawn | In the code |
| --- | --- |
| Five review decisions: seal and deliver, send back for revisions, request a site visit, issue a repair list, decline to seal | `REVIEW_ACTIONS` in `src/lib/ops-review.ts` is exactly `["seal", "revisions", "site_visit", "repairs", "refuse"]`. Five drawn, five declared, same order, same meanings. |
| "Phone clock within 60 seconds. Largest gap 14 s" | Real. Migration 0057 adds `clock_skew_seconds` and `clock_disagrees` to `eng_evidence_items`, and `src/lib/clock-skew.ts` carries the sixty second tolerance as an operator ruling pinned in `protocol-run-audit`. 254-RC-001 section 9 is quoted there. The design even has the behaviour right: a disagreeing clock is recorded, never a refusal. |
| "Technician trained on 254-RC-001 v1.1" | Real. `technician-training` is one of the launch conditions, reading `verifiedTechnicianTraining`, and the version is part of the match: training on v1.0 does not satisfy v1.1. |
| "Target: due in 3h", "Overdue 4h", "Past target" | `eng_files.due_at` exists and `reviewQueue` selects it. The specific figures are illustrative, which `DESIGN_V10.md` already says of every sample number. |
| Responsible charge log: date, file, property, what you did, time, outcome | `ChargeLogInput` and `ChargeLogRow` in `ops-review.ts` carry every one of those, including `reviewMinutes`, and refusals are logged as loudly as seals by design. |
| Money on the file screen: charged, Stripe fee, technician payout, engineer payout, margin | `periodTotals` in `src/lib/ops-money.ts`, and the file row carries the costs. |

### DOES NOT EXIST AND MUST NOT BE DRAWN AS A TICK

Two of the five "Automatic checks" on `V10E-queue` assert a verification this
platform cannot perform. **Both sit on the screen where an engineer decides
whether to put his seal on a conclusion**, which is the one place a fabricated
assurance costs the most.

**1. "Location within 50 m of the property. All 112 photos, median 9 m".**

A photograph does carry a position: `eng_evidence_items` has had
`captured_lat`, `captured_lng` and `captured_accuracy` since migration 0001. The
PROPERTY does not. `eng_files.latitude` exists and **nothing geocodes it**.
Migration 0001 says so where the column is declared, `src/lib/ops-counties.ts`
says "there is no geocoder in this stack", and `src/lib/ops-crm.ts` says of the
same columns "nothing geocodes them, so they are usually null".

So the distance has no second point to be measured from. A tick reading "within
50 m of the property", computed against a null, is a statement that the evidence
was verified against the address when nothing compared them.

**2. "No duplicate photos found. Compared with earlier files".**

`eng_evidence_items` carries `storage_key`, `thumb_key`, `content_type` and
`byte_size`, and **no content hash of any kind**. Nothing in any migration
hashes a photograph. There is no mechanism by which this check could have an
answer, true or false.

**This is the ruling the repository has already made once, about this exact
screen family.** CLAUDE.md records that the evidence hash column was dropped
from the responsible charge log because "rendering a value the platform did not
compute is a fabricated assurance on the firm's regulatory record". These two
rows are that same value, drawn with a tick beside it.

**What stage 2 does about it: builds the three checks that are real, and leaves
the two that are not off the screen entirely.** Not greyed, not "pending", not
shown as unavailable. A row saying "Location check unavailable" still teaches an
engineer that the platform has a location check, and the first time he is busy
he will read the absence as a pass.

The counter is the honest one: `Automatic checks 3 of 3 pass`, over the three
that exist.

### DOES NOT EXIST, AND IS A GAP RATHER THAN A FABRICATION

These are drawn things the platform could compute and does not. They are the
code's defect, not the design's, and none of them is a false assurance: an
absent number is absent.

| Drawn | State |
| --- | --- |
| "Accepted first pass 85%, 41 of 48 packages" | Computable today. `revision_count` is on the file and `reviewQueue` already selects it. Nothing computes the rate. |
| "Export PDF for TBPELS" on the responsible charge log | **No PDF generator exists in this repository.** Every `application/pdf` hit in `src` is an upload content type. CSV export exists and is what the log can honestly offer today. This is not the sealed-document rule, which forbids COMPOSING a sealed deliverable: a log export is the firm's own record of its own decisions. It is simply not built. |
| "Next payout run, Fri Oct 2" | **No payout run exists anywhere in the schema or the code.** And since the operator's ruling of 2026-10-01, Gusto runs all payroll and contractor payments, so a date drawn here would be the platform asserting a schedule another system owns. Needs a ruling before it is built at all. |
| Sparklines on every KPI | No series is computed for any of them. The KPI value is honest; the trend line beside it is not, until something computes it. |
| "Median review time", "Time under responsible charge" | `reviewMinutes` is recorded per decision, so both are computable. Neither is computed. |

### A RULE THE DESIGN GETS RIGHT AND THE PORTAL DOES NOT

`DESIGN_V10.md` says "No monospace anywhere, including file numbers, times and
money", and not one of the six stage 2 screens draws a monospace file number:
`254-2609-42` is set in Inter everywhere it appears.

The portal sets it in monospace in **fifty-four places**. Those were correct
under the old standard and are what stage 2, 3 and 4 convert. `token-audit`
gained the check on 2026-10-03 scoped to the declared V10 list, so each screen
is held to it on the day it is ported and not before.

---

## The one thing that is a compliance question rather than a design question

`V10E-queue` and `V10A-dashboard` both put **money** on screen, and they are
different principals: the dashboard is headed "Operations / Robert Reyna /
Owner", the queue is headed "Engineer portal / Aman Dhakal, P.E.".

The operator's ruling of 2026-09-24, in CLAUDE.md section 6b-i, is that the
engineer sees no money in the portal except his own pay: no order totals, no
price charged, no costs, no margin, no partner commission, no technician pay, in
any screen, API response, export or email.

**The drawn engineer screens obey it.** `V10E-queue`, `V10E-review` and
`V10E-log` carry no money at all, and `V10E-queue`'s left rail has a "Pay" entry,
which is his own pay and is exactly the one thing the ruling preserves. The
design and the ruling agree, which is worth recording because it is the kind of
agreement that a restyle can quietly break by copying a money block from the
admin screen into the engineer one.

---

## Stage 2 numbering

`DESIGN_V10.md` lists technician as stage 2 and engineer and admin as stage 3.
The operator's overnight instruction of 2026-10-03 orders them the other way:
engineer and admin first, technician after. The work follows his order. The
table in `DESIGN_V10.md` is left as it was written and this note is the record of
the difference, for the same reason the `V10-verify-phone` ruling is recorded
there rather than the row being silently edited.
