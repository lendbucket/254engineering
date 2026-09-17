@AGENTS.md

# 254 Engineering Services: standing law

This file is binding on every session in this repo. It is the operative summary of
`TEXAS_ENGINEERING_DOMINANCE.md`, which is the full playbook and wins any conflict with the summary
below. Read the playbook before writing anything substantial.

Two rules sit above all others.

**Honesty is the ranking strategy, not a constraint on it.** A fabricated statistic, a fake review,
an invented service area, or a premature claim is a landmine under the authority the whole build
exists to create. The most trustworthy page on the internet for a query wins that query.

**Nothing ships unmeasured.** Every surface goes inside an audit harness, every harness is verified
by injecting a violation before it is trusted, and every completion claim is verified from disk and
from a running app. A check that passes while looking at the wrong thing is the recurring defect
class here. Hunt it.

**Two sentences to have in mind from the first command of a session**, because each has cost a run
more than once and each is invisible from its own symptom.

**When a patch has landed and behaviour has not changed, the module is bound.** A module level
constant is read once; a fresh import is not fresh enough, and a query string busts one specifier
rather than the graph beneath it. Do not go looking for a second cause. The full rule and the
worked examples are in section 6.

**A finding is a claim until something other than the scratchpad agrees.** A harness prints what
the harness does, which is evidence about the harness. Before a finding reaches a commit message or
a report, an audit, a screen, or the product's own guard read in the source has to confirm it. The
full rule is in section 6.

## 1. The regulatory gate (this outranks every other consideration)

The firm's TBPELS registration is pending, and no licensed PE is on staff yet. Until both are real:

- Nothing on this site may state or imply that engineering services are currently offered or
  performed. Service pages describe what the firm is built to deliver, in the future or the
  abstract, never in the present tense.
- No "we seal", "we provide engineering", "our engineers", "order a", "schedule an inspection", or
  any equivalent present-tense service claim. `scripts/voice-audit.mjs` flags these mechanically
  while the gate is active.
- No turnaround promise for sealed work. Turnaround statements stay qualitative.
- No invented PE names, license numbers, firm registration numbers, project counts, years of
  experience, or client examples. `scripts/placeholder-audit.mjs` fails the build on any credential
  string not present in `src/config/credentials.ts`.
- "Engineer", "engineering", and "sealed" are regulated terms in Texas. Treat every sentence
  containing them as load bearing.

**THE ENTITY WAS RENAMED ON 2026-09-16, AND NOTHING ON THE SITE MOVED.**
Operator ruling, 2026-09-15, and it is the cleanest statement of what this gate
is actually about.

The Secretary of State amendment is filed and stamped: **254 Engineering LLC**,
formerly 254 Services LLC, effective **2026-09-16**, file number **806765419**.
The amendment and the duplicate certificate form go to TBPELS on the 16th.

**THE GATE'S CONDITION IS THE BOARD'S RECORD, NOT THE STATE'S**, and those are
different facts. TBPELS still holds F-29811 in the name 254 Services LLC, so
every rendered sentence goes on naming 254 Services LLC until the board reissues.
Nothing about the copy changes, and nothing about the gate opens.

`operatingNameOnBoardRecord` **flipped back to false**, because its recorded
reason was "the firm trades under its registered name" and the rename makes that
sentence false. Leaving it true would have been a flag whose own stated reason
contradicts the world, which is the failure this gate exists to prevent rather
than an exception to it. It reopens the 2026-09-10 state and closes on
reissuance. It is set at FILING rather than by a date comparison, because a
compliance state that flips with no deploy and no audit trail is refused
outright here; the cost is one day of reading false, erring toward shut.

**THREE NAMES ARE NOW IN PLAY AND EACH IS A DIFFERENT FACT.** The board holds
254 Services LLC. The state holds 254 Engineering LLC. 254 Engineering Services
is the brand on the wordmark, the logo and the page titles, and is never the
legal or firm name in a sentence. `compliance-audit` asserts the record names
all three.

**A KNOWN, ACCEPTED WINDOW, WRITTEN DOWN RATHER THAN DISCOVERED.** From
2026-09-16 the site names an entity the STATE no longer holds, while the BOARD's
record agrees with every sentence. That is the correct trade, because holding
the copy still is what stops the sites claiming a name TBPELS has never
registered, which is the exact misstatement the gate exists to prevent. It
closes on reissuance. `business.legalName` is deliberately left at the old name
for the same reason: stale against the state, true against the board, on purpose.

**AND THE NAME IS NOW DERIVED, WHICH MAKES REISSUANCE ONE VALUE.** `firmName()`
in `src/lib/launch.ts` reads `issuedTo` off the register, and twenty rendered
sentences that used to type the name now call it. It is the FOURTH deriver of
this exact shape, after `registrationLine()`, `e164Phone()` and
`registrationStatement()`, each of which exists because one fact had two
accounts and the copy was the one nobody updated. The audits that pinned those
twenty literals caught an accidental change and did nothing for a deliberate
one, which is why the last rename cost twenty seven edits.

Two checks, because they ask different questions. `compliance-audit` scans all
386 source files and fails if anything outside the two config files types the
name, with the exempt set asserted so it cannot quietly grow.
`scripts/proofs/the-firm-name-is-one-value.mjs` patches the register on disk,
reads the world **in a child process** because a module level constant is read
once, and asserts the render actually moves. Injection-verified both ways.

**THE HAZARD OF DOING THE RENAME, AND IT HAS BITTEN ONCE.**
`scripts/lib/regulatory.mjs` carries the firm name in the patterns `voice-audit`
matches on. A rename that does not teach it the new name does not fail the
audit: it makes the audit stop matching, so it passes while looking at nothing,
on the one commit where the copy is most in flux. It learned 254 Engineering LLC
in the same commit as the deriver, before any sentence uses it.

**THE FIRM REGISTRATION ISSUED ON 2026-09-10, AND THE GATE DID NOT OPEN.**

TBPELS issued **F-29811** to **254 Services LLC**, active, expiring
**2027-07-31**. It is recorded in `src/config/credentials.ts`, which is the one
place it lives.

**The gate stays shut, and the reason is the name.** The registration is in the
name 254 Services LLC. All three sites hold out as 254 Engineering Services. A
registration in one name does not authorise holding out under another, and Texas
regulates the use of "engineer" and "engineering" in how a firm names itself and
presents itself. Printing the board's number beside a name the board has no
record of would be the exact misstatement this gate exists to prevent, made in
the one place a reader goes to check.

So the gate is no longer one variable. **`LAUNCH_MODE` is the operator's SWITCH
and one of the conditions rather than all of them.** `launchBlockers()` in
`src/lib/launch.ts` returns a sentence per unmet condition, and `launchMode()`
answers "live" only when the list is empty. Today, with `LAUNCH_MODE=live`, the
mode is still prelaunch and `tbpelsFirmNumber()` is still null.

The conditions, all read from CONFIGURATION so the flip is impossible until each
is stated true in a file somebody edits on purpose:

| Condition | Where it is stated |
| --- | --- |
| The operator has thrown the switch | `LAUNCH_MODE=live` |
| An active, unexpired registration is on record | `verifiedFirmRegistrations` |
| **The board holds the operating name** | `operatingNameOnBoardRecord` |
| A live Stripe account belonging to 254, proven by a charge and its refund | `stripeAccount` |
| One protocol per offered service line, approved by the engineer of record | `approvedProtocols` |
| `FIRM_PHONE` is a real number, not a placeholder | `FIRM_PHONE` |
| Point in time recovery on the production project | `pointInTimeRecovery` |

**Four more were added on 2026-09-11**, and the last three of those live in
`src/config/launch-readiness.ts`. Each condition carries the sentence a reader
gets when it is unmet, who clears it, and where it is stated true, and
`compliance-audit` asserts the gate carries EXACTLY these seven against a pinned
list of ids, so removing one costs two edits made on purpose.

**`docs/launch-readiness.md` is the written form and `/portal/launch` is the
operator's live view.** The screen renders `launchReadiness()` and computes
nothing itself, because a screen with its own copy of the logic is a second gate.

**Two consequences worth knowing before they bite.** First, the public footer now
reads `254 Services LLC, TBPELS Firm F-29811` while the gate is SHUT, with the
brand on its own line above: the hazard was never printing the number, it was
printing it beside a name the board has no record of. `tbpelsFirmNumber()` still
returns null in prelaunch, because it feeds claims of capability rather than a
disclosure of who the registrant is. Second, `orderBlockedReason` in
`data/catalog.ts` now takes `hasApprovedProtocol` as a REQUIRED third parameter,
so a service line with no approved protocol is a waitlist rather than an order,
and the two sibling repositories fail to compile until somebody decides.

The third is a two field object rather than a boolean on purpose. A boolean can
be flipped by anybody in a hurry; this one cannot be flipped without writing
down what the board now holds, and `compliance-audit` reads what is written. It
becomes true when the entity is renamed or an assumed name is filed and recorded
with the board, and the sentence beside it says which.

**Before the gate may open, the number must appear in three places**, and
`compliance-audit` asserts each: the public footer of all three sites, every
email footer, and the sealed document upload record. The third is a ROW rather
than a render, which is why it needed migration 0041. A footer answers "under
whose registration does this firm operate NOW"; only the row answers it for a
document as it was THEN, which is what somebody asks about a sealed deliverable
years later, and this registration expires in 2027.

**The name printed beside the number is the name on the REGISTRATION**, read off
the record, never the name the site trades under. That was a live defect:
`registrationLine()` printed a module constant, so the moment the gate opened it
would have put F-29811 next to "254 Engineering Services LLC".

`compliance-audit` and `launch-audit` answer different questions and both run.
launch-audit asks whether the copy is right for a given mode. compliance-audit
asks whether the mode may change at all.

**A SEALED DOCUMENT IS UPLOADED, NEVER GENERATED. Operator ruling, 2026-09-06,
and it is standing law rather than a phase decision.**

A seal carries a named Professional Engineer's own seal and signature. A platform
that RENDERS one is a platform where any account holding the right permission can
produce a sealed engineering document, and the seal has then left the engineer's
control. No permission model fixes that, because the capability itself is the
problem.

So: the engineer produces a sealed deliverable in whatever they seal with, and
this platform stores it, records who sealed it and when, and shows it. What it
never does is compose one. There is no seal image in this repository, no
signature block, and no letter generator, and none of the three is a gap waiting
to be filled.

Two decisions already point at this and neither is allowed to restate it. The
sealed letter screen was not built during the portal design port for exactly this
reason, and the evidence hash column was dropped from the responsible charge log
for its neighbour: rendering a value the platform did not compute is a fabricated
assurance on the firm's regulatory record. Both are in `BACKLOG.md` and both
defer to this paragraph.

The whole gate is one function, `isPrelaunch()` in `src/lib/launch.ts`, and one environment
variable, `LAUNCH_MODE`. `scripts/launch-audit.mjs` runs the site in both modes and asserts what each
must say, what each must not say, and the claims neither may ever make. Flipping the mode requires a
rebuild, because the pages are statically prerendered. That is deliberate: a compliance state that
could change without a deploy leaving an audit trail is not one this firm should want.

## 2. Brand differentiation (the ownership model is superseded)

Three sites, one operator. To a search engine that is a doorway network unless each brand has a
genuinely distinct identity, audience, and corpus. What changed on 2026-08-30 is the mechanism for
producing that distinctness, not the requirement.

**What was ruled before.** `data/keyword-registry.ts` was an ownership map. Every keyword had exactly
one owning brand, and a brand writing about a term assigned elsewhere was a violation that
`registry-audit` failed the build on. The table read:

| Brand | Owned |
| --- | --- |
| **254 Engineering Services** (this repo) | Institutional and firm level terms, all county level geo, government and municipal content, careers |
| **Sealed Engineering** | Transactional commercial service terms, city geo, homeowner education |
| **StampMyPlans** | Contractor and builder direct response, plan stamping process and speed |

**What is ruled now.** These are three separate businesses. Each offers the full service menu, each
serves a different buyer, and each earns in-depth content on every service it performs. Dividing the
keywords starved two of the three sites of content on work they actually do, which is a worse
outcome than the overlap it was avoiding. The registry is now a **differentiation record**: for each
topic it holds the angle each brand takes, so a writer opens it to find out how this brand's
treatment differs, not whether this brand is permitted to write at all.

The supersession is recorded rather than the old model being quietly deleted, for the same reason
the Newsreader ruling in 2b is still written down. A prohibition that vanishes without a trace looks
like a rule nobody ever set, and the next session reads the ownership reasoning in the git history
and assumes the current registry is a mistake.

**The one prohibition that survives, and it is absolute.** No page may share substantial copy,
structure, headings, or paraphrase with a sibling page on the same subject. Each is written
independently from primary sources for its own buyer. **The test: any page that could be
find-and-replaced into a sibling page fails and is rewritten.** Overlap in subject is the strategy.
Overlap in sentences is the doorway.

`data/keyword-registry.ts` remains synchronized verbatim across all three repos, and is still the
first thing to read before writing any page or post.

Consequences that are easy to get wrong:

- Service pages on this site are **firm capability pages** for procurement and institutional
  evaluation. A sibling brand's page on the same service is a different document for a different
  reader, written from scratch, not this one reworded.
- Geo on this brand is regional. The shipped geo pages are the eight coverage regions under
  /coverage, each carrying the counties inside it, and the coverage hub carries all 254. There are
  no city geo pages and no service-times-place combo pages, which is the doorway trap.
- One exception, and it is an exception about the entity rather than about geo. /corpus-christi is
  the firm's own location page: where the firm actually is, which is what a Google Business Profile,
  a LocalBusiness node, and a procurement officer checking principal place of business all ask.
  There is exactly one and there will only ever be one, because the firm has one address. A second
  one written for a city the firm merely covers would be the doorway pattern this rule exists to
  prevent. The full reasoning is at the top of src/content/location.ts.
- Templates and engineering patterns may be shared between the three repos. Rendered sentences may
  not. Every page is written fresh in this brand's voice.
- Cross-brand linking is sparing and honest, never reciprocal footer blasting.

`scripts/registry-audit.mjs` changed with the ruling. It no longer flags topic overlap. It fetches
all three live sitemaps and scores similarity across titles, H1s, descriptions, and heading
structures, reporting the score for every close pair and failing above 0.75. Privacy, terms, and
contact are compared and shown but never failed, because three privacy policies owned by one
operator share an H1 for reasons that have nothing to do with search.

## 2b. The visual system, and one superseded ruling

The operator designed the interface externally and approved it. The artifact is
`design-reference/254 Landing Page v5.dc.html` and it is the single source of
visual truth. `DESIGN_SPEC.md` is the extraction: palette, type scale, spacing,
component inventory, and every deviation forced by accessibility.

