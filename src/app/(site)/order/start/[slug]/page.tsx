import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderFlow } from "@/components/order/OrderFlow";
import { deliverablesFor, orderBlockedReason } from "@data/catalog";
import { serviceBySlug } from "@/content/services";
import { isPrelaunch } from "@/lib/launch";

export const dynamic = "force-dynamic";

/**
 * Where an order begins.
 *
 * Entered from a service page, so the service is already chosen and the flow
 * starts at whatever is actually left to decide. The program is explicit that
 * nobody should pick the service twice.
 *
 * THE GATE IS RENDERED, NOT LINKED AROUND
 * ---------------------------------------
 * In prelaunch this page exists and says why it cannot take an order, rather
 * than 404ing. A dead link from a service page would look like a broken site;
 * a page that names the registration is the same answer the rest of the site
 * gives and is the credible one for the audience this firm is built for.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  return {
    title: service ? `Order ${service.shortName} | 254 Engineering` : "Order | 254 Engineering",
    robots: { index: false, follow: true },
  };
}

export default async function OrderStartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  const deliverables = deliverablesFor(slug);

  if (!service || deliverables.length === 0) notFound();

  const prelaunch = isPrelaunch();

  /*
   * Blocked for the first deliverable is not blocked for all of them: a line
   * can sell a priced thing and a quoted thing, and a quote request stays
   * available when a price has not been published. So the page asks about each.
   */
  const available = deliverables.filter((d) => orderBlockedReason(d, prelaunch) === null);
  const blockedReason = orderBlockedReason(deliverables[0], prelaunch);

  return (
    <Container>
      <div className="mx-auto max-w-[68ch] py-12 sm:py-16">
        <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">
          {service.shortName}
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-[1.2] font-semibold text-slate">
          Order {service.shortName.toLowerCase()}
        </h1>

        {available.length === 0 ? (
          <div className="mt-8 rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white px-6 py-7">
            <h2 className="font-display text-[1.25rem] leading-[1.25] font-semibold text-slate">
              {prelaunch ? "The firm is not taking orders yet" : "This cannot be ordered online yet"}
            </h2>
            <p className="mt-3 text-[1rem] leading-[1.7] text-slate-muted">{blockedReason}</p>
            <Link
              href={prelaunch ? `/waitlist?service=${encodeURIComponent(service.name)}` : "/contact"}
              className="mt-6 inline-flex min-h-[44px] items-center rounded-[3px] bg-brass px-5 text-[14px] font-bold text-slate-ink"
            >
              {prelaunch ? "Join the waitlist" : "Contact the firm"}
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-3 max-w-[62ch] text-[1.02rem] leading-[1.7] text-slate-muted">
              A few questions decide whether this is work the firm can take, then the property, then
              what the engineer needs. You see the price and what happens if the engineer declines
              before anything is charged.
            </p>
            <div className="mt-8">
              <OrderFlow
                serviceSlug={slug}
                serviceName={service.name}
                deliverables={available}
              />
            </div>
          </>
        )}

        <p className="mt-8 text-[13.5px] leading-[1.6] text-slate-muted">
          <Link href={`/services/${slug}`} className="underline underline-offset-2">
            Read what {service.shortName.toLowerCase()} covers
          </Link>{" "}
          before ordering, if you have not already.
        </p>
      </div>
    </Container>
  );
}
