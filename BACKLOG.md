# Backlog

Work that has been identified and deliberately not built yet. Nothing here is a
commitment to a date. An item earns a place on this list by having a stated
reason and, where one exists, the concrete incident that produced it.

Items are removed when they ship, not when they are attempted.

## Blocked on the owner

### DONE. The logo arrived and is integrated

Delivered with the approved v5 design as `logo.png` and `logo-dark.png`, now in
`brand-assets/` and served from `public/brand/`. `Wordmark.tsx` renders the real
lockup, `npm run brand-rasters` regenerates the icon set, the apple icon, the
favicon, and the OG card from the artwork, and the schema Organization logo
points at the mark rather than at the social card.

The icon is the reverse artwork cropped to the numerals on deep navy: the full
lockup at 16 pixels turns the descriptor into a smudge under the part that
matters.

Kept rather than deleted because two notes in it are still live. The artwork navy
is `#012758`, deeper than the UI navy `#14315D`, and the artwork is deliberately
not recoloured to match. And `scripts/brand-rasters.mjs` still restates palette
values that also live in `globals.css`, because the script runs in node and
cannot resolve the Tailwind theme; that duplication is now permanent rather than
time limited, so it is listed under Engineering below.

The original entry follows.

### The logo did not exist

Every mark on this site is a typographic placeholder: the header and footer
wordmark in `src/components/brand/Wordmark.tsx`, the favicon set, and the Open
Graph card. All of them are generated from `scripts/brand-rasters.mjs`.

**Why it is filed rather than worked around.** A commissioned logo is in
progress. Designing a second placeholder to replace the first one would cost the
same work twice.

**What to do when the artwork lands.** Replace the markup in `renderMark()` and
`ogHtml()` in `scripts/brand-rasters.mjs`, update `Wordmark.tsx`, and run
`npm run brand-rasters`. Everything downstream regenerates: `src/app/icon.png`,
`src/app/apple-icon.png`, `src/app/favicon.ico`, and `public/og/default.png`.

**Related.** `scripts/brand-rasters.mjs` restates three hex values and a font
stack that also live in `src/app/globals.css`, because the script runs in node
and cannot resolve the Tailwind theme. That duplication is deliberate and time
limited: the whole file is replaced when the real logo arrives.

### SAM.gov UEI and CAGE are withheld from the page

`/government` renders "withheld until confirmed against the active SAM.gov
record" in place of both identifiers. `samRegistration` in
`src/config/business.ts` holds `uei: null` and `cage: null`.

**Why they are not on the page.** A contracting officer checks a UEI against SAM
in about fifteen seconds. A wrong one reads as a firm that does not know its own
registration, which is worse than no identifier at all.

**Wanted.** Robert confirms both values against the live SAM record, they go into
`samRegistration`, and the page renders them with no other change.

**Also unverified.** `samRegistration.registered` is currently `true` on
instruction and has not been checked against SAM by this build. Setting it to
`false` removes the claim from the credentials strip, the capability statement,
and `/llms-full.txt` at once.

### No phone number is published anywhere

`business.phone` is `null` and the placeholder audit treats ANY ten digit number
in a phone shape as a finding, on every route, in page text, in `tel:` links, in
meta tags, and in JSON-LD.

**Why.** No number has been chosen. A published number is a commitment to answer
it, and a fabricated one on a government capability statement is the exact defect
`scripts/placeholder-audit.mjs` exists to catch.

**What ships when a number exists.** Set `business.phone`, add the digits as
`REAL_PHONE_DIGITS` in `scripts/placeholder-audit.mjs` so the audit enforces that
one number rather than forbidding all of them, and add `telephone` to the
Organization schema in `src/lib/schema.tsx`. `/contact` already carries a sentence
saying a number will appear sitewide when there is one.

### info@254engineering.com has to exist before launch

It is the only public address on the site and it is the point of contact printed
on the capability statement. A bounce there is a lost solicitation.

### The capability statement PDF is not written

`/government` says a one page statement in the format contracting officers file
will be published once registration is active and the SAM identifiers are
confirmed, and offers it by email in the meantime. Both of those are true today
and both stop being true the moment either dependency lands.

### Launch mode flip needs authorization

`LAUNCH_MODE=live` is built and audited in both directions by
`scripts/launch-audit.mjs`, which asserts 28 properties across the two modes.
Flipping it is Robert's decision and it requires the TBPELS firm number, which
goes in `TBPELS_FIRM_NUMBER`.

**One operational note.** Almost every page is statically prerendered, so the
gate is resolved at build time. Changing the variable requires a redeploy to take
effect. On Vercel that is already true of any environment variable change, so
nothing extra is needed, but it does mean the firm cannot be moved from pending
to open by restarting a process. See the note in `src/lib/launch.ts`.

## Engineering

### A failed database write is answered with success

`src/lib/intake.ts` returns a result rather than throwing, and both API routes
turn a failed write into a logged warning and a normal 200. On a database outage
the submission is lost and the person is told it was received.

**Why it is built that way.** The alternative loses the enquiry too, and loses
the person as well, because almost nobody types a message into a form twice. The
Resend notification is a second independent path to the same information, which
is exactly why the two are not chained.

**What would close it properly.** A durable queue, or a local write-ahead that
replays on recovery. Two best efforts is the honest description of what is there
now.

**How you would know it happened.** `[lead] write failed` and
`[apply] write failed` in the server logs, with the Supabase error message.

### The forms round trip is unverified on this machine

