import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { Rule, SectionHeading } from "@/components/ui/primitives";
import { Section, SectionHead } from "@/components/ui/section";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business, samRegistration } from "@/config/business";
import { tbpelsFirmNumber } from "@/lib/launch";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { sealedDeliverableSentence } from "@/content/model-copy";

export const metadata: Metadata = buildMetadata({
  title: "Government Engineering Services, Texas | 254 Engineering",
  description:
    "Capability statement for public sector buyers: qualifications based selection, on-call availability, NAICS codes, and registration status. Read it here.",
  path: "/government",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Government", path: "/government" },
];

export default function GovernmentPage() {
  const firmNumber = tbpelsFirmNumber();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        image={sectionPhotos.government}
        eyebrow="Capability statement"
        title="Government engineering services across Texas"
        lede="A capability statement for municipal, county, state, and federal buyers. Everything on this page is stated as it currently stands, including the parts that are not yet in place."
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      {/* Core competencies */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead
                eyebrow="Core competencies"
                title="What this firm is built to deliver"
                level="h2"
              />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
                {business.name} delivers inspections, sealed engineering letters, certifications, and
                design for property and construction across the State of Texas. Field work is
                performed to written protocols by certified technicians. {sealedDeliverableSentence()}
              </p>
              <ul className="mt-8 grid gap-x-8 gap-y-0 sm:grid-cols-2">
                {services.map((s) => (
                  <li
                    key={s.slug}
                    className="border-b border-limestone-line py-3 text-[0.95rem] leading-[1.5] text-slate"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* Procurement posture */}
      <Section id="contracting" tone="navy">
        <div>
            <SectionHeading
              onDark
              eyebrow="How this firm contracts"
              title="Qualifications based selection and on-call availability"
              lede="Texas Government Code Chapter 2254 requires professional engineering services to be procured on the basis of demonstrated competence and qualifications, with a fair and reasonable price negotiated afterward. This firm contracts on that footing and does not submit price-led proposals for engineering services."
            />

            <div className="mt-11 grid gap-10 lg:grid-cols-3 lg:gap-8">
              <PostureBlock
                title="Qualifications based selection"
                body={
                  <>
                    Statements of qualifications, standard federal form SF 330 where a solicitation
                    calls for it, and a response describing the engineer who would be in
                    responsible charge rather than a corporate capability in the abstract. Fees are
                    negotiated after selection, in{" "}
                    <Link
                      href="/insights/texas-professional-services-procurement-act"
                      className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
                    >
                      the sequence Chapter 2254 sets out
                    </Link>
                    .
                  </>
                }
              />
              <PostureBlock
                title="On-call and indefinite delivery"
                body="On-call engineering agreements, task order and indefinite delivery contracts, and standing inspection agreements are the arrangement this firm's model suits best, because dispatch to any county in the state is the operating assumption rather than an exception that has to be priced."
              />
              <PostureBlock
                title="Emergency and post event response"
                body="Post event structural assessment across the state, including the coastal counties after a named storm. Work is scoped as factual assessment and repair specification. This firm does not perform claim advocacy and does not solicit insurance claims."
              />
            </div>
        </div>
      </Section>

      {/* Registrations */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Registrations and status"
              title="Where the firm's registrations currently stand"
              lede="Stated exactly as it is. A capability statement that overstates a registration is checkable in about fifteen seconds by the person reading it, and it costs more than the credential was worth."
            />

            <dl className="mt-11 divide-y divide-limestone-line border-t border-limestone-line">
              <RegistrationRow
                term="Legal entity"
                detail={`${business.legalName}, a Texas limited liability company.`}
              />
              <RegistrationRow
                term="Texas engineering firm registration"
                detail={
                  firmNumber
                    ? `Registered with the Texas Board of Professional Engineers and Land Surveyors. TBPELS Firm No. ${firmNumber}.`
                    : (
                        <>
                          Application pending with the Texas Board of Professional Engineers and
                          Land Surveyors. The firm is not offering or performing engineering
                          services until the registration is active, and this page will carry the
                          firm number when it issues. What that registration is, and why an
                          unregistered entity may not describe itself as an engineering firm, is
                          set out in{" "}
                          <Link
                            href="/insights/texas-engineering-firm-registration"
                            className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
                          >
                            what a Texas engineering firm registration means
                          </Link>
                          .
                        </>
                      )
                }
              />
              <RegistrationRow
                term="Veteran ownership"
                detail="Veteran owned at entity level."
              />
              <RegistrationRow
                term="SDVOSB certification"
                detail="Service Disabled Veteran Owned Small Business certification is pending. The firm is not currently certified and does not represent itself as an SDVOSB for set aside purposes."
              />
              <RegistrationRow
                term="SAM.gov registration"
                detail={
                  samRegistration.registered
                    ? "Registered in the System for Award Management for federal and state contracting."
                    : "System for Award Management registration is in progress."
                }
              />
              <RegistrationRow
                term="Unique Entity Identifier"
                detail={
                  samRegistration.uei ??
                  "Withheld from this page until the identifier has been confirmed against the active SAM.gov record. Available on request to a contracting officer in the meantime."
                }
              />
              <RegistrationRow
                term="CAGE code"
                detail={
                  samRegistration.cage ??
                  "Withheld from this page until the code has been confirmed against the active SAM.gov record. Available on request to a contracting officer in the meantime."
                }
              />
              <RegistrationRow
                term="Point of contact"
                detail={business.email}
              />
            </dl>
          </div>
        </Container>
      </section>

      {/* NAICS */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead
                eyebrow="NAICS codes"
                title="How the firm classifies for procurement"
                level="h2"
              />
              <Rule className="mt-5" />
              <p className="mt-6 text-[0.92rem] leading-[1.65] text-slate-muted">
                The codes under which this firm&apos;s services are classified for federal and state
                procurement.
              </p>
            </div>
            <div className="lg:col-span-8">
              <dl className="divide-y divide-limestone-line border-t border-limestone-line">
                {business.naics.map((code) => (
                  <div key={code.code} className="flex gap-6 py-4">
                    <dt className="w-20 shrink-0 font-display text-[1.05rem] font-semibold text-slate">
                      {code.code}
                    </dt>
                    <dd className="text-[0.98rem] leading-[1.6] text-slate-muted">{code.label}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 rounded-[3px] border border-limestone-line bg-limestone-raised p-6">
                <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
                  Capability statement document
                </p>
                <p className="mt-3 text-[0.95rem] leading-[1.7] text-slate-muted">
                  A one page capability statement in the format contracting officers file will be
                  published here once the firm registration is active and the SAM identifiers are
                  confirmed. Until then a contracting officer can request the current version by
                  email and will receive it with the pending items marked as pending.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Geographic coverage */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Geographic coverage"
              title="All 254 Texas counties, across eight regions"
              lede="Statewide coverage is the operating model rather than a growth ambition, which matters for an on-call agreement whose task orders cannot be predicted in advance."
            />
            <ul className="mt-10 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {regions.map((r) => (
                <li
                  key={r.slug}
                  className="flex items-baseline justify-between gap-3 border-b border-limestone-line py-3"
                >
                  <span className="text-[0.95rem] text-slate">{r.name}</span>
                  <span className="shrink-0 font-sans text-[0.82rem] text-slate-muted">
                    {r.counties.length}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <OfferCta
        headline="Contracting officers and procurement staff"
        body="Send the solicitation number or the scope you are working on. You will get a direct answer on whether this firm should be responding to it, including when the answer is no."
      />
    </>
  );
}

/**
 * A posture block, which now renders on the navy band.
 *
 * The colours are explicit rather than inherited. globals.css sets a colour on
 * h3 at the base layer, so a heading that relies on inheriting from its dark
 * section renders navy on navy, and the body was authored in a muted grey that
 * measured 2.22:1 here.
 */
function PostureBlock({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div>
      <span aria-hidden="true" className="mb-4 block h-px w-10 bg-brass" />
      <h3 className="text-[1.12rem] leading-[1.35] font-semibold text-slate-fg">{title}</h3>
      <p className="mt-3 text-[0.95rem] leading-[1.72] text-slate-fg-muted">{body}</p>
    </div>
  );
}

function RegistrationRow({ term, detail }: { term: string; detail: ReactNode }) {
  return (
    <div className="grid gap-2 py-5 sm:grid-cols-12 sm:gap-6">
      <dt className="font-sans text-[0.88rem] font-semibold text-slate sm:col-span-4">{term}</dt>
      <dd className="text-[0.97rem] leading-[1.68] text-slate-muted sm:col-span-8">{detail}</dd>
    </div>
  );
}
