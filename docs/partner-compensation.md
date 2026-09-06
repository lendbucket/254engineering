# What a partner earns, and what a refund takes back

Phase 9 Section 3, built 2026-09-05 against the rulings in
`docs/partner-program-decision.md`. Everything here is the answer to a question
that document either raised or deliberately left open, and each answer is
recorded because a later session reading only the code would find a rule and no
reason for it.

The unanswered question the whole design bends around is still unanswered:
**whether a percentage of an engineering fee may be paid to an unlicensed
referrer is a question for TBPELS or a licensing attorney.** Nothing built here
depends on the answer, and nothing built here should be read as an opinion on
it.

---

## 1. The ledger, and why it is a ledger

`eng_partner_entries` holds three kinds of row: an accrual, a reversal, and an
adjustment. An accrual is written when the firm delivers. Nothing ever edits it.

A refund does not reduce an accrual, it writes a reversal beside it and the two
net. A correction does not amend one, it writes an adjustment beside both and
the three net. This is the same rule the payment ledger already applies to a
customer refund, and a partner is owed the same honesty the firm gives itself.

The alternative, editing the accrual, is smaller and faster and would destroy
the only property that makes a partner program survivable: a partner being able
to check this month's statement against what they were told last month. A number
that moves after the fact is a number nobody can reconcile, and the first time a
partner notices they assume the worst and they are not wrong to.

Enforced at the database. `eng_freeze_partner_entry` refuses a change to every
column except `statement_id`, which a close has to be able to write, and
`eng_forbid_partner_entry_delete` refuses removal outright.

## 2. A commission with no figure is not a commission of nothing

The state that took the most care. A delivered file whose order carries no
total, or whose partner has no terms in force, has a commission that is **owed
and not yet knowable**.

The entry is written anyway, with `status = 'blocked'` and no amount. It is
excluded from every total, counted in what a statement says it left out, and
shows on the operator's side as work to do. The check constraint makes blocked
and having no figure one fact rather than two columns that can disagree.

Writing zero instead would have been tidier and would have said the firm owes
nothing for a job a partner sent, in a row nobody would ever look at again.

## 3. Accrual on delivery, and where the code sits

`transitionFile` is the only function that can move a file to delivered, so the
accrual is written there rather than by a job that sweeps for delivered files. A
sweep would leave the ledger lagging the record by however long the sweep took,
and a delivered partner file with no entry is exactly the state that makes a
margin read too high.

**A failure to accrue does not undo the delivery.** The file is delivered; that
is a fact about the firm and the customer and it is not conditional on a
commission being computable. The problem is written to the file's own timeline
where somebody meets it, and the transition still returns ok.

## 4. What a refund takes back: three answers, not one

These are rulings rather than arithmetic, so they are asserted by name in
`partner-audit`.

**A share of order value is reversed in the proportion returned.**
`percent_of_order` and `tiered_by_volume` pay a share of what the customer paid.
If half came back, the firm never earned that half. A full refund reverses the
lot.

**A flat fee per order is all or nothing.** It is not a share of anything, so
there is no proportion to take. A full refund means the order did not stand. A
partial refund means it stood and something was returned within it, and the
partner still brought the order.

**A qualified lead fee is never reversed by a refund.** The partner was paid for
a lead the firm looked at and chose to convert. What happened to the engineering
afterwards, an engineer declining to certify included, is not something the
partner did or could have known. Clawing it back would make the partner carry
the firm's technical risk, which is not what they were paid to carry.

This last one is the most arguable of the three and the most likely to be
changed by somebody later. It is a term of the program rather than a fact about
money, and changing it is a decision about what the firm is buying from a
partner, not a bug fix.

## 5. Tiers apply forward, not backward

A partner who reaches ten orders in a month moves to the higher rate for what
they send **next**. The nine before it are not repriced.

