import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { MobileNav } from "./MobileNav";
import { primaryNav } from "./nav";
import { business } from "@/config/business";
import { isPrelaunch } from "@/lib/launch";

/**
 * The header and the nav bar, as the approved v5 design sets them.
 *
 * Two bands, not one. A white band carrying the mark and the opening soon
 * block, then a sticky navy bar carrying navigation and the waitlist call to
 * action. v5 renders them as separate elements and the separation is what lets
 * the navy bar stick on its own without dragging a tall logo lockup down the
 * page with it.
 *
 * WHY THE NAV POINTS AT ROUTES AND NOT AT v5's ANCHORS
 * ----------------------------------------------------
 * v5 is a single landing page, so its nav is six in page anchors. This is a site
 * with real routes behind every one of those words, and a global header whose
 * links only resolve on the homepage would be six dead links on every other
 * page. The nav therefore keeps the repo's existing routes and takes v5's
 * treatment: white 600 weight labels, a transparent three pixel bottom border
 * that goes gold on hover, and the gold waitlist button flush to the right edge.
 *
 * This is the same category of change as the careers call to action, which v5
 * sends to a mailto and which goes to the real careers routes here. Both are
 * wiring, not design.
 *
 * THE OPENING SOON BLOCK IS GATED
 * -------------------------------
 * v5 was designed around opening soon language throughout, which matches the
 * prelaunch state. It is still rendered through `isPrelaunch()` rather than
 * hardcoded, because the whole point of the gate is that one environment
 * variable moves every surface. In live mode the block becomes the contact line
 * without the status.
 */
export function SiteHeader() {
  const prelaunch = isPrelaunch();

  return (
    <>
      <header className="bg-white">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6 py-4">
            <Link href="/" aria-label={`${business.name} home`} className="shrink-0">
              <Wordmark height={72} className="h-[58px] w-auto sm:h-[72px] lg:h-[84px]" />
            </Link>

            {/* v5 hides this below its 1020px branch. Kept out of the DOM flow on
                small screens rather than hidden with CSS alone, because the
                contact line reappears in the footer and repeating it inside a
                collapsed header is clutter a phone does not need. */}
            <div className="hidden text-right lg:block">
              {prelaunch ? (
                <p className="font-display text-[15px] font-bold text-slate">Opening soon</p>
              ) : null}
              <p className="mt-1 text-[14px] text-slate-muted">Serving all 254 Texas counties</p>
              <a
                href={`mailto:${business.email}`}
                className="mt-1 inline-block text-[14px] font-semibold text-brass-ink transition-colors hover:text-slate"
              >
                {business.email}
              </a>
            </div>
          </div>
        </Container>
      </header>

      <div className="sticky top-0 z-50 bg-slate shadow-[0_2px_6px_rgba(6,16,34,0.25)]">
        <Container>
          <div className="flex items-stretch justify-between gap-2">
            <nav aria-label="Primary" className="hidden items-stretch lg:flex">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center border-b-[3px] border-transparent px-[clamp(10px,1.4vw,18px)] py-[17px] text-[15px] font-semibold text-slate-fg transition-colors hover:border-brass hover:bg-white/8"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <MobileNav prelaunch={prelaunch} />

            <Link
              href={prelaunch ? "/waitlist" : "/contact"}
              className="-mr-[clamp(1rem,4vw,1.75rem)] flex items-center bg-brass px-[18px] text-[14px] font-bold text-slate-ink transition-colors hover:bg-brass-light sm:px-[26px] sm:text-[15px]"
            >
              {prelaunch ? "Join the Waitlist" : "Contact the Firm"}
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
}
