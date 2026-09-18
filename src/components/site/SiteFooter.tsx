import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { business } from "@/config/business";
import { isPrelaunch, registrationLine } from "@/lib/launch";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import type { ReactNode } from "react";

/**
 * The site footer, as the approved v5 design sets it.
 *
 * Deep navy `#0B1B36` under a four pixel gold rule, the reverse lockup, a
 * description, status badges, three link columns, and a centred compliance block
 * above the copyright.
 *
 * THE COMPLIANCE BLOCK, WHERE v5 AND THE GATE DISAGREE
 * ----------------------------------------------------
 * v5 shows one sentence: firm registration pending. The firm has two live gates,
 * not one, and `registrationLine()` states both, because a registered firm with
 * nobody able to seal still cannot seal and saying only half of that would be
 * the more flattering half.
 *
 * So the TREATMENT is v5's, centred and given room above the copyright, and the
 * TEXT is whatever the gate function returns. The design decides how it looks
 * and the compliance gate decides what it says. When the registration issues,
 * the same function carries the TBPELS firm number into the same block with no
 * markup change, which is the property the gate exists to have.
 *
 * THE BADGES ARE GONE AND THE GATING THAT WAS SUPPOSED TO PROTECT THEM IS THE
 * REASON WHY
 * ----------------------------------------------------------------------------
 * This comment used to argue that the "SAM registered" badge was safe because it
 * rendered through `samRegistration`, so one flag would remove the claim from
 * every surface at once. The mechanism worked exactly as described. It was
 * pointed at a flag that was never true.
 *
 * A claim routed through a declaration is not a verified claim. It is a claim
 * with one edit point, which is worth having and is not the same thing. What
 * was missing was anything asserting that the declaration matched the world,
 * and the declaration said so about itself in its own comment for weeks.
 *
 * No credential renders here now. `verifiedCredentials` in
 * src/config/credentials.ts holds the ones the firm actually has, with a date
 * and a reference, and `compliance-audit` refuses a credential claim in any
 * component.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t-4 border-brass bg-slate-abyss text-[#c3ccda]">
      <Container>
        <div className="grid gap-9 pt-[clamp(44px,6vw,68px)] sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          <div>
            <Wordmark onDark height={74} />
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.7]">
              A Texas engineering firm named for the 254 counties of Texas.
              {isPrelaunch() ? " Opening soon." : ""}
            </p>
            {/*
              THE BADGE ROW IS GONE, BOTH OF THEM. Operator ruling, 2026-09-17.

              The SAM badge claimed a federal registration the firm does not
              hold. "Veteran owned" is TRUE, and it came off anyway, because a
              badge is the shape a credential takes: a reader parses a row of
              badges as things an authority has granted, and a true statement
              about the owner sitting beside a false one about the government
              borrows its costume. It belongs in prose, and that is where it now
              lives.
            */}
          </div>

          <FooterColumn title="Explore">
            {services.slice(0, 5).map((s) => (
              <FooterLink key={s.slug} href={`/services/${s.slug}`}>
                {s.shortName}
              </FooterLink>
            ))}
            <FooterLink href="/services">All services</FooterLink>
          </FooterColumn>

          <FooterColumn title="Coverage">
            {regions.slice(0, 5).map((r) => (
              <FooterLink key={r.slug} href={`/coverage/${r.slug}`}>
                {r.name}
              </FooterLink>
            ))}
            <FooterLink href="/coverage">All 254 counties</FooterLink>
          </FooterColumn>

          <div>
            <p className="mb-3.5 text-[12.5px] font-bold tracking-[0.12em] text-[#8a99b5] uppercase">
              Company
            </p>
            <nav className="flex flex-col gap-2.5">
              <FooterLink href="/about">About the firm</FooterLink>
              <FooterLink href="/government">Government and commercial</FooterLink>
              <FooterLink href="/insights">Insights</FooterLink>
              <FooterLink href="/careers">Careers</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </nav>
            <p className="mt-5 text-[12.5px] font-bold tracking-[0.12em] text-[#8a99b5] uppercase">
              Contact
            </p>
            <a
              href={`mailto:${business.email}`}
              /* A mail link is a tap target like any other. It was 23px tall. */
              className="mt-2 flex min-h-[44px] items-center text-[15px] font-semibold text-brass transition-colors hover:text-brass-light"
            >
              {business.email}
            </a>
            <p className="mt-3 text-[14px] leading-[1.65]">
              Capability statement available on request.
            </p>
          </div>
        </div>

        {/* The compliance block. v5's treatment, the gate's words. */}
        <div className="mt-[clamp(36px,5vw,52px)] border-t border-white/[0.14] py-[26px]">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-display text-[15px] font-semibold text-slate-fg">{business.name}</p>
            <p className="mt-2 text-[14.5px] leading-[1.65] text-[#dce2eb]">{registrationLine()}</p>
          </div>
        </div>

        <div className="border-t border-white/[0.14] py-6">
          <div className="flex flex-col gap-3 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Copyright {year} {business.legalName}. All rights reserved.
            </p>
            {/* The negative margin keeps the visual position while the padding
                grows the target: without it the row would gain 24px of height it
                does not need. gap-2 plus the padding keeps adjacent targets
                further apart than the 8px minimum. */}
            <p className="-my-3 flex gap-2">
              <Link
                href="/privacy"
                className="flex min-h-[44px] items-center px-3 transition-colors hover:text-brass"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="flex min-h-[44px] items-center px-3 transition-colors hover:text-brass"
              >
                Terms
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}

/*
 * `Badge` was deleted with the badge row rather than left behind unused. A
 * credential badge component sitting in the file is the thing somebody reaches
 * for the next time a claim needs somewhere to go, and this whole ruling exists
 * because a badge was easy to place.
 */

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3.5 text-[12.5px] font-bold tracking-[0.12em] text-[#8a99b5] uppercase">
        {title}
      </p>
      <nav className="flex flex-col gap-2.5">{children}</nav>
    </div>
  );
}

/**
 * A footer link, sized for a thumb.
 *
 * The text is 14.5px and the line box was 22px tall, so every one of these was a
 * 22 pixel target stacked directly against its neighbour. On a phone that is the
 * difference between reaching the page you wanted and reaching the one below it.
 *
 * `min-h-[44px]` with the text centred gives the full 44, and because these sit
 * in a flex column the height itself provides the separation between adjacent
 * targets: no two are closer than the 8px the app feel standard asks for. The
 * link stays full width, so the target is the row rather than the words.
 */
function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center text-[14.5px] font-medium text-[#dce2eb] transition-colors hover:text-brass"
    >
      {children}
    </Link>
  );
}
