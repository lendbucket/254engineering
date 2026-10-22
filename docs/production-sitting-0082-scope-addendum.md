# Sitting: 0082, a scope addendum is signed before design is paid

Branch `feat/design-addendum`, built on `feat/lines-order-ready` (it needs
0081). Written 2026-10-22. **Applied nowhere yet.** Development first, then the
board, then production, where the first real addendum is the McAllen design
job, written by the chat from the operator's details. Those details are never
written into this repository.

## Why

Operator rulings of 2026-10-22:

- Custom design pays the engineer 35% of the engineering fee under a signed
  scope addendum, and **no figure is paid without it**.
- He signs it **in the portal, under his own account, with a fresh second
  factor, recorded as a seal act exactly like a protocol signature.** No PDF
  signing, no email signing.
- The McAllen job is quoted at $2,000 flat, the design minimum, so $700 to him.

## What changes

| | |
| --- | --- |
| `eng_scope_addenda` | new table: the quote it prices, the deliverable, the engineer, the scope, the fee, his share in basis points and his pay (which must equal fee x share). The database writes the text he signs and its SHA-256 from those figures and the quote. Append only. |
| `eng_seal_acts` | kind `addendum` and `addendum_id`; one live signature per addendum. The kind check is dropped and re-added widened in one statement, the 0081 pattern. |
| `eng_seal_act_check` | an addendum is signed only by the engineer it names, over the hash of its own text |
| `eng_record_addendum_signature` | the one door a signature comes in by |
| `eng_design_pay(quote)` | his pay on a quote: the NEWEST addendum on it, only while it carries a live signature; otherwise no row |

The application signs through `src/lib/scope-addendum.ts` (the protocol
signing pattern), on the engineer's existing `/portal/protocols` screen, and a
decided design review credits exactly the signed addendum's figure
(`productionCreditFor`, `src/lib/ops-engineer.ts`), or nothing and says why.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0081 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0081 | `d73cdd49ae5da6268743584229cb3b88` | 1265 | `dfbdf7fcca64c3b093e736b30daa7786` | 1159 |
| at 0082 | `a258e26388bae4c58539ea5325416d62` | 1278 | `6600b007ede30ef5f65e22ab5c017988` | 1177 |

## Section 0: read first

```sql
-- the shape query. Expect: d73cdd49ae5da6268743584229cb3b88, 1265 (0081 applied).

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_kind_check';
-- Expect exactly one row: CHECK ((kind = ANY (ARRAY['letter'::text, 'protocol'::text])))

select to_regclass('public.eng_scope_addenda');
-- Expect: null.
```

## Section 1: apply

`apply_migration` with the file
`supabase/migrations/0082_a_scope_addendum_is_signed_before_design_is_paid.sql`,
name `0082_a_scope_addendum_is_signed_before_design_is_paid`. Robert approves a
confirmation on the drop if the connector asks; nobody runs SQL by hand.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: a258e26388bae4c58539ea5325416d62, 1278.

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_kind_check';
-- Expect: Section 0's definition with 'addendum'::text added after 'protocol'::text.

select count(*) from eng_scope_addenda;
-- Expect: 0.

select p.oid::regprocedure from pg_proc p
 where p.proname in ('eng_record_addendum_signature', 'eng_design_pay', 'eng_scope_addendum_text') order by 1;
-- Expect three rows.
```

## Section 3: development, after Section 2

The session runs `scripts/exercises/design-addendum-walk.mjs` on development:
an invented quote at an invented address, @audit-probe.invalid contacts, and a
test engineer who exists only in that process. It proves, through the app,
that an unsigned addendum pays nothing, a wrong code signs nothing, his own
code signs it over its own hash, it then pays $700 on the $2,000 fee and a
decided design review credits exactly that, and voiding stops both. Then the
branch is boarded.

## Section 4: production, only in the sitting

Sections 0, 1 and 2 against `fsaryeciduszuahgjbly`. Then the chat writes the
McAllen design quote and its addendum on production from the operator's
details, which the session sends in chat and never commits. The addendum names
Aman, the scope (framing check, attachment and uplift calculation, sealed
letter), $2,000 and 35%, so $700; the database writes its text and hash. He
reads and signs it on `/portal/protocols`. Until he does, `eng_design_pay`
returns no row and nothing is credited.

## What this does not do

It sends nothing to anybody. It does not take payment, convert a quote into an
order, or dispatch: work on the McAllen job starts only after the operator has
the customer's documents and authorization, the payment, and Aman's signed
addendum.
