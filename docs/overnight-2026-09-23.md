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

## 8c. REPORT: the Stripe deadlock is real, and finding it found something worse

**Report only, as ruled. No code written for any of this.**

### The deadlock is real

`chargesBlockedReason()` blocks only when `isPrelaunch()`, so a charge is
permitted in **trading**. That is not where the lock is.

**The lock is the order.** Every order path asks
`orderBlockedReason(entry, prelaunch, hasApprovedProtocol)`, and five of the six
call sites pass **`!isOpen()`**:

```
src/app/(site)/order/start/[slug]/page.tsx:46   const prelaunch = !isOpen();
src/app/account/order/page.tsx:28               const prelaunch = !isOpen();
src/lib/ops-bulk.ts:87                          !isOpen()
src/lib/ops-intake.ts:252, 583                  !isOpen()
src/lib/ops-job-billing.ts:241                  false, with a stated reason
```

So: a charge needs an order. An order needs `isOpen()`. `isOpen()` needs the
`stripe` condition. The `stripe` condition needs a charge **and its refund**
recorded in `stripeAccount.proof`.

**That is a closed loop, and nothing in the platform breaks it.** The plan
placing the test order "after the gate opens" cannot happen, because the gate
cannot open until the test order has happened.

### THE PARAMETER IS NAMED `prelaunch` AND HOLDS `!isOpen()`

Those are different facts and the name says the wrong one. It matters because of
what the function does with it:

```ts
if (prelaunch) {
  return "The firm's registration with the Texas Board of Professional
          Engineers and Land Surveyors is pending. No order can be placed
          and no payment can be taken until it is active.";
}
```

**In trading mode that sentence is FALSE.** The registration is not pending. It
is F-29811, active, expiring 2027-07-31, issued to 254 Engineering LLC.

### AND IT IS RENDERED TO A VISITOR TODAY

`order/start/[slug]/page.tsx:74` renders `{blockedReason}` in the page body.
With `!isOpen()` true, which it is on the deployment right now, a visitor to any
order page is told the firm's TBPELS registration is pending.

**This is the inverse of the defect the gate exists to prevent.** The gate stops
the firm claiming capability it lacks. This has it disclaiming a registration it
holds, on a compliance sentence, in the one place a buyer looks.

It also never reaches the protocol message beneath it, so the true reason, that
no protocol is approved, is never the one shown.

### WHY NO CHECK CAUGHT IT

`compliance-audit` has exactly the right check:

> no surface says the registration is pending or not yet issued, because the
> register holds an active one (429 files read)

**It passes, and it is honest about what it read.** Its sweep is `walk("src")`.
`orderBlockedReason` lives in **`data/catalog.ts`**, which is not under `src`.

A green audit is a green audit of the files it read, and the file list is the
filter nobody thinks of as one. This is the same shape as the untracked-file
blind spot already recorded in CLAUDE.md, with a directory boundary in place of
a git one.

### How to break the deadlock, three ways

**A. Move the order gate from `isOpen()` to `isTrading()` plus the protocol.**
The most honest, because it says what is actually true: a registered firm with
an engineer of record and an approved protocol can take an order; the `stripe`
condition is about proving the money path, not about permission to sell. **It is
also the largest change and touches six call sites.**

**B. An operator-only path, which is question 4b and my recommendation.** One
order, placed by the operator, through a door no customer can reach, permitted
while the gate is shut. Bounded and reversible.

**C. Record the proof from a Stripe test made outside the platform.** Rejected:
the whole value of the condition is that it exercises THIS platform's charge and
refund path end to end, including the webhook arriving. A charge made in the
dashboard proves the account works and nothing about the code.

**My recommendation is B, with A recorded as the eventual correct shape.** B
unblocks launch without redefining what the gate means; A is the honest model
and should not be rushed while four other conditions are still shut.

**Whatever is chosen, the false sentence and the sweep gap are separate and
should be fixed first**, because they are live on the deployment today and are
not blocked on anything.

---

## 8d. REPORT: insurance and technician training as gate conditions

**Report only. No code written. Designed in the shape the existing nine use.**

### Why they belong in the register

Both are facts about the world that a person establishes and a file records,
which is exactly what `verifiedFirmRegistrations`, `verifiedEngineers`,
`pointInTimeRecovery` and `stripeAccount` already are. Neither can be derived,
and both gate whether work may be performed rather than whether a page may make
a claim.

