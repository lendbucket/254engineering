# Launch readiness

**What stands between this firm and trading, one line each, with who clears it
and where it is stated true.**

Operator ruling, 2026-09-11. This document is the written form of
`launchBlockers()` in `src/lib/launch.ts`. The gate itself is the authority; this
is the thing a person reads.

`scripts/compliance-audit.mjs` asserts that the gate carries exactly these
**nine** conditions, by id, against a pinned list. Removing one costs two edits
made on purpose.

**It said seven until 2026-09-22.** The gate grew `engineer-of-record` and
`self-service-signup` and renamed `operating-name` to `trading-name`, and the
pinned list in `compliance-audit` was updated each time, as the mechanism
requires. **The prose count here was not**, and nor was the table in
`CLAUDE.md`. The check has been right and the documents describing it have been
wrong, which is the safer direction of the two and is still worth correcting:
somebody reading either one to decide whether a condition is missing would have
counted to seven and stopped.

The operator's own view of this is `/portal/launch`, which renders the gate's own
answer live. **Read the screen for the current state and this file for the
reasoning.** They cannot disagree, because the screen computes nothing.

---

## THE CONDITIONS

| id | What must be true | Who clears it | Stated true in |
| --- | --- | --- | --- |
| `switch` | The operator has thrown the switch | The operator, in the deployment environment | `LAUNCH_MODE=live` |
| `registration` | An active, unexpired firm registration is on record | TBPELS issues it; the operator records it | `verifiedFirmRegistrations` in `src/config/credentials.ts` |
| `trading-name` | Which name the trading copy uses, which is the name on the board record | TBPELS, by reissuing F-29811 in the new name. Gates nothing | `operatingNameOnBoardRecord` in `src/config/credentials.ts` |
| `engineer-of-record` | A licensed Professional Engineer with a current licence is on the register | The operator, by recording the engineer and the expiry he read off the roster | `verifiedEngineers` in `src/config/credentials.ts` |
| `stripe` | A live Stripe account belonging to 254, proven by one real charge and its refund | The operator connects the account and makes the charge and the refund | `stripeAccount` in `src/config/launch-readiness.ts` |
| `protocols` | Every service line offered at launch has one protocol approved by the engineer of record | The Professional Engineer in responsible charge | `approvedProtocols` in `src/config/launch-readiness.ts` |
| `phone` | `FIRM_PHONE` is a real number, not a placeholder | The operator, once there is a number somebody answers | `FIRM_PHONE` in the deployment environment |
| `recovery` | Point in time recovery is enabled on the production project | The operator, in the Supabase dashboard, and states it here with the date | `pointInTimeRecovery` in `src/config/launch-readiness.ts` |
| `self-service-signup` | Self service sign up is cleared to reach production | The operator, and nobody else, by editing the file | `selfServiceSignUp` in `src/config/launch-conditions.ts` |

**Four are unmet and five are met**, read from the gate on 2026-09-22.

- **UNMET (4):** `switch`, `stripe`, `protocols`, `self-service-signup`
- **MET (5):** `registration`, `trading-name`, `engineer-of-record`, `phone`, `recovery`

**Two of the nine are decided by the deployment environment rather than by a
file**, and they are `switch` and `phone`. The other seven are stated in a file
and read the same in every process, which is why a check can hold this list to
the gate without depending on where it runs. A process with no deployment
environment sees `phone` unmet as well, and that is the environment
`compliance-audit` itself runs in.

The operator's screen at /portal/launch shows the same split, and it is the
authority if these ever disagree.

**This paragraph said "Six are unmet today. Two are cleared" until 2026-09-22**,
which was wrong twice over: the gate had moved on, and nine conditions minus two
cleared is seven rather than six, so the sentence did not even agree with itself.
It was written when the gate had eight conditions and was never re-derived.
`compliance-audit` now binds these lists to the gate, so the next drift is a red
board rather than a paragraph nobody re-reads.

**`self-service-signup` joined on 2026-09-13**, and the board is what noticed: the
gate grew an eighth condition on the Phase 13 branch and `compliance-audit`'s pinned
list stayed at seven, so the first board after it went red naming the extra id. Then
it went red a second time on this document, which is the check working twice: a
condition that reaches the gate and not the written form is a condition the operator
reads about nowhere.

---

## WHY EACH ONE IS A CONDITION AND NOT A NOTE

### `switch`

The operator's deliberate act. It was the whole gate until 2026-09-10 and is now
one condition among nine, which is the entire point of the ruling that day:
setting it alone does not open anything, and `compliance-audit` sets it to `live`
on every run specifically to prove the gate stays shut.

### `registration`

Read from the register rather than from an environment variable, because a
variable can differ between a build and the deployment serving it. Expiry is
checked rather than trusted: F-29811 expires **2027-07-31**, and a site that
goes on printing a lapsed number is making a claim it cannot support.

### `trading-name`

**MET since 2026-09-21. This is no longer holding the gate**, and it held it
longer than any other condition, so what it was is worth keeping beside what it
is.

