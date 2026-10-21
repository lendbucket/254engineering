import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { getClient } from "@/lib/ops-crm";
import { canLookUpOrders, ordersForClient } from "@/lib/ops-order-lookup";
import { money } from "@/lib/ops-money";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ContactLogPanel } from "@/components/portal/ContactLog";

export const dynamic = "force-dynamic";

/**
 * ONE CLIENT. clients.list, 2026-10-20: who they are, how to reach them, their
 * orders for anybody who may look orders up, and the calls and notes on them,
 * which is the customer half of "notes and a call log on orders, customers
 * and prospects".
 */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "clients.list")) notFound();
  const { id } = await params;
  const client = await getClient(actor, id);
  if (!client) notFound();
  const orders = canLookUpOrders(actor) ? await ordersForClient(actor, id) : null;
  const tel = telLink(client.phone);

  return (
    <>
      <PageHead
        eyebrow="Clients"
        title={client.name}
        lede={`${client.kind === "organization" ? "Organization" : "Individual"}${client.client_type ? `, ${client.client_type.replace(/_/g, " ")}` : ""}${client.city ? `, ${client.city}` : ""}. Client since ${formatInFirmZone(client.created_at) ?? "an unrecorded date"}.`}
        actions={
          <Link href="/portal/clients" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline print:hidden">
            Back to clients
          </Link>
        }
      />
      <Panel title="How to reach them">
        <dl className="grid gap-2 text-[14px] sm:grid-cols-[140px_1fr]">
          <dt className="font-semibold text-[var(--ink)]">Phone</dt>
          <dd>{tel ? <a href={tel} className="font-semibold text-[var(--navy)] underline">{client.phone}</a> : client.phone ?? "No phone on file"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Email</dt>
          <dd>{client.email ? <a href={`mailto:${client.email}`} className="text-[var(--navy)] underline">{client.email}</a> : "No email on file"}</dd>
          <dt className="font-semibold text-[var(--ink)]">County</dt>
          <dd className="text-[var(--ink)]">{client.county ?? "Not recorded"}</dd>
        </dl>
      </Panel>

      {orders ? (
        <Panel className="mt-6" title="Orders">
          {!orders.ok ? (
            <ErrorState title="Orders could not be read" body={`${orders.error} Nothing here means this client has none.`} />
          ) : orders.rows.length === 0 ? (
            <EmptyState title="No orders yet" body="Orders this client places, and jobs taken for them that are paid, appear here." />
          ) : (
            <ul className="divide-y divide-[var(--row-rule)] border-t border-[var(--row-rule)]">
              {orders.rows.map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-[14px]">
                  <Link href={`/portal/order-lookup/${o.id}`} className="font-semibold text-[var(--navy)] underline">{o.reference}</Link>
                  <span className="text-[var(--secondary)]">{o.status.replace(/_/g, " ")}</span>
                  <span className="text-[var(--secondary)]">{o.propertyAddress}</span>
                  <span className="ml-auto tabular-nums text-[var(--ink)]">{o.totalCents === null ? "No total" : money(o.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <ContactLogPanel actor={actor} subject="client" subjectId={client.id} />
    </>
  );
}
