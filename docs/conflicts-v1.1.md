# Conflicts between the v1.1 protocols and the platform

Operator ruling 6 of 2026-10-07: every finding is verified by the session, **the
protocol wins every conflict**, and for each one this file gives the catalogue
or copy change that makes the platform match. Those changes are built line by
line before any line opens. Lines open only when their protocol is signed and
approved, so none of these is live to a buyer today; the copy is.

**How each finding was verified.** A read-only survey produced 27 findings on
2026-10-07. Each was then checked by the session against two things, neither of
them the survey: the protocol sentence against the transcription of the
engineer's PDF on `protocols/v1.1-transcription` (all 35 quotes found word for
word, compared with whitespace removed), and the platform sentence against the
file and line named here, read on `main` at `f1beeab`. Line numbers are as of
that commit plus the two copy commits on `fix/solar-and-wpi8-copy`.

**Status words.** BUILT means the change is committed and named. REFERRED means
the session did not make the change, and the section says why.

## Status, 2026-10-07

This table is the status of every item; the sections below give the evidence
and the change. BUILT means committed on `fix/solar-and-wpi8-copy` and boarded
with that branch.

| # | Item | Status |
| --- | --- | --- |
| 1 | WP-001 four visits, $150 extra | BUILT, `6c0efce`, pinned in price-book-audit |
| 2 | Ongoing deliverable named WPI-8E | BUILT, `6c0efce` |
| 3 | Ongoing accepts passed stages | BUILT, `6c0efce` |
| 4 | Completed construction quoted | BUILT, `7607b11`, ruling 5 |
| 5 | Completed accepts work in progress; existing building priced | BUILT, `6c0efce` |
| 6 | No catastrophe area check | TO BUILD. A county qualifier was built in `6c0efce` and withdrawn before merge as a second home for the county; see the item |
| 7 | Pre-1988: page copy, form verdict, no date asked | BUILT, copy `7607b11`, verdict and date `6c0efce` |
| 8 | Firm promised the certificate | BUILT, `6c0efce` |
| 9 | WS-001 required uploads | BUILT, `6c0efce` |
| 10 | MH below grade | BUILT, `e885631` |
| 11 | MH frost depth | BUILT, `e885631` |
| 12 | MH lender's written request | BUILT, `e885631` |
| 13 | MH multi section and return visit prices | REFERRED, money ruling |
| MH | Retrofit promised | BUILT, `e885631` |
| 14 | Solar wind loading | BUILT, `d328df8`, ruling 4 |
| 15 | Solar reinforcement detail | BUILT, `da80fca` |
| 16, 17 | Solar "No site visit." and drawings alone | BUILT, copy `da80fca`; orderType REFERRED, money ruling |
| 18 | Solar turned away without the array design | BUILT, `da80fca` |
| 19 | Installer photographs | BUILT, `da80fca` |
| 20 | Letter sold as desk review | BUILT, copy `d97e656`; orderType and site job price REFERRED |
| 21 | Letter for any reader | BUILT, `d97e656` |
| 22 | Beam sizing and remediation in the letter | BUILT, `d97e656` |
| 23 | Specification without a visit | BUILT, copy `673894f`; orderType REFERRED |
| 24 | Damage report required | BUILT, `673894f` |
| 25 | Verification and stages | BUILT, `673894f`; a verification order REFERRED, needs a price |
| RS | Adjusters on an open claim | BUILT, `673894f` |
| 26 | DS "No site visit." | BUILT, `6c0efce` |
| 27 | Front photo | BUILT, `6c0efce`, on six lines: WP-001 does not require it, so "all seven" below was one too many |
| Turnaround | Solar, manufactured home, structural letter | BUILT, `da80fca`, `e885631`, `d97e656` |
| WPI-8-C | Is TWIA's route current | Question 1 for Aman; the site's article stays as sourced, operator ruling 2026-10-07 |
| Stages | Engineer selects stages | Question 2 for Aman |

**One correction to item 16 and 17 below.** It said the solar framing input
"becomes required". It did not, on reading the protocol again: the framing is
measured by the technician or shown in the installer's photographs, so asking
the buyer for it adds nothing, and it stays optional.

## Already built on 2026-10-07

| # | Protocol | Conflict | Status |
| --- | --- | --- | --- |
| 14 | SL-001 section 9 | "Wind uplift is not calculated, and the letter says so." The site said the solar letter covers wind loading, in five places. | BUILT, `d328df8`, ruling 4 |
| 4 | WS-001 section 2 | Completed construction is a standard job. The site said it is quoted after a conversation while the catalogue sells it at the published completed price. | BUILT, `7607b11`, ruling 5 |
| 7 (copy) | WS-001 section 12 | "Work to be certified that began before January 1, 1988 ... Declined, with a referral to TWIA." The service page and the inquiry page said such work "may be eligible without inspection at all". | BUILT, `7607b11`, page copy only; the form verdict is item 7 below |

