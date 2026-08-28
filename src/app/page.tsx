import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { HomeHero } from "@/components/home/HomeHero";
import {
  BuildingIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CredibilityStrip,
  ProcessStep,
  Section,
  SectionHead,
  ServiceCard,
  ShieldCheckIcon,
  StarIcon,
} from "@/components/home/sections";
import { TexasCountyMap } from "@/components/map/TexasCountyMap";
import { LeadForm } from "@/components/forms/LeadForm";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { FIRST_TIER_COASTAL, FIRST_TIER_COUNT } from "@/content/windstorm";
import { samRegistration } from "@/config/business";
import { responsibleChargeCopy, specialistsCopy } from "@/content/model-copy";
import { isPrelaunch } from "@/lib/launch";

/**
 * The homepage, rebuilt to the approved v5 design.
 *
 * Twelve sections in v5's order: header and nav bar in the layout, then hero,
 * credibility, services, how it works, coverage, windstorm, government and
 * commercial, careers, waitlist, and footer.
 *
 * NOTHING BELOW IS NEW CONTENT
 * ----------------------------
 * Every service, region, county, and model sentence is read from the existing
 * content modules. The metadata, the schema, and the compliance gating are
 * untouched. This file changed how the homepage looks and not what it says,
 * except where v5's own copy replaced a heading, which is listed in the section
 * report.
 */

export const metadata: Metadata = buildMetadata({
  title: "Texas Engineering Services Statewide | 254 Engineering",
  description:
    "A veteran owned Texas engineering firm named for the 254 counties of Texas, built to serve every one of them. See the service lines and the coverage map.",
  path: "/",
});

/**
 * The tag on each service card.
 *
 * v5 shows a short uppercase category above each card title. These are drawn
 * from what the deliverable actually is rather than invented as marketing
 * labels, and every one is a word already used on the matching service page.
 */
const SERVICE_TAGS: Record<string, string> = {
  "roof-inspections": "Certification",
  "windstorm-wpi-8": "Coastal",
  "foundation-inspections": "Certification",
  "solar-structural-letters": "Sealed letter",
  "manufactured-home-foundation-certifications": "Lending",
  "structural-letters": "Permitting",
  "repair-specifications": "Sealed letter",
  "residential-light-commercial-design": "Design",
  "forensic-engineering": "Investigation",
};

