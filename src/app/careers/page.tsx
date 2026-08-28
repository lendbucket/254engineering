import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { CardGrid, cardCell, Eyebrow, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, jobPostingSchema } from "@/lib/schema";
import { isPrelaunch } from "@/lib/launch";
import { hiringProcess, openPositions } from "@data/positions";

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

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {open.map((position) => (
        <JsonLd
          key={position.slug}
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

      {/* Why 254 */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Why here"
              title="What this firm actually offers"
              lede="Stated without the things a careers page usually claims. There is no office, no team photograph, and no headcount, because the firm is being built and pretending otherwise would be the first thing you found out was untrue."
            />
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {[
                {
                  index: "01",
                  title: "Engagement that fits the work",
                  body: "A part time retainer for the engineer seat and per completed inspection for technicians. Nobody is asked to pretend a full time seat exists before the volume does, and nobody is asked to take a rate they have not seen.",
                },
                {
                  index: "02",
                  title: "The whole state, genuinely",
                  body: "Work across all 254 counties rather than one metro. For a technician that means claiming the counties you can actually reach. For an engineer it means volume from places most firms never send anybody.",
                },
                {
                  index: "03",
                  title: "Technology in the boring places",
                  body: "Dispatch, protocol capture, review queues, and delivery run on the firm's own systems. It means a field record arrives complete and a review is reading evidence rather than chasing it.",
                },
                {
                  index: "04",
                  title: "Professional standards that hold",
                  body: "Written protocols rather than individual habit, and responsible charge that is never asked to bend. If a record does not support an opinion, the answer is that it does not, and the job goes back to the field.",
                },
              ].map((item) => (
                <div key={item.index}>
                  <span className="font-sans text-[0.8rem] font-semibold tracking-[0.14em] text-brass-ink">
                    {item.index}
                  </span>
                  <span aria-hidden="true" className="mt-3 mb-4 block h-px w-10 bg-brass" />
                  <h3 className="text-[1.05rem] leading-[1.35] font-semibold text-slate">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[0.93rem] leading-[1.7] text-slate-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Hiring process */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="The process"
              title="What happens after you apply"
              lede="Five steps. You should be able to predict your next two weeks from this list."
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

      {/* Equal opportunity */}
      <section className="bg-limestone-sunk">
        <Container>
          <div className="grid gap-8 py-12 sm:py-14 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>Equal opportunity</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[0.98rem] leading-[1.75] text-slate-muted">
                Applications are read by a person and considered on the qualifications the role
                actually requires. {""}
                254 Engineering Services LLC does not discriminate on race, color, religion, sex,
                sexual orientation, gender identity, national origin, age, disability, genetic
                information, veteran status, or any other basis protected by federal or Texas law.
              </p>
              <p className="mt-5 text-[0.98rem] leading-[1.75] text-slate-muted">
                The application asks for nothing sensitive. No social security number, no date of
                birth, no identity documents, and no bank details are collected by this website. A
                background check may be requested later in the process, and if it is, it is handled
                directly with you rather than through a form.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
