import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { LeadForm } from "@/components/forms/LeadForm";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { Eyebrow, Rule } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";
import { isPrelaunch } from "@/lib/launch";
import { services } from "@/content/services";

export const metadata: Metadata = buildMetadata({
  title: "Contact a Texas Engineering Firm | 254 Engineering",
  description:
    "Contact a veteran owned Texas engineering firm serving all 254 counties. Send the project, the property, or the solicitation for a direct answer.",
  path: "/contact",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Contact", path: "/contact" },
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const prelaunch = isPrelaunch();

  /*
   * THE LINE THE READER CAME TO ASK ABOUT, PRESELECTED. Operator ruling,
   * 2026-10-03, instruction 2: a line that cannot be ordered online shows
   * "Request a quote" and goes "to /contact with the service preselected".
   *
   * LeadForm has taken `defaultService` since it was written, with a comment
   * saying it is "pre-selected when the visitor arrived from a specific service
   * page". Nothing ever passed it from here, so every reader arriving from a
   * service card landed on an unselected dropdown and had to find their own line
   * again. The prop was built for this and had no caller.
   *
   * A SLUG ARRIVES AND A NAME IS SELECTED, because the form's options are names.
   * An unknown slug selects nothing rather than inventing an option, which is
   * the safe direction: a stranger passing ?service=anything cannot put a string
   * of their choosing into a field this firm reads.
   */
  const params = await searchParams;
  const defaultService = services.find((s) => s.slug === params.service)?.name;

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Contact"
        title="Contact 254 Engineering Services"
        lede="Send what you are working on and you will get a direct answer, including when the answer is that this is not work the firm should take."
        crumbs={crumbs}
      >
        {prelaunch ? <PrelaunchNotice /> : null}
      </PageHeader>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow>How to reach the firm</Eyebrow>
              <Rule className="mt-5" />

              <dl className="mt-9 divide-y divide-limestone-line border-t border-limestone-line">
                <div className="py-5">
                  <dt className="font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                    Email
                  </dt>
                  <dd className="mt-2">
                    <a
                      href={`mailto:${business.email}`}
                      className="flex min-h-[44px] items-center text-[1.02rem] text-slate underline decoration-brass/60 underline-offset-4 transition-colors hover:decoration-brass"
                    >
                      {business.email}
                    </a>
                  </dd>
                </div>
                <div className="py-5">
                  <dt className="font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                    Coverage
                  </dt>
                  <dd className="mt-2 text-[0.98rem] leading-[1.65] text-slate-muted">
                    All 254 Texas counties, across{" "}
                    <Link
                      href="/coverage"
                      className="text-slate underline decoration-brass/60 underline-offset-4 transition-colors hover:decoration-brass"
                    >
                      eight coverage regions
                    </Link>
                    .
                  </dd>
                </div>
                <div className="py-5">
                  <dt className="font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                    Public sector
                  </dt>
                  <dd className="mt-2 text-[0.98rem] leading-[1.65] text-slate-muted">
                    Contracting officers and procurement staff should start at the{" "}
                    <Link
                      href="/government"
                      className="text-slate underline decoration-brass/60 underline-offset-4 transition-colors hover:decoration-brass"
                    >
                      capability statement
                    </Link>
                    , which states the firm&apos;s registration status as it currently stands.
                  </dd>
                </div>
                <div className="py-5">
                  <dt className="font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                    Working here
                  </dt>
                  <dd className="mt-2 text-[0.98rem] leading-[1.65] text-slate-muted">
                    Engineers and field technicians should apply through{" "}
                    <Link
                      href="/careers"
                      className="text-slate underline decoration-brass/60 underline-offset-4 transition-colors hover:decoration-brass"
                    >
                      careers
                    </Link>{" "}
                    rather than this form, so the application reaches the right place.
                  </dd>
                </div>
              </dl>

              <p className="mt-8 text-[0.92rem] leading-[1.7] text-slate-muted">
                No telephone number is published yet. When one is, it will appear here and on every
                page of this site rather than only where it is convenient.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[3px] border border-limestone-line bg-limestone-raised p-7 sm:p-9">
                <h2 className="text-[1.35rem] font-semibold text-slate">Send a message</h2>
                <p className="mt-3 text-[0.96rem] leading-[1.65] text-slate-muted">
                  The more specific you are about the property, the deliverable, and the date it has
                  to be in hand, the more useful the reply will be.
                </p>
                <div className="mt-8">
                  <LeadForm
                    variant="contact"
                    serviceOptions={services.map((s) => s.name)}
                    defaultService={defaultService}
                  />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
