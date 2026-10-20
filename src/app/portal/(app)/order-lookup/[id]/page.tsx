import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { canLookUpOrders, orderDetail } from "@/lib/ops-order-lookup";
import { canTransitionOrder, type OrderStatus } from "@/lib/ops-orders";
import { money } from "@/lib/ops-money";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ContactLogPanel } from "@/components/portal/ContactLog";
import { ActionButton } from "@/components/portal/staff-kit";
import { RequestRefund } from "../../refunds/RefundClient";

export const dynamic = "force-dynamic";


/**
 * ONE ORDER, AS A REP OR MANAGER SEES IT. 2026-10-20. Its customer, what they
 * were charged, what happened to it, the calls and notes on it, and the three
 * things the desk does from here: resend the status link, ask for a refund,
 * log a call. Printable: the controls drop out on paper.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || !canLookUpOrders(actor)) notFound();
  const { id } = await params;
  const read = await orderDetail(actor, id);
  if (read.ok && !read.order) notFound();
  if (!read.ok || !read.order) {
    return (
      <>
        <PageHead eyebrow="Order lookup" title="Order" />
        <ErrorState title="This order could not be read" body={read.ok ? "It was not found." : read.error} />
      </>
    );
  }
  const o = read.order;
  const tel = telLink(o.customerPhone);

  return (
    <>
      <PageHead
        eyebrow="Order lookup"
        title={o.reference}
        lede={`${o.status.replace(/_/g, " ")}. ${o.propertyAddress}${o.city ? `, ${o.city}` : ""}, ${o.county} County.`}
        actions={
          <Link href="/portal/order-lookup" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline print:hidden">
            Back to orders
          </Link>
        }
      />
      <Panel title="Summary">
        <dl className="grid gap-2 text-[14px] sm:grid-cols-[160px_1fr]">
          <dt className="font-semibold text-[var(--ink)]">Customer</dt>
          <dd className="text-[var(--ink)]">{o.customerName}{o.customerCompany ? `, ${o.customerCompany}` : ""}</dd>
          <dt className="font-semibold text-[var(--ink)]">Phone</dt>
          <dd>{tel ? <a href={tel} className="font-semibold text-[var(--navy)] underline">{o.customerPhone}</a> : o.customerPhone ?? "No phone on the order"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Email</dt>
          <dd><a href={`mailto:${o.customerEmail}`} className="text-[var(--navy)] underline">{o.customerEmail}</a></dd>
          <dt className="font-semibold text-[var(--ink)]">Service</dt>
          <dd className="text-[var(--ink)]">{o.serviceSlug.replace(/-/g, " ")}</dd>
          <dt className="font-semibold text-[var(--ink)]">Charged</dt>
          <dd className="text-[var(--ink)]">{o.totalCents === null ? "No total on the order" : money(o.totalCents)}</dd>
          <dt className="font-semibold text-[var(--ink)]">Placed</dt>
          <dd className="text-[var(--ink)]">{formatInFirmZone(o.placedAt) ?? "Not placed"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Paid</dt>
          <dd className="text-[var(--ink)]">{formatInFirmZone(o.paidAt) ?? "Not paid"}</dd>
          {o.fileId && can(actor, "files.list") ? (
            <>
              <dt className="font-semibold text-[var(--ink)]">Job</dt>
              <dd><Link href={`/portal/files?id=${o.fileId}`} className="font-semibold text-[var(--navy)] underline">Open the job</Link></dd>
            </>
          ) : null}
        </dl>
      </Panel>

      <div className="portal-sections mt-6 grid gap-6 lg:grid-cols-2 print:hidden">
        {can(actor, "orders.resend_link") ? (
          <Panel title="Status link" description="Sends the customer a fresh link to this order's status page, in the order confirmation email. Only once the order has been released.">
            <ActionButton
              url="/api/portal/desk"
              payload={{ action: "resend_status_link", orderId: o.id }}
              confirm={`Email ${o.customerEmail} a fresh status link for ${o.reference}?`}
              done="Sent. The order's history below records it."
            >
              Resend the status link
            </ActionButton>
          </Panel>
        ) : null}
        {can(actor, "refunds.request") && canTransitionOrder(o.status as OrderStatus, "refunded") ? (
          <Panel title="Refund" description="Ask for the money to go back. Somebody who can approve refunds decides it.">
            <RequestRefund orderId={o.id} />
          </Panel>
        ) : null}
      </div>

      <Panel className="mt-6" title="What happened">
        {read.events.length === 0 ? (
          <p className="text-[14px] text-[var(--secondary)]">Nothing is recorded on this order yet.</p>
        ) : (
          <ol className="divide-y divide-[var(--row-rule)] border-t border-[var(--row-rule)]">
            {read.events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="py-2.5 text-[14px]">
                <span className="text-[var(--secondary)]">{formatInFirmZone(e.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>{" "}
                <span className="text-[var(--ink)]">{e.text ?? e.event.replace(/[._]/g, " ")}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <ContactLogPanel actor={actor} subject="order" subjectId={o.id} />
    </>
  );
}