`scripts/forms-audit.mjs` runs 35 checks and skips 2: the ones that read the row
back out of `eng_leads` and `eng_applications`. They need
`SUPABASE_SERVICE_ROLE_KEY`, which was not available to this build.

**Why the skip is loud rather than silent.** A run that counted skips as passes
is how a broken write path ships. The summary reports them separately.

**Wanted.** Run `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run forms-audit`
once with real credentials. The audit seeds rows under the name `Zzq Formsaudit`
and deletes them at the end, so it is safe against the shared project.

### Resend has not sent anything

`src/lib/notify.ts` sends from `notifications@254engineering.com`, which requires
the domain to be verified in Resend. Until it is, every send returns
`{ sent: false }` with the reason and the row still lands. No email path on this
site has been exercised end to end.

### County pages are a later tier, and are asserted not to exist

`scripts/coverage-audit.mjs` probes `/coverage/harris`, `/coverage/travis-county`,
and `/counties/bexar` and fails if any of them answers 200.

**Why the assertion.** Adding a route is easy and remembering a content policy
three months later is not. 254 near-identical county pages is doorway content and
would cost more than it earns.

**What a real county tier would need.** Genuinely local material per county:
the authority having jurisdiction and its adopted code editions, the soil series
actually present, the design wind speed, and whether it is inside the windstorm
catastrophe area. That is research per county, not a template.

### The waitlist page is a route with a planned death

`/waitlist` carries `noIndex`, a `Disallow` in `robots.ts`, and is absent from the
sitemap, so the three signals agree. In live mode it still resolves and explains
what it became rather than 404ing links and bookmarks.

**Wanted eventually.** A decision on whether it becomes a permanent redirect to
`/contact` some months after launch, once the links have decayed.

## Content

### Region pages are the deepest content and the least reviewed

The wind, soil, and permitting sections on the eight region pages are the most
substantive claims on the site: catastrophe area county lists, soil formations by
name, specific regulatory bodies. They are written from general knowledge of
Texas construction and have not been reviewed by a licensed Texas engineer.

**Why it matters more here than elsewhere.** A wrong service description is
embarrassing. A wrong statement about which counties require a WPI-8 is the kind
of error a coastal builder would notice immediately.

**Wanted.** A review pass by the engineer of record before, or shortly after,
launch. The county lists in `src/content/regions.ts` are audited for completeness
but not for the regulatory claims made about them.

### There are no reviews, and no review schema

Deliberate. No `aggregateRating`, no `Review` nodes, and nothing on any page that
implies a rating exists. Revisit only when real reviews exist.

## Careers system

### The engineer application cannot be completed without storage

`scripts/lib/careers-audit.mjs` drives the technician flow through submit and
stops the engineer flow at the documents step. The engineer seat requires a
resume, uploading one needs Supabase storage, and a checkout without keys cannot
get past it.

**What is covered instead.** That the requirement blocks, which is the property
that matters, plus every upload API guard called directly.

**What to run once production keys exist.** `npm run forms-audit` with
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set. Three checks turn from SKIP
to real: the engineer submit, and both round trips.

### DONE. Section 1 is no longer blocked

The `/brand-assets/` delivery arrived with the approved v5 design. Colour was not
extracted from the artwork in the end: the approved design specifies the palette
directly and `DESIGN_SPEC.md` records it, which is a better source than sampling
pixels. The original entry follows.

### Section 1 was blocked on the logo files

No `/brand-assets/` directory exists. Colour extraction, the header and footer
mark, the favicon set, the OG card, and the Organization `logo` property all wait
on it. Vector source is worth more than a raster: the header needs the lockup
crisp at 390 and the favicon needs the 254 mark cropped clean.

### JobPosting validThrough needs refreshing

Both positions carry `validThrough: 2026-11-30` in `data/positions.ts`. Nothing
renews it automatically, deliberately: an auto extending posting is one that
outlives the job. Refresh it or set `open: false` before it lapses.

## Insights corpus

### DONE. The four registry entries were flipped on deploy

Flipped from `planned` to `live` inside the merge commit that took
`feat/brand-and-careers` to main, which is where this entry said it had to
happen. Kept here rather than deleted because the reasoning is the reusable
part: a registry entry claiming a live URL must not be marked live until that
URL is actually live, or registry-audit fails on four correct 404s.

The original note follows.

### The four registry entries said `planned` until deploy

`data/keyword-registry.ts` carries all four insights posts as `status: "planned"`
with their real paths. They are written and they are on this branch. They are not
on the production domain, and `scripts/registry-audit.mjs` probes
`https://254engineering.com` for every `live` entry.

**Why it is not just set to live now.** Marking them live made the audit fail on
four correct 404s. The audit was right: the registry claims a page exists on the
live brand, and it does not yet. A `planned` entry may carry a path without being
probed, which is exactly the state these are in.

**What to do at deploy. CONFIRMED BY THE OPERATOR 2026-08-24: this happens in the
same commit that merges, not after it.** In that commit,
change `status: "planned"` to `status: "live"` on all four and delete the three
line comment above each one. Then run `npm run registry-audit` against the
deployed site and watch it verify four new URLs rather than assume it will.

**Also.** The same four entries were copied verbatim into both sibling repos with
a note in each `BACKLOG.md`. Those copies are uncommitted in the sibling working
trees on purpose: sealedengineering is on `main`, and one session per repo
directory is the standing rule. Whoever works those repos next commits them.

### A contextual link inside a SectionHeading lede does not count

