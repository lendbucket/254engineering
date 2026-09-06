# The partner portal

Phase 9 Section 4. The section that makes the proxy branch written in Section 2
load bearing rather than latent: until now `/partner` was a guarded door with
nothing behind it.

Built to the native standard at 390 recorded in
`docs/PORTAL_DESIGN_STANDARDS.md`, not to the shape the staff portal had before
Phase 11 Section 2. Operator instruction, and the reason is that building it to
the old shape would mean building it twice.

---

## 1. What a partner may see, decided before anything was written

The four non negotiables from `docs/partner-program-decision.md` say where a
partner's branding may be primary and that a partner never appears on a
deliverable. They do not say what a partner may READ, and that is the question
this section actually turns on, because every screen here is a read.

**The rule: a partner sees the facts of their own referral and their own money,
and nothing about the engineering.**

| Shown | Not shown, and it is not an oversight |
| --- | --- |
| When a referral arrived, and by which code | The property address |
| The order reference | The client's name, or any contact for them |
| The order value, where a commission was computed from it | The file number, the file's status, or its evidence |
| What was accrued, held, reversed and paid, with the sentence explaining each | The engineer's decision, the reason for a refusal, any document |
| The current agreement and when it was accepted | Anything the firm paid a technician or an engineer, and any margin |

The order value is shown only where it is the basis of a commission. Under a
percentage model the partner cannot check their own statement without it, and a
figure a partner cannot check is the thing this whole phase is built to avoid.
Under a flat fee model no basis is shown, because none was used.

**Why the property address is not on the list.** A partner who made the referral
very likely knows the address. That is not a reason for the platform to restate
it: what the firm holds about a property is the client's, the boundary is easier
to defend when it has no exceptions, and the first exception is what makes the
second one arguable.

## 2. Enforced by construction, not by remembering

The partner reads live in one module. Every function takes the partner id from
the session and no caller can pass a different one. The select lists in that
module never name a forbidden column, which `partner-audit` asserts against a
written list, so adding `property_address` to a query fails the suite rather
than shipping a leak.

That is the same shape as the customer boundary: a partner has no row in
`eng_profiles`, no row in `eng_customer_users`, and no auth user, so neither the
staff nor the customer code can return one by accident.

## 3. Branding, and the one thing the schema cannot do yet

Non negotiable 4 says the partner portal is the only place a partner's branding
is primary. `eng_partners` holds an organisation name and no logo, so what is
primary here is the organisation's NAME, rendered as the identity of the
surface, with 254 Engineering Services present as the firm whose platform it is
rather than as the brand of the page.

A partner logo needs somewhere to put a file, which is the asset library, which
is Section 5. Recorded here so that a reader of this section does not think the
non negotiable was ignored.

## 4. What the portal deliberately does not let a partner do

- **Change their payout details.** They are displayed and not editable. A
  referrer who can change where money is sent, from a session, is the shape of
  every payout fraud that has ever worked. Changing them is a conversation with
  the firm, and the firm records it.
- **Dispute an attribution in the product.** A dispute is settled by an operator
  recording a decision and a compensating entry, which is Section 6. A button
  that filed a dispute into a queue nobody watches would be worse than an email
  address.
- **See another partner's anything.** There is no partner list, no league table
  and no comparison. Those exist in programs whose point is competition between
  partners, and this program has one partner at a time and a firm whose
  registration is pending.
- **Sign themselves up.** No registration form. A partner using the firm's name
  is a decision the firm makes, and a signup form is the firm not making it.

## 5. The native standard, applied to a second app

The staff portal's shell was built once in Phase 11 Section 2 and this is the
second surface to need it. The chrome is not shared code: the staff shell
derives its navigation from the authorization matrix, and a partner has no role
and must never appear in that system.

What IS shared is the design system itself, `@/components/portal/design`, which
is where the primitives live that the standard is written about: the card and
table component, the sheet, the panels, the restricted mode notice. Sharing the
primitives and not the shell is the line that keeps a partner out of `can()`.

Every point of the standard applies here and is checked by the same audit that
checks the staff portal.

