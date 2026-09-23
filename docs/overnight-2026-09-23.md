# Overnight, 2026-09-23

**Branch `feat/overnight-2026-09-23`, from `main` at `6685a3a`. Nothing merged,
nothing pushed, nothing deleted. No production access of any kind: the flag was
never set, and the only database read was development, through the guard that
refuses production without it.**

This document is the record and the question list. Section 9 is the only part
that needs the operator, and it is ordered.

---

## 1. `soc2-controls.mjs` no longer cites a proof no board runs

**Commit `ff0a8bb`.** First item, as ruled.

**What was false.** The `mfa` control declared it was enforced by
`scripts/proofs/totp-matches-the-rfc.mjs`. That proof is real and correct, and
it was reached by nothing. A reader takes `enforcedBy` to mean a machine makes
the control true, and `machine: true` sits beside it.

**The generated pack carried it too**, at `docs/soc2-readiness.md` line 262,
which is the artifact an auditor actually reads. It was regenerated rather than
hand edited. `soc2-audit` passed before and after, because its check asks
whether every control REACHES the report, not whether the text agrees.

**Verified in the other direction rather than assumed.** The two sibling
controls claim their proofs "fail to COMPILE". That is sound: `tsconfig`
includes every `.ts` with only `node_modules` excluded. Proved by injecting a
type error into `the-system-actor-is-not-a-person.ts`, which turned `tsc` exit 2
naming the file and line. Those two sentences were left untouched.

**Artefact read, not just checked.** `evidence/access-review-2026-09-23.csv`
opened: the customer and partner rows carry `not role based` with the ownership
scope written out, rather than the `Grants 0` a reader would take to mean the
account can do nothing. The 2026-09-12 fix holds.

---

## 2. Every proof now runs, and none is reached by nothing

**Commit `<item 2>`.** `scripts/proofs-audit.mjs`, second in `PHASE_ZERO`.

It derives its subject from the DIRECTORY, so a proof runs by existing rather
than by somebody remembering to import it. Same idiom as `surfaces.mjs` for
routes and `email-audit` for templates.

**16 checks.** Eleven runnable proofs executed as child processes, two
compile-time proofs asserted to be inside what `tsc` reads, a vacuity guard, an
entry-point guard, a check that no file in the directory is reached by nothing,
and the one that closes item 1's hole: every runnable proof the SOC 2 pack
cites is one this audit runs.

**The invocation is derived, not guessed.** A proof importing TypeScript is run
under `tsx`; one needing server-only imports gets `--conditions=react-server`.
Both derived from the source.

**Injection-verified three ways**, each restored byte identical:

| Injection | Result |
| --- | --- |
| A file with an unaccounted extension in `scripts/proofs/` | red, naming it |
| The tsx entry point moved | red on the entry check, AND the six tsx proofs reported **could not be invoked, so it proved nothing** rather than as failures |
| The SOC 2 pack citing a proof that does not exist | red, naming the citation |

The second is the one that matters: it proves could-not-run is distinguished
from failed, which is `unreachable is not failed` applied to a child process.

### Two mistakes on the way, both caught by running standalone

**Removing `shell: true` broke every tsx invocation.** On Windows the executable
is `npx.cmd` and a `.cmd` cannot launch without a shell, so seven proofs
returned `exit null` with no output. **Seven proofs reported as failures when
not one of them had run.** Fixed by invoking tsx's own declared `bin` entry
directly under `node`, which needs no shell and no `.cmd`, and by treating a
null exit as could-not-run rather than as a verdict.

**A constant used before its declaration crashed the audit outright.** Caught
because it was run standalone before being wired in, which is the rule.

### Item 1's sentence was made true again in this commit

The class fix means the SOC 2 pack can cite that proof honestly, so it does,
and `proofs-audit` asserts the citation stays worth something. The sequence is
kept in the comment rather than tidied away, because the claim was false for a
few hours and a reader finding only the final sentence would never know.

---

## 3. The six never-run proofs, each with a prediction

**Predictions stated before running.** Four I had already observed passing
earlier the same night, so those carried little information. Two I had never
executed, and those are marked.

