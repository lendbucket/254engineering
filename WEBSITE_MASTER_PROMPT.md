# MASTER PROMPT: 254ENGINEERING.COM

Paste this entire document as the first message in a Claude Code session at C:\Users\salon\projects\254engineering. Before anything else: save this document to WEBSITE_MASTER_PROMPT.md in the repo, commit with message "docs: add website master prompt", then follow it as binding instructions.

Mode: BUILD new site.

## 1. WHO THIS COMPANY IS

254 Engineering Services is a Texas engineering firm named for the 254 counties of Texas, every one of which it serves. It delivers inspections, sealed letters, certifications, and design through a central review model: standardized field protocols, statewide field technicians, licensed Texas Professional Engineers in responsible charge reviewing and sealing from a central operation. It is veteran owned. This site is the institutional flagship: the identity that appears on government capability statements, chamber of commerce listings, BBB, directories, contracts, and reviews. It must read like a firm that has existed for decades.

- Legal name: 254 Engineering Services LLC
- Brand: 254 Engineering Services
- Domain: 254engineering.com. The domains 254engineeringservices.com and 254eng.com will 301 redirect to it at the DNS or Vercel level.
- Audience: municipal and government procurement officers, commercial clients, lenders, insurers, B2B partners, PE recruits, field tech recruits.
- Voice: institutional, precise, quietly proud, plain English. Not direct response. Every claim verifiable.

## 2. INFRASTRUCTURE

