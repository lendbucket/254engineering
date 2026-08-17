import { business, samRegistration } from "@/config/business";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { registrationLine } from "@/lib/launch";

/**
 * /llms-full.txt
 *
 * The long form: the whole content of the site as plain text, generated from the
 * same modules the pages render from. That is the property worth protecting.
 * A hand written long form file is a second copy of the site's claims, and a
 * second copy drifts, which for a document whose entire purpose is to be quoted
 * accurately is the one failure that matters.
 */
export const dynamic = "force-static";

export function GET() {
  const sections: string[] = [];

  sections.push(`# ${business.name}

${business.legalName}. A veteran owned Texas engineering firm named for the 254 counties of Texas, serving every one of them.

Website: ${business.url}
Email: ${business.email}
Area served: All ${business.countyCount} counties of Texas
Ownership: Veteran owned

## Current status

${registrationLine()}

Until firm registration with the Texas Board of Professional Engineers and Land Surveyors is active, this firm does not offer or perform engineering services in Texas. Pages describing service lines describe what the firm is built to deliver.
`);

  sections.push(`## The name

Texas has 254 counties, more than any other state, and they are not one place. A slab detail that is correct in Lubbock is wrong in Beaumont. A roof that passes inspection in Amarillo would not certify in Rockport. The soil, the wind, the frost depth, and the building official all change as you cross the state. Most firms answer that by working a metro and stopping at the county line. This firm is named for the number because it took the opposite position: build the field protocols and the review process so that one standard can hold across all 254 counties, and then serve every one.
`);

  sections.push(`## Operating model

1. Standardized field protocols. Each service line has a written inspection protocol covering what is measured, what is photographed, in what order, and what must be recorded when a condition cannot be observed. Technicians are certified on the protocol before a first assignment on that service.

2. Licensed engineers in responsible charge. Every opinion, letter, certification, and drawing is reviewed and sealed by a Texas licensed Professional Engineer who takes responsible charge of it. Field work gathers evidence and does not reach conclusions.

3. Statewide remote review. Reviewing centrally rather than regionally keeps the standard identical across the state and allows the firm to hold specialists, including engineers appointed by the Texas Department of Insurance for windstorm inspections.
`);

  sections.push(`## Registrations and status

- Legal entity: ${business.legalName}, a Texas limited liability company.
- Texas engineering firm registration: see current status above.
- Veteran ownership: veteran owned at entity level.
- SDVOSB certification: pending. The firm is not currently certified and does not represent itself as an SDVOSB for set aside purposes.
- SAM.gov registration: ${samRegistration.registered ? "registered" : "in progress"}.
- Unique Entity Identifier: ${samRegistration.uei ?? "not published; available to a contracting officer on request."}
- CAGE code: ${samRegistration.cage ?? "not published; available to a contracting officer on request."}
- NAICS codes: ${business.naics.map((n) => `${n.code} (${n.label})`).join(", ")}.
- Procurement posture: qualifications based selection under Texas Government Code Chapter 2254. On-call, task order, and indefinite delivery agreements suit the model. No price-led proposals for professional engineering services.
`);

  for (const service of services) {
    sections.push(`## Service: ${service.name}

URL: ${business.url}/services/${service.slug}

${service.summary}

### What it is

${service.what.join("\n\n")}

### Who orders one

${service.whoOrders.map((w) => `- ${w}`).join("\n")}

### The deliverable

${service.deliverable.map((d) => `- ${d}`).join("\n")}

### Turnaround

${service.turnaround}

### Questions

${service.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}
`);
  }

  for (const region of regions) {
    sections.push(`## Coverage region: ${region.name}

URL: ${business.url}/coverage/${region.slug}
Counties (${region.counties.length}): ${region.counties.join(", ")}
Population centers: ${region.anchors.join(", ")}

${region.summary}

### Wind

${region.wind.join("\n\n")}

### Soil

${region.soils.join("\n\n")}

### Permitting

${region.permitting.join("\n\n")}

### Service emphasis

${region.emphasis.map((e) => `- ${services.find((s) => s.slug === e.slug)?.name ?? e.slug}: ${e.why}`).join("\n")}
`);
  }

  sections.push(`## Careers

Two tracks.

Professional Engineers. Review engineer and engineer of record roles. The review model is remote and volume oriented: reading field records produced to a written protocol, forming the opinion, and sealing the deliverable. Responsible charge is not negotiable, and no one in the firm is authorized to ask an engineer to seal past what a record supports. A windstorm inspection appointment from the Texas Department of Insurance is not required and is a considerable plus.

Field inspection technicians. Independent contractor work. Jobs are dispatched and the technician accepts or declines each one with no obligation and no penalty for declining. Pay is a flat rate per completed inspection, agreed per service line before an assignment is taken. Protocol certification is required before a first assignment on a service line.

URL: ${business.url}/careers
`);

  sections.push(`## Constraints on how this firm describes itself

- No guaranteed outcomes. Nothing promises an engineering opinion, a certification, a permit approval, or a lender or insurer decision in advance of the work.
- No insurance claim solicitation. This firm does not act as a public adjuster and does not advise on claim value or policy coverage. Forensic work is a factual determination prepared to the same standard whichever party commissioned it.
- No fabricated credentials. Registration status is stated as it currently stands, including where it is pending.
- Reviews and ratings: none are published, because none exist yet.
`);

  return new Response(sections.join("\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
