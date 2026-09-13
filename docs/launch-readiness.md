# Launch readiness

**What stands between this firm and trading, one line each, with who clears it
and where it is stated true.**

Operator ruling, 2026-09-11. This document is the written form of
`launchBlockers()` in `src/lib/launch.ts`. The gate itself is the authority; this
is the thing a person reads.

`scripts/compliance-audit.mjs` asserts that the gate carries exactly these seven
conditions, by id, against a pinned list. Removing one costs two edits made on
purpose.

The operator's own view of this is `/portal/launch`, which renders the gate's own
answer live. **Read the screen for the current state and this file for the
reasoning.** They cannot disagree, because the screen computes nothing.

---

## THE SEVEN CONDITIONS

| id | What must be true | Who clears it | Stated true in |
| --- | --- | --- | --- |
| `switch` | The operator has thrown the switch | The operator, in the deployment environment | `LAUNCH_MODE=live` |
| `registration` | An active, unexpired firm registration is on record | TBPELS issues it; the operator records it | `verifiedFirmRegistrations` in `src/config/credentials.ts` |
| `operating-name` | The board holds the name this firm trades under | The operator files an assumed name and gets TBPELS acknowledgement, or renames the entity | `operatingNameOnBoardRecord` in `src/config/credentials.ts` |
| `stripe` | A live Stripe account belonging to 254, proven by one real charge and its refund | The operator connects the account and makes the charge and the refund | `stripeAccount` in `src/config/launch-readiness.ts` |
| `protocols` | Every service line offered at launch has one protocol approved by the engineer of record | The Professional Engineer in responsible charge | `approvedProtocols` in `src/config/launch-readiness.ts` |
| `phone` | `FIRM_PHONE` is a real number, not a placeholder | The operator, once there is a number somebody answers | `FIRM_PHONE` in the deployment environment |
| `recovery` | Point in time recovery is enabled on the production project | The operator, in the Supabase dashboard, and states it here with the date | `pointInTimeRecovery` in `src/config/launch-readiness.ts` |

**Five of the seven are unmet today.** Two are cleared: `registration`, because F-29811
is active and unexpired, and `recovery`, enabled 2026-09-10. The operator's screen
at /portal/launch shows the same split, and it is the authority if these ever
disagree.

---

## WHY EACH ONE IS A CONDITION AND NOT A NOTE

### `switch`

The operator's deliberate act. It was the whole gate until 2026-09-10 and is now
one condition among seven, which is the entire point of the ruling that day:
setting it alone does not open anything, and `compliance-audit` sets it to `live`
on every run specifically to prove the gate stays shut.

### `registration`

Read from the register rather than from an environment variable, because a
variable can differ between a build and the deployment serving it. Expiry is
checked rather than trusted: F-29811 expires **2027-07-31**, and a site that
goes on printing a lapsed number is making a claim it cannot support.

### `operating-name`

**This is the one holding the gate today.** TBPELS issued F-29811 to **254
Services LLC**. All three sites hold out as **254 Engineering Services**. A
registration in one name does not authorise holding out under another, and Texas
regulates the use of "engineer" and "engineering" in how a firm names itself.

It is a two field object rather than a boolean on purpose. A boolean can be
flipped by anybody in a hurry; this one cannot be flipped without writing down
what the board now holds.

**What the footer does in the meantime, ruled 2026-09-11.** The public footer
reads `254 Services LLC, TBPELS Firm F-29811`, with the brand on its own line
above it. The hazard was never printing the number. It was printing the number
beside a name the board has no record of. Naming the registrant exactly as issued
asserts only what the board's record says, and it means the day the gate opens
the sites are already holding out under the registered name rather than changing
what they say on the day a filing is acknowledged.

`tbpelsFirmNumber()` still returns null while the gate is shut, and that is not
an inconsistency: it feeds the government page, the credentials strip and the
schema block, which are claims of capability rather than a disclosure of who the
registrant is.

### `stripe`

The integration has been exercised against **Reyna Pay**, a different entity. A
live charge today would pay the wrong company for engineering work, on a receipt
the customer keeps, and that is discovered during a dispute rather than before
one.

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

**`approvedProtocols` is empty today, and that is the honest answer.** No PE is
in responsible charge, so no protocol has been approved by an engineer of record,
so all nine service lines are a waitlist.

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

---

## WHAT THIS FILE AND THE GATE CANNOT DO

Every condition here is an assertion a person wrote down. Nothing in this
repository can see a filing cabinet, a Stripe dashboard, or a provider setting.
`compliance-audit` asserts the shape of each condition, that the gate reads all
seven, and that the catalogue and the operator's screen are wired to them. It
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

| | Says |
| --- | --- |
| `business.legalName` in `src/config/business.ts` | 254 Engineering Services LLC |
| `verifiedFirmRegistrations[0].issuedTo` | 254 Services LLC |

`business.legalName` renders as **"Legal entity"** on `/government`, which is the
capability statement a municipal, county, state or federal buyer reads, and in
the footer copyright line on every page.

**Exactly one of these can be right.** Either `business.legalName` is wrong and
the entity is 254 Services LLC, in which case the capability statement has been
naming the wrong company to government buyers. Or there are genuinely two
entities, in which case the registration belongs to one and the website describes
the other.

**Nothing in this repository guesses which.** The operator holds the formation
documents. It is recorded in `legalEntityMatchesRegistrant` in
`src/config/credentials.ts` with both names written out, and `compliance-audit`
asserts the record names them and stays true of the values as they are today, so
it cannot be resolved by editing one string and assuming the other followed.

**It is deliberately not an eighth launch condition.** The gate already will not
open, on `operating-name`. A second condition for the same underlying fact would
mean clearing one looks like progress while the other silently holds, and the
launch screen would carry two rows saying nearly the same thing. When the
operator answers the entity question, both are answered by the same act.
