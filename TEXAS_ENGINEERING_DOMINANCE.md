# THE TEXAS ENGINEERING WEB DOMINANCE MASTER PROMPT
## The complete, battle-tested playbook from wattsmithelectric.com, adapted for 254 Engineering Services, Sealed Engineering, and StampMyPlans
## Hand this to any Claude Code session working on any of the three engineering sites. It is standing law plus strategy. Read all of it before writing anything.

---

# PART 0: WHAT THIS IS AND WHY IT WORKS

This document encodes everything that built wattsmithelectric.com from zero to a 210-URL site with a perfect independent crawl (Ahrefs health 100, zero errors), Lighthouse 100 accessibility and SEO on every sampled page, 46 research-justified articles, full structured data coverage, and an audit culture that caught its own lies twice before they shipped. Every rule below exists because it was proven or because its absence was punished. The mission for the engineering brands is bigger: statewide coverage, 254 counties plus cities, three brands, number one positions, and a monthly organic lead engine. The methodology transfers. The shortcuts do not exist.

Two truths govern everything and are repeated because they are load bearing:

1. **Honesty is the ranking strategy, not a constraint on it.** Every fabricated statistic, fake review, invented service area, or premature claim is a landmine under the exact authority you are trying to build. The most trustworthy page on the internet for a query wins that query. Build that page.
2. **Nothing ships unmeasured.** Every surface goes inside an audit harness, every harness is verified by injection before it is trusted, and every completion claim is verified from disk and from a running app. A check that passes while looking at the wrong thing is the number one recurring defect class. Hunt it.

---

# PART 1: REGULATORY HONESTY FOR ENGINEERING (READ FIRST, IT GATES EVERYTHING)

The electrical playbook had one license gate (TECL rendered as "TECL #PENDING" until real). Engineering in Texas is more regulated, not less, and the equivalent gates are:

1. **TBPELS firm registration.** A firm may not offer or perform engineering services in Texas without a firm registration from the Texas Board of Professional Engineers and Land Surveyors. Until each brand's firm registration is issued, the sites operate in prelaunch mode: they may describe the intended services, publish educational content, and collect interest, but every service page carries the honest pending status the same way Wattsmith carried TECL #PENDING, and nothing states or implies that engineering services are currently offered. On issuance, one find-and-replace turns the sites on.
2. **The PE.** Sealing and stamping requires a licensed Professional Engineer. Until the PE hire is real, no page claims stamped deliverables are available, no turnaround promises for sealed work, no "our engineers" plural fiction. The pending state is stated plainly and converts to real on hire, exactly like the master electrician pattern.
3. **Regulated vocabulary.** "Engineer," "engineering," and "sealed/stamped" are regulated terms in Texas. Copy must never let an unlicensed present-tense claim slip through. The voice audit gains a regulatory phrase check: flag present-tense service claims ("we seal," "we provide engineering") anywhere the pending gate is active.
4. **No fabricated credentials, ever.** No invented PE names, license numbers, project counts, years of experience, or client examples. The placeholder audit enforces this mechanically; the writer enforces it first.

---

# PART 2: THE THREE-BRAND PROBLEM (SOLVE THIS BEFORE BUILDING, OR GOOGLE SOLVES IT FOR YOU)

Three sites owned by one operator targeting the same Texas engineering keywords is, to a search engine, indistinguishable from a doorway network unless each brand has a genuinely distinct identity, audience, and content corpus. Duplicate or near-duplicate content across the three domains will cause Google to pick one canonical winner and suppress the rest, wasting two-thirds of the build. The rule set:

1. **Assign each brand a distinct positioning and primary audience before any page is written**, and hold the line. The natural split for this portfolio: one brand as the statewide institutional flag (the full-service firm identity, commercial and municipal audience), one as the contractor and builder-facing rapid plan-review and stamping service (speed and process positioning), one as the homeowner and small-project consumer brand (permits, additions, foundation letters, windstorm certificates). Confirm the assignment with the operator before writing, then every keyword is owned by exactly one brand.
2. **Keyword ownership map.** Maintain a shared keyword registry (a data file in each repo or a shared doc) recording which brand owns which head terms and clusters. Before any content phase on any brand, check the registry. Two brands never target the same primary keyword. Ever.
3. **No shared copy.** Templates and engineering patterns may be shared across repos; rendered sentences may not. Every page on every brand is written fresh in that brand's voice.
4. **Cross-linking between the brands is allowed sparingly and honestly** (a "part of the same family" note where true), never as a link scheme, never sitewide-footer reciprocal blasting.
5. **Distinct design registers.** Three sites that look alike read as a network. Each gets its own design system pass (see Part 6).

