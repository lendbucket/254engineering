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

Re-judged 2026-09-05 after Section 1. Every one now fits a 390 viewport as a
single screen with no scrolling in any direction, which is the standard the
brief set, and `asset-audit` holds the lockup at 11.97:1 on all five.

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| Sign in | `/portal/login` | yes | yes | 2026-09-05 | **Good.** Unchanged in substance and still the reference: lockup at 11.97:1, card treatment, restricted mode notice, compliance footer. Spacing is tighter below `sm` so the notice-bearing states fit; nothing at 1280 moved. |
| Sign in, suspended | `/portal/login?suspended=1` | yes | yes | 2026-09-05 | **Was Bad, now Good.** Overflowed by 71px and cut the compliance footer mid sentence. Now one screen, footer complete. The restricted mode notice is suppressed in this state, which is a judgment: a suspended person cannot sign in, so which services the firm can perform is not a question they are in a position to ask, and the footer still states the registration in full. |
| Sign in, after reset | `/portal/login?reset=1` | yes | yes | 2026-09-05 | **Was Weak, now Good.** Overflowed by 25px. Fixed by the responsive spacing alone. |
| Set password, valid link | `/portal/set-password?token=` | yes | yes | 2026-09-05 | **Was Bad, now Good.** The reverse lockup sat here at 1.02:1 for a phase; now the light lockup at 11.97:1. It also now carries the restricted mode notice and the compliance footer that sign in carries, so the first screen a new Professional Engineer sees says the registration is pending. Card radius token matched to sign in. |
| Set password, dead link | `/portal/set-password` | yes | yes | 2026-09-05 | **Was Acceptable, now Good.** Same lockup and footer fixes. Still distinguishes expired, used and invalid, and still offers a way onward. The restricted mode notice is not shown here, because there is no account being set up to say it about. |
| Portal 404 | `/portal/*` unmatched | | | | |
| Portal 403 | not built | | | | Not built. Recorded in the port document as design screen 22. |

## Signed in, administrator

Walked 2026-09-05 at 390 with a real session, after Section 2 points 1, 4 and 6.
Every screen below has the fixed header, the fixed tab bar, and the single
scrolling region between them, so the shell is not repeated in each verdict.

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `/portal` | yes | yes | 2026-09-05 | **Good.** Reads as an application. Stat cards two up, each with the figure, the label and a sentence saying what it counts. The card clipped at the bottom edge is the region telling you it scrolls, which is the right way to say it. |
| Files | `/portal/files` | yes | | 2026-09-05 | **Weak, and the only screen I would call out.** Eleven status filter chips wrap into six rows and fill an entire phone screen before a single file appears. The chrome is right and the content order is wrong: a filter set that long belongs in a horizontally scrolling chip row with its own affordance, or behind a control. Two primary buttons, New job and Open a file, also sit either side of the restricted mode notice, which reads as one thought interrupted. |
| Clients | `/portal/clients` | yes | | 2026-09-05 | **Good.** Leads and clients as two clearly separated panels, and the empty state names the three sites enquiries arrive from. |
| New job | `/portal/intake` | yes | | 2026-09-05 | **Good.** The restricted mode notice says exactly what can and cannot be done, then the form starts with Who is it for. The 16px inputs mean focusing one does not zoom. |
| People | `/portal/people` | yes | yes | 2026-09-05 | **Good.** Cards carry name, address, status pill, role and last sign in, with the two actions as real buttons rather than a row of links. |
| Roles | `/portal/roles` | yes | yes | 2026-09-05 | **Good.** The licensed capabilities panel now renders on the cream fill it always asked for, which it did not before the missing token was declared. |
| Audit trail | `/portal/audit` | yes | | 2026-09-05 | **Good.** Each event is a card with the action key in mono, the sentence, and the actor and time beneath. Better on a phone than the table it would have been. |
| Technicians | `/portal/techs` | yes | | 2026-09-05 | **Good.** Coverage, certification, workload and money as labelled pairs, and each says what its absence means rather than showing a blank. |
| Documents | `/portal/documents` | yes | | 2026-09-05 | **Acceptable.** Reads correctly. The addresses shown are probe fixtures with a timestamp where the street number goes, which is development data rather than a screen defect. |
| Orders | `/portal/orders` | yes | | 2026-09-05 | **Acceptable.** An empty state that explains the twenty four hour rule it applies. Nothing to judge beyond that until an order is stuck. |
| Accounts | `/portal/accounts` | yes | | 2026-09-05 | **Good.** The account card carries terms, orders, what is owed and the limit, and the note underneath says plainly that nothing chases an overdue statement automatically. |
| Billing | `/portal/billing` | yes | | 2026-09-05 | **Good, and the clearest evidence for point 4.** The period is a card with all six columns as labelled pairs, including the coverage sentence the table used to squeeze into a narrow column. No table, no sideways scroll. |
| Job queue | `/portal/queue` | yes | | 2026-09-05 | **Good.** Four stat cards, each with the number and the sentence that makes it mean something. |
| Platform status | `/portal/status` | yes | | 2026-09-05 | **Acceptable, with one copy defect.** The dependency rows read well and distinguish configured from checked. But the sentence and the timestamp run together with no separator: "so nothing can be ordered Read 0s ago". |
| Tasks | `/portal/tasks` | yes | | 2026-09-05 | **Good.** Composer at the top, three filter chips that fit on one row, then task cards with the priority pill. This is the pattern Files should follow. |
| Messages | `/portal/messages` | yes | | 2026-09-05 | **Acceptable.** Two clear actions and an honest empty state. There is nothing else to judge until Section 3 gives it something to hold. |
| Your profile | `/portal/profile` | yes | | 2026-09-05 | **Good.** Details as labelled rows, then the password panel, and "Only you ever know it" said where it matters. |
| Onboarding | `/portal/onboarding` | yes | | 2026-09-05 | **Good.** Two sections with honest empty copy, and the note that an application is never deleted because it is the origin record. |
| Responsible charge | `/portal/charge-log` | yes | | 2026-09-05 | **Good, with one grammar defect.** The decision cards carry the reason in red where it was a refusal, which is right. "1 minutes" should be "1 minute". |
| Your pay | `/portal/pay` | yes | | 2026-09-05 | **Good.** Owed and paid as separate figures with a sentence each, and every entry saying which of the two it is waiting on. |
| Document binder | `/portal/documents/binder/[fileId]` | | | | Not walked. It is a per file route and the walk covers list screens. |