| Proof | Predicted | Actual |
| --- | --- | --- |
| `totp-matches-the-rfc` | PASS | PASS |
| `the-commit-guard-refuses-the-shape` | PASS, 34 cases | PASS, 34 cases |
| `the-firm-name-is-one-value` | PASS | PASS |
| `a-mismatched-stripe-account-stops-charges` | PASS | PASS (under `tsx`; see below) |
| **`a-signed-protocol-is-not-a-draft`** | **PASS, never run by me** | **FAIL, 2 of 8 checks** |
| **`windstorm-scope-is-the-date-of-the-work`** | **PASS, never run by me** | PASS |

**The prediction was falsified, and the falsified half is the finding.** Five of
six passed. The sixth is section 4.

**One false alarm worth recording.** `a-mismatched-stripe-account-stops-charges`
first reported a failure under bare `node`. That was an INVOCATION fault, not a
defect: it imports a TypeScript module. Under `tsx` it passes. Had the runner
not derived the invocation, it would have reported a perfectly sound proof as
broken for ever.

---

## 4. STOPPED FOR A RULING: `a-signed-protocol-is-not-a-draft` fails, and the code is not what is wrong

**Not weakened, not excluded, not touched.** It fails on the board as of this
branch. Ruling needed.

```
FAIL  a published protocol must name who approved it and when
      (refused by its own named constraint)
FAIL  retired is untouched (the migration widened rather than replaced)
```

The proof replays every migration into an in-process Postgres, so nothing real
is touched and no database is reachable from it.

### Failure one is diagnosed, and the protection is STRONGER than the proof asserts

The proof inserts a row with `status = 'published'` and expects the refusal to
carry the check constraint name `published_is_approved`. It IS refused. The
message comes from somewhere else.

**0052 added a trigger the proof predates**,
`eng_protocol_templates_not_born_in_force`, whose function raises on any insert
with `status = 'published'`:

> `eng: a protocol cannot be created already in force. It is drafted, signed, and then approved through eng_approve_protocol.`

The trigger fires BEFORE the check constraint can produce the message the proof
matches. So the guarantee holds and is tighter than it was; the proof was
written at 0049 and the schema moved to 0058 underneath it while nothing ran it.

**This is exactly the class the proofs runner exists to end**, found by the
first run of the mechanism that ends it.

### Failure two is NOT diagnosed, and is recorded as unexplained

Inserting `('proof-g', 'Retired', 1, 'retired')` is refused. It should be
accepted. What was checked and did not explain it: `retired` is still in the
status vocabulary (0049 line 72), and every column 0049 adds is nullable, so it
is not a missing NOT NULL. The `not_born_in_force` trigger fires only on
`published`, so it is not that either.

**No story is attached to it.** Somebody has to read the error the insert
actually returns, which the proof does not currently print on failure.

### Recommendation

**Fix the proof, not the code, and make it print the refusal message it got.**
The schema is right and got stricter; the proof asserts a constraint name that a
trigger now pre-empts. Updating it to assert the CURRENT refusal is sharpening,
not weakening: the property tested is unchanged, and the check gains the ability
to say which guard fired.

Diagnose failure two first, because a fix written before it is understood would
be a fix to make a red go away.

**Until ruled, the board is red on `proofs-audit`, by one check, for this
reason.** That is the honest state and I have not hidden it behind an exclusion.

---

## 5. The TDI records, and the AQI-1 proposal

**Commits `1704882` and this one.** Records only. The seven items are in
`BACKLOG.md` as reported and not verified, changing no service line, price or
rule, with no personal detail from the email.

The one that needed thought is item 2: **three form numbers are in play**, WPI-8
in the service line, WPI-2E in his account, WPI-2 in item 5. Recorded as a
disagreement rather than reconciled, per the ruling.

### Item 7: where an AQI-1 submission would be recorded. PROPOSAL, NOT BUILT.

**The deadline is 2026-12-21**, 90 days from 2026-09-22, computed rather than
counted: 8 days to the end of September, 31 in October, 30 in November, 69 used,
21 into December.

**A HOME ALREADY EXISTS FOR THE OUTCOME, AND NONE FOR THE ACT.** That is the
whole of the proposal.

