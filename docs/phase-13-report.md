# Phase 13: self-service accounts and trade pricing

**Run in progress. This file is written as the run goes rather than at the end,
so that a run which stops leaves a report rather than nothing.**

---

## RULINGS NEEDED, AT THE TOP

### 1. 0042 IS ON MAIN AND PRODUCTION DOES NOT HAVE IT

**`schema-ledger-audit` went red on the first board of this phase, and it is
right.**

    FAIL: no migration is on main without production having it
      (0042_an_incident_is_a_record.sql is merged and the ledger says
       production does not have it. Merged and applied are different facts
       and this is the second time they diverged.)

**How it happened, without anybody doing anything wrong.** Phase 12 Section 6
ran under overnight limits that forbid applying a migration to production, so
0042 went to development only and its ledger entry says `production: null` as a
decision rather than an omission. The entry says exactly that. Then Section 6
merged on the operator's word, and merging is the moment a pending migration
stops being allowed to be pending.

**Why this run cannot fix it.** Phase 13's limits forbid touching production
too. Applying 0042 is the operator's act, and the sequence is the one this
repository already uses:

    apply_migration against fsaryeciduszuahgjbly
    read back BOTH fingerprints
    write the date into supabase/applied.mjs

Expected after it: shape `11a709155214441ec2b7c3b382f6e17f` across 1,030
columns, behaviour `a3a7eb9953f60e59555f7fcddd221a7f` across 824 facts, as
replayed. **Per the amended stop condition of 2026-09-12, judge the live
read-back on the FACT COUNT and the per-kind figures, never on the behaviour
digest**, which cannot match across engines.

**What was NOT done about it, deliberately.** The ledger was not edited to claim
production has it, and `schema-ledger-audit` was not weakened. Either would turn
a true red into a quiet lie, which is the failure the ledger exists to prevent
and the reason this check was built after 0023 diverged the first time.

**This red stays until the operator applies it.** It is the second of two reds
this phase carries.

### 2. THE PREVIEW IDENTITY SECRETS

Unchanged and untouched, as instructed. `MFA_ENCRYPTION_KEY`,
`CUSTOMER_SESSION_SECRET` and `PARTNER_SESSION_SECRET` are declared as sharing a
value between Preview and Production, so a session minted on any preview
deployment is valid on production.

**Phase 13 made it a condition of the launch gate**, because self-service
sign-up means anybody can mint a customer session. Self-service sign-up must not
reach production while this stands, and the gate now refuses to open for that
reason among others.

---

## SECTION 0: THE THREE DEBTS

### Debt 1, the MFA lockout: CLOSED

The encoder half was already done in Phase 12: versions 5 to 17, every boundary
crossed at its exact capacity, the 320-character address round-tripping through
the independent decoder at version 17.

**The half left undone was the cap, and the proof said so in its own words:**
"The platform sets no limit of its own: eng_profiles.email is text and no input
carries a maxLength, so the ceiling is the standard's."

`src/lib/email-address.ts` declares `MAX_EMAIL_LENGTH` as RFC 5321's 320. Not a
round number: 254 or 200 would silently refuse addresses that are legal and
deliverable, and a limit deciding whether somebody can become a customer should
not be this firm's opinion.

The proof **imports** the constant rather than repeating it, and gained a case
proving the platform refuses one character more. Without that it would show the
encoder handling 320 while the platform quietly accepted 400, which is exactly
the gap this debt was about. **15 cases**, run by `mfa-audit` on every board.

`emailRefusal` returns a sentence, names which half is too long, and checks
length before shape so a 4,000-character string is refused for being 4,000
characters.

### Debt 2, the preview identity secrets: RECORDED, NOT CLEARED

Added as a launch condition. Verified: with `LAUNCH_MODE=live` the gate stays
shut and names all three secrets.

**This forced a structural decision worth recording.** The gate is in `src/` and
cannot import from `scripts/`, so the credential inventory moved to
`src/config/credential-inventory.ts`, with `soc2-credentials.mjs` re-exporting
it. The alternative was a second copy of the sharing facts inside `src/` beside
the first copy in `scripts/`, and two accounts of one fact are two accounts that
will disagree.

### Debt 3, the onboarding welcome email: BUILT

Both variants, registered for audit, because the two doors say different things:
one reader asked for this thirty seconds ago and one was on the telephone.
Transactional, so no unsubscribe. Neither ever carries a password.

`email-audit` 598 of 598.

---

## SECTION 1: THE THREE DOORS

**Built, walked end to end, and on a green board: 51 audits, all pass.**

### What was found before anything was built

`createCustomerAccount` **had no caller**. Nothing anywhere in `src` inserted a
row into `eng_customer_users`, so no customer could ever have signed in. The
audit probe builds the whole chain by hand, client to account to user to token,
because the product had no path that did it.

That is the "build the subject" rule from the other end: a harness
reimplementing a flow the platform does not have, passing every run, describing
nothing.

### And a defect that would have broken every door at the last step

`setCustomerPassword` set `status` to active and nothing else. 0043's check
constraint refuses an ACTIVE self service account with no proven address, so the
final step of that flow would have been refused by the database, on a link that
worked, with the person told their password could not be set and no sentence
anywhere naming why.

