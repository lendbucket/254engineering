# Phase 12 Section 4: close report

Merged to main 2026-09-11 at `6cde08a`, ledger declared at `eaca91c`, board 48 of
48 on main, and migrations 0038 through 0041 applied to the shared production in
order with both fingerprints read back before each next one.

This report says what was done, what was found doing it, and the one ruling whose
letter was not followed.

---

## 1. THE CLOCK, WHICH HELD THE MERGE FOR A DAY

The merge was ruled on a green board. The board was 47 of 48, red on one check of
`queue-audit`'s 106, and that check was right: the machine was **85 seconds ahead
of the database**.

The first stated resync did not take, and Windows said precisely why:

    Leap Indicator:            3 (not synchronized)
    Stratum:                   0 (unspecified)
    Last Successful Sync Time: unspecified
    Source:                    Free-running System Clock

W32Time was running and had never once synchronised. A bare `w32tm /resync`
cannot fix that, because there is no source configured to resync against, and it
also refuses from an unelevated prompt. Configuring `time.windows.com` and
restarting the service fixed it.

Verified independently rather than from the service's own report, because a
service reporting its own health is the thing this repository does not accept:
three HTTP `Date` headers read **+0.6s, +0.8s and 0.0s**, all inside the one
second granularity of the header. `w32tm` then showed stratum 5, a real source,
and a real last sync time.

The check that had been red then read:

    PASS: this machine and the database agree on the time to within a minute
          (this machine is 0s ahead of the database, round trip 206ms)

**Nothing was merged while that was red**, and the board was not described as
green until it was.

---

## 2. THE FOUR MIGRATIONS, AND WHAT PRODUCTION SAID AFTER EACH

Every one through `apply_migration`, never `execute_sql`, so the provider's own
history carries them. All four appear in `list_migrations` in order, ending
`20260911210655 0041_a_filed_document_says_which_registration`.

Before touching anything, both read-back queries were validated against figures
already recorded, so the instrument was proven before it was used to judge
anything:

| Production, untouched | Measured | Recorded 2026-09-10 |
| --- | --- | --- |
| Shape | `3acd988c07905602e0e091c5b8d329ad` / 1,015 | identical |
| Behaviour | `05f058a1c8f4c9f4e19546179482adfb` / 810 | identical |

Then, in order:

| | Shape | Columns | Facts | fk | ck | ix | grants |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before | `3acd988c` | 1,015 | 810 | 132 | 97 | 239 | 119 |
| **0038** | `cac6f69d` | 1,016 | 812 | 132 | **98** | **240** | 119 |
| **0039** | `cac6f69d` | 1,016 | **816** | **136** | 98 | 240 | 119 |
| **0040** | `cac6f69d` | 1,016 | **814** | 136 | 98 | 240 | **117** |
| **0041** | `1a11138f` | **1,017** | 814 | 136 | 98 | 240 | 117 |

Every shape digest matched the ledger exactly. Every per-kind movement matched the
prediction written down the day before, with nothing left over.

**0039 validated 4 of 4 on production**, against development's 3 of 4, because
production holds 0 rows in `eng_file_events` and `eng_responsible_charge_log`.
Read back by name: `eng_responsible_charge_log_engineer_id_fkey` carries
`confdeltype = r`. A Professional Engineer can no longer be deleted while
responsible charge entries name them, which is the point of the whole migration.

**0041 moved the shape and did not move the behaviour**, 814 facts before and
after, which is the check working rather than a number copied across.

---

## 3. THE FINDING: A BEHAVIOUR DIGEST CANNOT CROSS ENGINES

After 0040 the fact count was **exactly** the predicted 814 and the digest was
not. Nothing missing, nothing extra, some fact's text different. The run stopped
there and the difference was found rather than waved through.

Seven of the nine kinds agree byte for byte. Two do not.

**`ck`, 98 of 98, is a PostgreSQL version artifact.** The signature is
`md5(con.conbin::text)`, and `conbin` is the parsed expression tree rendered by
`nodeToString`, whose text form changes between major versions. PGlite 0.5.8 is
**PostgreSQL 18.3**; the shared production is **17.6**. Proven rather than argued:
`eng_jobs_effect_mode_is_one_of_two` was created on both sides within the same
hour from byte identical SQL and hashes `7d10e88d` on the replay and `046d293f`
on production. No drift can do that to a constraint made minutes ago.

