import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "./Breadcrumbs";
import { Eyebrow } from "@/components/ui/primitives";
import type { Crumb } from "@/lib/schema";

/**
 * The masthead every page below the homepage carries.
 *
 * The H1 is set here and nowhere else on these pages, which is what keeps the
 * rule that each page has exactly one and that it leads with the page's primary
 * keyword. `lede` is the sentence a search result would want to have shown, and
 * it is written to be readable on its own rather than as a continuation of the
 * heading.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  crumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  crumbs: Crumb[];
  /** Anything that belongs directly under the lede, such as the prelaunch notice. */
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-limestone-line bg-limestone">
      <Container>
        <div className="py-10 sm:py-14">
          <Breadcrumbs crumbs={crumbs} />
          <div className="mt-8 max-w-3xl">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 className="mt-3 text-[2rem] leading-[1.14] font-semibold text-slate sm:text-[2.75rem]">
              {title}
            </h1>
            {lede ? (
              <div className="mt-6 text-[1.08rem] leading-[1.68] text-slate-muted">{lede}</div>
            ) : null}
          </div>
          {children ? <div className="mt-8 max-w-3xl">{children}</div> : null}
        </div>
      </Container>
    </section>
  );
}