## WP-001, windstorm, ongoing construction

**1. Four visits included, extras charged.** Section 8: "One job includes four
stage visits ... Any further visit is made on an as-required basis as an
additional visit." The operator ruled $150 per extra visit on 2026-10-06.
Nothing on the platform says either. `src/config/prices.ts`, the
`windstorm-wpi-8` `whatChangesIt`, and the ongoing deliverable's `turnaround` in
`data/catalog.ts`.
**Change:** the ongoing sentence in `whatChangesIt` states that the price
includes four stage visits and that each further visit is charged at a price
held in `prices.ts` as its own constant, not typed into the sentence.
The $150 needs a home in the price book first; the cost-per-job report reads
the same constant.

**2. The ongoing deliverable is named for the wrong certificate.** Section 1:
the appointed engineer "can certify compliance on Form WPI-2 and the owner can
obtain a Certificate of Compliance, Form WPI-8". `data/catalog.ts` names the
ongoing deliverable "WPI-8E windstorm evaluation, ongoing construction", and
WPI-8E is the completed construction certificate (WP-001 section 12).
**Change:** rename it "WPI-8 windstorm inspection, ongoing construction".

**3. The ongoing deliverable accepts work that has already passed a stage.**
Section 6.2: "A structure that has already passed a stage that must be
inspected is declined for the ongoing path". The ongoing stage qualifier offers
"Complete and covered up" and "Existing building, no recent work" with
`disqualifyOn: []`.
**Change:** on the ongoing deliverable, disqualify both, with a message routing
the first to completed construction and the second to the windstorm inquiry
page.

## WS-001, windstorm, completed construction

**5. The completed deliverable accepts construction still in progress.** Section
12: "Construction that is still in progress. Routed to the ongoing construction
windstorm line." The completed stage qualifier offers "Not started, or in
progress and still open" with `disqualifyOn: []`.
**Change:** disqualify it on the completed deliverable with a message routing to
ongoing construction. And under ruling 5, "Existing building, no recent work" is
quoted per job, so it is disqualified on BOTH fixed-price deliverables with a
message routing to the inquiry page.

**6. Nothing checks the catastrophe area.** Section 12: "A property outside the
designated catastrophe area. Declined." The only location check on either
windstorm deliverable is "Is the property in Texas?"
**Change, as first built and then withdrawn:** a county qualifier on both
windstorm deliverables. It was committed in `6c0efce` and taken out before the
branch merged, because it asked for the county a second time: every order
already carries the property's county, the bulk flow carries it as a column,
and a buyer could have answered one county in the qualifier and another in the
order. One fact with two homes. The board did not catch that; reading the
bulk-audit failure did.

**Change, to build:** the order refuses a windstorm deliverable when
`twiaStatus(county)` in `src/lib/ops-counties.ts`, which the intake screen and
the CRM already use, answers `not_designated` for the order's own county, and
asks the State Highway 146 question only when it answers `check`, which is
Harris. That is a change to the single property flow and to bulk ordering
rather than a qualifier, and it is its own commit and board.

**7. The inquiry form's pre-1988 verdict.** `src/lib/windstorm-inquiry.ts`, the
`all_pre_1988` reason: "Work before that line is treated differently and may be
eligible without inspection at all". WS-001 declines it with a referral to TWIA.
**Change:** the reason states the decline and the referral. The catalogue also
asks for no date at all although section 6 records "the dates construction began
and was completed": add a required date input on the completed deliverable.

**8. The firm does not issue the certificate.** Section 3: "TDI issues the
certificate. The firm does not issue it and does not promise that TDI will." The
completed deliverable's `receives` says "The windstorm certification the
engineer's review supports, sealed", and the service page's deliverables name
only the WPI-2 and the WPI-8.
**Change:** `receives` on both windstorm deliverables names what the firm
actually delivers: the sealed report (completed) or the WPI-2 submission
(ongoing), and says the certificate is TDI's to issue. The service page gains
the completed route's WPI-2E and sealed report beside the ongoing route's WPI-2.


**9. Required uploads not collected.** Appendix A Part 2, required: "Photo of the
front of the property" and "Contract or invoice for the work, showing the
products installed". The completed deliverable collects only an optional permit.
**Change:** both added as required inputs. Item 27 makes the front
photo a change to every line.