**And the engineer has already made training a condition of his own.** Section 5
of 254-RC-001 requires training on the protocol with a supervised inspection
before independent work, and `docs/overnight-2026-09-22.md` ranks it sixth of
what blocks roof certification. It is currently enforced by nothing.

### `insuranceBound`, gating `open`

| Field | Why |
| --- | --- |
| `bound: boolean` | The single fact |
| `carrier`, `policyNumber` | So the claim is checkable by somebody who does not trust the file |
| `coverage` | What scope it covers, because a policy that excludes windstorm is not cover for a windstorm line |
| `effective`, `expires` | An expiry, checked like a licence. **An unrecorded expiry is not current**, the rule `activeEngineer()` already enforces |
| `statedBy`, `statedOn` | Attribution and date |
| `evidence` | A digest of the certificate, hashed against disk the way the Stripe captures are |

**The unmet sentence:** "No professional liability policy is recorded as bound,
so the firm cannot perform work it would be answerable for."

### `technicianTraining`, and it is NOT one condition

**A single boolean would be wrong**, and this is the part I would argue for. The
requirement is per technician and per protocol: a technician trained on
254-RC-001 is not trained on a windstorm protocol that does not exist yet.

So: a list of `{ technicianId, protocolDocumentNumber, protocolVersion,
trainedOn, supervisedInspectionOn, attestedBy }`, where `attestedBy` must be the
engineer of record, and the condition is met when **every technician who can be
dispatched** for an offered line has a record for that line's approved protocol.

**That makes it derive from two things already in the register** rather than
being a second copy: the approved protocol list and the dispatchable roster.

**The unmet sentence:** names the technicians and the protocol they lack, rather
than saying training is incomplete.

### The operator-only path for the first charge and refund

**The shape, and every part of it is a constraint rather than a feature:**

1. **A distinct door.** Not a flag on the public path. A route reachable only
   with an operator session holding a grant that exists for this and nothing
   else, so no customer path is widened.
2. **It writes a real order through the real code.** The entire value is that it
   exercises checkout, the charge, the webhook and the refund exactly as a
   customer would. A parallel code path proves nothing.
3. **The row is marked at insert, not afterwards.** `is_demo` already exists and
   the demo sweep already excludes such rows from every figure. A row marked
   after the fact is a row that was real for a while.
4. **It refuses to run twice.** The condition needs one charge and one refund.
   A path that can be used repeatedly is a path that will be.
5. **It writes the proof itself**, or it does not count. If the operator has to
   copy identifiers into `stripeAccount.proof` by hand, the record is a
   transcription and the thing this condition exists to prevent is a
   transcription.
6. **It is refused once `stripeAccount.proof` is non-null.** It exists to break
   a deadlock, and after that it is a way to charge a card outside the gate.

**What I would not do:** make it available in prelaunch. The firm may not
perform engineering work then, and a charge implies an engagement.

**Estimate: one sitting**, with the operator present, because it ends in a real
card being charged and refunded on production.

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

### ANSWERED 2026-09-23: THE BOARD DOES NOT LEAVE IT ALIVE. I DID.

Operator ruling: find where it came from, and why a board leaves it alive.
**Report before fixing. Nothing is fixed.**

**The board does not leave it alive, and that is the first correction.**
`scripts/audit.mjs:859` runs `spawnSync("npm", ["run", audit.name])`, which for
this audit is `tsx --conditions=react-server scripts/launch-audit.mjs`.
`spawnSync` waits. `launch-audit` PASSED on the board and the next audit ran, so
its process had exited. The board's own run cleans up.

**`launch-audit` tears its servers down correctly**, which had to be checked
rather than assumed. `scripts/launch-audit.mjs:135` stops each server in a
`finally`, and `stopTree` in `scripts/lib/dev-server.mjs:130` does
`taskkill /pid <child> /T /F` on Windows. A normal run leaves nothing.

**So it takes an ABNORMAL exit, and the evidence says what kind.**

`launch-audit` starts three servers one after another. If somebody kills the
SERVER process directly, the `launch-audit` parent survives, its `finally` never
runs for a child that is already dead, and **it proceeds to start the next
one**. That is exactly what was observed: killing PID 34452 produced another
immediately, and tracing the tree found `node scripts/launch-audit.mjs` above
it.

