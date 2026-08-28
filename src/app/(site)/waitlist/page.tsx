import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { LeadForm } from "@/components/forms/LeadForm";
import { Eyebrow, Rule } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { isPrelaunch } from "@/lib/launch";

export const metadata: Metadata = buildMetadata({
  title: "Texas Engineering Services Waitlist | 254 Engineering",
  description:
    "Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending. Join the waitlist and hear directly when it is active.",
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
        title={prelaunch ? "Join the 254 Engineering Services waitlist" : "The firm is now open"}
        lede={
          prelaunch
            ? "254 Engineering Services is not yet accepting engineering work. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending, and until it is active the firm cannot offer or perform engineering services in Texas. That is a straightforward legal requirement and this firm is not going to work around it."
            : "Firm registration is active and 254 Engineering Services is accepting work. If you joined the waitlist you will already have heard from us."
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
                {[
                  {
                    title: "You hear first, and directly",
                    body: "When registration is active you get a message from a person telling you the firm is open and what it can take. That happens before any general announcement.",
                  },
                  {
                    title: "Nothing else is sent to you",
                    body: "There is no newsletter, no drip sequence, and no marketing list. One message when there is something to say, and that is the whole arrangement.",
                  },
                  {
                    title: "Volume is scheduled in order",
                    body: "Lenders, carriers, contractors, and anyone bringing repeat volume are contacted in the order they joined, because the first weeks of a firm's capacity fill quickly and pretending otherwise helps nobody.",
                  },
                  {
                    title: "Nothing here is a commitment",
                    body: "Joining is not an order, a quote, or a contract. No engineering opinion is being promised in advance, and no date is being guaranteed for a registration that is with a state board.",
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