`scripts/link-map.mjs` treats only `<p>`, `<li>`, and `<dd>` as prose containers.
`SectionHeading` renders its `lede` into a `<div>`, so a link placed there is
counted as template no matter how much prose surrounds it.

This was found the honest way: the linking pass added three links, link-map moved
by two, and the missing one was in a lede on `/government`. The link was moved
into the `PostureBlock` paragraph below it, where the sentence was already
reaching for it, and the count moved to 21.

**Not fixed, deliberately.** Wrapping a string lede in a `<p>` would make ledes
across the whole site countable and would inflate the contextual number without
anybody having written a new link. If that change is ever made, take a fresh
baseline first and say so, because the before and after numbers in this
workstream's report would stop being comparable.

### /insights/engineer-of-record-texas needs a cannibalization check after indexing

`/about` is live on `engineer in responsible charge texas` and the new post owns
`engineer of record texas`. Those are the closest two entries in the registry.
The intents differ, the post explains the concept and `/about` states the firm's
position, and the post links to `/about` rather than competing with it.

**Wanted.** Once both are indexed, check Search Console for the two pages trading
impressions on the same queries. If they are, the post keeps the term and
`/about` loses it, because `/about` has other work to do.

### /insights/texas-pe-license-lookup will not rank this year

KD 55 against a domain with effectively no authority, competing with PDH Pro and
EngineeringID. It was accepted as a tier 2 target with that stated in advance
rather than discovered in six months, and the reasoning is in
`docs/keyword-batch-phase-1.md`.

**Why it shipped anyway.** It is the highest volume term this brand can honestly
own, the page is genuinely more useful than what ranks, and it earns its place as
a link target for the other three posts regardless of where it ranks.

### Three candidate topics were researched and dropped

The windstorm program authority angle, on call contracting, and veteran owned
positioning all measured no search demand at all. Recorded in
`docs/keyword-batch-phase-1.md` with the evidence, so they are not re-proposed.
The windstorm material is still true and belongs inside the TWIA county pages
when the county tier is built.

## Visual layer

### The logo derived texture is not built, and is deferred to Section 1

Section 4 called for four things and three shipped: the diagram system, the 254
county map, and the icon set. The brand texture was deferred on the operator's
instruction because it is derived from the logo, and the logo does not exist yet.

**What it waits on.** The same `/brand-assets/` delivery that blocks Section 1.
A texture derived from a placeholder wordmark would be thrown away with the
placeholder.

### The map restates hex values that also live in globals.css

`src/components/map/TexasCountyMap.tsx` hardcodes five colours as hex strings
rather than reading the Tailwind theme. SVG presentation attributes such as
`stroke` and `fill` do not resolve Tailwind utility classes, and the per element
alternative, a class on every one of 254 paths, costs more than it saves.

This is the same duplication `scripts/brand-rasters.mjs` already carries and it
has the same expiry: when the logo lands and the palette is confirmed against it,
both files are revisited together. If the palette moves before then, these five
values move by hand.

**The values.** County fill, active fill, hairline, boundary, and the two opacity
figures on the boundary strokes.

### The county geometry is generated and can go stale

`src/content/county-geometry.ts` is written by `npm run build-county-map` from
us-atlas, which repackages public domain US Census TIGER boundaries. Part of it,
`REGION_BOUNDARY_PATH`, is derived from the region assignment in
`src/content/regions.ts`.

**The guard.** The generator stamps a fingerprint of the region and county pairs
into the output. `TexasCountyMap` recomputes it at module scope and throws if it
has changed. Every page carrying the map is statically prerendered, so a stale
file fails the build rather than drawing a wrong boundary forever.

**Injection verified.** A county was moved between regions, the build failed with
the fingerprint mismatch and the regenerate instruction, and the change was
reverted. The guard has been watched to fail.

**What to do when regions change.** Run `npm run build-county-map` and commit the
regenerated file in the same commit as the region change.

**Dependencies.** `us-atlas`, `topojson-client`, `d3-geo`, and the two matching
`@types` packages are devDependencies used only by that generator. They are not
in the runtime bundle. The generated file is committed so a deploy never needs
them.

### There are no service line icons, deliberately

`src/components/ui/icons.tsx` holds three marks: external link, seal, and
document. Nine service line glyphs were considered and none was built.

**Why.** An icon earns its place when it is faster to recognise than the word or
carries something the word cannot. "Roof Inspections and Certifications" has no
faster glyph. What a drawn roof beside it would do is move the page toward the
register of a consumer services brand, which is the register this site is
explicitly not in.

**If this is revisited**, the argument to beat is that one, not the absence of a
visual system. The diagram set and the map are the visual system.

### The mobile menu marks stay in CSS

`MobileNav` draws its bars and its close cross with positioned spans. They were
left alone rather than converted to icons: the CSS is fewer bytes, scales with
the type, and works. Replacing it would have been churn dressed as consistency.

## Approved design port: open at the homepage gate

Sections 1 and 2 of the v5 port shipped in 0894461. Five things were decided
rather than deferred silently, and each is listed here so the decision is
reviewable and not buried in a diff.

### v5's two interactive constructs are static here

v5 renders How It Works as a selector: three steps in a rail, one detail panel
beside it, auto cycling on a timer. Coverage is the same construct with an eight
region list and a map. Both are ported as static compositions, three cards and a
list, keeping v5's step eyebrow, ghost numeral, and card chrome.