`src/config/credentials.ts` declares `WINDSTORM_APPOINTMENT_CREDENTIAL` in
`verifiedCredentials`, today `held: false`, and says in its own words:

> This becomes a held credential only when an appointed engineer is on the
> roster and the appointment number is recorded here from TDI's own record.

So the APPOINTMENT has a home and a check: `compliance-audit` asserts the
windstorm pages keep disclosing the absence in the negative, and flipping `held`
turns that into a claim the board would test.

**What has no home is the SUBMISSION**, and the deadline is about the
submission, not the appointment. TDI granting an appointment is not within
anybody's control by 2026-12-21; filing the form is.

**The proposal, in the existing shapes and adding no new one:**

1. **The record goes on the credential that already exists**, as two fields on
   that entry: the date the AQI-1 was submitted, and who stated it. Not a new
   file and not a new registry. The submission and the appointment are two
   states of one credential, and splitting them across two homes is the defect
   this repository names most often.
2. **The deadline goes in `src/config/parked-work.ts`**, which already does
   exactly this: `acknowledgedThrough: "2026-12-21"`, with `retiredWhen` naming
   the submission and `isRetired` reading the field above. Whichever comes
   first.
3. **`isRetired` returns true if the submission is recorded OR the credential is
   held**, because an appointment that has come through is proof the form was
   filed, and a park that stayed red after the thing succeeded would be the
   mechanism failing in the direction that teaches people to ignore it.

**WHY IT IS NOT BUILT TONIGHT, beyond the instruction.** The ruling needed first
is what counts as recording a submission:

- **The operator's word with a date**, the `pointInTimeRecovery` idiom, which
  this repository already accepts for facts no check can reach; or
- **An artefact**, a TDI receipt or confirmation, digested the way the Stripe
  captures and the engineer's directions are.

**I recommend the operator's word with a date**, and I want to say why rather
than just pick. The artefact standard is stronger and is right where an artefact
can exist without carrying what must not be stored. A TDI submission receipt for
an individual licensee will carry his personal details, and the standing rule
from 2026-09-21 is that a capture containing them is not taken. Demanding
evidence that cannot be stored produces either a rule nobody can satisfy or a
cropped artefact whose crop removes the very thing identifying it.

The attestation shape built on 2026-09-22 is the precedent and it fits exactly:
a statement, named and dated, saying in its own text that no capture backs it,
retired by an event, with a date as a backstop.

---

## 6. Self service sign up. REPORT ONLY, NO CODE WRITTEN.

### What the gate condition requires

One value. `selfServiceSignUp.cleared` in `src/config/launch-conditions.ts`,
edited by the operator and nobody else. There is no environment variable and no
derived answer, deliberately: a feature reaching the public should require
somebody to open a file, type, and leave a commit behind.

It gates `open`, so it is one of the eight that block.

### What is built, and it is the whole door

| | |
| --- | --- |
| Page | `src/app/account/sign-up/page.tsx`, which asks `selfServiceSignUpOpen()` and renders the closed sentence instead of the form |
| Route | `src/app/api/account/sign-up/route.ts`, which returns **404** with the closed sentence rather than 403, so a shut door is not an inventory of what exists |
| Declared | Door one of three in `src/lib/account-doors.ts` |
| Covered by | `accounts-audit`, `doors-audit`, `security-audit`, and `scripts/exercises/suspended-account-link.mjs` |

`doors-audit` walks all three doors end to end. The sentence a closed door gives
is a single function, `selfServiceSignUpClosedSentence()`, and it deliberately
says nothing about preview deployments or session secrets: the reader wanted an
account, and why it is shut is the firm's business rather than theirs.

**Nothing is missing from the feature.** This is not half built.

### What is left, and it is not code

**`selfServiceSignUpOpen()` reads the flag and nothing else:**

```ts
export function selfServiceSignUpOpen(): boolean {
  return selfServiceSignUp.cleared === true;
}
```

It does **not** consult `launchMode()`. So clearing that one boolean opens sign
up **immediately on every deployment, including every Preview**, whatever the
rest of the gate says.