- GitHub: lendbucket/254engineering, private. Robert is creating it now. Initialize git immediately, commit as you build, and push to origin main once the remote exists. Feature branches for significant work after the initial build. No history rewrites, no force pushes.
- Vercel: team salon-envy, project connected to the repo, auto deploy from main. DNS Cloudflare, grey cloud.
- Database: shared Supabase project wattsmith (ref fsaryeciduszuahgjbly, org Salon Envy). This firm's tables are prefixed eng_ and carry a site column; this site writes site value 254. Do not create a new Supabase project. RLS enabled on every table with zero policies, service role only, closed door pattern. All database access server side through the service role client. import "server-only" in every data module. No NEXT_PUBLIC Supabase keys anywhere.
- Email: Resend, notifications to ceo@36west.org.
- Env vars (Robert sets in Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, LAUNCH_MODE=prelaunch, TBPELS_FIRM_NUMBER (empty for now).

## 3. STACK AND ENGINEERING STANDARDS

- Next.js App Router latest stable, TypeScript strict, Tailwind v4, static generation wherever possible.
- The wattsmith repo at C:\Users\salon\projects\wattsmith is the engineering reference. Port its patterns: scripts/lib dev-server harness, build race guard (prebuild and preaudit), and the audit suite: seo-audit, contrast-audit, mobile-audit, forms-audit, placeholder-audit (greps rendered output for 555 phone patterns, lorem ipsum, TBD, TODO, placeholder emails). Verify every audit fires by injecting a violation, then revert the injection. Run all audits once at end of session.
- Screenshots of new UI at 390 and 1280 reviewed before reporting. WCAG AA is a floor.
- BACKLOG.md at repo root, craftline format. End session with a build report: shipped, flagged for owner verification, pending.

## 4. CONTENT RULES (ABSOLUTE)

- NO em dashes, NO en dashes anywhere: copy, metadata, schema, alt text, code comments that render. Use commas, periods, or restructure the sentence.
- NO emojis anywhere.
- All copy reads as expert human writing.
- SEO metadata and page titles are the single highest priority on this build. Unique titles under 60 characters, keyword leading. Unique meta descriptions under 155 characters. Every page's hero H1 carries its primary keyword naturally. This is treated as more important than almost anything else.
- No earnings claims, no fabricated testimonials, no reviews or rating schema until real reviews exist.

## 5. COMPLIANCE GATE (CRITICAL)

The firm's TBPELS registration is not yet active. Until it is, the site must not state that the firm currently offers or performs engineering services.

- Build every page fully, but ship in PRE-LAUNCH MODE controlled by env var LAUNCH_MODE. In prelaunch: every service CTA becomes a waitlist form, a tasteful "Opening soon, join the waitlist" treatment appears on service pages, and the footer carries "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors."
- In live mode (LAUNCH_MODE=live): waitlist treatments disappear, order CTAs activate, and the footer renders "254 Engineering Services LLC" with "TBPELS Firm No." plus TBPELS_FIRM_NUMBER on every page.
- Build and test both modes now. Ship prelaunch.
- Nothing on the site promises engineering opinions in advance, implies guaranteed approvals, or solicits insurance claims. Storm related services are described factually. Never any claim maximization language.

## 6. BRAND DESIGN

No logo exists yet; Robert is commissioning one. Build a clean typographic wordmark placeholder and flag logo integration as pending. Generate the favicon set from the placeholder wordmark now using the sharp and png-to-ico pattern (favicon.ico, icon.png, apple-icon.png, App Router file conventions); regenerate when the real logo lands.

- Palette direction: deep slate blue primary, Texas limestone cream background, single brass accent. Propose the exact values on a homepage concept and show screenshots before applying sitewide.
- Typography: propose a serif display face for headings, Inter for body. Show before applying sitewide.
- The design should feel like a firm with gravitas: generous whitespace, strong grid, restrained color, no gimmicks.

## 7. PAGES

1. Home. Hero H1 in the "Texas engineering services" family. The name story in one strong paragraph: named for the 254 counties of Texas, serving all of them. Services overview cards. Coverage statement. Veteran owned treatment. Credentials strip: SAM registered, SDVOSB certification pending, TBPELS line per compliance gate. Contact CTA.
2. About. The firm model in plain language: licensed professional engineers in responsible charge, standardized field protocols, statewide remote review, technology backbone. The name story told fully. Veteran ownership. Entity level only, no founder biography page.
3. Services index plus one dedicated page each: Roof Inspections and Certifications, Windstorm WPI-8 Certifications, Foundation Inspections and Certifications, Solar Structural Letters, Manufactured Home Foundation Certifications (FHA and VA), Structural Letters for Permits, Repair Specifications, Residential and Light Commercial Design, Forensic and Insurance Engineering. Each page: keyword H1, what the service is, who orders it, what the deliverable is, qualitative turnaround statement, FAQ block with FAQPage schema, CTA respecting launch mode.
4. Coverage. The centerpiece: a hub page presenting all 254 Texas counties grouped into regions, plus eight fully written region pages: Coastal Bend, Greater Houston, Dallas Fort Worth, San Antonio, Austin and Central Texas, Rio Grande Valley, West Texas, Panhandle. Each region page carries real localized content: wind zones, common soil conditions, permitting context, service emphasis for that region. Individual county pages are a later tier; do not ship thin county pages now. No doorway content ever.
5. Government. Capability statement page: qualifications based selection language, on-call engineering availability, SDVOSB status stated as pending, SAM registration section with UEI and CAGE as flagged placeholders for Robert to verify before display, NAICS codes for engineering services, veteran owned emphasis. Downloadable capability statement PDF flagged pending.
6. Careers. Two tracks on one hub. Track one, Professional Engineers: engineer of record and review engineer opportunities, the remote review model explained honestly, TDI windstorm appointment called out as a plus, application form (name, email, phone, city, license number, disciplines, TDI appointed yes or no, availability, message). Track two, Field Inspection Technicians: the model explained honestly (independent contractor, accept or decline dispatched jobs, flat rate per completed inspection, protocol certification required before first assignment), application form (name, email, phone, city, counties willing to serve, experience background, drone license yes or no, reliable vehicle yes or no, message). Both forms store in eng_applications with site and role columns and send Resend notifications.
7. Contact. Name, email, phone, city, service of interest, message. Stores in eng_leads, Resend notification.
8. Privacy policy and terms. Real documents, Texas specific and independent contractor aware.

## 8. SEO AND SCHEMA

- This site targets the branded family (254 Engineering, 254 Engineering Services) and firm level institutional terms (Texas engineering firm, statewide engineering services, on-call engineering Texas, veteran owned engineering firm). Commercial service plus city terms belong to the sister brand site sealedengineering.com; do not target them here and do not build city pages here.
- Organization schema: this is the master organization record for the whole brand family. Include legalName, url, areaServed Texas, foundingLocation, and a brands array that will later reference Sealed Engineering and StampMyPlans. WebSite schema with name "254 Engineering Services" so the SERP site name renders correctly from day one. BreadcrumbList sitewide. Service schema on service pages. og:site_name "254 Engineering Services" everywhere.
- robots.ts explicitly allowing GPTBot, ClaudeBot, PerplexityBot, Google-Extended and standard crawlers. /llms.txt and /llms-full.txt with ownership and NAP data. Clean canonical sitemap.xml ready for Search Console submission.
- OG image at /public/og/default.png as a typographic placeholder, flagged pending logo.

## 9. OWNER VERIFICATION ITEMS EVERY BUILD REPORT CARRIES

Logo files, SAM UEI and CAGE approval for public display, capability statement PDF, phone number and public address decision, TBPELS registration number when it lands, launch mode flip authorization.