**Why.** The auto cycle hides two thirds of the content behind a timer, which is
worse for a reader who wants the whole answer and worse for a crawler that reads
the initial HTML. The material is short enough to show at once.

**If revisited**, the thing to build is a click-to-expand that is fully rendered
in the HTML and enhanced by script, never a construct whose content only exists
after a tick.

### The coverage map has no region pins

v5's map is a decorative outline of the state with eight numbered dots that
anchor the numbered region list. The map here is the real one, 254 county paths
with the eight region borders drawn from the same assignment the coverage lists
use, and it carries no numbers. The list is numbered with nothing on the map to
match.

**Cost.** A reader cannot tell which shape "Panhandle" refers to without
clicking. This is the largest single fidelity gap in the port.

### The windstorm band lost v5's coastal strip

v5 pairs the windstorm copy with a cropped map of the coast and a dot per first
tier county. Here it is a two column list on a white card. The counties are
correct and come from `src/content/windstorm.ts`, but the geography is gone.

### The waitlist form has no card

v5 wraps the form in a white card with a gold top rule and a "Reserve your
place" heading, and its submit is a full width gold bar. `LeadForm` renders bare
on the band with a navy submit. The wiring was left alone deliberately, per the
port's rule that forms wiring is untouched, but the chrome is presentation and
could be ported without touching the wiring.

### UTM parameters are still not captured

The gate ruling asked for the waitlist wired to `/api/lead` with UTM capture. The
wiring is done. The capture is not: the lead path records `landingPath` and
`referrer` only, and adding UTM would mean changing the lead schema, the API
route, and the storage column, which is exactly the internals change the port
was told not to make. Flagged rather than done.

## Two surfaces the sitewide propagation could not reach

`feat/onboarding-admin` is unmerged, so the onboarding stepper and the admin
views do not exist on `feat/approved-design`. The master prompt named both as
propagation targets and neither was touched, because there was nothing on this
branch to touch.

**What this costs.** Whichever branch merges second inherits the work. If the
design port merges first, the onboarding and admin surfaces arrive on main still
drawn in the pre-v5 language and need their own pass. If onboarding merges first,
that pass happens inside the design port's merge instead.

**The pass itself is small**, because the propagation went into shared
components. Both surfaces already render inside the root layout, so the header,
footer, mastheads, buttons, form fields, and card chrome all come across for
free. What would need looking at is the stepper's own progress rail and the admin
tables, which are the only two constructs neither branch shares with a page.

## forms-audit was filling the production tables, and reporting green

Found during the post deploy verification of the v5 design merge, not by an
audit. Thirty rows, twenty leads and ten applications, had accumulated in
`eng_leads` and `eng_applications` across one session of audit runs. Every run
had passed.

**The mechanism.** forms-audit drives real forms through a real browser at a
running Next server. That server loads `.env.local`, so every submission wrote a
real row into the production database. The audit process is a plain node script
and does not load `.env.local`, so it saw no Supabase credentials, skipped its
own round trip and teardown block, and printed a skip in green.

Two independent faults, either of which alone would have been caught:

1. The teardown asserted `!error` on the delete. A delete that matches nothing
   does not error, so the assertion and the thing it was meant to assert had no
   relationship to each other. It would have passed even with credentials
   present and a broken filter.
2. The skip was unconditional. If a submission succeeded, the server wrote a
   row, and "this leg was not checked" and "rows were created and cannot be
   removed" are different sentences. Only one of them is safe to print in green.

**Fixed.** The audit loads `.env.local` so its environment matches the server's.
The teardown counts what is left rather than trusting the delete. Missing
credentials after a successful submission is now a finding rather than a skip.
Verified by pointing the delete at a name that matches nothing and watching the
count check fail with `2 lead(s) still present`.

**No customer data was involved.** Every `254` row in both tables was audit
debris; the real count was zero before and after the cleanup.

**This is the third instance of one defect class**, after the `configured` bug in
the careers module and the image contrast audit sampling below the fold: a check
deciding what is true by looking at something other than the thing it claims to
measure. Worth treating as the standing risk in this harness rather than as three
unrelated bugs.

### One SKIP on main is closed on a branch that has not merged

`forms-audit` on main still skips "engineer: review, consent, and submit" with
the reason "Supabase storage is not configured for this run". That reason is no
longer true now that the audit loads the env file, and the skip is hardcoded
rather than gated.

It is already closed in `4b62549` on `feat/onboarding-admin`, which is unmerged.
Left alone rather than reimplemented here, because two divergent fixes to the
same check is worse than one skip. It arrives when that branch merges, which will
also conflict with this file and should be resolved in favour of the branch's
version of the careers checks plus main's teardown fix.

## Mobile app feel pass: what it could not cover

### The onboarding stepper was named as a target and does not exist here

Section 3 of the mobile brief lists the onboarding stepper among the surfaces to
walk. It lives on `feat/onboarding-admin`, which is still unmerged, so there was
nothing on this branch to walk or fix. This is the third workstream in a row to
hit the same wall.

**What it will and will not inherit.** The shared fixes come across for free,
because they are in components that branch already uses: the 16px control floor,
the keyboard attributes, the tap target sizes in the footer and breadcrumbs, the
viewport meta, the manifest, and the overscroll and press feedback rules in
globals.css. What will need its own pass is the stepper's progress rail and its
upload control, which are that branch's own components, and the fact that
`mobile-overflow-audit` reads the sitemap and the onboarding route is
deliberately not in it, so that route will not be covered by the new audit
without being added to it by hand.

