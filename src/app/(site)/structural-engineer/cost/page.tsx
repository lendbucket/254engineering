import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { OfferCta } from "@/components/launch/OfferCta";
import { Rule, SectionHeading } from "@/components/ui/primitives";
import { Section, SectionHead } from "@/components/ui/section";
import { FaqBlock } from "@/components/site/FaqBlock";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { priceFor, priceSentence } from "@/config/prices";
import { turnaroundCopy } from "@/content/model-copy";

/**
 * TARGET 3 OF THE SEO REVISION: "structural engineer cost" and "structural
 * engineer inspection cost", with "how much does a structural engineer cost"
 * supporting, roughly 1,550 a month at difficulty 0 to 2.
 *
 * THE REVISION'S OWN SENTENCE IS THE DESIGN CONSTRAINT: "A page about cost that
 * does not state a cost will not hold a ranking." Every competitor page on this
 * term says it depends, asks you to call, and ranks for a while on nothing. This
 * one publishes the ruled prices, and it is the same source the price book in
 * the portal computes margin against, so the number a customer reads and the
 * number the firm is measured on cannot drift.
 *
 * WHY IT IS ITS OWN ROUTE RATHER THAN A proximityPage. Those are static prose.
 * This page renders a table from src/config/prices.ts, which is the whole point
 * of it, and a content module that carried the numbers as sentences would be a
 * second home for a price on the day somebody edited one.
 *
 * MOBILE FIRST: the price table is a definition list that stacks at 390 rather
 * than a table that scrolls sideways. A price a buyer has to swipe to read is a
 * price they do not read.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Structural engineers", path: "/structural-engineer" },
  { name: "Cost", path: "/structural-engineer/cost" },
];

const faqs = [
  {
    q: "How much does a structural engineer cost in Texas?",
    a: "At this firm every service line has a published fixed price, listed on this page, and the price is agreed before any work starts. Across the market a residential structural inspection with a sealed letter typically runs from the high hundreds into the low thousands, and firms that will not quote before a visit are usually pricing the visit rather than the document.",
  },
  {
    q: "Why do some firms refuse to give a price?",
    a: "Because they are scoping every job by hand. That is a legitimate way to work and it is slower for you. This firm can publish a price because the engineer wrote the protocol first, so what a technician does on site and what the engineer reviews afterwards are the same on every job of that type.",
  },
  {
    q: "What makes the price go up?",
    a: "Access and scope. A roof that cannot be safely walked and needs lift or drone access, a property outside the standard service area, a structure over a certain size, or a return visit after repairs. Each of those is named against its service line above, and you are told the number before the job is taken rather than after.",
  },
  {
    q: "Is the inspection charged separately from the letter?",
    a: "No. The published price covers the field visit, the engineer's review and the sealed document, unless a line says otherwise. A return visit after repairs is charged, because it is another attendance, and it is charged as a return visit rather than as a second full inspection.",
  },
  {
    q: "Do you charge for the first conversation?",
    a: "No. The first conversation is where the firm decides whether it should take the work at all, and some jobs it declines. Charging for that would put a fee on finding out the answer is no.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: "Structural Engineer Cost in Texas | 254 Engineering",
  description:
    "What a structural engineer costs in Texas, with a fixed price per service line and what changes it. See every published price before you call the firm.",
  path: "/structural-engineer/cost",
});

export default function StructuralEngineerCostPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(faqs)} />

      <PageHeader
        image={sectionPhotos.government}
        eyebrow="Cost"
        title="What a Structural Engineer Costs in Texas"
        lede="Every line this firm offers carries a published fixed price. Here they are, what moves them, and why most firms will not give you a number before a visit."
        crumbs={crumbs}
      />

      {/* The prices. The reason the page exists. */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="The prices"
              title="Published, fixed, and agreed before work starts"
              lede="These are the marketed prices. Card processing is the firm's cost rather than a line on your invoice, and there is no charge for the first conversation."
            />
            {/*
              A definition list rather than a table, so it stacks at 390 instead
              of scrolling sideways. A price a buyer has to swipe to read is a
              price they do not read.
            */}
            <dl className="mt-11 divide-y divide-limestone-line border-t border-limestone-line">
              {services.map((service) => {
                const price = priceSentence(service.slug);
                const detail = priceFor(service.slug);
                return (
                  <div key={service.slug} className="py-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <dt className="text-[1.02rem] leading-[1.4] font-semibold text-slate">
                        <Link
                          href={`/services/${service.slug}`}
                          className="underline decoration-brass/50 underline-offset-4 hover:decoration-brass"
                        >
                          {service.name}
                        </Link>
                      </dt>
                      <dd className="font-display text-[1.15rem] leading-[1.3] font-bold text-brass-ink">
                        {price ?? "Quoted per matter"}
                      </dd>
                    </div>
                    {detail ? (
                      <p className="mt-2 max-w-[70ch] text-[0.94rem] leading-[1.65] text-slate-muted">
                        {detail.whatChangesIt}
                      </p>
                    ) : (
                      <p className="mt-2 max-w-[70ch] text-[0.94rem] leading-[1.65] text-slate-muted">
                        Forensic and insurance work is scoped per matter, because what it involves is
                        decided by what is being disputed. The firm quotes it in writing before it
                        starts and does not begin on an hourly open end.
                      </p>
                    )}
                  </div>
                );
              })}
            </dl>
            {/*
              Turnaround renders nothing until the operator rules the figures per
              line. A cost page is exactly where somebody would be tempted to
              add "and it takes about a week", which is a promise about an
              engineer's capacity that nobody has made.
            */}
            {turnaroundCopy("") ? (
              <p className="mt-8 text-[0.97rem] leading-[1.7] text-slate-muted">{turnaroundCopy("")}</p>
            ) : null}
          </div>
        </Container>
      </section>

      {/* Why a published price is possible at all. */}
      <Section id="why-published" tone="sunk">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead
              eyebrow="Why this firm can publish one"
              title="The protocol comes before the price"
              level="h2"
            />
            <Rule className="mt-5" />
          </div>
          <div className="lg:col-span-8">
            <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
              Most firms cannot publish a price because every job is scoped by hand. The engineer
              decides what to look at when he arrives, so what the work costs is not known until it
              is nearly done.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              Here the engineer of record writes the protocol before the line opens. It sets the
              questions asked at intake, the evidence the technician collects, and the criteria the
              engineer applies. That makes the work repeatable, and work that is repeatable can be
              priced.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              It also means the price does not quietly depend on who turns up.{" "}
              <Link
                href="/process"
                className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
              >
                The five steps are the same on every job
              </Link>
              , which is the thing the number is attached to.
            </p>
          </div>
        </div>
      </Section>

      <Section id="questions" tone="white">
        <FaqBlock faqs={faqs} title="What people ask about cost" />
      </Section>

      <OfferCta
        headline="Tell us what the letter is for"
        body="You get the price and a straight answer on whether this is work the firm should take, before you pay anything."
      />
    </>
  );
}
