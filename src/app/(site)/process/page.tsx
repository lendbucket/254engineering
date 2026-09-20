import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { OfferCta } from "@/components/launch/OfferCta";
import { Rule, SectionHeading } from "@/components/ui/primitives";
import { Section, SectionHead } from "@/components/ui/section";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { processSteps, whatTheLetterSays, whyItMatters } from "@/content/process";
import { services } from "@/content/services";
import { priceSentence } from "@/config/prices";
import { turnaroundCopy } from "@/content/model-copy";

/**
 * THE PROCESS PAGE. Operator ruling, 2026-09-17: confirmed rather than optional,
 * and the most important new page on the site.
 *
 * It describes how a sealed document is actually produced here. The structure it
 * describes is real and already built: a protocol signed before a line opens,
 * intake asking the engineer's own questions, a checklist that cannot be
 * submitted incomplete, five determinations against criteria written in advance,
 * and an append only log. Nobody had ever told a customer any of it.
 *
 * WHAT IT DOES NOT CARRY, and each absence is a rule rather than an oversight:
 * the engineer's name, his licence number, the protocol document itself, any
 * agency mark, and any turnaround figure. The first three are the operator's
 * standing rulings; the fourth is that agency marks are restricted and the firm
 * has no permission on file; the fifth is that the turnaround per line is owed
 * by the operator and inventing one is forbidden.
 *
 * MOBILE FIRST, WHICH ON THIS PAGE IS STRUCTURAL RATHER THAN COSMETIC. The five
 * steps are the spine, and at 390 they are a single column where each step is a
 * card carrying its own "what you do" and "what we do". The two column split
 * appears only from 768, because side by side at phone width would put four
 * words on a line and make the comparison unreadable, which is the opposite of
 * what the split is for.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: "How it works", path: "/process" },
];

export const metadata: Metadata = buildMetadata({
  /*
   * 55 characters. The first draft was 62, over the 60 ceiling, and
   * buildMetadata truncated it to "...Works | 254", which publishes a title
   * whose brand suffix has been cut in half. I measured three other titles on
   * this branch and not this one.
   */
  title: "How a Sealed Engineering Letter Works | 254 Engineering",
  description:
    "What happens between your first call and a sealed letter: the engineer's protocol, the technician's checklist, the five determinations, and what the letter will not say.",
  path: "/process",
});