### Inline links in prose are exempt from the 44px rule, deliberately

The brief asks for every interactive element at 44 by 44. 34 occurrences are
links inside running sentences: a citation in an insights paragraph, "join the
waitlist" inside the disclosure, a cross reference mid argument. WCAG 2.5.8
exempts them, and forcing them to 44px tall would break the line spacing of the
paragraph they sit in for no gain to anybody.

The sweep classifies inline against standalone rather than counting both, so this
is recorded as a decision rather than showing up as 34 unfixed findings on the
next pass. Every standalone target on the site now clears 44 by 44.

### The 8px separation rule is met by construction, not measured

Adjacent target separation was not audited independently. Every fix that grew a
target grew it to a full 44px row in a stacked flex column, so adjacent targets
are separated by their own height rather than by a margin, and nothing on the
site places two 44px controls closer than that. Worth a real measurement if a
dense control cluster is ever added.

## After the onboarding merge: what is now true, and what is still open

`feat/onboarding-admin` merged at 6e0777f. The five workstreams it had been
blocking are unblocked, and three of the entries above are now resolved rather
than pending:

- Its two email templates are on the shared branded layout and inside
  `email-audit`, which went from 4 templates and 102 checks to 6 and 152.
- The last three `forms-audit` skips are closed on main. The teardown now removes
  both rows and uploaded objects, and verifies both rather than trusting a delete
  not to error.
- The design port and the mobile pass no longer have an unreachable surface.

### The onboarding stepper is still outside two audits

`/onboarding/[token]` is deliberately not in the sitemap and is disallowed in
robots, which is correct for a private per person surface. The cost is that the
two audits which discover their own work by reading the sitemap, so that they
grow when a page is added, cannot see it:

- `mobile-overflow-audit` never checks the stepper at 360 or 390.
- `seo-audit` never checks it, which is fine and intended.

**What closing this would take.** The stepper only renders for a valid token, so
an audit would have to seed a probe onboarding through the service role, walk the
flow, and tear it down, which is what `forms-audit` already does for the careers
applications. The honest place for it is therefore `forms-audit`, extended with a
mobile width pass, rather than a second route list bolted onto the overflow
audit. Not done, and named here rather than left as an assumption that sitemap
coverage means full coverage.

### The admin portal was never built

Section 3 of the original onboarding master prompt is unstarted. `/admin` returns
404 on the live site today, and `onboarding.submitted` sends the operator a button
pointing at `/admin/onboarding/{id}`, which is a link to a page that does not
exist yet. That email is correct about where the record will live and wrong about
whether it is reachable, and it is the one thing in the merge that promises
something absent.

### A correction to an earlier report

`/waitlist` was reported in the metadata audit as indexable but missing from the
sitemap. It is disallowed in `robots.ts` and has been since before that audit, so
it is consistently non indexed rather than half configured. The finding was wrong
and the configuration was right.

## Interior parity: what the workstream found, and what it did not cover

### The dark bands were shipped with light ground text, and only pixel sampling saw it

Recomposing six pages onto navy bands moved the sections but not their colours.
`image-contrast-audit` measured **47 pairings under the 4.5 floor**, as low as
2.00:1, across the government, position, about, and insights surfaces.
`contrast-audit` passed every one of them, because the ground is a gradient and
axe resolves a gradient no better than a photograph. Same blind spot as the
invisible hero heading.

The audit now covers **126 pairings** rather than the 32 it carried into this
workstream, and every recomposed band is targeted by a stable id rather than a
structural selector.

**Two of the findings were the audit's fault, not the pages'.** `color:
transparent` does not clear an explicitly set `text-decoration-color`, so the
source citations kept their gold underline while their glyphs vanished and the
sampler read the underline as the background: 3.3:1 against gold, when the real
pairing is white on navy at 14:1. And four selectors matched nothing after the
recomposition, which the "selector matched nothing" check surfaced rather than
silently skipping. Both are fixed.

### The strip exemption

The homepage credibility strip, the position specification row, and the about
credentials strip carry no heading and are correct. A strip is a row of facts
read at a glance, not a section making an argument. Recorded in DESIGN_SPEC.md
rather than quietly relaxed, because the first measurement flagged all three as
failures and the rule was over strict rather than the pages being wrong.

### Not covered

The waitlist and the application steppers received the padding change and nothing
else. The brief asked to elevate their framing, including completion states, and
what shipped is the section rhythm only: their opening context bands and their
progress and completion treatments are unchanged. Named here rather than counted
as done.

## The admin portal, and the three things driving it found

Section 3 of the onboarding master prompt, built. Passphrase auth on a signed
httpOnly cookie, rate limiting, a proxy gate over every admin path, dashboard,
leads, applications with signed document links, and the onboarding review with
per item accept and reject, the two operator verification checks, invite
creation, and resend. `security-audit` joins the harness at 34 checks and is
injection verified.

### middleware.ts is deprecated in Next 16, and the rename is not cosmetic

Written as `middleware.ts` from memory, it built cleanly and returned 500 on
every admin route: middleware runs on the edge runtime, which has no
`node:crypto`, and the session gate verifies an HMAC. The failure is at module
evaluation in a runtime the build does not exercise, so nothing caught it until
a request arrived.

`proxy.ts` defaults to the Node.js runtime, which is why the same signing code
now serves the gate and the routes. The `runtime` config option is not available
in a proxy file and setting it throws. AGENTS.md says to read the installed docs
before writing; this is what happens when that is skipped.

