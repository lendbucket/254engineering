import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderFlow } from "@/components/order/OrderFlow";
import { deliverablesFor, orderBlockedReason } from "@data/catalog";
import { serviceBySlug } from "@/content/services";
import { launchMode, serviceLineIsOffered } from "@/lib/launch";
import { orderHeading, serviceNameInSentence } from "@/lib/order-copy";

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
 * While the firm is not open this page exists and says why it cannot take an
 * order, rather than 404ing. A dead link from a service page would look like a
 * broken site; a page that explains itself is the credible answer for the
 * audience this firm is built for.
 *
 * IT USED TO SAY "a page that names the registration", and that sentence was
 * corrected on 2026-09-23 along with the copy it described. The page named the
 * registration as PENDING in every mode that is not open, which included
 * TRADING, where it is active. A comment describing the behaviour it wants is
 * the account that goes stale when the behaviour changes, so it says what the
 * page does rather than which fact it recites.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  return {
    /*
     * THE TITLE FOLLOWS THE MODE TOO, because a tab reading "Order roof
     * certifications" above a page reading "Roof certifications" is one fact
     * with two accounts, and the one that drifts is whichever nobody looks at.
     * The title is exactly that: nobody reads a tab by eye, which is the
     * inversion recorded in CLAUDE.md about the JSON-LD telephone.
     */
    title: service ? `${orderHeading(service.shortName, launchMode())} | 254 Engineering` : "Order | 254 Engineering",
    robots: { index: false, follow: true },
  };
}

export default async function OrderStartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  const deliverables = deliverablesFor(slug);

  if (!service || deliverables.length === 0) notFound();

  /*
   * THE MODE, NOT A BOOLEAN NAMED FOR THE WRONG ONE. Corrected 2026-09-23.
   *
   * This was `const prelaunch = !isOpen()`, which is true in PRELAUNCH and in
   * TRADING, and the name said only the first. Everything below branched on it,
   * so a trading visitor was shown the prelaunch heading, the waitlist link,
   * and a sentence saying the firm's TBPELS registration was pending. The
   * registration is active.
   */
  const mode = launchMode();
  const notYetOpen = mode !== "open";

  /*
   * Blocked for the first deliverable is not blocked for all of them: a line
   * can sell a priced thing and a quoted thing, and a quote request stays
   * available when a price has not been published. So the page asks about each.
   */
  const available = deliverables.filter((d) => orderBlockedReason(d, mode, serviceLineIsOffered(d.serviceSlug)) === null);
  const blockedReason = orderBlockedReason(
    deliverables[0],
    mode,
    deliverables[0] ? serviceLineIsOffered(deliverables[0].serviceSlug) : false,
  );

  return (
    <Container>
      <div className="mx-auto max-w-[68ch] py-12 sm:py-16">
        <p className="portal-kicker text-[var(--gold-deep)]">
          {service.shortName}
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-[1.2] font-semibold text-[var(--navy)]">
          {orderHeading(service.shortName, launchMode())}
        </h1>

        {available.length === 0 ? (
          <div className="mt-8 rounded-[4px] border border-[var(--border)] border-t-brass bg-white px-6 py-7">
            <h2 className="font-display text-[1.25rem] leading-[1.25] font-semibold text-[var(--navy)]">
              {notYetOpen ? "The firm is not taking orders yet" : "This cannot be ordered online yet"}
            </h2>
            <p className="mt-3 text-[1rem] leading-[1.7] text-[var(--secondary)]">{blockedReason}</p>
            {/*
              * THE WAITLIST IS A PRELAUNCH DESTINATION, NOT A TRADING ONE.
              *
              * In prelaunch the firm may not perform the work, so a waitlist is
              * the honest offer. In TRADING it is registered with an engineer of
              * record and can discuss the job today: sending that visitor to a
              * waitlist understates what the firm can do, which is the same
              * error as the sentence above in the opposite direction.
              */}
            <Link
              href={mode === "prelaunch" ? `/waitlist?service=${encodeURIComponent(service.name)}` : "/contact"}
              className="mt-6 inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[13.5px] font-bold text-white"
            >
              {mode === "prelaunch" ? "Join the waitlist" : "Contact the firm"}
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-3 max-w-[62ch] text-[1.02rem] leading-[1.7] text-[var(--secondary)]">
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

        <p className="mt-8 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          <Link href={`/services/${slug}`} className="underline underline-offset-2">
            Read what {serviceNameInSentence(service.shortName)} covers
          </Link>{" "}
          before ordering, if you have not already.
        </p>
      </div>
    </Container>
  );
}
