# Phase 14 surveys

**Report only. Nothing in this document was fixed. It is three sweeps the
operator ordered on 2026-09-13, written the night of 2026-09-14 after Phase 13
Section 2 landed.**

Each survey exists because a specific incident showed that a class of defect was
invisible to every check this repository has. The point of a survey is to find
the other instances before one of them is the incident.

---

## SURVEY 1: STATUS FUNCTIONS RETURNED AS USER-FACING ERRORS

**The rule this comes from.** An error assembled from a status function can only
name the faults that function can see, so the fault it cannot see reaches the
user as a lie.

**The incident.** `answerChallenge` returned `{ ok: false, error: mfaStatus() }`
when decryption failed. `mfaStatus` asks whether `MFA_ENCRYPTION_KEY` is present
and at least 24 characters. A key REPLACED with another valid value passes both,
so the operator's working phone was answered with

    MFA_ENCRYPTION_KEY is configured.

in the red error slot, for four hours.

### What exists

Five functions in `src/lib/` return a status sentence:

| Function | Faults it can name |
| --- | --- |
| `mfaStatus()` | absent, shorter than 24 characters |
| `opsSessionStatus()` | absent, too short |
| `partnerSessionStatus()` | absent, too short |
| `customerSessionStatus()` | absent, too short |
| `breakGlassStatus()` | absent, set and malformed, set and valid |

### Every place one reaches a user

**Two remain in an error slot, and both are in the module the incident was in.**

| Site | What it cannot describe |
| --- | --- |
| `src/lib/ops-mfa.ts:337` — `beginEnrolment`, `if (!mfaConfigured()) return { ok: false, error: mfaStatus() }` | Nothing. This branch is reached ONLY when `mfaConfigured()` is false, which is exactly the two faults `mfaStatus` can name. The sentence is complete for the branch that produces it. |
| `src/lib/ops-mfa.ts:341` — `beginEnrolment`, `if (!cipher) return { ok: false, error: mfaStatus() }` | **A key that is present, long enough, and not the one anything else used.** `encryptSecret` returns null only when the key is absent or short, so today this is unreachable for any other reason. It is one `encryptSecret` change away from being the original defect again. |

**Two render a status in a banner rather than an error slot**, and both are
correct: `src/app/portal/(public)/mfa/page.tsx:94` and
`.../mfa/enrol/page.tsx:100` are gated on `mfaConfigured()` being false, so the
sentence is again complete for the condition that shows it.

**Two are on the operator observability screen** and name no fault at all:
`breakGlassStatus()` and `partnerSessionStatus()` in
`src/lib/ops-observability.ts`. They are descriptions rather than errors.

### The finding

**The survey is nearly empty, and that is the result rather than a failure of
the sweep.** The pattern was one module's habit rather than a platform-wide one,
and the two remaining sites are both *currently* complete because each is
guarded by the same predicate the status function tests.

**What makes them worth listing is that the guard and the sentence are two
different pieces of code that happen to agree.** The incident was created by
exactly that agreement breaking: `answerChallenge` was guarded by a decryption
failure while its sentence described key configuration, and nobody noticed the
two had drifted apart.

**The ranked concern:** `ops-mfa.ts:341` is the one to fix first, because
`encryptSecret` gaining any third failure mode silently recreates the original
defect in the original module.

**`customerSessionStatus()` has no callers at all.** Declared and returned by
nothing. Either a surface should be using it or it should go; a status function
nobody calls is a sentence nobody will maintain.

---

## SURVEY 2: BOUNDARIES COMPARING CLOCKS ACROSS SOURCES

**The rule this comes from.** A boundary that depends on two unsynchronised
clocks agreeing is not a boundary. It is a race that usually goes the right way,
which is worse than no boundary, because it reports itself as working.

**The incident.** The recovery-code acknowledgement compared an enrolment's
`verified_at`, written by the database through `transaction_timestamp()`,
against a session start derived from a cookie minted with `Date.now()`. It
passed standalone twice and went red on a board run.

### What was checked

Every comparison in `src/lib/` where a time is tested against another time. The
question is not "does this use `Date.now()`" but "is the OTHER side of the
comparison from a different clock".

### Consistent, and therefore not findings

Four token expiries write `expires_at` from `Date.now()` and read it back
against `Date.now()`. One clock at both ends, so skew cancels entirely.

