import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { ordersNeedingAttention } from "@/lib/ops-reconcile";
import { CHECKOUT_SESSION_HOURS, toneFor } from "@/lib/order-attention";
import { money } from "@/lib/ops-money";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { OrdersClient } from "./OrdersClient";

export const dynamic = "force-dynamic";

/**
 * Orders that have stopped moving.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * On 2026-09-03 three orders took six hundred and seventy five dollars each and
 * sat at awaiting_payment, because the webhook that would have recorded the
 * money was not subscribed to the event. Nothing anywhere counted them. They
 * were found because somebody went looking for a row.
 *
 * The platform could already fix that once it was told: reconciliation asks
 * Stripe what really happened. What it could not do was NOTICE. This is the
 * difference between a lost payment being asked about and being seen.
 *
 * WHAT IT DELIBERATELY DOES NOT SHOW
 * ----------------------------------
 * Every order. A list of everything would be a list nobody reads, and the
 * screen's whole value is that anything on it is wrong. Orders moving normally
 * belong on the files they created, which is where the work is done.
 *
 * The two actions here are the two honest answers to a stuck order: ask the
 * provider what happened, and give the money back. Neither is reachable without
 * a separate permission, and the second requires a written reason because it is
 * the one refund with no engineering decision behind it.
 */
export default async function OrdersPage() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "payments.reconcile")) redirect("/portal");

  const orders = await ordersNeedingAttention();
  const needsAction = orders.filter((o) => o.attention.level === "act");
  const watching = orders.filter((o) => o.attention.level === "watch");

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Orders needing attention"
        lede={`An order waiting on payment for more than ${CHECKOUT_SESSION_HOURS} hours has outlived its checkout session. It is either an abandonment nobody closed or a payment nobody recorded, and only the payment provider can say which.`}
      />

      {orders.length === 0 ? (
        <EmptyState
          title="Nothing is stuck"
          body={`Every order is either moving or was paid for. An order appears here once it has been waiting on payment for more than ${CHECKOUT_SESSION_HOURS} hours, which is longer than a checkout session lives.`}
        />
      ) : (
        <>
          {needsAction.length > 0 ? (
            <Panel
              title="A payment may have been taken"
              description="A checkout was started and no payment was ever recorded against it. Ask the provider before assuming nobody paid."
            >
              <OrdersClient orders={needsAction} canRefund={can(actor, "payments.refund")} />
            </Panel>
          ) : null}

          {watching.length > 0 ? (
            <div className="mt-4">
              <Panel
                title="Abandoned before checkout"
                description="No checkout was ever started on these, so nothing can have been charged. They are waiting to be closed rather than investigated."
              >
                <ul className="divide-y divide-limestone-line">
                  {watching.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                      <span className="font-mono text-[13.5px] font-semibold text-[var(--navy)]">{o.reference}</span>
                      <Chip label={o.attention.label} tone={toneFor(o.attention.level)} />
                      <span className="text-[13.5px] text-[var(--secondary)]">{o.propertyAddress}</span>
                      <span className="ml-auto text-[13.5px] text-[var(--secondary)]">{money(o.totalCents)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
