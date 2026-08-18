# UPGRADE MASTER PROMPT: 254ENGINEERING.COM
## Workstream: adopt the Texas Engineering Web Dominance playbook and build the county geo engine

The site is built, live, and in prelaunch mode. This workstream upgrades it to full playbook
compliance. Read TEXAS_ENGINEERING_DOMINANCE.md in full first; it is standing law and CLAUDE.md
carries its rules into every session.

## 0. POSITIONING DECISIONS, CONFIRMED BY THE OPERATOR

The three-brand keyword split is decided. This brand owns: institutional and firm level terms, all
county level geo pages, government and municipal content, and careers. It does NOT own commercial
service terms, city geo, homeowner education, or contractor direct response terms.

Before any content is written, create the shared keyword registry per Part 2 of the playbook as
data/keyword-registry.ts in this repo, seeded with the ownership map above and every keyword
currently targeted by all three live sites (crawl the live sitemaps of sealedengineering.com and
stampmyplans.com to seed their entries). The registry file is the single source of truth and gets
copied verbatim to the other two repos at the end of this session with instructions in each
BACKLOG.md to keep them synchronized.

### Operator ruling on the service page collision

Seven of this brand's nine service pages were found targeting transactional "service plus Texas"
terms head to head with sealedengineering.com. The ruling is **rewrite, not stubs**:

- All seven repositioned as firm capability pages. Titles, H1s, descriptions, CTAs, and Service
  schema reframed for procurement and institutional evaluation rather than transactional document
  ordering.
- Keep full substantive depth. This is a reframing, not a trimming.
- Each page gains one honest contextual link to the matching sealedengineering.com service page for
  visitors who want to order.
- The registry records the transactional "service plus Texas" terms as owned by sealedengineering
  and the firm capability variants as owned by 254.

## 1. HARNESS UPGRADES (DO FIRST, INJECTION VERIFY EVERYTHING)

The repo has seo, placeholder, contrast, mobile, forms, coverage, and launch audits plus the build
race guard. Add the playbook's remaining harness, each verified by injecting a violation and
watching it fail before trusting green:

1. **voice-audit**: the full banned phrase list from playbook Part 4 item 3, the structural tells,
   PLUS the regulatory phrase check from Part 1: flag present tense service claims (we seal, we
   provide engineering, our engineers) anywhere the prelaunch gate is active. The existing
   placeholder-audit already blocks dashes and phone numbers; do not duplicate, compose.
2. **cta-audit**: a primary conversion path present on every route. In prelaunch the honest CTA is
   waitlist or notify language per the playbook.
3. **email-audit**: render every Resend template, check voice list, absolute production links,
   plaintext part, 375px rendering.
4. **link-map tool**: contextual versus template inbound link counts per page, runnable on demand,
   baseline recorded now before any linking passes.
5. **Extend placeholder-audit**: any PE name, license number, or firm registration number not
   present in a verified config file fails the build.

## 2. THE COUNTY GEO ENGINE

Build the county tier under the existing coverage hub and 8 region pages, per playbook Part 3.2,
with the doorway rule enforced absolutely: every county page must contain substantial information
true of that county specifically which could not be produced by find and replace.

Architecture:

- **data/counties.ts**: one record per county, all 254. Fields: name, region, seat, permitting
  authority name and type, unincorporated permitting stance where determinable, TWIA designated
  boolean (the 14 coastal counties), flood and elevation certificate relevance, soil belt
  classification (expansive clay, sand, rock, mixed), major cities, tier assignment.
- Routes /counties/[slug] generated from the data file. Region pages link their counties; county
  pages link up to region and across to the statewide hub.
- Two honest templates: TWIA coastal counties get the windstorm sections; inland counties do not
  fake them.

Tiered rollout:

- **Tier 1, build now with the deepest content**: the 14 TWIA coastal counties (windstorm is this
  firm's core niche) plus the 12 largest counties by population not already in that list. Roughly 26
  pages, every fact verified from a primary source during writing, with the source recorded in a
  comment in the data file.
- **Tier 2 and beyond**: scaffold the data file with all 254 records and honest nulls. A county page
  does NOT ship until its record has verified substance; the build excludes counties below the
  substance threshold and the sitemap only carries shipped pages. Record the tier plan in
  BACKLOG.md.
- **Spot check protocol**: at the end, present the operator the single richest and the single
  thinnest shipped county page for review.

## 3. CORE PAGE ALIGNMENT PASS

Audit every existing page against playbook Parts 3.4 and 6: title lengths with the brand suffix
included in the 50 to 60 count, canonical and og alignment against the live host, sitemap
lastModified only where a true date exists, JobPosting schema check on careers (real openings only,
real validThrough; the PE and field tech roles are genuinely open, so mark them up correctly),
hasReviews false pattern confirmed. Fix drift, report what drifted.

## 4. CONTENT ENGINE, PHASE 1 RESEARCH ONLY

Run playbook Part 5.1 Phase 1 for this brand's territory only (institutional and municipal clusters:
how Texas cities procure engineering services, on call engineering explained, qualifications based
selection, what a firm registration means, windstorm program authority content). One batched Ahrefs
pull, state expected unit cost before calling, minimal columns. Deliver the proposal table with
cannibalization checks against this site and the registry. THEN STOP for operator approval. Do not
write posts this session.

## 5. SESSION MECHANICS

Playbook Part 4 session rules govern: report and stop at workstream ends, screenshots at 390 and
1280 self reviewed, completion claims verified from disk and the running app, judgment calls
disclosed, the confession rule in force. Full audit suite green including the new audits before the
final report. Feature branch feat/dominance-upgrade, merge only on the operator's word.
