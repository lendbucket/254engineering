import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { Rule } from "@/components/ui/primitives";
import { SectionHead } from "@/components/ui/section";
import { PhoneNumber } from "@/components/ui/PhoneNumber";
import { OfferCta } from "@/components/launch/OfferCta";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";
import { contact, displayPhone, hasPostalAddress, hoursLine, postalAddressLine, telHref } from "@/config/contact";
import { firmName, registrationLine } from "@/lib/launch";
import { servesVerb } from "@/content/location";
import { services } from "@/content/services";

/**
 * THE PRESS PAGE. Robert's instruction of 2026-10-26, 15:57 Central, piece 1,
 * with his answer 18 of 18:55: the logo files are the ones the site draws now,
 * linked by path, so the kit changes by itself when the held corrected logo
 * merges and nothing here needs editing.
 *
 * NOTHING ON THIS PAGE IS TYPED THAT HAS A DERIVER. The brand name is
 * `business.name`, the registrant is `firmName()`, the registration line is
 * `registrationLine()`, the address is `postalAddressLine()`, the phone is
 * `displayPhone()` through `PhoneNumber`, and the address for press questions is
 * `business.email`. A press kit is the page other people copy the firm's facts
 * from, so a second typed copy here would be the one every citation inherits
 * the day it went stale.
 *
 * THE GATE. The boilerplate says what the firm is built to do. It makes no
 * present tense claim that engineering is offered or performed, names no
 * engineer, and states no license number, because none of those is this page's
 * to state while the gate is shut.
 *
 * ROUND 3, ITEM B. Robert, 2026-11-01 morning: firm facts, offices, service
 * lines, veteran owned as plain prose and never as a certification, logo files,
 * the media contact at support@254engineering.com, and the topics the firm
 * speaks on. Offices follow the location rule in CLAUDE.md section 2: the San
 * Antonio address is the one address, and Corpus Christi is a highlighted market
 * with no street, its verb read from `servesVerb()`. The service lines are read
 * from `services`, so a line added there appears here.
 */

