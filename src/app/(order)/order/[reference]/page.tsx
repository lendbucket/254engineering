import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { customerView } from "@/lib/ops-customer";
import { OrderStatusBody } from "@/components/order/OrderStatusBody";

export const dynamic = "force-dynamic";

/**
 * The customer's order status page.
 *
 * WHY THERE IS NO ACCOUNT
 * -----------------------
 * A customer orders one document, once. An account is a password they will
 * forget, a reset flow, a support burden, and one more credential this firm
 * would be responsible for keeping. The link is signed, emailed to them, and
 * that is the whole authentication story.
 *
 * The reference is in the path so the page is recognisable in a browser history
 * and quotable on the phone, and the token is the query. The reference alone
 * opens nothing.
 *
 * WHY IT EXISTS AT ALL
 * --------------------
 * "Where is my letter" is the call this page prevents, and the program is
 * explicit that it would otherwise become the firm's largest support cost. A
 * customer who can see that a technician is scheduled does not ring to ask.
 */
export const metadata: Metadata = {
  title: "Your order | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

/*
 * The section label lives with the body it labels, in
 * src/components/order/OrderStatusBody.tsx, since 2026-10-10. V10 replaces the
 * gold `portal-kicker` with a quiet uppercase label in the muted ink: gold is
 * an accent and never text on a light surface.
 */

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string; paid?: string; cancelled?: string }>;
}) {
  const { reference } = await params;
  const { token, paid, cancelled } = await searchParams;

  const view = token ? await customerView(token) : null;

  /*
   * One message for a missing token, a wrong one, a revoked one and an expired
   * one. Distinguishing them would confirm to somebody guessing that an order
   * with this reference exists.
   */
  /*
   * THE CUSTOMER WHO HAS JUST PAID ARRIVES HERE WITH NO TOKEN, AND WAS TOLD HIS
   * LINK DOES NOT OPEN AN ORDER.
   *
   * Operator finding, 2026-09-28. Stripe's success_url is built at checkout and
   * carries `paid=1` and no token, because a token cannot exist yet: it is
   * minted when the work is RELEASED, deliberately, so that an abandoned
   * checkout never produces a live link to an order nobody paid for.
   *
   * So the first thing a paying customer saw was the refusal written for a
   * mistyped or revoked link. Every word of it was true about the token and
   * every word of it was wrong about him.
   *
   * THIS IS THE HONEST STATE RATHER THAN A SECOND WAY IN. It opens nothing, it
   * confirms nothing about whether that reference exists, and it says what is
   * actually happening: the payment landed and the link arrives by email once
   * the work is released. A page that answered `paid=1` by showing the order
   * would be a page where the query string is the credential.
   */
  if (!view && paid) {
    return (
      <Container>
        <div className="mx-auto max-w-[62ch] py-20">
          <h1 className="text-[32px] leading-[1.12] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            Payment received
          </h1>
          <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
            Thank you. The firm emails a link to this order once it is released for work, and that
            link is the one that opens it. If nothing arrives within the hour, reply to any email
            from the firm quoting <span className="font-semibold">{reference}</span>.
          </p>
        </div>
      </Container>
    );
  }

  if (!view || view.reference !== reference) {
    return (
      <Container>
        <div className="mx-auto max-w-[62ch] py-20">
          <h1 className="text-[32px] leading-[1.12] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            This link does not open an order
          </h1>
          <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
            The link may have been mistyped, or it may have been replaced by a newer one. The firm
            emails a link when an order is paid for, and the most recent email is always the one
            that works. If you cannot find it, reply to any email from the firm quoting{" "}
            <span className="font-semibold">{reference}</span> and a new one will be sent.
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mx-auto max-w-[70ch] py-14 sm:py-20">
        <p className="text-[13px] text-[var(--color-ink-quiet)]">
          Order {view.reference}
          {", "}
          {view.propertyAddress}
        </p>
        <h1 className="mt-2 text-[clamp(1.65rem,3vw,2rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {view.serviceName}
        </h1>
        <p className="mt-2 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
          {view.propertyAddress}
          {view.city ? `, ${view.city}` : ""}, {view.county} County
        </p>

        {/*
          THREE NOTICES THAT KEEP THEIR EMPHASIS, AND MONEY IS WHY.

          V10 removes tinted panels and carries status in weight. These three
          are each a statement about somebody's card, and a sentence saying a
          payment landed, or that nothing was charged, or that money has been
          returned, is not something to style as body copy. They lose the tint
          and the border box and keep a 2px left rule, which is the design's own
          treatment for a line that must not be skimmed.

          AND THE GREEN ONE WAS A VIOLATION, corrected 2026-10-02 on the
          operator's ruling. The sentence that used to sit here read "Green stays
          green and brass stays brass because the distinction is the point", and
          argued it from contrast against white. DESIGN_V10.md line 29 allows no
          red, green or amber anywhere in the UI, with brand navy and gold the
          only colours, so brass and navy were always fine and green never was.
          Contrast answers whether a colour is legible, not whether it is
          permitted, and the note had quietly substituted the first question for
          the second.

          The distinction it was reaching for is real and is carried by the
          WORDS. "Payment received", "Nothing was charged" and "has been
          refunded" are three different sentences; none of them needed a colour
          to say which it was, and a reader who cannot tell green from grey was
          reading the words all along.
        */}
        {paid ? (
          <div className="mt-7 border-l-2 border-[var(--color-slate)] pl-4">
            <p className="text-[15px] font-semibold text-[var(--color-ink)]">Payment received</p>
            <p className="mt-1 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
              Nothing else is needed from you right now. This page is where the order&rsquo;s
              progress appears.
            </p>
          </div>
        ) : null}

        {cancelled ? (
          <div className="mt-7 border-l-2 border-[var(--color-brass)] pl-4">
            <p className="text-[15px] font-semibold text-[var(--color-ink)]">Nothing was charged</p>
            <p className="mt-1 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
              You left the payment page before it completed. The order is still here and can be paid
              from the link the firm sent you.
            </p>
          </div>
        ) : null}

        {/* The money that came back leads, because it is the thing they most want to know. */}
        <OrderStatusBody
          view={view}
          letterHref={
            token
              ? (id) => `/api/order-document?token=${encodeURIComponent(token)}&document=${encodeURIComponent(id)}`
              : null
          }
        />
      </div>
    </Container>
  );
}
