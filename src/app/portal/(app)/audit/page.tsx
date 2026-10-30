import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { actionLabel } from "@/lib/portal-labels";
import { AUDIT_PAGE_SIZE, auditTrailPage, auditTrailQuery, type AuditEvent } from "@/lib/audit-trail-list";
import { LIST_EXPORT_GRANT } from "@/lib/list-exports";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import {
  EmptyState,
  ErrorState,
  PageHead,
  Panel,
  RecordTable,
  type Column,
} from "@/components/portal/surfaces";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

type Event = AuditEvent;

function stamp(value: string): string {
  return (formatInFirmZone(value, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) ?? "");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!can(actor, "audit.read")) notFound();

  const params = await searchParams;
  const query = auditTrailQuery(params);
  const read = await auditTrailPage(query);
  const error = read.ok ? null : { message: read.error };
  const events = read.ok ? read.rows : [];
  const total = read.ok ? read.total : 0;
  const searching = Boolean(query.term || query.who);

  const columns: Column<Event>[] = [
    { key: "when", head: "When", cell: (e) => stamp(e.created_at) },
    { key: "who", head: "Who", cell: (e) => e.actor_email ?? "system" },
    /*
     * THE LABEL, NOT THE KEY. Operator ruling, 2026-09-21.
     *
     * This rendered `customer.signed_in` in monospace. The key is still what is
     * STORED, and the trail is unchanged; what a person reads is the same fact
     * as English. Monospace went with it, because the point of that face here
     * was that the value was an identifier.
     */
    { key: "action", head: "Action", cell: (e) => <span className="text-[12.5px]">{actionLabel(e.action)}</span> },
    { key: "what", head: "What happened", cell: (e) => e.summary ?? `${e.entity_type} ${e.entity_id ?? ""}` },
    { key: "ip", head: "IP", wide: true, cell: (e) => e.ip ?? "" },
  ];

  return (
    <>
      <PageHead
        eyebrow="Regulatory memory"
        title="Audit trail"
        lede="Every create, update, status change, assignment, upload, and review decision. The table refuses updates and deletes at the database level, so what is written here stays written."
      />

      <ListControls
        action="/portal/audit"
        search={params.q ?? ""}
        searchLabel="Search what happened, who, action or record"
        filters={[
          {
            name: "who",
            label: "Who",
            value: query.who,
            options: [
              { value: "", label: "Everyone and the system" },
              { value: "people", label: "A person" },
              { value: "system", label: "The system" },
            ],
          },
        ]}
        sorts={[{ value: "when", label: "When" }]}
        sort="when"
        direction={query.ascending ? "asc" : "desc"}
        csvHref={can(actor, LIST_EXPORT_GRANT) ? listHref("/api/portal/exports", { q: params.q, who: params.who, dir: params.dir }, { report: "audit-trail" }) : undefined}
      />

      {error ? (
        <ErrorState title="The trail could not be loaded" body={`The database returned: ${error.message}`} />
      ) : (
        <Panel
          title={searching ? `${total} matching` : `${total} events`}
          description={query.ascending ? "Oldest first. Every event is here; nothing is capped." : "Newest first. Every event is here; nothing is capped."}
        >
          <RecordTable
            rows={events}
            columns={columns}
            empty={
              searching ? (
                <EmptyState title="No event matches that search" body="This is a search with no match, not an empty trail. Clear the search to see every event." />
              ) : (
                <EmptyState title="Nothing recorded yet" body="Every action anyone takes in the platform lands here." />
              )
            }
            card={(e) => (
              <div>
                <p className="text-[12px] font-semibold text-[var(--faint)]">{actionLabel(e.action)}</p>
                <p className="mt-1 text-[13.5px] leading-[1.5] break-words text-[var(--navy)]">{e.summary ?? e.entity_type}</p>
                {/*
                  break-words on both lines, because everything on this card is
                  written by something else and can be arbitrarily long without
                  a space in it.

                  Found on 2026-09-09 by native-audit, after the suppression
                  screen started writing summaries that quote an email address.
                  An address has no break opportunity, so one row forced the
                  card wider than the phone and the whole trail scrolled
                  sideways with no affordance. The trail is the one screen whose
                  content the platform has no say over at all.
                */}
                <p className="mt-1.5 text-[12.5px] break-words text-[var(--secondary)]">
                  {e.actor_email ?? "system"}, {stamp(e.created_at)}
                </p>
              </div>
            )}
          />
          <Pager page={query.page} pageSize={AUDIT_PAGE_SIZE} total={total} hrefFor={(n) => listHref("/portal/audit", params, { page: n > 1 ? String(n) : "" })} />
        </Panel>
      )}
    </>
  );
}
