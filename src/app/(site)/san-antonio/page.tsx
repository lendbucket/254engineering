import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHead } from "@/components/ui/section";
import { ProseParagraph } from "@/components/ui/prose";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { sanAntonio } from "@/content/location-san-antonio";
import { displayPhone, hasPostalAddress, hoursLine, postalAddressLine, telHref } from "@/config/contact";
import { business } from "@/config/business";
import { PhoneNumber } from "@/components/ui/PhoneNumber";
import { isPrelaunch, notYetAcceptingEngagements, registrationStatement } from "@/lib/launch";

/**
 * The firm's office as a page. Reasoning for its existence, its sources, and
 * why it does not repeat /coverage/san-antonio are at the top of
 * src/content/location-san-antonio.ts.
 *
 * BAND RHYTHM
 * -----------
 * Nine sections, three of them dark, at positions three, six, and nine, the
 * same grammar as /corpus-christi and every other interior page.
 *
 * NOTHING ABOUT THE OFFICE IS TYPED HERE. The street, the hours and the
 * telephone are read from src/config/contact.ts, the one source the footer,
 * /contact, /press and the Organization node also read. The page adds no second
 * LocalBusiness node: the site's Organization node already carries this
 * address and its opening hours, and two nodes for one office would be two
 * homes for one fact. It emits the breadcrumb only.
 *
 * THE GATE IS READ, NOT TYPED. The capability band appends the gate's own
 * sentences while it reads prelaunch, and the closing band is OfferCta with no
 * headline or body, so it picks its own state.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: sanAntonio.city, path: `/${sanAntonio.slug}` },
];

export const metadata: Metadata = buildMetadata({
  title: sanAntonio.title,
  description: sanAntonio.description,
  path: `/${sanAntonio.slug}`,
});

export default function SanAntonioPage() {
  const phone = displayPhone();
  const tel = telHref();
  const gateLines = isPrelaunch()
    ? [notYetAcceptingEngagements(), registrationStatement()].filter((s): s is string => Boolean(s))
    : [];

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      {/* 1. white by construction: the header is its own dark surface */}
      <PageHeader eyebrow="Where the firm is" title={sanAntonio.h1} lede={sanAntonio.summary} crumbs={crumbs}>
        <PrelaunchNotice />
      </PageHeader>

      {/* 2 */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="Position"
          title="Why the address is worth stating"
          lede="The firm keeps one open office, and it is here."
        />
        <div className="mt-8 max-w-[68ch]">
          {sanAntonio.position.map((p, i) => (
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
          eyebrow="One city code"
          title="The city's own chapter, with its own amendments"
          lede="San Antonio adopts the model codes and amends them, so the edition that governs is the one in force on the permit's date."
          onDark
        />
        <div className="mt-8 max-w-[68ch]">
          {sanAntonio.code.map((p, i) => (
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
          eyebrow="Information Bulletin 224"
          title="The letter the city accepts for a trench cut"
          lede="A design professional's observation can stand in for the city's own inspection of a slab that was cut and poured back."
        />
        <div className="mt-8 max-w-[68ch]">
          {sanAntonio.trenchCuts.map((p, i) => (
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
          eyebrow="The recharge zone"
          title="A rule that reads the whole site"
          lede="Part of a lot on the recharge zone puts the whole lot under the rule."
        />
        <div className="mt-8 max-w-[68ch]">
          {sanAntonio.rechargeZone.map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
          <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
            The escarpment, the soils on either side of it, and the flood hazard are on the page for{" "}
            <Link href="/coverage/san-antonio" className="underline underline-offset-4">
              San Antonio and South Central Texas
            </Link>
            .
          </p>
        </div>
      </Section>

      {/* 6, dark */}
      <Section tone="navy">
        <SectionHead
          eyebrow="Capability"
          title="What the firm is built to deliver"
          lede="The documents a permit or a closing in this city asks for."
          onDark
        />
        <div className="mt-8 max-w-[68ch]">
          {[...sanAntonio.capability, ...gateLines].map((p, i) => (
            <ProseParagraph
              key={i}
              text={p}
              className={`text-[1.02rem] leading-[1.75] text-slate-fg/80 ${i > 0 ? "mt-6" : ""}`}
            />
          ))}
        </div>
      </Section>

      {/* 7 */}
      <Section>
        <SectionHead
          eyebrow="Coverage"
          title="From one office to 254 counties"
          lede="The office is where the firm is. The coverage is where the firm is built to work."
        />
        <div className="mt-8 max-w-[68ch]">
          <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
            The firm is built to cover{" "}
            <Link href="/coverage" className="underline underline-offset-4">
              all 254 Texas counties
            </Link>
            , in eight regions, each written separately because the wind, soil, and permitting
            conditions differ between them. Foundation work in this region is described on the{" "}
            <Link href="/services/foundation-inspections" className="underline underline-offset-4">
              foundation evaluation capability page
            </Link>
            .
          </p>
        </div>
      </Section>

      {/* 8 */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="Contact"
          title="How to reach the office"
          lede="Everything published here is a channel that is actually monitored."
        />
        <div className="mt-8 max-w-[68ch]">
          <dl className="text-[1.02rem] leading-[1.75] text-slate-muted">
            {hasPostalAddress() ? (
              <>
                <dt className="font-semibold text-slate">Office</dt>
                <dd className="mt-1">{postalAddressLine()}</dd>
              </>
            ) : null}

            <dt className={`${hasPostalAddress() ? "mt-6 " : ""}font-semibold text-slate`}>Hours</dt>
            <dd className="mt-1">{hoursLine()}</dd>

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

            <dt className="mt-6 font-semibold text-slate">Email</dt>
            <dd className="mt-1">
              <a href={`mailto:${business.email}`} className="underline underline-offset-4">
                {business.email}
              </a>
            </dd>

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

      {/* 9, dark */}
      <OfferCta />
    </>
  );
}