### The public header and footer were rendering on the admin portal

An internal tool wearing a marketing header with a "Join the Waitlist" button,
and a public compliance footer under a table of applicant records. Same defect
the onboarding flow shipped once, caught the same way both times: by looking at a
screenshot rather than at the code.

A nested layout cannot remove what a parent rendered, so every public route moved
into a `(site)` route group with its own layout and the root layout now holds
only the document. The group is a URL noop: routes, canonicals, and the 33 entry
sitemap are unchanged, and that was verified rather than assumed.

### The verification checkboxes could be toggled off by an impatient operator

Controlled purely by the server value, so a click set the box, React reverted it
because the prop had not changed, and it only appeared checked after the round
trip and the refresh. For about a second nothing visibly happened, and the
obvious response to nothing happening is to click again, which toggles it back
off. Found by Playwright reporting "clicking the checkbox did not change its
state", which is exactly what a person would have experienced.

Optimistic local state leads now and the server value reconciles it, and a failed
call drops the optimistic value rather than leaving the screen claiming something
the record does not say.

### Not covered

The rate limiter is per instance and in memory. On a serverless platform a
determined attacker who can cause new instances can reset their own budget. The
reasoning for accepting that is written in admin-rate-limit.ts: a store on the
login path either fails open, defeating the control, or fails closed, locking the
operator out during an unrelated outage. For one operator and a twelve character
floor it is the better failure shape, and it should be revisited if this portal
ever has a second user.

Applications are a list, not a detail view. Every answer is in the operator's
email and in the payload column, but there is no per application page in the
portal yet.

## registry-audit rewritten to the differentiation model, 2026-08-31

The operator superseded the keyword ownership model. registry-audit no longer
flags topic overlap, which was the whole of what it used to do. It now fetches
all three live sitemaps and scores trigram similarity across titles, H1s,
descriptions, and heading structures, reporting every close pair and failing
above 0.75.

### The audit was reading production while claiming to read localhost

The thirteenth instance of the defect class this backlog names: a check that
passes while looking at the wrong thing.

Sitemap loc values are absolute canonical URLs, so the sitemap served from
localhost:3225 lists https://254engineering.com. pagesFor fetched those URLs
verbatim. Every run printed "read 33 pages from http://localhost:3225" and read
the deployed site instead, which means BASE_URL did nothing and no unshipped
change could ever be scored.

It was caught only because the audit flagged an H1, the H1 was rewritten, the
build was verified by curl to serve the new text, and the score did not move.
Computing the same trigram score by hand off both URLs gave 0.33 against the
audit's 0.81. The audit was measuring the old page.

Fixed by rebasing every loc onto the requested origin. The failure mode is worth
naming for the next audit that reads a sitemap: an absolute URL in fetched data
silently overrides the origin you thought you were testing.

### What the fix found once it could see the local build

/services/manufactured-home-foundation-certifications had the H1 "Manufactured
Home Foundation Certifications in Texas", which is a literal prefix of Sealed's
"Manufactured Home Foundation Certifications in Texas, FHA and VA". 0.81. That is
the find-and-replace test failing in the plainest possible way.

The H1 is now "What Lenders Require on a Manufactured Home Foundation", which is
this brand's angle rather than a reworded sibling. The page TITLE is unchanged,
per the operator's ruling that existing service page titles ship as they are. H1
and title are separate strings and only one of them was ruled on.

### Utility pages are compared but never failed

Privacy, terms, and contact reach 1.00 across all three brands because a privacy
policy is called a privacy policy. They stay in the comparison and stay printed
in the watch list, marked as not failed, because silently dropping a page from a
duplicate check is how a real duplicate later hides behind an exclusion.

### Still in the watch band, deliberately not acted on

title 0.69 on windstorm WPI-8 and title 0.65 on manufactured home foundations,
both against Sealed. Both are below the fail line and both are titles the
operator ruled stay as shipped. They are printed on every run so the decision
stays visible rather than forgotten.

### Injection verified

Set the solar page H1 to Sealed's solar H1 verbatim, rebuilt, ran: FAIL at 1.00
with exit code 1. Reverted, rebuilt, ran: PASS. The exit code was checked without
a pipe, because a script that prints FAIL and exits 0 is the same defect class
again.

## Phase 3, the proximity head term and an honest link count, 2026-08-31

### link-map was counting card navigation as prose

The fourteenth instance of the defect class this backlog names, and the first one
where the audit was inventing findings rather than missing them.

Card grids are marked up as lists, which is correct. That put every card link
inside an li, and the prose heuristic saw a container of about fifteen words with
a three word anchor and scored it as writing. The windstorm sibling cards
produced four inbound "contextual" links to /windstorm/appointed-engineers, all
with the same anchor, and the anchor discipline check then reported a repetition
that nobody had written into a sentence. The measurement manufactured both the
links and the violation, and the linking pass was being judged against it.

Links inside a heading are now stripped from the container before anchors are
read. A card title falls through to the chrome pass and is counted as template.

Measured on the pre-Phase-3 tree with the corrected script, in a worktree, rather
than assumed: baseline reported 35 contextual links, of which 11 were windstorm
card navigation. Genuine prose links at baseline were 24. After this pass, 37.

### What the inflation was hiding

All seven windstorm cluster pages had exactly one "contextual" inbound link,
which was their own sibling card. With the correction they show as what they are:
no prose inbound at all. The hub has two and the cluster has none.

