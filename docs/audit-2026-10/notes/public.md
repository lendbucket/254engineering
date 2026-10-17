# Public site: screen notes

Scope: the 23 public routes in `inventory.json` (surface `public`), all reached signed out with HTTP 200. No public screenshot shows the Operations portal sign in page; every capture is valid.

Screenshots read: every `__public__1280.jpg` (23 files) and `order__public__390.jpg`. The 390 captures were not read one by one: a full page at phone width scales to roughly 50 pixels wide in the viewer and the text cannot be read. Copy was confirmed against source. The overflow and tap target audits on the board cover phone layout.

**State the screenshots show.** The capture build is in TRADING mode, not prelaunch. `isPrelaunch()` (`src/lib/launch.ts:918`) is false once the three `trading` conditions are met (engineer, registration, phone), and every page renders the trading branch: "Start a project", "Start a job", present tense sealing copy, F-29811 in the footer. `isOpen()` is false, so no line is orderable. I judged the copy against trading, which is what the gate permits. Where I quote "prelaunch copy" below I mean literal sentences that never moved when the gate did.

Shared chrome on every page: the header shows "Serving all 254 Texas counties", the support email, eight nav items and "Start a job" (goes to `/order`). The footer shows the address, (281) 940-4490, 5 of 8 services, 5 of 8 regions, company links, and "254 Engineering LLC, TBPELS Firm F-29811" from `registrationLine()`. The phone is in the footer of every page, which matters for the /contact finding.

---

## / (home)
Screenshots: `home__public__1280.jpg`
1. Purpose: the front door for every buyer type: homeowner, lender, contractor, procurement officer, candidate.
2. Can do: "Start a job" (to `/order`), call, "See pricing" (to `/process`, which does publish prices), open any of 8 service cards ("Request a quote"), any region, the windstorm explainer, government, two roles, and send a "Start a Project" lead form.
3. Missing: no way to check on an existing enquiry or order, and no sign in link for customers or partners anywhere in the public chrome. A returning customer has no door except an emailed link.
4. Contradictions: the hero stat says "8 Engineering service lines" and /services says "Nine service lines". The services lede, "Sealed deliverables prepared under the responsible charge of licensed Texas Professional Engineers", is a literal (`src/app/(site)/page.tsx:72`) rather than a gate derived sentence. It renders in every mode, prelaunch included, and the plural "Engineers" claims more than the one engineer on the register. "The firm is hiring for two roles ahead of launch" (line 259) sits beside a hero comment saying the firm is trading.
5. Copy: "Counties at launch" under the form stat (line 301) is the prelaunch phrase that line 46 of HomeHero records removing from the hero rail.

## /about
Screenshots: `about__public__1280.jpg`
1. Purpose: explains the firm, the name, the operating model and ownership. Read by procurement officers and careful buyers.
2. Can do: read; link to the capability statement; Start a job; call.
3. Missing: no named engineer of record, licence number or verification link, although the register holds them and the insights tell readers to check the roster. That is a standing ruling, but it leaves the "checkable" promise with nothing to check.
4. Contradictions: the block is titled "Licensed engineers in responsible charge" (`about/page.tsx:107`) in the plural, and "Statewide remote review" says the model "lets the firm hold specialist cover". The source comment at `src/content/model-copy.ts:78` itself says "Engineers, plural, would still overstate it".
5. Copy, and it HIDES content: in "Licensed engineers in responsible charge" the sentence ends "The standard behind that division is" followed by an empty underline. The link text "responsible charge, as Texas defines it" uses `text-slate` (navy) on the navy band (`about/page.tsx:115-120`), so it cannot be seen. Defect candidate 6.