**That matters because of what the condition's own text warns about.** Its
`because` says clearing it is what turns the shared preview secrets "from a risk
about accounts the operator created into a risk about accounts anybody can
create". And `src/config/credential-inventory.ts` still records
`CUSTOMER_SESSION_SECRET` as **shared** with Preview, recorded as shared rather
than as fixed, with the note that an earlier version claimed distinct and that
"a declaration that asserts a fix which has not happened is the exact thing this
pack exists to prevent".

**So the real prerequisite is a Vercel action, not a code change:** split
`CUSTOMER_SESSION_SECRET` between Preview and Production, and record the split.
Until then, clearing the flag means anybody holding a preview URL can create an
account whose session production accepts.

**The two are coupled in reality and decoupled in the code**, and that
decoupling was deliberate: the operator ruled them separate decisions so that
accepting the secret-sharing risk would not silently open a feature nobody
cleared. The decoupling is right. What is worth knowing is that the ORDER
matters, and nothing in the code enforces it.

### Estimate

| Work | Sittings |
| --- | --- |
| Split `CUSTOMER_SESSION_SECRET` in Vercel, redeploy, record the split in `credential-inventory.ts` | **half a sitting**, and it is the operator's, not a session's |
| Clear the flag, with who and when | minutes, inside the same sitting |
| **Optional, and a question rather than a recommendation:** make `selfServiceSignUpOpen()` also require a non-preview deployment, so the order cannot be got wrong | **one sitting**, including a proof both ways |

**One sitting in total if the optional guard is wanted, half if not.** No part of
this is blocked on anything except the operator being at a keyboard with the
Vercel dashboard open.

---

## 7. The board against its prediction. FALSIFIED, TWO WAYS, AND ONE OF THEM IS ARITHMETIC.

**Predicted:** 58 PASS, 1 FAIL, 2 COULD NOT TELL, of 59.

**Actual:** **55 PASS, 2 FAIL, 2 COULD NOT TELL, of 59.** Ran to completion, all
59 audits started.

### The first error is mine and it is embarrassing: the prediction did not add up

58 plus 1 plus 2 is 61, not 59. The figure could not have been right whatever
the board did. The intended number was 56, and stating a total that contradicts
its own parts is exactly the kind of thing the prediction rule exists to expose
before a run rather than after.

**It is recorded rather than quietly corrected**, because a prediction that
cannot be satisfied is not a prediction, and the next person writing one should
see that this one was checked against its own total only afterwards.

### The second error carried the information

| | Predicted | Actual |
| --- | --- | --- |
| Runs to completion | yes | **yes**, 59 of 59 started |
| FAIL count | 1 | **2** |
| Which | `proofs-audit` | `proofs-audit` **and `mfa-audit`** |
| `proofs-audit` | 15 of 16 | **15 of 16**, on `a-signed-protocol-is-not-a-draft` |
| COULD NOT TELL | `mobile-overflow-audit`, `native-audit` | **exactly those** |
| `compliance-audit` | 104, 3 acknowledged | **104, 3 acknowledged** |
| `db-guard-audit` | 86 | **86** |
| `soc2-audit` | 63 | **63** |
| `backlog-audit` / `surface-audit` | 12 / 25 | **12 / 25** |

Everything predicted about the branch held. **What I did not predict is an audit
the branch does not touch.**

---

## 8. `mfa-audit` failed on the board and passes twice standalone

```
FAIL: the same role with a FULL session DOES open the portal (/portal)
      (status 307. The refusal below would then prove nothing about the second factor.)
FAIL: and CANNOT decline into the portal (/portal)
      (refused with 307, but the control failed, so this refusal is not evidence)
```

**The audit was honest about itself**, which is the 2026-09-22 ruling working: the
second line says outright that the refusal is not evidence because the control
failed. Without that sentence this would read as somebody getting past the second
factor, which is the opposite of what happened.

### It cannot be this branch

`git diff --name-only 6685a3a..HEAD` returns ten files: `BACKLOG.md`, the
overnight report, two generated SOC 2 documents, two evidence CSVs,
`package.json` (one line), `scripts/audit.mjs` (one list entry),
`scripts/lib/soc2-controls.mjs` (one string), and the new `proofs-audit.mjs`.

