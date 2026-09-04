# The partner program: the regulatory shape

Phase 9 Section 0. Report and stop. No code has been written beyond this
document and the branch it sits on.

This section decides what the product may be. Building the wrong version is
worse than building nothing, because the wrong version puts the firm's own
registration at risk to win referral revenue.

---

## 1. The model this build implements

**Model 1, referral, with the co branded surface of model 2 constrained so the
performing firm is unmistakable.** Concretely:

- The partner promotes 254 Engineering Services under 254's name.
- Traffic arrives through a tracked link or a spoken code.
- A partner facing landing page may carry the partner's logo **alongside**
  254's, and names 254 Engineering Services as the firm performing and sealing
  the work on every page and in every document.
- The customer transacts with 254 Engineering Services. The order, the payment,
  the file, the engineer's decision and the sealed deliverable are all the
  firm's, exactly as they are today.
- The partner is paid for bringing the client.

**Why this and not pure model 1.** The operator's stated intent is resellers who
market the firm's services and use its name to win clients. A partner who cannot
put their own logo anywhere has no way to explain to their own customer why they
are involved, and will either stop selling or start improvising, which is worse.
Co branding is the honest version of what is already going to happen.

**Why the constraint is where it is.** The line this build draws is not about
logos. It is about **who the customer believes they are buying engineering from**.
A partner logo beside the firm's, with the firm named as the provider, is a
partner. A partner logo where the firm's should be is an unregistered entity
offering engineering services, which is the thing to avoid.

### What that means in code, stated now so it is not negotiable later

1. Every partner facing page renders the same performing firm block: the firm
   name, and the registration line the rest of the platform already renders
   through `isPrelaunch()` and `src/config/credentials.ts`. Not as a footer, and
   not as fine print: on the page, near the offer.
2. No partner surface may render a service claim the public site could not
   render. `voice-audit`'s regulated phrase checks and the prelaunch gate apply
   to partner copy identically, including anything the operator uploads to the
   asset library.
3. A partner's name never appears on a deliverable, a binder, a sealed document,
   or the responsible charge log. Those are the engineer's record.
4. The partner's own portal is the only place a partner's branding is primary,
   and no customer sees it.

---

## 2. Full white label: considered and rejected

Recorded here so a later session does not read its absence as an oversight, and
does not build it as an obvious next feature.

**Rejected.** A white label program is one where the customer believes the
partner is the engineering firm. Under the constraint the operator cites, Texas
Occupations Code 1001.405, a business entity may not offer or advertise
engineering services in Texas unless it is registered with the board. A partner
presenting as the provider is doing exactly that, in the firm's own product, with
the firm's own tooling doing the presenting.

The cost is not only the partner's. This platform's entire compliance posture is
built on a gate that stops the firm itself from implying it performs engineering
work before its registration issues. A program that lets an unregistered third
party present as an engineering provider would make that gate theatre: the firm
would be enforcing a rule on itself while shipping a feature whose purpose is to
let somebody else break it.

**It is not a configuration flag, and it must not become one.** If a future
session is asked for white label, the answer is a new conversation with the board
or an attorney, not a boolean.

---

## 3. Two questions for the operator, not for me

Both are flagged rather than answered because both are legal questions with
product consequences, and a wrong guess is expensive in a way that is not
recoverable by refactoring.

### 3.1 May a percentage of an engineering fee be paid to an unlicensed referrer?

This determines the entire compensation model. The two shapes are:

- **A share of the engineering fee.** Simple to explain to a partner, aligned
  with order value, and the shape most referral programs take.
- **A flat marketing fee per lead or per order.** Compensation for a marketing
  service rather than a share of professional fees.

Fee splitting with unlicensed persons is restricted in several professions and
the rules differ by profession and by state. I do not know how Texas treats it
for engineering and **this is a question for TBPELS or a licensing attorney.**

**What this build does about it:** the compensation engine is built so both are a
row in a table rather than a code path. Four models, chosen per partner:
percentage of order value, flat per order, flat per qualified lead, and tiered by
volume. The answer changes a configuration and a statement's arithmetic, never a
schema or a screen. If the answer is "flat only", the percentage model is removed
in one migration and one audit assertion, and nothing else moves.

### 3.2 Must partner marketing copy be reviewed before use, and is the firm answerable for what a partner publishes in its name?

**Designed assuming yes**, per the brief, and that assumption has real
consequences worth stating:

- The asset library is the source of approved copy, versioned, and a partner sees
  the current version.
