# Overnight, 2026-09-24

**Nothing merged, nothing pushed, nothing deleted. No production access of any
kind: no Supabase, Vercel or Stripe call was made after the rules were given, and
no secret value entered the session.** Every branch below is unmerged.

Section 1 is what the operator has to rule on, in the order to answer. Everything
else is evidence for it.

---

## 1. QUESTIONS, IN THE ORDER TO ANSWER THEM

### 1.1 The engineer and money: the code does the OPPOSITE of the rule you stated

**This is the most consequential thing found tonight and it is not a bug.**

The instruction was: *"the engineer never sees prices, margins or payouts
anywhere, including API responses and emails."*

The platform deliberately does the reverse, says so in its own words, and
asserts it:

```
scripts/roles-audit.mjs:365
  why: "costs and margin are for the operator, the engineer, and whoever is
        evaluating the business",
  check: action === "pricing.read" && !["admin","engineer","read_only"].includes(role)

scripts/roles-audit.mjs:1056  PASS  a technician receives no pricing fields at all
scripts/roles-audit.mjs:1058  PASS  an engineer keeps pricing
```

So the implemented rule is: **the TECHNICIAN sees no money, the ENGINEER sees all
of it**, with a stated reason, enforced by `pricing.read` and asserted in both
directions.

**Both cannot be true.** Either the rule stated tonight supersedes a deliberate
ruling, in which case `pricing.read` leaves `engineer`, `redactFile` changes, and
`roles-audit`'s assertion inverts; or tonight's sentence meant the TECHNICIAN and
the platform is already correct.

**Nothing was changed.** A rule about who sees the firm's costs is not something
to resolve from an instruction that may have meant a different role.

**Recommendation: confirm which role you meant.** If you meant the engineer, this
is a real piece of work touching the role matrix, the redaction, the report
surfaces and the emails, and it wants its own sitting rather than a branch at
night.

### 1.2 The proving charge path: a fork my design did not settle

Item 2a was **stopped and not built**, under the rule that an unsettled decision
stops the item.

The proving order must be created without consulting the compliance gate, and
the gate check lives inside `placeOrder` in `src/lib/ops-intake.ts:252`, which is
the ordinary operator order path. So there are three shapes and each costs
something:

| | What it costs |
| --- | --- |
| **A.** a bypass flag on `placeOrder` | one code path, but the ability to create an order without the gate becomes a PARAMETER living in the ordinary path for ever |
| **B.** a separate narrow proving path | the capability is isolated, but it is a second way to create an order, which can drift from the real one |
| **C.** teach the webhook a proof branch | no order at all, but it changes the money path's event handling |

**Recommendation: B**, on an argument the original design missed. The proving
path **runs once, ever**, and disables itself permanently the moment
`stripeAccount.proof` is non null. Drift between two order paths accrues over
time and this one has no time in which to accrue. A's parameter is permanent.

**What the design got right and is still usable:** four independent conditions on
the route, the amount capped in source, the order marked `is_demo`, and the path
NOT writing its own proof. That last one matters: the operator pastes the
identifiers into configuration, because a platform that can set its own gate
condition is a gate with one home.

**One thing verified tonight that the design had assumed:**
`eng_service_orders.is_demo` exists (migration 0027) with a constraint binding it
to a DEMO reference in both directions, so the proving order needs **no
migration** and is excluded from every report by machinery that already exists.

### 1.3 `selfServiceSignUpOpen()`: `open` or `trading`?

Built and committed. It now requires `isOpen()` as well as the flag.

The bar chosen is **`open`**, on the reasoning that an account exists to own
orders and trading takes no orders, so an account opened in trading can do
nothing. If you want sign up available as soon as the firm is registered and
quoting, it becomes `!isPrelaunch()` and nothing else changes.

### 1.4 Insurance and training: which state do they gate, and what does a lapse do?

Built and committed as conditions ten and eleven. Both gate **`open`**, a
disclosed judgement: trading is quoting, `open` is taking money for work that
will carry a seal, which is when a claim becomes possible.

Two further rulings owed:

- **A lapsed policy shuts the gate immediately**, as built, rather than raising
  an alert. Same treatment as an expired registration.
- **Training blocks the LINE**, as built, rather than blocking dispatch of an
  individual technician. The finer version is per person and belongs in the
  database rather than in a gate condition.

### 1.5 Does TBPELS require professional liability cover?

**Not established, and deliberately not inferred.** Nothing in this repository
supports a sentence either way. It must be confirmed with the board or with
counsel. Until then the `insurance` condition is recorded as a business decision
the operator made, not a regulatory requirement, so nobody later reads it as the
second.

### 1.6 The `eng-uploads` bucket is in no migration

See 3.2. It needs a migration, which cannot be applied tonight.

### 1.7 UTC dates used as business dates, in fourteen files

See 3.3. The class fix wants a ruling because some of the fourteen are display
only and some decide money.

### 1.8 The SOC 2 pack's "Generated on" date

See 3.4. A small copy fix would make a false statement true without a migration.

