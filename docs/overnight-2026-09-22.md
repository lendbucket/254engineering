# Overnight, 2026-09-21 into 2026-09-22

## The one screen

**Board on main: PENDING at the time of writing.** Prediction and result are in
the next section; this line is updated when it lands.

**0056 is ready and is NOT on main.** It sits on `feat/discipline-0056`, applied
to development and read back. **The freeze answer is NO**: nothing in the schema
constrains `requires_discipline`, proved in the replayed database rather than
inferred, so 0056 may land either side of Aman's approval. It goes to production
at a sitting with you.

**Two reds are owed human reads and nothing else closes them:** the Stripe legal
business name, and Aman's TBPELS roster entry.

**Rulings owed: 6.** Listed below. None blocks the morning; three block a line.

**Aman replied in writing.** Section 5 qualification accepted, discipline stated
as Structural Engineering, desktop and solar letters conditional on three things
including a market enquiry that must happen **before** any protocol work.

---

## 1. The board against its prediction

Filled in when the run lands. The prediction, written first:

> Exactly two FAIL lines. `stripe-webhook-audit`, the legal business name.
> `compliance-audit`, the engineer's roster entry. Nothing else.
> `mobile-overflow-audit` and `native-audit` report COULD NOT TELL on
> `/portal/accounts`, with `mobile-audit` and `contrast-audit` absorbing the
> same miss into a PASS.

---

## 2. The 0056 sitting

**Ready.** `feat/discipline-0056` at `b65a95e`, one commit, not merged.

| | |
| --- | --- |
| What it does | Sets `requires_discipline` to `structural` on the 254-RC-001 v1.1 row while it is `awaiting_engineer`. One column, one row, no DDL. |
| Authority | Aman Dhakal, 2026-09-21, in writing. Screenshot on disk, digested, recorded in `src/config/engineer-directions.ts`. |
| Development | Applied through `apply_migration`, read back: row `4b796249`, v1.1, `awaiting_engineer`, `requires_discipline` structural, approval columns null. The v1.0 row untouched at null. |
| Production | Pending. Yours. |

### The freeze answer: NO

Neither `eng_approve_protocol` nor 0049's constraints freeze
`requires_discipline`. 0049 adds it as a plain text column; no constraint or
trigger in the chain names it; `eng_approve_protocol` writes only `status`,
`published_at`, `approved_by`, `approved_at` and `approved_by_license`.

That reading is an argument from absence, so it is **proved** rather than
asserted. `migration-audit` now takes a probe protocol to `published` through
the real approval function, changes its discipline afterwards, and commits. A
second check asserts the probe genuinely reached `published` carrying the value,
because a transaction that failed at its INSERT would also report "not refused"
for an UPDATE it never ran.

**So the sequencing is free.** 0056 can land before or after he approves.

---

## 3. Rulings owed

**One.** *"Field Technician" or "Field Inspection Technician"?* `DEFAULT_ROLES`
in `ops-authz.ts` says the first, `ROLE_LABELS` in `onboarding-checklists.ts`
says the second, for the same key `field_tech`. One fact, two homes, already
diverged. **Recommendation: "Field Technician"**, because it is the name on the
role record the permission screen already renders, and onboarding is the newer
of the two. I did not change it, because which word the firm uses is yours.

**Two.** *May a registered DBA appear in partner copy?* `partner-audit` forbids
the performing firm sentence naming "254 Engineering Services", on the recorded
reason "which the board has no record of". **That clause became false on
2026-09-21**: TBPELS now records it as an assumed name on F-29811. I kept the
assertion and replaced the reason with "a partner contract names the registrant
rather than a trade name". **Recommendation: keep the narrower rule.** The
entity answerable on an engagement is the registrant, and a DBA in a contract
invites an argument about who the counterparty is.

**Three.** *Audit action wording.* `/portal/audit` now renders
`windstorm_inquiry.answered` as "Windstorm inquiry answered", by a deterministic
transform rather than a hand written label per action. **Recommendation: leave
it.** Choosing sixty phrasings is a wording decision at scale and a hand map
goes stale silently. If you want particular actions phrased differently, name
them and they get an override.

**Four.** *The three photo time values.* Section 9 requires each photograph to
carry the device time, the server time at sync, **and the difference**, with a
disagreeing clock "recorded as disagreeing rather than presented as certain".
Two of the three exist. **Recommendation: store the difference at write time**
rather than computing it on read, so the record says what was true at sync. This
is a migration and it is not written.

**Five.** *Ten years, or longer.* Section 13 makes ten years the floor and says
the engineer raises it where TBPELS rules or the professional liability policy
require longer. **Nobody has asked him.** Recommendation: put it in the same
sitting as the protocol approval.

