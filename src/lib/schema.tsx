import { business } from "@/config/business";
import { isPrelaunch, tbpelsFirmNumber } from "./launch";

/**
 * Structured data for the whole brand family.
 *
 * THIS SITE IS THE MASTER ORGANIZATION RECORD
 * -------------------------------------------
 * 254 Engineering Services is the entity behind the sister brands, so the
 * Organization node here is the one the others should resolve to rather than
 * three unrelated organizations that happen to share an owner. That is what the
 * `brands` array and the stable `@id` are for: a crawler that reads a brand site
 * and then this one can join them instead of guessing.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * No aggregateRating and no review nodes. There are no reviews yet, and rating
 * markup without them is fabricated structured data, which is both a Google
 * violation and the kind of thing a procurement officer notices.
 *
 * No telephone and no postal address. Neither has been decided, and an invented
 * one in schema is worse than an absent one: schema is machine read, gets copied
 * into knowledge panels and directories, and is very hard to retract once it has
 * been.
 *
 * No `makesOffer` while the registration is pending, for the same reason the
 * page copy does not claim it.
 */

const ORG_ID = `${business.url}/#organization`;
const SITE_ID = `${business.url}/#website`;

export function organizationSchema() {
  const firmNumber = tbpelsFirmNumber();

  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": ORG_ID,
    name: business.name,
    legalName: business.legalName,
    alternateName: business.shortName,
    url: business.url,
    email: business.email,
    description:
      "254 Engineering Services is a veteran owned Texas engineering firm named for the 254 counties of Texas, delivering inspections, sealed letters, certifications, and design through licensed Texas Professional Engineers in responsible charge.",
    foundingLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressRegion: "TX", addressCountry: "US" },
    },
    areaServed: {
      "@type": "State",
      name: "Texas",
      alternateName: "TX",
      containedInPlace: { "@type": "Country", name: "United States" },
    },
    knowsAbout: [
      "Structural engineering",
      "Roof inspection and certification",
      "Windstorm WPI-8 certification",
      "Foundation evaluation",
      "Forensic engineering",
    ],
    brand: business.brands.map((b) => ({ "@type": "Brand", name: b.name, url: b.url })),
    logo: `${business.url}/og/default.png`,
    image: `${business.url}/og/default.png`,
    sameAs: business.brands.map((b) => b.url),
    // Only present once the board has actually issued it. See src/lib/launch.ts.
    ...(firmNumber
      ? {
          hasCredential: {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "Engineering firm registration",
            recognizedBy: {
              "@type": "Organization",
              name: "Texas Board of Professional Engineers and Land Surveyors",
            },
            identifier: firmNumber,
          },
        }
      : {}),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    // The reason this node exists at all: without an explicit WebSite name,
    // Google derives the SERP site name from the domain, and "254engineering.com"
    // is not the brand.
    name: business.name,
    alternateName: business.shortName,
    url: business.url,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${business.url}${c.path === "/" ? "" : c.path}`,
    })),
  };
}

export function serviceSchema(params: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: params.name,
    description: params.description,
    url: `${business.url}${params.path}`,
    serviceType: params.name,
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "State", name: "Texas" },
    // While registration is pending the firm is not offering the service, so the
    // node describes what the service is and stops short of an availability
    // claim. `offers` appears only in live mode.
    ...(isPrelaunch() ? {} : { offers: { "@type": "Offer", availability: "https://schema.org/InStock" } }),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/**
 * Render a JSON-LD block.
 *
 * JSON.stringify rather than a template literal so a stray apostrophe in copy
 * cannot produce invalid JSON, and the `<` escape so a string containing a tag
 * cannot close the script element early.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
