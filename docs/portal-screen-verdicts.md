# Per screen verdicts

Adopted 2026-09-05, Phase 11 Section 0, operator approved.

**What this is for.** Nothing mechanical can assert that a screen is composed
like the design or feels like the application the operator would have paid for.
`token-audit` proves the files speak the vocabulary. `contrast-audit`,
`mobile-audit` and `asset-audit` prove specific measurable properties. None of
them proves the thing the operator is actually asking about.

So this is judgment, recorded as judgment. Its value is not the verdicts. It is
that **a screen nobody has ever looked at appears as a blank row rather than as
silence**, which is exactly what would have caught the set password screen: it
would have had no row, for a phase, while the port reported itself finished.

**How to use it.** Look at the screen at 390 and at 1280. Write a verdict in
plain terms, and the date. A screen that changes materially gets its verdict
cleared back to blank rather than inherited, because a verdict is about a thing
somebody saw.

Verdicts are one of:

- **Good**: this is the standard, and other screens should look like it.
- **Acceptable**: nothing wrong, nothing to copy.
- **Weak**: works, reads as unfinished or as a website rather than an app.
- **Bad**: a person would notice something is wrong.
- **(blank)**: nobody has judged this.

---

## Pre-session surfaces

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| Sign in | `/portal/login` | yes | yes | 2026-09-05 | **Good.** Lockup crisp at 11.97:1, card treatment matches the design, restricted mode notice and compliance footer both present. This is the standard the other auth screens should meet. |
| Sign in, suspended | `/portal/login?suspended=1` | yes | yes | 2026-09-05 | **Bad at 390.** Overflows the viewport by 71px, so the compliance footer is cut off mid sentence in exactly the state a suspended person lands in. Correct at 1280. Two stacked notices are what push it over. |
| Sign in, after reset | `/portal/login?reset=1` | yes | yes | 2026-09-05 | **Weak at 390.** Overflows by 25px. Same cause, smaller. Correct at 1280. |
| Set password, valid link | `/portal/set-password?token=` | yes | yes | 2026-09-05 | **Was Bad, now Acceptable.** The reverse lockup sat here at 1.02:1 for a phase; fixed and now 11.97:1. Still carries neither the restricted mode notice nor the compliance footer that sign in carries, so the first thing a new Professional Engineer sees says nothing about the registration being pending. |
| Set password, dead link | `/portal/set-password` | yes | yes | 2026-09-05 | **Acceptable.** Distinguishes expired, used and invalid, and offers a way onward. Same missing notice as above. |
| Portal 404 | `/portal/*` unmatched | | | | |
| Portal 403 | not built | | | | Not built. Recorded in the port document as design screen 22. |

## Signed in, administrator

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `/portal` | | | | |
| Files | `/portal/files` | | | | |
| Clients | `/portal/clients` | | | | |
| New job | `/portal/intake` | | | | |
| People | `/portal/people` | | yes | 2026-09-05 | **Acceptable at 1280.** Judged while building the invite link panel. Roster reads clearly; the create form is long. Not judged at 390. |
| Roles | `/portal/roles` | yes | yes | 2026-09-05 | **Good.** The licensed capabilities panel explains itself, role cards read at both widths. Judged when built. |
| Audit trail | `/portal/audit` | | | | |
| Technicians | `/portal/techs` | | | | |
| Documents | `/portal/documents` | | | | |
| Orders | `/portal/orders` | | | | |
| Accounts | `/portal/accounts` | | | | |
| Billing | `/portal/billing` | | | | |
| Job queue | `/portal/queue` | | | | |
| Platform status | `/portal/status` | | | | |
| Tasks | `/portal/tasks` | | | | |
| Messages | `/portal/messages` | | | | |
| Your profile | `/portal/profile` | | | | |
| Onboarding | `/portal/onboarding` | | | | |
| Responsible charge | `/portal/charge-log` | | | | |
| Your pay | `/portal/pay` | | | | |
| Document binder | `/portal/documents/binder/[fileId]` | | | | |

## Signed in, Professional Engineer

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| Review queue | `/portal/review` | | | | |
| Protocols | `/portal/protocols` | | | | |

## Signed in, field technician

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| My jobs | `/portal/jobs` | | | | |
| A job | `/portal/jobs/[id]` | | | | |
| Certification | `/portal/certification` | | | | |

---

## What the blank rows already say

Twenty three of twenty eight portal screens have never been judged by anybody.
That is the honest state, and it was invisible before this table existed.

Section 2 of Phase 11 ends with a walk of every portal route at 390 in every
role, which is what fills the signed in sections in. This document is where
those verdicts go.