That is a real gap and it is now visible instead of papered over. The cluster
pages need prose inbound from the service pages and the coastal region page in a
later pass. It was not done in this one because no sentence on those pages wanted
the link, and writing one to carry a link is what section 8 forbids.

### Links dropped rather than forced

/services/roof-inspections, /services/forensic-engineering, and
/services/manufactured-home-foundation-certifications were on the target list and
got nothing. No existing sentence on any source page wanted them. Each is still
reachable through template navigation, and each is a candidate for the next
content that legitimately mentions it.

### Contextual links now live in the copy, not the component

Body strings may carry [anchor](/path), rendered by ProseParagraph. The first
version of the proximity hub special cased one section in the page component and
appended a paragraph after it, which works exactly once before the component
fills with conditionals nobody can find copy in. The token pattern requires a
leading slash, so an external URL cannot be smuggled into body copy through it.

### No /roof-certification page, deliberately

"roof certification" measured 500/mo at KD 0 and is the second unqualified head
term worth having. /services/roof-inspections already opens by defining the term
and stating who orders one, so a second page would have restated it in different
words. The reasoning is recorded at the top of src/content/structural-engineer.ts
so the gap is not filled later by someone who reads it as an oversight.

### Still open

The seven windstorm cluster pages, /services/forensic-engineering,
/services/roof-inspections, /services/manufactured-home-foundation-certifications,
the seven non-coastal coverage regions, and /insights all have no contextual
inbound. The coverage regions in particular are a structural problem: nothing in
prose anywhere links to a specific region except the Coastal Bend.

## Performance pass and the perf gate, 2026-08-31

### What the measurement changed about the plan

The workstream anticipated image work: next/image everywhere, sizes attributes,
AVIF and WebP, priority and preload on the LCP image. None of it was done,
because the baseline said not to.

Every Largest Contentful Paint on all eight sampled templates is a TEXT node.
Not one is an image. Lighthouse reported zero recoverable bytes for both
modern-image-formats and uses-responsive-images on every route, and images were
9 to 65KB against 121KB of fonts and 214KB of JavaScript. There was no image
problem to solve, and "optimize the images" would have been work that looked
like performance and moved nothing.

Because the LCP is text on every template, it is gated on font delivery. That is
what made the font finding the important one rather than a tidy-up.

### The unused italic face

Open Sans italic was declared in the root layout and rendered nowhere. The only
occurrences of the word italic in the source tree were the declaration itself and
a single not-italic, which is the address element on the location page turning
OFF a browser default. Four live pages sampled for em, i, and italic utility
classes returned zero.

It cost a 44KB woff2 on every route, on the critical path for the metric it was
hurting. Fonts went from 121KB to 77KB per route.

### The county map was rendered twice on the homepage

Two identical 73.7KB inline SVGs, 256 paths each, in one document: the hero map
and the coverage section map. Because the map is a server component the geometry
was serialized again into the RSC flight payload, and one county's path string
appeared eight times in the homepage HTML. The homepage document was 105KB
against 15 to 18KB for a content page.

The geometry is now emitted once and drawn twice through a use element carrying
its own tone, which is opt in per page rather than automatic: a component cannot
know it is the second map on a page, and a registry that guessed would be a
hydration bug. Homepage HTML fell from 105KB to 73KB and total from 551KB to
455KB.

Screenshots at 390 and 1280 on homepage, coverage hub, and region page are
byte-identical before and after, verified by sha256 rather than by eye.

### What was measured and deliberately not done

**SVG coordinate rounding.** The prompt expected this to halve the map. The
county paths are already at one decimal place: 43KB of path data across 254
counties, 6,680 decimal numbers, all at 1dp. Rounding to integers would save
about 6.7KB uncompressed for real geometry risk. Not done.

**Dynamic import of the lead form.** Tried, measured, reverted. It made things
marginally worse: 756KB to 765KB of JavaScript, because next/dynamic added a
chunk that Next preloads anyway, and the chunk sets on the homepage and a static
content page stayed identical. The application flow at 61KB is already correctly
code split and loads only on the position page.

**Images, third party, caching, static generation.** No image work for the reason
above. Zero third party origins on public pages, so nothing to remove. Static
assets already carry public,max-age=31536000,immutable and documents are
prerendered and served from cache. The only dynamic routes are admin and the
token gated onboarding page, both correctly dynamic.

### The gate, and the two ceilings

perf-audit runs Lighthouse performance on ten templates at a fixed throttled
mobile profile and fails on LCP, CLS, TBT, or a per template byte budget.
Budgets live in scripts/perf-budgets.mjs with the reasoning.

Lighthouse varies. Measured on this site: the same route, same build, same
profile, moved 740ms of LCP between consecutive runs, and one route moved 693ms
across five runs. The gate measures each route three times and judges the BEST
run, so noise raises the ceiling rather than tripping it, and the spread is
printed on every line so a page getting noisier is visible before it fails.

The two ceilings need stating plainly because they look like fudging. The same
commit measured 1555 to 2901ms of LCP on the live host and 2919 to 3183ms served
from next start on this machine. Localhost is faster on TTFB by two orders of
magnitude, so the server is not the cause. What is established is that next start
serves gzip while the edge serves brotli, about 14 percent more wire bytes on the
same document. What is NOT established is the rest of the gap, which is larger
than 14 percent of anything. That is recorded as unexplained rather than given a
confident cause. So the operator's 2.0s specification applies to any real
deployment and an empirical 3.4s applies to localhost, and which one is used is
decided by the host being measured rather than by a flag.

