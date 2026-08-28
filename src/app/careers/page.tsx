import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { CardGrid, cardCell, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema, jobPostingSchema } from "@/lib/schema";
import { isPrelaunch } from "@/lib/launch";
import { openPositions, positionDescription } from "@data/positions";
import {
  careersFaqs,
  engagementModels,
  equalOpportunity,
  hiringProcess,
  standardsAndIntegrity,
  workingModel,
} from "@/content/careers";
import { Section, SectionHead } from "@/components/ui/section";
import { FaqBlock } from "@/components/site/FaqBlock";

export const metadata: Metadata = buildMetadata({
  title: "Engineering Careers Across Texas | 254 Engineering",
  description:
    "Two open positions at a veteran owned Texas engineering firm serving all 254 counties: a licensed PE seat and field inspection work. Read the roles and apply.",
  path: "/careers",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Careers", path: "/careers" },
];

export default function CareersPage() {
  const open = openPositions();
  const faqs = careersFaqs();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {/*
        FAQPage from the same array the visible block renders.

        Structured data describing answers that are not on the page is a manual
        action waiting to happen, which is why both consumers read one source.
      */}
      <JsonLd data={faqSchema(faqs)} />
      {open.map((position) => (
        <JsonLd
          key={position.slug}
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
      ))}

      <PageHeader
        image={sectionPhotos.careers}
        eyebrow="Careers"
        title="Build a Texas engineering firm from the ground up"
        lede="254 Engineering Services is a veteran owned firm named for the 254 counties of Texas and built to serve every one of them, on licensed professional judgment and statewide field operations. These are the seats that make that possible."
        crumbs={crumbs}
      >
        {isPrelaunch() ? (
          <aside className="border-l-4 border-brass bg-white/[0.07] px-5 py-[18px]">
            <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-light uppercase">
              Where the firm is today
            </p>
            <p className="mt-2.5 text-[0.96rem] leading-[1.65] text-slate-fg-muted">
              Firm registration with the Texas Board of Professional Engineers and Land Surveyors is
              pending and no engineer of record is yet in responsible charge, so no assignments are
              being dispatched. Applications are open and are being read now. Anyone who joins is
              joining at the point where the firm becomes able to practise, not after it.
            </p>
          </aside>
        ) : null}
      </PageHeader>

      {/* How the firm works, told from the worker's side. */}
      <Section id="how-it-works-here" tone="white">
        <SectionHead
          eyebrow="Working here"
          title="What the operating model means for you"
          lede="The firm is built on written protocols, central engineering review, and its own operations software. That is the pitch to a buyer. This is what each of those four things means for the person doing the work."
        />
        <div className="mt-9 grid gap-[18px] sm:grid-cols-2">
          {workingModel().map((item) => (
            <div
              key={item.heading}
              className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6"
            >
              <h3 className="font-display text-[18px] leading-[1.3] font-bold text-slate">
                {item.heading}
              </h3>
              <p className="mt-2.5 text-[15px] leading-[1.7] text-slate-muted">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 border-l-4 border-brass bg-limestone px-5 py-[18px]">
          <p className="text-[12px] font-bold tracking-[0.1em] text-slate-muted uppercase">
            The honest stage
          </p>
          <p className="mt-2 max-w-[70ch] text-[15px] leading-[1.7] text-slate-muted">
            This is a firm at launch. There is no office, no team photograph, and no headcount,
            because there are none of those things yet. Somebody who wants to inherit a working
            system should not apply. Somebody who wants to set how one works should read the seats
            below, because the person who takes them writes the standard rather than following it.
          </p>
        </div>
      </Section>

      {/* How we engage. */}
      <Section id="how-we-engage" tone="sunk">
        <SectionHead
          eyebrow="How we engage"
          title="Two engagement models, stated up front"
          lede="Which one applies depends on the seat, and neither is discovered at the offer."
        />
        <div className="mt-9 grid gap-[18px] lg:grid-cols-2">
          {engagementModels.map((model) => (
            <div
              key={model.title}
              className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6 sm:p-7"
            >
              <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                {model.kind}
              </p>
              <h3 className="mt-2 font-display text-[21px] leading-[1.25] font-bold text-slate">
                {model.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-slate-muted">{model.body}</p>
              <ul className="mt-4 space-y-2.5">
                {model.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-[0.62rem] h-px w-3 shrink-0 bg-brass"
                    />
                    <span className="text-[14.5px] leading-[1.65] text-slate-muted">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Open positions */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Open positions"
              title={open.length === 1 ? "One open position" : `${open.length} open positions`}
              lede="Both are described as they actually are, including the engagement model and the parts people usually find out about late."
            />
            <CardGrid className="mt-11">
              {open.map((position) => (
                <li key={position.slug} className={cardCell}>
                  <Link
                    href={`/careers/${position.slug}`}
                    className="flex h-full flex-col p-7 transition-colors hover:bg-limestone sm:p-8"
                  >
                    <h3 className="text-[1.2rem] leading-[1.3] font-semibold text-slate">
                      {position.title}
                    </h3>
                    <p className="mt-3 flex-1 text-[0.96rem] leading-[1.68] text-slate-muted">
                      {position.teaser}
                    </p>
                    <dl className="mt-5 space-y-1.5 text-[0.88rem] text-slate-muted">
                      <div className="flex gap-2">
                        <dt className="sr-only">Engagement</dt>
                        <dd>{position.engagement}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="sr-only">Location</dt>
                        <dd>{position.location}</dd>
                      </div>
                    </dl>
                    <span className="mt-6 font-sans text-[0.82rem] font-semibold tracking-[0.06em] text-brass-ink uppercase">
                      Read the role
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
          </div>
        </Container>
      </section>

      {/* "What this firm actually offers" was folded into the working model
          section above. It argued the same four points, one of them under an
          identical title, and two versions of one argument on one page is how a
          reader stops believing either. */}
      {/* Hiring process */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="The process"
              title="What happens after you apply"
              // Counted from the array rather than typed. It said five while the
              // list had six the moment the process gained credential
              // verification and onboarding, which is exactly the kind of stale
              // number nobody re-reads.
              lede={`${hiringProcess.length} steps. You should be able to predict your next two weeks from this list.`}
            />
            <ol className="mt-11 divide-y divide-limestone-line border-t border-limestone-line">
              {hiringProcess.map((stage) => (
                <li key={stage.step} className="grid gap-3 py-7 sm:grid-cols-12 sm:gap-8">
                  <div className="sm:col-span-3">
                    <span className="font-sans text-[0.8rem] font-semibold tracking-[0.14em] text-brass-ink">
                      {stage.step}
                    </span>
                    <h3 className="mt-2 text-[1.08rem] leading-[1.3] font-semibold text-slate">
                      {stage.title}
                    </h3>
                  </div>
                  <p className="text-[0.97rem] leading-[1.72] text-slate-muted sm:col-span-9">
                    {stage.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* Standards and integrity. The recruiting asset, so it gets a navy band
          and real estate rather than a paragraph at the bottom. */}
      <Section id="standards" tone="navy">
        <SectionHead
          eyebrow="Standards and integrity"
          title="What a licensed engineer is protected by here"
          lede="The reason an engineer would take a seat at a firm this young is that the arrangement is written down rather than promised. These four are contractual, not cultural."
          onDark
        />
        <div className="mt-9 grid gap-[18px] sm:grid-cols-2">
          {standardsAndIntegrity().map((item) => (
            <div key={item.heading} className="border-l-4 border-brass bg-white/[0.07] p-6">
              <h3 className="font-display text-[18px] leading-[1.3] font-bold text-slate-fg">
                {item.heading}
              </h3>
              <p className="mt-2.5 text-[15px] leading-[1.7] text-slate-fg-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* The FAQ, feeding the schema above from the same array. */}
      <Section id="questions" tone="white">
        <FaqBlock faqs={faqs} title="Questions candidates actually ask" />
      </Section>

      {/* Equal opportunity, full statement, its own block. */}
      <Section tone="sunk">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead
              eyebrow="Equal opportunity"
              title="How applications are read"
              level="h2"
            />
            <Rule className="mt-5" />
          </div>
          <div className="lg:col-span-8">
            {equalOpportunity.map((para) => (
              <p key={para.slice(0, 40)} className="mt-5 text-[16px] leading-[1.75] text-slate-muted first:mt-0">
                {para}
              </p>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