---

# PART 3: SITE ARCHITECTURE (THE WATTSMITH GEO ENGINE, SCALED CORRECTLY)

## 3.1 Stack and conventions
Next.js App Router, TypeScript strict, Tailwind, static generation. All pages generated from data files: services, counties, cities, combos are configuration, not hand-built pages. Repo conventions: feature branches, no force pushes to main, commit coherent work immediately, merges only on the operator's word, CLAUDE.md at repo root as standing law (write one for each repo from this document's rules), BACKLOG.md with incident-and-reason entries, one session per repo directory at a time.

## 3.2 The geo system, and the doorway-page line at 254-county scale
Wattsmith ran services x cities honestly because every page served a real local search. At 254 counties plus hundreds of cities, the doorway-page risk is the single biggest strategic danger in this whole mission. The rule that keeps programmatic geo pages legitimate: **every geo page must contain substantial information that is true of that place specifically and useful to a person there, which could not be produced by find-and-replacing the place name.** For Texas engineering, that unique substance genuinely exists per county, and the build must actually use it:

- The permitting authority and its real name (county development services, city building department), and whether unincorporated areas require permits at all, which varies and is exactly what searchers want to know.
- Windstorm requirements: the 14 TWIA-designated coastal counties have WPI-8 windstorm certification requirements that inland counties do not. This single fact creates two legitimately different page templates.
- Flood zones and elevation certificate demand, foundation and soil conditions by region (expansive clay belts versus sand versus rock), seismic non-issues, local code adoptions and amendments where determinable.
- The county's actual cities list, linking city pages only where city-level content earns existence.

Build order for geo: metro and major-county pages first with the deepest content, then the long tail in tiers, verifying facts per county from primary sources during writing or generalizing honestly. A county page that cannot say anything true and specific about that county does not ship until it can. The statewide claim itself is honest for this business model, plan review and sealing is genuinely deliverable remotely to all 254 counties, which is an advantage the electrical business never had. Say so plainly on a statewide service-area page.