Proving the address now happens BEFORE activating, which is the only order in
which that flow can complete, and only when the column is null, because the
first proof is the one that answers "when did this address become real".

### The three doors

| Door | Route | Origin recorded | Address proven by |
| --- | --- | --- | --- |
| Self service | `/api/account/sign-up` | `self_service` | opening the link, and it cannot act until then |
| Operator created | `/api/portal/accounts/create` | `operator_created` | opening the link, which is the same evidence arriving by a different act |
| Order checkout | `/api/stripe/webhook` into `releaseForFulfilment` | `order_checkout` | the payment, and the link besides |

All three go through one creation function, and `accounts-audit` sweeps `src`
to assert that exactly one function inserts an account holder. That is the
property the whole registry rests on: three doors producing one record with an
origin recorded is a claim about convergence, true only while there is one
insert.

**The self service door answers one sentence whatever happens.** New address,
existing address and rate limited are indistinguishable from outside. Any other
shape is an oracle. The existing-address case mails a fresh link to the account
that is already there, which is what makes the identical answer honest rather
than a dead end.

**It takes no password.** One typed at sign up would have to be held somewhere
between the form and the address being proven, and both honest places to hold it
mean storing a credential for an address nobody has shown they can open.

**The eighth launch condition is now a gate rather than a note.**
`selfServiceSignUpOpen()` is read by the route AND by the screen. A screen that
hides a form is a screen; the route is what somebody who reads HTML has to get
past.

### The third door's registry entry was false in every clause

It read "the door that already existed. Paying for an order creates the account
that owns it", and named `/api/orders/place`. There is no such route, checkout
creates a CLIENT, an operator later converts the client to an ACCOUNT, and
nothing had ever created a customer USER.

A DECLARATION that describes something the code does not do is the exact failure
the declared inventory idiom exists to prevent, committed by an inventory. It
was found by a check written the same afternoon, which went red naming it.

**Operator ruling: build it for real.** So the claim is true now rather than
deleted, and the correction carries the history.

### What the first walk found, all past a green board and a green typecheck

1. **The sign up door answered "Not signed in."** The route and the screen were
   written, both typechecked, both built, and the PERIMETER had never been told.
   Every structural check was green because each was asking about the route
   rather than about what stands in front of it.

2. **`eng_clients_kind_check` refused every account.** The creation function
   wrote kind `"company"`; the constraint allows `organization` and
   `individual`. Nothing in TypeScript could catch it, because the column is
   text and the rule lives in the database, which is the right place for it.

3 and 4 were in the FIXTURE rather than the product, and they are recorded
because a fixture that lies is worse than one that fails. The order row carried
four of its eight not-null columns. The client row used the same wrong kind AND
DISCARDED THE ERROR, so it inserted an order with no client and the run reported
the DOOR opening a second client for the same person. The check was right and
the fixture was the liar.

### The injection that did not fail, which is the most useful result here

Disabling the repeat-customer linking left **all 27 checks green**. "Releasing
again opens nothing further" passes on the second release of the SAME order,
which returns early on `account_id` long before it reaches the question of
whether this address already has an account. The branch was proven by nothing
and the check read as though it covered it.

The walk gained a real repeat customer: a second order, from a second client,
for the same address. The injection then failed properly, naming the consequence
a person would actually meet:

    FAIL  and the second order is attached to the account the first one opened
          (it points at no account at all)

Which is signing in and seeing one order out of two, worse than seeing none
because it looks like the platform lost something.

### Two constants for one fact, collapsed

`CUSTOMER_TOKEN_TTL_HOURS` was 72 in `customer-auth.ts` and
`VERIFICATION_TTL_HOURS` was 72 in the registry, with `"3 days"` beside it for
the email to render. The email is the half that would have gone on saying three
days after somebody shortened the token, which is the failure the email port
found four separate times.

### The artefact, read as a person would read it

Screenshots of `/account/sign-up` at 390 and 1280, in both gate states. No
horizontal scroll, 844 and 900 pixels tall, and the shut state renders the
notice and no form, which is what ships today.

**Reading the open one found a copy defect no check would have.** The intro said
a single order does not need an account, which was true while paying created
nothing and stopped being true the day the third door was built. Corrected.

### What Section 1 did not do

**The operator has no SCREEN for the door they own.** `/api/portal/accounts/create`
is built, permission gated, audited and walked, and the accounts screen has no
control that calls it. An operator can open an account with a POST and not with
a mouse. That is the next thing.

---

## WHAT EACH GATE FOUND THAT NO CHECK WAS LOOKING FOR

### Gate 0: the fixture could no longer open the gate

Adding the preview-secret launch condition meant `withGateConditionsMet` patched
one file while the gate read two. **Every template in `email-audit` failed its
live footer half, and the gate was working perfectly.**

That is the identical failure this fixture's own header records for 2026-09-10,
one condition later: a fixture that edits nothing runs the live half of an audit
against the prelaunch state while reporting on the live one.

The patches are a list with an assertion each rather than a chain now, and the
preview-secret patch is global, because three secrets are shared today and
patching the first would have left the gate shut on the other two.

**It was found by reading which checks failed rather than by any check**, since
every one of those failures named a template and none named the gate.
