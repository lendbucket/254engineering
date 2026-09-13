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