## /process
Screenshots: `process__public__1280.jpg`
1. Purpose: the five step account of how a sealed letter is produced, plus the price list. It is the destination of "See pricing".
2. Can do: read the five steps, open each service from the price table, Start a job, call.
3. Missing: no turnaround of any kind. That is deliberate, but a buyer with a closing date has nothing to plan against. No sample letter.
4. Contradictions: the page says "The price is published before you call. Fixed, before you pay" and lists $549, $795, $495, $445, $645, $549, $395 and $225 an hour. `/order` says "Every line below is quoted by the firm. Tell us what you need and we will send you a price", and the service pages show no figure at all. A reader meets "fixed and published" on one page and "we will send you a price" on the next. The roof line reads "$549" with no coastal clause, while every other surface that shows the roof price must carry "plus $75 in first tier coastal counties" as its own line (`src/lib/ordering.ts:100-102`; the hero comment says it "holds on every surface that shows it"). `/process` calls `priceSentence()` (`src/config/prices.ts:266`), which has no coastal branch. Defect candidate 4. /services shows the same process in four steps.
5. Copy: "A line opens once the engineer of record has approved its written protocol, and the firm quotes work and takes enquiries on every line today" is accurate.

## /order (chooser)
Screenshots: `order__public__1280.jpg`, `order__public__390.jpg`
1. Purpose: "What do you need?", where the header button and every Start a job lead.
2. Can do: choose one of 8 lines; each says "Request a quote" and goes to `/contact?service=<slug>`, which preselects the dropdown (`contact/page.tsx:49-50`). Call.
3. Missing: Residential and Light Commercial Design goes to the generic contact form, not to `/design-inquiry`, the purpose built brief form that asks square footage, storeys, permit state, soil report and the three disqualifying questions. No price on any row, and that is the gating choice. No indication that one line (roof) has a signed protocol and is closest to opening.
4. Contradictions: "we will send you a price" against /process "The price is published before you call" (see above). The meta description (`order/page.tsx:62-63`) says "Lines open for online ordering show the price and take the order now", and none are.
5. Copy: the H1 "What do you need?" with eight identical "Request a quote" buttons reads as a list of contact links, which is what it is today.

## /services
Screenshots: `services__public__1280.jpg`
1. Purpose: the service line index for buyers comparing lines.
2. Can do: open each line ("What it involves"), Request a quote, Start a job, call.
3. Missing: no price on the cards, though /process publishes them. No comparison of which document each audience needs.
4. Contradictions: the hero says "Nine service lines", the meta description says "Nine engineering service lines", the H2 says "Nine documents, one standard behind each", and the cards and the stat beside them show **8** (`services/page.tsx:18, 36, 54` are literals; the stat at line 61 is `services.length`). The process block is "Step 1 of 4" to "Step 4 of 4" (lines 88 to 123), while the home page says "Every job runs through the same five steps" and /process lists five. Defect candidate 2.
5. Copy: the stat label "Sealed service lines" (line 61) is the exact label the operator removed from the home hero on 2026-10-03 because "it suggests all eight can be ordered today, and one can" (`HomeHero.tsx` comment). It survives here.

## /services/[slug] (captured: /services/roof-inspections)
Screenshots: `services-__public__1280.jpg`
1. Purpose: a firm capability page per line for buyers and institutions.
2. Can do: read what it is, who orders it, what arrives, the intake questions ("What an order asks for"), regions, FAQ, related lines; Request a quote; Start a job; call.
3. Missing: no price, though /process publishes $549 for this exact line. No sample of the letter's structure. Nothing says that this line has an approved protocol, which is the fact that will make it the first to open.
4. Contradictions: the structural inspection page says "the price published for each service line covers the inspection and the sealed letter together unless the page says otherwise" (`src/content/structural-engineer.ts:240`), but this page publishes no price. The `ordering.ts:156` comment says "The service pages publish their own prices separately"; on the trading build they do not.
5. Copy: clear and honest. "The letter states observed condition only" agrees with the protocol.