**Nothing touching auth, sessions, the proxy or MFA.** And `mfa-audit` passed on
`main` at `6685a3a` a few hours earlier, on a board with zero FAIL lines.

### Reruns, following the 2026-09-21 precedent

| Run | Result |
| --- | --- |
| In the board | **FAIL, 2 of 57** |
| Standalone, run 1 | **PASS, 57 of 57** |
| Standalone, run 2 | **PASS, 57 of 57** |

Both reruns against a real server with nothing beside them. Teardown passed in
all three, including the board run, so **no probe role was stranded** and the
2026-09-21 incident did not repeat.

### What is NOT concluded

**Not that the audit is flaky and may be ignored.** It is the second time
`mfa-audit` has gone red on a board and been unreproducible standalone; the
first, on 2026-09-21, turned out to be a real network fault reaching the
development database during teardown, recorded in `BACKLOG.md` as survey 3's
first live instance.

This one is different in shape: the fault is a **307 where 200 was expected on a
full session**, in the middle of a sequence whose neighbours all passed,
including *"and it can open the portal at all, so a refusal means the factor"*.
Something about that one navigation differed.

**No story is attached to it.** What is recorded is that it failed once under
board load and passed twice standalone, and that the branch cannot have caused
it.

**It is a candidate for the same treatment as `/portal/accounts`:** a fault that
only appears under a full board is a fault the instrumentation has to already be
running for, because the run that fails is not the run anybody chose.

---

## 8b. PROPOSAL, NOT BUILT: what opening the completed construction line would need

**The TDI source is now on file** and the engineer's account was correct on every
point. `docs/compliance/TDI-completed-construction-certificates-09-23-2026.html`,
sha256 `41c01a1195cb5aae7c6f20afb40a8b5d287acd271b896d8047a6884755f2cffd`, 30028
bytes, read 2026-09-23.

**The finding underneath it.** The firm's service line is named for **WPI-8**,
which is ongoing construction inspected by a **TDI appointed** engineer, and no
engineer here holds that appointment. The route it could serve with any TBPELS
licensed PE, completed construction, is not offered at all. Nothing published is
dishonest: the absence of the appointment is disclosed. But the line advertised
is the one the firm cannot perform.

### What opening it needs, in the order the dependencies actually run

**1. A signed protocol drawn from 28 TAC 5.4604 and 5.4606.**
Not a variation of 254-RC-001. That protocol is a single inspection of an
existing roof and its section 2 says in terms that it does not cover windstorm
work. A completed construction inspection answers a different question against a
different authority, and the platform already refuses to offer a line with no
approved protocol: `orderBlockedReason` takes `hasApprovedProtocol` as a
required parameter, so this is enforced rather than remembered.

**Only the engineer can sign it, and only he can approve it in the platform.**

**2. Windstorm system access for the engineer.**
The source is explicit that an engineer not appointed by TDI must "request
access to the windstorm system to create and track your WPI-2Es". **This is a
prerequisite, not a formality:** without it there is no route to file, and a
line that cannot file its own deliverable is a line that takes money for
something it cannot complete.

**3. Insurance confirmed for this scope.**
Professional liability that covers windstorm completed construction inspection
specifically. Section 13 of 254-RC-001 already makes the retention floor
something the engineer raises where the liability policy requires, so the policy
is already a thing this platform's rules defer to.

**4. The standing rule changed to cover ongoing construction only.**
Today the firm's position is recorded as not holding a TDI appointment, and the
windstorm pages disclose it in the negative, asserted by `compliance-audit`. If
completed construction opens, that disclosure becomes **wrong in the direction
that matters**: it would read as "this firm does no windstorm work" when the
true position is "no ongoing construction, completed construction yes".

**That check asserts the disclosure stays NEGATIVE**, so this is not a copy edit.
It is a change to what the gate and the audit consider honest, and it has to
happen in the same commit as the copy or the board goes red for the right
reason.

### The question

**Do you want the completed construction line opened, and if so in what order?**

**My recommendation: do not start until the engineer's windstorm system access
is granted**, because it is the only step with a third party's timeline on it
and it is the one that makes the rest useful. The protocol is the expensive
piece and it is wasted if access is refused.

