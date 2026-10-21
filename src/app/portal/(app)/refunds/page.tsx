import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { currentRefundLimit, listRefundRequests, type RefundRequestRow } from "@/lib/ops-refund-requests";
import { money } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { DecideRefund } from "./RefundClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * REFUND REQUESTS. refunds.request opens the list; deciding is
 * refunds.approve_within_limit up to the operator's limit, or payments.refund
 * for any amount. 2026-10-20.
 */
export default async function RefundsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !(can(actor, "refunds.request") || can(actor, "refunds.approve_within_limit") || can(actor, "payments.refund"))) notFound();
  const params = await searchParams;
  const state = (params.state as "waiting" | "decided" | "all") ?? "waiting";
  const read = await listRefundRequests(actor, { state });
  const unlimited = can(actor, "payments.refund");
  const approves = unlimited || can(actor, "refunds.approve_within_limit");
  const limit = approves && !unlimited ? await currentRefundLimit() : null;

  const needle = (params.q ?? "").trim().toLowerCase();
  const rows = read.ok
    ? read.rows.filter((r) => !needle || [r.orderReference, r.requestedByName, r.reason].some((v) => (v ?? "").toLowerCase().includes(needle)))
    : [];
  const dir = params.dir === "desc" ? -1 : 1;
  const sort = params.sort ?? "asked";
  rows.sort((a, b) => {
    const k = (r: RefundRequestRow) => (sort === "amount" ? String(r.owedCentsAtRequest).padStart(12, "0") : sort === "order" ? r.orderReference ?? "" : r.createdAt);
    return k(a) < k(b) ? -dir : k(a) > k(b) ? dir : 0;
  });
  const page = Math.max(1, Number(params.page) || 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<RefundRequestRow>[] = [
    { key: "order", header: "Order", cell: (r) => <Link href={`/portal/order-lookup/${r.orderId}`} className="font-semibold text-[var(--navy)] underline">{r.orderReference ?? "Unknown order"}</Link> },
    { key: "asked", header: "Asked", cell: (r) => `${formatInFirmZone(r.createdAt) ?? ""}${r.requestedByName ? `, ${r.requestedByName}` : ""}` },
    { key: "owed", header: "Owed back when asked", numeric: true, cell: (r) => money(r.owedCentsAtRequest) },
    { key: "why", header: "Why", cell: (r) => r.reason },
    {
      key: "decision",
      header: "Decision",
      cell: (r) =>
        r.decision ? (
          `${r.decision.decision === "approved" ? `Approved, ${r.decision.refundedCents === null ? "amount not recorded" : money(r.decision.refundedCents)}` : "Declined"}, ${formatInFirmZone(r.decision.decidedAt) ?? ""}${r.decision.decidedByName ? `, ${r.decision.decidedByName}` : ""}`
        ) : approves && (unlimited || r.requestedBy !== actor.id) ? (
          <DecideRefund requestId={r.id} reference={r.orderReference ?? "this order"} owed={money(r.owedCentsAtRequest)} />
        ) : approves ? (
          "You asked for this one. Somebody else decides it."
        ) : (
          "Waiting for a decision"
        ),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Customers"
        title="Refund requests"
        lede={
          unlimited
            ? "Requests waiting for a decision. You can approve any amount."
            : approves
              ? limit?.ok
                ? `Requests waiting for a decision. You can approve up to ${money(limit.cents)}; anything over goes to an administrator.`
                : "Requests waiting for a decision. Your approval limit could not be read, so nothing can be approved until it can."
              : "Refunds you and others have asked for. Somebody who can approve them decides."
        }
      />
      <ListControls
        action="/portal/refunds"
        search={params.q ?? ""}
        searchLabel="Search order, who asked, or why"
        filters={[{ name: "state", label: "Show", value: state, options: [{ value: "waiting", label: "Waiting" }, { value: "decided", label: "Decided" }, { value: "all", label: "Everything" }] }]}
        sorts={[{ value: "asked", label: "Date asked" }, { value: "amount", label: "Amount" }, { value: "order", label: "Order" }]}
        sort={sort}
        direction={dir === -1 ? "desc" : "asc"}
      />
      {!read.ok ? (
        <ErrorState title="Refund requests could not be read" body={`${read.error} Nothing here means nothing is waiting.`} />
      ) : (
        <>
          <DataTable
            caption="Refund requests"
            rows={shown}
            total={rows.length}
            columns={columns}
            empty={
              <EmptyState
                title={state === "waiting" ? "Nothing is waiting for a decision" : "Nothing matches"}
                body="A refund is asked for from the order's own screen in Order lookup. It appears here until somebody decides it."
              />
            }
          />
          <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} hrefFor={(n) => listHref("/portal/refunds", params, { page: String(n) })} />
        </>
      )}
      {limit && !limit.ok ? <Panel className="mt-6" title="Your limit could not be read"><p className="text-[14px] text-[var(--ink)]">{limit.error}</p></Panel> : null}
    </>
  );
}