## /coverage
Screenshots: `coverage__public__1280.jpg`
1. Purpose: statewide coverage, 8 regions, all 254 counties.
2. Can do: county finder, region pages, the full alphabetical list, Start a job.
3. Missing: the county finder does not say what happens next for a county (which region, then what). Acceptable.
4. Contradictions: none found. The region counts (18, 16, 65, 13, 30, 16, 55, 41) sum to 254.
5. Copy: "an audit fails the build if the regions ever stop summing" is internal engineering talk on a public page. Harmless.

## /coverage/[slug] (captured: /coverage/coastal-bend)
Screenshots: `coverage-__public__1280.jpg`
1. Purpose: regional geo page: wind, soil, permitting, emphasis services, county list.
2. Can do: read, open the emphasis services, other regions, Start a job.
3. Missing: nothing material for this template.
4. Contradictions: "All 8 service lines are available across the state" reads as orderable when none are; "offered" or "quoted" would be accurate.
5. Copy: place specific substance passes the doorway test (Harvey near Rockport, Victoria and Orelia soils, open bay frontage).

## /corpus-christi
Screenshots: `corpus-christi__public__1280.jpg`
1. Purpose: the firm's one location page (GBP and LocalBusiness anchor).
2. Can do: read; email, phone and address; contact form link; Start a job; call.
3. Missing: no hours, no "by appointment" line, no map. A location page usually answers whether anyone is at the address.
4. Contradictions, and these are the sharpest on the site: the Capability block's lede says "Stated as capability, because nothing here is offered yet" (`corpus-christi/page.tsx:140`), and its body says "Until the firm's registration with the Texas Board of Professional Engineers and Land Surveyors is issued and a Professional Engineer is in responsible charge, none of it is offered or performed, and no page on this site says otherwise" (`src/content/location.ts:102`). The footer on the same page prints F-29811; /about says a PE is in responsible charge; /services says every deliverable is sealed. The closing CTA is "Be first when the doors open. The waitlist is how the firm will tell you the work is open" (`corpus-christi/page.tsx:242-243`), under a "Start a job" button, on a site where the operator ruled the waitlist off entirely (OfferCta comment). The meta description ends "join the waitlist" (`location.ts:64`). Defect candidate 3.
5. Copy: as above. Every one of these is a literal, which is the "compliance sentence hardcoded" class CLAUDE.md names.

## /windstorm
Screenshots: `windstorm__public__1280.jpg`
1. Purpose: explainer hub for the Texas windstorm inspection program; links to 8 cluster pages.
2. Can do: read, open the 8 subpages, link to the WPI-8 service page, Start a job.
3. Missing: nothing structural.
4. Contradictions: "Nothing in this cluster is an offer to perform engineering services, because the firm is not yet in a position to make one" and "once it opens for work" (`windstorm/page.tsx:135-141`) are prelaunch literals. The page's own CTA under them is "Start a job" and "Tell us what the letter is for and we will tell you yes or no", and the register now holds a TDI appointment (`model-copy.ts:77-78`, appointment recorded 2026-10-08). Defect candidate 3.
5. Copy: otherwise precise and sourced.

## /windstorm/[slug] (captured: /windstorm/catastrophe-area)
Screenshots: `windstorm-__public__1280.jpg`
1. Purpose: which counties are in the designated catastrophe area.
2. Can do: read, open the rest of the cluster, Start a job.
3. Missing: no address lookup for the Harris County strip east of SH 146, which is the exact question the page says people get wrong.
4. Contradictions: "the windstorm capability page covers what this firm is built to deliver once it opens for work" (`windstorm/[slug]/page.tsx:142`) is the same stale sentence. "Cameron and Willacy are in the Rio Grande Valley, and Jefferson is on the upper coast" (`src/content/windstorm-program.ts:200`): "upper coast" is not one of the eight regions, and `regions.ts:105` puts Jefferson in Greater Houston. The sentence says the counties "fall across three of the coverage regions" and then names a fourth place.
5. Copy: as above.