**And the kills were mine.** On 2026-09-22 I cleared servers by PID twice, and
Windows said so in its own output each time:

```
SUCCESS: The process with PID 31996 (child process of PID 34400) has been terminated.
SUCCESS: The process with PID 17252 (child process of PID 35124) has been terminated.
```

**Both name a parent I did not kill.** `/T` kills a process's CHILDREN, not its
parent, so tree-killing the server leaves the audit that owns it running. The
same pattern appears in tonight's first kill: PID 6200 was reported as a "child
process of PID 30396", which was the `launch-audit` that then spawned another.

**`BACKLOG.md` already records this hazard from 2026-09-21** in almost these
words: every server started for a standalone audit was killed by PID and left a
child holding the port. What was not recorded is the inverse, which is the
dangerous half: **killing the child leaves the PARENT, and the parent starts a
new server.**

### Why it matters more than tidiness

An orphaned `launch-audit` is not an idle process. It **starts servers**, and
`launch-audit`'s own build guard kills whatever holds an audit port. A live one
during a board is a process that can clear the board's server out from under it,
which is the mechanism that stopped the board of 2026-09-22 after 32 of 58
audits.

### The fix, NOT MADE, for a ruling

**The guard names the blocker. It should also name what OWNS the blocker**, so
somebody clearing a stale server kills the thing that will otherwise replace it.
`findBlockers` already reads each blocker's command line; reading its
`ParentProcessId` and reporting the parent when that parent is a node process in
this repository is a small addition to `scripts/lib/build-guard.mjs`.

**And the `taskkill` line the guard prints should target the owner**, not the
server, in that case. Today it prints the server's PID, which is the kill that
creates this situation.

**Recommendation: build both, in one change, with a proof feeding the classifier
a parent chain.** It is the difference between a guard that reports a symptom
and one that names the cause.

## 12. THE MERGE OF 2026-09-23, AND THE RULING THAT ALLOWED IT ON A BOARD THAT WAS NOT GREEN

Recorded here at the operator's instruction. It belongs in a merge commit and
there is no merge commit, because the merge was fast forward only, so it is in
the run's own record instead. It is on the branch that follows the merge rather
than committed straight onto `main`, because **the board must measure everything
that merges**, and a documentation commit is exactly the one somebody waves
through.

### What the board said

`feat/overnight-2026-09-23` at `76057a9`, run alone after a stated prediction:

```
56 PASS, 1 FAIL, 2 COULD NOT TELL, of 59
1 of 59 audits failed: break-glass-audit
2 of 59 audits could not measure: mobile-overflow-audit, native-audit
```

The prediction had been 59, 0, 0. It was falsified twice, and both gaps carried
information, which is the whole argument for stating one.

### The ruling, and its reasons

**Merge.** Operator ruling, 2026-09-23. The reasons, in his words and order:

**One. The FAIL is a transport fault, not a finding.** `break-glass-audit` went
red on `the run completed (probe account: fetch failed)`. `createUser` threw
reaching the database, the catch recorded it as a failed check, and the audit
printed "a break glass that is not exercised is a recovery path that exists only
in a document" beneath it. A standalone re-run minutes later passed **32 of 32**,
including the enrolment being cleared and the audit trail rows. The recovery path
works. Nothing was ever put in front of it.

**Two. The two could-not-tells are the known stall on a screen this branch did
not touch.** Both are `/portal/accounts` exceeding a navigation timeout. That
screen is on `main` already and no commit on this branch goes near it. The
2026-09-17 ruling covers it exactly: a board is blocked by a finding on the
branch, never by an audit that could not measure something the branch did not
touch.

**Three, and it is the one that decides it. The public false registration
sentence outweighs a re-run.** Until this merge reaches production, the order
page tells visitors in trading mode that the firm's TBPELS registration is
pending. It is active. That is the gate's own failure inverted, on a compliance
sentence, where a buyer looks. Holding it behind another twenty minute board to
re-prove a transport fault would trade a real, live, public misstatement against
a green line nobody doubts.

### What it did not license

Absorbing either one. Both were queued as work rather than noted and dropped:
the probe fault became `fix/probe-fault-is-could-not-tell`, which fixes the
class across sixteen scripts rather than the one catch block, and the stall
keeps its backlog entry. The board's third verdict undercount, found in the same
log, went into the existing backlog entry as a fourth sighting rather than a new
one.

