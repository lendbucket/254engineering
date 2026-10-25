import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { LeadForm } from "@/components/forms/LeadForm";
import { Eyebrow, Rule } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { firmName, isPrelaunch, notYetAcceptingEngagements, registrationStatement } from "@/lib/launch";

export const metadata: Metadata = buildMetadata({
  title: "Texas Engineering Services Waitlist | 254 Engineering",
  description:
    `${firmName()} is not yet accepting engagements. Join the waitlist and a person at the firm reads your request and replies to the address you give.`,
  path: "/waitlist",
  // Not indexed. This page exists to serve the prelaunch CTA, and it becomes a
  // redirect the day the firm opens. A page with a planned death should not be
  // accumulating search equity in the meantime.
  noIndex: true,
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Waitlist", path: "/waitlist" },
];

/**
 * The waitlist.
 *
 * `service` arrives in the query string from whichever service page the visitor
 * came off, and preselects the dropdown. It is validated against the real
 * service list rather than trusted: an arbitrary string in a select's default
 * value is a small reflected injection of somebody else's text into the page,
 * and the correct handling is to fall through to no selection.
 *
 * In live mode this page still renders, and says so. Deleting it would 404 every
 * link a search engine or a bookmark still holds; explaining what it became is
 * cheaper and more useful.
 */
export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;
  const known = services.find((s) => s.name === service)?.name;
  const prelaunch = isPrelaunch();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow={prelaunch ? "Opening soon" : "Now open"}
        title={prelaunch ? "Join the 254 Engineering waitlist" : "The firm is now open"}
        lede={
          prelaunch
            ? [notYetAcceptingEngagements(), registrationStatement()].filter(Boolean).join(" ")
            : `${firmName()} is accepting work. If you joined the waitlist, the firm has your request and replies to the address you gave.`
        }
        crumbs={crumbs}
      />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow>What joining means</Eyebrow>
              <Rule className="mt-5" />

              <ul className="mt-9 space-y-6">
                {/*
                  REWORDED ON RULING Q5, 2026-10-19. The list promised a message
                  from a person when the firm opened, "before any general
                  announcement", and contact "in the order they joined". Nothing
                  sends the first and nothing orders the second. It said one
                  message was the whole arrangement, and a submission now gets a
                  confirmation as well. And its last line spoke of a registration
                  "with a state board", which issued on 2026-09-10.
                */}
                {[
                  {
                    title: "A person reads it",
                    body: "Your request goes to the firm. You get a confirmation that it arrived, and a person at the firm replies to the address you gave.",
                  },
                  {
                    title: "No newsletter",
                    body: "There is no newsletter and no drip sequence. Joining puts your request in front of the firm, and that is the whole arrangement.",
                  },
                  {
                    title: "Nothing here is a commitment",
                    body: "Joining is not an order, a quote, or a contract. No engineering opinion is being promised in advance, and no opening date is promised.",
                  },
                ].map((item) => (
                  <li key={item.title}>
                    <span aria-hidden="true" className="mb-3 block h-px w-8 bg-brass" />
                    <h2 className="text-[1.05rem] leading-[1.35] font-semibold text-slate">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-[0.95rem] leading-[1.7] text-slate-muted">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[3px] border border-limestone-line bg-limestone-raised p-7 sm:p-9">
                <h2 className="text-[1.35rem] font-semibold text-slate">
                  {prelaunch ? "Join the waitlist" : "Get in touch"}
                </h2>
                <p className="mt-3 text-[0.96rem] leading-[1.65] text-slate-muted">
                  Name and email are all that is required. Everything else helps us contact the
                  right people in the right order.
                </p>
                <div className="mt-8">
                  <LeadForm
                    variant="waitlist"
                    serviceOptions={services.map((s) => s.name)}
                    defaultService={known}
                  />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
