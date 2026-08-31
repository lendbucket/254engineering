import { business } from "@/config/business";
import {
  contact,
  founder,
  geoSchema,
  hasGeo,
  hasPostalAddress,
  postalAddressSchema,
} from "@/config/contact";
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
 * Telephone, postal address, geo, and opening hours are present ONLY when they
 * have been configured in src/config/contact.ts, which reads them from the
 * environment and defaults every one of them to null. An invented value in
 * schema is worse than an absent one: schema is machine read, gets copied into
 * knowledge panels and directories, and is very hard to retract once it has
 * been. So each property is spread in conditionally and simply does not exist
 * until the firm has a real answer.
 *
 * The entity is a ProfessionalService, which is a LocalBusiness subtype. Once an
 * address and a geo point are configured this node is a complete local entity
 * without changing its type, which is what the Google Business Profile in
 * docs/gbp-brief.md needs to resolve against.
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
    // The real mark, not the social card. schema.org logo is meant to be the
    // organisation logo itself, and a knowledge panel that picks up a 1200x630
    // card with a tagline on it renders the tagline as the logo.
    logo: `${business.url}/brand/logo.png`,
    image: `${business.url}/og/default.png`,
    sameAs: business.brands.map((b) => b.url),
    /*
     * The founder is stated because an entity with a named human behind it is a
     * different trust proposition to a procurement officer than one without.
     * It carries no license claim: founder is not a regulated term, and nothing
     * here says engineer.
     */
    founder: { "@type": "Person", name: founder.name },
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(hasPostalAddress() ? { address: postalAddressSchema() } : {}),
    ...(hasGeo() ? { geo: geoSchema() } : {}),
    ...(contact.hours ? { openingHours: contact.hours.split(",").map((h) => h.trim()) } : {}),
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

/**
 * JobPosting, for genuinely open roles only.
 *
 * The playbook is explicit that this markup is permitted only where the opening
 * is real and `validThrough` is a real date, because a jobs surface is a place
 * people act on rather than read. Both roles in src/content/openings.ts are open;
 * the dates there are the operator's and are not computed.
 *
 * TWO THINGS DELIBERATELY OMITTED
 * -------------------------------
 * `baseSalary`, because no compensation has been set for the engineer seat and
 * the technician seat is a flat rate per completed inspection agreed per service
 * line, which that field would misrepresent. And `hiringOrganization` carries no
 * credential claim: it points at the Organization node, which itself states the
 * registration as pending.
 *
 * The remote seat uses `jobLocationType` TELECOMMUTE with
 * `applicantLocationRequirements` set to Texas, which is the correct pairing for
 * work performed remotely but restricted to a state. The field seat is not
 * remote and carries a real `jobLocation`, because it is somebody standing on a
 * property.
 */
export function jobPostingSchema(opening: {
  title: string;
  description: string;
  employmentType: string;
  datePosted: string;
  validThrough: string;
  remote: boolean;
  anchor: string;
}) {
  const texas = {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressRegion: "TX",
      addressCountry: "US",
    },
  };

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: opening.title,
    description: opening.description,
    employmentType: opening.employmentType,
    datePosted: opening.datePosted,
    validThrough: opening.validThrough,
    hiringOrganization: { "@id": ORG_ID },
    url: `${business.url}/careers#${opening.anchor}`,
    directApply: true,
    ...(opening.remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "State", name: "Texas" },
        }
      : { jobLocation: texas }),
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

/**
 * BlogPosting, for the editorial corpus only.
 *
 * The type is BlogPosting rather than Article because these are dated posts in a
 * named section with a hub, which is what the type describes. `author` and
 * `publisher` both resolve to the Organization node rather than naming a person:
 * no byline is claimed on this site, and inventing one to satisfy a schema field
 * would be exactly the fabrication the rest of this file avoids.
 *
 * `dateModified` comes from the content file and is set by hand. It is not
 * derived from the build, for the same reason the sitemap does not carry a build
 * timestamp: a modification date that moves on every deploy is not a
 * modification date.
 *
 * `citation` carries the primary sources the post lists. It is the one part of
 * this node that is unusual, and it is here because these posts are built on
 * statute and rule text, and a machine reader that can see what a page is
 * grounded in should be able to see it.
 */
export function blogPostingSchema(post: {
  headline: string;
  description: string;
  slug: string;
  datePublished: string;
  dateModified: string;
  sources: { label: string; url: string }[];
}) {
  const url = `${business.url}/insights/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: post.headline,
    description: post.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": SITE_ID },
    inLanguage: "en-US",
    citation: post.sources.map((s) => ({
      "@type": "CreativeWork",
      name: s.label,
      url: s.url,
    })),
  };
}