---

# Section 5: the asset library, and the compliance of partner copy

Built 2026-09-05. The section that turns the four non negotiables from sentences
in `docs/partner-program-decision.md` into things that fail.

## 1. What became enforceable

**Non negotiable 2, no partner surface may render a service claim the public
site could not.** `src/lib/partner-copy.ts` runs a piece of copy through the
same regulated patterns, never claims, banned phrases and style laws the site's
own audits use. Copy that fails cannot be published into the library, so it
cannot reach a partner through the approved path at all.

**The application imports `scripts/lib/regulatory.mjs`.** The direction is
unusual and it is deliberate. The alternative is two copies of the regulated
vocabulary, and the header of that file records what that costs: two detectors
carried their own lists, they disagreed within a day, and the half that mattered
was the stale one. The audits were the first reader of that knowledge, not its
owner.

**Non negotiable 1, the performing firm named near the offer.**
`performingFirmLine()` is the one wording, and the partner surfaces call it.
They did not at first: Section 4 hand wrote the sentence on three screens, which
is the drift the function exists to prevent sitting in the same repository as
the function. `partner-audit` now fails if any of them writes it out again.

**Non negotiable 3, no partner name on a deliverable or the responsible charge
log.** Asserted against `ops-binder`, `ops-docs` and `ops-review`: none of them
may read `eng_partners`, `partner_code`, or `organisation`. The margin is
allowed to know a file HAS a partner, because a commission is a cost of the
file, and it reads the id and never the name.

**Non negotiable 4, partner branding primary only inside the partner portal.**
Asserted by walking every `.tsx` under the site, the staff portal, the customer
account and the marketing components: none may render a partner's organisation.

## 2. The check runs on publish and not on submit

The firm's own material is refused if it fails. A partner's submission is
accepted whatever it says.

That asymmetry is the design. A partner sending copy in is ASKING whether it is
allowed; refusing the form would mean the firm never sees the thing the partner
was about to publish anyway, and the partner learns only that the form is
broken. So the same check runs, its verdict is stored with the submission as
advice, and it is the first thing both sides read. A person still decides.

## 3. A version is never edited

`eng_partner_asset_versions` is append only by trigger. A partner who put a
paragraph on their website in March is entitled to know exactly what they were
given in March, and an editable version would mean the firm's record of what it
approved changed under somebody still displaying the old wording. A correction
is version four.

A decided submission is frozen for the same reason one step over: the firm
telling a partner "no, because this sentence" and later telling them "yes"
without the first answer surviving is how a partner ends up publishing something
the firm refused while holding an email that says it was approved. Reopening is
a new submission.

## 4. What the seed proved by failing

The seeded copy explaining who performs referred work was written as
"Engineering work referred through this programme **is carried out by** 254
Engineering Services". It passed every pattern in the library, and it states
that the firm is currently carrying out engineering work.

`is reviewed and sealed by` was already a pattern. `is carried out by` is the
same shape with a different verb, which is what happens when patterns are
written from the sentences somebody happened to write. Added, with the subject
named narrowly enough that "field work is carried out by certified technicians"
is not caught, because that is a statement about how a process is specified
rather than a claim to be performing engineering.

The seed publishes through `publishAsset` rather than inserting rows, so the
demonstration cannot contain copy the product would have refused.

## 5. The limit, said on the screen

None of this stops a partner writing whatever they like on their own website.
The materials screen says so in those words, under a heading that says what
approval does and does not do. That is not a disclaimer, it is the reason the
approved path is worth using: the firm is asking rather than pretending it can
enforce.

The real control is the agreement, the right to withdraw approval, and somebody
looking at what partners publish. Withdrawing is why the asset bucket is
private: a public bucket would mean every one pager the firm ever published
stays retrievable by url forever, including the version it withdrew.

---

# Section 6: the operator's side

Built 2026-09-06. The roster, the terms, the invitations, the statements and
payouts, the corrections, and the screen that explains why an order went where
it went.

## 1. One capability, admin only