The retroactive reading was considered and rejected. It would mean no accrual is
final until the period closes, which contradicts both rules this phase rests on:
an accrual is written at delivery, and it is never edited. The firm would be
telling a partner a figure it knew might move.

The cost is real and worth stating: a partner near a boundary earns less than a
retroactive scheme would pay them. It is legible in the ladder, and the operator
sets the boundaries.

## 6. What counts as a qualified lead

A lead is qualified when somebody at the firm converts it into a client and a
file. That is the firm's own act, and it is the only definition that cannot be
gamed by sending more forms.

Idempotent by a unique index on the lead, so converting twice cannot pay twice.

## 7. The statement, and which period an entry belongs to

Not the period it was **earned** in. The period it becomes **payable** in, which
is what a holdback means: a commission earned on the 28th with a thirty day
window is October's to pay, and a partner reading their statement should find it
where the window says it will be.

A reversal is payable at once. A refund arriving after its accrual was already
paid lands as a negative on the next statement, and the two net across periods.
That is arithmetic a partner can follow, and it is better than the firm quietly
writing off the difference or asking for a cheque back.

**Nothing is opened when nothing is owed.** If the net is zero or negative, no
statement row is created and the balance carries into the next close. An empty
statement is a document saying the firm settled with somebody when it did not,
and a negative one is an invoice to a partner, which this program does not
issue.

**The entries are the lines.** `eng_statement_lines` copies description and
amount off the order because an order can be re-priced. That reason does not
apply here: an entry cannot change, so the statement claims entries by id and
there is no second copy of a figure to drift. Following the customer pattern
anyway would have been cargo cult.

## 8. The platform records a payout, it does not perform one

There is no payout API in `ops-partner-comp.ts` and there should not be. The
firm pays a partner however it pays anybody, and an operator writes down that
they did, with the reference it was paid under. A platform that can send money to
a third party is a platform where anybody who reaches it can.

The reference is required. A payout with nothing to check it against is
somebody's word three years later.

## 9. `marginOf` gained a fourth cost, and it is required

The decision document called this the highest risk change in the phase, because
it is a change to code that is correct today and is read as authoritative.

`partnerCostCents` is a **required** property on `FileMoney`, not an optional
one. Optional would have meant every existing caller kept compiling and kept
reporting the old, too-high number, which is the exact failure that module
exists to prevent. Required means the compiler names every place that has to
think about it.

The three answers a caller passes:

| Situation | Value | Why |
| --- | --- | --- |
| No partner on the file | `0` | A real, knowable cost of nothing, exactly as a desk review has no technician cost. |
| A partner, entries in the ledger | the net | Including any reversal. |
| A partner and no entry yet, or any blocked entry | `null` | Something is coming and its size is not known. The margin is unknown rather than optimistic by the commission. |

It is read from the ledger in one batched query rather than stored on
`eng_files`. A `partner_cost_cents` column would be a second copy of a figure
the ledger already holds, and the two would agree until the day a reversal
landed and something forgot to update the file. The margin would then be wrong
with a plausible number in it.

**Its injection test.** `money-audit`'s load bearing check is the negative one:
a file with a partner commission must not produce the margin it had before the
commission existed. A version of `marginOf` that accepts the fourth cost and
ignores it passes every positive check in that file and fails this one. Verified
by injection: the mutation was applied, six checks failed, and the mutation was
reverted.

## 10. What Section 3 does not build

- **No partner sees any of this yet.** There are still no pages under
  `/partner`. The ledger accrues and the statements close; the partner portal is
  Section 4.
- **No screen for the operator either.** Closing a period, issuing and recording
  a payout are functions with no button on them until Section 6.
- **Nothing computes a tier uplift at close.** By ruling, not omission: see 5.
- **The percentage models remain configuration.** If the fee splitting answer is
  "flat only", `percent_of_order` and `tiered_by_volume` leave by deleting two
  values from a check constraint and two branches in `partner-comp.ts`. No
  schema and no screen moves.