## 13. THE `/coverage` LCP MISS WAS MACHINE LOAD, AND IT WAS PROVEN RATHER THAN ASSUMED

**THIS SECTION WAS NOT MEASURED BY A BOARD.** It is documentation only, written
after the board that measured the code and committed before the merge on the
operator's instruction. The commit it sits in changes no code. Saying so is the
point: everything else on `integrate/2026-09-23` was measured, this was not, and
a reader should not have to work that out from timestamps.

### What happened

The board on `integrate/2026-09-23` at `a1ad71e` returned **56 PASS, 1 FAIL, 2
COULD NOT TELL of 59**, and the one FAIL was:

```
FAIL: coverage hub: LCP 3540ms within 3400ms (/coverage, median of 3, spread 296ms)
```

### The first reading was wrong, and the rule is what corrected it

The instinct was that 296ms of noise against a 140ms margin meant the
measurement could not resolve the ceiling, so `perf-audit`'s third verdict
should have fired and did not. **That was wrong.** `stabilityLimit` is
`INSTABILITY_FRACTION` of the ceiling, ten percent, so 340ms. The spread was
296ms, under the limit, and `verdictFor` correctly fell through to the median.

The audit gated exactly as designed. Reading the rule rather than reasoning
about the numbers is what settled it, and it is worth recording because the
wrong reading was the comfortable one: it would have turned a FAIL into a
could-not-measure and cleared the branch without anybody looking further.

### The two measurements

| | Ceiling | Median | Spread | Verdict |
| --- | --- | --- | --- | --- |
| Local, loaded laptop, 3 runs, board at `a1ad71e` | 3400ms local | **3540ms** | 296ms | FAIL |
| Local, same machine, 3 runs, board at `76057a9` three hours earlier | 3400ms local | **3193ms** | 55ms | PASS |
| **Production, 5 runs, `https://254engineering.com`** | **2760ms remote** | **2542ms** | 602ms | **PASS** |

### Why production settles it, and the tighter ceiling is the reason

The remote profile's LCP ceiling is **2760ms, not 3400ms**. Production passed a
ceiling 640ms stricter than the one the laptop failed.

**And the production pass is conclusive rather than median based.** The spread
was 602ms against a stability limit of 276ms, so had the ceiling fallen inside
the observed range `verdictFor` would have returned `unstable`. It returned
`pass`, which is only reachable when the SLOWEST of the five runs was inside the
ceiling. All five were.

Bytes agree: 311KB on production against 464KB locally, on a 600KB budget.

### CORRECTED THE SAME EVENING: THE LOAD EXPLANATION IS NOT SUPPORTED

**The paragraph below was written before a third board, and that board falsified
it.** It is kept rather than rewritten, because a wrong explanation that vanishes
is one the next session re-makes, and because the prediction that killed it was
stated in advance.

Before running the board on `fix/heading-follows-mode` the session recorded that
three node processes were building another project on the same machine, and
predicted `perf-audit` would fail again on LCP **for that reason**, writing down
what each outcome would mean. It passed.

```
board 1, quiet machine       PASS  3193ms  spread  55ms
board 2, the failure         FAIL  3540ms  spread 296ms
board 3, wattsmith building  PASS  3189ms  spread  53ms
```

**Board 3 ran under the only load anybody has actually observed and measured
within 4ms of board 1.** So the one piece of evidence that exists about
busyness on this machine argues AGAINST load being the cause.

**What the evidence now supports.** Production is comfortably inside a ceiling
640ms stricter, so `/coverage` is not slow. Board 2 remains a real reading and is
now **unexplained**: a 350ms jump with a fivefold widening of the spread, on one
run out of three, with identical rendering code.

**Its shape is the `/portal/accounts` stall's shape**, intermittent and marked by
a spread that widens sharply when it happens, and that is recorded as a
hypothesis worth testing rather than as a second explanation. The two did not
co-occur cleanly: the stall appeared on boards 2 and 3 and the perf miss only on
board 2, which weakens any story that they are one fault.

**The rule this is an instance of** is already in CLAUDE.md section 6b: an
explanation that covers the observation is not the same as an explanation that is
true, and a wrong one is worse than none because it stops the next session
looking. What made the difference here was writing down, before the run, what a
pass would mean.

### The finding as first written, now superseded

