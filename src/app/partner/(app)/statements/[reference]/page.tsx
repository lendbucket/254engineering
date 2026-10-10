import Link from "next/link";
import { notFound } from "next/navigation";
import { currentPartner } from "@/lib/partner-auth";
import { partnerStatement } from "@/lib/ops-partner-portal";
import { money } from "@/lib/ops-money";
import { AbsentChip, Panel, RestrictedMode, StatusPill } from "@/components/portal/design";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * One statement, and every entry on it.
 *
 * THE LINES ARE THE LEDGER ENTRIES THEMSELVES
 * -------------------------------------------
 * A customer statement copies its lines off the order, because an order can be
 * re-priced and the document in somebody's filing cabinet must not silently
 * disagree with it. That reason does not apply here: a partner entry cannot
 * change, the database refuses it, so the statement points at the entries and
 * there is no second copy of a figure to drift.
 *
 * Each line carries the sentence the rule produced when it was written. A
 * partner asking why a figure is what it is reads the reason the platform
 * actually used rather than somebody's reconstruction of it from the numbers.
 */
export default async function PartnerStatementPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const principal = await currentPartner();
  if (!principal) return null;

  const { reference } = await params;
  const detail = await partnerStatement(principal, reference);
  if (!detail) notFound();

  const { statement, lines } = detail;

  return (
    <>
      <RestrictedMode />

      <div>
        <Link
          href="/partner/statements"
          className="inline-flex min-h-[var(--tap-target)] items-center text-[14px] font-semibold text-[var(--secondary)]"
        >
          Statements
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--ink)]">
            <span>{statement.reference}</span>
          </h1>
          <StatusPill tone={statement.status === "paid" ? "good" : "in-motion"}>
            {statement.status === "paid" ? "Paid" : "Issued"}
          </StatusPill>
        </div>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--secondary)]">
          Period {statement.period}
          {statement.issuedAt
            ? `, issued ${(formatInFirmZone(statement.issuedAt, {
                year: "numeric",
                month: "long",
                day: "numeric",
              }) ?? "")}`
            : ""}
          .
        </p>
      </div>

      <Panel title="Total">
        <p className="font-display text-[24px] leading-none font-bold tabular-nums text-[var(--ink)]">
          {money(statement.totalCents)}
        </p>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.6] text-[var(--secondary)]">
          {statement.status === "paid"
            ? `Recorded as paid${
                statement.paidAt
                  ? ` on ${(formatInFirmZone(statement.paidAt, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }) ?? "")}`
                  : ""
              }${statement.payoutReference ? `, under ${statement.payoutReference}` : ""}. The firm records a payout after making it; this platform never moves money itself.`
            : "Issued and not yet recorded as paid. The firm pays a partner the way it pays anybody, and records the reference here afterwards."}
        </p>
      </Panel>

      <Panel
        title="What is on it"
        description="Every entry, with the reason it was written. A reversal stands beside the accrual it answers rather than replacing it."
      >
        <ul className="border-t border-[var(--row-rule)]">
          {lines.map((line) => (
            <li key={line.id} className="border-b border-[var(--row-rule)] py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className={`text-[15px] font-bold tabular-nums ${
                    line.kind === "reversal" ? "text-[var(--ink)]" : "text-[var(--ink)]"
                  }`}
                >
                  {line.status === "blocked" ? (
                    <AbsentChip>owed, figure not yet known</AbsentChip>
                  ) : (
                    money(line.amountCents)
                  )}
                </p>
                <StatusPill tone={line.kind === "reversal" ? "failed" : "good"}>
                  {line.kind === "reversal"
                    ? "Reversed"
                    : line.kind === "adjustment"
                      ? "Adjustment"
                      : "Earned"}
                </StatusPill>
              </div>
              <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--ink)]">{line.explanation}</p>
              <p className="mt-1.5 text-[12px] text-[var(--secondary)]">
                {(formatInFirmZone(line.occurredAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }) ?? "")}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