## MH-001, manufactured home foundation certification

**10. Below grade.** Section 3: the certification rests on "a visual,
non-invasive inspection" and is not a representation about concealed or
below-grade conditions. `src/content/services.ts:293` says the inspection
records "footing size and depth below grade".
**Change:** "footing size, and depth where it can be seen".

**11. Frost depth as a failure reason.** `services.ts:321` lists "piers that
were never founded below the frost or active zone depth" as a recurring reason a
certification fails. Under section 3 that is a below-grade condition the
inspection does not assess.
**Change:** removed from the list.

**12. The lender's written request.** Appendix A Part 2, required: "The lender's
written request for the certification". The catalogue never asks for it.
**Change:** added as a required file input.

**13. Multi section and return visit priced as modifiers with no figure.**
`prices.ts`, `whatChangesIt`: "A multi section home ... or a return visit after
the anchoring is corrected". The catalogue charges one price for both. The
return visit stands under the engineer's answer.
**Change:** REFERRED. A price for either is a money ruling the operator has not
made, so the sentence stays until he does, and this is the item that asks.

**MH, uncertain and resolved as a conflict.** Section 10: "The retrofit design is
a separate engagement." `services.ts:306` promises "a plain statement of what
would bring it into compliance". The protocol's repair list does state what is
required to close each item, so the sentence is true of the list and false only
if read as a design.
**Change:** "a repair list stating what each item needs, with any engineered
retrofit as a separate engagement".

## SL-001, solar structural letter

**15. Reinforcement detail promised.** Section 10: "The strengthening design is a
separate engagement." `services.ts` deliverable promises "Where reinforcement is
required, the detail that makes the installation work", and the FAQ says
"Sistered members, blocking, or a revised standoff layout resolve most
residential cases".
**Change:** the deliverable says a repairs required letter lists what must change
and that strengthening design is a separate engagement on the design line; the
FAQ keeps the revised array (which section 10 recalculates without a revisit)
and drops the promise to detail the strengthening.

**16 and 17. Sold as a desk review with "No site visit."** Section 6: "There is
no default. On every job the engineer decides at intake whether a technician
visits". Section 12: "The firm does not issue a solar letter from drawings
alone." The catalogue entry is `orderType: "desk"`, its help text says "A desk
review is a review of documents", the framing input is optional, and its
turnaround says "No site visit."
**Change:** the turnaround and help text say the engineer decides at intake
whether a technician visits or installer photographs suffice, and the framing
input becomes required. `orderType` is REFERRED: a field order retains the
disclosed inspection fee on a decline and this line has none, so moving it is a
money ruling.

**18. Turned away without the array design.** Section 6: "An order is accepted
without the array design." The catalogue disqualifies a buyer without the layout
("Come back when you do") and requires it as an input.
**Change:** the qualifier stops disqualifying and the layout input becomes
optional, with help text saying no calculation starts until it arrives.

**19. Installer photographs.** Section 9: "Installer site survey photographs are
accepted only on the engineer's decision at intake". The general FAQ in
`src/content/structural-engineer.ts` answers "No" to inspecting from the buyer's
own photographs. That answer is right for every other line (PL-001 and RS-001
say the same) and wrong only for solar.
**Change:** the FAQ answer adds that a solar letter is the one exception, where
the engineer may accept the installer's site survey photographs at intake.

## PL-001, structural letter for permit

**20. Sold as a desk review.** Section 6: "A site job is any job where the letter
concerns existing construction ... Photographs supplied by the customer do not
replace a technician visit." The catalogue is `orderType: "desk"`, says "The
engineer works from what is here" and "No site visit.", and
`prices.ts` says "A desktop review assumes usable drawings or photographs exist."
**Change:** the copy says the engineer records at acceptance whether the job is a
site job or a desk job, and that a letter about existing construction is a site
job. `orderType` and the price of a site job are REFERRED as money rulings, for
the same reason as item 16.

**21. A letter for any reader.** Section 2: the protocol does not cover "a
letter for any reader other than a permitting authority". Section 12: "No
written request from the permitting authority. Not accepted until one is
supplied." The catalogue help text says "A city, a lender, an insurer, a buyer",
and the qualifier accepts "No, I was just told to get a letter".
**Change:** help text names the permitting authority only; the qualifier
disqualifies "No, I was just told to get a letter" with a message saying the
written request comes first.