**`/coverage` is not slow.** The miss was load on a machine that had spent the
day building and running boards, and the same route measured 3193ms at a 55ms
spread on the same machine three hours earlier with the same rendering code.

`scripts/lib/perf-verdict.mjs` already records this exact route behaving this
way, 2934ms and then 3454ms an hour apart on one machine, which is why that file
exists at all. **That is not offered as the explanation.** A recorded
explanation is a hypothesis until something re-checks it, and what re-checked it
here is a five run measurement against the live deployment, which is a different
instrument rather than a second appeal to the same story.

### What was ruled, and why the merge did not wait

Operator ruling, 2026-09-23: merge `integrate/2026-09-23` fast forward only
whichever way the production measurement came out, **because `/coverage` is
byte identical on `main` and on the branch and nothing in these six commits
could have changed it.** They touch audit scripts, the board runner, and six
words of rendered copy in five files, none of which reaches that route.

The measurement was run first anyway, because the alternative is merging with a
red board and an unexamined FAIL, and "it cannot be us" is exactly the reasoning
that lets a real regression through on the one occasion it is wrong.

## 14. DESIGN, NOT BUILT: the operator's path to the first live charge and refund

**Nothing in this section is built.** It is read against the code rather than
drawn against a description, per section 2c, and every claim below names the
file it was read from.

### The deadlock, stated exactly

| Step | Blocked by |
| --- | --- |
| A charge needs an order | `startCheckout` in `ops-payments.ts:89` works from an order row |
| An order needs the gate open | `orderBlockedReason` refuses in `prelaunch` and `trading` |
| The gate opens on the `stripe` condition | `openBlockers()` in `launch.ts` |
| The `stripe` condition needs a charge AND its refund | `stripeAccount.proof` in `launch-readiness.ts:68` |

Four steps, and the fourth points at the first. Nothing in the platform can
break it, because every door into an order consults the gate: the web flow, the
v1 API, bulk ordering, and `ops-intake` at both call sites.

### What the path must satisfy

The operator's four requirements, each with where it lands in the code:

1. **A real charge**, so `stripe().checkout.sessions.create` in
   `payments-stripe.ts:89` runs against the live key.
2. **A real webhook**, so `charge.refunded` at `webhook/route.ts:203` and
   `checkout.completed` at `:88` are both exercised by Stripe calling us, which
   is the half `stripe-webhook-audit` cannot prove from inside.
3. **A real refund**, because the refund grammar, the disclosed inspection fee
   and the full refund where nobody attended, is worth nothing until the path
   has run once.
4. **Usable only by his authenticated account**, and **leaving a record the
   `stripe` condition reads.**

### The design

**One route, `POST /api/portal/stripe-proof`, and FOUR independent conditions,
every one of which must hold.** Four rather than one because this route creates
an order without asking the gate, which is a capability that must not exist for
anybody else even for a moment.

| Condition | Why it is not enough on its own |
| --- | --- |
| A full ops session, MFA complete | Every staff member has one |
| The `payments.charge` grant | The administrator role holds it, `ops-authz.ts:416` |
| The caller's email equals a name in CONFIGURATION | This is the identity binding. Same shape as `MFA_BREAK_GLASS`: one named account, not a role |
| `stripeAccount.proof` is still `null` | **The route deletes itself.** Once the proof exists the path is dead, so the window is one use wide |

**Plus three narrowing rules**: the amount is capped in the source at a figure
this file recommends as **$1.00**, which is above Stripe's fifty cent floor and
below anything worth stealing; every attempt, refused or not, writes to
`eng_audit_events`; and the order row is marked as a demonstration record the
way probe accounts are, so `demo-audit`'s existing sweep keeps it out of every
figure on every screen.

### It does NOT write its own proof, and that is the load bearing decision

The run finishes by **printing** the four values `stripeAccount.proof` wants:
`chargeId`, `refundId`, `on`, `amountCents`. The operator pastes them into
`src/config/launch-readiness.ts` in a commit.

**A platform that writes its own gate condition is a gate with one home.** The
whole design of `LAUNCH_CONDITIONS` is that every condition is read from
configuration "so the flip is impossible until each is stated true in a file
somebody edits on purpose". A route that could set `proof` would be a route that
opens the compliance gate, which is precisely the thing this repository refuses
to let any process do without a deploy and an audit trail.