TBPELS reissued F-29811 in the name **254 Engineering LLC** and also recorded
**254 Engineering Services**, **Sealed Engineering** and **Stamp My Plans** as
assumed names. The board now holds both the legal name and the name the sites
trade under, by both of the routes this condition named.

**What it was, until that letter arrived.** The board held 254 Services LLC while
all three sites held out as 254 Engineering Services. A registration in one name
does not authorise holding out under another, and Texas regulates the use of
"engineer" and "engineering" in how a firm names itself, so printing the board's
number beside a name the board had no record of would have been the exact
misstatement this gate exists to prevent.

It is a two field object rather than a boolean on purpose. A boolean can be
flipped by anybody in a hurry; this one could not be flipped without writing down
what the board now holds, and the sentence recorded beside it is what the
reissuance had to make true.

**What the footer does, ruled 2026-09-11.** The public footer renders
`registrationLine()`, which reads the registrant off the record rather than
typing it. It resolves today to `254 Engineering LLC, TBPELS Firm F-29811`, with
the brand on its own line above it, and it moved to that string by itself when
the board reissued: nobody edited a footer.

The hazard was never printing the number. It was printing the number beside a
name the board has no record of. Naming the registrant exactly as issued asserts
only what the board's record says.

**`tbpelsFirmNumber()` returns `F-29811` today**, and until 2026-09-22 this
paragraph claimed the number was withheld for as long as the gate was not open.
That was true when
the gate was one flag with two positions. The gate now answers three ways, the
mode is `trading`, and the number is released in that mode because it feeds the
government page, the credentials strip and the schema block, which are claims
about who the registrant is once the registrant is real.

### `stripe`

**CORRECTED 2026-09-22.** This section said the integration had been exercised
against **Reyna Pay**, a different entity. **That was wrong.**

Production's account is **`acct_1UFmIjA2kbTZN5C3`**, which is this firm's. It
has been recorded in `src/config/stripe-console.ts` since 2026-09-16, and on
2026-09-22 the operator read Production's publishable key: it begins
`pk_live_51UFmIjA2kbTZN5C3`, which embeds that same account id. He has renamed
the account to 254 Engineering LLC.

The wrong sentence was written on 2026-09-11 and nothing re-derived it for
eleven days, while **five other records copied it**, including this one. The
later, evidenced record was never compared against the earlier, unevidenced
one.

**Two things still hold this condition shut**, and neither is the account's
identity:

1. **The legal business name is unverified.** The operator changed it in the
   dashboard on 2026-09-21; the screenshot proving it was deleted because it
   carried his personal details. `stripeConsole` therefore holds the value read
   on 2026-09-16 and `stripe-webhook-audit` is correctly red until a cropped
   capture or a key-run audit.
2. **No charge and refund have been made.**

**Preview did carry live Reyna Pay keys** until the operator removed them on
2026-09-21. That is a separate and real finding, recorded in
`src/config/credential-inventory.ts`. A charge taken on a preview URL, which
anybody with the link can reach, would have paid the wrong company for
engineering work, on a receipt the customer keeps, and that is discovered
during a dispute rather than before one.

**The live charge and refund run on PRODUCTION**, as the first act after the
gate opens. Never on a preview.

**A charge and a refund, and both recorded.** A charge proves the account can
take money. Only a refund proves the firm can give it back, and this platform's
whole refund grammar, the disclosed inspection fee and the full refund where
nobody attended, is worth nothing if the refund path has never once been run. The
identifiers are recorded so somebody who does not trust this file can check them
in the Stripe dashboard.

### `protocols`

**A line with no approved protocol is not offered; it is a waitlist.**

The argument is dispatch. A field order with no approved protocol reaches a
technician with no checklist to work to and an engineer with no agreed basis to
review against, which means the firm has taken payment for work it has no stated
way to perform.

So `data/catalog.ts` reads the registry: `orderBlockedReason` takes
`hasApprovedProtocol` as a **required** parameter and refuses the order without
it. Required rather than defaulted, because either default is wrong in a way
nobody would see, and a required parameter makes the two sibling repositories
fail to compile until somebody decides.

**`approvedProtocols` is empty today, and that is the honest answer.** An
engineer of record IS in responsible charge, and `engineer-of-record` is met, so
the reason this condition is unmet is narrower than it used to be: he has not yet
approved a protocol version for sale through his own account. All 8 service lines
are a waitlist until he does.

**This paragraph said "No PE is in responsible charge" until 2026-09-22.** That
sentence stopped being true when the engineer was recorded on the register, and
it is the same false compliance sentence the portal sidebar carried in September,
in the document a person reads to understand the gate. It also said nine service
lines where the catalogue has 8. Both are bound to the code now.

It is deliberately not a copy of `eng_protocol_templates`. That table is where an
engineer authors and versions protocols. This is the declaration that a named
engineer of record has approved a specific version for sale, and those are two
different acts: publishing a row happens inside the platform, approving a service
line is done by a licensed person who is answerable for it. Collapsing them would
mean anybody holding `protocols.author` could put a service line on sale.

### `phone`

