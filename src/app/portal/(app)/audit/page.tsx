import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";
import {
  EmptyState,
  ErrorState,
  PageHead,
  Panel,
  RecordTable,
  type Column,
} from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

type Event = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  ip: string | null;
};

function stamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AuditPage() {
  const actor = await currentActor();
  if (!can(actor, "audit.read")) notFound();

  const db = supabaseAdmin();
  const { data, error } = db
    ? await db
        .from("eng_audit_events")
        .select("id, created_at, actor_email, actor_role, action, entity_type, entity_id, summary, ip")
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: null, error: { message: "The database is not configured." } };

  const events = ((data ?? []) as unknown[]).map((e) => {
    const row = e as Record<string, unknown>;
    return { ...row, id: String(row.id) } as Event;
  });

  const columns: Column<Event>[] = [
    { key: "when", head: "When", cell: (e) => stamp(e.created_at) },
    { key: "who", head: "Who", cell: (e) => e.actor_email ?? "system" },
    { key: "action", head: "Action", cell: (e) => <span className="font-mono text-[12.5px]">{e.action}</span> },
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

      {error ? (
        <ErrorState title="The trail could not be loaded" body={`The database returned: ${error.message}`} />
      ) : (
        <Panel title={`Most recent ${events.length}`} description="Newest first, capped at 200 for now.">
          <RecordTable
            rows={events}
            columns={columns}
            empty={<EmptyState title="Nothing recorded yet" body="Every action anyone takes in the platform lands here." />}
            card={(e) => (
              <div>
                <p className="font-mono text-[12.5px] text-[var(--gold-deep)]">{e.action}</p>
                <p className="mt-1 text-[13.5px] leading-[1.5] text-[var(--navy)]">{e.summary ?? e.entity_type}</p>
                <p className="mt-1.5 text-[12.5px] text-[var(--secondary)]">
                  {e.actor_email ?? "system"}, {stamp(e.created_at)}
                </p>
              </div>
            )}
          />
        </Panel>
      )}
    </>
  );
}