- The program agreement states the partner may not modify approved copy without
  approval.
- The operator's side gets an approval surface for partner material where
  approval has been required.

**What the platform cannot do, and the report should say so plainly:** none of
this stops a partner writing whatever they like on their own website. The
controls here make the approved path easy and the agreement explicit; they are
not enforcement. If the firm is answerable for a partner's published claims, the
real control is the agreement, the right to withdraw approval, and somebody
looking at what partners publish. The platform supports that; it does not
substitute for it.

---

## 4. What the platform already has, and what genuinely has to be new

Grounded in the code rather than assumed, because the brief asks whether existing
machinery fits and in one important case it does not.

### Already there, and the partner work rides it

| Need | What exists |
| --- | --- |
| Capture on landing | `eng_leads` and `eng_service_orders` both carry `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_path`, `referrer`. The partner code rides this same path rather than a second one. |
| A third principal boundary | The customer boundary is the working model: separate cookie, separate secret, a different HMAC label so identical secrets still produce different keys, its own route group, and a proxy branch that returns before the staff branch. `accounts-audit` already asserts the shape. |
| An audit trail for attribution events | `writeAudit` and `eng_audit_events`, append only by trigger. |
| Immutability | `eng_forbid_mutation` is the existing pattern for a row that must not change after the fact. |
| Money that refuses to guess | `ops-money`: an absent figure is never zero, and absents are excluded from totals and footnoted. |

### The one place the brief's assumption does not hold

**The statement machinery does not fit a partner payout, and forcing it would be
a mistake.** `eng_statements.account_id` is `not null references
eng_customer_accounts`, and `eng_order_payments.kind` is `charge` or `refund`.
That machinery describes **money coming in from a customer**. A partner payout is
money going out to a third party.

Reusing it would mean either a nullable subject on a table whose whole point is
that it names one, or a statement whose sign depends on which foreign key is
populated. Both make the invoicing code answer two questions, and invoicing is
the code where this platform is most careful about a figure meaning one thing.

**Proposal:** a separate `eng_partner_statements`, modelled on the existing one
and deliberately not the same table. The SHAPE is reused; the row is not. The
close and issue split is worth copying exactly, because it is right for the same
reason: gathering what is owed and telling somebody they are owed it are
different acts and a mistake in the first must not be a mistake in the second.

### The change to existing money code, which needs its own injection test

`marginOf` takes `FileMoney { clientPriceCents, techCostCents, engineerCostCents }`
and its `missing` array names those three. Partner cost is a fourth cost, and the
day the program launches every margin figure the firm reads is **wrong by the
commission** until it is added.

This is the highest risk change in the phase, because it is a change to code that
is correct today and is read as authoritative. It gets its own injection test in
`money-audit`: a file with a partner cost whose margin does not account for it
must fail.

---

## 5. Accrual event, chosen and justified

The brief asks the session to choose. **Accrue on delivery, not on payment.**

An order refunded after a declined seal would otherwise leave the firm having
paid commission on money it returned. The refund rule already makes two of four
decline cases a **full** refund, so this is not a rare edge: it is the ordinary
outcome of an engineer declining before a visit.

**How a refund reverses an accrual:** it does not edit the accrual. It writes a
reversing entry against the same order, exactly as the payment ledger records a
refund as a row rather than by amending the charge. An accrual and its reversal
both stand in the record, and the partner's statement nets them. That is the same
rule the firm applies to its own money, and a partner is owed the same honesty.

**The holdback window** exists for the same reason and is a per partner
configuration. An accrual is not payable until it has been through it.

---

## 6. What I am asking for at this gate

1. **The model.** Confirm referral with constrained co branding, and that the
   performing firm is named on every customer facing partner surface.
2. **Fee splitting.** This needs TBPELS or an attorney. The build proceeds with
   all four compensation models as configuration so the answer does not force a
   rewrite, but the answer should arrive before a partner is actually paid.
3. **Copy review.** Confirm the assumption that partner marketing is reviewed
   before use, and note the limit: the platform makes the approved path easy and
   records the agreement, and cannot stop a partner writing what they like
   elsewhere.
4. **The separate statement table.** Confirm a partner payout gets its own table
   rather than a nullable subject on the customer one.
5. **Accrual on delivery, reversed by a counter entry.** Confirm.
6. **`marginOf` gains a fourth cost.** Confirm this change to existing money code
   is in scope, because every margin figure is wrong by the commission until it
   is made.