**Archivo and Open Sans, and the Newsreader ruling is superseded.** During the
design elevation workstream the operator was shown two display directions, a
serif and a grotesque, and ruled for Newsreader. That ruling stood and shipped.
The approved v5 artifact specifies Archivo for display and Open Sans for text,
and an approved artifact from the operator outranks an earlier ruling by the same
operator.

Both facts are recorded rather than the first being quietly replaced, because a
superseded decision that leaves no trace looks like a decision nobody made, and
the next session would otherwise read the Newsreader reasoning in the git history
and assume the current fonts were an accident.

**Gold is an accent and never body text on a light surface.** That rule predates
v5 and survives it. Seven pairings in the approved design measure under 4.5:1,
including gold on white at 2.33:1. Each has a compliant nearest treatment
recorded in `DESIGN_SPEC.md` section 2, and AA wins wherever the two disagree.
That is the operator's standing ruling, reaffirmed when the deviations were
approved.

## 2c. Importing a design: read it against the code before you style anything

**A design is drawn against a DESCRIPTION of the platform, and every claim it
makes about money, contact or capability is wrong until it has been read
against the code.** Operator ruling, 2026-09-08, after the email suite port.
That sentence is standing law for every future design import, and the
reconciliation comes before any styling.

The email port is the worked example. Thirteen templates arrived, beautifully
drawn and internally consistent, and the reconciliation pass found four things
that no amount of looking at them would have shown:

**The link that was never sent.** The customer order status page had existed
since Phase 7 and said of itself that the link is signed and emailed. Nothing
emailed it. `releaseForFulfilment` minted the token, wrote
`customer_link.issued` into the order's own timeline, and dropped it. A paying
customer heard nothing until they rang to ask, which is the support cost that
page was built to prevent.

**The refund rule stated as a constant.** The design wrote "everything except
the disclosed $175 inspection fee is refunded". A decline where nobody
attended is a FULL refund; the retained figure is the fee disclosed for that
service, which seven of the eleven do not have; and $175 is four of eleven
rather than a rule. The portal design made the same claim and was corrected
the same way, which is the point: it is not a mistake somebody made once.

**The door that took money without stating terms.** Reconciling the design's
refund copy against the code found that a job taken over the telephone reached
payment with no `refund_disclosure` and no `inspection_fee_cents`, while the
web door refused exactly that. Nothing in the design pointed at it; reading
the design against the code did.

**The timeline entry that claimed contact.** `customer_link.issued` read like
evidence that a customer had been written to and was evidence of a database
write. That is the recurring defect class sitting inside the audit trail.

Three of those four are about money or about whether somebody was told
something, which is why the rule is worded the way it is. A design cannot be
wrong about a colour in a way that costs a refund.

**AND THE RULE IS NOT ONLY ABOUT DESIGNS. A DECLARATION IS ONLY AS TRUE AS THE
LAST TIME SOMEBODY READ IT AGAINST THE CODE.** Operator ruling, 2026-09-13,
recorded as the instance that proves this section, because the thing that was
wrong was not a design drawn by somebody else. It was this repository's own
declared inventory, and it had been wrong since the moment it was written.

`src/lib/account-doors.ts` declared three doors an account can come through. Its
third entry read:

    what: "The door that already existed. Paying for an order creates the
           account that owns it."
    route: "/api/orders/place"

**Every clause was false.** There is no such route. Checkout creates a CLIENT.
An operator later converts the client to an ACCOUNT. And nothing anywhere in
this platform had ever created a customer USER at all, so no account holder
existed to sign in: `createCustomerAccount` had no caller, and the audit probe
built the whole chain by hand because the product had no path that did it.

**Nobody had read it against the code, including the session that wrote it.** It
was written in the same phase, reviewed, committed, and carried past several
boards, and its falseness was invisible from every direction: the file
typechecked, the registry was imported and used, and the origins it declared
were all origins the database allowed.

**The general form, which is the one to carry forward.** Section 2c says a
DESIGN is unverified until it is read against the code. This is the same
sentence with the subject widened: **a declaration is unverified until somebody
reads it against the code, and the declarations this repository writes about
itself are not exempt.** The declared inventory idiom exists because a list
nothing reads stops being true without telling anybody. A list that was never
true is the same failure with no decay required.

**What made it findable was a check rather than a reading, and that is the fix
worth copying.** `accounts-audit` now asserts that every declared door names a
route that exists on disk, and it went red naming this one the first time it
ran. The question to ask of any declaration in this repository is: what would
have to be true on disk for this to be honest, and does anything assert it.

**THE EXCEPTION, AND IT MATTERS: THE RULE IS NOT "THE DESIGN IS ALWAYS
WRONG".** Recorded 2026-09-08, from the reporting port. The prototype's
reports module got absent versus zero RIGHT, and this platform's own file
screen got it wrong.

Its margin card is annotated "2 of 3 closed files; gaps excluded", which is
the coverage disclosure `periodTotals` already implements. Meanwhile
`/portal/files` was computing `price - (tech ?? 0) - (engineer ?? 0)`, showing
a margin inflated by every cost nobody had entered yet and omitting the
partner commission entirely.

So the reconciliation runs in BOTH directions. A design can be right about a
rule the code has drifted from, and a designer who has thought about absent
data deserves to have that noticed rather than overruled by a session assuming
designs are wrong about money. What the rule says is that a claim is
UNVERIFIED until it is read against the code. It does not say the claim is
false, and reading it as though it did produces the opposite failure: shipping
the platform's mistake over the design's correction.

The order is therefore fixed. **Inventory and reconcile first**: list what the
platform actually does, give every drawn artifact a verdict against it, and
get a ruling on the ones that describe something the firm does not do or
should not send. Only then style anything. The verdicts and the rulings are
recorded, and the artifacts that were refused stay in `design-reference/` with
their verdict beside them so nobody rebuilds them by accident.

## 3. Style laws on every rendered string

- **No em dashes and no en dashes.** Anywhere: copy, metadata, schema, alt text, rendered comments.
- **No hyphens as sentence connectors.** Compound modifiers are fine; a hyphen standing in for a
  comma or a colon is not.
- **No emojis.**
- **No AI cliche phrasing.** The banned list lives in `scripts/lib/voice-blocklist.mjs` and is shared
  between site copy and email templates so the two surfaces cannot disagree. Structural tells count
  too: uniform paragraph rhythm, stacked rhetorical triads, question headings above roughly 40
  percent of headings, bolded listicle lead-ins where prose would carry.
- **Nothing fabricated.** If a commonly repeated number cannot be traced to a primary source, say it
  is unverifiable rather than repeating it.

Voice: direct, declarative, specific. An expert explaining plainly. Not direct response.

**AND NONE OF IT APPLIES TO A SIGNED DOCUMENT. TRANSCRIPTION IS VERBATIM.**
Operator ruling, 2026-09-16.

These are laws on strings THIS FIRM WRITES. A signed engineering document is not
copy; it is the authority a protocol implements and an engineer put his seal
behind. **Altering it to match a writing preference is an alteration of the
authority**, and the fact that the alteration is small is what makes it
dangerous: nobody reviewing the diff would call a comma a change of meaning.

**The instance, and it happened within an hour of the document arriving.**
254-RC-001 v1.0 uses ASCII double hyphens throughout, as in
`Shingle roofs -- SEAL-BOND`. Transcribing Appendix B and Appendix C into
`src/content/protocols/`, the dash rule fired reflexively and 21 checklist
labels and 9 determination criteria came out with commas in place of the
document's own punctuation.

**It bought nothing.** `placeholder-audit` flags the four long dash characters
(figure, en, em and horizontal bar) and nothing else; its pattern is
`LONG_DASH` in that file, written out there rather than quoted here so this
sentence does not carry the very characters it describes. A
double hyphen was never in scope, so the house style did not even require the
change that was made in its name. `protocol-registry-audit` caught all thirty by
comparing the transcription against the PDF itself, which is the argument for
building that check BEFORE the screens rather than after.

**The rule.** Where a document somebody signed is transcribed into this
repository, its text is carried exactly, punctuation included, and the check
that proves it compares against the document rather than against a second copy
of the transcription. If the house style and the document disagree, the document
wins and the disagreement is recorded. The foundation protocol and every
protocol after it arrives under this rule.

**The one thing that may be repaired is an EXTRACTION artifact**, which is not
the document. `pdftotext` breaks a line inside a hyphenated word and leaves a
space behind, so `close-up` comes back as `close- up`. That is a defect in
poppler, and the comparison ignores whitespace entirely rather than the
transcription carrying the artifact forward. Every character is still compared,
in order.

## 4. Technical SEO baseline (mandatory, audited)

- Titles 50 to 60 characters including the brand suffix, keyword front loaded, brand-pipe suffix.
- Descriptions 140 to 160 characters with a call to action.
- Zero duplicate titles or descriptions sitewide.
- Schema: Organization and WebSite with the name set so the SERP shows the brand, ProfessionalService
  as the honest type, BreadcrumbList sitewide, FAQPage only where the questions are real, JobPosting
  only for genuinely open roles with real `validThrough`. **No review or rating markup until real
  third-party reviews exist.**
- Canonicals on the apex. `og:site_name` and `og:url` aligned with the serving host, verified against
  the live domain after deploy, never against the build.
- Sitemap `lastModified` only where a true per-page date exists. Never a build timestamp, never a
  constant.
- robots permits AI crawlers. `llms.txt` and `llms-full.txt` published.

## 5. The geo doorway line

Every geo page must contain substantial information that is true of that place specifically and
useful to a person there, **which could not be produced by find and replacing the place name.**

- `data/counties.ts` is the source. A county page does not ship until its record has verified
  substance; the build excludes counties below the substance threshold and the sitemap carries only
  shipped pages.
- Two honest templates. The 14 TWIA designated coastal counties get windstorm sections. Inland
  counties do not fake them.
- Facts come from primary sources during writing, with the source recorded in a comment in the data
  file, or they are stated generally without invented specifics.
- No service-times-county combo pages minted mechanically. That is the doorway trap.

## 6. The audit harness

Run the suite before any report of completion.

```
npm run audit
```

**The suite starts its own server.** It clears the audit ports, builds once,
starts the app, waits until both `/` and `/portal/login` answer 200, runs, and
tears it down. There is no second terminal and no build flag.

That changed on 2026-09-02 after three runs in one session were invalidated the
same way: a build at the end of an earlier step killed the server on 3225, and
the suite then measured nothing while reporting eleven audits as failed. The
preflights were never wrong, they said exactly what had happened; the defect was
that a run could get that far at all. A suite that can be pointed at nothing,
and report content failures about it, is a suite whose red means two things.

The runner re-checks the server between phase zero and phase one, refuses to
start if the build fails, and prints `THE SUITE DID NOT RUN TO COMPLETION`
rather than a list of failures when it could not measure anything.

**REACHING THE DEPLOYMENT NEEDS A BROWSER, NOT curl, AND THERE IS NO BYPASS
HEADER.** Recorded 2026-09-08 after an operator and a session both assumed
otherwise. `254engineering.com` sits behind Vercel's bot checkpoint, which
answers curl with **403 and a JavaScript challenge page**, not with the route
you asked for. Chromium executes the challenge and gets 200, which is why the
browser audits reach production and a shell one liner does not.

There is **no protection bypass secret** in this repository, in `.env.local`, or
sent by any script. Do not go looking for one and do not add one to make curl
work: the harness already has the mechanism, and it is Playwright.

The trap underneath it, found while verifying an emailed link: the order status
page answers **200 while saying the link does not open an order**, and the
reference appears in the page text even on that failure page. So a check that
asks for a 200, or asks whether the page names the order, passes on a dead
link. Read the page for the failure sentence first.

**`BASE_URL` means "use this server, do not manage one".** That is how a run
against production works, and with it set the suite refuses outright if the host
is not answering:

```
BASE_URL=https://254engineering.com npx tsx scripts/security-audit.mjs
```

| Audit | Enforces |
| --- | --- |
| `seo-audit` | Titles, descriptions, duplicates, canonical, og, schema per template, Lighthouse SEO 100 |
| `placeholder-audit` | Scaffolding, dashes, emoji, phone numbers, off-domain email, unverified credential strings |
| `voice-audit` | Banned phrases, structural tells, present-tense service claims under the gate |
| `cta-audit` | A primary conversion path on every route |
| `email-audit` | Every outbound template: voice, absolute links, plaintext part, 375px |
| `contrast-audit` | WCAG 2.1 A and AA at 390 and 1280, including form error states |
| `mobile-audit` | Zero horizontal scroll, WCAG 2.5.8 tap targets, the mobile menu |
| `forms-audit` | Every input and state, no silent failures, no false success |
| `coverage-audit` | All 254 counties exactly once, against an independent canonical list |
| `launch-audit` | The compliance gate in both modes |
| `link-map` | Contextual versus template inbound links per page, on demand |

**Every audit is verified by injecting a violation and watching it fail before its green is
trusted.** An audit that has never failed has never been tested.

**AND THE BOARD IS RUN UNDER ITS OWN INVOCATION BEFORE ANY COMMIT IS REPORTED AS
GREEN.** The rule already existed. It is recorded again here with what breaking
it cost, on 2026-09-09, because the cost is the argument.

Three files were patched in one pass and one of them was re-run. The other two
carried a variable moved out of scope and a check nobody had exercised, and both
went to the board: `dashboards-audit` crashed outright with
`ReferenceError: made is not defined`, and underneath that crash was a fixture
inserting a production ledger row on EVERY run into a table 0032 had just made
undeletable. Six identical rows accumulated before anything said so.

Running the three audits by hand would have caught both in under two minutes.
The board caught them in twenty, after a commit had already been described as
done. **A green audit is a green audit of the file it read. The board is what
knows whether the rest of the repository still agrees with it.**

The same pass also produced the other half of this rule: `tsc` was clean and the
BUILD failed, because a client component imported a module carrying
`server-only` and that constraint belongs to the bundler rather than to the type
system. The suite printed `THE SUITE DID NOT RUN TO COMPLETION`. **The board
builds before it audits, and that ordering is the first step, not a convenience.**

**`AUDIT_KILL_STALE=1` IS FOR A BUILD, NEVER FOR A SUITE RUN.** Recorded
2026-09-10, because it cost thirteen audits a run.

A build had refused over a stale server left on a port by the perf gate, and the
guard's own message says to re-run with that flag. It was then carried onto the
next `npm run audit`. With `BASE_URL` unset, `preflight-harness` reads the flag
and has the build guard KILL whatever is holding `.next`, which partway through
a suite run is the suite's own server. It died before `roles-audit` and thirteen
audits never ran.

