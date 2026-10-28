import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { inbox } from "./ops-inbox";
import { callList, type ProspectRow } from "./ops-prospects";
import { listRefundRequests } from "./ops-refund-requests";
import { holdsFor } from "./dispatch-hold";
import { readEvery } from "./bounded-read";
import type { Attention, Breakdown } from "./ops-dashboard";

/**
 * THE DESK: THE HOME SCREEN OF THE REP AND THE OPERATIONS MANAGER.
 * Operator ruling, 2026-10-20, office ready: a home screen per role showing
 * the work due now, new inquiries, unassigned jobs, follow-ups due, refund
 * requests and holds, with today's call list on the rep's home screen.
 *
 * NO MONEY FIELD, BY TYPE. Like the dispatcher's, the salesperson's and the
 * customer service dashboards, this type has no `money` field, so a firm money
 * figure cannot be put on it. A count of refund requests is a count of work,
 * not a figure about what the firm makes.
 *
 * Every tile is a real count or null with the reason in notComputable. A read
 * that failed never shows as zero.
 */

export type DeskTile = {
  label: string;
  count: number | null;
  note: string;
  href?: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

export type DeskDashboard = {
  role: "desk";
  tiles: DeskTile[];
  breakdowns: Breakdown[];
  attention: Attention[];
  notComputable: string[];
  /** Today's call list: the actor's own prospects and unowned ones, oldest follow-up first. Null when unreadable. */
  callList: ProspectRow[] | null;
  today: string | null;
};

export async function deskDashboard(actor: Actor): Promise<DeskDashboard> {
  const notComputable: string[] = [];
  const db = supabaseAdmin();
  if (!db) {
    return {
      role: "desk",
      tiles: [],
      breakdowns: [],
      attention: [],
      notComputable: ["The database is not configured, so nothing on this screen could be counted."],
      callList: null,
      today: null,
    };
  }

  const [box, calls, refunds, waiting] = await Promise.all([
    inbox(actor, { includeAnswered: false }),
    callList(actor, { mineOnly: true }),
    listRefundRequests(actor, { state: "waiting" }),
    readEvery<{ id: string; file_number: string; created_at: string }>((from, to) =>
      db
        .from("eng_files")
        .select("id, file_number, created_at")
        .eq("status", "needs_dispatch")
        .is("assigned_tech_id", null)
        .eq("is_demo", false)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  let inboxCount: number | null = null;
  if (!box.ok) notComputable.push(box.error);
  else if (box.failed.length) notComputable.push(...box.failed);
  else inboxCount = box.items.length;

  if (!calls.ok) notComputable.push(calls.error);
  if (!refunds.ok) notComputable.push(refunds.error);
  if (!waiting.ok) notComputable.push(`Unassigned jobs could not be read: ${waiting.error}`);

  /*
   * HOLDS: a job ready to dispatch that an answer has held for the engineer's
   * pre-review (dispatch-hold.ts). Asked of each unassigned job, because the
   * hold is decided from the job's answers rather than stored in a column. A
   * hold that could not be checked is said, not counted as clear.
   */
  let holds: number | null = null;
  const heldFiles: { id: string; file_number: string }[] = [];
  if (waiting.ok) {
    let unknown = 0;
    const holdStates = await holdsFor(waiting.rows.map((f) => f.id));
    waiting.rows.forEach((f, i) => {
      const h = holdStates[i];
      if (h.held === null) unknown += 1;
      else if (h.held) heldFiles.push(f);
    });
    if (unknown) notComputable.push(`${unknown} unassigned job${unknown === 1 ? "" : "s"} could not be checked for an engineer hold.`);
    else holds = heldFiles.length;
  }

  const unassigned = waiting.ok ? waiting.rows.length - heldFiles.length : null;
  const approves = can(actor, "refunds.approve_within_limit") || can(actor, "payments.refund");

  const tiles: DeskTile[] = [
    {
      label: "New inquiries",
      count: inboxCount,
      note: inboxCount === null ? "Not counted: see below." : inboxCount === 0 ? "Nobody is waiting for an answer." : "Waiting for an answer, oldest promise first.",
      href: "/portal/inbox",
      tone: inboxCount ? "warn" : "good",
    },
    {
      label: "Follow-ups due",
      count: calls.ok ? calls.rows.length : null,
      note: !calls.ok ? "Not counted: see below." : calls.rows.length === 0 ? "No call is due today." : "Due today or overdue. The list is below.",
      href: "/portal/prospects",
      tone: calls.ok && calls.rows.length ? "warn" : "good",
    },
    {
      label: "Unassigned jobs",
      count: unassigned,
      note: unassigned === null ? "Not counted: see below." : unassigned === 0 ? "Every job ready to go has a technician." : "Ready to dispatch and nobody on them.",
      href: "/portal/files",
      tone: unassigned ? "warn" : "good",
    },
    {
      label: "Holds",
      count: holds,
      note: holds === null ? "Not counted: see below." : holds === 0 ? "No job is waiting on the engineer before dispatch." : "Waiting on the engineer's pre-review before they can go out.",
      tone: holds ? "neutral" : "good",
    },
    {
      label: approves ? "Refund requests to decide" : "Refund requests waiting",
      count: refunds.ok ? refunds.rows.length : null,
      note: !refunds.ok ? "Not counted: see below." : refunds.rows.length === 0 ? "Nothing is waiting for a decision." : approves ? "Waiting for a decision." : "Waiting for somebody to decide.",
      href: "/portal/refunds",
      tone: refunds.ok && refunds.rows.length ? "warn" : "good",
    },
  ];

  const attention = heldFiles.map((f) => ({
    label: f.file_number,
    detail: "Held for the engineer's pre-review. It goes out once the engineer accepts it.",
    href: `/portal/files?id=${f.id}`,
  }));

  return {
    role: "desk",
    tiles,
    breakdowns: [],
    attention,
    notComputable,
    callList: calls.ok ? calls.rows : null,
    today: calls.ok ? calls.today : null,
  };
}
