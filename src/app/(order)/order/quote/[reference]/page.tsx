import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { customerQuote } from "@/lib/ops-quotes";
import { QUOTE_STATUS_LABEL } from "@/lib/ops-orders";
import { money } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { AcceptQuote } from "./AcceptQuote";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your quote | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * THE CUSTOMER'S QUOTE. Robert's addendum of 2026-10-25, item 3: the customer
 * accepts by a tokened link and pays. The token is the whole authority, as on
 * the order status page, and a bad, revoked or expired token reads the same as
 * the wrong reference, so the page cannot confirm a quote exists to a guess.
 */
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reference } = await params;
  const { token } = await searchParams;
  const view = token ? await customerQuote(token) : null;

  if (!view || view.quote.reference !== reference) {
    return (
      <Container>
        <div className="mx-auto max-w-[62ch] py-20">
          <h1 className="text-[32px] leading-[1.12] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            This link does not open a quote
          </h1>
          <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
            The link may have been mistyped, or a newer email may have replaced it. The most recent
            email from the firm is the one that works. If you cannot find it, reply to any email from
            the firm quoting <span className="font-semibold">{reference}</span>.
          </p>
        </div>
      </Container>
    );
  }

  const { quote, deliverableName, refundTerms, lapsed } = view;
  const holds = formatInFirmZone(quote.expiresAt, { month: "long", day: "numeric", year: "numeric" });

  return (
    <Container>
      <div className="mx-auto max-w-[62ch] py-16">
        <p className="v10-label">Quote {quote.reference}</p>
        <h1 className="mt-2.5 text-[clamp(1.75rem,3vw,2.1rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {deliverableName}
        </h1>
        <dl className="mt-8 border-t border-[var(--color-limestone-line)]">
          {[
            ["Quoted price", money(quote.quotedCents)],
            ["Property", [quote.propertyAddress, quote.city].filter(Boolean).join(", ")],
            ["Holds until", holds ?? "Not stated"],
            ["Where it stands", lapsed ? "Lapsed" : QUOTE_STATUS_LABEL[quote.status]],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 border-b border-[var(--color-limestone-line)] py-3 sm:grid-cols-[180px_1fr]">
              <dt className="text-[15px] font-semibold text-[var(--color-ink)]">{k}</dt>
              <dd className="text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">{v}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-9 text-[20px] leading-[1.25] font-semibold text-[var(--color-ink)]">What the price covers</h2>
        <p className="mt-3 whitespace-pre-wrap text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">{quote.scope}</p>
        <h2 className="mt-9 text-[20px] leading-[1.25] font-semibold text-[var(--color-ink)]">If the engineer declines</h2>
        {refundTerms.map((t) => (
          <p key={t} className="mt-3 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">{t}</p>
        ))}
        <div className="mt-10">
          {quote.status === "sent" && !lapsed ? (
            <AcceptQuote token={token as string} amount={money(quote.quotedCents)} />
          ) : quote.status === "accepted" ? (
            <>
              <p className="text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
                You accepted this quote. If payment did not finish, continue to it here.
              </p>
              <div className="mt-4">
                <AcceptQuote token={token as string} amount={money(quote.quotedCents)} again />
              </div>
            </>
          ) : (
            <p className="text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
              {lapsed || quote.status === "expired"
                ? "This quote has lapsed, so it cannot be accepted. Reply to the email it came in and the firm will look at it again."
                : "This quote cannot be accepted. Reply to the email it came in with any question."}
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}
