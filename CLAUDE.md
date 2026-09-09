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

**A FIXTURE THAT CANNOT SEPARATE THE TWO ANSWERS PROVES NEITHER.** Recorded
2026-09-09. The first attempt at proving the credit gate used twelve $100 orders
against a $500 limit, and the truncated exposure landed exactly ON the limit, so
the old shape and the new shape both refused and the run reported nothing. The
fixture was wrong rather than the code. Moving the limit to $800, between the
truncated $500 and the true $1,200, made the difference visible: granted against
refused.

**AND A MATCHER WITH A WINDOW WIDER THAN THE THING IT MATCHES ATTACHES TO ITS
NEIGHBOUR.** Same day, same section, in the patch script written to document all
of this. It searched an eight line window for a table name to decide which query
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