## /structural-engineer
Screenshots: `structural-engineer__public__1280.jpg`
1. Purpose: the main SEO hub for "structural engineer": what one does, how one differs from an inspector or contractor, what a report says.
2. Can do: read, open three subpages, the registration insight, coverage, Start a job.
3. Missing: the hero promises "what it costs", but the cost is on `/structural-engineer/cost`, which the "two questions" block here does not link (it links inspection, when you need one, how to choose).
4. Contradictions: none beyond the price wording shared with the subpage.
5. Copy: good.

## /structural-engineer/[slug] (captured: /structural-engineer/inspection)
Screenshots: `structural-engineer-__public__1280.jpg`
1. Purpose: what a structural inspection actually involves.
2. Can do: read, follow on links, Start a job.
3. Missing: nothing material.
4. Contradictions: "the price published for each service line covers the inspection and the sealed letter together unless the page says otherwise" (`structural-engineer.ts:240`), while service pages publish no price and /order says a price will be sent.
5. Copy: "Photographs from other devices are not accepted" is a strong, useful line.

## /what-is-a-structural-engineer
Screenshots: `what-is-a-structural-engineer__public__1280.jpg`
1. Purpose: top of funnel definition page.
2. Can do: read, follow three next links (including "What it costs, with every price published before you call"), Start a job.
3. Missing: nothing material.
4. Contradictions: "every price published before you call" carries the same tension with /order.
5. Copy: clear.

## /government
Screenshots: `government__public__1280.jpg`
1. Purpose: capability statement for procurement officers.
2. Can do: read competencies, posture, registrations, NAICS, coverage; Start a job; call.
3. Missing: no downloadable capability statement (see 4), no UEI or CAGE (correctly absent, since SAM is not held), no point of contact name or phone in the registration table (email only, while the phone is in the footer).
4. Contradictions: the NAICS box says a one page capability statement "will be published here once the firm opens for work and the SAM identifiers are confirmed. Until then a contracting officer can request the current version by email" (`government/page.tsx:273-276`). The operator removed "Capability statement available on request" from the home page on 2026-09-18 because "it promised a document nobody had asked for and nobody had written" (`src/app/(site)/page.tsx:228-235`). The same promise survives here. "Every deliverable is reviewed and sealed ... in responsible charge" is gate derived and correct for trading.
5. Copy, and it HIDES content: in "Qualifications based selection" the sentence ends "Fees are negotiated after selection, in" followed by an empty underline. The link "the sequence Chapter 2254 sets out" is `text-slate` on the navy band (`government/page.tsx:116-122`). Defect candidate 6.

## /careers
Screenshots: `careers__public__1280.jpg`
1. Purpose: recruit a PE and field technicians.
2. Can do: read the model, the engagement types, two open positions, the six step process, the FAQ; open each role.
3. Missing: no application status lookup; nothing about where an applicant stands after submitting.
4. Contradictions: "The honest stage: This is a firm at launch. There is no office" (`careers/page.tsx:119-120`), while /corpus-christi and /government name a Suite E street address as the "principal place of business". The FAQ "Is the firm registered and practising today?" answers "Yes ... a licensed engineer is in responsible charge" (gate derived, `src/content/careers.ts:227-229`), and the PE posting it links to says the registration "is not yet issued" (below).
5. Copy: "a firm at launch" is prelaunch phrasing.

## /careers/[slug] (captured: /careers/professional-engineer)
Screenshots: `careers-__public__1280.jpg`
1. Purpose: the PE role posting and its application form.
2. Can do: read; apply through a five step form ("kept on this device as you go").
3. Missing: the posting does not say whether the firm already has an engineer of record and whether this seat is a second reviewer or a replacement. A candidate needs that before applying.
4. Contradictions: "The firm's registration with the Texas Board of Professional Engineers and Land Surveyors is not yet issued. A Texas firm registration requires an engineer in responsible charge to be named, so the selected engineer is named on that application" (`data/positions.ts:147`, and the duty at line 154). F-29811 issued on 2026-09-10 and is in the footer of this page. Defect candidate 1. Separately: the seat is a "part time retainer" and remote (`positions.ts:141, 170`), while the firm's own insight `/insights/texas-engineering-firm-registration` tells the public that section 1001.405 reserves the representation for an entity whose engineering is "directly supervised by an engineer who is a regular full time employee", and that "Direct supervision by a contractor or a part time consultant does not satisfy it" (`src/content/insights.ts:301-305`). I make no legal judgement; the site states both, and a reader will put them side by side.
5. Copy: "a firm at launch cannot promise a path" (`careers/[slug]/page.tsx:284`).

