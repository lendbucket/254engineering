import { csv } from "./csv";
import { moneyCell } from "./ops-money";
import type { AccountListQuery } from "./account-list";
import type { AccountRow } from "./ops-accounts-admin";

/**
 * EVERY ACCOUNT MATCHING THE ACCOUNTS SCREEN, AS A CSV. Robert, 2026-10-28,
 * 16:11 Central (issue #1 comment 6480742347): "It exports every matching
 * account through the same query and filters as the page, owner or admin
 * only, with the same CSV safety as the other exports."
 *
 * The rows come from accountRows with scope "every", which is the screen's own
 * function, so the file and the screen cannot disagree about which accounts
 * match. The cells go through csv(), the platform's one escaping rule with its
 * formula guard, and money through moneyCell, which writes dollars and leaves
 * an absent figure empty rather than zero.
 *
 * Pure, so a proof can hand it rows and read the file.
 */

export const ACCOUNT_EXPORT_HEADERS = [
  "Organization",
  "Status",
  "Pays",
  "Credit limit",
  "Net days",
  "Orders",
  "Orders this month",
  "Issued and unpaid",
  "Not yet billed",
  "Oldest unpaid, days",
  "Can order",
  "Why not",
  "Seats",
  "Open statement",
  "Open statement total",
] as const;

function describe(query: AccountListQuery): string {
  const parts: string[] = [];
  if (query.term) parts.push(`organization matching "${query.term}"`);
  if (query.status !== "all") parts.push(`status ${query.status}`);
  if (query.billing !== "all") parts.push(query.billing === "invoice" ? "on invoice" : "by card");
  if (query.attention === "cannot_order") parts.push("cannot order");
  return parts.length ? parts.join(", ") : "every account";
}

export function accountsCsv(rows: readonly AccountRow[], query: AccountListQuery, all: number): string {
  return csv({
    preamble: [
      ["Ordering accounts", `${rows.length} matching, of ${all}`],
      ["Filter", describe(query)],
      ["Sorted by", `${query.sort === "name" ? "organization" : "opened"}, ${query.ascending ? "ascending" : "descending"}`],
      ["Money", "In dollars. An empty money cell means the figure is not known, and is not zero."],
    ],
    headers: [...ACCOUNT_EXPORT_HEADERS],
    rows: rows.map((r) => [
      r.clientName,
      r.status,
      r.billingMode === "invoice" ? "invoice" : "card",
      moneyCell(r.creditLimitCents),
      r.netDays,
      r.orders,
      r.ordersThisPeriod,
      moneyCell(r.issuedUnpaidCents),
      moneyCell(r.unbilledCents),
      r.oldestUnpaidDays ?? "",
      r.canOrder ? "yes" : "no",
      r.blockedReason,
      r.users,
      r.openStatement ? `${r.openStatement.reference} (${r.openStatement.period})` : "",
      r.openStatement ? moneyCell(r.openStatement.totalCents) : "",
    ]),
  });
}

/** The file's name, dated in UTC as the other exports are. */
export function accountsFilename(): string {
  return `ordering-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
}