export const metadata: Metadata = buildMetadata({
  title: "Press Kit: Firm Facts, Name and Logo Files | 254 Engineering",
  description:
    "The 254 Engineering press kit: firm facts, offices, service lines, expert topics and logo files, with the media contact to email for press questions.",
  path: "/press",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Press", path: "/press" },
];

const LOGOS = [
  {
    file: "/brand/logo.png",
    label: "Logo for light backgrounds",
    note: "Navy numerals and descriptor with the gold mark, on a transparent background.",
  },
  {
    file: "/brand/logo-dark.png",
    label: "Logo for dark backgrounds",
    note: "White numerals and descriptor with the gold mark kept gold. On a white page it looks almost empty, which is expected.",
  },
  {
    file: "/brand/logo-square-512.png",
    label: "Square mark",
    note: "The numerals and gold mark on navy, 512 pixels square, for an avatar or a listing that wants a square image.",
  },
];

/**
 * THE TOPICS. Robert, 2026-11-01 morning, round 3 item b: Texas windstorm and
 * the WPI-8, foundations on expansive clay, solar structural review, and
 * manufactured home foundations for FHA. Each names what a writer would ask
 * about and points at the page on this site that already explains it, so the
 * kit adds no fact of its own. No person is named: the firm speaks on these,
 * and no engineer's name goes on a public page.
 */
const TOPICS = [
  {
    title: "Texas windstorm certification and the WPI-8",
    body: "How a building on the coast becomes insurable through the Texas Windstorm Insurance Association: the Texas Department of Insurance inspection program, the WPI-8 certificate of compliance, and why ongoing and completed construction are certified differently.",
    href: "/insights/wpi-8-certificate",
    anchor: "the WPI-8 certificate guide",
  },
  {
    title: "Foundations on expansive clay",
    body: "Why so much of Texas is built on soil that swells when it is wet and shrinks when it dries, what that movement does to a slab, and what a foundation inspection can and cannot tell a buyer or an owner.",
    href: "/services/foundation-inspections",
    anchor: "foundation inspections",
  },
  {
    title: "Solar structural review",
    body: "What a structural review looks at before a rooftop solar array goes on a house, and why a permitting office asks for one.",
    href: "/services/solar-structural-letters",
    anchor: "solar structural letters",
  },
  {
    title: "Manufactured home foundations for FHA loans",
    body: "The foundation certification an FHA insured loan on a manufactured home calls for, and what the inspection behind it examines.",
    href: "/services/manufactured-home-foundation-certifications",
    anchor: "manufactured home foundation certifications",
  },
];

export default function PressPage() {
  const phone = displayPhone();
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Press"
        title="Press kit"
        lede="The facts a writer or an editor needs to name the firm correctly, and the logo files to use. Everything here is the same text the rest of the site renders."
        crumbs={crumbs}
      />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="The name" title="How to write the firm's name" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <dl className="grid gap-6">
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Name in copy
                  </dt>
                  <dd className="mt-1.5 text-[1.18rem] font-semibold text-slate">{business.name}</dd>
                </div>
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Legal entity
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] text-slate">{firmName()}</dd>
                </div>
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Registration line
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] text-slate">{registrationLine()}</dd>
                </div>
              </dl>
              <p className="mt-8 text-[1.02rem] leading-[1.75] text-slate-muted">
                The registration line is the one the firm prints in its own footer, and it is the
                version to quote. It names the entity exactly as the Texas Board of Professional
                Engineers and Land Surveyors holds it, so a different spelling of the name beside
                the number would describe a registration that does not exist.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="About the firm" title="A short description" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.05rem] leading-[1.75] text-slate">
                {business.name} is a veteran owned Texas engineering firm based in{" "}
                <Link
                  href="/san-antonio"
                  className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass"
                >
                  {contact.city}
                </Link>
                .
                It takes its name from the 254 counties of Texas and is organized to hold one
                standard of field record and engineering review across all of them.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                The longer account of how the firm is put together is on the{" "}
                <Link
                  href="/about"
                  className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass"
                >
                  page about the firm
                </Link>
                , and the services it is built to deliver are listed on the{" "}
                <Link
                  href="/services"
                  className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass"
                >
                  services overview
                </Link>
                .
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="Where" title="Offices and markets" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <dl className="grid gap-6">
                {hasPostalAddress() ? (
                  <div>
                    <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                      Office
                    </dt>
                    <dd className="mt-1.5 text-[1.05rem] leading-[1.7] text-slate">
                      {postalAddressLine()}.{" "}
                      <Link
                        href="/san-antonio"
                        className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass"
                      >
                        The {contact.city} office
                      </Link>{" "}
                      is the firm&apos;s one address.
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Highlighted market
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] leading-[1.7] text-slate">
                    <Link
                      href="/corpus-christi"
                      className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass"
                    >
                      Corpus Christi and the Coastal Bend
                    </Link>
                    , a market the firm {servesVerb()}. There is no office address there.
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Coverage
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] leading-[1.7] text-slate">
                    All 254 Texas counties, organized into eight{" "}
                    <Link
                      href="/coverage"
                      className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass"
                    >
                      coverage regions
                    </Link>
                    .
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="What" title="Service lines" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
                The {services.length} service lines the firm is built to deliver, each with its own
                page stating its scope and what the deliverable contains.
              </p>
              <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">
                {services.map((s) => (
                  <li key={s.slug} className="border-b border-limestone-line">
                    <Link
                      href={`/services/${s.slug}`}
                      className="flex min-h-[44px] items-center py-2 text-[1rem] text-slate underline decoration-limestone-line underline-offset-4 transition-colors hover:decoration-brass"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="Interviews" title="Expert topics" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
                Subjects the firm can speak to for a story, with the page on this site that already
                sets out the background.
              </p>
              <ul className="mt-6 grid gap-6">
                {TOPICS.map((t) => (
                  <li key={t.href} className="border border-limestone-line p-5">
                    <p className="text-[1.05rem] font-semibold text-slate">{t.title}</p>
                    <p className="mt-2 text-[0.98rem] leading-[1.7] text-slate-muted">{t.body}</p>
                    <Link
                      href={t.href}
                      className="mt-3 inline-flex min-h-[44px] items-center font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                    >
                      Background: {t.anchor}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="Logos" title="Logo files" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <ul className="grid gap-6">
                {LOGOS.map((l) => (
                  <li key={l.file} className="border border-limestone-line p-5">
                    <p className="text-[1.05rem] font-semibold text-slate">{l.label}</p>
                    <p className="mt-2 text-[0.98rem] leading-[1.7] text-slate-muted">{l.note}</p>
                    <a
                      href={l.file}
                      download
                      className="mt-3 inline-flex min-h-[44px] items-center font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                    >
                      Download {l.file.split("/").pop()}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-[1.02rem] leading-[1.75] text-slate-muted">
                Use the files as they are. The dark version is separate artwork rather than a
                recolored copy, because the gold has to stay gold on a dark background. Please do
                not stretch, recolor or redraw either one.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="Contact" title="Media contact" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <dl className="grid gap-6">
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Email
                  </dt>
                  <dd className="mt-1.5">
                    <a
                      href={`mailto:${business.email}`}
                      className="inline-flex min-h-[44px] items-center text-[1.05rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                    >
                      {business.email}
                    </a>
                  </dd>
                </div>
                {phone ? (
                  <div>
                    <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                      Telephone
                    </dt>
                    <dd className="mt-1.5">
                      <a
                        href={telHref() ?? undefined}
                        className="inline-flex min-h-[44px] items-center text-[1.05rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                      >
                        <PhoneNumber />
                      </a>
                    </dd>
                  </div>
                ) : null}
                {hasPostalAddress() ? (
                  <div>
                    <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                      Office
                    </dt>
                    <dd className="mt-1.5 text-[1.05rem] text-slate">{postalAddressLine()}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[0.85rem] font-semibold tracking-[0.08em] text-slate-muted uppercase">
                    Hours
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] text-slate">{hoursLine()}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