### The injection test found a hole in the route set

Injecting a 250ms blocking task on /windstorm passed green, because /windstorm
was not in the route set. The hub is a different page shape from its cluster
pages, a card grid rather than prose, and nothing measured it. Added, and the
same injection then failed correctly at TBT 827ms against the 200ms ceiling.

The byte injection, a 500KB asset on /structural-engineer, failed at 892KB
against a 540KB budget on exactly that route with no false positives elsewhere.
Both reverted, both re-verified green.

### And the suite placement, which this file had already warned about

perf-audit was first added to the end of phase two and failed its preflight with
nothing answering on 3225. The comment above security-audit in scripts/audit.mjs
describes this exact trap: phase two audits start their own server by killing
whatever holds that port. It is now last in phase one.

### Still open

The suite is materially slower: perf-audit adds roughly ten minutes, thirty
Lighthouse runs. That is the price of the gate and it is worth it, but a future
pass might make the run count configurable per context so a quick local check is
not the full thirty.

/careers/professional-engineer measured 150ms WORSE on LCP after the change while
its bytes fell 64KB. That route's own spread across five runs was 452ms, so the
difference is inside its noise and cannot be called a regression or dismissed as
noise on the evidence available. Reported rather than filtered out.

## Operations platform, Phase 0: foundation, auth, roles, shell, 2026-09-02

### The whole program's schema landed in Phase 0, on purpose

Twenty five tables covering all six phases: identity, clients and files,
protocols and dispatch and evidence, credentials and certification, documents
and ledgers and the responsible charge log, tasks and threads and notifications,
and the fee schedule. Empty tables are cheap; retrofitting a foreign key onto a
populated table across a live portal is not.

Every one has RLS on with zero policies, the same closed door the eng_ tables
already used. Authorization is application code in src/lib/ops-authz.ts, in
front of every query, asserted by scripts/roles-audit.mjs.

### Two defects the schema had, both found by running it rather than reading it

**The audit trail's own foreign keys fought its immutability trigger.**
actor_id was declared "on delete set null", so deleting a profile asked Postgres
to UPDATE the append only table, and the trigger correctly refused. The result
was that a profile referenced by any trail row could not be deleted at all, and
the error named the trigger rather than the constraint. Found when a
demonstration teardown could not remove its own accounts.

The fix is to drop the reference, not weaken the trigger, and it is the better
model anyway: a regulatory trail whose rows depend on a profile still existing
loses its actor the day somebody leaves. That is why actor_email is denormalised
beside it. Same for eng_responsible_charge_log, which was "on delete restrict"
and would have blocked the delete outright, on a record that has to survive the
engineer leaving the firm for ten years.

**signInWithPassword silently turned the shared service role client into that
user.** supabaseAdmin() is a module level singleton. Calling
auth.signInWithPassword() on it succeeds and stores the user's session inside the
client, so every later .from() call travels as that user, RLS applies, and every
eng_ table returns nothing.

The symptom was worse than the cause: the sign in worked, the profile lookup
immediately after it came back empty, and the person was told their credentials
were wrong. It would have shipped as "the portal does not work" with no obvious
lead. Credential checks now use a throwaway client that never touches a table.

Both were found by the end to end demonstration, not by reading the code, and
neither would have been caught by a type checker or a unit test with a mocked
client.

### auth.users is shared with the other applications on this project

Every table this platform owns carries the eng_ prefix because the Supabase
project hosts several unrelated apps. auth.users has no prefix and cannot have
one. The operator's own address already existed there from another application.

So account creation has two outcomes and they are deliberately different. A new
address gets an auth user and a one time link. An EXISTING address is linked and
its password is left completely alone, because it is the same credential another
application uses and resetting it here would lock somebody out of something else
without telling them why. The admin is told which happened, and the invite email
changes its button from "choose your password" to "sign in".

The seed script does the same thing, which is why the first administrator was
linked rather than created.

### roles-audit is written so it cannot be a tautology

The obvious way to test an authorization module is to loop over its own matrix.
That passes forever, including on the day somebody widens a role. So the audit
states who may do what a second time, by hand, and fails when the two disagree.
Injection verified: granting field_tech pricing.read and audit.read produced four
failures across the matrix check and the redaction check.

The second half signs in as each role through the real endpoint and attempts what
each must not do. A pure matrix proves the module is self consistent; it proves
nothing about whether the route handlers call it.

### The passphrase is retired, the screens behind it are not

The shared ADMIN_PASSPHRASE, its session module, and the login, logout, and
session endpoints are deleted. security-audit asserts the old surface no longer
issues a session.

The leads, applications, and onboarding screens still answer under /admin and are
now gated by the same accounts as the portal, admin role only. They are real work
the operator does today and Phase 1 and Phase 3 absorb them properly. Deleting
them now to make the retirement look complete would have removed capability and
given nothing back. That is a deliberate temporary duplication and it is the one
piece of Phase 0 that is not finished architecture.

### Still open, and known

ADMIN_PASSPHRASE can be removed from the Vercel environment; nothing reads it.
OPS_SESSION_SECRET must be SET there before the portal works in production, and
it is not set yet. Without it the sign in screen says so rather than rejecting
correct passwords silently.

The command palette navigates and does not search. Searching clients and files
starts when there are clients and files, and the palette says so rather than
returning nothing.

The dashboard shows live counts and two designed empty states. It does not show a
revenue chart with invented numbers.
