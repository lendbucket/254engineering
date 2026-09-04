import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { customerView } from "@/lib/ops-customer";

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
  if (!view || view.reference !== reference) {
    return (
      <Container>
        <div className="mx-auto max-w-[62ch] py-20">
          <h1 className="font-display text-[1.8rem] leading-[1.2] font-semibold text-[var(--navy)]">
            This link does not open an order
          </h1>
          <p className="mt-4 text-[1.02rem] leading-[1.7] text-[var(--secondary)]">
            The link may have been mistyped, or it may have been replaced by a newer one. The firm
            emails a link when an order is paid for, and the most recent email is always the one
            that works. If you cannot find it, reply to any email from the firm quoting{" "}
            <span className="font-mono">{reference}</span> and a new one will be sent.
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mx-auto max-w-[70ch] py-14 sm:py-20">
        <p className="portal-kicker text-[var(--gold-deep)]">
          Order {view.reference}
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.2] font-semibold text-[var(--navy)]">
          {view.serviceName}
        </h1>
        <p className="mt-2 text-[1.02rem] leading-[1.7] text-[var(--secondary)]">
          {view.propertyAddress}
          {view.city ? `, ${view.city}` : ""}, {view.county} County
        </p>

        {paid ? (
          <div className="mt-6 rounded-[4px] border border-[var(--green-border)] border-l-[var(--green)] bg-[var(--green-bg)] px-4 py-3.5">
            <p className="text-[15px] font-semibold text-[var(--green)]">Payment received</p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--green)]">
              Nothing else is needed from you right now. This page is where the order's progress
              appears.
            </p>
          </div>
        ) : null}

        {cancelled ? (
          <div className="mt-6 rounded-[4px] border border-[var(--warn-border)] border-l-brass bg-[var(--warn-bg)] px-4 py-3.5">
            <p className="text-[15px] font-semibold text-[var(--warn-ink)]">Nothing was charged</p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">
              You left the payment page before it completed. The order is still here and can be paid
              from the link the firm sent you.
            </p>
          </div>
        ) : null}

        {/* The money that came back leads, because it is the thing they most want to know. */}
        {view.refunded ? (
          <div className="mt-6 rounded-[4px] border border-[var(--border)] border-l-slate bg-white px-5 py-4">
            <p className="text-[15px] font-semibold text-[var(--navy)]">
              {view.refunded.amount} has been refunded
            </p>
            <p className="mt-1.5 text-[13.5px] leading-[1.65] text-[var(--secondary)]">
              {view.refunded.because}. {view.refunded.retained} was retained, which is the
              inspection that was carried out and was disclosed before you paid. You receive what
              the engineer found and why they could not seal it.
            </p>
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="portal-kicker text-[var(--gold-deep)]">
            Where it is
          </h2>
          <p className="mt-2 text-[1.02rem] leading-[1.7] text-[var(--navy)]">{view.statusLine}</p>
        </section>

        {view.timeline.length > 0 ? (
          <section className="mt-10">
            <h2 className="portal-kicker text-[var(--gold-deep)]">
              What has happened
            </h2>
            <ol className="mt-4 flex flex-col gap-4">
              {view.timeline.map((entry) => (
                <li key={entry.at} className="border-l-[2px] border-[var(--border)] pl-4">
                  <p className="text-[13.5px] text-[var(--secondary)]">
                    {new Date(entry.at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-[var(--navy)]">{entry.summary}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="portal-kicker text-[var(--gold-deep)]">
            What you paid
          </h2>
          <dl className="mt-4 border-t border-[var(--border)]">
            {view.lines.map((line) => (
              <div
                key={line.label}
                className="flex justify-between border-b border-[var(--border)] py-2.5"
              >
                <dt className="text-[15px] text-[var(--secondary)]">{line.label}</dt>
                <dd className="text-[15px] text-[var(--navy)]">{line.amount}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2.5">
              <dt className="text-[15px] font-semibold text-[var(--navy)]">Total</dt>
              <dd className="text-[15px] font-semibold text-[var(--navy)]">{view.total}</dd>
            </div>
          </dl>
        </section>

        {view.receives.length > 0 ? (
          <section className="mt-10">
            <h2 className="portal-kicker text-[var(--gold-deep)]">
              What you receive
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {view.receives.map((line) => (
                <li key={line} className="text-[15px] leading-[1.65] text-[var(--secondary)]">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {view.refundDisclosure ? (
          <section className="mt-10 border-t border-[var(--border)] pt-8">
            <h2 className="portal-kicker text-[var(--gold-deep)]">
              What you were told before you paid
            </h2>
            {/*
              * The stored text, verbatim, not a re-render of today's rule. If the
              * firm changes its terms next month, this order still shows the terms
              * this customer agreed to.
              */}
            <div className="mt-4 flex flex-col gap-3">
              {view.refundDisclosure.split("\n\n").map((para) => (
                <p key={para} className="text-[13.5px] leading-[1.7] text-[var(--secondary)]">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Container>
  );
}
