import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHead } from "@/components/ui/section";
import { ProseParagraph } from "@/components/ui/prose";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { location } from "@/content/location";
import { contact, displayPhone, hasPostalAddress, telHref } from "@/config/contact";
import { business } from "@/config/business";

/**
 * The entity's location page. Reasoning for its existence, and for why it is not
 * a city geo page, is at the top of src/content/location.ts.
 *
 * BAND RHYTHM
 * -----------
 * Nine sections, three of them dark, at positions three, six, and nine. Never
 * adjacent, never stacked at the end. Same grammar as every other interior page.
 *
 * THE ADDRESS BLOCK IS THE ONLY CONDITIONAL PART
 * ----------------------------------------------
 * Everything in src/config/contact.ts defaults to null, so the street address
 * and phone simply do not render until Robert configures them. This page is
 * correct and complete either way: it reads as a firm that publishes an email
 * and a form, which is what the firm currently is, rather than as a page with a
 * hole in it where a number should be.
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

export default function LocationPage() {
  const phone = displayPhone();
  const tel = telHref();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      {/* 1. white by construction: the header is its own dark surface */}
      <PageHeader
        eyebrow="Where the firm is"
        title={location.h1}
        lede={location.summary}
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      {/* 2 */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="Position"
          title="Why the address is worth stating"
          lede="A firm inside the catastrophe area answers to the same rules as the structures it is built to certify."
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
          lede="Stated as capability, because the registration is pending and nothing here is offered yet."
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
        </div>
      </Section>

      {/* 7 */}
      <Section>
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

      {/* 8 */}
      <Section tone="sunk">
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

            {phone && tel ? (
              <>
                <dt className="mt-6 font-semibold text-slate">Telephone</dt>
                <dd className="mt-1">
                  <a href={tel} className="underline underline-offset-4">
                    {phone}
                  </a>
                </dd>
              </>
            ) : null}

            {hasPostalAddress() ? (
              <>
                <dt className="mt-6 font-semibold text-slate">Address</dt>
                <dd className="mt-1">
                  <address className="not-italic">
                    {contact.street}
                    {contact.street2 ? <>, {contact.street2}</> : null}
                    <br />
                    {contact.city}, TX {contact.postalCode}
                  </address>
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

      {/* 9, dark */}
      <OfferCta
        headline="Be first when the doors open"
        body="The waitlist is how the firm will tell you the registration is issued and the work is open."
      />
    </>
  );
}
