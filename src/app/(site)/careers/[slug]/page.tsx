import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { ApplicationFlow } from "@/components/careers/ApplicationFlow";
import { Rule, SectionHeading } from "@/components/ui/primitives";
import { Section, SectionHead } from "@/components/ui/section";
import { StickyApply } from "@/components/careers/StickyApply";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, jobPostingSchema } from "@/lib/schema";
import { openPositions, positionBySlug, positionDescription, positions } from "@data/positions";
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
            description: positionDescription(position),
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
          <aside className="border-l-4 border-brass bg-white/[0.07] px-5 py-[18px]">
            <p className="text-[0.96rem] leading-[1.65] text-slate-fg-muted">
              This position is closed. The description is kept here so that links to it still lead
              somewhere honest.
            </p>
          </aside>
        ) : isPrelaunch() ? (
          <aside className="border-l-4 border-brass bg-white/[0.07] px-5 py-[18px]">
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

      {/* The argument for the seat, and the band this page most wants
          remembered. It had ten sections and one dark band, at the very end. */}
      <section id="about-role" className="border-b border-limestone-line bg-gradient-to-b from-slate to-slate-deep text-slate-fg">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead
                onDark
                eyebrow="About the role"
                title="The seat, in plain terms"
                level="h2"
              />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              {position.about.map((paragraph, i) => (
                <p
                  key={i}
                  // On the navy band. Authored as text-slate-muted, which
                  // measured 2.00:1 here.
                  className={`text-[1.02rem] leading-[1.75] text-slate-fg-muted ${i > 0 ? "mt-6" : ""}`}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* What you will do. Concrete, and deliberately separate from the argument
          for the seat above it: a candidate deciding whether to apply reads the
          argument, one deciding whether they can do the job reads this. */}
      <Section id="what-you-will-do" tone="sunk">
        <SectionHead
          eyebrow="What you will do"
          title="The work itself"
          lede="Stated as tasks rather than as a mission, because this is the part that decides whether the seat is a fit."
        />
        <ul className="mt-8 grid gap-[18px] sm:grid-cols-2">
          {position.responsibilities.map((item) => (
            <li
              key={item}
              className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-5"
            >
              <span className="text-[15.5px] leading-[1.7] text-slate-muted">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Requirements and pluses */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading eyebrow="What we look for" title="Required" />
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
              <SectionHeading eyebrow="What we look for" title="Preferred" />
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
              <SectionHead
                eyebrow="How you will work"
                title="The engagement, stated before the offer"
                level="h2"
              />
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

      {/* Compensation structure. Structure only, never a figure: the number is
          agreed with the person at the same time as the commitment it attaches
          to, and publishing one before that conversation invents it. */}
      <Section id="compensation" tone="sunk">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead
              eyebrow="Compensation"
              title="How pay is structured"
              level="h2"
            />
            <Rule className="mt-5" />
            <p className="mt-6 text-[14.5px] leading-[1.65] text-slate-muted">
              How pay is structured. Figures are settled in the offer conversation rather than
              published, because the commitment they attach to is agreed at the same time.
            </p>
          </div>
          <div className="lg:col-span-8">
            <ul className="space-y-4">
              {position.compensationStructure.map((item) => (
                <li key={item} className="flex gap-4">
                  <span aria-hidden="true" className="mt-[0.7rem] h-px w-4 shrink-0 bg-brass" />
                  <span className="text-[16px] leading-[1.75] text-slate-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Growth, stated as intent. A firm at this stage promising a career path
          is making a claim it cannot keep, so the copy says intent and the
          contractual parts are named separately. */}
      <Section id="growth" tone="white">
        <SectionHead
          eyebrow="Growth"
          title="What this seat is intended to become"
          lede="Written as intent rather than as a promise, because a firm at launch cannot promise a path and should not pretend to."
        />
        <ul className="mt-8 space-y-4">
          {position.growth.map((item) => (
            <li key={item} className="flex gap-4">
              <span aria-hidden="true" className="mt-[0.7rem] h-px w-4 shrink-0 bg-brass" />
              <span className="max-w-[74ch] text-[16px] leading-[1.75] text-slate-muted">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </Section>

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
                      className="flex min-h-[44px] items-center font-sans text-[1rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
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

{/*
        Sticky apply, mobile only, and it removes itself once the form is on
        screen. See the note in StickyApply: a sticky element never overlaps the
        content it is about, and on the licensure step of a five step form this
        bar was covering a field's worth of a small screen to offer a link to
        where the reader already was.

        It is the only sticky bar on this route. The rule is one at a time: the
        header's nav is at the top, this is at the bottom, nothing else sticks.
      */}
      {position.open ? <StickyApply targetId="apply" label="Apply for this position" /> : null}
    </>
  );
}