The suite printed `THE SUITE DID NOT RUN TO COMPLETION` and named the cause
precisely: the server log "ends cleanly when something killed the process, and
carries the error when it fell over by itself". It ended cleanly. Clear the
stale server first, or let the guard tell you which process holds it, and run
the board with no flag at all.

**NOTHING ELSE RUNS WHILE THE BOARD RUNS, AND THE BOARD IS INVOKED ON ITS OWN.**
Operator ruling, 2026-09-12. This is the third and fourth instance of the same
rule, and it now has enough behind it to be stated as a rule rather than as a
lesson from one incident.

The rule already said the board builds before it audits and refuses to score a
stale artifact. What it did not say is that the board is the ONLY thing touching
the repository while it runs, and that it gets its own invocation with nothing
chained to it.

**Instance three: a command run beside the board killed it.** During Phase 12
Section 6 the evidence generator and its audit were run in another shell while
`npm run audit` was in flight. The suite stopped before `mfa-audit` and printed
`THE SUITE DID NOT RUN TO COMPLETION`, naming exactly what happened: the server
stopped answering, so everything from there would have measured nothing. The
harness behaved perfectly. Thirty audits did not run.

**Instance four: chaining a commit into the board invocation made the build
guard kill its own caller.** The command was
`git commit ... && npm run audit`, and the guard, which looks for processes
holding `.next` or an audit port, matched the invoking shell itself, killed one
process, failed to kill a second, and the build then failed with nothing to
audit.

So: **`npm run audit`, alone, as its own command, with nothing else running
against the repository.** Not chained after a commit, not beside a generator,
not while anything is writing files. A board run takes twenty minutes and the
temptation to do something useful in the meantime is exactly what produces a
result that means nothing.

The pair with 2026-09-02's lesson is the whole argument: a suite that can be
pointed at nothing, or killed by its own operator, is a suite whose red means
two things.

**INSTANCE FIVE, AND IT IS THE LAST ONE THIS RULE GETS AS PROSE. THE FIFTH IS
WHY THE SIXTH IS MECHANICALLY IMPOSSIBLE.** Operator ruling, 2026-09-15.

The command was

    npx tsx scripts/db-guard-audit.mjs | tail -1 && git add ... && git commit

and `tail` discarded the audit's exit code, so the `&&` saw a success that had
not happened. Commit `8b6d396` landed with `db-guard-audit` red. It was
corrected in `75bcd6b`. Four lines in this file already said not to do it.

**A fifth instance of a written rule is not a reason to write it a sixth time.**
The operator's ruling was to build something mechanical, and it is committed:

| Layer | What it is | What it refuses |
| --- | --- | --- |
| **One, built** | A Claude Code `PreToolUse` hook on Bash, `.claude/settings.json` calling `scripts/hooks/commit-guard.mjs` | A command containing `git commit` that also runs anything under `scripts/`, any `npm run`, or any `tsx`. A command containing `npm run audit` and anything else at all, apart from redirecting its own output to a file. |
| **Two, not built** | A git `pre-commit` hook under `.githooks/`, switched on by `core.hooksPath` | A commit while an audit lock holds a live PID, and a commit when the last recorded run of any audit against this exact tree exited non-zero. |

**WHY LAYER ONE IS THE ANSWER AND LAYER TWO ALONE WOULD NOT HAVE CAUGHT THIS
ONE.** A git hook can only refuse on something that was RECORDED. Layer two
would read an audit's last recorded exit, and **an audit invoked directly with
`npx tsx scripts/x-audit.mjs` runs no npm pre hook and records nothing.**
Instance five was exactly that invocation. Layer two would have found no record,
found no failure, and allowed the commit. Layer one never looks at a record: it
reads the command itself and refuses before a single process starts.

Rule one is tested against the command with quoted strings and heredoc bodies
removed, so a commit MESSAGE naming a script is not a refusal. That is the only
softening, and it is what makes the rule about the shape rather than about
wording. Everything else is a substring rule on purpose, including the `cd` in
front of a board run: the Bash working directory persists between commands, so
`cd` is its own command. The guard fails closed, testing the raw command when
quoting cannot be resolved.

Proven in both directions rather than assumed, by
`scripts/proofs/the-commit-guard-refuses-the-shape.mjs`, which feeds sixteen
real payloads to the hook's own entry point and exits non-zero on any wrong
answer. Six refused, ten allowed. Then live, in the session that wrote it: a
real Bash call combining a commit with `npm run` came back refused, and
`git status` came back normally.

**AND THE COMMIT THAT BUILT IT BROKE A WRITTEN RULE.** `95be4d7` carried both
the instance five record and the "count from one search" record in one CLAUDE.md
change, while its message describes only the first. That is one commit doing two
things, against the commit-per-change rule four lines further down this file.

It is funnier than it is serious, and it is the entire argument in one line: the
commit that built the mechanical guard against breaking written rules broke a
written rule, written down, in the file it was editing, by the session that had
just finished reading it. **A rule you are actively thinking about is still a
rule you can break. That is what mechanical beats written means.**

**AND ITS FIRST REAL USE FOUND A DEFECT IN IT, WHICH IS THE ARGUMENT FOR THE
WHOLE PRACTICE.** The first version blanked quoted strings rather than replacing
them, so `npm run audit > "<a path with a space>" 2>&1` became a redirection
with no target and the board-alone shape stopped matching its own output file.
**The guard refused the very board run written to close the session.** Ten
hand-picked shapes had passed; the first command anybody actually typed did not.
The fix is a placeholder word instead of a blank, so the SHAPE of the command
survives, and that case is now one of the sixteen. The general form is the one
this file already makes about fixtures: a check is only as good as the inputs it
was given, and the input worth having is the real one.

**WHEN A PATCH HAS LANDED AND BEHAVIOUR HAS NOT CHANGED, THE MODULE IS BOUND.**
Operator ruling, 2026-09-14, moved here from `scripts/lib/gate-fixture.mjs`
because a lesson recorded in one file is a lesson nobody finds.

That file has carried the explanation since September, in these words: **a fresh
`import()` is not fresh enough.** A query string busts ONE specifier, and every
module beneath it keeps the values it was loaded with. A module level constant
is read once.

**It cost three separate runs in one night**, after being written down once:

- `trade-pricing-audit` patched a floor into `src/config/trade-floors.ts`, re-imported `trade-pricing.ts` with a cache busting query, and read the floor as still pending. Nine checks failed reporting the code refusing correctly.
- the Section 2 walk patched the same file and read the same stale value.
- the walk then patched the launch conditions to open the gate, and `previewBatch` went on refusing, because `isPrelaunch()` reads constants bound at first import.

Each time the symptom was identical and each time it looked like the code
working: **a refusal that is correct for the unpatched state is indistinguishable
from a refusal that is correct.** That is why it is worth a rule rather than a
comment.

**THE DIAGNOSTIC, AND IT IS THE THING TO READ FIRST.** A patch has been written
to disk, the file on disk is right, and behaviour has not moved. Do not look for
a second cause. **The module is bound.** Re-importing will not unbind it, and
nor will any flag.

**The answer is a child process**, which has no module graph to invalidate: it
starts, reads the file as it is at that moment, answers on one prefixed line,
and exits. `inOpenGateProcess` in the gate fixture is the worked example, and
`trade-pricing-audit` carries its own for the same reason.

**The general form.** Anything read once at module load is a value a patch
cannot reach: the launch conditions, the credentials register, the trade floors,
the door registry, the surface inventory. Anything read at CALL time can be
patched in process, which is why the environment variable fixtures work and the
file ones do not.

**THE BOARD IS THE LAST WORD, INCLUDING OVER YOUR OWN VERIFICATION.** Operator
ruling, 2026-09-10, from a run that fixed three real defects and introduced two
regressions doing it.

The queue screen fix was verified by measuring the rendered page height before
and after, which is exactly the kind of reading this file asks for, and the note
it added was `var(--muted)` at **3.1:1** on 12px text. `contrast-audit` caught it
on nine instances, on the very screen the fix had been written to make readable.
Fixing THAT put a JSX comment inside a ternary branch, which is two expressions
where one is allowed; `tsc` was clean and the build failed.

Neither was visible from the change, both passed the verification their author
chose, and the board caught both. Verification you design tests what you
already thought of. **The board is what tests what you did not.**

**A CHECK THAT MATCHES THE OLD SHAPE BY TEXT IS A CHECK ON WORDING.** Operator
ruling, 2026-09-09, recorded as another instance of the fixture lesson below.

Two audits went red during Phase 12 Section 3 when reads were paged, and both
were right to. `jobs-audit` asserted `if (error) return null` as a literal, and
`order-audit` asserted a statement header was recomputed by matching
`const headerTotal = (allLines ?? []).reduce`. Neither behaviour changed; the
spelling did.

**The correct response is never to loosen the pattern so it passes on both.**
That converts a check into a check on nothing. Each was made to name the new
shape exactly, and each GAINED a second check for the property the first could
not see: that the queue read pages, and that the header is computed from ALL of
its lines. `order-audit`'s was the valuable one, because it revealed that the
original check could not see how many lines were read at all, so a statement
over a thousand lines would have had its header computed from part of itself
and written back, which is the exact disagreement the recompute exists to
prevent.

A red board when an implementation is deliberately changed is the harness
asking whether you meant it. Answer it by making the check sharper, and by
asking what the old one could not see.

**A FIXTURE ONLY CATCHES WHAT IT CAN REACH. EVERY INJECTION FIXTURE CARRIES A
VALUE IN EVERY COLUMN A FIGURE CAN SUM.** Operator ruling, 2026-09-09, and it
sits beside the declared inventory idiom because it is the same failure one
level in: the inventory decides WHICH surfaces are swept, and the fixture
decides which FIGURES on them can move.

Both were wrong in the same afternoon. The demo sweep was widened from the four
reports to all eleven figure surfaces, which was necessary and was not
sufficient: the demonstration file it inserted carried no price, so it could not
move a margin however wrong the filter was. The administrator's dashboard went
on reporting $175.00 of margin and $450.00 of revenue from three seeded files,
past a check that had just been widened to look straight at it. It was found by
reading a screenshot.

So a fixture is priced, dated and complete: every column any figure could sum,
count or age. The test of a fixture is not whether it inserts a row, it is
whether removing the filter makes a number move.

**A RULE TESTED WITH ITS INPUT HANDED TO IT SAYS NOTHING ABOUT THE READ THAT
FEEDS IT IN PRODUCTION.** Operator ruling, 2026-09-15: "the defect class at its
purest". Recorded beside the fixture lesson because it is the same failure with
the fixture removed entirely: the check supplied the input itself, so the only
code that could fail was never run.

