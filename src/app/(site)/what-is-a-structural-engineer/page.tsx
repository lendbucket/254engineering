import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { OfferCta } from "@/components/launch/OfferCta";
import { Rule, SectionHeading } from "@/components/ui/primitives";
import { Container } from "@/components/ui/Container";
import { Section, SectionHead } from "@/components/ui/section";
import { FaqBlock } from "@/components/site/FaqBlock";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/lib/schema";

/**
 * TARGET 5 OF THE SEO REVISION: "what is a structural engineer" and "what does
 * a structural engineer do", roughly 1,900 a month at difficulty 0 to 10.
 *
 * IT COULD NOT BE BUILT UNTIL THE PILLAR MOVED, and that is the whole reason
 * docs/keyword-mapping.md exists. /structural-engineer was targeting these
 * informational terms with an H1 reading "What a Structural Engineer Does, and
 * When You Need One", so adding this page first would have put two of the
 * firm's own pages on one query, and its child
 * /structural-engineer/when-you-need-one on a third of the same. The pillar was
 * retargeted onto the commercial term first; this is the page the informational
 * intent belongs to.
 *
 * INFORMATIONAL INTENT IS ANSWERED, NOT CONVERTED. Somebody typing "what is a
 * structural engineer" is not buying anything yet. The page answers the question
 * properly, including what a structural engineer is NOT, which is the half most
 * pages skip and the half that stops a reader hiring the wrong trade.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: "What is a structural engineer", path: "/what-is-a-structural-engineer" },
];

const faqs = [
  {
    q: "What does a structural engineer actually do?",
    a: "They work out whether a structure can carry what is being asked of it, and they write down the answer in a form somebody else can rely on. The analysis is the product. A structural engineer rarely builds anything, and the document is usually what the person paying for it actually needs.",
  },
  {
    q: "Is a structural engineer the same as an architect?",
    a: "No. An architect decides what a building is: its spaces, its form, how people move through it. A structural engineer decides whether it stands up and what size the members have to be to make that true. On a large project they work together from the start; on a house, an owner usually meets one or the other and not both.",
  },
  {
    q: "Is a structural engineer the same as a home inspector?",
    a: "No, and confusing the two costs people money. A home inspector reports observed condition across a whole property to a general standard, quickly and broadly, and does not reach an engineering opinion. A structural engineer answers one question deeply and seals the answer. A good inspector who finds something structural tells you to get an engineer, which is the right answer rather than a deflection.",
  },
  {
    q: "What does the seal on the document mean?",
    a: "That a named individual, licensed by the Texas Board of Professional Engineers and Land Surveyors, has taken responsible charge of the opinion in it. Responsible charge is a legal obligation attached to a person rather than to a company, and it is not delegable to a process. It is also why a lender, an insurer or a building official treats a sealed letter differently from a contractor's assessment.",
  },
  {
    q: "Do I need one, or am I overreacting to a crack?",
    a: "Most cracks are not structural. The useful question is not how bad it looks but whether anything is moving, and whether somebody is going to ask you for a document. If a lender, insurer or building department has asked for an opinion in writing, you need an engineer whatever the crack is doing.",
  },
];

export const metadata: Metadata = buildMetadata({
  /*
   * 54 characters. The first draft was 48, under the 50 floor, measured before
   * shipping this time rather than found by the board as the /process title
   * was.
   */
  title: "What Is a Structural Engineer? Texas | 254 Engineering",
  description:
    "What a structural engineer does, how they differ from architects, inspectors and contractors, and what a sealed report means. Read it before you hire anyone.",
  path: "/what-is-a-structural-engineer",
});

export default function WhatIsAStructuralEngineerPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(faqs)} />

      <PageHeader
        image={sectionPhotos.government}
        eyebrow="The profession"
        title="What Is a Structural Engineer?"
        lede="A structural engineer answers one question: what is holding this up, and is it enough. Everything else about the job follows from that, including why the answer arrives as a document rather than as a repair."
        crumbs={crumbs}
      />

      <Section id="the-work" tone="white">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead eyebrow="The work" title="It is about load paths" level="h2" />
            <Rule className="mt-5" />
          </div>
          <div className="lg:col-span-8">
            <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
              A structural engineer is concerned with how a building carries load to the ground.
              Every roof, floor, wall, beam and footing is part of a path, and the path either has
              the capacity for what is being asked of it or it does not. That is the whole
              discipline, applied to problems that range from a cracked slab to a bridge.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              In residential and light commercial work it usually arrives as one of a small number
              of situations. Something has moved or cracked and nobody knows whether it matters.
              Something is about to change, such as a wall coming out or a load going on, and
              somebody needs to know what that does. Or a third party, usually a lender, an insurer
              or a building department, has asked for a professional opinion in writing before they
              will proceed.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
              The engineer&apos;s product is almost never the repair. It is the analysis, and the
              document that records it.
            </p>
          </div>
        </div>
      </Section>

      {/* What it is NOT. The half most pages skip. */}
      <Section id="what-it-is-not" tone="sunk">
        <SectionHead
          eyebrow="What it is not"
          title="Four jobs that get confused with this one"
          lede="Hiring the wrong one of these is the commonest and most expensive mistake a first time buyer makes, and it is usually made in good faith."
        />
        <div className="mt-9 grid gap-[18px] sm:grid-cols-2">
          {[
            {
              heading: "Not an architect",
              body: "An architect decides what a building is: its spaces, its form, how people move through it. The engineer decides whether it stands up, and what size the members must be for that to be true.",
            },
            {
              heading: "Not a home inspector",
              body: "An inspector reports observed condition across a whole property, broadly and quickly, to a general standard. It is not an engineering opinion and it carries no seal. A good inspector who finds something structural sends you to an engineer.",
            },
            {
              heading: "Not a contractor",
              body: "A contractor diagnoses in order to sell a remedy, which is not improper as long as everybody understands it. The person who says you need piers and the person who would install them being the same person is not independence, and a lender or a court will treat it accordingly.",
            },
            {
              heading: "Not a geotechnical engineer",
              body: "Geotechnical engineers answer what the ground is doing. Structural engineers answer what the building is doing about it. On a foundation problem the two questions meet, and a report that confidently answers the other one is a report worth reading twice.",
            },
          ].map((item) => (
            <div
              key={item.heading}
              className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6"
            >
              <h3 className="font-display text-[18px] leading-[1.3] font-bold text-slate">
                {item.heading}
              </h3>
              <p className="mt-2.5 text-[15px] leading-[1.7] text-slate-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* The licence and the seal. */}
      <Section id="the-seal" tone="navy">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <SectionHead eyebrow="The license" title="What the seal actually means" level="h2" onDark />
          </div>
          <div className="lg:col-span-8">
            <p className="text-[1.02rem] leading-[1.75] text-slate-fg-muted">
              In Texas, engineer is a regulated title. A person may use it professionally only if
              they hold a licence from the Texas Board of Professional Engineers and Land Surveyors,
              and a firm may offer engineering services only if it holds a firm registration. Those
              are two separate things and both are checkable by anybody, in a public register, in
              about a minute.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-fg-muted">
              A seal on a document means a named individual has taken responsible charge of the
              opinion in it. That obligation attaches to a person rather than to a company and is
              not delegable to a process, which is why the document carries weight with a lender, an
              insurer or a building official that a contractor&apos;s assessment does not.
            </p>
            <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-fg-muted">
              It also means the engineer can be asked to answer for it years later, which is the
              real reason the good ones are careful about what they will and will not say.
            </p>
          </div>
        </div>
      </Section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Next"
              title="If that is the professional you need"
              lede="Two pages answer what usually comes next, and neither of them asks you to buy anything."
            />
            <ul className="mt-9 space-y-3 text-[1.02rem] leading-[1.75] text-slate-muted">
              <li>
                <Link
                  href="/structural-engineer"
                  className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
                >
                  What this firm does as a structural engineering practice
                </Link>
                , including what a sealed report will and will not tell you.
              </li>
              <li>
                <Link
                  href="/structural-engineer/when-you-need-one"
                  className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
                >
                  Whether your particular situation needs one
                </Link>
                , including the situations that genuinely do not.
              </li>
              <li>
                <Link
                  href="/structural-engineer/cost"
                  className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
                >
                  What it costs
                </Link>
                , with every price published before you call.
              </li>
            </ul>
          </div>
        </Container>
      </section>

      <Section id="questions" tone="white">
        <FaqBlock faqs={faqs} title="What people ask" />
      </Section>

      <OfferCta
        headline="Not sure whether you need an engineer?"
        body="Tell us what happened and who is asking for a document. Some of these are not engineering problems, and you will be told that rather than sold something."
      />
    </>
  );
}