---

## 2. WHAT WAS BUILT, EACH ON ITS OWN BRANCH, NONE MERGED

| Branch | Commit | What |
| --- | --- | --- |
| `feat/signup-requires-the-gate` | `b032f49` | 2c: sign up needs the gate, not only its own flag |
| `feat/insurance-and-training-conditions` | `ca76f61` | 2b: conditions ten and eleven |
| `docs/overnight-2026-09-24` | this file | the record |

`feat/0058-retired-protocol` still stands at `1436a6a` from the earlier sitting,
seven commits, unmerged.

### 2c, `b032f49`

`selfServiceSignUpOpen()` read `selfServiceSignUp.cleared` and nothing else. That
flag means "public sign up is ready to reach production", not "the firm is open",
and it is the one condition a reasonable person would clear EARLY because
clearing it is preparation rather than commitment. Cleared alone, public sign up
would have gone live on a firm that takes no orders.

Proof `scripts/proofs/sign-up-needs-the-gate.mjs`, three cases, each in a child
process because the conditions are read at module load. The middle case exists so
that a function returning constant false cannot pass. Injection-verified by
reverting the one line: exactly one check went red.

### 2b, `ca76f61`

`verifiedInsurance` and `verifiedTechnicianTraining`, both empty, both blocking.

**The firm's insurance was recorded nowhere in this repository**, checked rather
than assumed: every match for the word under `src/config` and `src/lib` was a
technician's own cover, a form field, or an email template.

Training is keyed on the protocol **version**, because 254-RC-001 was at v1.0
nine days before v1.1 and a record without a version reads as current for ever.
It asks its question of the APPROVED protocols, so while none is approved it is
**vacuously met** and contributes nothing: a line with no protocol is already shut
by `protocols`, and naming it twice reports one fault as two.

Proof, six cases. **Case F was added because an injection found the proof could
not see the thing that matters most**: cases D and E use version 1 on both sides,
so removing the version from the match left every check green. With the version
gone, training on v1 reads as current against an approved v2 and the gate opens.

**What else had to move, and each is a mechanism working rather than a
side effect.** The pinned list in `compliance-audit`, which is the second of the
two edits that list exists to impose. The gate fixture, in the SAME commit, which
is the 2026-09-13 ruling: a condition the fixture does not know about makes it
refuse loudly rather than quietly run thirteen audits against the prelaunch state.
And `docs/launch-readiness.md`, which went red in seven checks, from the check
somebody built for the "the table said seven for five days" defect.

**And a defect in `compliance-audit` itself.** Its number-word list stopped at
`nine`, and `WORD[n] ?? n` falls back to digits, so the moment the gate passed
nine the check silently demanded that a document written in prose say "the gate
reads all 11". The check and the file disagreed about LANGUAGE, not about the
count, and the failure read as a stale count when nothing was stale.

---

## 3. THE EXPLORATORY AUDIT: WHAT WAS FOUND, RANKED BY HARM

**Only the static half ran.** The browser half of item 4, walking every role at
390 and 1280, did not: the machine was held all night by another project's
`full-suite` and its Next server on port 3141, and under the standing rule
nothing of that project is touched and this repository's board waits. See section
5.

### 3.1 The engineer and money

Rank 1. Recorded at 1.1 rather than repeated here.

### 3.2 A bucket the product depends on is in no migration

`src/lib/uploads.ts:49` hardcodes `const BUCKET = "eng-uploads"`, and it carries
every application resume, onboarding document and order upload. **No migration
creates it.** The only bucket in the chain is `eng-evidence`, created by 0002.

**Why nothing caught it.** `migration-audit` replays every migration into an in
process Postgres and proves the schema rebuilds, and **PGlite has no storage
schema**, so buckets are invisible to the one check built for exactly this class.
The cutover project needed "five private buckets" created by hand, which confirms
buckets live entirely outside the migration chain rather than being an oversight
on one of them.

**The harm is to recovery and to the deferred cutover, not to a customer today.**
The live projects have the bucket. A database rebuilt from the migrations would
not, and every upload would fail on a newly provisioned project. That is the
defect `migration-audit` exists to prevent, wearing storage instead of tables:
0001 spent a month unable to apply to an empty database while both live projects
held the objects.

**Needs a production read to confirm and MUST NOT be read tonight:** which
buckets actually exist on `fsaryeciduszuahgjbly` and on development, and their
public/private setting and size limits.

**Recommendation:** a migration creating `eng-uploads` with the same shape as
`eng-evidence`, applied in a sitting, plus a check that every bucket named in
`src/` appears in the migration chain. The check is the part that closes the
class.

### 3.3 UTC dates used as business dates, and one of them decides money

`src/lib/firm-calendar.ts` exists and exports `todayInFirmCalendar()` for
America/Chicago. Fourteen files use `new Date().toISOString().slice(0, 10)`
instead, which is UTC.

**The sharpest is `src/lib/ops-partner-comp.ts:68`**, inside `termsInForce`,
which decides WHICH COMMISSION TERMS apply to a partner:

