import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderFlow } from "@/components/order/OrderFlow";
import { deliverablesFor, orderBlockedReason } from "@data/catalog";
import { serviceBySlug } from "@/content/services";
import { isTrading, launchMode, peInResponsibleCharge, registrationLine } from "@/lib/launch";
import { displayPhone, postalAddressLine } from "@/config/contact";
import { orderBlockedNow } from "@/lib/line-gate";
import { coverVerbFor, orderHeading, serviceNameInSentence } from "@/lib/order-copy";
import { currentCustomer } from "@/lib/customer-auth";

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
  /*
   * A MONEY DOOR, ruling 11 of 2026-10-06. Each deliverable is asked through
   * orderBlockedNow, which reads the engineer's signed record when the gate is
   * open, so a voided or unreadable signature closes the line here at once.
   */
  const blockedEach = await Promise.all(deliverables.map((d) => orderBlockedNow(d, mode)));
  const available = deliverables.filter((_, i) => blockedEach[i] === null);
  const blockedReason = deliverables[0] ? blockedEach[0] : orderBlockedReason(undefined, mode, false);

  return (
    /*
     * ===================================================================
     * RESTYLED TO DESIGN V10, 2026-09-29. PRESENTATION ONLY.
     * ===================================================================
     *
     * WHAT IS DELIBERATELY NOT DONE HERE. V10O-service draws a stripped
     * checkout chrome: the wordmark, the buyer's name and "Save and exit",
     * with no site navigation. This route lives inside the (site) route group
     * and inherits the marketing header and footer from its layout. Taking it
     * out of that group is a routing change, and the operator ruled that stage
     * 1 adds and renames no routes, so the page keeps the site chrome and only
     * its own content is restyled. It is on the follow up list.
     *
     * "Save and exit" is a second absence and a larger one: there is nothing to
     * save. The flow's state lives in a React hook and is posted whole at the
     * end, so a control offering to save it would be offering a capability the
     * platform does not have.
     */
    <Container>
      <div className="mx-auto max-w-[68ch] py-12 sm:py-16">
        <p className="v10-label">
          {service.shortName}
        </p>
        <h1 className="mt-2.5 text-[clamp(1.75rem,3vw,2.1rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {orderHeading(service.shortName, launchMode())}
        </h1>

        {available.length === 0 ? (
          <div className="mt-9 border-t border-[var(--color-limestone-line)] pt-7">
            <h2 className="text-[20px] leading-[1.25] font-semibold text-[var(--color-ink)]">
              {notYetOpen ? "The firm is not taking orders yet" : "This cannot be ordered online yet"}
            </h2>
            <p className="mt-3 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
              {blockedReason}
            </p>
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
              className="mt-7 inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white"
            >
              {mode === "prelaunch" ? "Join the waitlist" : "Contact the firm"}
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
              A few questions decide whether this is work the firm can take, then the property, then
              what the engineer needs. You see the price and what happens if the engineer declines
              before anything is charged.
            </p>
            <div className="mt-10">
              {/*
                WHETHER THEY ARE SIGNED IN, read here because the flow is a
                client component and cannot read a cookie.

                It decides one thing: whether the done screen offers a link to
                /account/orders. An anonymous buyer must not be sent there,
                because they would land on a sign in form seconds after paying
                and reasonably think something had gone wrong.
              */}
              <OrderFlow
                serviceSlug={slug}
                serviceName={service.name}
                deliverables={available}
                signedIn={Boolean(await currentCustomer())}
                trust={{
                  registration: registrationLine(),
                  engineerInCharge: isTrading() && peInResponsibleCharge(),
                  address: postalAddressLine(),
                  phone: displayPhone(),
                }}
              />
            </div>
          </>
        )}

        <p className="mt-10 text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">
          <Link
            href={`/services/${slug}`}
            className="text-[var(--color-link)] underline underline-offset-2"
          >
            Read what {serviceNameInSentence(service.shortName)} {coverVerbFor(service.shortName)}
          </Link>{" "}
          before ordering, if you have not already.
        </p>
      </div>
    </Container>
  );
}
