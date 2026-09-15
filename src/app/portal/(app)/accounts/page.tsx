import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { accountRows } from "@/lib/ops-accounts-admin";
import { money } from "@/lib/ops-money";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { AccountsClient } from "./AccountsClient";
import { OpenAccountClient } from "./OpenAccountClient";

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
        <>
          {/*
            THIS COPY WENT OUT OF DATE THE DAY THE TELEPHONE DOOR WAS BUILT.

            It said an account is created by converting an existing client
            organisation, full stop, which was true while that was the only
            path. There are three now, and a screen that names one of them is
            the same defect as a registry that names a door nobody built.
          */}
          <EmptyState
            title="No ordering accounts yet"
            body="An account arrives one of three ways: somebody rings and you open one below, somebody pays for an order, or an existing client organisation is converted, which keeps every file and document already attached to them."
          />
          <div className="mt-4">
            <OpenAccountClient />
          </div>
        </>
      ) : (
        <>
          {blocked.length > 0 ? (
            <div className="mb-4 rounded-[4px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3.5">
              <p className="portal-kicker text-[var(--warn-ink)]">
                {blocked.length} account{blocked.length === 1 ? "" : "s"} cannot order
              </p>
              <ul className="mt-2 space-y-1">
                {blocked.map((r) => (
                  <li key={r.id} className="text-[13.5px] leading-[1.55] text-[var(--warn-ink)]">
                    <span className="font-semibold">{r.clientName}</span>: {r.blockedReason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            ABOVE THE LIST AND BELOW THE WARNING.

            The question this screen is opened with is which accounts are stuck,
            and that warning stays first. Opening an account from a call is the
            other thing an operator comes here to do, and it is a disclosure
            rather than a form so it costs one line until it is wanted.
          */}
          {/*
            IN A PANEL, WITH A TITLE, AND THE SCREENSHOT IS WHAT SAID SO.

            The first version put the control straight onto the page
            background. Every check was green: no overflow, tap targets fine,
            contrast fine, and at both widths it worked. Opening the screenshot
            showed a form with no heading, floating outside the white surface
            every other block on this screen sits in, beginning mid sentence
            with "For somebody who has rung". An operator scanning the page had
            nothing telling them what it was.

            Nothing on the board measures whether a form is labelled, which is
            the same shape as the queue screen that was 38,744 pixels tall and
            correct by every question anybody had asked.
          */}
          <div className="mb-4">
            <Panel
              title="Open an account"
              description="From a telephone call, for somebody who is not yet a customer."
            >
              <OpenAccountClient />
            </Panel>
          </div>

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

          <p className="mt-4 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
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