**Six.** *`CLAUDE.md` says the gate carries seven conditions. It carries nine.*
`self-service-signup` and `recovery` are not in that paragraph's table.
**Recommendation: correct the paragraph**, and check whether
`compliance-audit`'s pinned id list is also at seven, because if it is, two
conditions are unpinned.

---

## 4. Ranked: what blocks roof certification

Each marked **code**, **configuration**, or **a person's act**.

| # | Blocker | Kind |
| --- | --- | --- |
| 1 | **Aman has not approved 254-RC-001 in the platform.** `approvedProtocols` is unmet, so all 8 service lines are a waitlist. Nothing else on this list matters until it happens. | a person's act |
| 2 | **0056 is not on production.** Until it is, `requires_discipline` is null there and the discipline block stands even after approval. | a person's act (a sitting) |
| 3 | **No live Stripe account belongs to this firm.** The integration has been exercised against **Reyna Pay, a different entity**, so a live charge today pays the wrong company for engineering work. | a person's act |
| 4 | **The Stripe legal business name is unverified.** Changed in the dashboard, evidence deleted for PII. Board red until a cropped screenshot or a key-run audit. | a person's act |
| 5 | **Aman's TBPELS roster entry has not been re-read** since the firm reissued. Firm and licensee are two records and can disagree. | a person's act |
| 6 | **Section 5 training and supervised inspection are not done.** He offers; neither has happened or been recorded. | a person's act |
| 7 | **`FIRM_PHONE`** is unset in a local process. Set on the deployment; confirm rather than assume. | configuration |
| 8 | **`LAUNCH_MODE` is not live.** The switch, last. | configuration |
| 9 | **Self service sign up is not cleared for production.** A customer session minted on a preview is accepted by production. | a person's act |
| 10 | **The three photo time values.** Ruling four. Section 9 is not fully enforced. | code |
| 11 | **`/portal/accounts` stalls beyond 90 seconds**, four audits cannot reach it. Not a certification blocker; it is on this list because it is worsening. | code |

---

## 5. The v1.1 walk, sections 1 to 14

Marked **enforced** (code refuses a violation), **recorded** (declared and
visible, not enforced), or **neither**.

| § | Requirement, quoted | State | Where |
| --- | --- | --- | --- |
| 1 | "the engineer can reach a determination from the evidence package alone" | recorded | purpose; no single check |
| 2 | "does not cover windstorm inspections of ongoing construction ... structural design; plan review; or repair specification" | enforced | `protocol-registry-audit` exclusion check against `services.ts` |
| 3 | "No state program certifies the condition of an existing roof in Texas" | recorded | `RC001` governing table |
| 3 | "not a warranty, a guarantee of future performance, or a representation that the roof will not leak" | **enforced** | exclusion phrases swept against rendered copy |
| 4 | "Only the Engineer of Record determines the outcome" | **enforced** | `LicensedAction`, unrepresentable in a role's grants |
| 4 | "Does not attend the site" | neither | no check |
| 5 | "two years ... or equivalent experience the engineer accepts in writing" | **recorded** | `engineer-directions.ts`, his email, digested |
| 5 | "training on this protocol ... with a supervised inspection before independent work" | **neither** | owed, ranked 6 |
| 5 | "Active Texas P.E. license ... held in the firm's compliance file" | recorded | `verifiedEngineers`, expiry checked |
| 6 | "A yes to any flag question ... routes the job to the engineer before dispatch" | **enforced** | flags pinned as 8 to 12 |
| 6 | "not dispatched until intake is complete and every upload ... received" | enforced | `ops-evidence` gate |
| 7 | "schedules an accepted job within two business days" | neither | no check |
| 8 | "completes every item of Appendix B ... in the order listed" | **enforced** | 51 items, order asserted |
| 8 | "No item is estimated, assumed, or left blank" | **enforced** | every row `required: true` |
| 8 | "ambient temperature at the time of the check is recorded" | **enforced** | capture on the item |
| 9 | "one wide photograph ... and one close photograph" | recorded | `minCount`; not typed as wide/close |
| 9 | "a ruler or tape is in frame" | recorded | instruction text reaches the technician |
| 9 | "three time values ... the difference between them" | **neither** | ruling four |
| 9 | "Photographs from other devices are not accepted" | neither | no check |
| 9 | "rejected without review" if incomplete | **enforced** | `checklistState` blockers |
| 10 | "No certification letter is issued with an open repair item. There is no conditional certification." | **enforced** | 0053, both directions, proved in replay |
| 11 | "states observed condition only ... does not estimate remaining service life" | **enforced** | the check that caught `services.ts` |
| 11 | "The engineer does not certify a roof that was not inspected under this protocol" | neither | no check |
| 12 | five exclusions, including "automatic decline and the request is logged verbatim" | recorded | `RC001_ENFORCED`, verbatim-verified |
| 13 | "retained for ten years from the date of the letter" | recorded | `retention-policy.ts` |
| 13 | "Ten years is the firm's floor ... raises it where either requires longer" | **neither** | ruling five |
| 14 | "reviews this protocol annually, and within thirty days of any change" | neither | no reminder exists |

