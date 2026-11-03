import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { accountsFor, type AccountRow } from "@/lib/crm-accounts";
import { RISK_FILTER, RISK_LABEL, accountListSpec } from "@/lib/crm-account-rules";
import { staffListPage, staffListQuery, staffListRows, STAFF_LIST_PAGE_SIZE } from "@/lib/staff-lists";
import { calendarDateLabel } from "@/lib/firm-calendar";
import { money } from "@/lib/ops-money";
import { DataTable, type Column } from "@/components/portal/design";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { EmptyState, ErrorState, PageHead } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * THE ACCOUNT MANAGER VIEW. crm.use, Robert's sales CRM ruling of 2026-11-02,
 * item R6: "Account manager view lists accounts by risk." The accounts are the
 * companies converted from the sales list; a rep sees their own (the sales
 * list's one rule), a manager sees all. Riskiest first: quiet 90 days or more,
 * then a reorder overdue, then a reorder or check-in due within 14 days.
 *
 * Lifetime revenue is a column only for a holder of crm.reports or
 * billing.read; for a rep the figure is never read into the page at all
 * (crm-accounts.ts says why). A rep sees one money column instead: the revenue
 * of the orders attributed to them (R8), and no other order's.
 */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const params = await searchParams;
  const read = await accountsFor(actor);

  const lede =
    "The companies the sales list turned into accounts, riskiest first: quiet 90 days or more, then a reorder overdue at the account's own average interval, then one due within 14 days. Reminders and 90 day check-ins arrive as tasks for the account's owner.";

  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Accounts" lede={lede} />
        <ErrorState title="The accounts could not be read" body={`${read.error} This is a failed read, not an empty list.`} />
      </>
    );
  }

  const spec = accountListSpec<AccountRow>();
  const query = staffListQuery(params, spec);
  const matching = staffListRows(read.rows, query, spec);
  const page = staffListPage(matching, query.page);
  const day = (d: string | null) => (d ? calendarDateLabel(d) ?? d : "None yet");

  const columns: Column<AccountRow & { id: string }>[] = [
    {
      key: "name",
      header: "Account",
      cell: (r) => (
        <Link href={`/portal/crm/${r.prospectId}`} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline">
          {r.name}
        </Link>
      ),
    },
    { key: "risk", header: "Standing", cell: (r) => RISK_LABEL[r.standing.risk] },
    { key: "last", header: "Last order", cell: (r) => day(r.standing.lastOrderDay) },
    { key: "since", header: "Days since", cell: (r) => (r.standing.daysSince === null ? "No order yet" : String(r.standing.daysSince)) },
    { key: "quarter", header: "Orders this quarter", cell: (r) => String(r.standing.ordersThisQuarter) },
    { key: "reorder", header: "Reorder due", cell: (r) => (r.standing.reorderDueOn ? day(r.standing.reorderDueOn) : "Needs two orders"), desktopOnly: true },
    { key: "checkin", header: "Next check-in", cell: (r) => day(r.standing.checkInDueOn), desktopOnly: true },
    { key: "owner", header: "Owner", cell: (r) => r.ownerName ?? "Nobody yet", desktopOnly: true },
    ...(read.seesRevenue
      ? [{ key: "revenue", header: "Lifetime revenue", cell: (r: AccountRow & { id: string }) => money(r.lifetimeRevenueCents) }]
      : [
          {
            key: "attributed",
            header: "Your attributed revenue",
            cell: (r: AccountRow & { id: string }) => (r.attributedRevenueCents === null ? "None attributed to you" : money(r.attributedRevenueCents)),
          },
        ]),
  ];

  return (
    <>
      <PageHead eyebrow="Sales" title="Accounts" lede={lede} />
      <nav aria-label="Sales" className="mb-6 flex flex-wrap gap-x-6 print:hidden">
        <Link href="/portal/crm" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">The pipeline</Link>
        <Link href="/portal/tasks" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">Your tasks, where the reminders land</Link>
      </nav>
      {read.rows.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          body="An account appears here when a company on the sales list is converted. Mark a company interested on the call queue, then convert it from its page."
        />
      ) : (
        <>
          <ListControls
            action="/portal/crm/accounts"
            search={params.q ?? ""}
            searchLabel="Search account or owner"
            filters={[{ name: "risk", label: "Standing", value: query.filters.risk, options: [{ value: "", label: "Any standing" }, ...RISK_FILTER.map((f) => ({ value: f.value, label: f.label }))] }]}
            sorts={[
              { value: "risk", label: "Riskiest first" },
              { value: "quiet", label: "Longest quiet" },
              { value: "last", label: "Last order" },
              { value: "quarter", label: "Orders this quarter" },
              { value: "name", label: "Name" },
            ]}
            sort={query.sort}
            direction={query.ascending ? "asc" : "desc"}
          />
          {!read.seesRevenue ? (
            <p className="mb-4 text-[14px] text-[var(--ink)]">You see revenue only on the orders attributed to you. An account&apos;s other orders, and its lifetime figure, are shown to the sales manager.</p>
          ) : null}
          {matching.length === 0 ? (
            <EmptyState title="No account matches that search" body={`This is a search with no match, not an empty list: ${read.rows.length} ${read.rows.length === 1 ? "account" : "accounts"} in all. Clear the search to see every one.`} />
          ) : (
            <>
              <DataTable
                caption="Accounts by risk"
                rows={page.rows.map((r) => ({ ...r, id: r.prospectId }))}
                total={page.total}
                columns={columns}
                empty={<EmptyState title="Nothing on this page" body="Go back a page." />}
              />
              <Pager page={page.page} pageSize={STAFF_LIST_PAGE_SIZE} total={page.total} hrefFor={(n) => listHref("/portal/crm/accounts", params, { page: String(n) })} />
            </>
          )}
        </>
      )}
    </>
  );
}
