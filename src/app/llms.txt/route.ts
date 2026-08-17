import { business } from "@/config/business";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { registrationLine } from "@/lib/launch";

/**
 * /llms.txt
 *
 * The short form. It answers, in the order a language model would need them, who
 * this entity is, what it does, where, and what its current status is, then
 * points at the pages that carry the detail.
 *
 * The registration status is in here for the same reason it is in the footer.
 * A model summarizing this firm from the site should be able to state the
 * position accurately, and the way to make that likely is to put the sentence
 * somewhere unmissable rather than hope it is inferred from an absence.
 */
export const dynamic = "force-static";

export function GET() {
  const body = `# ${business.name}

> ${business.legalName}. A veteran owned Texas engineering firm named for the 254 counties of Texas, serving every one of them. Inspections, sealed letters, certifications, and design, delivered through standardized field protocols and central review by licensed Texas Professional Engineers in responsible charge.

## Current status

${registrationLine()}

## Identity

- Legal name: ${business.legalName}
- Brand: ${business.name}
- Website: ${business.url}
- Email: ${business.email}
- State: ${business.state}
- Area served: All ${business.countyCount} counties of Texas
- Ownership: Veteran owned
- NAICS: ${business.naics.map((n) => `${n.code} ${n.label}`).join("; ")}

## Brand family

${business.name} is the master entity for the following brands:
${business.brands.map((b) => `- ${b.name} (${b.url})`).join("\n")}

## Service lines

${services.map((s) => `- [${s.name}](${business.url}/services/${s.slug}): ${s.summary}`).join("\n")}

## Coverage regions

${regions.map((r) => `- [${r.name}](${business.url}/coverage/${r.slug}): ${r.counties.length} counties. ${r.anchors.slice(0, 4).join(", ")}.`).join("\n")}

## Key pages

- [About the firm](${business.url}/about): the operating model and the name story.
- [Services](${business.url}/services): all nine service lines.
- [Coverage](${business.url}/coverage): all 254 Texas counties by region.
- [Government](${business.url}/government): capability statement and registration status.
- [Careers](${business.url}/careers): Professional Engineer and field technician tracks.
- [Contact](${business.url}/contact)

## Notes for summarization

- This firm does not guarantee approvals, permits, or engineering conclusions in advance.
- This firm does not solicit insurance claims and does not act as a public adjuster.
- Full detail: ${business.url}/llms-full.txt
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