## /insights
Screenshots: `insights__public__1280.jpg`
1. Purpose: index of 14 sourced articles.
2. Can do: open any article.
3. Missing: no topic filter. Fine at 14.
4. Contradictions: none on the index.
5. Copy: good.

## /insights/[slug] (captured: /insights/texas-professional-services-procurement-act)
Screenshots: `insights-__public__1280.jpg`
1. Purpose: statutory explainer with cited sources.
2. Can do: read, open the sources, related reading, FAQ.
3. Missing: nothing material.
4. Contradictions on a sibling not captured, read in source: `/insights/texas-engineering-firm-registration` says "No engineer of record has been appointed" and "the service pages on this site ... do not say that the firm is performing that work" (`src/content/insights.ts:317-324`). Both are literals, and both are false on the trading build: /services and /government say every deliverable is reviewed and sealed by the PE in responsible charge, and /about says a licensed PE is in responsible charge. The page that explains the regulatory gate misdescribes the site's own state. Defect candidate 1.
5. Copy: the captured article is clean.

## /design-inquiry
Screenshots: `design-inquiry__public__1280.jpg`
1. Purpose: a structured brief for design work (hourly, quoted).
2. Can do: submit a detailed brief.
3. Missing: no upload for drawings ("Say what you have rather than attaching it"), which is the first thing a design engineer asks for. Not linked from /order (see /order).
4. Contradictions: "an engineer will read it and come back to you within one business day" (`design-inquiry/page.tsx:66`; the same in `DesignInquiryForm.tsx:82` and `WindstormInquiryForm.tsx:133`). On 2026-10-03 the operator removed "usually after one call" from /order as "a soft promise about how fast the firm answers" (`order/page.tsx:118-126`). A one business day reply promise is the firmer version of what was ruled out. "Design is charged by the hour against a fixed fee agreed in advance" reads as contradicting itself; /process says it better ("$225 per hour, with a fixed fee quoted from the engineer's estimate").
5. Copy: as above.

## /contact
Screenshots: `contact__public__1280.jpg`
1. Purpose: the message form and the firm's contact facts. Every "Request a quote" lands here.
2. Can do: send a message with the service preselected from `?service=`.
3. Missing: the "How to reach the firm" list carries email, coverage, public sector and careers, but no telephone.
4. Contradictions: the left column says "No telephone number is published yet. When one is, it will appear here and on every page of this site" (`contact/page.tsx:134-135`, a literal). The footer of the same screenshot shows "(281) 940-4490", and the header "Start a job" leads to a page that says "call (281) 940-4490". Defect candidate 1.
5. Copy: as above.

## /privacy
Screenshots: `privacy__public__1280.jpg`
1. Purpose: the privacy policy.
2. Can do: read; email a request.
3. Missing: the processors listed are Supabase, Resend and Vercel. Stripe (payments at checkout) is not named, nor is any SMS provider if one is used.
4. Contradictions: "There is no account system, so no passwords are stored" (`privacy/page.tsx:80`). The platform has customer accounts with sign in, sign up, set password and forgot password under `src/app/account/`, plus partner and staff portals. "This site sets no advertising cookies ... does not build behavioral profiles" with no mention of the first party visitor cookie that `/api/referral` sets for partner attribution (`src/app/api/referral/route.ts:93-98`, max age `VISITOR_TTL_DAYS`, the 90 day window). "Information collected automatically ... when a form is submitted" does not cover a cookie set on a page view with `?ref=`. The use list still includes "To contact people who joined the waitlist once firm registration ... is active" (line 88), and the registration is active. Defect candidate 5.
5. Copy: as above. "Effective 16 August 2026" has not moved through these changes.

