import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHead } from "@/components/ui/section";
import { ProseParagraph } from "@/components/ui/prose";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { FaqBlock } from "@/components/site/FaqBlock";
import { location, servesVerb } from "@/content/location";
import { corpusChristiFoundationFaqs, foundationAnswerCorpusChristi, foundationVisit } from "@/content/foundation-local";
import { serviceBySlug } from "@/content/services";
import { deliverableAsSigned } from "@/lib/scope-live";
import { contact, displayPhone, telHref } from "@/config/contact";
import { business } from "@/config/business";
import { PhoneNumber } from "@/components/ui/PhoneNumber";
import { isPrelaunch, notYetAcceptingEngagements, registrationStatement } from "@/lib/launch";

/**
 * The entity's location page. Reasoning for its existence, and for why it is not
 * a city geo page, is at the top of src/content/location.ts.
 *
 * BAND RHYTHM
 * -----------
 * Ten sections, three of them dark, at positions three, six, and ten. Never
 * adjacent, never stacked at the end. Section seven is the foundation answer
 * (Robert's GEO ruling of 2026-10-31, item 5: the San Antonio pattern without
 * an address), so coverage and contact swap tones to keep light bands apart.
 * What the letter contains is read through deliverableAsSigned, and
 * ALSO_QUOTED_ON in scope-quote.ts names this page for the void sweep; the rest
 * of the band is derived in src/content/foundation-local.ts.
 *
 * THE ADDRESS BLOCK IS THE ONLY CONDITIONAL PART
 * ----------------------------------------------
 * Everything in src/config/contact.ts defaults to null, so the street address
 * and phone simply do not render until Robert configures them. This page is
 * correct and complete either way: it reads as a firm that publishes an email
 * and a form, which is what the firm currently is, rather than as a page with a
 * hole in it where a number should be.
 *
 * NO STREET ADDRESS ON THIS PAGE. Robert, 13:11 Central 2026-10-29. The office
 * moved to San Antonio, and the address block here read contact.ts, so it
 * printed the San Antonio street under a Corpus Christi heading. The page stays
 * live and in the sitemap and prints no street address. The phone stays,
 * derived as before. The firm's address is on /contact, /press, the footer and
 * the Organization node.
 *
 * THE COPY IS ROBERT'S APPROVED REVISION, 22:12 Central 2026-10-29 (issue #1
 * comment 6504744447): a market the firm serves, the verb read off the gate,
 * the capability lede and the registration sentence derived from the gate,
 * and no typed headline on the closing call to action, so OfferCta reads the
 * gate itself.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: location.city, path: `/${location.slug}` },
];

export const metadata: Metadata = buildMetadata({
  title: location.title,
  description: location.description,
  path: `/${location.slug}`,
});

export default async function LocationPage() {
  const phone = displayPhone();
  const tel = telHref();
  const statement = registrationStatement();
  const foundation = serviceBySlug("foundation-inspections");
  const letter = foundation ? await deliverableAsSigned(foundation.deliverable, `/${location.slug}`) : [];
  const faqs = corpusChristiFoundationFaqs();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(faqs)} />

      {/* 1. white by construction: the header is its own dark surface */}
      <PageHeader
        eyebrow={`A market the firm ${servesVerb()}`}
        title={location.h1}
        lede={location.summary}
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      {/* 2 */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="Why this market"
          title="Why Corpus Christi is called out"
          lede="Inside the catastrophe area, construction answers to windstorm rules that do not apply inland."
        />
        <div className="mt-8 max-w-[68ch]">
          {location.position.map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
        </div>
      </Section>

      {/* 3, dark */}
      <Section tone="navy">
        <SectionHead
          eyebrow="One jurisdiction, several exposures"
          title="The city limits reach the open Gulf"
          lede="Corpus Christi contains both a downtown on a bluff and construction fronting open water, under one building department."
          onDark
        />
        <div className="mt-8 max-w-[68ch]">
          {location.jurisdiction.map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-fg/80 ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
        </div>
      </Section>

      {/* 4 */}
      <Section>
        <SectionHead
          eyebrow="The local reference event"
          title="Celia, not Harvey"
          lede="The region measures itself against one storm. This city measures itself against an older one."
        />
        <div className="mt-8 max-w-[68ch]">
          {location.storms.map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
        </div>
      </Section>

      {/* 5 */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="Ground"
          title="What the ground does over short distances"
          lede="Expansive clay inland, bearing and buoyancy near the bays, and salt everywhere in between."
        />
        <div className="mt-8 max-w-[68ch]">
          {location.ground.map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
        </div>
      </Section>

      {/* 6, dark */}
      <Section tone="navy">
        <SectionHead
          eyebrow="Capability"
          title="What the firm is built to deliver"
          lede={isPrelaunch() ? notYetAcceptingEngagements() : "The documents coastal work in this city turns on."}
          onDark
        />
        <div className="mt-8 max-w-[68ch]">
          {location.capability.map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-fg/80 ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
          {statement ? (
            <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-fg/80">{statement}</p>
          ) : null}
        </div>
      </Section>

      {/* 7, the foundation answer */}
      <Section>
        <SectionHead
          eyebrow="Foundation inspections"
          title="A foundation inspection in Corpus Christi"
          lede={foundationAnswerCorpusChristi()}
        />
        <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-[1.05rem] font-semibold text-slate">What the visit covers</h3>
            <p className="mt-4 text-[1.02rem] leading-[1.75] text-slate-muted">{foundationVisit()}</p>
          </div>
          <div>
            <h3 className="text-[1.05rem] font-semibold text-slate">What the letter contains</h3>
            <ul className="mt-4 space-y-4">
              {letter.map((item) => (
                <li key={item} className="flex gap-4">
                  <span aria-hidden="true" className="mt-[0.65rem] h-px w-4 shrink-0 bg-brass" />
                  <span className="text-[0.98rem] leading-[1.7] text-slate-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-14">
          <FaqBlock faqs={faqs} title="Foundation inspection questions" />
        </div>
      </Section>

      {/* 8 */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="Coverage"
          title="The region this city sits inside"
          lede="Corpus Christi is one anchor of a coverage region that runs from the Guadalupe delta to the King Ranch."
        />
        <div className="mt-8 max-w-[68ch]">
          <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
            The eighteen counties of{" "}
            <Link href="/coverage/coastal-bend" className="underline underline-offset-4">
              the Coastal Bend and Golden Crescent
            </Link>{" "}
            include seven inside the windstorm catastrophe area, and the wind, soil, and permitting
            conditions across them differ enough that the region has its own page rather than being
            summarized here. Beyond it, the firm is built to cover{" "}
            <Link href="/coverage" className="underline underline-offset-4">
              all 254 Texas counties
            </Link>
            .
          </p>
          <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
            The requirement that governs construction in this city is set out in full on the{" "}
            <Link href="/services/windstorm-wpi-8" className="underline underline-offset-4">
              windstorm WPI-8 capability page
            </Link>
            , including which counties the designated area covers and what an appointed inspection
            actually examines.
          </p>
        </div>
      </Section>

      {/* 9 */}
      <Section>
        <SectionHead
          eyebrow="Contact"
          title="How to reach the firm"
          lede="Everything published here is a channel that is actually monitored."
        />
        <div className="mt-8 max-w-[68ch]">
          <dl className="text-[1.02rem] leading-[1.75] text-slate-muted">
            <dt className="font-semibold text-slate">Email</dt>
            <dd className="mt-1">
              <a href={`mailto:${business.email}`} className="underline underline-offset-4">
                {business.email}
              </a>
            </dd>

            <dt className="mt-6 font-semibold text-slate">Office</dt>
            <dd className="mt-1">
              The firm&apos;s office is in {contact.city}. Its street address is on the{" "}
              <Link href="/contact" className="underline underline-offset-4">
                contact page
              </Link>
              .
            </dd>

            {phone && tel ? (
              <>
                <dt className="mt-6 font-semibold text-slate">Telephone</dt>
                <dd className="mt-1">
                  <a href={tel} className="underline underline-offset-4">
                    <PhoneNumber />
                  </a>
                </dd>
              </>
            ) : null}

            <dt className="mt-6 font-semibold text-slate">Service area</dt>
            <dd className="mt-1">Texas, all 254 counties.</dd>
          </dl>
          <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
            The{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact form
            </Link>{" "}
            reaches the same place and is the faster route for anything with a document attached.
          </p>
        </div>
      </Section>

      {/* 10, dark */}
      <OfferCta />
    </>
  );
}