`raise()` decides a notification's channels with `channelsFor(kind, role,
preference)`, and the preference comes from `preferenceFor()`, which read
`eng_notification_prefs` ordered by `updated_at`. **The table has never had an
`updated_at` column.** Every read errored, `preferenceFor` returned null, and
`channelsFor` fell back to the kind's defaults, so **a person who turned email off
was emailed anyway**, on development and on production, which share the schema.

`comms-audit` asserted the channel rule exhaustively, and every assertion was
right, because every one of them called `channelsFor` with a preference the test
built by hand. The rule was correct and the read that feeds it had never once
succeeded. It was introduced by `2d7a37f`, a fix whose purpose was to stop
discarding that very error, and the fix made the error permanent while logging it
faithfully. **It was found by reading the audit suite's own server log on a green
board**, where the line had been printed on every run.

The ordering existed to pick "the newest of two rows" for one person and kind. The
primary key is `(profile_id, kind)`; there can be no second row. So the clause
guarded a state the schema forbids, on a column the schema does not have, and the
comment above it named the exact failure it caused as the one it prevented.

**The general form.** A pure function with a hand-built input proves the function.
It proves nothing about whether production can construct that input. For every
rule tested that way, ask what reads its input in production and whether anything
has watched that read succeed. The check that closes this one reads the columns
the product's queries name against the columns the MIGRATIONS declare, which is a
declaration, never the code under test, and it went red on the shipped code naming
`updated_at`. And read the server log of a green board, because a logged error is
not a failed audit.

**AN ERROR ASSEMBLED FROM A STATUS FUNCTION CAN ONLY NAME THE FAULTS THAT
FUNCTION CAN SEE, SO THE FAULT IT CANNOT SEE REACHES THE USER AS A LIE.**
Operator ruling, 2026-09-13, from the production MFA lockout, and it belongs
beside the fixture lesson because it is the same failure wearing a sentence: the
fixture decides which figures can move, the inventory decides which surfaces are
swept, the scan decides which credentials exist, and a status function decides
which faults can be NAMED.

`answerChallenge` returned `mfaStatus()` when decryption failed. `mfaStatus`
asks whether `MFA_ENCRYPTION_KEY` is present and at least 24 characters, which
are the two faults it was written for and the two it can see. A key REPLACED
with another perfectly valid value passes both, so the screen answered a working
phone with

    MFA_ENCRYPTION_KEY is configured.

in the red error slot. Entirely true, and the least useful true thing the
platform could have said. Four hours went into the wrong diagnosis and the
enrolment was cleared by hand in the end.

**The general form.** A status function enumerates the faults its author thought
of. Returning it as a user facing error silently promises that the enumeration
is complete, and the fault outside the enumeration is then reported as the most
recent thing in the list rather than as unknown. The failure is invisible from
the call site, from the test, and from the status function, because each of the
three is correct.

**The fix is a verifier that asks the question the failing operation actually
failed on**, not a longer status list. `keyFaultFor(secretCipher)` attempts the
decryption, because whether this key is the one this ciphertext was written
under is not answerable any other way. It is deliberately narrow: a row with no
secret is not a key fault, and a cipher that is not three parts is a corrupt row
rather than a changed key, because folding those together is how the next
misleading sentence gets written.

**Phase 14 opens with a survey, report only**: every place in this platform where
a status or configuration function's output is returned as a user facing error.
Each one is a candidate for the same defect, and the question to ask of each is
not whether the sentence is true but whether the function that produced it can
see the fault that would bring somebody to that screen.

**AND THE HOLE A FIX OPENS IS FOUND BY INJECTION-VERIFYING THE FIX, NOT THE
DEFECT.** Operator ruling, 2026-09-13, recorded as its own instance because it
is the sharpest argument this repository has yet produced for the injection
rule.

The recovery code acknowledgement moved the session from `confirm` to a second
call, so the flow could not complete until somebody said they had saved their
codes. Correct, and it created a call that upgrades a half authenticated session
into a full one with no code typed. Sound while the confirm and the
acknowledgement are the same sign in. Unsound the moment they are not: an
account left in "codes issued, never acknowledged" would have been reachable
with a password alone, forever, and that state is precisely the one the feature
exists to make visible. **The protection would have opened the hole it was
measuring.**

Nothing about the fix looked wrong. It was found by asking what a check written
against the NEW code would have to prove, which produced "a second sign in
cannot acknowledge an earlier enrolment", which is the attack written down. The
binding then wrote itself: the enrolment's `verified_at` must be later than the
moment the calling session began, derived from the pending cookie's own expiry.

**So the injection rule has two halves and only one was written down.** Injecting
the OLD defect proves the check catches what already happened. Injecting the
FIX, by asking what the new code makes possible that the old code did not, is
what catches what has not happened yet. The first is verification. The second is
the only thing that finds a regression nobody has met.

**AND EVERY SCAN SO FAR ASKED WHAT THE CODE READS. A SECRET NOTHING READS WAS
INVISIBLE TO ALL OF THEM.** Operator ruling, 2026-09-12, recorded beside the
fixture lesson because it is the same failure one turn further round: the
fixture decides which figures can move, the inventory decides which surfaces are
swept, and a scan that starts from the source decides that a credential exists
only if something uses it.

`ADMIN_PASSPHRASE` sat in `.env.local` holding a short human passphrase for the
`/admin` surface, which was deleted months earlier. `BACKLOG.md` had even
recorded that nothing reads it and that it could come out of Vercel. Three
separate scans could not see it, and each was working correctly: the property
scan looks for `process.env.X`, the injected-env scan looks for `env.X`, the
string lookup scan looks for a name written as a literal. None of them can find
a name that appears in no source file at all.

It was found by reading an environment file, and the same reverse scan then
found two more, `LEAD_FROM_EMAIL` and `LEAD_TO_EMAIL`, left behind when the
email identity moved into a declaration.

So the scan runs BOTH WAYS. Every name set in an environment file must be
declared or listed as retired, and a retirement says when and why, so a dead
credential is named rather than invisible. **The general form: a check derived
from the code can only ever find what the code knows about, and the things worth
finding are often the things nothing references any more.**

**THE INFRASTRUCTURE HALF OF THE ARTEFACT RULE, SAME DAY.** The sharpest finding
of that section came from the operator opening the Vercel dashboard, which no
check in this repository can see. `CUSTOMER_SESSION_SECRET` was set for All
Environments, so a customer cookie minted on any preview deployment was valid on
production, and a preview URL is reachable by anybody holding the link.
`PARTNER_SESSION_SECRET` and `MFA_ENCRYPTION_KEY` shared one value across
Production and Preview. `OPS_SESSION_SECRET` was already split, which is what
made the other three legible as a defect rather than as a configuration: the
correct pattern existed and had been applied to one principal of three.

The declaration now records which environments each credential lives in and
whether a Preview value is distinct, and `soc2-audit` asserts that no secret
deciding identity or opening a database is declared as shared. **It cannot read
Vercel and says so.** What it buys is that a future sharing becomes a deliberate
edit to a reviewed file rather than a dropdown nobody opens again.

**THIRD INSTANCE, 2026-09-16, AND IT IS NOW A PATTERN RATHER THAN TWO STORIES.**
Operator ruling. **The sharpest finding of three consecutive days has been in a
console no audit in this repository can read, and the operator found all three
by opening it.**

| When | Console | What was found |
| --- | --- | --- |
| 2026-09-12 | Vercel | `CUSTOMER_SESSION_SECRET` on All Environments, so a cookie minted on any preview was valid on production |
| 2026-09-12 | Vercel | `PARTNER_SESSION_SECRET` and `MFA_ENCRYPTION_KEY` shared across Production and Preview, while `OPS_SESSION_SECRET` was already split |
| 2026-09-16 | Stripe | The account's public business name and statement descriptor, both CUSTOMER FACING, naming the firm on a checkout page and a card statement, outside `firmName()` and outside this repository |

**The answer is the same every time, and that is what makes it a rule: a
declaration of what the console holds, DATED and ATTRIBUTED.** Not a check,
because no check can reach it. A person reads the console, writes down what it
says and when, and that record becomes a fact this repository can hold, compare
against, and go visibly stale.

`src/config/credential-inventory.ts` does it for Vercel and says outright that it
cannot read it. `src/config/stripe-console.ts` does it for Stripe and says the
same.

**AND A DECLARATION EARNS ITS KEEP BY BEING ASSERTED AGAINST SOMETHING THE
REPOSITORY DOES OWN.** A console record nothing compares is a note. The Stripe
one carries three comparisons: the legal business name must equal the registrant
on the board's record, the support phone must equal what `e164Phone()` derives,
and the account id must equal the account the live audit actually reached. The
first is the valuable one, because it makes an instruction mechanical: the
operator's ruling was that Stripe's legal name changes "in the same sitting as
`issuedTo`", and asserting the equality means the board goes RED at reissuance
naming the Stripe field as stale, rather than depending on anybody remembering.
Injection-verified by moving `issuedTo` and watching it name both values and the
file to edit.

**The general form, and it is the question to ask of any external console:**
what does this system hold that nothing here can see, who last looked, and is
there anything in the repository it can be compared against.

**TWO MORE INSTANCES, 2026-09-10, AND THEY ARE THE SAME THING FROM BOTH ENDS.**
Operator ruling: a check that measures nothing and a screen no check reads are
the same failure. One is a green over an empty set; the other is an empty set of
checks over a real screen. Neither can be seen from the result.

**The check that measured nothing.** A new round was written to walk the three
live deployments, and it called `routesOf("public", { include: "pages" })`.
`routesOf` takes a SURFACE OBJECT, so every property it read was undefined, and
"pages" is not one of the three include values either. It returned an empty
array and the run reported

    PASS: 254engineering: every declared route answers 200 (0 of 0)

Fifteen checks passed and only the apex was ever fetched. Reading the LOG rather
than the exit code found it, and the honest re-run then produced three
compliance findings on the sibling sites that the vacuous one could not have.
The fix carries a floor: a sitemap that fails to parse yields an empty list,
which is exactly the shape that just passed, so the count is now asserted rather
than trusted.

**The screen no check reads.** `/portal/queue` prints each dead letter job's
payload, and an `email.send` payload carries the whole rendered HTML body of the
message. Eight of them, wrapped rather than clipped, made the Job queue **38,744
pixels tall** at 1280: a slab of doctype declarations with the queue somewhere
inside it, 7,462 words on one screen.

Every check that looks at that page was green, and all of them were right. No
horizontal scroll, tap targets fine, contrast fine. **Nothing on the board
measures how tall a portal screen is**, so the screen was unusable and correct by
every question anybody had asked. It was found by opening the screenshot.

The pair is the rule: ask what the green is over, and ask what nothing is
looking at.

**A FIXTURE THAT CANNOT SEPARATE THE TWO ANSWERS PROVES NEITHER.** Recorded
2026-09-09. The first attempt at proving the credit gate used twelve $100 orders
against a $500 limit, and the truncated exposure landed exactly ON the limit, so
the old shape and the new shape both refused and the run reported nothing. The
fixture was wrong rather than the code. Moving the limit to $800, between the
truncated $500 and the true $1,200, made the difference visible: granted against
refused.

**NO FINDING REACHES A COMMIT MESSAGE OR A REPORT UNTIL SOMETHING OTHER THAN THE
SCRATCHPAD HAS CONFIRMED IT.** Operator ruling, 2026-09-14. A finding written up
before it is checked is a claim nothing supports, in the same class as a figure
stated as read back when nobody read it.

**The instance.** An overnight walk printed

    batch total        $0.00

for a batch in which every property had been rejected. It was written up as an
absent-versus-zero defect, a fix was made, and both reached a commit message and
a phase report before anything examined the claim.

**It was not a defect.** The zero came from the scratchpad walk script printing
`money(totalCents)` unconditionally. The product guards that block on
`accepted.length > 0` and never renders it, and `placeBatch` refuses an empty
split outright with its own sentence. No customer could ever have seen it.

`order-audit` caught the change on the next board:

    FAIL: and its total is zero rather than null

**AND THE SAME LESSON IN A STATUS COLUMN, 2026-09-16, WHICH IS WHERE IT IS
EASIEST TO MISS.** Operator ruling, recorded as its own instance.

`eng_protocol_templates` had carried `status in ('draft', 'published',
'retired')` since 0001. Then 254-RC-001 v1.0 arrived: **signed by the engineer
of record, dated, in force as a document, and not yet approved in the
platform**, because only he can do that and only through his own account.

None of the three words is true of it. `published` claims an approval nobody
gave. `retired` is absurd. **`draft` is the one somebody reaches for, and it is
a lie about the thing the whole system rests on**, because draft means the
engineer has not signed.

**A STATUS VOCABULARY THAT LACKS A WORD FOR THE SITUATION YOU ARE IN MAKES
SOMEBODY CHOOSE THE NEAREST LIE.** That is the general form, and it is the same
defect as a null meaning two things: the shortage is in the vocabulary, and the
cost is paid by whoever later reads the value and believes it.

0049 adds `awaiting_engineer` and **three check constraints**, because a word
with no constraint behind it is a convention somebody forgets: a row carrying a
signature date cannot sit in draft, a row in `awaiting_engineer` can hold no
approver and no publication date so it cannot claim to be in force, and a
published row must name who approved it and when.

**The tell, in both instances: somebody is deciding which existing value is
"closest".** That question has no good answer. Add the word.

**THE CHECK'S REASON WAS BETTER THAN THE CHANGE WAS**, and it is the part worth
carrying: **null already meant something else there.** It meant an accepted
property has no price, so no total can be stated. Reusing it for "nothing was
accepted" makes two different states indistinguishable, which is **the fixture
rule applied to a return value**. The split already carried `empty` to say so,
and the very next check asserted it.

**So a scratchpad's output is evidence about the scratchpad.** Before a finding
is written down, something that is not the script that produced it has to agree:
an audit, a screen, the product's own guard read in the source. The three
artefact-reading findings in the same run were all real precisely because each
was read off a SCREEN or a PRODUCT path rather than off a harness.

And a correction leaves a trace. The reverted lines carry why in
`bulk-order.ts`, because a false finding that vanishes is one the next session
re-makes.

**A CHECK WHOSE INJECTION PASSES IS A CHECK PROVEN BY NOTHING, REGARDLESS OF HOW
MANY GREEN LINES SIT BESIDE IT.** Operator ruling, 2026-09-13, and it is the
fixture lesson at the level of a walk: the fixture decides which figures can
move, and a WALK decides which branches can be reached.

Phase 13 Section 1 built a live audit that walks all three account doors end to
end. It went green at 27 checks, and one of them read

    and releasing again opens nothing further

which is the repeat customer: somebody's second order must reach the account
their first one opened. Injecting the defect, by disabling the linking branch
outright, **left all 27 checks green.**

The reason is that the check released the SAME order twice, and the second
release returns early on `account_id` long before it reaches the question of
whether this address already has an account. The branch the check was named
after was never executed. Nothing about the green said so, the check's own
wording said the opposite, and the walk was the most thorough kind of test this
repository has.

**So an injection that passes is not a weak result. It is the only result that
distinguishes a check from a sentence**, and it has to be treated as a red: the
check is rewritten until the injection fails, or it is deleted. Here the walk
gained a real repeat customer, a second order from a second client for the same
address, and the injection then failed naming the consequence a person would
actually meet: the second order points at no account at all, which is signing in
and seeing one order out of two.

**Every injection is read for WHICH checks went red, never only for whether the
run failed.** A run that goes red for the wrong reason is the same defect as one
that stays green: both mean the check under test was not the thing exercised.
That half of this rule has cost two findings in two days, the other being a
combined injection whose cascade made a security check pass for the wrong
reason.

**AND A MATCHER WITH A WINDOW WIDER THAN THE THING IT MATCHES ATTACHES TO ITS
NEIGHBOUR. FOURTH INSTANCE 2026-09-16, AND IT IS NOW ONE OF THE TWO RECURRING
DEFECTS IN THIS BUILD**, beside one fact with two homes. Operator ruling.

| When | The matcher | What it attached to instead |
| --- | --- | --- |
| 2026-09-13 | An eight line window searched for a table name | The next query block, so three reasons landed on the wrong reads |
| 2026-09-13 | The last `];` in `supabase/applied.mjs` | `BEHAVIOUR_DIVERGENCE`, not `APPLIED` |
| 2026-09-16 | `/expires: "[^"]*",/` in the gate fixture | Latent: `verifiedEngineers` is declared earlier than the registration, so it would have taken the ENGINEER's expiry the day one was recorded |
| 2026-09-16 | `/firmName/` in `compliance-audit` | The FIELD `firmNameOnDocument`, so a record that merely names the deriver read as calling it |

**The fourth is the one to carry, because nothing was broken when it was
written.** The pattern was looking for a CALL and matched a NAME. Both spellings
contain the thing being searched for, and only one of them is the thing being
forbidden.

**The rule, unchanged and now with four instances behind it: match the thing you
mean.** A call is `name(`, not `name`. A field is the line adjacent to it, not
the nearest punctuation that resembles it. Where adjacency is not enough, locate
by explicit position and ASSERT the target before writing.

**AND A TOOLING RULE RATHER THAN A LESSON: NO INLINE SCRIPT MAY CARRY A
BACKSLASH.** Operator ruling, 2026-09-16, after the shell ate regex escapes
three times in one session.

`node -e` and heredocs in this environment do not deliver backslashes intact.
`\s` arrives as `s`, `\n` arrives as a real newline that breaks a regex literal
across two lines, and `\b` arrives as a literal backspace byte. Each of those
happened, and two of them reached disk:

- `\d` in `stripe-webhook-audit`, so a date pattern matched nothing and its check failed on a correct record.
- `\s*\n\s*` in `gate-fixture`, so the file stopped parsing and the board reported three content failures for one syntax error.
- `\b...\(` in `compliance-audit`, which wrote a backspace character into the source.

**So: anything containing a backslash is written with the editor, or written to
a file first and then run.** Not because inline scripts are bad, but because
this particular pipeline is lossy in a way that produces plausible, silent
wrongness rather than an error.

**AND THE ORIGINAL INSTANCE, 2026-09-13**, in the patch script written to
document all of this. It searched an eight line window for a table name to decide which query
a comment belonged above, and these queries sit in three line blocks, so one
block's window reached into the next and three reasons landed on the wrong
reads. It is the recurring defect of this repository wearing a code generator: a
thing looking at the right subject in the wrong span.

The fix is the general one: match the line immediately adjacent, not a window,
and where adjacency is not enough, place by explicit position and ASSERT the
target before writing. The four that could not be disambiguated were inserted by
line number with each one checked against the read beneath it first.

