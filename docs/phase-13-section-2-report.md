# Phase 13 Section 2: trade pricing with enforced floors

**Run completed. Board green, 52 audits. Tree clean. Not merged.**

---

## THE ONE THING TO RULE THIS MORNING: ELEVEN FLOORS

Not one floor is written by this session, which is the rule this section turns
on. Every entry in `src/config/trade-floors.ts` is `pending`, and until you rule
them **no trade price can be set on anything, at any value, by anybody.**

| Deliverable | Published | Type | Fee |
| --- | --- | --- | --- |
| `roof-inspections/standard` — Roof certification letter | $600.00 | field | $175.00 |
| `windstorm-wpi-8/standard` — WPI-8E windstorm evaluation | $850.00 | field | $175.00 |
| `foundation-inspections/standard` — Foundation certification | $650.00 | field | $175.00 |
| `manufactured-home-foundation-certifications/standard` | $650.00 | field | $175.00 |
| `solar-structural-letters/standard` — Solar structural letter | $450.00 | desk | none |
| `structural-letters/standard` — Structural letter for permit | $550.00 | desk | none |
| `repair-specifications/standard` — Repair specification | $900.00 | desk | none |
| `residential-light-commercial-design/beam-header-sizing` | $750.00 | desk | none |
| `residential-light-commercial-design/carport-patio-plan-set` | $1,500.00 | desk | none |
| `residential-light-commercial-design/custom-package` | **quoted** | quote | none |
| `forensic-engineering/standard` — Forensic investigation | **quoted** | quote | none |

A floor is ruled by editing that file: replace `{ state: "pending", because: AWAITING }`
with `{ state: "set", floorCents: N, because: "...", by: "...", on: "2026-09-14" }`.
The board fails if a floor is set without an author, a date and a reason.

---

## DECISIONS TAKEN AND FLAGGED

**1. Floors are keyed per DELIVERABLE, not per service line.**

The brief said "every service line named". The catalogue does not price service
lines; it prices deliverables keyed on `(serviceSlug, tier)`, and has since your
ruling of 2026-09-03. Eleven deliverables across nine lines.

`residential-light-commercial-design` makes a per-line floor impossible to state
honestly: it sells at $750.00, at $1,500.00, and by quote. One floor would
either block the cheapest or under-protect the dearest, and choosing between
those is inventing a rule you did not give.

Taken rather than asked because it is structural rather than a floor VALUE.

**2. The two quoted deliverables are listed and pending rather than omitted.**

Omitting them would be the file deciding a deliverable can never have a floor,
which is a decision about money. If you rule that a quoted deliverable takes no
floor, that is an entry saying so, not an absence.

**3. AN ACCOUNT CARRYING A TRADE PRICE CANNOT BE DELETED. This one needs you.**

`eng_account_trade_prices` cascades from the account and refuses DELETE, so the
cascade raises and the whole delete fails. That is correct — a record of what
somebody was charged that vanishes when their account is tidied away is not a
record — and it has a consequence: **an account that genuinely should be removed,
a duplicate or a mistake, cannot be once a price has been set on it.**

The alternatives are a soft delete on accounts, or letting the cascade win and
losing the money record. That is a decision about money records and it is yours.
The audit asserts the current behaviour so it cannot change without somebody
deciding to.

---

## GATE 0: WHAT THE CATALOGUE ACTUALLY SAYS

Read against the code rather than against any registry.

**No `refundDisclosure` field exists on a catalogue entry.** It is COMPUTED by
`refundDisclosure(entry)` in `ops-orders.ts` and stored on the order at intake as
`refund_disclosure`. For a field order it names the inspection fee as a figure
and says "You are never charged more than the price shown above".

**$175 is four of eleven, not a rule.** Exactly the four field deliverables
carry an inspection fee; the seven desk and quote deliverables carry none. This
matches what `CLAUDE.md` already records about the email port's refund copy.

**Nothing today prices differently for a B2B account.** Zero occurrences of
account-conditional pricing anywhere. Trade pricing is genuinely new; there was
no second pricing system to avoid building beside.

**The order already captures everything.** `ops-intake.ts` writes `price_cents`,
`coastal_surcharge_cents`, `inspection_fee_cents`, `total_cents`,
`refund_disclosure` and a full `catalog_snapshot` of the entry. So "the price an
order is placed under is captured on the order, not looked up later" was
**already true before this section**, including a snapshot of the whole entry.
No new column was needed and none was added.

**Twelve modules touch a price.** The ones that had to learn about a trade price
were the quote path (`quoteFor`), the batch splitter, the two preview routes and
`placeBatch`. Statements and reports read `total_cents` off the order row, which
is the captured figure, so they needed no change — and that is why they cannot
disagree with checkout.

---

## WHAT WAS BUILT