| Site | |
| --- | --- |
| `customer-auth.ts:134` writes, `:163` compares | set-password and reset links |
| `ops-auth.ts:78` writes, `:457` compares | staff invitation tokens |
| `ops-intake.ts:687` writes, `:708` compares | customer order-status links |
| `partner-auth.ts` writes and compares | partner set-password links |

### The findings, ranked by what the slack buys

**1. `ops-statements.ts:317` and `:321` — a statement's issue date and due date
come from two different clocks, in one statement.**

```ts
const dueAt = new Date(Date.now() + netDays * 86_400_000).toISOString();
await db.from("eng_statements")
  .update({ status: "issued", issued_at: DB_NOW, due_at: dueAt })
```

`issued_at` is the database's clock. `due_at` is the application's, offset by
the account's net days. **What the slack buys:** a net-30 window that is not
thirty days from the recorded issue date. If the application clock runs ahead,
the customer gets slightly longer than the terms say; behind, slightly less, and
the statement's own two dates disagree about its terms. This is the one that
touches money and a customer's contractual window, and it is the clearest
instance of the pattern.

**2. `ops-retention.ts:191` `cutoffFor` — the deletion floor is an application
clock compared against database timestamps.**

```ts
return new Date(now.getTime() - days * 86_400_000).toISOString();
```

The cutoff is built from the application clock and compared with `.lt()` against
an age column every row of which was written by the database. **What the slack
buys:** rows slightly younger than the floor are deleted, or slightly older
survive. The floor is thirty days and plausible skew is seconds, so nothing is
at risk in practice. **It is ranked second rather than dismissed because it is
the only cross-clock comparison in this platform that DESTROYS data**, and no
later audit can tell a deleted row from a row that never existed.

**3. `ops-bulk.ts:415` — overdue days, and the credit gate downstream of it.**

```ts
const days = Math.floor((Date.now() - Date.parse(s.due_at)) / 86_400_000);
```

Here `due_at` came from the application clock too, so the comparison is
consistent and this is NOT a cross-clock defect. It is listed because it is one
edit away from becoming one: if finding 1 is fixed by moving `due_at` to the
database clock, this comparison silently becomes cross-clock, and it feeds
`creditDecision`, which decides whether an account may order.

**That is the trap worth recording: fixing finding 1 the obvious way creates
finding 3.** Both sides have to move together.

### What was NOT found

No cross-clock comparison in a SECURITY boundary survives. The MFA one was the
only instance and it was replaced with a signed completion token that compares
no clocks for its binding. Session expiry throughout is `exp` in a signed
payload against `Date.now()`, minted and read by the same process class.

---

## SURVEY 3: RECOVERY PATHS PROVEN BY NOTHING

**The operator listed eight. All eight are confirmed and three more are added.**

Ranked by what the firm loses when the path is needed and does not work.

### 1. The restore — RANK 1, and nothing about it is proven

**What it is for.** Rebuilding this schema and its data after loss or
corruption.

**What proves it today.** Nothing. `migration-audit` replays every migration
into an in-process Postgres and asserts the resulting SHAPE, which proves the
schema can be rebuilt from files. It says nothing about data, storage buckets,
the `auth` schema, or whether a Supabase restore produces a working platform.

**What exercising it would require.** A restore into a scratch project, then the
board pointed at it. The cutover project `qmvcqvkywmkogxbyzsaz` already exists
and is deferred, so the target is available.

**What it costs.** A day, and a Supabase project.

**What happens today if it is needed and does not work.** The firm's regulatory
record, its financial record and its sealed-document provenance are gone. Every
other item on this list is recoverable by hand from the database; this one IS
the database.

### 2. Point in time recovery — RANK 2

**What proves it today.** A boolean in `src/config/launch-readiness.ts` stated
true by the operator on 2026-09-10, with the date. `compliance-audit` asserts
somebody wrote it down. Nothing has ever rewound anything.

**The limit is already recorded and is the sharpest part.**
`fsaryeciduszuahgjbly` is shared with four unrelated applications, so a rewind
restores all five or none, and the decision is never this firm's alone.

**What exercising it would require.** A rewind on a scratch project, because
exercising it on production is the thing that cannot be done casually.

**What happens if it fails.** The same as rank 1, minus the window since the
last backup.

### 3. The `ALLOW_PRODUCTION_DB` permitted path — RANK 3

