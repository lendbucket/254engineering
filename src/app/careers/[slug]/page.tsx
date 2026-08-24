import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { ApplicationFlow } from "@/components/careers/ApplicationFlow";
import { Eyebrow, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, jobPostingSchema } from "@/lib/schema";
import { openPositions, positionBySlug, positions } from "@data/positions";
import { isPrelaunch } from "@/lib/launch";

/**
 * A position page.
 *
 * Generated from data/positions.ts so that closing a role removes the page, the
 * listing, and the JobPosting markup in one edit. `dynamicParams` is false
 * because a position that is not in the file is a 404 rather than an empty page
 * waiting for content.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return positions.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const position = positionBySlug(slug);
  if (!position) return {};
  return buildMetadata({
    title: position.metaTitle,
    description: position.metaDescription,
    path: `/careers/${position.slug}`,
    // A closed role keeps its page so links do not rot, and stops being indexed.
    noIndex: !position.open,
  });
}

export default async function PositionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const position = positionBySlug(slug);
  if (!position) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Careers", path: "/careers" },
    { name: position.shortTitle, path: `/careers/${position.slug}` },
  ];

  const others = openPositions().filter((p) => p.slug !== position.slug);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {position.open ? (
        <JsonLd
          data={jobPostingSchema({
            title: position.title,
            description: position.about.join(" "),
            employmentType: position.employmentType,
            datePosted: position.datePosted,
            validThrough: position.validThrough,
            remote: position.remote,
            anchor: position.slug,
          })}
        />
      ) : null}

      <PageHeader
        eyebrow="Open position"
        title={position.title}
        lede={position.teaser}
        crumbs={crumbs}
      >
        {!position.open ? (
          <aside className="rounded-[3px] border border-slate-fg/20 bg-slate/40 px-5 py-4">
            <p className="text-[0.96rem] leading-[1.65] text-slate-fg-muted">
              This position is closed. The description is kept here so that links to it still lead
              somewhere honest.
            </p>
          </aside>
        ) : isPrelaunch() ? (
          <aside className="rounded-[3px] border border-brass/50 bg-slate/40 px-5 py-4 sm:px-6 sm:py-5">
            <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-light uppercase">
              Building the bench
            </p>
            <p className="mt-2.5 text-[0.96rem] leading-[1.65] text-slate-fg-muted">
              Firm registration with the Texas Board of Professional Engineers and Land Surveyors is
              pending and no engineer of record is yet in responsible charge, so no assignments are
              being dispatched. Applications are open and are being read now, which is the point:
              the bench has to exist before the first job does.
            </p>
          </aside>
        ) : null}
      </PageHeader>

      {/* The specification row */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <dl className="grid gap-8 py-10 sm:grid-cols-3">
            {[
              ["Engagement", position.engagement],
              ["Location", position.location],
              ["Compensation", position.compensation],
            ].map(([term, detail]) => (
              <div key={term}>
                <span aria-hidden="true" className="block h-px w-8 bg-brass" />
                <dt className="mt-4 font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                  {term}
                </dt>
                <dd className="mt-2 text-[0.97rem] leading-[1.6] text-slate">{detail}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* The role */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>The role</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              {position.about.map((paragraph, i) => (
                <p
                  key={i}
                  className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Requirements and pluses */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading eyebrow="Requirements" title="What this seat needs" />
              <ul className="mt-8 space-y-4">
                {position.requirements.map((item) => (
                  <li key={item} className="flex gap-4">
                    <span aria-hidden="true" className="mt-[0.65rem] h-px w-4 shrink-0 bg-brass" />
                    <span className="text-[0.97rem] leading-[1.7] text-slate-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionHeading eyebrow="Strong pluses" title="What moves an application up" />
              <ul className="mt-8 space-y-4">
                {position.pluses.map((item) => (
                  <li key={item} className="flex gap-4">
                    <span aria-hidden="true" className="mt-[0.65rem] h-px w-4 shrink-0 bg-brass" />
                    <span className="text-[0.97rem] leading-[1.7] text-slate-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* Engagement model */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>The engagement</Eyebrow>
              <Rule className="mt-5" />
              <p className="mt-6 text-[0.92rem] leading-[1.65] text-slate-muted">
                Stated here rather than at the offer, because this is the part people usually find
                out about last.
              </p>
            </div>
            <div className="lg:col-span-8">
              {position.engagementDetail.map((paragraph, i) => (
                <p
                  key={i}
                  className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* The application */}
      {position.open ? (
        <section id="apply" className="scroll-mt-4 border-b border-limestone-line bg-limestone-sunk">
          <Container width="prose">
            <div className="py-14 sm:py-18">
              <SectionHeading
                eyebrow="Apply"
                title={`Apply for ${position.shortTitle.toLowerCase()}`}
                lede="Five steps, about ten minutes. Your answers are kept on this device as you go, so a phone call in the middle of it does not cost you the application."
              />
              <div className="mt-10">
                <ApplicationFlow track={position.track} />
              </div>
            </div>
          </Container>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="border-b border-limestone-line">
          <Container>
            <div className="py-12">
              <SectionHeading eyebrow="Also open" title="The other position" level="h2" />
              <ul className="mt-6">
                {others.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/careers/${p.slug}`}
                      className="font-sans text-[1rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* Sticky apply, mobile only. */}
      {position.open ? (
        <div className="sticky bottom-0 z-40 border-t border-limestone-line bg-limestone-raised/95 backdrop-blur md:hidden">
          <Container>
            <div className="py-3">
              <a
                href="#apply"
                className="flex min-h-[48px] w-full items-center justify-center rounded-[3px] bg-slate px-6 font-sans text-[0.94rem] font-semibold text-slate-fg"
              >
                Apply for this position
              </a>
            </div>
          </Container>
        </div>
      ) : null}
    </>
  );
}
