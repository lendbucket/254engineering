# 254engineering.com

The institutional site for 254 Engineering Services LLC, a veteran owned Texas
engineering firm named for the 254 counties of Texas.

This is the identity that appears on government capability statements, chamber
listings, directories, and contracts. It is built to read like a firm that has
existed for decades, which mostly means that everything on it is verifiable and
nothing on it is aspirational.

## The three things to know before changing anything

**1. There is a compliance gate, and it is not a feature flag.**
The firm's registration with the Texas Board of Professional Engineers and Land
Surveyors is pending. Until it is active the site may not state that the firm
offers or performs engineering services. Every surface that could make that claim
reads `src/lib/launch.ts`, and `scripts/launch-audit.mjs` runs the whole site in
both modes and asserts 28 properties across them. Read the header comment in
`launch.ts` before touching any copy about what the firm does.

**2. No em dashes, no en dashes, no emoji. Anywhere.**
Copy, metadata, schema, alt text, and rendered comments alike.
`scripts/placeholder-audit.mjs` crawls rendered output and fails on all three,
along with fabricated phone numbers, off-domain emails, and TODO markers.

**3. Titles and descriptions are the highest priority on this build.**
Under 60 and under 155 characters respectively, unique across the site, keyword
leading. `src/lib/seo.ts` enforces the ceiling; `scripts/seo-audit.mjs` enforces
the floor, the uniqueness, the schema, and Lighthouse SEO 100.

## Stack

Next.js 16 App Router, TypeScript strict, Tailwind v4, static generation
throughout. Supabase for intake (service role, server side only), Resend for
notification email. Deployed on Vercel.

## Running it

```
npm install
cp .env.example .env.local     # then fill in the keys
npm run dev                    # http://localhost:3225
```

## The audit suite

```
npm run build && npx next start -p 3225      # one terminal
AUDIT_KILL_STALE=1 npm run audit             # another
```

Seven audits. The first four read the server on 3225; the last three stand up
their own and will stop that server, which `scripts/audit.mjs` says out loud
before it happens.

| Audit | What it proves |
| --- | --- |
| `coverage-audit` | All 254 Texas counties appear exactly once, checked against an independent canonical list, and the hub renders every one |
| `placeholder-audit` | No scaffolding, no long dashes, no emoji, no phone number, no off-domain email |
| `seo-audit` | Title and description budgets, uniqueness, canonical, og:site_name, one h1, Organization + WebSite + BreadcrumbList schema, Lighthouse SEO 100 |
| `forms-audit` | All four forms end to end at 390px, the POST bodies on the wire, the server side guards, and the database round trip |
| `launch-audit` | The compliance gate in both modes, and the claims neither mode may ever make |
| `mobile-audit` | Zero horizontal scroll and WCAG 2.5.8 tap targets at 320/375/390/430, plus the mobile menu including the back button |
| `contrast-audit` | WCAG 2.1 A and AA via axe, at 390 and 1280, including the form error states a resting page never shows |

Every one of them has been verified to fire by injecting a violation and
confirming the failure, then reverting.

## Screenshots

```
npm run shots            # every route at 390 and 1280 into screenshots/
npm run shots -- /about  # just one
```

## Brand assets

```
npm run brand-rasters
```

Regenerates the favicon set and the Open Graph card from the placeholder
wordmark. See BACKLOG.md for what changes when the real logo lands.

## Where things live

```
src/config/business.ts     every fact about the entity, stated once
src/lib/launch.ts          the compliance gate
src/lib/seo.ts             the metadata budget
src/lib/schema.tsx         JSON-LD for the whole brand family
src/lib/supabase.ts        the service role client, server only
src/content/services.ts    nine service lines and all their copy
src/content/regions.ts     eight regions and all 254 counties
scripts/lib/               the dev server harness and the build guard
```

## BACKLOG.md

Everything identified and deliberately not built, with the reason. Read it before
concluding something is missing by accident.
