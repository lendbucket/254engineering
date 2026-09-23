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
