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
npm run build && npx next start -p 3225      # one terminal
AUDIT_KILL_STALE=1 npm run audit             # another
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

The build race guard (`prebuild`, and the `pre` hook on every audit) refuses to build under a live
server and performs a BUILD_ID handshake so an audit can never score a stale artifact.

## 7. Session mechanics

- Feature branches. No force pushes to main. Merges only on the operator's word.
- Commit coherent work immediately. One session per repo directory at a time.
- Report and stop at every workstream end.
- Screenshots at 390 and 1280, looked at by you, before reporting anything as done.
- Completion claims verified from disk and from the running app, not from intent.
- Judgment calls disclosed in the report, not buried.
- **The confession rule: a completion report that is not true is the one unforgivable failure
  class.** If something did not work, or was skipped, or is uncertain, the report says so plainly.
- `BACKLOG.md` carries every known and undone thing, with the reason and the incident that produced
  it.

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