```ts
const day = at.toISOString().slice(0, 10);
... .lte("effective_from", day)
... t.effective_to === null || String(t.effective_to) >= day
```

Chicago is UTC minus five or six, so **from 19:00 Chicago the UTC date is already
tomorrow**. A rate change dated the first takes effect at 7pm on the last day of
the previous month, and every order in that window is paid at the wrong rate.
Small window, real money, and exactly the kind of thing a partner disputes.

Others, lower harm: `src/lib/launch.ts` at three places compares credential
expiries against a UTC date; `ops-field.ts:450` checks licence currency;
`ops-metrics.ts:82` buckets daily metrics; `ops-docs.ts` and
`ops-report-export.ts` stamp reports and filenames.

**Recommendation: fix the class, not the instance.** Fixing `termsInForce` alone
would be an instance fix on a fourteen member set, and some members are display
only and correct as they are. The ruling needed is which of the fourteen are
business dates. A check asserting that no business date is derived from
`toISOString()` outside `firm-calendar.ts` is what closes it.

### 3.4 The SOC 2 pack's "Generated on" date can be materially wrong

`scripts/soc2-evidence.mjs` deliberately refuses `Date.now()`, which is right: it
wants a time the database stamped. It calls `rpc("eng_now")`, **which exists in no
migration**, and the code knows this and falls back:

```ts
const probe = await db.from("eng_jobs").select("created_at").order(...).limit(1);
generatedAt = probe.data?.[0]?.created_at ?? null;
```

That is **the creation time of the most recent job**, not now. The artifact then
says, at four places including the pack's own header:

> Generated by `scripts/soc2-evidence.mjs` on {date}. Do not edit this file.
> **Every figure below was read at generation time.**

On a quiet system the most recent job may be hours or days old, and `eng_jobs` is
one of the two tables retention may DELETE from, so pruning can push it further
back or empty it. The null case degrades honestly to "an unknown date"; the
middle case is the defect, because a stale but plausible date is presented as the
generation time in a compliance artifact an auditor reads.

**Recommendation, and it is small.** Either add an `eng_now()` function, which
needs a migration, or change the label to say what the value is: read from the
most recent database stamped row at X, rather than generated on X. The second
needs no migration and makes a false statement true. **It was not done tonight**
because regenerating the pack reads the development database and the wording of a
compliance artifact is yours to approve.

### 3.5 Three tables declared and nothing reads

`eng_contacts`, `eng_incidents`, `eng_orders`. All 81 `eng_` tables in the
migrations were compared against all 78 referenced in `src` and `scripts`, both
directions. **Nothing is used that is not declared**, which is the reassuring
half.

`eng_orders` is from the legacy `0000` migration, which records that those tables
were created directly against the shared project before this repository existed.
The other two need a ruling on whether they are legacy, dead, or something
somebody believes is being maintained.

**Needs a production read to confirm and MUST NOT be read tonight:** whether
these three hold rows.

### 3.6 A false positive of my own survey, recorded so nobody chases it

The same survey reported **22 functions declared and nothing reads them**. They
are trigger functions, invoked by triggers rather than by `rpc()`, and the scan
only looked for `rpc()`. Not a finding. Recorded because an unexplained list of
22 in a scratchpad would be chased by somebody.

---

## 4. BOARDS: NONE RAN

**Item 1 and item 3 did not run, and no prediction was spent.**

The board on `feat/0058-retired-protocol` refused before building, as it did
earlier in the sitting:

```
1 process(es) are holding .next or an audit port:
  PID 14096  a next server whose repository could not be established from its
             command line, so it is reported rather than assumed harmless
             node_modules/next/dist/bin/next start -p 3141
  OWNED BY PID 9616 (launch-audit.mjs)
```

That is the other project. Under the standing rule it is never killed, the board
waits, and a waiter re-checked every ten minutes all night. It was still holding
the machine when this was written.

**The prediction for item 1 stands unspent and unchanged:** 56 PASS, 1 FAIL, 2
COULD NOT TELL of 59, the one red being `schema-ledger-audit` saying production
has 0058 and `main` does not, which is true and clears on merge.

---

## 5. WHAT NEEDS A PRODUCTION OR VERCEL READ, NOT READ TONIGHT

- Which storage buckets exist on production and development, and their settings.
- Whether `eng_contacts`, `eng_incidents` and `eng_orders` hold rows.
- Whether the Preview untick of `CUSTOMER_SESSION_SECRET` and
  `PARTNER_SESSION_SECRET` has taken effect, which is the after-check already
  written at `preview-cannot-mint.mjs` and waiting on a preview URL.
- Whether the other four projects in the organisation hold any `eng_` object.

---

## 6. THE RULES THIS RUN WORKED UNDER

No merge, no push, no delete. No Supabase, Vercel or Stripe call of any kind
after the rules were given. No secret value in the session. Every check added was
run standalone and injection-verified before it was committed. The board was
never run beside anything, and the other project's processes were never touched.