**Appendices A to D are verified verbatim against the PDF** by
`protocol-registry-audit`: 16 intake questions, 51 checklist items in document
order, 5 determinations, 3 thresholds, the photo procedure, and 27 enforced
rules compared word for word. That is the strongest-verified declaration in the
repository and it is not re-walked here.

---

## 6. The photo path

**Capture, not design.** `CaptureClient.tsx` writes `capturedAt` from the device
clock at the moment of capture; the server sets `created_at` on insert.

| Question | Answer |
| --- | --- |
| HEIC | **Accepted.** `image/heic` and `image/heif` are in `ALLOWED_CAPTURE_TYPES`. |
| Large files | **15MB cap**, matching the bucket. Comment: "A phone camera on a bright roof clears ten." |
| Several photos | `minCount` per item; 40 of 51 items are photo items. |
| Weak signal | `src/lib/offline-queue.ts` exists and queues captures. |
| Closed tab | The queue persists; a closed tab does not lose a capture. |
| Three time values | **Two of three.** Device time and server time exist; the difference is neither stored nor shown, and nothing marks a disagreeing clock. Ruling four. |
| Bucket privacy | **Private.** `eng-evidence`, declared private in 0002. |
| Which audits read uploads back | `files-audit` and `demo-audit` touch evidence rows. **No audit fetches a stored object back and confirms the bytes.** |

**Proposed phone test**, to be run by a person on a real roof or a plausible
substitute:

1. Airplane mode. Capture three items including one photo item with `minCount`
   above 1. Confirm the queue holds them.
2. Close the tab. Reopen. Confirm nothing was lost.
3. Restore signal. Confirm all three sync and appear on `/portal/review`.
4. Set the phone clock forward ten minutes before a capture. **Confirm what the
   record says about the disagreement.** This is the test ruling four exists
   for, and today the expected answer is "nothing".
5. Capture a HEIC photo from an iPhone and confirm it renders in review rather
   than downloading.
6. Capture one file above 15MB and confirm the refusal names the size.

---

## 7. The gate, read from the code

`launchMode()` is **prelaunch**. `isTrading()` false, `isOpen()` false.

**Nine conditions, not seven.** Four met, five unmet.

| Condition | State |
| --- | --- |
| `engineer-of-record` | **met** |
| `registration` | **met** |
| `trading-name` | **met, tonight**, by the TBPELS reissuance |
| `recovery` | **met** |
| `switch` | unmet, `LAUNCH_MODE` is not live |
| `stripe` | unmet, and the reason names **Reyna Pay** as the account exercised |
| `protocols` | unmet, all 8 lines a waitlist |
| `phone` | unmet **in this process only**; `FIRM_PHONE` is unset locally |
| `self-service-signup` | unmet, not cleared for production |

The `phone` row is the ambient-state hazard in the open: a check that reads an
environment variable reports the environment, not the world. Confirm it on the
deployment.

---

## 8. Everything else, by item

**Item A.** Aman's email recorded as three directions in
`src/config/engineer-directions.ts`, each quoting him verbatim, each naming the
screenshot and its sha256, each stating what it does **not** establish. Four
checks in `compliance-audit` bind them, including hashing the file rather than
trusting the record. Injection verified by zeroing a digest.

**Item B.** The uncropped Stripe screenshot reappeared and was deleted again.
Confirmed by `git ls-files`, `git log --all` and the staged list that it was
never tracked, never staged, never committed, **before** deleting.

**Item 3, portal copy.** The build line came off the rail; it is on
`/portal/status`, admin only. Audit action keys read as English. 112 US spelling
replacements across 43 files; `src/content/protocols/` untouched. New
`voice-audit` check, injected both ways, the protocol half against a fixture
this run created in that directory and deleted.

**And the spelling fixer rewrote a database column.** `eng_partners.organisation`
appears in select strings like `"id, organisation, code, status"`, which contain
spaces, so "has a space, therefore prose" rewrote a schema identifier as copy in
seven places. `tsc` caught it because `PartnerRow` still declared the real
spelling. Both the fixer and the check now exclude comma-separated snake_case
lists, and the check **counts** what it skipped rather than skipping quietly.

---

## Housekeeping

- Nothing was pushed.
- Nothing was written to production.
- No check was loosened, skipped or deleted.
- Files deleted: the Stripe screenshot (ruled), the injection fixture and two
  temporary scripts this run created.
- Servers: every one started for a standalone audit was killed **by PID** after
  `TaskStop` reported success and left the child holding 3225. That happened
  three times tonight and is worth knowing before trusting `TaskStop` to free a
  port.
