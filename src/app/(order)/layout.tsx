import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { ReferralCapture } from "@/components/site/ReferralCapture";
import { PhoneNumber } from "@/components/ui/PhoneNumber";
import { displayPhone, telHref } from "@/config/contact";
import { registrationLine } from "@/lib/launch";

/**
 * THE ORDER FLOW'S OWN CHROME. Operator ruling of 2026-10-08.
 *
 * V10's order screens (V10O-property, -service, -visit, -pay, -done) draw a
 * plain white header with the mark, no site navigation, and a hairline under
 * it. The order flow sat inside (site) and wore the public site's sticky navy
 * header, menu and shadow, which is a different screen. So it has its own route
 * group. Like (site), the group is a URL noop: /order/start/[slug] and
 * /order/[reference] are exactly where they were. /order itself, the catalogue,
 * stays a public page in (site).
 *
 * The header and footer are the account screens' own, so a customer meets one
 * chrome from sign in to checkout. The public site header is unchanged until
 * after 2026-10-20, by the same ruling.
 *
 * WHAT IS KEPT FROM (site), AND WHY. The skip link and the main landmark, for
 * the same reasons they exist there. And ReferralCapture: a partner link that
 * lands straight on an order page must still be credited, which is why the
 * capture lives in the chrome rather than at checkout. What is left out is the
 * entity schema, which belongs to indexed public pages; these are noindex.
 */
export default function OrderLayout({ children }: { children: React.ReactNode }) {
  const phone = displayPhone();
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-[2px] focus:bg-slate focus:px-4 focus:py-2 focus:text-slate-fg"
      >
        Skip to content
      </a>
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="254 Engineering Services, home">
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" priority />
          </Link>
          {phone ? (
            <p className="text-[14px] text-[var(--color-ink-quiet)]">
              Questions?{" "}
              <a href={telHref() ?? undefined} className="text-[var(--color-slate)]">
                <PhoneNumber />
              </a>
            </p>
          ) : null}
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-[var(--color-ink-quiet)] sm:px-6">
          {/* Derived from the board's own record. Never typed. */}
          <p>{registrationLine()}</p>
          <nav className="flex gap-5">
            <Link href="/terms" prefetch={false} className="text-[var(--color-link)]">
              Terms
            </Link>
            <Link href="/privacy" prefetch={false} className="text-[var(--color-link)]">
              Privacy
            </Link>
            <Link href="/contact" prefetch={false} className="text-[var(--color-link)]">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
      <ReferralCapture />
    </div>
  );
}
