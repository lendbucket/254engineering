import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { CredentialsStrip } from "@/components/site/CredentialsStrip";
import { OfferCta } from "@/components/launch/OfferCta";
import { Eyebrow, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";
import {
  centralReviewCopy,
  responsibleChargeCopy,
  specialistsCopy,
} from "@/content/model-copy";

export const metadata: Metadata = buildMetadata({
  title: "About Our Texas Engineering Firm | 254 Engineering",
  description:
    "A veteran owned Texas engineering firm named for the 254 counties of Texas. How the firm is organized, and why it is organized that way. Read the model.",
  path: "/about",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="The firm"
        title="A Texas engineering firm built for all 254 counties"
        lede="254 Engineering Services is a veteran owned engineering firm serving the whole state of Texas. This page explains how it is put together and why, because the how is the part that determines whether a firm can actually do what it says it covers."
        crumbs={crumbs}
      />

      {/* The name */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>The name</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.18rem] leading-[1.6] font-medium text-slate">
                Texas has 254 counties. No other state has more than half that.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                The number is easy to say and hard to appreciate until you try to serve it. Loving
                County has fewer than a hundred residents. Harris County has more than four and a
                half million. Brewster County is larger than Connecticut, Rhode Island, and Delaware
                together. Between them the state contains a hurricane coast, a high plains wind
                environment, some of the most expansive clay soils in North America, limestone karst,
                collapsing gypsum, and about twelve hundred incorporated cities with their own views
                on what a permit requires.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                The ordinary way a Texas engineering firm handles that is to pick a metro and stop at
                the county line. It is a sound decision and it leaves most of the state served by
                whoever happens to drive out. This firm took the number as its name because it took
                the opposite position: that the problem with statewide coverage is organizational
                rather than technical, and that a firm which solves the organizational problem first
                can hold one standard across all 254 counties instead of a different standard in
                each.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                Naming the firm after the commitment is a way of not being able to quietly abandon
                it.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* The model */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="The model"
              title="Standard field protocols, central engineering review"
              lede="Two things do not scale the same way. Being physically present at a property scales with people and vehicles. Professional judgment scales with the licensed engineer exercising it. Treating them as one job is what limits a firm to the distance one engineer can drive."
            />

            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
              <ModelBlock
                index="01"
                title="Standardized field protocols"
                paragraphs={[
                  "Each service line has a written inspection protocol: what is measured, what is photographed, in what order, and what has to be recorded when a condition cannot be observed. It is a document, not a habit, and it is the same document in every county.",
                  "Technicians are certified on the protocol for a service before their first assignment on it. The certification is not a formality. It is what makes the record from a technician in Amarillo readable by a reviewing engineer who has never met them.",
                ]}
              />
              <ModelBlock
                index="02"
                title="Licensed engineers in responsible charge"
                paragraphs={[
                  responsibleChargeCopy(),
                  <>
                    The division of labor is deliberate and it runs one way. Field work gathers
                    evidence and does not reach conclusions. The engineer reads the evidence, forms
                    the opinion, and answers for it. A technician who is asked to decide is being
                    asked to practice engineering. The standard behind that division is{" "}
                    <Link
                      href="/insights/engineer-of-record-texas"
                      className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
                    >
                      responsible charge, as Texas defines it
                    </Link>
                    .
                  </>,
                ]}
              />
              <ModelBlock
                index="03"
                title="Statewide remote review"
                paragraphs={[
                  centralReviewCopy(),
                  specialistsCopy(),
                ]}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Technology */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>The backbone</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <h2 className="text-[1.65rem] leading-[1.25] font-semibold text-slate sm:text-[1.95rem]">
                Technology, in the boring places where it matters
              </h2>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                A firm that dispatches to 254 counties is running a logistics problem as much as an
                engineering one. Which technician is nearest, which of them is certified on the
                protocol this job needs, whether the field record came back complete enough to
                review, where a job is against the date it was promised for, and whether the sealed
                document actually reached the person who ordered it.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                None of that is glamorous and all of it is what fails first when a firm grows past
                the size a person can hold in their head. Dispatch, protocol capture, review queues,
                and delivery run on the firm&apos;s own systems rather than on a spreadsheet and a group
                text, and the reason is unromantic: a record that is complete and consistent is the
                only thing that makes central review faster than sending an engineer.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                What the technology does not do is form opinions. There is no automated
                determination anywhere in this firm&apos;s deliverables, and there will not be one. A
                sealed engineering opinion is a licensed person&apos;s judgment, and a document that
                implied otherwise would be worth nothing to the lender, court, or building official
                relying on it.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Veteran ownership */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>Ownership</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <h2 className="text-[1.65rem] leading-[1.25] font-semibold text-slate sm:text-[1.95rem]">
                Veteran owned
              </h2>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                {business.legalName} is a veteran owned Texas limited liability company. The claim is
                made at entity level and it is a fact about the ownership of the firm rather than a
                marketing position, which is why this site does not build a page around a founder&apos;s
                biography.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                Where it shows up is in how the firm is organized. Written procedures rather than
                individual habit. Work checked by somebody other than the person who did it. A
                preference for going where the work is rather than where it is convenient, and for
                saying plainly when something cannot be done. Those are ordinary professional
                obligations, and a state with 254 counties in it punishes a firm that treats them
                loosely.
              </p>
              <p className="mt-7">
                <Link
                  href="/government"
                  className="font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                >
                  Capability statement for public sector buyers
                </Link>
              </p>
            </div>
          </div>
        </Container>
      </section>

      <CredentialsStrip />

      <OfferCta />
    </>
  );
}

function ModelBlock({
  index,
  title,
  paragraphs,
}: {
  index: string;
  title: string;
  paragraphs: ReactNode[];
}) {
  return (
    <div>
      <span className="font-sans text-[0.8rem] font-semibold tracking-[0.14em] text-brass-ink">
        {index}
      </span>
      <span aria-hidden="true" className="mt-3 mb-4 block h-px w-10 bg-brass" />
      <h3 className="text-[1.15rem] leading-[1.35] font-semibold text-slate">{title}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-4 text-[0.95rem] leading-[1.72] text-slate-muted">
          {p}
        </p>
      ))}
    </div>
  );
}
