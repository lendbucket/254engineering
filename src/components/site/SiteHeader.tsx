import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { MobileNav } from "./MobileNav";
import { primaryNav } from "./nav";
import { business } from "@/config/business";

/**
 * The site header.
 *
 * Deliberately not sticky. A bar that follows the reader down the page is a
 * product convention, and this site is closer to a document than a product: the
 * pages are read top to bottom, and a permanent bar over a capability statement
 * reads as a marketing site pretending to be a firm. The brass hairline under it
 * is the only ornament.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-limestone-line bg-limestone">
      <Container>
        <div className="flex items-center justify-between py-4 sm:py-5">
          <Link href="/" aria-label={`${business.name} home`} className="shrink-0">
            <Wordmark />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-7 lg:gap-9">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-sans text-[0.93rem] font-medium text-slate-muted transition-colors hover:text-slate"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <MobileNav />
        </div>
      </Container>
      <div aria-hidden="true" className="h-px bg-brass/45" />
    </header>
  );
}