`partners.manage`, added to the Action union and seeded to the administrator by
0021. Behind it: who may use the firm's name to win work, what the firm owes
somebody outside it, and the record that money left. None of those is a job
somebody does on the firm's behalf without being the firm.

One action rather than four. A coordinator who could approve partner marketing
but not see what a partner earns sounds tidy and is not a role this firm has:
the person who talks to partners is the person who pays them. Splitting it later
is one action and one migration; splitting it now would be inventing a job to
justify a permission.

Since 0018 roles are data, so an owner can grant it to a role they create. What
the seed decides is where it starts.

## 2. The capability is asked where the write is

Every exported function in `ops-partners-admin.ts` asks `can(actor,
"partners.manage")`, and the route asks before the switch. Neither is redundant:
the route answers the request, and the module check is what a second route added
next month cannot skip. `partner-audit` derives the list of exported functions
and requires every one of them to ask, so a function added later is covered by
the check that already exists.

## 3. What the dispute screen found

0014's comment says the touch log keeps the losing touches because "a dispute is
settled by showing the partner the touch that beat theirs, which is impossible
if only the winner is kept."

Building that screen found the join was missing. A touch is keyed by the visitor
cookie, and the order never stored the key it was attributed under. The evidence
was complete and unreachable from the record it explains.

Typed codes were the exception, because those touches are written under a
synthetic `order:<id>` key. That is why it went unnoticed for two sections: the
dispute case anybody tests by hand is somebody typing a code, and that one
worked.

0022 adds the column and `attributeOrder` writes it. Orders attributed before it
cannot be reconstructed, and the screen says so in those words rather than
showing an empty list, because an empty list is the claim that there were no
touches.

## 4. Nothing on that screen changes an attribution

It cannot: 0014 freezes the attribution columns on a paid order at the database.
A dispute is settled by an adjustment on each partner's ledger, recorded with
the reason written out, and both the original entry and the correction stand
where the partner can read them.

That is why `recordAdjustment` demands twenty characters of reason and is
payable at once. An adjustment with no explanation is a figure a partner cannot
check, and holding back a correction the firm made itself would mean a partner
waiting thirty days for money the firm agrees it owes.

## 5. What the roster made visible

Eight partners reading "ZZ probe, safe to ignore", created on 2026-09-04 by an
end to end script for Section 2 that is not in the tree any more. No audit had
ever reported them; the check that found them was looking at the screen.

**Seven of the eight cannot be deleted, and that is the rule working.** A touch
refuses DELETE, and it references the partner with ON DELETE RESTRICT, so a
partner who was ever touched is held by their own evidence. The sweep removes
the ones with no touches, leaves the rest, and says which. The first version
tried to delete the touches first; that delete matched nothing, returned no
error, and the partner delete then failed on the constraint.

This is the same standing as `eng_audit_events`. A probe row that cannot be
erased is the price of a guarantee worth more than tidiness, and the alternative
is weakening a trigger to tidy development.

The roster puts ended partners behind a disclosure with a count, which is a
better list for a real firm as well as a tidier one here: the roster answers who
is sending work, and an ended relationship keeps its ledger and its statements.

## 6. Two checks that were looking at the wrong thing

Both found by injection, both in checks written the same afternoon.

**The visitor key check matched the wrong line.** `visitor_key:
input.visitorKey` appears twice in `ops-partners.ts`: once in `recordTouch`,
where it has been since Section 2, and once in the order update 0022 added. The
unscoped match found the first and passed while the injection had deleted the
second. Scoped to `attributeOrder` now.

**The permission check could only see three roles.** It matched MATRIX blocks
with a regular expression, so it was blind to the five roles `DEFAULT_ROLES`
declares with their own grant lists, and an injection that gave
`partners.manage` to sales passed it. It asks the declaration now, which is what
the migration is generated from and what roles-audit compares the database to.

And one harness defect worth the same treatment: the injection that was supposed
to delete the order's visitor key deleted the touch log's instead, because
`String.replace` takes the first match. The byte count moved, so the harness
believed the mutation had applied. It proved that a mutation happened, not that
the right one did.