The one condition a person can satisfy by typing. A published number is a
commitment to answer it, and `555`, a repeated digit, the keypad in order and a
zero exchange are all the same mistake wearing different digits. The gate refuses
each, and `compliance-audit` exercises the patterns against four fake numbers and
one plausible real one, because a list of regexes nothing runs is a list.

### `recovery`

**Cleared 2026-09-10.** Stated true by the operator with the date, because
nothing in this repository can see a provider dashboard setting and a check that
cannot see a thing must not pretend to.

**Its limit is part of the record.** `fsaryeciduszuahgjbly` is shared with four
unrelated applications, so a rewind restores all five or none and the decision to
use it is never this firm's alone. The reasoning is in
`docs/disaster-recovery.md` section 2a and is not repeated here.

**Enabled is not rehearsed.** An untested restore is a belief. The cutover plan's
step 15 is where a restore gets proven and read back, and that plan is deferred,
so this condition asks only what it can honestly ask: is there a moment to go
back to.

### `self-service-signup`

**Unmet, and it is the operator's alone to lift.** Not a gap waiting to be closed by
somebody noticing it: a decision that has not been made.

Three identity secrets are shared between Preview and Production by an operator
ruling of 2026-09-13, recorded with a name, a date and its consequence in
`src/config/credential-inventory.ts`. The consequence is that a customer session
signed on any preview deployment is accepted by production, and preview URLs are
reachable by anybody holding the link.

That is tolerable while every account on the platform is one the operator created.
**Self service sign up is what turns it from a risk about a handful of known accounts
into a risk about anybody who can reach a preview URL**, which is why the condition
is about the FEATURE rather than about the secret.

**The condition that was written first was the wrong one.** It blocked the gate on
the sharing, and the operator ruled the sharing stays. A condition that blocks on a
decision already made is a gate nobody reads, so it was rewritten to block on the
thing still undecided. Recorded here because a condition that changed shape without
leaving a trace is one the next reader assumes was always this.

---

## WHAT THIS FILE AND THE GATE CANNOT DO

Every condition here is an assertion a person wrote down. Nothing in this
repository can see a filing cabinet, a Stripe dashboard, or a provider setting.
`compliance-audit` asserts the shape of each condition, that the gate reads all
nine, and that the catalogue and the operator's screen are wired to them. It
deliberately does not verify the outside world.

That is the same limit `supabase/applied.mjs` states about the difference between
being asked and being answered: `schema-ledger-audit` proves somebody was asked
whether production has a migration, and only a live read proves it has it.

---

## THE SECOND GATE, WHICH IS NOT ON THIS LIST

`peInResponsibleCharge()` is separate and stays separate. Firm registration and
an engineer of record are two different facts, and the registration lifting must
not lift the sealing language with it. A firm with a registration and no PE still
cannot seal anything.

It is gated on `TBPELS_PE_LICENSE` being supplied rather than on a boolean,
because the thing that makes it true is a specific person with a specific number,
and requiring the number means the gate cannot be opened by optimism.

---

## A SECOND NAME DISCREPANCY, FOUND 2026-09-11, AND IT IS NOT THE SAME ONE

The condition above is about the name the firm **trades** under. This is about
the name the firm **is**, and it was found while wiring these conditions.

**RESOLVED. Both now read 254 Engineering LLC**, and the table below is what
they said when the discrepancy was found, kept because a question that vanishes
looks like one nobody asked.

| | Said, 2026-09-11 | Says today |
| --- | --- | --- |
| `business.legalName` in `src/config/business.ts` | 254 Engineering Services LLC | **254 Engineering LLC** |
| `verifiedFirmRegistrations[0].issuedTo` | 254 Services LLC | **254 Engineering LLC** |

The operator answered the entity question on 2026-09-13 holding the formation
documents: the entity was 254 Services LLC and `business.legalName` was wrong.
TBPELS then reissued F-29811 in the name 254 Engineering LLC on 2026-09-21, which
moved `issuedTo` as well, and `legalEntityMatchesRegistrant` records the answer
with `resolved: true`.

`business.legalName` renders as **"Legal entity"** on `/government`, which is the
capability statement a municipal, county, state or federal buyer reads, and in
the footer copyright line on every page.

**Exactly one of them could be right, and that was the point.** Either
`business.legalName` was wrong and the entity was 254 Services LLC, in which case
the capability statement had been naming the wrong company to government buyers.
Or there were genuinely two entities, in which case the registration belonged to
one and the website described the other. It was the first.

**Nothing in this repository guessed which, and that is why it got answered.**
The operator holds the formation documents. It is recorded in
`legalEntityMatchesRegistrant` in `src/config/credentials.ts` with both names
written out, and `compliance-audit` asserts the record names them and stays true
of the values as they are today, so it could not be resolved by editing one
string and assuming the other followed.

**It is deliberately not an eighth launch condition.** The gate already will not
open, on `operating-name`. A second condition for the same underlying fact would
mean clearing one looks like progress while the other silently holds, and the
launch screen would carry two rows saying nearly the same thing. When the
operator answers the entity question, both are answered by the same act.
