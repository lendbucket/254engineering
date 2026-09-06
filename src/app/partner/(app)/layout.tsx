import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPartner } from "@/lib/partner-auth";
import { mispointing } from "@/lib/db-guard";
import { MispointedDeployment } from "@/components/portal/Mispointed";
import { PartnerIdentity, PartnerTabs, PartnerTopNav } from "@/components/partner/PartnerChrome";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * The partner app shell, built to the native standard at 390.
 *
 * WHY THE GUARD IS HERE AS WELL AS IN THE PROXY
 * ---------------------------------------------
 * The same reasoning the portal layout records. The proxy is the gate and this
 * is the lock: a matcher is a pattern, and a pattern is one typo from leaving a
 * route uncovered while every test that goes through the matcher passes. This
 * layout wraps every partner page, so a route added tomorrow inherits the check
 * whether or not anybody remembered the matcher.
 *
 * That is not theoretical here. The partner branch in the proxy shipped once
 * with neither prefix in the matcher, and every partner page would have
 * rendered to a signed out visitor. There were no partner pages at the time,
 * which is the only reason it cost nothing.
 *
 * POINT 1 OF THE NATIVE STANDARD, THE SAME SHAPE AS THE PORTAL
 * ------------------------------------------------------------
 * h-dvh with overflow-hidden on the outer element is what stops the DOCUMENT
 * scrolling. The header and the tab bar are the fixed chrome, the region
 * between them is the only thing that scrolls, and it carries
 * `data-portal-scroll` so the same audit measures both surfaces.
 *
 * At lg this reverts to ordinary document flow, because a desktop browser
 * scrolls a page and the tab bar is not rendered there.
 */

export const dynamic = "force-dynamic";

export default async function PartnerAppLayout({ children }: { children: React.ReactNode }) {
  const mispointed = mispointing();
  if (mispointed) return <MispointedDeployment fault={mispointed} />;

  const principal = await currentPartner();
  if (!principal) redirect("/partner/login");

  return (
    <div className="portal-surface h-dvh overflow-hidden lg:h-auto lg:min-h-dvh lg:overflow-visible">
      <div className="flex h-full flex-col lg:block lg:h-auto">
        {/*
          Navy on a phone, white at lg, exactly as the portal's is and for the
          same reason: on a phone there is no rail, so the header IS the brand
          surface and a white one would leave the screen with no chrome and a
          status bar that does not match the app.
        */}
        <header className="z-30 shrink-0 border-b border-[var(--border)] bg-[var(--navy)] pt-[env(safe-area-inset-top)] lg:sticky lg:top-0 lg:bg-white">
          <div className="mx-auto flex min-h-[var(--header-height)] w-full max-w-[1100px] items-center gap-3 px-3 sm:px-5">
            {/*
              THE PARTNER'S NAME IS THE IDENTITY OF THIS SURFACE.

              Non negotiable 4 of the program's regulatory shape: the partner
              portal is the only place a partner's branding is primary, and no
              customer sees it. eng_partners holds a name and no logo, so what
              is primary here is the name. A logo needs the asset library, which
              is Section 5.

              254's wordmark is present as the firm whose platform this is,
              deliberately secondary and deliberately not absent: a partner
              should never be in any doubt about whose system holds their money.
            */}
            <div className="min-w-0">
              <Link href="/partner" className="block py-2">
                <p className="truncate font-display text-[15px] leading-[1.2] font-bold text-white lg:text-[var(--navy)]">
                  {principal.partner.organisation}
                </p>
                <p className="portal-kicker mt-0.5 text-[var(--gold-bright)] lg:text-[var(--secondary)]">
                  Referral partner
                </p>
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <PartnerTopNav />
              <PartnerIdentity
                organisation={principal.partner.organisation}
                displayName={principal.displayName}
                email={principal.email}
              />
            </div>
          </div>
        </header>

        <div
          id="portal-scroll"
          data-portal-scroll
          /*
            Focusable because it scrolls. axe scrollable-region-focusable is a
            serious violation and it fires the moment a region scrolls with
            nothing inside it to tab to, which is what point 1 creates.
          */
          tabIndex={0}
          className="portal-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain lg:min-h-[auto] lg:flex-none lg:overflow-visible"
        >
          <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[var(--section-gap)] px-[var(--page-gutter)] py-6 lg:pb-10">
            {children}

            {/*
              THE COMPLIANCE SENTENCE, ON EVERY PARTNER SCREEN.

              The public site carries it, the sign in screens carry it, and a
              partner reading what they earned on work the firm has not yet been
              registered to perform is exactly the audience for it. It sits at
              the end of the scrolling region rather than in the fixed chrome,
              because chrome is for navigation and this is a statement of fact
              that belongs with the content it qualifies.
            */}
            <footer className="border-t border-[var(--border)] pt-4">
              <p className="text-[12px] leading-[1.6] text-[var(--secondary)]">
                254 Engineering Services is the firm of record for work referred through this
          programme, and is the firm that will perform and seal it. Firm registration is pending with the Texas Board of Professional
                Engineers and Land Surveyors, and no engineer of record is yet in responsible
                charge.
              </p>
              <div className="mt-3">
                <Wordmark height={20} />
              </div>
            </footer>
          </main>
        </div>

        <PartnerTabs />
      </div>
    </div>
  );
}