**And separately, whether or not the line opens: the service line naming should
be corrected.** Naming it WPI-8 while describing the appointed route is accurate
about a product the firm does not sell. That is a service line change and I have
not made it.

**One thing that needs a ruling either way:** the captured TDI page's digest is
recorded in `BACKLOG.md` and **hashed by no check**, because there is no
register for it until the line exists. The Stripe captures are hashed by
`stripe-webhook-audit`. A digest nothing verifies is the shape this repository
has already named once tonight.

---

## 9. QUESTIONS WAITING FOR THE OPERATOR, IN THE ORDER TO ANSWER THEM

Nothing below was decided. Each says what I would do and why.

### 1. ANSWERED AND DONE, except one open sub-question about 0058

Ruled 2026-09-23 and built in commit `4758b78`. The proof asserts the
protection, the retired case is split and ACKNOWLEDGED through 2026-09-30, and
`0058_a_retired_protocol_is_not_in_force.sql` is drafted and **pending**, which
holds the merge until the operator applies it.

**THE SUB-QUESTION, AND IT NEEDS A RULING.** The proof replays migration FILES,
not production. So the moment 0058 exists on disk the proof sees the fixed
behaviour, its check passes, and **the acknowledgement stops firing** while
production and development still carry the defect. `proofs-audit` now reports
"no proof is acknowledging anything today".

Nothing is wrong or hidden: the pending ledger entry is what records that
production lacks it, and that is the correct division of labour in this
repository. But the park you asked for is currently **dormant**, measuring a
file rather than a database.

**Three options, none taken:**

| | |
| --- | --- |
| **A** | Leave it. The pending ledger entry holds the merge; the park is dormant but harmless |
| **B** | Keep 0058 off the branch entirely so the acknowledgement stays live, and bring the file to your sitting |
| **C** | Give the park an `isRetired` reading the ledger, so it retires when 0058 reaches PRODUCTION rather than when the file appears |

**Recommendation: C.** It keeps the park measuring the thing that is actually
still broken, and it uses the retiring-event machinery built on 2026-09-22
rather than inventing anything.

### 2. What counts as recording an AQI-1 submission?

**Deadline 2026-12-21.** The operator's word with a date, or an artefact.

**Recommendation: the operator's word.** A TDI receipt for an individual
licensee carries personal details, and the 2026-09-21 rule is that such a
capture is not taken. Full reasoning in section 5.

### 3. Self service sign up: split the secret first?

**Recommendation: yes, and it is the operator's half a sitting, not a session's.**
`selfServiceSignUpOpen()` reads one boolean and does not consult the gate, so
clearing it opens sign up on every Preview immediately, while
`CUSTOMER_SESSION_SECRET` is still recorded as shared with Preview.

**A second question inside it:** should `selfServiceSignUpOpen()` also require a
non-preview deployment, so the order cannot be got wrong? One sitting including a
proof both ways. I did not build it.

### 4. `mfa-audit`: chase it now, or instrument and wait?

**Recommendation: instrument and wait, and record it rather than chase it.** It
is unreproducible standalone across two runs, and a profile of a healthy run is
not evidence about a failing one. It should join `/portal/accounts` as a fault
that needs instrumentation already running when it fires.

**It does not block the merge on this branch**, because the branch cannot have
caused it and `main` was green on it hours earlier. That is your call, not mine.

### 5. Two pre-existing en dashes in `BACKLOG.md`

At lines 4553 and 4555, inside a historical table using them as range
separators. Present on the last green board, so outside `placeholder-audit`'s
scope. Standing law says no en dashes anywhere.

**Recommendation: leave them.** They are in a struck-through historical record,
not rendered copy, and editing history to satisfy a style rule is worse than the
inconsistency. Noted so it is a decision rather than an oversight.

---

## 10. WHAT WAS DONE, AND THE RULES THIS RUN WORKED UNDER

**Branch `feat/overnight-2026-09-23` from `main` at `6685a3a`. Five commits.
Nothing merged, nothing pushed, nothing deleted.**