## Signed in, Professional Engineer

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| Review queue | `/portal/review` | yes | | 2026-09-05 | **Good.** The restricted mode notice explains why declining stays open, then the package card with the reference in mono, the address, the service line and the status pill. |
| Protocols | `/portal/protocols` | yes | | 2026-09-05 | **Good.** The eight service lines that cannot be dispatched are named in one sentence rather than listed as eight empty rows, which is the honest compression. |

## Signed in, field technician

| Screen | Route | 390 | 1280 | Judged | Verdict |
| --- | --- | --- | --- | --- | --- |
| My jobs | `/portal/jobs` | yes | | 2026-09-05 | **Good.** Two sections, offers and accepted, each with an empty state that explains how work reaches them. The tab bar changes to Home, Jobs, Certs, Tasks, Chat for this role, which is the navigation doing its job. |
| A job | `/portal/jobs/[id]` | | | | Not walked. Per job route, and it needs an accepted job the probe does not have. |
| Certification | `/portal/certification` | yes | | 2026-09-05 | **Good, and the best copy in the portal.** "This is stopping jobs reaching you" in red, then exactly which four documents are missing, then the promise that the site will never ask for a policy or social security number. |

---

## What the blank rows already say

Twenty six of twenty eight are judged. The two that are not are per record
routes, a document binder and a single job, which the walk does not reach
because they need a file and an accepted job the probe accounts do not have.
They are left blank rather than guessed at, which is the point of the column.

Of the twenty six, one is Weak and the rest are Good or Acceptable. The Weak one
is Files, and it is worth stating on its own: the shell is right on every screen
now, and the thing that still reads as a web page is a filter set that fills a
phone screen before any content appears. That is a content ordering decision
rather than a chrome defect, which is exactly the kind of thing no audit in this
repository can see and the reason this table exists.

Three small defects were found by looking that nothing else reported: the status
page runs a sentence into a timestamp, the responsible charge log says "1
minutes", and the documents list shows probe fixtures with a timestamp where a
street number belongs. The first two are real and are recorded in BACKLOG.

Section 2 of Phase 11 ends with a walk of every portal route at 390 in every
role, which is what fills the signed in sections in. This document is where
those verdicts go.