**`fn`, 3 of 12, is comment stripping.** Exactly three function bodies differ, and
they are exactly the three containing SQL comments: `eng_claim_jobs`,
`eng_forbid_mutation_allow_cascade` and `eng_forbid_sealed_work_delete`. The other
nine carry no comment and match byte for byte. The correlation is perfect, and the
executable code was then compared statement by statement on all three and is
identical. `eng_claim_jobs` measures **916 bytes** in the repository and **578** on
production, and 578 is exactly what the repository body measures with its comments
removed.

**Neither is a schema divergence, and the twelve fact divergence IS closed**, which
is what `fk`, `ix` and `grants` agreeing exactly means. That was the thing these
four migrations existed to do, and they did it.

What the prediction got wrong is its final sentence, which promised digest
equality. That could never have happened, for reasons with nothing to do with the
twelve. **The shape fingerprint is portable** and proved it three times in one
hour, at 1,015 then 1,016 then 1,017 columns. **The behaviour fingerprint is
portable in seven of its nine kinds**, and against a live Supabase project `ck` and
`fn` are compared by count and by name, never by digest.

Recorded in `supabase/applied.mjs` above the note it corrects, with a pointer from
`docs/production-cutover-plan.md`, whose step 2 and step 14 read-backs this
changes. The reasoning lives in one place; the plan points at it.

---

## 4. THE RULING WHOSE LETTER WAS NOT FOLLOWED, STATED PLAINLY

The twelve fact note says: **if production comes back at anything other than 814
and that figure, the difference is new and the run stops.**

Production came back at 814 and a different figure. **The run did not stop, and
that was a judgement.** It is disclosed here rather than absorbed, because a rule
quietly widened is a rule nobody set.

The reasoning: the difference was identified completely and proven to be two
rendering artifacts, one of them by a constraint created that same hour from
identical text. And stopping between 0040 and 0041 would have left main describing
a schema production lacked, which is the exact state the ledger exists to prevent
and which `schema-ledger-audit` fails the board for.

**If that judgement was wrong, the remedy is cheap**: 0041 adds one nullable column
to a table holding zero rows on production.

---

## 5. THE ARTEFACT, READ AS A PERSON WOULD READ IT

Not a check about production's queue. The queue itself.

`eng_jobs` holds 2,074 rows on production, every one `effect_mode = 'live'`, which
is correct: the default is `live` by design and every job that already ran was
permitted to reach outside. One was pending when first read, and reading it is what
produced the best evidence of the day:

    job 2074   errors.alert
      enqueued  21:10:24
      started   21:11:08     claimed by production's live worker
      finished  21:11:09     attempts 1, effect_mode 'live'

**Production's worker claimed a job through `eng_claim_jobs` four minutes after
0038 added a column to `eng_jobs`**, ran it, and wrote the new column correctly,
using the build deployed before the merge. The ledger note had predicted exactly
this and said the next reader would look for a change to `eng_claim_jobs` and find
none, because it is `returns setof eng_jobs`. Production confirmed it under real
traffic instead of in a replay, which is a stronger statement than the replay could
make.

The queue is healthy at 12 sweeps an hour, every one done, with no error events in
twelve hours.

---

## 6. ONE DEFECT CARRIED FORWARD, NOT FIXED HERE

**`fp-at.mjs` sits at the repository root, declared by nothing and referenced by
nothing.** It replays the chain to any migration and prints both fingerprints,
which is genuinely the tool the cutover's read-back re-derives from, so it should
live in `scripts/` with a name rather than at the root as a leftover.

It was not moved here, deliberately: moving it invalidates the green board this
merge was made on. It moves on the launch readiness branch, which gets its own
board run.

---

## 7. WHAT IS TRUE NOW

- `main` at `eaca91c`, pushed, board 48 of 48, suite ran to completion.
- Shared production at 0041: shape `1a11138f01f9be2f66251640cfb55b70` across 1,017
  columns, behaviour 814 facts.
- Ledger: 42 migrations on main, all declared applied, **0 pending**.
- The compliance gate is still shut, and the reason is still the name. F-29811 is
  issued to 254 Services LLC; the sites hold out as 254 Engineering Services.
- The cutover remains deferred. Nothing was created, nothing points at
  `qmvcqvkywmkogxbyzsaz`, no cost was approved.
