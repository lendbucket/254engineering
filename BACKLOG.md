# Backlog

Work that has been identified and deliberately not built yet. Nothing here is a
commitment to a date. An item earns a place on this list by having a stated
reason and, where one exists, the concrete incident that produced it.

Items are removed when they ship, not when they are attempted.

## Blocked on the owner

### The logo does not exist

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
