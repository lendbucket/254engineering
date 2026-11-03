import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { mayExport } from "@/lib/list-exports";
import { salesReport } from "@/lib/crm-reports";
import { PERIODS, PERIOD_LABEL, type Period } from "@/lib/crm-report-rules";
import { SOURCE_LABEL, VERTICAL_LABEL } from "@/lib/crm-rules";
import { calendarDateLabel } from "@/lib/firm-calendar";
import { money } from "@/lib/ops-money";
import { STAFF_LIST_PAGE_SIZE } from "@/lib/staff-lists";
import { DataTable, type Column } from "@/components/portal/design";
import { Pager, listHref } from "@/components/portal/ListControls";
import { EmptyState, ErrorState, PageHead } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * THE MANAGER'S SALES REPORTS. crm.reports (admin and ops_manager), Robert's
 * sales CRM ruling R8 of 2026-11-02: "dials, connects, interested, accounts
 * opened, orders and revenue attributed, per rep per day, week and month;
 * conversion by source and vertical; a leaderboard; CSV export on the admin
 * export gate." The rules are crm-report-rules.ts; the read is crm-reports.ts.
 *
 * Phone and desk: the tables are DataTable, which turns each row into a card on
 * a phone and keeps the columns on a desk. Revenue reads "Not set" when an
 * attributed order carries no total, never $0.00.
 */