**On the patch scripts themselves.** Eleven were written in that section, none
is tracked by git, and every one refuses to exit zero when its substitution
finds nothing: re-running all eleven exits non-zero and changes no file. The one
that silently did nothing was not a substitution but an IMPORT GUARD, which
asked whether the file already mentioned a symbol that the substitution above it
had just inserted, so it always answered yes and skipped. Nothing in the script
could catch that, because the script had done exactly what it was told;
`tsc` caught it, and that is the argument for a compile step over a careful
script.

**A SCAN THAT READS A TRACKED FILE LIST MEASURES NOTHING ABOUT A FILE THAT IS
NOT YET TRACKED, AND THE FILE MOST LIKELY TO MATTER IS THE ONE YOU JUST WROTE.**
Operator ruling, 2026-09-14.

`project-accountability-audit` scans the source in reverse, so a project ref
somebody wires up without telling the declaration is found. It listed
`git ls-files`, which is TRACKED files only.

Its own declaration, `supabase/projects.mjs`, was a new untracked file while the
audit was being written. So the scan could not see **the one file in the
repository most certain to contain project refs**, and it passed four times over
a set that excluded itself. Three injections were run against it and all three
were caught, because each injected into a file that was already tracked.

The commit made the declaration tracked. The board read it on the next run and
went red, naming four refs recorded there and absent from the declared set. **52
of 53 audits passed and the one red was the audit added that day.**

It is the vacuous green in a new costume: a green audit is a green audit of the
FILES IT READ, and a file list is exactly the kind of input nobody thinks of as
a filter. The fix is `git ls-files --cached --others --exclude-standard`, so a
declaration is scanned the moment it is WRITTEN rather than the moment it is
committed, and the regression is an injection that creates an untracked file
carrying an undeclared ref.

**The general form, and it is worth carrying past this one script:** any check
whose subject list comes from version control has a blind spot exactly the shape
of "new work". That is the same span as "the thing being built right now".

**AND A RECORDED EXPLANATION IS A HYPOTHESIS UNTIL SOMETHING RE-CHECKS IT.**
Operator ruling, 2026-09-14, from the same night, and it is about this file
rather than about any script.

The live read-back rule in section 6b carried two explanations for why a
behaviour digest differs from a replay: that `conbin::text` renders differently
between PGlite's 18.3 and Supabase's 17.6, and that three function bodies are
stored with comments stripped. Both had been read and trusted for a week. **Both
were too narrow**, and the Phase 14 rank 1 replay proved it by comparing two
databases that are BOTH Supabase 17.6, where the version explanation cannot
apply and the difference appeared anyway.

`conbin` turned out to be unstable between any two databases; the function count
was four rather than three and development strips them too. And underneath the
noise sat a real difference the explanation would have hidden: one foreign key
NOT VALID on one side and validated on the other.

So an explanation written down once is a hypothesis with a date on it. When it
is used to dismiss a difference, the dismissal has to be re-derived rather than
cited, because **an explanation that covers the observation is not the same as an
explanation that is true**, and a wrong one is worse than none: it makes the next
session stop looking.

**A CHECK MADE VACUOUS BY A CAP IT DOES NOT KNOW ABOUT IS THE WORST KIND,
BECAUSE ITS OUTPUT NAMES THE RIGOUR IT IS NOT PERFORMING.** Operator ruling,
2026-09-14, from phase 0's dry run of `copy-project.mjs`.

PostgREST answers an unbounded `select("*")` with **at most 1000 rows**, no
error, no warning, and nothing in the response saying anything was left behind.

`copy-project.mjs` read its source rows that way and compared the result against
an EXACT count of the destination. On a table of 17,500 that reads 1000, writes
1000, counts 1000 at the destination and prints **agree**. It would have copied a
thousand of seventeen and a half thousand audit events and reported success.

**THE PART THAT MAKES THIS ITS OWN RULE IS WHICH CHECK IT RUINED.**
`eng_audit_events` is the one table compared by ID SET rather than by count,
deliberately, because two sets of the same size can differ and that table is the
firm's regulatory memory. It is the strictest check in the file. **Both sides of
it were capped at 1000**, so it printed

    id sets identical (1000 ids compared one by one)

while 16,500 rows on each side were never looked at. The sentence is a precise
description of rigour that did not happen, and it is the sentence somebody would
quote in an incident review as evidence the copy was sound.

A green over an empty set is recognisably thin. **A green that announces it
compared seventeen thousand things one by one, having compared a thousand, reads
as the strongest evidence in the file.** That is why it outranks the other
vacuous-green instances rather than joining them.

**The fix is the assertion, not the paging.** `scripts/lib/read-every-row.mjs`
reads the exact count FIRST and refuses to return unless what it assembled equals
it, so a reintroduced cap, or a row deleted mid-walk, fails loudly instead of
returning a short list that looks complete. Injection-verified both ways: against
`eng_audit_events` it returns 17,500 where a bare select returns 1,000, and
against a client crippled to answer one row per page it refuses with
"read 2 rows against an exact count of 1327".

**The general form.** Any transport with a silent ceiling makes every check
downstream of it a check on the ceiling: PostgREST's 1000, a sitemap that failed
to parse, a glob that matched nothing, a file list that excludes untracked files.
**Ask what the count would be if the mechanism returned nothing, and whether the
check could tell.**

**AND THE SAME FILE CARRIED THE SAME DEFECT TWENTY LINES AWAY, WRITTEN IN ITS OWN
SOURCE.** Operator ruling, 2026-09-15, recorded as its own instance.

The queue stop in `copy-project.mjs` read the job queue with `.limit(20)` and
reported the length of what came back as the depth:

    the job queue holds 20 pending or running job(s) (email.send, report.export)

**The queue held 668, across three kinds.** Twenty of 668, and a whole job kind
invisible, because none of its rows happened to reach the first twenty. The
number was precise, it was plausible, and a person reading it would have waited
a minute for twenty jobs to drain.

Two things make it worth its own entry rather than a footnote to the 1000 cap.
**This ceiling was not PostgREST's.** It was written in the file, by hand, and
still read as a measurement, so knowing about silent transport caps would not
have found it. And **the sample's contents were wrong as well as its size**: a
list of kinds read off a bounded sample is a claim that those are the kinds,
and it was missing one.

The rule it produced: **COUNT the thing you report, SAMPLE the thing you
describe, and never let a sample's length stand in for a count.** A bounded read
is often the right instinct; reporting its length as the size of the set is the
defect. And two instances of one defect in one file means surveying the rest of
the file rather than assuming the other reads are sound.

**AND A COUNT FROM ONE SEARCH IS A CLAIM. IT READS AS A SURVEY.** Operator
ruling, 2026-09-15, and it is the same family as the 1000 cap and the twenty of
668: a bounded look reported as a total.

The registration wording sweep was reported to the operator as **seventeen**
sentences to replace. That figure came from a single grep for one phrasing.
When the replacement was actually made, and then when a check was written to
assert the property in both directions across every source file, the number was
**43**, of which 41 are sentences a person or a caller reads. Nothing about the
first figure looked like a sample. It was a precise count of what one pattern
matched, presented as the size of the problem.

**The rule: a figure offered as the extent of something says what produced it,
or it is not offered.** One search is one search. The extent of a thing in this
repository is established by a sweep that derives its own subject list, or by a
check that asserts the property, and those are the two numbers worth reporting.

**AND THE SHARPEST ONE YET: THE FAILURE THAT SENDS NOTHING AT ALL, SO EVERY
CHECK ON THE ARRIVAL PATH IS GREEN FOR THE REASON THAT MATTERED.** Operator
ruling, 2026-09-16, from the Stripe webhook.

Nothing compared the account behind `STRIPE_SECRET_KEY` with the account behind
`STRIPE_WEBHOOK_SECRET`. The obvious place to check is the webhook handler,
where both credentials meet, and two of the three layers built do exactly that.

**But the worst version of the mismatch produces no webhook.** If the key is
account A and the URL is registered only in account B, then **A never calls
us**: no 400, no log line, no event, nothing to inspect. The customer pays,
Stripe shows the charge, and the order sits at `awaiting_payment` forever. Every
check on the arrival path is green, and each one is correct, because the subject
never arrives.

**It outranks the earlier vacuous-green instances rather than joining them**, and
the reason is where the green comes from. A green over an empty set is at least
an empty set somebody could count. A green over an event that was never sent has
nothing to count at all: the harness is not looking at the wrong thing, it is
waiting to be called by a system that has no idea it exists.

The fix is the only shape that can work: **a check that asks the question
without waiting to be called.** `scripts/stripe-webhook-audit.mjs` asks the
key's own account whether it has an endpoint at our URL, enabled, subscribed to
the events the handler branches on, with the event list PARSED out of the
adapter rather than typed, so a fourth handled event nobody registered turns it
red and names it. It runs on the board with no credentials and reports
`COULD NOT TELL` for the live half, which needs the key.

**The general form, and it is the question to ask of any integration:** what
does this failure look like if the other system simply stops calling, and is
there anything on our side that would notice. If the answer is that every check
lives on the inbound path, there is no check.

**A CHECK THAT FILTERS LIVE DATA FOR A SUBJECT THAT DOES NOT EXIST YET IS
VACUOUS. BUILD THE SUBJECT.** Operator ruling, 2026-09-09, from the reporting
paging work. The obvious way to check that a paged expansion still sums the
whole set is to filter the live figures for one that exceeds a page and check
that one. No figure does on this database, so that check reports a pass over an
empty list every run until the data grows, and is then exercised for the first
time in production, which is the one place nobody is watching it.

So the window is asserted against a set CONSTRUCTED to be bigger than a page,
which makes it true or false today and every day. The same trap caught the
neighbouring check in the same hour: "no migration numbered above 0028 went in
by hand" is what the ruling says in words, and it passed over an empty list and
passed just as happily when a by hand 0028 was injected to test it. Stating the
rule as the SET instead, "0025 is the only by hand entry there may be", made it
fail on the injection immediately.

Where a check genuinely depends on live data, say what it had to work with:
`(0 figures exceed one page today)` in a note is honest, and it tells the next
reader the green was cheap.

**AN AUDIT NEVER IMPORTS ITS EXPECTATION FROM THE THING IT AUDITS.** Operator
ruling, 2026-09-08, and it is the companion to the declared inventory idiom
below. An audit that reads its expected value from the module under test
compares a value to itself and cannot disagree with anything.

It was caught the only way it can be. A new check asserted that every email
template was FROM the ruled display name, comparing against the constant the
templates are built from. The injection test changed that constant back to the
old personal name, and the check reported, in its own words, `PASS: every template is FROM "Robert Reyna, 254 Engineering Services"`.
Only a hardcoded literal in the same file caught anything.

So a ruled value is written out in the audit as a literal, and the config is
asserted separately to still state it, which names a drifted constant as a
drifted constant. The duplication IS the mechanism: two places somebody has to
edit on purpose.

The distinction that makes this workable rather than merely duplicative:
deriving from a DECLARATION is the idiom, and importing from the
IMPLEMENTATION is the defect. roles-audit derives from DEFAULT_ROLES and
email-audit derives its template list by parsing compose() calls, both of
which are declarations of intent. Reading the rendered output's own constant
back and comparing it to itself is not.

**THE HARNESS MEASURES WHAT `scripts/lib/surfaces.mjs` SAYS EXISTS.** Operator ruling,
2026-09-07. That file is the one declaration of this platform's surfaces: the public site, the
order flow, the staff portal, the partner portal and the customer account surface, each with its
prefix, whether opening it needs a session, and which probe makes one. Routes are derived by
walking the directories it names rather than listed, because a list is the memory problem one
level down.

Every browser audit derives its subject from it. `scripts/surface-audit.mjs` fails when a
directory that renders pages belongs to no declared surface, when an exemption names an audit
that does not reference it, when a declared probe does not exist, or when one of those audits
stops importing the inventory. Adding a surface without declaring it is a red board.

It was written because the opposite happened. Every audit had carried its own hand written list
and nothing had carried a list of what exists, so the partner portal shipped in Phase 9 Section 4
and reached two audits out of eight: its screens were measured for contrast by nothing, for tap
targets by nothing, for overflow by nothing, for form behaviour by nothing, and for the perimeter
by nothing. Bringing all five surfaces into all seven audits produced nine findings on the first
run, including a colour token used as text at 3.1:1 and a shadow token that did not exist.

The build race guard (`prebuild`, and the `pre` hook on every audit) refuses to build under a live
server and performs a BUILD_ID handshake so an audit can never score a stale artifact.

## 6b. Two databases, and the guard between them

There are two Supabase projects. Which one a command talks to is decided by
`SUPABASE_URL`, and reaching the wrong one is prevented by code rather than by
care.

| | Project ref | Holds |
| --- | --- | --- |
| **Production** | `fsaryeciduszuahgjbly` | Real leads, applications, onboarding records, portal accounts. Shared with unrelated apps, which is why every table this firm owns is `eng_` prefixed. |
| **Development** | `ythzaiqeoijlrdibnieo` | The same schema and nothing else. Created 2026-09-02. Every audit points here. |
| **The new project, not yet in use** | `qmvcqvkywmkogxbyzsaz` | The schema at 0023 and five private buckets, and no data. Created 2026-09-04 for the cutover, replayed and verified 2026-09-07. **The cutover is deferred by operator decision, so nothing points here and nothing should.** |

**Production credentials live only in Vercel.** `.env.local` carries the
development project. The production service role key is not in the working tree
and must not be put there.

**The third row is a project waiting, not a target.** `PRODUCTION_REF` still
names `fsaryeciduszuahgjbly` in both `src/lib/db-guard.ts` and
`scripts/lib/db-target.mjs`, which is correct while the cutover is deferred and
is exactly what step 9 changes when it is not. One consequence worth knowing
before it bites: `neverProduction` compares against that constant, so the new
project would today read as an ordinary development target to `roles-audit` and
`seed-field-demo`. Nothing points at it, so nothing runs against it; the moment
something does, those two constants move first. The full state of that project
is in `docs/production-cutover-plan.md`, under the deferral notice at the top.

**THERE IS A FOURTH PROJECT, AND THE DOCUMENT THAT SAID IT WAS DELETED WAS
WRONG.** Operator ruling, 2026-09-14.

`docs/production-cutover-plan.md` said of `254engineering-rehearsal`
(`kmiwxtbtqrlorxfogtht`), in writing, "since deleted". Eleven days later it was
alive, billable, and holding 239 audit events, 2 order payments, 1 profile and 1
service order. Nobody deleted it and nobody checked. The sentence was written in
the same pass as the deletion was intended.