## /terms
Screenshots: `terms__public__1280.jpg`
1. Purpose: terms of use.
2. Can do: read.
3. Missing: no terms for orders, payment, refunds or customer accounts. Those will be needed the day a line opens, unless they live in the checkout.
4. Contradictions: "submitting a form, joining the waitlist" (`terms/page.tsx:63`) refers to a waitlist the site no longer offers. "We are not yet taking orders" is gate derived (`launch.ts:1262`) and correct.
5. Copy: fine.

---

## Defect candidates

Every one is CANDIDATE, needs reproduction.

1. **Stale "not registered / no engineer / no phone" literals on a trading site, contradicting the footer of the same page.**
   - /contact (`contact__public__1280.jpg`): "No telephone number is published yet" beside a footer printing (281) 940-4490. `src/app/(site)/contact/page.tsx:134`.
   - /careers/professional-engineer (`careers-__public__1280.jpg`): "registration ... is not yet issued" beside F-29811 in the footer. `data/positions.ts:147, 154`. The careers hub FAQ (gate derived, `src/content/careers.ts:227-229`) says the opposite.
   - /insights/texas-engineering-firm-registration (source only, not captured): "No engineer of record has been appointed" and "service pages ... do not say that the firm is performing that work". `src/content/insights.ts:317-324`.
   - Why a defect: each is a literal stating the gate's state, so it did not move when `registrationLine()`, `isTrading()` and the phone moved. This is the class CLAUDE.md section 7 records ("A compliance sentence hardcoded anywhere is the defect").
2. **/services counts nine lines and four steps while showing eight lines and the five step process.** `services__public__1280.jpg`. `src/app/(site)/services/page.tsx:18, 36, 54` (literal "Nine"/"nine") against `services.length` = 8 at line 61; "Step N of 4" at lines 88 to 123 against five steps on / and /process. A typed figure disagrees with its source on the same screen.
3. **Prelaunch and waitlist copy left on /corpus-christi and the windstorm cluster.** `corpus-christi__public__1280.jpg`: "nothing here is offered yet" (`corpus-christi/page.tsx:140`), "none of it is offered or performed" until registration issues (`src/content/location.ts:102`), "Be first when the doors open / The waitlist is how the firm will tell you" (`corpus-christi/page.tsx:242-243`), and meta "join the waitlist" (`location.ts:64`). `windstorm__public__1280.jpg` and `windstorm-__public__1280.jpg`: "the firm is not yet in a position to make one" (`windstorm/page.tsx:135-141`), "once it opens for work" (`windstorm/[slug]/page.tsx:142`). These are literals, not gate derived. The waitlist was ruled off the site.
4. **The roof price on /process omits the coastal surcharge.** `process__public__1280.jpg` shows "Roof Inspections and Certifications $549". `priceSentence()` (`src/config/prices.ts:266-274`) returns the headline figure only, with no coastal branch. The operator's ruling, quoted at `src/lib/ordering.ts:100-102` and in `HomeHero.tsx`, is that the $75 first tier coastal line is "shown to the customer as its own named line" on every surface that shows the price. A Nueces County reader is told $549 for a $624 job.
5. **Privacy policy statements that are false of the platform.** `privacy__public__1280.jpg`. "There is no account system, so no passwords are stored" (`privacy/page.tsx:80`), while `src/app/account/` has sign up, login, set and forgot password. The visitor attribution cookie set by `src/app/api/referral/route.ts:93-98` is not disclosed. Line 88 promises to contact waitlist joiners "once firm registration ... is active", and it is. A published policy that misstates collection is a defect, not a copy preference.
6. **Two links render invisible (navy on navy).** `about__public__1280.jpg`, block "Licensed engineers in responsible charge": the sentence ends in a blank underline; the link "responsible charge, as Texas defines it" has `className="text-slate ..."` at `src/app/(site)/about/page.tsx:115-118`. `government__public__1280.jpg`, block "Qualifications based selection": "the sequence Chapter 2254 sets out" has the same class at `src/app/(site)/government/page.tsx:116-120`. Both sit on the navy band, so the text matches the background and only the brass underline shows. Content is hidden, which the brief puts in scope. contrast-audit is green over it, which suggests its sampling misses inline links on dark bands. Worth asking which question it does not ask.