**And the pasted claim is then checkable rather than trusted.**
`stripe-webhook-audit` already talks to the account behind `STRIPE_SECRET_KEY`.
It gains a live check that the recorded `chargeId` and `refundId` exist in that
account, for that amount, on that date. So the config says what happened and
something other than the config agrees, which is the rule about declarations.

### The hazard this opens, asked the way the 2026-09-13 ruling says to ask it

Not "does the old defect get caught" but **what does the new code make possible
that the old code did not.** It makes possible an order that never consulted the
compliance gate. That is the exact capability the gate exists to remove.

So the checks to write against the NEW code, before it is built:

- a caller with a full session and `payments.charge` but the **wrong email** is refused, and refused before any Stripe call
- a caller with the right email and **no MFA** is refused
- the route is refused **once `proof` is non null**, which is the state it will be in for the rest of the firm's life
- an amount above the cap is refused
- the order it creates is **excluded from every figure**, asserted by pointing `demo-audit`'s existing sweep at it
- nothing else in the repository can call the order-creating function it uses

### What needs a ruling before anything is built

1. **The amount.** Recommended $1.00.
2. **Which account.** The email to bind, and whether it lives in
   `launch-readiness.ts` beside the condition or in its own record.
3. **Whether the charge is against a real deliverable or a proving line.**
   Recommended: a proving line, so no catalogue price is involved and no report
   can mistake it for revenue.
4. **Whether the refund goes through `cancelAndRefund`** at
   `ops-payments.ts:1118`, which exercises the real operator path, **or the
   provider directly.** Recommended `cancelAndRefund`, because exercising the
   real path is the point.

## 15. DESIGN, NOT BUILT: insurance and technician training as gate conditions

### Insurance

**Nothing in this repository records the firm's insurance.** Checked rather than
assumed: every match for "insurance" under `src/config` and `src/lib` is either
a technician's own cover in `ops-credentials.ts:241` and `:242`, a form field,
or an email template. There is no firm policy anywhere.

**The design mirrors `verifiedFirmRegistrations` exactly**, because that record
already solves this problem for a credential the firm holds: a declared entry
with carrier, policy number, coverage limits, effective date and **expiry**, and
an `activeInsurance()` deriver beside `activeFirmRegistration()`.

**`expires: null` is refused.** That is the 2026-09-16 ruling about an engineer's
licence with no recorded expiry: an unknown is a different state from current,
and for a condition that gates taking money the unknown answer is the shut one.

**Which state it gates is a ruling, and my recommendation is `open`.** Trading is
quoting and enquiries. `open` is the firm taking money for sealed engineering
work, which is when a claim becomes possible.

**One thing I will not state as fact.** Whether TBPELS requires professional
liability cover for a registered firm is **not something I have verified**, and I
am not going to infer it. It must be confirmed with the board or with counsel
before anybody relies on a sentence about it, and until then this condition is a
business decision rather than a regulatory one.

### Technician training

**The shape it should NOT take is a global condition.** One untrained technician
would shut every service line, which is both wrong and the kind of blunt
instrument somebody eventually works around.

**It follows the protocol, which is already per line.** `serviceLineIsOffered`
gates each line on its own approved protocol. Training joins it: a line is
offered when its protocol is approved **and** every technician who can be
dispatched on it has been recorded as trained on that protocol version.

**The version matters and is the part worth designing carefully.** 254-RC-001 is
at v1.0. A technician trained on v1.0 is not thereby trained on v1.1, and a
record that does not carry the version will read as current for ever. The record
is keyed on `(profile, protocol, version)`.

**Where it is recorded, and the tension.** Launch conditions read configuration
by design. Training is per person and belongs in the database beside
`eng_credentials`. The honest resolution is the one the Stripe console record
already uses: **a dated, attributed attestation in configuration, asserted
against something the repository owns.** The attestation says training is
complete as of a date; a check compares it against the dispatchable technicians
and the offered lines in the database and goes red when somebody is added who is
not covered. The attestation alone would go stale silently, which is the defect
the declared inventory idiom exists to prevent.

### What needs a ruling

1. Whether insurance gates `trading` or `open`. Recommended `open`.
2. Whether a lapsed policy shuts the gate immediately or raises an alert.
   Recommended: shuts it, same as an expired registration.
3. Whether training blocks a LINE or blocks DISPATCH of a given technician.
   Recommended: blocks dispatch of that technician on that line, and blocks the
   line only when it would leave nobody able to perform it.