## 3.3 The page taxonomy per brand
- Service pages: one per real service (residential plan review, structural letters, foundation certification, windstorm certification, sealed engineering letters, commercial plan stamping, whatever the brand's assigned menu is). Deep, definitive, the money pages.
- Geo pages: /counties/[county] and /cities/[city] per the doorway rules above, plus service-plus-geo combos ONLY where search demand and unique substance both exist. Do not mint 254 x services combos mechanically; that is the doorway trap.
- A statewide hub page (the /san-antonio metro-hub pattern generalized): the flagship "engineering services across Texas" page, built to own the head term.
- Educational corpus: the blog/insights engine per Part 5.
- Trust pages: about, process, licensing (the honest pending status lives here too), contact, FAQ.
- Careers if hiring PEs: replicate the Wattsmith careers engine, JobPosting schema on genuinely open roles only, real validThrough dates, statewide-honest framing.

## 3.4 Technical SEO baseline (all proven, all mandatory)
- Metadata: titles 50 to 60 chars, keyword front-loaded, brand-pipe suffix; descriptions 140 to 160 with a call to action; zero duplicate titles or descriptions sitewide, enforced by audit.
- Schema graph: Organization and WebSite (name set so the SERP shows the brand, not the domain), ProfessionalService or the closest honest type, BreadcrumbList sitewide, FAQPage blocks where real questions exist, BlogPosting/Article on posts, JobPosting only for real openings. hasReviews false pattern: no review or rating markup anywhere until real third-party reviews exist.
- Canonicals on the apex, www 308-redirected to apex at the platform level, og:site_name and og:url aligned with the serving host, verified against the LIVE domain after deploy, not the build.
- Sitemap generated from the route list, lastModified emitted only where a true per-page date exists (post publish/modified dates), omitted elsewhere. Never a build timestamp, never a constant.
- robots permitting AI crawlers; llms.txt and llms-full.txt published.
- Search Console property per domain from day one, sitemap submitted, homepage indexing requested at launch and at any site-name change.

---

# PART 4: THE AUDIT CULTURE (NON-NEGOTIABLE, THIS IS WHY THE QUALITY HOLDS)

Port the complete Wattsmith harness pattern into each repo and verify every audit by injecting a violation and watching it fail before trusting a single green:

1. **seo-audit**: titles, descriptions, duplicates, canonical, og tags, schema presence per template.
2. **placeholder-audit**: crawls rendered output for 555 numbers, lorem, TODO/TBD/FIXME, off-domain emails, wrong phone numbers, and (new for engineering) any PE name, license number, or firm registration number that is not in the verified config. Allowlist the honest pending markers.
3. **voice-audit**: the banned-phrase list (unlock, elevate, seamless, journey, empower, passionate, top-notch, hassle-free, one-stop, cutting-edge, state-of-the-art, look no further, in today's, when it comes to, we've got you covered, rest assured, not only X but also Y) plus structural tells: uniform paragraph rhythm, stacked rhetorical triads, question-heading density above roughly 40 percent, bolded listicle lead-ins where prose carries. PLUS the regulatory check from Part 1. Shared list between site copy and email templates so the two surfaces cannot disagree.
4. **contrast-audit and mobile-audit**: WCAG AA floor, every template including private and admin routes, 390 and 1280, seeded stub data for anything auth-gated. The unmeasured surface is where 205 failures hid last time.
5. **forms-audit**: every input, every state, no silent failures, no false success, verified against stand-ins.
6. **cta-audit**: a primary conversion path present on every route.
7. **email-audit**: every outbound template rendered and checked for voice, absolute production links, font stack, plaintext part, 375px rendering.
8. **Build race guard**: prebuild and preaudit hooks refusing to build under a live server and BUILD_ID handshake so audits never score a stale artifact. This failure burned three sessions on Wattsmith; install the guard on day one.
9. **link-map tool**: contextual-versus-template inbound link counts per page, because Search Console cannot distinguish them.

Session mechanics: report-and-stop at every workstream end, screenshots at 390 and 1280 self-reviewed before reporting, completion claims verified from disk, disclosed judgment calls, and the standing confession rule: a completion report that is not true is the one unforgivable failure class.

---

# PART 5: THE CONTENT ENGINE (THE PART THAT ACTUALLY WINS RANKINGS)

The methodology that produced 46 articles that outrank on merit:

## 5.1 Two-phase discipline, always
**Phase 1, research, stop for operator approval.** One batched Ahrefs pull (respect the unit budget: state expected cost before calls, batch everything, minimal columns, stay under the stated session cap) for the keyword space, combined with free SERP review. Select targets where the current results are beatable: thin national content, forums, outdated pages, no Texas specificity. Deliver a proposal table: title, primary and secondary keywords, volume and difficulty, what ranks today and why it is beatable, cannibalization check against every existing page on THIS brand and against the cross-brand keyword registry, and the internal link plan per post. THEN STOP. **Phase 2, write, only after approval.**

## 5.2 The writing gates, absolute
- Every technical claim verified against a primary source during writing (TBPELS rules, IBC/IRC sections, TWIA windstorm requirements, county permitting pages, FEMA flood documentation) or stated generally without invented specifics. When a commonly repeated number cannot be traced to a primary source, name it as unverifiable rather than repeating it, that pattern produced the single most linkable page on the last build.
- Zero invented statistics, anecdotes, client stories, project examples, or costs. Salary or fee content only with cited, linked public data.
- Substantive length earned by content, never padding. Operator voice: direct, declarative, specific, an expert explaining plainly. FAQ blocks only where the questions are real.
- Full metadata, BlogPosting schema, breadcrumbs, real sitemap dates, and dense reader-first interlinking per 5.3.

## 5.3 Internal linking law (learned the hard way)
- Tier-weight deliberately: money pages and the statewide hub receive the most contextual inbound; legal pages receive none.
- Contextual means in-prose, at a point where a reader would actually want the link. If a sentence must be written to carry a link, the link is not placed. Drop rather than force, and report drops.
- Anchor discipline: descriptive anchors naming the destination topic, never "click here" or "learn more"; no anchor phrasing repeated more than twice sitewide at the same target; watch exact-match saturation, a target whose inbound anchors are 90 percent one phrase reads as manipulation, vary or stop.
- Cap roughly three new contextual links per source page per pass. Measure before and after with the link-map tool.

## 5.4 The engineering content territory (starter map, validate with research before writing)
Homeowner-brand clusters: what a sealed engineering letter is and when you need one, foundation inspection letters for real estate closings, permit requirements by county (the geo engine's editorial layer), windstorm certificates explained (WPI-8, who needs them, the 14 counties), room additions and garage conversions and what plans reviewers require, retaining walls, carports, solar structural letters. Contractor-brand clusters: plan stamping turnaround and process, what plan reviewers reject and why, deferred submittals, engineering letters versus full plan sets, city-by-city submittal quirks for the major metros. Institutional-brand clusters: the authority and thought-leadership layer. Every cluster assigned to exactly one brand per the registry.

---

# PART 6: DESIGN AND CONVERSION

- Register: extremely corporate, conventional, credible. White-dominant, restrained palette per brand, professional type, standard nav and components. Nothing that reads as designed-by-AI: no clever devices, no notices, no meta-commentary, no decorative gimmicks. If a reader would pause on an element and wonder about it, it is wrong.
- No photography unless it is real: no stock humans as staff, no stock offices, no implied projects. Type, white space, brand marks, honest diagrams. Real project photography enters only when real projects exist and clients consent.
- Mobile native: manifest, theme color, 44px targets, no hover-dependence, app-grade mobile menu with the brand mark, screenshot-judged at 390 against real native apps.
- CTAs on every route at natural decision points, honest, no urgency theater: header CTA, section CTAs on long pages, end-of-content CTAs, mobile-persistent treatment. During the prelaunch gate, CTAs collect interest honestly ("get notified," "request a callback when we launch") rather than selling services that cannot yet be sold.
- Forms: server-side inserts only, RLS closed-door pattern, honest failure states, notification emails through the shared transactional stack, attribution capture (UTM, referrer, landing path) from day one so lead sources are measurable from the first lead. Database: shared Supabase per the established pattern, eng_ prefixed tables with a site column discriminator across the three brands.
- Style laws on every rendered string: no em dashes, no en dashes, no hyphens as sentence connectors, no emojis, no AI cliche phrasing, nothing fabricated.

---

# PART 7: EXECUTION SEQUENCE (HOW TO ACTUALLY RUN THIS)

1. **Foundation workstream per repo**: scaffold or align to the stack, port and injection-verify the full audit harness including the build race guard, write the repo CLAUDE.md from this document, establish the data-file architecture for services and geo.
2. **Positioning gate**: confirm the three-brand split and keyword registry with the operator BEFORE content. This is a decision, not a default.
3. **Core pages workstream**: services, statewide hub, trust pages, all under the regulatory pending gates, full suite green, operator review on preview before merge.
4. **Geo engine workstream**: county data file researched from primary sources (permitting authorities, TWIA county list, regional soil/flood facts), tiered rollout, doorway rule enforced per page, spot-checked by the operator on the richest and the thinnest examples.
5. **Content phases**: repeating two-phase research-then-write cycles, 8 to 15 posts per phase, each phase gated on the proposal table, each batch spot-read by the operator on the three highest-risk posts.
6. **Contextual linking passes** after each content phase, link-map measured.
7. **Launch conversions**: Search Console per domain, sitemap submissions, and on TBPELS registration and PE hire, the pending-to-live find-and-replace, JobPosting activation if hiring, and the CTA language upgrade from interest to orders.
8. **Cadence forever**: content phases monthly, audits on every merge, no claim ships before its license does.

The operator reviews at every stop gate, reads the three riskiest artifacts of every batch, and gives the merge word. That human gate is not overhead; it is the reason the last build shipped zero retractions.

Build it exactly this way, and the three brands will be the most complete, most honest, most technically clean engineering sites in Texas, which is the only durable path to number one.
