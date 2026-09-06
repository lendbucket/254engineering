import { currentPartner } from "@/lib/partner-auth";
import { partnerStatements, type PartnerStatementRow } from "@/lib/ops-partner-portal";
import { money } from "@/lib/ops-money";
import {
  DataTable,
  EmptyState,
  Panel,
  RestrictedMode,
  StatusPill,
  type Column,
} from "@/components/portal/design";

export const dynamic = "force-dynamic";

/**
 * Statements, which are the moments the firm told this partner what it owes.
 *
 * OPEN ONES ARE NOT LISTED, AND THAT IS DELIBERATE
 * ------------------------------------------------
 * An open statement is the firm's working total during a close, not a thing
 * anybody has been told. Showing it would mean a partner watching a figure move
 * and asking why, which is the same defect as an editable accrual in different
 * clothes. What a partner sees before a statement is issued is their balance on
 * the overview, labelled as what it is.
 */
export default async function PartnerStatements() {
  const principal = await currentPartner();
  if (!principal) return null;

  const statements = await partnerStatements(principal);

  const columns: Column<PartnerStatementRow>[] = [
    {
      key: "reference",
      header: "Statement",
      cell: (s) => <span className="font-mono font-semibold">{s.reference}</span>,
    },
    { key: "period", header: "Period", cell: (s) => s.period },
    {
      key: "status",
      header: "State",
      cell: (s) => (
        <StatusPill tone={s.status === "paid" ? "good" : "in-motion"}>
          {s.status === "paid" ? "Paid" : "Issued"}
        </StatusPill>
      ),
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      cell: (s) => <span className="font-semibold">{money(s.totalCents)}</span>,
    },
    {
      key: "paid",
      header: "Paid",
      cell: (s) =>
        s.paidAt
          ? `${new Date(s.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}${
              s.payoutReference ? ` · ${s.payoutReference}` : ""
            }`
          : "not yet",
    },
  ];

  return (
    <>
      <RestrictedMode />

      <div>
        <h1 className="font-display text-[20px] leading-[1.2] font-bold text-[var(--navy)]">Statements</h1>
        <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          A statement gathers everything that became payable in a period. An entry earned late in a
          month with a holdback window on it belongs to the period the window ends in, not the one
          it was earned in, so it appears one statement later than you might expect.
        </p>
      </div>

      <Panel>
        <DataTable
          caption="Statements issued to this partner"
          columns={columns}
          rows={statements}
          total={statements.length}
          onRowHref={(s) => `/partner/statements/${s.reference}`}
          empty={
            <EmptyState
              title="No statements yet"
              body="One appears here when the firm closes a period in which you have something payable. Until then, what you have earned is on the overview."
            />
          }
        />
      </Panel>
    </>
  );
}
