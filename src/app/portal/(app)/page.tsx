import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, homeFor } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";
import { isPrelaunch } from "@/lib/launch";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * The administrator's home.
 *
 * Engineers and technicians never land here: their home is their queue and their
 * jobs. homeFor in the authorization module is the single answer to "where does
 * this role belong", used by sign in and by this redirect, so the two cannot
 * disagree.
 *
 * WHAT THIS SHOWS TODAY, HONESTLY
 * -------------------------------
 * Counts of real rows, which are zero, and the compliance state. It does not
 * show a revenue chart with invented numbers or a pipeline with sample files.
 * The dashboard the program describes arrives in Phase 6 when there is something
 * to put in it.
 */
export default async function PortalHome() {
  const actor = await currentActor();
  if (actor && actor.role !== "admin") redirect(homeFor(actor.role));
  if (!can(actor, "files.list")) redirect("/portal/profile");

  const db = supabaseAdmin();
  const counts = { people: 0, clients: 0, files: 0, events: 0 };
  if (db) {
    const [people, clients, filesCount, events] = await Promise.all([
      db.from("eng_profiles").select("id", { count: "exact", head: true }),
      db.from("eng_clients").select("id", { count: "exact", head: true }),
      db.from("eng_files").select("id", { count: "exact", head: true }),
      db.from("eng_audit_events").select("id", { count: "exact", head: true }),
    ]);
    counts.people = people.count ?? 0;
    counts.clients = clients.count ?? 0;
    counts.files = filesCount.count ?? 0;
    counts.events = events.count ?? 0;
  }

  const tiles = [
    { label: "People with accounts", value: counts.people },
    { label: "Clients", value: counts.clients },
    { label: "Open files", value: counts.files },
    { label: "Audit events recorded", value: counts.events },
  ];

  return (
    <>
      <PageHead
        eyebrow="Operations"
        title={`Good to see you, ${actor!.display_name.split(" ")[0]}`}
        lede="The firm at a glance. Counts are live rows, not samples."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-4"
          >
            <p className="font-display text-[28px] leading-none font-bold text-slate">{t.value}</p>
            <p className="mt-2 text-[12.5px] leading-[1.4] text-slate-muted">{t.label}</p>
          </div>
        ))}
      </div>

      {isPrelaunch() ? (
        <div className="mt-6 rounded-[4px] border border-[#f0d9a8] border-l-[3px] border-l-brass bg-[#fdf3e0] px-4 py-3.5">
          <p className="text-[13px] font-bold tracking-[0.1em] text-[#7a4c05] uppercase">
            Compliance gate active
          </p>
          <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.6] text-[#7a4c05]">
            Firm registration with TBPELS is pending and no Professional Engineer is in responsible
            charge. Files can be created and prepared, and no file can reach sealed or delivered.
            The platform enforces that rather than trusting anyone to remember it.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Pipeline" description="Files by status.">
          <EmptyState
            title="No files yet"
            body="Clients and files arrive in the next phase. When they do, this becomes the pipeline by status with overdue work first."
          />
        </Panel>
        <Panel title="Attention" description="Overdue work and expiring credentials.">
          <EmptyState
            title="Nothing needs you"
            body="Credential expiry alerts and overdue files appear here once technicians are onboarded and files are moving."
          />
        </Panel>
      </div>
    </>
  );
}
