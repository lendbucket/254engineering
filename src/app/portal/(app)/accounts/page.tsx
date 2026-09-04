import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { accountRows } from "@/lib/ops-accounts-admin";
import { money } from "@/lib/ops-money";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { AccountsClient } from "./AccountsClient";

export const dynamic = "force-dynamic";

/**
 * Ordering accounts: who orders regularly, what they owe, and on what terms.
 *
 * THE COLUMN THAT MATTERS IS "CAN THEY ORDER"
 * -------------------------------------------
 * Volume and balance are worth seeing, but the question an operator opens this
 * screen with is which accounts are stuck. That column is computed from the same
 * creditDecision the ordering path uses, so this screen and the refusal a
 * customer sees can never disagree about why.
 *
 * THE BALANCE IS TWO FIGURES, NOT ONE
 * -----------------------------------
 * Issued and unpaid is what they owe. Unbilled is work done that no statement
 * covers yet. Summing them into one number hides which of the two is growing,
 * and they call for completely different actions.
 */
export default async function AccountsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "accounts.manage")) redirect("/portal");

  const rows = await accountRows();
  const blocked = rows.filter((r) => !r.canOrder && r.status === "active");
  const unbilled = rows.filter((r) => (r.unbilledCents ?? 0) > 0);

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Ordering accounts"
        lede="Organisations that order regularly. What they have ordered, what they owe, and whether they can order right now."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No ordering accounts yet"
          body="An account is created by converting an existing client organisation, which keeps every file and document already attached to them."
        />
      ) : (
        <>
          {blocked.length > 0 ? (
            <div className="mb-4 rounded-[4px] border border-[#f0d9a8] border-l-[3px] border-l-brass bg-[#fdf3e0] px-4 py-3.5">
              <p className="text-[13px] font-bold tracking-[0.1em] text-[#7a4c05] uppercase">
                {blocked.length} account{blocked.length === 1 ? "" : "s"} cannot order
              </p>
              <ul className="mt-2 space-y-1">
                {blocked.map((r) => (
                  <li key={r.id} className="text-[13.5px] leading-[1.55] text-[#7a4c05]">
                    <span className="font-semibold">{r.clientName}</span>: {r.blockedReason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Panel
            title="Accounts"
            description={
              unbilled.length > 0
                ? `${unbilled.length} account${unbilled.length === 1 ? " has" : "s have"} work that no statement covers yet.`
                : "Every invoiced account is billed up to date."
            }
          >
            <AccountsClient
              rows={rows.map((r) => ({
                id: r.id,
                clientName: r.clientName,
                status: r.status,
                billingMode: r.billingMode,
                creditLimitCents: r.creditLimitCents,
                netDays: r.netDays,
                orders: r.orders,
                ordersThisPeriod: r.ordersThisPeriod,
                issuedUnpaidCents: r.issuedUnpaidCents,
                unbilledCents: r.unbilledCents,
                oldestUnpaidDays: r.oldestUnpaidDays,
                canOrder: r.canOrder,
                blockedReason: r.blockedReason,
                users: r.users,
                openStatement: r.openStatement,
              }))}
            />
          </Panel>

          <p className="mt-4 text-[13px] leading-[1.6] text-slate-muted">
            Nothing chases an overdue statement automatically. There are no reminders, no late fees
            and no automatic suspension: the only consequence is that an overdue account cannot place
            further invoiced work, and the reason is shown to them when they try.{" "}
            <Chip label="by design" tone="neutral" />
          </p>
        </>
      )}
    </>
  );
}