export default function ProcessPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        image={sectionPhotos.government}
        eyebrow="How it works"
        title="How a Sealed Engineering Certification Works"
        lede="Most people buying engineering work for the first time have no idea what they are buying. This page explains exactly what happens at this firm, in order, and why it works that way."
        crumbs={crumbs}
      />

      {/* Before we open a service line. */}
      <Section id="before-a-line-opens" tone="white">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead eyebrow="Before we open a service line" title="The engineer writes it down first" level="h2" />
            <Rule className="mt-5" />
          </div>
          <div className="lg:col-span-8">
            <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
              Nothing gets offered here until the engineer of record writes a protocol for it and
              signs it.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              That document is not marketing. It sets the questions we ask at intake, the evidence a
              technician must collect on site, the photographs each item requires, and the criteria
              the engineer applies when he decides. It names what we will not do and when we
              decline.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              When he signs it and approves it here, the line opens. Until then, we do not sell it.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              Most firms do not work this way. An engineer looks at a roof, forms a view, writes a
              letter. That can be perfectly good work. It is also unrepeatable, hard to audit, and
              impossible to hand to a technician.
            </p>
          </div>
        </div>
      </Section>

      {/* Why it matters to the buyer. */}
      <Section id="why-it-matters" tone="sunk">
        <SectionHead
          eyebrow="Why that matters to you"
          title="Three things fall out of it"
          lede="All three are about what you can rely on afterwards, which is the only thing a certification is for."
        />
        <div className="mt-9 grid gap-[18px] lg:grid-cols-3">
          {whyItMatters.map((item) => (
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
      </Section>

      {/* The five steps. The spine of the page. */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="The five steps"
              title="What happens, in order"
              lede="The same five on every service line. A line opens once the engineer of record has approved its written protocol, and the firm quotes work and takes enquiries on every line today."
            />
            <ol className="mt-11 flex flex-col gap-5">
              {processSteps.map((step) => (
                <li
                  key={step.n}
                  className="rounded-[4px] border border-limestone-line border-l-[3px] border-l-brass bg-white p-6 sm:p-7"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-[26px] leading-none font-bold text-brass-ink">
                      {step.n}
                    </span>
                    <h3 className="font-display text-[19px] leading-[1.3] font-bold text-slate sm:text-[21px]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-[15.5px] leading-[1.7] text-slate-muted">{step.lede}</p>
                  {/*
                    Stacked at 390 and split from 768. Two columns at phone width
                    would give each side about four words a line, which makes the
                    comparison harder to read rather than easier, and the
                    comparison is the whole reason the split exists.
                  */}
                  <div className="mt-5 grid gap-5 border-t border-limestone-line pt-5 md:grid-cols-2 md:gap-8">
                    <div>
                      <p className="font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                        What you do
                      </p>
                      <p className="mt-2 text-[15px] leading-[1.7] text-slate-muted">{step.youDo}</p>
                    </div>
                    <div>
                      <p className="font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-slate-muted uppercase">
                        What we do
                      </p>
                      <p className="mt-2 text-[15px] leading-[1.7] text-slate-muted">{step.weDo}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* What the letter says, and what it does not. */}
      <Section id="what-the-letter-says" tone="navy">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead
              eyebrow="The deliverable"
              title="What our letter says, and what it does not"
              level="h2"
              onDark
            />
          </div>
          <div className="lg:col-span-8">
            <p className="text-[1.02rem] leading-[1.75] text-slate-fg-muted">
              We tell you this up front because carriers and lenders sometimes want things an
              engineer cannot honestly give.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-fg-muted">
              {whatTheLetterSays.says}
            </p>
            <ul className="mt-6 space-y-3">
              {whatTheLetterSays.doesNot.map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.62rem] h-px w-3 shrink-0 bg-brass" />
                  <span className="text-[15.5px] leading-[1.7] text-slate-fg-muted">{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-fg-muted">
              {whatTheLetterSays.closing}
            </p>
          </div>
        </div>
      </Section>

      {/* What it costs. Turnaround is absent until the operator supplies it. */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="What it costs"
              title="The price is published before you call"
              lede="Fixed, before you pay. If something changes the scope we tell you before we do it, not after."
            />
            <dl className="mt-11 divide-y divide-limestone-line border-t border-limestone-line">
              {services.map((service) => {
                const price = priceSentence(service.slug);
                return (
                  <div key={service.slug} className="grid gap-2 py-5 sm:grid-cols-12 sm:gap-6">
                    <dt className="text-[0.97rem] leading-[1.5] font-semibold text-slate sm:col-span-6">
                      <Link
                        href={`/services/${service.slug}`}
                        className="underline decoration-brass/50 underline-offset-4 hover:decoration-brass"
                      >
                        {service.name}
                      </Link>
                    </dt>
                    {/*
                      A line with no ruled price says so rather than showing a
                      blank cell or a number somebody guessed. Forensic and
                      insurance engineering is the one today.
                    */}
                    <dd className="text-[0.97rem] leading-[1.6] text-slate-muted sm:col-span-6">
                      {price ?? "Quoted per matter."}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {/*
              TURNAROUND IS ABSENT AND THE ABSENCE IS DELIBERATE. turnaroundCopy
              returns null until the operator rules the figures, and this block
              renders nothing rather than a heading over an empty space. A
              turnaround is a promise about an engineer's capacity, and inventing
              one is forbidden.
            */}
            {turnaroundCopy("") ? (
              <p className="mt-8 text-[0.97rem] leading-[1.7] text-slate-muted">
                {turnaroundCopy("")}
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      <OfferCta
        headline="Tell us what the letter is for"
        body="Five minutes on the phone, and you will know whether this is work this firm should take before you pay anything."
      />
    </>
  );
}