## Gaps

1. **Settle one price story across /process, /order, service pages and the structural pages.** `blocks-launch`: today a buyer reads "fixed, published before you call" and then "we will send you a price" on the next click. Fix: either show the published figure (with the coastal line) on /order rows and service pages marked "quoted, not orderable online yet", or retitle the /process table as indicative until a line opens.
2. **Sweep every literal that states the gate's state, and add a check.** `blocks-launch`: candidates 1 and 3 are the same class in five files. The next state change (open) will strand more. Fix: route each through `registrationStatement()`, `isTrading()` and `displayPhone()`, and extend `compliance-audit` to fail on "not yet issued", "not yet in a position", "nothing here is offered", "No telephone number is published" and "waitlist" in public source while trading.
3. **Rewrite the privacy policy against what the platform actually does.** `blocks-launch`: accounts, the attribution cookie, Stripe as a processor, waitlist wording. Fix: one revision with a new effective date; list processors from the credential inventory.
4. **PE seat versus the full time employee statement the site itself publishes.** `before-the-20th`: the posting offers a part time remote retainer, and the firm's own insight says section 1001.405 needs a regular full time employee supervising. Fix: operator and counsel ruling; then align the posting, the insight and /about.
5. **Remove the one business day reply promise from /design-inquiry and the two inquiry forms.** `before-the-20th`: it is the firmer form of the soft promise ruled off /order on 2026-10-03. Fix: "read by an engineer, and you will hear back" with no interval, or obtain a ruling that a reply interval is not a turnaround.
6. **The design row on /order should go to /design-inquiry.** `before-the-20th`: the purpose built brief exists and the chooser bypasses it for a generic message form. Fix: in `lineOffer()`, send the hourly design line's quote href to `/design-inquiry`.
7. **/services "Sealed service lines" stat and plural "Engineers" on / and /about.** `before-the-20th`: the operator removed the same label from the home hero for implying eight orderable lines; plural engineers overstates a one engineer register. Fix: "Service lines"; singular, or gate derived wording.
8. **Government capability statement "request the current version by email".** `before-the-20th`: the operator removed the same promise from the home page. Fix: delete the sentence, or write the document.
9. **No public door for a returning customer or partner.** `before-the-20th`: accounts exist but nothing in the public header or footer leads to `/account/login` or the partner portal. Fix: a small "Sign in" link in the footer Company column.
10. **Careers "There is no office" against a published Suite E principal place of business.** `later`: candidates will check. Fix: reword to "no team office yet" or drop the clause.
11. **Catastrophe area page puts Jefferson on "the upper coast", not in a region.** `later`: contradicts `regions.ts`. Fix: "Jefferson ... are in the Greater Houston region".
12. **Coastal Bend "All 8 service lines are available across the state".** `later`: "available" reads as orderable. Fix: "offered" or "quoted".
13. **/order meta description claims lines "take the order now".** `later`: true of no line today. Fix: derive it like the intro sentence.
14. **/structural-engineer hero promises "what it costs" but does not link /structural-engineer/cost.** `later`. Fix: add cost to the "two questions" block.
15. **Location page has no hours or appointment line.** `later`: a GBP anchor page usually answers whether anyone is at the address. Fix: one honest sentence ("by appointment only" if true).
16. **/order gives no sign which line is closest to opening.** `later`: roof has a signed protocol. Fix: none needed until open; flagged only so the chooser's first open state is designed rather than discovered.
