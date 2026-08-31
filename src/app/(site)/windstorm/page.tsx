import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHead } from "@/components/ui/section";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { windstormHub, windstormPages } from "@/content/windstorm-program";

/**
 * The cluster hub.
 *
 * ITS JOB IS ORIENTATION, NOT EXPLANATION
 * ---------------------------------------
 * A hub that explains the subject competes with the pages it links to, and then
 * the cluster is one page with eight appendices. This one answers a question
 * none of the eight answer: who are the parties, and which of them decides the
 * thing you are currently stuck on. Everything else is a link.
 *
 * That is also why the actor table leads. Almost every question people bring to
 * this program is really a question about which body has authority over the step
 * they are on, and answering that first makes the rest of the cluster navigable
 * rather than merely present.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Windstorm", path: "/windstorm" },
];

export const metadata: Metadata = buildMetadata({
  title: windstormHub.title,
  description: windstormHub.description,
  path: "/windstorm",
});

export default function WindstormHubPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Coastal Texas"
        title={windstormHub.h1}
        lede={windstormHub.summary}
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      <Section>
        <SectionHead
          eyebrow="Overview"
          title="What the program is for"
          lede="A building on the Texas coast becomes insurable through a paper trail that starts before the work does."
        />
        <div className="mt-8 max-w-[68ch]">
          {windstormHub.intro.map((p, i) => (
            <p key={i} className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}>
              {p}
            </p>
          ))}
        </div>
      </Section>

      <Section tone="sunk">
        <SectionHead
          eyebrow="Who decides what"
          title="Five parties, and none of them answers to the others"
          lede="Most confusion about this program is really confusion about which body has authority over the step in front of you."
        />
        <dl className="mt-8 grid gap-6 lg:grid-cols-2">
          {windstormHub.actors.map((a) => (
            <div
              key={a.name}
              className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6"
            >
              <dt className="font-display text-[1.05rem] leading-[1.3] font-bold text-slate">{a.name}</dt>
              <dd className="mt-3 text-[0.95rem] leading-[1.7] text-slate-muted">{a.role}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="navy">
        <SectionHead
          eyebrow="The cluster"
          title="Eight questions this program raises"
          lede="Each of these is decided in a different place, so each is written separately rather than summarized here."
          onDark
        />
        <ol className="mt-8 grid gap-5 lg:grid-cols-2">
          {windstormPages.map((p, i) => (
            <li
              key={p.slug}
              className="rounded-[4px] border border-white/15 border-t-[3px] border-t-brass bg-white/5 p-6"
            >
              <p className="text-[12px] font-bold tracking-[0.14em] text-brass-light uppercase">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-display text-[1.1rem] leading-[1.3] font-bold text-slate-fg">
                <Link href={`/windstorm/${p.slug}`} className="underline underline-offset-4">
                  {p.name}
                </Link>
              </h3>
              <p className="mt-3 text-[0.95rem] leading-[1.7] text-slate-fg/80">{p.question}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHead
          eyebrow="Where this sits"
          title="The program, the firm, and the coast"
          lede="These pages describe a regulatory program. What this firm is built to do about it is a separate document."
        />
        <div className="mt-8 max-w-[68ch]">
          <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
            The designated area runs through{" "}
            <Link href="/coverage/coastal-bend" className="underline underline-offset-4">
              the Coastal Bend
            </Link>
            , the upper coast, and the Rio Grande Valley, and the wind, soil, and permitting
            conditions differ enough between them that each coverage region is written separately.
            The firm itself is{" "}
            <Link href="/corpus-christi" className="underline underline-offset-4">
              based in Corpus Christi
            </Link>
            , inside the designated area.
          </p>
          <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
            What 254 Engineering Services is built to deliver on windstorm work, once its
            registration is issued, is set out on the{" "}
            <Link href="/services/windstorm-wpi-8" className="underline underline-offset-4">
              windstorm capability page
            </Link>
            . Nothing in this cluster is an offer to perform engineering services, because the firm
            is not yet in a position to make one.
          </p>
        </div>
      </Section>

      <OfferCta service="Windstorm WPI-8 Certifications" />
    </>
  );
}
