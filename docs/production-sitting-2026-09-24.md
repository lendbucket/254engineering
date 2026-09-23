# The production sitting, 2026-09-24

Prepared the night before, with the operator at the keyboard for the whole of
it. Three items, in order: **Aman's approval**, **0058**, **the session
secrets**.

**NO SECRET VALUE ENTERS THE SESSION AT ANY POINT.** Not a key, not a passphrase,
not a generated string, not pasted "just to check the format". Where a value is
needed, the operator generates it and puts it straight into Vercel, and the
session is told only that it is done. The production service role key stays out
of the working tree, which is standing law in section 6b.

---

## READ THIS FIRST: the third item is a SPLIT, not a rotation

The instruction said "the session secret rotation". **What the record says is
not a rotation**, and the difference is the difference between a normal morning
and a lockout.

`src/config/credential-inventory.ts` records the plan for all three secrets in
its own words: the operator is **"splitting each into two entries with different
values, Production untouched"**.

**For `MFA_ENCRYPTION_KEY` that is not a preference, it is the whole safety
margin.** The same file, on that entry:

> THE PRODUCTION VALUE IS NEVER CHANGED. `encryptionKey()` is
> `sha256("eng-mfa-v1:" + this)`, and every enrolment's ciphertext is under the
> current one, so changing it makes every second factor undecryptable and the
> failure presents exactly like a wrong code.

**Changing the production `MFA_ENCRYPTION_KEY` locks out every enrolled account,
and the screen will say the code is wrong.** That is the 2026-09-13 incident
exactly: four hours lost to the wrong diagnosis, and the enrolment cleared by
hand against the database in the end.

**The one piece of good news, read in the code rather than hoped for.** Recovery
codes do not depend on that key: they are scrypt hashed against a salt of the
user id. So a lockout is recoverable by somebody holding their recovery codes,
and `MFA_BREAK_GLASS` is the second way back, now proven end to end by
`break-glass-audit` at 32 of 32.

**So before item three starts, one question needs answering out loud:** is the
intent to give Preview its own values with Production untouched, which is what
the record describes and what closes the finding, or to genuinely rotate
Production's secrets. If it is the second, `MFA_ENCRYPTION_KEY` needs its own
plan and its own sitting, and it does not happen alongside two other changes.

---

## Item 1. Aman's approval in the register

**One ambiguity to settle before starting.** "With layer two" has two readings
and they are different work. Either **the database half**, meaning the approval
also exists as a row, `eng_protocol_templates` moving from `awaiting_engineer`
to `published` through `eng_approve_protocol` and his own account, which is the
two-homes shape 0049 built deliberately. Or **the commit guard's layer two**,
the git `pre-commit` hook under `.githooks/` recorded in CLAUDE.md section 6 as
NOT BUILT. The checklist below assumes the first. If the second was meant, it is
independent work and does not belong in a production sitting.

| | Who | What |
| --- | --- | --- |
| 1.1 | **Session** | `git fetch`, report `main`, `origin/main` and every unmerged branch. Nothing is assumed from last night's context. |
| 1.2 | **Operator** | Sign in to the portal **as Aman**, on production, with his own second factor. Approve 254-RC-001 v1.0. Nobody else can do this and no script may do it for him. |
| 1.3 | **Operator** | Read back, on the screen, that the protocol shows as approved with **his name and the date**. A screenshot to `docs/compliance/` if he wants the record. |
| 1.4 | **Session** | Prepare the `approvedProtocols` entry in `src/config/launch-readiness.ts` on a branch, with the values HE reads off the screen. The session invents no name, no date and no version. |
| 1.5 | **Session** | Run `compliance-audit` and `protocol-registry-audit` standalone. Both must be green before anything else happens. |
| 1.6 | **Session** | Board, alone, after a stated prediction. |
| 1.7 | **Operator** | Merge is the session's on his word, fast forward only. **He pushes.** |

**Why the config entry is not enough and the row is not enough either.** The row
is what the platform enforces; the register is what the gate reads. They are two
homes for one fact on purpose, and the check that keeps them honest is that
`compliance-audit` reads the register while the database constraint added by
0049 refuses a published row with no approver and no date.

---

## Item 2. The 0058 migration

**State tonight**, read off git rather than remembered: `feat/0058-retired-protocol`
is at `1253913`, **two commits**, and it is based on `cdb1508`, which is **not**
current `main` at `9cad9c6`. It carries the migration, its PENDING ledger entry,
and the option C park that retires itself when the ledger says production has it.