| Commit | What |
| --- | --- |
| `ff0a8bb` | The SOC 2 pack no longer cites a proof no board runs |
| `edc0177` | Every proof runs, and none is reached by nothing |
| `1704882` | The engineer's TDI orientation, recorded as reported |
| `6240042` | Where an AQI-1 submission would be recorded, as a proposal |
| this one | This report |

**No production access of any kind.** `ALLOW_PRODUCTION_DB` was never set. The
only database read was development, for regenerating the SOC 2 pack, through the
guard that refuses production without the flag. No Supabase, Vercel or Stripe
writes. No secret value read.

**Everything added to an audit was run standalone and injection-verified**, each
injection restored by copy and confirmed byte identical. The board ran alone,
with a prediction stated first, and nothing beside it.

**Fixtures I created and removed:** one file with an unaccounted extension in
`scripts/proofs/`, for an injection. Nothing else was deleted.

### Three mistakes worth carrying, all caught by running things

**Removing `shell: true` made seven proofs report failures they never had.** The
executable on Windows is a `.cmd` that cannot launch without a shell, so every
tsx proof returned `exit null`. Caught by running standalone; fixed by invoking
tsx's own bin entry under `node` and by treating a null exit as could-not-run.

**A constant used before its declaration crashed the new audit outright.** Caught
because it was run standalone before being wired into the suite, which is the
rule that exists for exactly this.

**A `grep -P` with a brace escape would not compile and answered
`pattern-error`.** That is the 2026-09-17 hazard: a pattern that cannot run
reads as a clean result. Long dashes were checked by code point with a script
instead, which is how the two in `BACKLOG.md` were found at all.

---

## 11. FOUND WHILE CLEARING UP, AFTER THE REPORT WAS COMMITTED: AN ORPHANED `launch-audit` WAS RESPAWNING SERVERS

**This section was added after the report was first committed, which is a
deliberate departure from "commit it, then stop". It is here because it is the
mechanism that killed a board on 2026-09-22 and because it is a lead on
question 4.**

### What was found

The last act of the run was to confirm the machine was clear, using the guard
built the night before. It reported a blocker:

```
PID 34452  "C:\Program Files\nodejs\node.exe" node_modules/next/dist/bin/next start -p 3141
```

Killing it produced another immediately. Tracing the tree rather than killing in
a loop:

```
child  : 34452  next start -p 3141
parent : 30396  node scripts/launch-audit.mjs
grandpa: 3372   cmd.exe /d /s /c node scripts/launch-audit.mjs
```

**An orphaned `launch-audit` was alive and starting a fresh server each time one
was killed.** Killing the tree from the `cmd.exe` wrapper cleared seven
processes and the machine went clean.

### Why it matters rather than being tidying

**This is exactly the mechanism that killed the board on 2026-09-22**, which
stopped after 32 of 58 audits with its server gone and its log ending cleanly.
The guard built in response is what found this one, on its author, on the first
night it existed. That is the fix working.

**And `launch-audit`'s own build guard kills whatever holds an audit port.** An
orphan of it, alive during a board, is a process that can clear the board's own
server out from under it.

### The lead on question 4, labelled as a lead and not an explanation

`mfa-audit` failed once on this board with a 307 on a full session and passed
twice standalone. **An orphaned `launch-audit` was alive during that board.**
Whether it disturbed anything is NOT established: it held 3141, and `mfa-audit`
drives 3225.

**No story is attached.** What is recorded is that an unaccounted process was
running during the board that produced the unreproducible failure, which is a
fact worth having before anybody profiles it.

### What is NOT known, and should not be guessed

**Where it came from.** The board's own `launch-audit` ran as
`tsx --conditions=react-server scripts/launch-audit.mjs` and **passed**. The
orphan was `node scripts/launch-audit.mjs` under a `cmd.exe` wrapper, which is
neither the board's invocation nor the `npm run` one. I could not establish what
spawned it and have not invented an account.

**Recommendation:** treat the standing habit of checking the machine before a
board as insufficient, because this process was invisible to the old detection
and survived across runs. The port range item already in `BACKLOG.md` is the
related fix: the guard scans 3223 to 3229 and this sat on 3141, caught only by
the ownership half.