**A DOCUMENT THAT RECORDS A DESTRUCTIVE ACTION AS DONE IS A CLAIM NOTHING
SUPPORTS UNLESS SOMETHING CHECKED.** Deleting, revoking, rotating and
decommissioning are the four that matter, because each one leaves something live
and costing money when it silently does not happen, and each one reads
identically on the page whether it happened or not. It is the same failure as a
green audit over an empty set, wearing prose.

**So the projects are a declared inventory like every other one here.**
`supabase/projects.mjs` names every project this firm is accountable for and the
document that explains it, and `scripts/project-accountability-audit.mjs` runs on
the board. Like `schema-ledger-audit` beside it, **it cannot see the provider**
and says so: it asserts that every project the REPOSITORY names is declared and
explained by a document that actually mentions it, and it scans the tracked
source in REVERSE so a project somebody wires up without telling the declaration
is found. Listing the organisation is a by hand MCP step, `list_projects`.

The first run of that by hand step found **eight projects where this firm
accounts for four**. None of the other four holds a single `eng_` table, checked
rather than assumed. One of them, `wattsmith-dedicated`, was created the day
after the cutover project and holds the wattsmith application's own schema, which
reads as wattsmith moving off the shared project this firm calls production;
that is in `BACKLOG.md` awaiting a ruling.

**Why this exists.** Before the split, every audit run wrote to production:
roles-audit created accounts there, mobile-overflow-audit signed a probe in
there, and forms-audit had already once filled production tables with thirty rows
while reporting green. Test runs and real records shared a database, and the only
thing keeping them apart was that nobody had made a mistake yet.

**The guard.** `scripts/lib/db-target.mjs` owns client construction for every
script, so the only way to get a connection is through the check. If
`SUPABASE_URL` is production and `ALLOW_PRODUCTION_DB` is not exactly the
string `1`, the script exits before a client exists. The flag defaults off and
is compared exactly, so `0`, `false`, `no`, and `true` are all refusals.

`scripts/db-guard-audit.mjs` runs first in the suite and asserts both directions
plus the one bypass the module cannot prevent by construction: no script in
`scripts/` may import `@supabase/supabase-js` directly.

**The schemas are identical and that is verified rather than assumed.** Compare
the fingerprint on both projects; they must match:

```sql
select md5(string_agg(sig, '|' order by sig)), count(*)
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

At the split both returned `295e928584cea806d90c5a2f2dede886` across 439
columns. After migration 0002 (Phase 2, field dispatch) both return
`b4b422e1b761ae633b7729dff63f7669` across 441, and after 0003 (Phase 3, tech
onboarding) `ad2663f8e0e6cd2508c9b5bd43c7b7f4` across 467, and after 0004
(Phase 4, engineer review) `7249bb177ad22e5bab4da2ab0cae44f9` across 483, and
after 0005 (Phase 5, comms) `1187b16a91c10ff758ce8953e4efb1ca` across 489. Every migration in
`supabase/migrations/` applies to both, in order, and a migration applied to one
and not the other is a defect the fingerprint catches.

Continuing the chain: after 0006 and 0007 (Phase 7, the order engine) both
projects return `eac11d782d44bd11cb893637f67d2ee1` across 607, and 0008 (pinning
the trigger functions' search_path) changes behaviour without changing shape, so
that figure is unchanged by it. After 0009 and 0010 (Phase 8 Section 1, the B2B
accounts and the API request log) **both projects return
`9b32a7cced94549f7aeea93cc3ee3d6e` across 719 columns and 48 tables**, applied
to production on 2026-09-04 when that branch merged. After 0011 (Phase 8 Section
2, the job queue) and 0012 (Section 3, observability) **all three return
`7bf0d1553cf0169d366389eeae4b7497` across 765 columns and 53 tables**, with row
level security on all 53, 31 triggers and 5 functions, none of them with an
unpinned search_path. Applied to production on 2026-09-04 when that branch
merged. After 0013 (Phase 9 Section 1, the partner program) and 0014 (Section
2, attribution) **all three return `b1ad321300010129b5dbd0afc42a156b` across 850
columns and 61 tables**, with row level security on all 61, 37 triggers and 6
functions, none of them with an unpinned search_path. Applied to production on
2026-09-04 when that branch merged. After 0015 (Phase 10 Section 1, the operator
job intake), 0016 (Section 1.5, what a job was asked) and 0017 (standing answers
on an account) **all three return `aca946e3c49d149d73685c4eb30d092e` across 868
columns and 62 tables**, with row level security on all 62, 38 triggers, and no
function with an unpinned search_path. Applied to production on 2026-09-04 when
that branch merged. After 0018 (Phase 10 Section 2, roles and grants become
data) **all three return `eb4f97be87ef35c21b1cc8b3b4d6af23` across 878 columns
and 64 tables**, with row level security on all 64 and zero policies on the two
new ones, 39 triggers, and no function with an unpinned search_path. Applied to
production on 2026-09-05. After 0019 (Phase 9 Section 3, partner compensation)
**development and the replay return `d8fa49515f2666bd7543c21aff831407` across
902 columns and 65 tables**, with row level security on all 65, 42 triggers, and
8 eng_ functions, none with an unpinned search_path. After 0020 (Phase 9 Section 5, the partner
asset library), 0021 (Section 6, partners.manage becomes a grant) and 0022
(Section 6, the order keeps its visitor key) **development and the replay return
**all three return `330536b4b13cfc2f51ed1cb3b0c6edf1` across 941 columns and 68
tables**, with row level security on all 68, 46 triggers, 9 eng_ functions none
with an unpinned search_path, and 111 role grants. Applied to production on
2026-09-06 when Phase 9 merged, and verified against production rather than
assumed: the fingerprint, the column and table counts, the trigger count, the
grant count and the RLS count were all read back from
`fsaryeciduszuahgjbly` and all match development exactly.

After 0023 (the closeout, what an alert remembers) **all three return
`b2c841480f983ec50e36e72a11e9072a` across 945 columns and 69 tables**, with row
level security on all 69, 46 triggers, 9 eng_ functions none with an unpinned
search_path, and 111 role grants.

**0023 is the reason this section is no longer only prose.** It merged to main
on 2026-09-06 and was applied to production on 2026-09-07, a day late, and it
was found by hand while somebody was comparing fingerprints for an unrelated
reason. In between, `eng_alert_state` did not exist on production, so the queue
depth alerting that shipped in the same closeout could not read its cooldown.
The failure was latent rather than absent: the first time the queue went deep
enough to alert, the cooldown would have read as never alerted, the upsert
recording the send would have failed on the same missing table, and the operator
would have been emailed every five minutes about a stuck queue. That is the
exact failure 0023 was written to prevent, caused by 0023 being missing.

The paragraph above already said a divergence after a merge is the defect. It
said so and could not enforce it, because **a record is not a check**.

After 0024 (Phase 12 Section 1, a second factor) **development and the replay
return `0e8ff33c7106ce05ec2cf81a1c66cd35` across 960 columns and 71 tables**,
with row level security on all 71 and 47 triggers. **Production does not have
it** while that branch is open, which is the expected divergence, and
`schema-ledger-audit` fails the moment it is on main and still undeclared.

**From 0025 the chain lives in `supabase/applied.mjs` and not in this
paragraph.** After 0025 (MFA optional by default) the figure is
`0e8ff33c7106ce05ec2cf81a1c66cd35` unchanged, because it seeds a row rather than
altering a shape; after 0026 (marketing suppressions)
`2f76de7be0fb4ed93459db4d72d80237` across 964 columns and 72 tables; after 0027
(Phase 12 Section 2, reporting foundations) `9bbcca2c9cd3c65503c923d7c32ea769`
across 970 columns and 72 tables, with 5 report grants and 116 grants in total;
and 0028 leaves that figure untouched because it is a backfill with no DDL in
it.

The reason the prose stops carrying the full account is the one this section
already makes about 0023: **a record is not a check.** The ledger is read by two
checks, this file is read by nobody, and two accounts of one chain are two
accounts that will disagree. Every fingerprint above is in the ledger with the
count it was read back at; what belongs here is the pointer and the reasoning,
not a second copy of the numbers.

**A MIGRATION REACHES PRODUCTION THROUGH THE SUPABASE MCP, AND ONE REFUSED CALL
IS NOT A CLOSED DOOR.** Recorded 2026-09-08. The production service role key is
not in the working tree and must not be, so nothing in `scripts/` can reach
production without `ALLOW_PRODUCTION_DB=1` and a key somebody supplies. The MCP
is the other path, and it is how 0026, 0027 and 0028 were applied and read back:
`apply_migration` against `fsaryeciduszuahgjbly`, then `execute_sql` for the
fingerprint and the row counts.

This is written down because a session got it wrong in the direction that costs
the most. One `execute_sql` call was refused, and the session concluded the
production path was closed, wrote a PENDING ledger entry saying so, and told the
operator the count was unknowable. `apply_migration` had not been tried, and it
worked first time. **A refusal is a refusal of one call. Try the tool that
actually applied the last migration before declaring anything unreachable, and
never let "I could not measure it" stand in a ledger when it means "I did not
try the other tool".**

**EVERY PRODUCTION MIGRATION GOES THROUGH `apply_migration`, NEVER
`execute_sql`.** Operator ruling, 2026-09-09. The two tools differ in a way that
matters months later: `apply_migration` writes a row into
`supabase_migrations.schema_migrations`, and `execute_sql` changes the database
and writes nothing. A migration applied the second way is plainly present in the
schema and completely absent from the provider's own history of what has been
applied.

0025 is exactly that, and it is the one grandfathered case. Production's
`list_migrations` names 0024, 0026 and 0027 and not 0025, while production
unmistakably HAS 0025: `eng_roles` reads `optional` for admin and engineer,
which is the only thing that migration does. Somebody reading that list to
answer "does production have 0025" gets the wrong answer, and the wrong answer
is the alarming one, because they would re-apply a migration production already
has.

**The ledger stays the authority and the provider's list is the cross-check.**
Every entry in `supabase/applied.mjs` now declares `appliedBy`, and
`schema-ledger-audit` enforces three things with no credentials: every applied
migration says how production got it, anything applied by hand carries a
`handApplied` sentence saying what the provider's history will not show, and
0025 is the only by hand entry there may be.

**The live comparison is a by hand step, and the reason is not laziness.**
`supabase_migrations.schema_migrations` is not in the `public` schema, so
PostgREST does not expose it, which was verified rather than assumed: neither
`schema-ledger-audit`, which runs credential free in the suite by design, nor
`production-schema-check`, which has the key, can read it. Checking a SNAPSHOT
of that list into the repository would make it readable and would be the exact
failure the ledger exists to prevent, a record that stops being true without
telling anybody. So the comparison is run through the Supabase MCP when a
migration lands, and what runs on the board is the declaration.

0023 adds `eng_alert_state`, which is the fifth table in this schema that is
deliberately NOT append only, and it belongs to the same class as the four in
0011 and 0012: telemetry about the machine rather than a regulatory or financial
fact. It holds one row per thing that can alert and the last time it did, so a
queue that stays behind for an afternoon sends one email an hour rather than one
every five minutes. Three cheaper alternatives were considered and each was
worse; the argument is written at the top of the migration, and the sharpest of
them is that recording it as a fault would have put the alert about a stuck
queue into the stuck queue.

0021 is one row, and it is the first migration since 0018 to seed a grant. That
made roles-audit's seed comparison wrong rather than incomplete: it read
0018_roles_as_data.sql directly, so a capability declared in DEFAULT_ROLES and
seeded anywhere else read as missing from the migration. It reads the whole
chain now, which is the shape it should always have had. Editing 0018 was never
an option, because it has run against production and a migration that changes
after it has run is a migration nobody can reason about.

0022 is a repair. 0014 keeps every partner touch, including the ones that lost,
so a dispute can be settled by showing a partner the touch that beat theirs; and
the ORDER never stored the visitor key its attribution was decided under, so the
evidence was complete and unreachable from the record it explains. Typed codes
were always findable under the synthetic `order:<id>` key, which is exactly why
nobody noticed: the dispute anybody tests by hand is a code somebody typed.
Orders attributed before it cannot be reconstructed, and the screen says so
rather than showing an empty list.

0019 adds the second and third functions in this schema that refuse a change
rather than touching a timestamp. `eng_freeze_partner_entry` guards every column
of a partner ledger entry EXCEPT `statement_id`, which a statement close has to
be able to write, and `eng_forbid_partner_entry_delete` refuses removal outright.
The narrow shape is deliberate and follows 0014: forbidding UPDATE wholesale
would have made the close impossible, which is how a table ends up with a
"corrections" column that everything reads instead.

That table is the second in this schema, after `eng_audit_events`, that a test
run cannot clean up after itself. Its guarantees are therefore exercised inside
`migration-audit`'s replayed database, which is thrown away, rather than by a
live audit that would leave a probe partner's earnings on development forever.

0018 also seeds ROWS, which is the first migration in this chain whose
correctness is not captured by the fingerprint at all. The shape is 64 tables
either way; whether the administrator role carries `roles.manage` is a row, and
the first version of this migration did not carry it while DEFAULT_ROLES did.
Development agreed with the TypeScript only because the row had been inserted
there by hand. Applying it as written would have produced a firm unable to open
the permission screen and unable to grant itself the permission that opens it.

So the seed is generated by `scripts/emit-role-seed.mjs` from DEFAULT_ROLES,
and `roles-audit` derives the expected roles, landing paths, system flags and
grants from the same declaration and compares them to the migration file,
including that neither side lists a grant twice. Both projects hold 7 roles and
110 grants, verified after applying rather than assumed from the fingerprint.

0016 adds `eng_file_inputs`, which is the second table in this schema whose
shape deliberately duplicates another. It is keyed on the FILE while
`eng_order_inputs` is keyed on the ORDER, because a job taken over the telephone
has no order until somebody pays and may never have one. The first is the job's
working record, where answers arrive late and get corrected; the second is
checkout evidence, written once. Evidence that can be edited is not evidence,
which is why they are not one table. The same reasoning, written out at length,
is in the migration.

0011 and 0012 add the first tables in this schema that are deliberately NOT
append only. `eng_jobs`, `eng_cron_runs`, `eng_error_events` and
`eng_metrics_daily` are telemetry about the machine rather than a regulatory or
financial fact, they are meant to be pruned on a schedule, and the append only
trigger would make a retention job impossible while protecting nothing anybody
could be asked to produce. That is worth stating plainly, because "every table
in this schema refuses deletes" would otherwise read as the rule.

**A LIVE READ-BACK IS JUDGED ON COUNTS, NEVER ON THE BEHAVIOUR DIGEST.**
Operator ruling, 2026-09-12, amending the stop condition after the 0038 to 0041
run measured what it actually costs.

Production came back at exactly the predicted 814 facts under a different
digest, and the run stopped to find out why. Two reasons, neither a schema
difference: `conbin::text` is an internal node-tree serialisation rendered
differently by PGlite's PostgreSQL 18.3 and Supabase's 17.6, and the three
function bodies carrying SQL comments are stored on production with those
comments stripped. Proven rather than argued, by a check constraint created on
both sides the same hour from byte identical SQL that hashed two ways.

**BOTH HALVES OF THAT EXPLANATION WERE TOO NARROW, AND THE 2026-09-14 REPLAY
CORRECTED THEM.** Phase 14 rank 1 replayed all 49 migrations into
`254engineering-rehearsal` and compared it against development. Both are Supabase
**PostgreSQL 17.6**, so the version difference cannot be the cause of anything,
and `ck` and `fn` still disagreed.

- **`conbin` is not stable between two databases AT ALL**, never mind between two
  engine versions. Compared instead by `pg_get_constraintdef`, all 106 check
  constraints hashed identically on both sides. So the portable way to compare a
  check constraint is its DEFINITION, and the version explanation above is a
  special case of a wider fact rather than the reason.
- **It is FOUR function bodies, not three, and development strips them too.**
  `eng_set_trade_price` joined the list when 0047 added it. The four are exactly
  the four whose bodies contain SQL comments: `eng_claim_jobs`,
  `eng_forbid_mutation_allow_cascade`, `eng_forbid_sealed_work_delete` and
  `eng_set_trade_price`. Normalised for comments and whitespace, all four hash
  identically. The stripping is not a production peculiarity.

**And one real difference hid inside the noise, which is the argument for
chasing a digest rather than waving at it.** The `fk` digests differed by exactly
one fact: development carries `eng_responsible_charge_log_file_id_fkey` NOT VALID
because of the 28 dangling rows 0039 documents, and a freshly replayed database
validates it because the table is empty. Hashing the 141 keys without the
validated flag matched on both sides. **That is a genuine, meaningful difference
between two databases**, and a session that had written the whole digest gap off
as "the known conbin thing" would have reported three explained differences and
missed it.

So the rule is:

| | Compared by |
| --- | --- |
| Replay against replay | Both digests, whole. Same engine, so they must agree. |
| **Replay against a LIVE project** | The **fact count** and the **per-kind figures**, `fk`, `ck`, `ix`, `pk`, `rls`, `tg`, `fn`, and the seeded rows. |
| The SHAPE fingerprint, anywhere | The digest, whole. It reads `information_schema.columns` and is portable, confirmed three times in one hour at 1,015 then 1,016 then 1,017 columns. |

**A ledger prediction predicts COUNTS, never a digest**, and a digest difference
against a live project is RECORDED WITH ITS EXPLANATION rather than treated as a
stop. A difference in any count still stops the sequence, unchanged.

The reasoning is in `supabase/applied.mjs` above the twelve fact note, with the
per-kind figures that closed. `scripts/fingerprint-at.mjs` prints both
fingerprints at any point in the chain and is what a read-back is re-derived
from.

**AND THE JUDGEMENT THAT RAN AHEAD OF THE OLD RULE WAS THE RIGHT ONE.** The old
wording said any figure other than 814 and that digest stops the run. The
session continued to 0041 and wrote it up as a disclosed judgement rather than
absorbing it. The operator upheld it: stopping between 0040 and 0041 would have
left main describing a schema production lacked, which is the worse state and
the exact thing this ledger exists to prevent.

**A MIGRATION ON MAIN IS NEVER PENDING.** Operator ruling, 2026-09-13, and it
closes a gap the operator names as theirs: 0042 was ruled pending, and then a
merge was approved without ruling what a pending migration becomes at merge.

Either it goes to production in the merge sequence, or it does not merge. **If a
migration must stay off production, it stays on its branch.**

`schema-ledger-audit` already enforced the consequence and went red the first
board after Phase 12 Section 6 merged, naming it as the second time merged and
applied had diverged. What was missing was not the check; it was the rule the
check was enforcing, which nobody had written down.

The practical shape: an overnight run that is forbidden to touch production
produces migrations that are correctly pending, and those branches do not merge
until somebody is at a keyboard to run the production half. A pending migration
is a reason to hold a merge, not a thing a merge can carry.

**AND A FIXTURE DERIVES THE CONDITIONS RATHER THAN STATING THEM.** Same ruling,
same day, and it is the fixture lesson one level up.

`withGateConditionsMet` carried a list of the gate's conditions and how to
satisfy each. That list is exactly as current as the day somebody last edited
it, and on 2026-09-12 the gate grew a fourth condition while the fixture went on
patching three. Every live half of every audit then rendered the PRELAUNCH site
while asserting live things about it, and the gate was working perfectly. The
same file's header already recorded the identical failure from 2026-09-10, one
condition earlier.

So the fixture still carries the patches, because it cannot satisfy a condition
nobody has told it about, and it now **asks the gate whether it actually
opened** and refuses to run the body if anything is still shut, naming the
blocker in its own words. A fifth condition fails loudly at the fixture instead
of quietly downgrading thirteen audits.

Proven the way everything here is proven: a fifth condition was injected and the
fixture printed it back by name.

**AND AN EDIT TO `supabase/applied.mjs` IS ANCHORED ON THE ARRAY NAME, NEVER ON
A BRACKET.** Operator ruling, 2026-09-13, recorded as another instance of the
matcher whose window reached into its neighbour.

A patch adding the 0043 entry found the last `];` in the file and inserted
before it. That bracket belongs to `BEHAVIOUR_DIVERGENCE`, not to `APPLIED`. The
module parsed cleanly, loaded cleanly, and was wrong: `schema-ledger-audit`
reported 43 of 44 compared and named 0043 as having no entry.

It is the same defect as the eight line window that reached into the next query
block, and the answer is the same one: **locate by the thing you mean, not by
the nearest punctuation that resembles it.** Find `export const APPLIED = [`,
then the first `\n];` after it.

**MERGED AND APPLIED ARE DIFFERENT FACTS, AND THE SECOND ONE IS DECLARED.**
`supabase/applied.mjs` is the ledger: one entry per migration saying whether
production has it, the fingerprint after it, and what it uniquely puts in the
schema. It is the same declared inventory idiom as `scripts/lib/surfaces.mjs`
and it exists for the same reason, which is that a list nothing reads is a list
that stops being true without telling anybody.

Two checks read it, and they answer different questions:

| | Asks | Needs |
| --- | --- | --- |
| `schema-ledger-audit` | Was somebody ASKED whether production has this? | Nothing. It runs in the suite. |
| `production-schema-check` | Does production HAVE it? | The production key, so it is run by hand. |

The first is the one that catches what actually happened, because the September
failure was not a wrong answer, it was a question nobody was made to answer. It
fails when a migration has no ledger entry, when an entry names no real file,
when a pending entry gives no reason, when a ledger fingerprint disagrees with a
real replay, and above all **when a migration is reachable from `main` and the
ledger says production does not have it.** A migration on a feature branch may
be pending; a migration on main may not be, because merging is the moment the
decision stops being deferrable.

The second cannot recompute the fingerprint, because PostgREST does not expose
`information_schema`, and it does not pretend to. Instead every entry declares
what its migration uniquely adds, a table, a column, or a row, and it asks the
database about all of them. That catches a MISSING migration and names which
one; it would not catch a column altered by hand, and it says so and prints the
manual query rather than implying otherwise. **Run it after any merge carrying a
migration:**

```
ALLOW_PRODUCTION_DB=1 npx tsx scripts/production-schema-check.mjs
```

**The fingerprint is now also checked without either database.**
`scripts/migration-audit.mjs` replays every migration into an in process Postgres
and asserts the result equals the figure above. It exists because 0001 spent a
month unable to apply to an empty database while both live projects held the
objects it failed to create: comparing the two projects to each other could never
have caught that, because they were both right and the FILES were wrong.

**roles-audit runs against development only, and no flag overrides that.** Operator
ruling, 2026-09-02. It creates accounts, signs them in, and deletes them; the
deletions are verified but the audit trail rows their sign ins produce are
permanent, because that table refuses deletes by design. One production run would
seed the firm's regulatory memory with probe events forever. The rule is carried
by `neverProduction` in `scripts/lib/db-target.mjs`, checked before
`ALLOW_PRODUCTION_DB` is even read, and asserted by `db-guard-audit`.

**Against production, run only `security-audit` and `db-guard-audit`.** Neither
writes anything. Everything else that touches a database goes to development.

**A RUN MAY DELETE ROWS IT CREATED ITSELF, ON DEVELOPMENT, AS FIXTURE TEARDOWN.
NOTHING ELSE.** Operator ruling, 2026-09-10, replacing a limit that had been
written as "never delete any row on any database".

That wording could not be obeyed and followed at the same time. The board itself
deletes rows on every run: `roles-audit`, `native-audit` and `contrast-audit`
each create probe accounts and remove them, and the removal is the point, because
a probe left behind is a live account on a database. A rule that forbids running
the board cannot be the rule.

So the permission is exactly as wide as the practice that already exists, and
no wider:

| Allowed | A run removing rows IT created, on development, as teardown. `destroyProbes` is the model: it sweeps the whole probe domain rather than only the ids it made, so a crashed earlier run is cleaned up too. |
| Not allowed | Anything on production. Anything a person created. Anything on an append only table, which is most of this schema and all of the regulatory and financial ones. Any row a run did not create. |

The five tables that are deliberately NOT append only, `eng_jobs`,
`eng_cron_runs`, `eng_error_events`, `eng_metrics_daily` and `eng_alert_state`,
are telemetry about the machine rather than a regulatory or financial fact, and
are the only place this permission has room to operate. Everything else refuses
DELETE at the database and will go on refusing it.

**The reason this is a ruling and not a reprimand.** An overnight run wrote a
load test that enqueued 200 jobs and removed them in teardown, judged that to be
within the spirit of a limit worded absolutely, did it, and then said so plainly
in its report under a heading naming it a confession. The judgement was right.
Disclosing it was more right, and it is what turned a rule nobody could follow
into one that says what it means.

**A preview deployment must be pointed at development, and the app now refuses
if it is not.** Vercel previews inherit the Preview environment, and adding a
variable to a Vercel project defaults to All Environments, so a preview silently
inherits production unless somebody scopes it. That happened on 2026-09-03: a
preview of an unmerged branch was pushed for the operator to walk, their sign in
attempt landed in PRODUCTION's audit trail, and it is still there because that
table refuses deletes.

`previewPointingAtProduction()` in `src/lib/db-guard.ts` is the application's
equivalent of `db-target.mjs`. `supabaseAdmin()` and `supabaseCredentialCheck()`
throw rather than returning null, because an unconfigured deployment can do
nothing while a mispointed one can do everything to the wrong database, and the
portal root layout renders an explanation instead of a stack trace.

It fires on exactly one combination, preview plus the production ref, and
`db-guard-audit` asserts the negative cases harder than the positive one:
production itself, a local machine, a Vercel development deployment and a
preview on dev are all untouched. A guard that could misfire on production would
be a worse defect than the hole it closes.

`ALLOW_PRODUCTION_PREVIEW=1` is the way past it, spelled exactly as
`ALLOW_PRODUCTION_DB` is, and is almost never the right answer.

**Seeding the first administrator is the one thing that legitimately runs against
production**, and it is expected to be run as
`ALLOW_PRODUCTION_DB=1 npx tsx scripts/seed-admin.mjs "Name" email`. The friction
is deliberate.

**`seed-field-demo` carries the same `neverProduction` standing as roles-audit.**
It writes technicians, coverage, a protocol and files that dispatch reads. One
production run would put three people who do not exist into the roster and into
every future dispatch plan, and the audit rows it produces cannot be deleted.
Everything it writes is obviously fake by design: Demo names, example.com
addresses, and streets that do not exist. It prints a known development password
for those accounts, which is safe only because of the guard around it; if that
guard is ever weakened, the printed password becomes a real credential and has
to go with it.

**`scripts/lib/db-target.mjs` loads `.env.local`.** Every script that opens a
connection therefore reads the same credentials the dev server does. forms-audit
recorded this defect once already: an audit that decides what the database can do
by reading its own environment, while the server it is testing reads
`.env.local`, is an audit measuring a different system, and it passed every run
while writing nothing.

## 6c. Business rulings that live in two places, on purpose

Four constants are decisions the operator made rather than numbers somebody
tuned. Each is stated in the code AND pinned as a literal in the audit that
covers it, so changing one costs two edits made deliberately. If you are here
because an audit just failed on one of these, the audit is not wrong: it is
asking whether you meant it.

| Ruling | Value | Declared in | Pinned in |
| --- | --- | --- | --- |
| Checkout session window | **24 hours** | `src/lib/order-attention.ts` | `scripts/order-audit.mjs` |
| Partner attribution window | **90 days** | `src/lib/attribution-rules.ts` | `scripts/partner-audit.mjs` |
| Alerts per sweep | **3** | `src/lib/alert-rules.ts` | `scripts/observability-audit.mjs` |
| Sister intake rate | **20 a minute** | `src/lib/sister-intake.ts` | `scripts/sister-intake-audit.mjs` |
| TOTP digits and period | **6 digits, 30 seconds** | `src/lib/totp.ts` | `scripts/proofs/totp-matches-the-rfc.mjs` |
| Telemetry retention floor | **30 days** | `src/lib/retention-policy.ts` | `scripts/retention-audit.mjs` |
| Tables retention may delete from | **`eng_cron_runs`, `eng_jobs`** | `src/lib/retention-policy.ts` | `scripts/retention-audit.mjs` |

The last two joined on 2026-09-09, and retention is the sharpest case this
table has. Every other ruling here costs money or locks somebody out, and both
are recoverable by reading a record. A floor moved from thirty days to one, or a
third table quietly added to the deletable set, destroys the record itself, and
no later audit can tell a deleted row from a row that never existed.
retention-audit also pins the operator kept-forever list, which is the same
mechanism applied to the tables no configuration may shorten.

They were pinned on 2026-09-08 after a survey of all 47 audit and proof
scripts found each of them written in terms of its own constant on both sides
of the assertion. Every one proved its edge was sharp and none could see the
edge move: the partner window could have gone from ninety days to a hundred
and eighty, changing what the firm pays partners, with the board green
throughout. The TOTP pair was the sharpest, because advertising eight digits
in the QR while the generator emits six locks out every already enrolled
account at their next sign in, on a phone that is working perfectly.

**AND A BOARD IS BLOCKED BY A FINDING ON THE BRANCH, NEVER BY AN AUDIT THAT
COULD NOT MEASURE SOMETHING THE BRANCH DID NOT TOUCH.** Operator ruling,
2026-09-17, the first time "not green" meant "could not measure" rather than
"found something".

`feat/roof-protocol`'s first board returned **53 of 55 passed and not one FAIL
line of any kind**. The two that could not measure, `mobile-overflow-audit` and
`native-audit`, were both blocked by `/portal/accounts` exceeding a 45 second
navigation timeout at 360, 390 and desktop, with zero connection refusals. That
screen takes fifty seconds of application code to render, is recorded in
`BACKLOG.md` with the server's own log as evidence, **is on main already**, and
has nothing to do with the branch.

**So the question to ask of a board that is not green is WHICH KIND of not
green.** A finding on the branch stops the branch. An audit that could not
measure something the branch never touched stops nothing, because every branch
will fail it identically until the underlying defect is fixed, and holding work
behind it buys nothing.

**The two are told apart by reading, not by the exit code.** Both leave the
suite non zero. One prints `FAIL` with a check name; the other prints
`COULD NOT TELL` with a route and a reason. `unreachable is not failed` is the
same idea one level down, at a single audit; this is it at the board.

**What the rule does NOT license.** Absorbing a could-not-measure. It is
recorded, it names the screen, and the underlying defect keeps its backlog entry
until somebody rules on it. What changes is only whether it holds a merge.

**AND WHEN IT COMES BACK FOR A RULING, IT COMES WITH A MEASUREMENT.** Same
ruling. `accountRows()` paging every service order belonging to any account is a
plausible cause **nobody has profiled**, and a screen whose figures are billed
on does not get a decision made on a guess. The hypothesis is recorded as a
hypothesis; the ruling waits for the profile.

**AND THE SAME DAY, THE SAME CODE, MEASURED FINE. THE STALL IS INTERMITTENT
RATHER THAN DETERMINISTIC, WHICH CHANGES WHAT A PROFILE HAS TO DO.** Operator
ruling, 2026-09-17, hours after the paragraph above was written.

`overnight/2026-09-15` merged into main as `62a1b63`, carrying 38 commits and
not one line touching that screen. The board on main then returned **54 of 54**,
and both audits that had been unable to measure `/portal/accounts` measured it:
`mobile-overflow-audit` across 226 route and width combinations,
`native-audit` at 514 checks, with the screen appearing in `native-audit`'s own
per route table reading document overflow 0px and tables 0. **Nothing was
fixed between the two runs.**

So both readings stand and neither cancels the other. The fifty seconds of
application time on the branch run was real and was read off the server's own
log. What is now known is that it does not happen every time.

**The consequence is for the profile, and it is the whole reason this is
recorded rather than shrugged at.** A deterministic stall can be profiled by
opening the screen and watching, and the instrument can be attached after the
symptom is seen. An intermittent one cannot: the instrumentation has to already
be running when a stall arrives, because the run that stalls is not the run
somebody chose. **A profile of a healthy render is not evidence about a stall,
and it reads exactly like one.** The candidate causes widen with it, from the
query alone to anything carrying state between runs.

**AND A PREDICTION STATED IN ADVANCE AND FALSIFIED IS WORTH MORE THAN ONE THAT
HOLDS.** Operator ruling, same day, and it is the mechanism that found the
paragraph above rather than a remark about it.

The board on main was predicted, in writing, before it ran: 52 of 54, zero FAIL
lines, those two blocked. It came back 54 of 54. **The falsified half is the
only part of that exchange that carried information.** Had the prediction held,
it would have confirmed something already believed and taught nothing.

**What matters is that without the prediction there was nothing to falsify.** A
board returning 54 of 54 reads as a green board, and a green board invites no
questions at all. The intermittency was findable only because a specific
different result had been written down first and the difference had to be
accounted for. So: **say what the run will do before running it, in terms
specific enough to be wrong**, and when it is wrong, the gap is the finding.
A prediction offered only after the result is not a prediction.

**UNREACHABLE IS NOT FAILED.** Operator ruling, 2026-09-08. An audit whose
live half cannot run because no server is answering reports a third verdict,
`COULD NOT TELL`, and exits zero. It is the same three way answer the perf
gate uses, and for the same reason: a red mark everyone learns to ignore is
where the next real failure hides.

It still says loudly that the live half did not run, because a green board
over a half that never happened is the other way to lie.

Inside `npm run audit` this rarely arises: the runner starts its own server and
prints `THE SUITE DID NOT RUN TO COMPLETION` rather than a list of content
failures. The verdict matters for a STANDALONE run, which is how these are
usually run while working on one of them. `sister-intake-audit` carries it;
the audits that still fail red standalone are listed in `BACKLOG.md`.

## 7. Session mechanics

- Feature branches. No force pushes to main. Merges only on the operator's word.
- **Read the branch off git before every merge, never off the session context.**
  Operator ruling, 2026-09-09. The branch name a session is given at startup is a
  snapshot, and a long session outlives it: on 2026-09-09 the work was on
  `feat/reporting` while the startup status still said
  `feat/mfa-optional-default`, and `git merge` on the stale name answered
  "Already up to date" and changed nothing. It was harmless by luck. The same
  mistake against a branch that HAD moved would have merged the wrong work onto
  main and reported success. `git branch --show-current` costs nothing.
- Commit coherent work immediately. One session per repo directory at a time.
- Report and stop at every workstream end.
- Screenshots at 390 and 1280, looked at by you, before reporting anything as done.
- **EVERY GATE REPORT INCLUDES AT LEAST ONE REAL ARTEFACT READ AS A PERSON WOULD
  READ IT, AND SAYS WHAT IT FOUND OR THAT IT FOUND NOTHING.** Operator ruling,
  2026-09-09. An export opened and read line by line. An email received in an
  inbox. A page looked at. Not a check that passed about the artefact: the
  artefact.

  **The harness catches what it is pointed at; reading catches the rest.** Phase
  12 Section 2 is the evidence. Nine defects were found in one pass and FOUR of
  them came from reading output rather than code, every one of them past a green
  board:

  - a sales tile counting a seeded client, found in a screenshot
  - an export whose manifest said "Real records only" above eighteen
    demonstration rows, found by opening the CSV
  - the administrator's margin and revenue, $175.00 and $450.00 of it entirely
    seeded files, found in a screenshot
  - amounts written in cents, so a $675.00 refund would have reached an
    accountant's spreadsheet as 67500, found in the same CSV

  Two of those were sitting behind checks that had just been widened to look
  straight at them. The harness was not wrong; it was answering the question it
  had been asked. Reading is how the unasked question gets asked.

  A report that names no artefact is a report written from the board, and the
  board is exactly the thing that cannot see this class of defect.

  **AND AN ACCESS REVIEW THAT UNDERSTATES ACCESS IS WORSE THAN ONE THAT OMITS
  IT, BECAUSE THE READER BELIEVES THEY HAVE LOOKED.** Operator ruling,
  2026-09-12, from Phase 12 Section 6.

  The generated access review reported `Grants 0` and an empty Permissions
  column for every customer and partner. Both figures were correct: those
  principals hold no rows in `eng_role_grants`. What a reader takes from a zero
  in a Permissions column is that the account can do nothing, and a customer can
  see their own orders and a partner their own earnings, scoped by ownership in
  `customer-auth.ts` and `partner-auth.ts` rather than by a grant.

  Every check was asking whether the number was right. None was asking what a
  reader would take it to mean. It was found by opening the CSV.

  The report says "not role based" now, with the scope written out. The general
  form belongs beside the other entries in this list: **a figure can be
  arithmetically correct and still be a false statement about the thing it
  describes**, and only reading the artefact as its audience would read it finds
  that.

  **A COMPLIANCE SENTENCE HARDCODED ANYWHERE IS THE DEFECT.** Operator ruling,
  2026-09-12, recorded under this rule because it is what the rule caught.

  The portal sidebar carried the words "Firm registration pending with TBPELS.
  No engineer of record is yet in responsible charge." as a literal. TBPELS
  issued F-29811 on 2026-09-10 and that sentence went on saying pending, to the
  firm's own staff, for a day. Every check that renders that layout was green,
  and all of them were right: none of them asked whether the sentence was TRUE.
  It was found by opening a screenshot of the launch screen and reading the rail
  beside it.

  `registrationLine()` is the one answer, and it is what the public footer,
  every email footer and now the portal rail render. `compliance-audit` asserts
  the rail renders it and carries no sentence of its own, so it cannot come
  back. The fix shipped on `feat/launch-readiness`.

  The general form, which is the same one section 6b makes about the ledger and
  section 6 makes about declared inventories: **a fact with two accounts has two
  accounts that will disagree, and the copy is always the one nobody updates.**

  **FOURTH INSTANCE IN A FORTNIGHT, 2026-09-16, AND IT IS NOW THE MOST
  FREQUENTLY RECURRING DEFECT IN THIS BUILD.** Operator ruling, recorded as a
  count rather than as a fourth story, because the answer has been identical
  every time.

  | | The fact | Its two homes | The one home now |
  | --- | --- | --- | --- |
  | 2026-09-10 | The firm registration number | `TBPELS_FIRM_NUMBER` and the register | `verifiedFirmRegistrations` |
  | 2026-09-12 | The portal's compliance sentence | A literal in the sidebar and `registrationLine()` | `registrationLine()` |
  | 2026-09-14 | The firm's telephone number | `contact.phone` raw in `schema.tsx` and the derivers | `e164Phone()` |
  | 2026-09-15 | The firm's name | A literal in twenty rendered sentences and the register | `firmName()` |
  | 2026-09-16 | The PE licence number | `TBPELS_PE_LICENSE` and the register | `verifiedEngineers` |

  **THE 2026-09-16 ONE IS THE INSTRUCTIVE ONE, because the defect was dormant
  and became live without anybody touching the code.** `peInResponsibleCharge()`
  had read `TBPELS_PE_LICENSE` since it was written, and that was harmless for
  as long as the register was EMPTY: one home held nothing, so two homes could
  not disagree. The moment a real licence number was recorded, the second home
  existed and the two could differ between a build and a deployment.

  **So the question to ask is not only "does this fact have two homes today".**
  It is "will it, the first time somebody fills in the empty one". A register
  with nothing in it hides this defect perfectly.

  The answer each time: one home, a deriver that reads it, and a check that
  refuses the second home coming back. Here `activeEngineer()` mirrors
  `activeFirmRegistration()` exactly, the variable is recorded as retired with
  its date and reason, and `compliance-audit` fails on any source under `src`
  that reads the name again. Injection-verified by putting the variable back:
  that check went red naming the file.

  **AND AN UNKNOWN IS NOT A PASS.** `expires: null` on an engineer means nobody
  has recorded the date, which is a different state from current, and
  `activeEngineer()` refuses it. Sealing rests on that licence being active, so
  the unknown answer is the shut one. The register had carried no expiry for an
  engineer at all until this ruling, while a firm registration has always had
  one, which meant a PE whose licence lapsed years ago would have sat there with
  nothing noticing.

  **THE SAME SHAPE WITH THE FAILURE INVERTED, 2026-09-14, AND THE INVERSION IS
  THE PART WORTH KEEPING.** Operator ruling, recorded as an instance of the rule
  above.

  `src/config/contact.ts` has always said the firm's telephone number is stored
  in E.164 and that "display formatting is derived, never stored, so the two
  cannot drift". Every consumer honoured that except one: `schema.tsx` emitted
  `contact.phone` RAW into the JSON-LD `telephone` property.

  So when `FIRM_PHONE` was first set to `(281) 940-4490`, a display string, the
  site rendered `(281) 940-4490`, the `tel:` links dialled `+12819404490`, and
  the launch gate passed. **Every human-readable surface was correct**, because
  `displayPhone` and `telHref` both strip and rebuild. The structured data
  published to every machine that reads the page was a display string.

  **The portal sidebar case was found by opening a screenshot. This one could not
  have been**, and that is the inversion: there the human copy was stale and a
  person could see it; here the human copy is right and **the machine-readable
  copy is wrong, and nobody reads JSON-LD by eye.** A fact with two accounts has
  two accounts that will disagree, and the one that drifts is whichever nobody
  looks at, which is not always the one a screenshot would show.

  Fixed by `e164Phone()` in `contact.ts`, which derives like its two siblings,
  and by `schema.tsx` calling it. Two checks in `seo-audit`, both
  injection-verified by reverting the fix and rebuilding: the RENDERED one
  asserts every JSON-LD `telephone` matches E.164, and a SOURCE guard asserts
  that `contact.phone` is read only in `contact.ts`, where the derivers live, and
  in `launch.ts`, whose job is judging the raw value. The second is a stated
  PROXY: "emits the raw value" is the property that matters and is not
  mechanically detectable, since `telHref` reads it raw and is correct.
- Completion claims verified from disk and from the running app, not from intent.
- Judgment calls disclosed in the report, not buried.
- **The confession rule: a completion report that is not true is the one unforgivable failure
  class.** If something did not work, or was skipped, or is uncertain, the report says so plainly.
- **`BACKLOG.md` is the INDEX of every known and undone thing.** An item may keep its full
  reasoning in whatever document that reasoning belongs to, and several do: the messaging
  capabilities in `docs/messaging-section-3.md`, the native standard's unasserted half in
  `docs/PORTAL_DESIGN_STANDARDS.md`, the observability deferrals in `docs/platform-state.md`. What
  an item may NOT do is exist only there. It gets a pointer entry in `BACKLOG.md` naming what it is,
  why it is not built, and where the reasoning lives, and the pointer is not a second copy of the
  reasoning, because two accounts of one decision are two accounts that will disagree.

  This rule is written down because the file broke it. On 2026-09-06 seven items the operator could
  name from memory were absent, and a sweep then found five of the eight documents carrying open
  work were never named in it at all. `scripts/backlog-audit.mjs` enforces it now: a document under
  `docs/` that carries open work and is not named in `BACKLOG.md` fails the suite.

## 8. Content engine

Two phases, always. Phase 1 is research and it **stops for operator approval**: one batched Ahrefs
pull with the expected unit cost stated before the call, minimal columns, plus free SERP review,
delivered as a proposal table with volume, difficulty, what ranks today, why it is beatable, a
cannibalization check against this site and the registry, and the internal link plan. Phase 2 is
writing, and only after approval.

Internal linking: contextual means in prose, at a point where a reader would want the link. If a
sentence has to be written to carry a link, the link is not placed; drop it and report the drop.
Descriptive anchors, never "click here" or "learn more". No anchor phrasing repeated more than twice
at the same target. Roughly three new contextual links per source page per pass. Measure with
`link-map` before and after.