- `src/config/trade-floors.ts` — eleven entries, all pending, derived from the catalogue both ways.
- `0045` — `eng_account_trade_prices`, append-only, superseded never edited.
- `0046` — `pricing.write` as its own grant, admin alone.
- `0047` — `eng_set_trade_price`, because neither write order works from outside a transaction.
- `src/lib/trade-pricing.ts` — the floor check, the refusal, the history.
- `/api/portal/accounts/pricing` — gated on `pricing.write`, no floor parameter, no override parameter.
- `/portal/accounts/[id]/pricing` — the screen, linked from every account row.
- `scripts/trade-pricing-audit.mjs` — 31 checks, in PHASE_ZERO.

All three migrations are **development only and declared pending**. Production
has none of them.

---

## DEFECTS FIXED, WITH THEIR INJECTIONS

**1. Supersession never worked, and my own comment had documented the failure as
though it were safe.**

`setTradePrice` inserted the new row then superseded the old, with a comment
arguing that order kept a price in force at every instant. 0045's partial unique
index refuses the second in-force row, so the insert failed every time and the
application reported colliding with itself:

    FAIL: a second price supersedes the first
      (Somebody set a price for this service a moment ago.)

Three attempts, each refused by a guarantee 0045 put there on purpose. Insert
first collides with the index, which is checked per statement because it is an
INDEX: only a deferrable unique CONSTRAINT waits, and partial uniqueness cannot
be declared as one. Supersede first cannot name a successor that does not exist.
The answer is to mint the successor's id first and defer only the
self-referencing key.

**2. A check of mine contradicted its neighbour and had been passing by luck.**

One asserted "override" appears nowhere in the pricing module; the next asserted
the refusal sentence "There is no override" IS present. Both read the same
comment-stripped text. It passed because the strip happened to swallow the
region the sentence sat in; rewriting an unrelated comment exposed it.

There are two views now: `code` with comments and string contents stripped, and
`prose` as written, because the two questions are different.

**3. The teardown was fighting the table.** See decision 3 above.

**4. The board refused to start.** `trade-pricing-audit` declared
`@runtime react-server` and imports nothing server-only; the child process it
spawns is what imports the server-only module and passes the flag itself.

**5. An empty batch reported a total of $0.00.** Found by reading the walk.
`reduce` over an empty array returns the seed, so the zero was arithmetic rather
than a decision. It is the absent-versus-zero rule arriving in the one place a
customer looks before committing.

**Injections, each separately:** a price at the floor accepted; one cent below
refused with the floor named as a figure; a pending floor refusing one cent, the
floor value and one hundred thousand dollars alike; supersession with the old
price still readable and still carrying the floor it was checked against; a
later floor change unable to reach it; the refund terms stateable and identical
to both order doors'.

---

## THE ARTEFACT PER GATE THAT FOUND SOMETHING NO CHECK DID

**Gate 0, reading the catalogue:** the brief's unit was wrong. Eleven
deliverables, not nine service lines.

**The declaration, reading the register:** nothing. It was correct on the first
run, which is worth saying plainly rather than inventing a finding.

**The screen, reading the screenshot:** the "Awaiting a floor" panel named ten
deliverables as waiting on you and did not say WHERE a floor is ruled. A screen
that names what it is waiting for and not where it is given reads as broken.

**The walk, reading the output line by line:** two findings. The batch total of
$0.00 above, and this —

**TRADE PRICING IS ENTIRELY BEHIND THE COMPLIANCE GATE.** The first walk could
not produce a quote at all:

    PREVIEW REFUSED: The firm's registration with the Texas Board of
    Professional Engineers and Land Surveyors is pending. No order can be
    placed and no payment can be taken until it is active.

So there are **two independent reasons nothing can be sold at trade pricing
today**, and the eleven pending floors are only one of them. The walk runs
inside an open-gate child process now.

The quote itself, once the gate was open, reads as it should:

    Sealed document (agreed price)
      $425.00
      note: Your account has an agreed price for this service.
            The published price is $550.00.

    the same line with no agreed price:
    Sealed document  $550.00

---

## THREE TIMES IN ONE RUN: A FRESH import() IS NOT FRESH ENOUGH

The floor register and the launch conditions are module constants. Three
separate times tonight a patch was written to disk and the already-bound
constant was read instead: in the pricing audit's live half, in the walk's quote
step, and in the gate fixture's own `already true` handling.

`scripts/lib/gate-fixture.mjs` records this defect in exactly those words after
it cost a run in September. Each time the answer was the same: a child process
has no module graph to invalidate.

---

## WHAT IS NOT DONE

**The credit gate was not re-shaped for trade prices.** It reads `total_cents`
off order rows, which is the captured figure, so it already sees trade-priced
orders correctly. The brief asked for the `readEvery` shape; `ops-accounts-admin`
already uses it for every figure the gate consumes. **No change was made and
none appeared to be needed**, which is stated rather than claimed as done.

**No figure was added to `figure-surfaces`.** The trade price is not a figure on
a report; it is a price on an order, and the order's figures are already swept.
If you want the pricing screen in the demo sweep, say so and it goes in.

**The perf gate was not run at both ceilings for the new screen.** The board's
`perf-audit` passed, which measures the declared surfaces; the new screen is
inside the portal surface and was measured with it. A dedicated two-ceiling run
was not done and is the one verification item from the brief that is
outstanding.
