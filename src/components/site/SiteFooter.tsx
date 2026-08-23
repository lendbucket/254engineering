import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { business } from "@/config/business";
import { registrationLine } from "@/lib/launch";
import { services } from "@/content/services";
import { regions } from "@/content/regions";

/**
 * The site footer.
 *
 * The registration line at the bottom is the compliance surface: it appears on
 * every page of the site because that is where a disclosure of pending firm
 * registration has to appear, and because once the registration is active the
 * same line carries the TBPELS firm number, which Texas rules require on the
 * firm's public representations. One component, both states, no page able to
 * forget it. See src/lib/launch.ts.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-slate-ink text-slate-fg-muted">
      <Container>
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="lg:pr-6">
            <Wordmark onDark />
            <p className="mt-5 max-w-xs text-[0.92rem] leading-[1.65]">
              Named for the 254 counties of Texas. A veteran owned engineering firm built to serve
              every one of them.
            </p>
            <p className="mt-5 text-[0.92rem]">
              <a
                href={`mailto:${business.email}`}
                className="text-slate-fg underline decoration-brass-light/60 underline-offset-4 transition-colors hover:decoration-brass-light"
              >
                {business.email}
              </a>
            </p>
          </div>

          <FooterColumn title="Services">
            {services.slice(0, 6).map((s) => (
              <FooterLink key={s.slug} href={`/services/${s.slug}`}>
                {s.shortName}
              </FooterLink>
            ))}
            <FooterLink href="/services">All services</FooterLink>
          </FooterColumn>

          <FooterColumn title="Coverage">
            {regions.map((r) => (
              <FooterLink key={r.slug} href={`/coverage/${r.slug}`}>
                {r.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Firm">
            <FooterLink href="/about">About the firm</FooterLink>
            <FooterLink href="/government">Government and public sector</FooterLink>
            <FooterLink href="/insights">Insights</FooterLink>
            <FooterLink href="/careers">Careers</FooterLink>
            <FooterLink href="/coverage">All 254 counties</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </FooterColumn>
        </div>

        <div className="border-t border-white/12 py-8">
          <p className="text-[0.85rem] leading-[1.7] text-slate-fg-muted">{registrationLine()}</p>
          <div className="mt-4 flex flex-col gap-3 text-[0.85rem] sm:flex-row sm:items-center sm:justify-between">
            <p>
              Copyright {year} {business.legalName}. All rights reserved.
            </p>
            <p className="flex gap-5">
              <Link href="/privacy" className="transition-colors hover:text-slate-fg">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-slate-fg">
                Terms
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-light uppercase">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-[0.92rem] transition-colors hover:text-slate-fg">
        {children}
      </Link>
    </li>
  );
}
