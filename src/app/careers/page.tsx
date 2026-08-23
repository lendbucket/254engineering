import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { Eyebrow, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, jobPostingSchema } from "@/lib/schema";
import { isPrelaunch } from "@/lib/launch";
import { openings } from "@/content/openings";

export const metadata: Metadata = buildMetadata({
  title: "Engineering Careers Across Texas | 254 Engineering",
  description:
    "Two tracks: Texas licensed Professional Engineers for review and engineer of record work, and field inspection technicians statewide. Apply from here.",
  path: "/careers",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Careers", path: "/careers" },
];

export default function CareersPage() {
  const prelaunch = isPrelaunch();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {openings.map((opening) => (
        <JsonLd key={opening.anchor} data={jobPostingSchema(opening)} />
      ))}

      <PageHeader
        eyebrow="Careers"
        title="Engineering careers across Texas"
        lede="Two tracks, and they are genuinely different jobs. Licensed Professional Engineers review and seal the work. Field inspection technicians collect the evidence the engineers review. Both are described here as they actually are, including the parts people usually find out about later."
        crumbs={crumbs}
      >
        {prelaunch ? (
          <aside className="rounded-[3px] border border-brass/45 bg-limestone-raised px-5 py-4 sm:px-6 sm:py-5">
            <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
              Building the bench
            </p>
            <p className="mt-2.5 text-[0.96rem] leading-[1.65] text-slate-muted">
              Firm registration with the Texas Board of Professional Engineers and Land Surveyors is
              pending, so no assignments are being dispatched yet. Applications are open and are
              being read now, which is the point: the bench has to exist before the first job does.
            </p>
          </aside>
        ) : null}
      </PageHeader>

      {/* Track one: PE */}
      <section id="professional-engineers" className="border-b border-limestone-line scroll-mt-8">
        <Container>
          <div className="py-14 sm:py-18">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Eyebrow>Track one</Eyebrow>
                <h2 className="mt-3 text-[1.85rem] leading-[1.2] font-semibold text-slate sm:text-[2.2rem]">
                  Texas licensed Professional Engineers
                </h2>
                <Rule className="mt-7" />

                <div className="mt-8 space-y-6 text-[1rem] leading-[1.75] text-slate-muted">
                  <p>
                    Two roles. A review engineer reads field records produced to a written protocol,
                    forms the opinion, and seals the deliverable. An engineer of record takes
                    responsible charge of design work: foundations, framing, and the drawing sets
                    that get a project permitted.
                  </p>
                  <p>
                    The honest description of the review model is that it is remote and it is
                    volume oriented. You are not driving to properties. You are reading a
                    standardized record, applying judgment, and sealing a document that a lender, a
                    carrier, or a building official will rely on. Engineers who find that unappealing
                    should say so early, and engineers who have been looking for exactly that
                    arrangement usually recognize it immediately.
                  </p>
                  <p>
                    What does not change is responsible charge. If the record in front of you does
                    not support an opinion, the answer is that it does not, and the job goes back to
                    the field. Nobody in this firm is authorized to ask you to seal past that, and
                    a firm that would ask is one that eventually costs an engineer their licence
                    rather than its own.
                  </p>
                  <p>
                    A windstorm inspection appointment from the Texas Department of Insurance is not
                    required and is a considerable plus. It is the credential that makes coastal
                    WPI-8 work possible at all, it takes real effort to obtain, and it is valued
                    here accordingly.
                  </p>
                </div>

                <div className="mt-9 rounded-[3px] border border-limestone-line bg-limestone-sunk p-6">
                  <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
                    What is expected
                  </p>
                  <ul className="mt-4 space-y-3">
                    {[
                      "An active Texas PE license in good standing.",
                      "Structural competence in residential and light commercial work, or a discipline you can demonstrate.",
                      "Willingness to work to a written review standard rather than to personal preference.",
                      "A clear line about what you will and will not seal.",
                    ].map((item) => (
                      <li key={item} className="flex gap-4">
                        <span aria-hidden="true" className="mt-[0.6rem] h-px w-4 shrink-0 bg-brass" />
                        <span className="text-[0.95rem] leading-[1.65] text-slate-muted">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-[3px] border border-limestone-line bg-limestone-raised p-7 sm:p-8">
                  <h3 className="text-[1.25rem] font-semibold text-slate">
                    Apply as a Professional Engineer
                  </h3>
                  <p className="mt-3 text-[0.95rem] leading-[1.65] text-slate-muted">
                    A person reads every one of these. Expect a direct answer, including when it is
                    that the firm is not in a position to bring you on yet.
                  </p>
                  <div className="mt-8">
                    <ApplicationForm track="engineer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Track two: technicians */}
      <section id="field-technicians" className="border-b border-limestone-line bg-limestone-sunk scroll-mt-8">
        <Container>
          <div className="py-14 sm:py-18">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Eyebrow>Track two</Eyebrow>
                <h2 className="mt-3 text-[1.85rem] leading-[1.2] font-semibold text-slate sm:text-[2.2rem]">
                  Field inspection technicians
                </h2>
                <Rule className="mt-7" />

                <div className="mt-8 space-y-6 text-[1rem] leading-[1.75] text-slate-muted">
                  <p>
                    Technicians go to properties across Texas and collect the evidence a reviewing
                    engineer needs: measurements, photographs keyed to locations, and the specific
                    observations the protocol for that service calls for. It is precise work and it
                    is not decision making. What a technician records is what the engineer reads.
                  </p>
                  <p>
                    The arrangement, stated plainly rather than discovered later. This is
                    independent contractor work. Jobs are dispatched and you accept or decline each
                    one, with no obligation either way and no penalty for declining. Pay is a flat
                    rate per completed inspection, agreed per service line before you take an
                    assignment, so what you earn on a job is known when you accept it rather than
                    after.
                  </p>
                  <p>
                    Protocol certification comes before the first assignment. Every service line has
                    its own written protocol and you are certified on it before you are dispatched on
                    it. That is not a hurdle put in front of you for its own sake: central review
                    only works if the record is consistent, and an uncertified inspection is a
                    wasted trip for you and an unreviewable file for the engineer.
                  </p>
                  <p>
                    What makes someone good at this is reliability and thoroughness rather than
                    engineering knowledge. Backgrounds that transfer well include roofing,
                    construction, home inspection, insurance adjusting, the trades, and the military.
                  </p>
                </div>

                <div className="mt-9 rounded-[3px] border border-limestone-line bg-limestone-raised p-6">
                  <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
                    What is expected
                  </p>
                  <ul className="mt-4 space-y-3">
                    {[
                      "A reliable vehicle and a willingness to drive to the far edge of the counties you claim.",
                      "Comfort on a ladder and around a roof, worked safely and never past what conditions allow.",
                      "Thorough documentation, including recording what could not be observed rather than leaving a gap.",
                      "Protocol certification before a first assignment on any service line.",
                    ].map((item) => (
                      <li key={item} className="flex gap-4">
                        <span aria-hidden="true" className="mt-[0.6rem] h-px w-4 shrink-0 bg-brass" />
                        <span className="text-[0.95rem] leading-[1.65] text-slate-muted">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-[3px] border border-limestone-line bg-limestone-raised p-7 sm:p-8">
                  <h3 className="text-[1.25rem] font-semibold text-slate">
                    Apply as a field inspection technician
                  </h3>
                  <p className="mt-3 text-[0.95rem] leading-[1.65] text-slate-muted">
                    Be honest about the counties you will actually drive to. An overstated radius
                    produces declined dispatches, which helps nobody.
                  </p>
                  <div className="mt-8">
                    <ApplicationForm track="technician" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container>
          <div className="py-14 sm:py-16">
            <SectionHeading
              eyebrow="Equal opportunity"
              title="How applications are considered"
              lede="Applications are read by a person and considered on the qualifications the role actually requires. This firm does not discriminate on race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, genetic information, veteran status, or any other basis protected by federal or Texas law."
            />
          </div>
        </Container>
      </section>
    </>
  );
}