**The rule that makes this a sitting rather than a merge:** a migration on `main`
is never pending. Either it reaches production in the merge sequence or it does
not merge.

| | Who | What |
| --- | --- | --- |
| 2.1 | **Session** | Rebase `feat/0058-retired-protocol` onto `main`. It is two commits and the base is four behind. |
| 2.2 | **Session** | `migration-audit` standalone. It replays every migration into an in process Postgres and needs no database and no credentials. |
| 2.3 | **Session** | The proof `a-signed-protocol-is-not-a-draft` standalone. **It is red on `main` today** and 0058 is the fix, so this is the run that proves it. The park expires 2026-09-30 and should retire here. |
| 2.4 | **Operator** | Says the word before anything touches production. |
| 2.5 | **Session** | Apply to production **through the Supabase MCP `apply_migration`**, never `execute_sql`. That is standing law: `apply_migration` writes a row into the provider's own migration history and `execute_sql` changes the database silently. |
| 2.6 | **Session** | Read back through the MCP: the shape fingerprint, the column and table counts, and the specific thing 0058 uniquely adds. Compare against the ledger's prediction. **A difference in any COUNT stops the sitting.** A digest difference against a live project is recorded with its explanation, per the 2026-09-12 ruling. |
| 2.7 | **Session** | Update `supabase/applied.mjs`: `appliedBy`, the fingerprint, the counts actually read back. Then `schema-ledger-audit` standalone, which should go from red to green on its own. |
| 2.8 | **Session** | Board, alone, after a stated prediction. The park should now read retired without anybody editing it, which is the thing option C was chosen for and has never been observed. |
| 2.9 | **Operator** | Merge on his word, fast forward only. **He pushes.** |

**What the session must not do.** Set `ALLOW_PRODUCTION_DB`. Ask for the
production key. Run `production-schema-check`, which needs that key: if that
check is wanted, the operator runs it himself in his own shell.

---

## Item 3. The session secrets

**Read the box at the top of this document first.** What follows assumes the
answer is a SPLIT with Production untouched, which is what the record describes.

Three secrets are declared as shared between Production and Preview, and the
board is red on it until that changes: `CUSTOMER_SESSION_SECRET`,
`PARTNER_SESSION_SECRET`, `MFA_ENCRYPTION_KEY`. `OPS_SESSION_SECRET` is already
split, which is what made the other three legible as a defect rather than as a
configuration.

| | Who | What |
| --- | --- | --- |
| 3.1 | **Operator** | In Vercel, for each of the three: scope the EXISTING entry to Production only. Production's value does not change. |
| 3.2 | **Operator** | Add a NEW Preview entry for each, with a freshly generated value. **The session never sees any of these values and must not be told them.** |
| 3.3 | **Operator** | Redeploy a preview so the new values take effect, and sign in on that preview to confirm it still works. |
| 3.4 | **Operator** | Confirm on production that he can still sign in **with his second factor**. This is the one that matters, and it is why the MFA entry is done last. |
| 3.5 | **Session** | Update `src/config/credential-inventory.ts`: each of the three `environments` block moves to distinct, with the DATE and WHO looked. The session records what he read off the dashboard and states that it cannot see Vercel. |
| 3.6 | **Session** | `soc2-audit` standalone. It should go green on the shared-secret assertion. |
| 3.7 | **Session** | Board, alone, after a stated prediction. |
| 3.8 | **Operator** | Merge on his word. **He pushes.** |

**The order inside item 3 is deliberate.** The two session secrets first, because
their worst case is that somebody is signed out. `MFA_ENCRYPTION_KEY` last,
because its worst case is a lockout, and doing it last means every other change
is already confirmed working when the riskiest one happens.

**Before 3.4, have the way back open.** Either his recovery codes to hand, or
`MFA_BREAK_GLASS` set for his account on Production. The break glass is proven
end to end as of today and its own audit says what the variable must look like.

---

## The shape of the whole sitting

**Three items, three boards, three merges.** Not one board at the end. Each item
changes a different kind of thing, and a single board over all three cannot say
which one broke something.

**Nothing in this document is a decision.** Every ruling stays the operator's,
and the two questions that need answering before anything starts are the meaning
of "layer two" in item 1 and whether item 3 is a split or a rotation.