**What it is for.** The one legitimate write to production from a script:
`seed-admin.mjs`, and by extension any emergency read or repair.

**What proves it today.** `db-guard-audit` proves the REFUSALS thoroughly: that
the flag is compared exactly, that `0`, `false`, `no` and `true` are all
refusals, that `neverProduction` cannot be reached by the flag. **Nothing proves
the permitted path still works.** Every check is on the door being shut.

**What exercising it would require.** A production read with the flag set,
asserting a row comes back. It writes nothing.

**What happens if it fails.** The firm cannot seed its first administrator or
run an emergency repair, at the moment it needs to, and discovers the guard has
been over-tightened only then.

### 4. Retention execute mode — RANK 4

**What proves it today.** `retention-audit`, 60 checks: the floors, the
kept-forever list, the manifest, and the dry run. **Execute mode has never run.**
The operator's standing limit forbids it, correctly.

**What exercising it would require.** A development database seeded past the
floor, with the manifest read back afterwards.

**What happens if it fails.** Either nothing is deleted, which is safe and
means the telemetry tables grow without bound, or something outside the
deletable set is deleted, which is unrecoverable and is the reason the limit
exists.

### 5. The queue dead-letter resume — RANK 5

**What proves it today.** `queue-audit` covers enqueue, claim, retry and the
dead-letter write. **Nothing has ever resumed a dead-lettered job.**

**What exercising it would require.** A job driven to the dead letter, then
resumed, asserting it completes and is not run twice.

**What happens if it fails.** Work the platform accepted is never done and
nobody is told. The queue screen shows it, which is why this is rank 5 rather
than higher: the failure is visible.

### 6. The preview mispointing guard — RANK 6

**What proves it today.** `db-guard-audit` asserts the negative cases harder
than the positive one, deliberately, because a guard that misfired on production
would be worse than the hole it closes. It is tested at the function level.

**What is NOT proven.** That a real preview deployment pointed at production
actually refuses. The guard reads `VERCEL_ENV` and the project ref; no test has
ever run inside a real preview.

**What happens if it fails.** A preview writes to production. It happened once
already, on 2026-09-03, and the audit row it produced is still there because
that table refuses deletes.

### 7. `eng_incidents` — RANK 7

**What proves it today.** `migration-audit` proves the table accepts an update
that fills in what was learned, refuses a DELETE, and refuses to resolve without
saying what was done. **It has exactly one row**, written by hand during the
2026-09-13 lockout, and no code path anywhere writes one.

**What happens if it fails.** Nothing is lost. This is rank 7 because the
failure mode is that somebody writes the row by hand, which is what happened and
what worked.

### 8. Break glass — EXERCISED, 2026-09-13

Left on the list with its status, because a path that has been proven belongs in
the record beside the ones that have not. 32 checks, three servers, three states
of the variable.

### Added by this survey

**9. The customer set-password link when the account is suspended.**
`issueLinkForExistingAccount` returns null for a suspended account, so the door
answers the same sentence and sends nothing. Nothing exercises it. A person
locked out of a suspended account gets silence, which is correct and is proven
by no check.

**10. The Stripe webhook's refund path.** `charge.refunded` is handled and the
2026-09-03 incident is recorded in its comments: four real refunds reached a
correctly configured endpoint, verified, answered 200 and recorded nothing. The
fix is in place; **no check drives a refund event through it.**

**11. The system principal's task-raising path.** `SYSTEM_ACTOR` holds
`tasks.raise` and `audit.write` and is proven unassignable at compile time. Its
ability to actually raise a task when the platform needs to tell somebody
something is exercised by nothing.

### The ranking, which is Phase 14's order

1. The restore
2. Point in time recovery
3. The `ALLOW_PRODUCTION_DB` permitted path
4. Retention execute mode
5. The queue dead-letter resume
6. The preview mispointing guard
7. `eng_incidents`
8. The Stripe refund path *(added)*
9. The suspended-account link *(added)*
10. The system principal raising a task *(added)*
11. Break glass *(done)*

**The pattern to check for in every one of them**, because it is the one that
cost four hours: the diagnostic for a broken recovery path must not live behind
the door that path exists to open. `breakGlassStatus()` reported a malformed
break glass on a screen requiring a full session, which is exactly what somebody
locked out does not have. **Ranks 1, 2 and 3 all have this shape today**: each is
diagnosed from a place you can only reach if the thing already works.