**22. Beam sizing and repair methods promised in the letter.** Section 12: "A
request that needs drawings, calculations for new work, or a repair method.
Routed to the design or repair specification line." DS-001 section 2 lists
"beams and headers for wall removals" as its own scope. `services.ts` says of the
letter "a beam has to be sized", "the letter states the beam, the bearing at
each end", "A sketch or detail where the words alone would leave a framer
guessing", and "specifies the remediation".
**Change:** the structural letter page describes a letter answering the
permitting authority's question about existing construction, and routes beam
sizing to design and remediation to repair specification.

## RS-001, repair specification

**23. Written without a visit.** Section 7: "A specification is not written
without a technician visit, except where an earlier job file of this firm
already holds the evidence". The catalogue says "No site visit." and
`services.ts:423` says "Where a specification is written from photographs alone,
it says so."
**Change:** the copy states the visit rule and its one exception; the
photographs-alone sentence is removed. `orderType` REFERRED, as item 16.

**24. A damage report required.** Appendix A: an existing report is "Required if
it exists". The catalogue requires one and disqualifies "No, nobody has looked
at it yet".
**Change:** the report input becomes optional and the qualifier stops
disqualifying.

**25. Verification and stages.** Section 10: the contractor photographs work
before it is covered, "The engineer may set a hold point on a single item", and
"Verification of completed repairs is not part of the specification. It is
ordered separately." `services.ts:408` promises "which stages have to be
observed" and `:427` says "an engineer or a technician ... carries it out".
**Change:** the copy says hold points are set item by item where the engineer
chooses, and that verification is a separate order. No catalogue entry exists
for verification; whether to add one is REFERRED, because it needs a price.

**RS, uncertain and resolved as a conflict.** Section 12 declines "An open
insurance claim on the damage, where the specification would function as claim
leverage". `services.ts:401` names "Adjusters and carriers" as buyers.
**Change:** the buyer line is narrowed to adjusters and carriers who need repair
scope established for a settled or non-adversarial claim.

## DS-001, structural design

**26. "No site visit." without qualification.** Appendix C, ACCEPT WITH
CONDITIONS: "A site visit is needed, the engineer writes the job list". The
beam and header and the carport catalogue entries say "No site visit."
**Change:** "The engineer decides at acceptance whether a technician visits; the
engineer does not attend."

## All seven

**27. The front of the property.** Every Appendix A requires "Photo of the front
of the property". No catalogue entry collects it.
**Change:** a required file input on every deliverable whose protocol requires
it.

**Turnaround, resolved as a conflict.** MH-001, SL-001 and PL-001 section 4:
staff relay a determination "without interpretation, addition, or estimate of
when a" certification or letter "will issue". `services.ts` gives "within a few
business days" for exactly those three lines, at `:260` (solar), `:309`
(manufactured home) and `:362` (structural letter).
**Change:** those three turnaround sentences say that review begins when the
record is complete and that no issue date is estimated. The same phrase on the
roof, foundation and windstorm lines is not governed by these three protocols and
is left.

## Questions for Aman

The list of items for the engineer of record that come out of the v1.1
protocols. Each is a question; nothing here is changed until he answers. The
retention questions are deliberately NOT here: by the ruling of 2026-09-22 they
stay in `docs/retention-questions-for-the-engineer.md` and are never put in
front of him beside a protocol.

**1. WPI-8-C: is TWIA's route current?** Added by operator ruling, 2026-10-07.
WP-001 section 12 says completed improvements obtain certification "through TWIA
(Form WPI-3 and Certificate WPI-8-C) or through TDI's post-construction
process". `src/content/windstorm-program.ts` says the WPI-8-C belongs to the TWIA
process that "changed on June 1, 2020". **The site's article stays as sourced**,
by the operator's ruling of the same day; the question goes to the engineer
because, if the article is right, the protocol names a route that no longer
exists, and only he can revise his document.

**2. Stages.** WP-001 section 8: "The engineer selects the stages for each job".
`services.ts:146`: "Field inspections at the stages the code requires". Both can
be true; whether the copy should say the engineer selects them is his call.

## Compared, no conflict found

The engineer's answers of 2026-10-06 against each protocol's own text, all
seven. PL-001's full refund on a decline against the catalogue's desk refund.
WS-001's date-of-work rule against the service page. The WPI-2E to WPI-8E route
in `windstorm-program.ts` against WS-001 section 1. MH-001's under-home
qualifier, HUD guide framing and return visit against the service page. RS-001's
deliverable content. DS-001's quote-per-engagement, no published turnaround and
proposal-first terms. DS-001 construction observation, which has no price or
catalogue entry anywhere, consistent with it being held. No protocol states a
price, so no price conflicts.
