import { Container } from "@/components/ui/Container";
import { ButtonLink, Eyebrow, Rule } from "@/components/ui/primitives";

/**
 * The 404.
 *
 * It offers the three places somebody who mistyped a URL was most likely
 * heading, rather than a dead end with a link home. A 404 that only says "not
 * found" makes the visitor do the navigation work a second time.
 */
export default function NotFound() {
  return (
    <section>
      <Container>
        <div className="py-24 sm:py-32">
          <div className="max-w-2xl">
            <Eyebrow>404</Eyebrow>
            <h1 className="mt-4 text-[2.1rem] leading-[1.15] font-semibold text-slate sm:text-[2.75rem]">
              That page is not here
            </h1>
            <Rule className="mt-8" />
            <p className="mt-8 text-[1.05rem] leading-[1.7] text-slate-muted">
              The address does not match anything on this site. It may have been mistyped, or it may
              be a page that has not been built yet. Individual county pages, for instance, do not
              exist: coverage is published by region.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/services">Service lines</ButtonLink>
              <ButtonLink href="/coverage" tone="secondary">
                Coverage across Texas
              </ButtonLink>
              <ButtonLink href="/contact" tone="secondary">
                Contact
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