export default async function SalesReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.reports")) notFound();
  const params = await searchParams;
  const period: Period = (PERIODS as readonly string[]).includes(params.period ?? "") ? (params.period as Period) : "month";
  const read = await salesReport(actor, period);

  const lede =
    "Each rep's calls and what came of them, and the accounts and orders credited to them. A connect is a call that reached somebody; an order counts once it is paid, and revenue is what the attributed orders kept after refunds.";

  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Reports" lede={lede} />
        <ErrorState title="The sales reports could not be read" body={`${read.error} This is a failed read, not an empty list.`} />
      </>
    );
  }
  const r = read.report;
  const periodLabel = (key: string) => (period === "month" ? key : (calendarDateLabel(key) ?? key));
  const revenue = (v: number | null) => (v === null ? "Not set (an order has no total)" : money(v));
  const pct = (v: number | null) => (v === null ? "None yet" : `${Math.round(v * 100)}%`);

  const pageNo = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageRows = r.rows.slice((pageNo - 1) * STAFF_LIST_PAGE_SIZE, pageNo * STAFF_LIST_PAGE_SIZE);

  type Row = (typeof r.rows)[number] & { id: string };
  const rowColumns: Column<Row>[] = [
    { key: "period", header: PERIOD_LABEL[period], cell: (x) => periodLabel(x.period) },
    { key: "rep", header: "Rep", cell: (x) => x.repName },
    { key: "dials", header: "Dials", numeric: true, cell: (x) => String(x.dials) },
    { key: "connects", header: "Connects", numeric: true, cell: (x) => String(x.connects) },
    { key: "interested", header: "Interested", numeric: true, cell: (x) => String(x.interested) },
    { key: "opened", header: "Accounts opened", numeric: true, cell: (x) => String(x.accountsOpened) },
    { key: "orders", header: "Orders", numeric: true, cell: (x) => String(x.orders), desktopOnly: true },
    { key: "revenue", header: "Revenue attributed", numeric: true, cell: (x) => revenue(x.revenueCents), desktopOnly: true },
  ];
  type Leader = (typeof r.leaders)[number] & { id: string };
  const leaderColumns: Column<Leader>[] = [
    { key: "rank", header: "Place", numeric: true, cell: (x) => String(r.leaders.findIndex((l) => l.repId === x.repId) + 1) },
    { key: "rep", header: "Rep", cell: (x) => x.repName },
    { key: "opened", header: "Accounts opened", numeric: true, cell: (x) => String(x.accountsOpened) },
    { key: "revenue", header: "Revenue attributed", numeric: true, cell: (x) => revenue(x.revenueCents) },
    { key: "orders", header: "Orders", numeric: true, cell: (x) => String(x.orders), desktopOnly: true },
    { key: "connects", header: "Connects", numeric: true, cell: (x) => String(x.connects), desktopOnly: true },
  ];
  type Conv = (typeof r.byVertical)[number] & { id: string };
  const convColumns = (label: (k: string) => string): Column<Conv>[] => [
    { key: "key", header: "Group", cell: (x) => label(x.key) },
    { key: "prospects", header: "Companies", numeric: true, cell: (x) => String(x.prospects) },
    { key: "converted", header: "Became accounts", numeric: true, cell: (x) => String(x.converted) },
    { key: "rate", header: "Conversion", numeric: true, cell: (x) => pct(x.rate) },
  ];
  const verticalLabel = (k: string) => (VERTICAL_LABEL as Record<string, string>)[k] ?? k;
  const sourceLabel = (k: string) => (SOURCE_LABEL as Record<string, string>)[k] ?? k;

  return (
    <>
      <PageHead eyebrow="Sales" title="Reports" lede={lede} />
      <nav aria-label="Period" className="mb-6 flex flex-wrap gap-x-6 print:hidden">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={listHref("/portal/crm/reports", {}, { period: p })}
            aria-current={p === period ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center text-[14px] font-semibold underline ${p === period ? "text-[var(--ink)]" : "text-[var(--navy)]"}`}
          >
            By {p}
          </Link>
        ))}
        {mayExport(actor, "crm.reports") ? (
          <Link href={`/api/portal/crm/reports?period=${period}`} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
            Download this as CSV
          </Link>
        ) : null}
      </nav>

      {r.unattributedOrders > 0 ? (
        <p role="status" className="mb-6 text-[14px] text-[var(--ink)]">
          {r.unattributedOrders} {r.unattributedOrders === 1 ? "order" : "orders"} on converted accounts carry no attribution, so the figures below leave {r.unattributedOrders === 1 ? "it" : "them"} out. The fault was recorded when the credit failed to save.
        </p>
      ) : null}

      <h2 className="mb-3 text-[18px] font-semibold text-[var(--ink)]">Leaderboard</h2>
      {r.leaders.length === 0 ? (
        <EmptyState title="Nobody has a call or a sale yet" body="Calls made from the call queue and accounts opened from the sales list are counted here." />
      ) : (
        <DataTable caption="Leaderboard, all time" rows={r.leaders.map((l) => ({ ...l, id: l.repId ?? "unowned" }))} total={r.leaders.length} columns={leaderColumns} empty={null} />
      )}

      <h2 className="mb-3 mt-10 text-[18px] font-semibold text-[var(--ink)]">Each rep by {period}</h2>
      {r.rows.length === 0 ? (
        <EmptyState title="Nothing to count yet" body="A row appears for each rep and each period with a call, an account opened or an order credited." />
      ) : (
        <>
          <DataTable
            caption={`Each rep by ${period}, newest first`}
            rows={pageRows.map((x) => ({ ...x, id: `${x.repId ?? ""}|${x.period}` }))}
            total={r.rows.length}
            columns={rowColumns}
            empty={<EmptyState title="Nothing on this page" body="Go back a page." />}
          />
          <Pager page={pageNo} pageSize={STAFF_LIST_PAGE_SIZE} total={r.rows.length} hrefFor={(n) => listHref("/portal/crm/reports", params, { page: String(n) })} />
        </>
      )}

      <h2 className="mb-3 mt-10 text-[18px] font-semibold text-[var(--ink)]">Conversion by vertical</h2>
      {r.byVertical.length === 0 ? (
        <EmptyState title="No companies on the sales list yet" body="Add or import companies, and their conversion shows here." />
      ) : (
        <DataTable caption="Conversion by vertical" rows={r.byVertical.map((x) => ({ ...x, id: x.key }))} total={r.byVertical.length} columns={convColumns(verticalLabel)} empty={null} />
      )}

      <h2 className="mb-3 mt-10 text-[18px] font-semibold text-[var(--ink)]">Conversion by source</h2>
      <p className="mb-3 text-[14px] text-[var(--ink)]">A company found in two sources counts under each.</p>
      {r.bySource.length === 0 ? (
        <EmptyState title="No companies on the sales list yet" body="Add or import companies, and their conversion shows here." />
      ) : (
        <DataTable caption="Conversion by source" rows={r.bySource.map((x) => ({ ...x, id: x.key }))} total={r.bySource.length} columns={convColumns(sourceLabel)} empty={null} />
      )}
    </>
  );
}
