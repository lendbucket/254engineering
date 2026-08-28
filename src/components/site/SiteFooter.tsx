import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { business, samRegistration } from "@/config/business";
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
 * SAM REGISTERED IS A CLAIM AND IS GATED LIKE ONE
 * -----------------------------------------------
 * v5 prints a "SAM registered" badge unconditionally. BACKLOG records that the
 * flag is true on the operator's instruction and has never been checked against
 * the live SAM record, which is also why the UEI and CAGE are withheld from
 * /government. The badge is therefore rendered through `samRegistration`, so
 * setting that flag false removes the claim from every surface at once rather
 * than leaving a hardcoded one behind in new markup.
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Veteran owned</Badge>
              {samRegistration.registered ? <Badge>SAM registered</Badge> : null}
            </div>
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
              className="mt-2 block text-[15px] font-semibold text-brass transition-colors hover:text-brass-light"
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
            <p className="flex gap-5">
              <Link href="/privacy" className="transition-colors hover:text-brass">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-brass">
                Terms
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[2px] border border-white/25 px-2.5 py-[5px] text-[12px] font-semibold tracking-[0.06em] text-[#dce2eb] uppercase">
      {children}
    </span>
  );
}

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

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[14.5px] font-medium text-[#dce2eb] transition-colors hover:text-brass"
    >
      {children}
    </Link>
  );
}
