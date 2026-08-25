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
 * THE REGISTRATION LINE IS NOT FINE PRINT
 * ---------------------------------------
 * It appears on every page because that is where a disclosure of pending firm
 * registration belongs, and because once the registration is active the same
 * line carries the TBPELS firm number, which Texas rules require on the firm's
 * public representations. One component, both states, no page able to forget it.
 * See src/lib/launch.ts.
 *
 * It used to be set at the same size as the copyright notice and directly above
 * it, which put a regulatory disclosure in the visual register of a legal
 * boilerplate nobody reads. That is the wrong register for it in both
 * directions: it made the firm look like it was hiding a pending registration,
 * and it made the line easy to miss for the procurement officer who is
 * specifically looking for it.
 *
 * So it now sits in its own band above the copyright, on the deeper navy, with a
 * gold rule, a label, and type a size larger than the links around it. The firm
 * is stating where it is in its own formation. That reads better said plainly
 * than whispered.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-slate-ink text-slate-fg-muted">
      <Container>
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
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

        <div className="border-t border-slate-fg/15 py-10">
          <p className="font-sans text-[0.7rem] font-semibold tracking-[0.2em] text-brass-light uppercase">
            Regulatory status
          </p>
          <span aria-hidden="true" className="mt-4 block h-px w-16 bg-brass" />
          <p className="mt-5 max-w-3xl text-[0.98rem] leading-[1.75] text-slate-fg">
            {registrationLine()}
          </p>
        </div>

        <div className="border-t border-slate-fg/15 py-7">
          <div className="flex flex-col gap-3 text-[0.85rem] sm:flex-row sm:items-center sm:justify-between">
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