export default function HomePage() {
  const prelaunch = isPrelaunch();
  const countyCount = regions.reduce((sum, r) => sum + r.counties.length, 0);

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }])} />

      <HomeHero />

      <CredibilityStrip samRegistered={samRegistration.registered} />

      {/* Services */}
      <Section id="services" tone="sunk">
        <SectionHead
          title="Our Services"
          lede="Sealed deliverables prepared under the responsible charge of licensed Texas Professional Engineers. Every line ends in a document somebody relies on."
        />
        <ul className="mt-9 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard
              key={s.slug}
              slug={s.slug}
              name={s.name}
              summary={s.summary}
              tag={SERVICE_TAGS[s.slug] ?? "Engineering"}
            />
          ))}
        </ul>
      </Section>

      {/* How it works */}
      <Section id="process" tone="navy">
        <SectionHead
          title="How It Works"
          lede="Serving a state this size is an organizational problem before it is a technical one. The answer is to separate the two things that do not scale the same way."
          onDark
        />
        <div className="mt-9 flex flex-wrap gap-[clamp(20px,3vw,28px)]">
          <ProcessStep
            n="1"
            title="Field work to a written protocol"
            icon={ClipboardCheckIcon}
            body="Technicians across Texas work to the same documented inspection procedure, capture the same evidence in the same order, and are certified on that protocol before a first assignment."
          />
          <ProcessStep
            n="2"
            title="A licensed engineer in responsible charge"
            icon={ShieldCheckIcon}
            body={responsibleChargeCopy()}
          />
          <ProcessStep n="3" title="One review process, statewide" icon={ClockIcon} body={specialistsCopy()} />
        </div>
      </Section>

      {/* Coverage */}
      <Section id="coverage">
        <SectionHead
          title="Statewide Coverage"
          lede={`All ${countyCount} counties of Texas, one firm. Eight service regions cover the state, grouped on the lines that already organize permitting and emergency management.`}
        />
        <div className="mt-9 flex flex-wrap items-center gap-[clamp(28px,5vw,64px)]">
          <div className="max-w-[520px] flex-1 basis-[320px]">
            <TexasCountyMap />
          </div>
          <div className="flex-1 basis-[300px]">
            <div className="mb-[18px] border-l-4 border-brass bg-limestone px-5 py-[18px]">
              <p className="text-[12px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                Every county, exactly once
              </p>
              <p className="mt-1.5 font-display text-[22px] font-bold text-slate">
                {countyCount} counties, {regions.length} regions
              </p>
              <p className="mt-2 text-[14px] leading-[1.6] text-slate-muted">
                Wind, soil, and permitting change across this state. The regions are how the firm
                accounts for that rather than averaging it.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {regions.map((r, i) => (
                <Link
                  key={r.slug}
                  href={`/coverage/${r.slug}`}
                  className="flex items-center gap-[11px] rounded-[3px] border border-limestone-line bg-white px-3.5 py-[11px] transition-colors hover:border-brass"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-limestone-sunk text-[12.5px] font-bold text-slate">
                    {i + 1}
                  </span>
                  <span className="text-[14.5px] font-semibold text-ink">{r.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Windstorm */}
      <Section id="windstorm" tone="navy">
        <div className="flex flex-wrap items-center gap-[clamp(28px,5vw,64px)]">
          <div className="flex-1 basis-[340px]">
            <SectionHead title="Windstorm Certification on the Texas Coast" onDark />
            <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.75] text-slate-fg-muted">
              WPI-8 and WPI-8E certificates are required for windstorm insurance in the {FIRST_TIER_COUNT}{" "}
              first tier coastal counties of Texas, and the inspection behind one has to be performed
              by a licensed engineer. Coastal windstorm work is a core practice area the firm is
              being built around.
            </p>
            <Link
              href="/services/windstorm-wpi-8"
              className="mt-7 inline-block rounded-[3px] bg-brass px-6 py-3.5 text-[15px] font-bold text-slate-ink transition-colors hover:bg-brass-light"
            >
              How WPI-8 certification works
            </Link>
          </div>
          <div className="max-w-[560px] flex-1 basis-[340px]">
            <div className="rounded-[4px] bg-white p-[clamp(18px,2.5vw,26px)] shadow-[0_12px_32px_rgba(6,16,34,0.35)]">
              <div className="mb-3 border-b-2 border-brass pb-2.5">
                <p className="text-[11.5px] font-bold tracking-[0.1em] text-slate-muted uppercase">
                  First tier coastal counties
                </p>
                <p className="mt-1 font-display text-[21px] font-bold text-slate">
                  Where a WPI-8 is required
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-x-2.5 gap-y-0.5">
                {FIRST_TIER_COASTAL.map((county) => (
                  <li
                    key={county}
                    className="flex items-center gap-[7px] rounded-[2px] px-2 py-1.5 text-[13px] font-semibold text-ink"
                  >
                    <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-brass" />
                    {county}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Government and commercial */}
      <Section id="government">
        <SectionHead
          title="Government and Commercial"
          lede="For agencies, institutions, and commercial buyers of engineering services."
        />
        <div className="mt-8 flex flex-wrap items-center gap-[clamp(24px,4vw,56px)]">
          <div className="grid flex-1 basis-[340px] gap-3.5 sm:grid-cols-2">
            <CapabilityTile icon={ClipboardCheckIcon} label="Qualifications based selection" />
            <CapabilityTile icon={ClockIcon} label="On call engineering availability" />
            <CapabilityTile icon={StarIcon} label="Veteran owned status" />
            {samRegistration.registered ? (
              <CapabilityTile icon={BuildingIcon} label="SAM registered" />
            ) : null}
          </div>
          <div className="max-w-[420px] flex-1 basis-[280px] rounded-[4px] bg-slate p-[clamp(24px,3vw,32px)] text-slate-fg">
            {/* Explicit, for the same reason as the hero h1. */}
            <h3 className="font-display text-[20px] font-bold text-slate-fg">Capability statement</h3>
            <p className="mt-2.5 text-[14.5px] leading-[1.65] text-slate-fg-muted">
              Available on request for procurement teams and institutional buyers.
            </p>
            <Link
              href="/government"
              className="mt-[18px] inline-block rounded-[3px] bg-brass px-5 py-3 text-[14.5px] font-bold text-slate-ink transition-colors hover:bg-brass-light"
            >
              Government and public sector
            </Link>
          </div>
        </div>
      </Section>

      {/* Careers */}
      <Section id="careers" tone="deep">
        <div className="flex flex-wrap items-center gap-[clamp(28px,4vw,56px)]">
          <div className="flex-1 basis-[280px]">
            <h2 className="font-display text-[clamp(26px,3.2vw,34px)] leading-[1.15] font-bold tracking-[-0.01em] text-slate-fg">
              Build the firm with us
            </h2>
            <p className="mt-3.5 max-w-[44ch] text-[16px] leading-[1.7] text-slate-fg-muted">
              The firm is hiring for two roles ahead of launch.
            </p>
            <Link
              href="/careers"
              className="mt-5 inline-block rounded-[3px] bg-white px-7 py-3.5 text-[15px] font-bold text-slate transition-colors hover:bg-limestone-sunk"
            >
              See Open Roles
            </Link>
          </div>
          <div className="grid flex-1 basis-[480px] gap-4 sm:grid-cols-2">
            <RoleCard
              href="/careers/professional-engineer"
              icon={ShieldCheckIcon}
              title="Professional Engineers"
              body="Remote review work for licensed Texas PEs."
              chips={["Remote", "Texas PE license"]}
            />
            <RoleCard
              href="/careers/field-inspection-technician"
              icon={StarIcon}
              title="Field Inspection Technicians"
              body="Statewide. Independent contractor, flat rate per inspection."
              chips={["Statewide", "Independent contractor"]}
            />
          </div>
        </div>
      </Section>

      {/* Waitlist */}
      <section id="waitlist" className="bg-limestone">
        <Container>
          <div className="flex flex-wrap gap-[clamp(28px,5vw,80px)] py-[clamp(52px,8vw,96px)]">
            <div className="flex-1 basis-[300px]">
              <h2 className="font-display text-[clamp(28px,4vw,40px)] leading-[1.12] font-bold tracking-[-0.01em] text-slate">
                {prelaunch ? "Join the Waitlist" : "Start a Project"}
              </h2>
              <p className="mt-4 max-w-[50ch] text-[16.5px] leading-[1.7] text-slate-muted">
                {prelaunch
                  ? "The firm opens soon. Join the waitlist and you will hear directly when it is active, before any general announcement."
                  : "Send the address, the scope, and the date it has to be in hand. You will get a straight answer on whether it is work this firm should take and what it involves."}
              </p>
              <div className="mt-7 flex gap-8">
                <MiniStat figure={countyCount} label="Counties at launch" />
                <MiniStat figure={services.length} label="Service lines" />
                <MiniStat figure={regions.length} label="Service regions" />
              </div>
            </div>
            <div className="flex-1 basis-[360px]">
              <LeadForm
                variant={prelaunch ? "waitlist" : "contact"}
                serviceOptions={services.map((s) => s.name)}
              />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function CapabilityTile({
  icon: Icon,
  label,
}: {
  icon: typeof ClipboardCheckIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[4px] border border-limestone-line p-5 transition-all hover:border-[#b9c1cc] hover:shadow-[0_6px_16px_rgba(20,49,93,0.1)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-limestone-sunk text-slate">
        <Icon size={24} />
      </span>
      <p className="font-display text-[16px] leading-[1.3] font-semibold text-slate">{label}</p>
    </div>
  );
}

function RoleCard({
  href,
  icon: Icon,
  title,
  body,
  chips,
}: {
  href: string;
  icon: typeof ShieldCheckIcon;
  title: string;
  body: string;
  chips: string[];
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[4px] bg-white p-6 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_12px_28px_rgba(6,16,34,0.4)]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-limestone-sunk text-slate">
        <Icon size={24} />
      </span>
      <h3 className="mt-4 font-display text-[18px] leading-[1.3] font-bold text-slate">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-[1.6] text-slate-muted">{body}</p>
      <span className="mt-3.5 flex flex-wrap gap-[7px]">
        {chips.map((c) => (
          <span
            key={c}
            className="rounded-[2px] bg-limestone-sunk px-2.5 py-1 text-[12px] font-semibold text-slate"
          >
            {c}
          </span>
        ))}
      </span>
      <span className="mt-4 border-b-2 border-brass pb-px text-[14px] font-bold text-brass-ink">
        See the role
      </span>
    </Link>
  );
}

function MiniStat({ figure, label }: { figure: number; label: string }) {
  return (
    <div>
      <div className="font-display text-[34px] leading-none font-extrabold tabular-nums text-slate">
        {figure}
      </div>
      <div className="mt-1.5 text-[13px] font-semibold text-slate-muted">{label}</div>
    </div>
  );
}

