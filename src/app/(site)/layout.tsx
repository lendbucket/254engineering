import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd, organizationSchema, websiteSchema } from "@/lib/schema";

/**
 * The public site's chrome.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE ROOT LAYOUT
 * -----------------------------------------------
 * The header, the footer, and the entity schema used to live in the root layout,
 * which meant they rendered on every route including the admin portal. The
 * result was an internal tool wearing a marketing header with a "Join the
 * Waitlist" button in it, and a public footer with a compliance disclosure
 * underneath a table of applicant records.
 *
 * That is the same defect the onboarding flow shipped once, and it was caught
 * the same way both times: by looking at a screenshot rather than at the code. A
 * nested layout cannot remove what a parent rendered, so the fix is a route
 * group. Everything public lives under (site) and gets this. The admin portal
 * sits outside it and brings its own chrome.
 *
 * The group is a URL noop: (site) does not appear in any path, so every route
 * and every canonical is exactly what it was.
 *
 * The skip link and the main landmark belong here too. An admin page has its own
 * single purpose layout and does not need a skip target for a nav it does not
 * have.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        The organization and website nodes ship on every public page rather than
        on the homepage alone. A crawler that lands first on a region page should
        resolve the entity from that page, and both nodes carry stable @id values
        so repeating them joins rather than duplicates.

        They are deliberately not on the admin routes: those are noindex, and
        entity markup on a page no crawler may read is markup with no reader.
      */}
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-[3px] focus:bg-slate focus:px-4 focus:py-2 focus:text-slate-fg"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
