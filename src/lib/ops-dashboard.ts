import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, REVIEW_QUEUE_STATUSES, type Actor } from "./ops-authz";
import { taskCounts } from "./ops-tasks";
import { unreadCount } from "./ops-notify";
import { fileMargins, marginByPeriod, type FileMargin } from "./ops-docs";
import { expiryState } from "./ops-credentials";
import { periodOf } from "./ops-review";
import { ordersNeedingAttention } from "./ops-reconcile";
import type { Cents, PeriodTotals } from "./ops-money";

/**
 * The three dashboards.
 *
 * WHAT A DASHBOARD IS FOR HERE
 * ----------------------------
 * Not a wall of charts. Each role opens this to answer one question: what needs
 * me today. Everything on it is either something to act on or a number the
 * operator would otherwise reconstruct by hand.
 *
 * A COUNT OF ZERO AND A FIGURE THAT IS NOT THERE ARE DIFFERENT
 * ------------------------------------------------------------
 * Counts here are honest zeroes. No files in review means none, and the tile
 * says so in words. Money is Cents, which can be null, and a null renders as
 * "not set" rather than as nothing.
 *
 * They are deliberately two different types rendered by two different
 * components. One component formatting both is how an absent dollar figure ends
 * up displayed the way an empty queue is.
 */

export type Tile = {
  label: string;
  /** A real count. Zero means zero. */
  count: number;
  /** What the number means, and what to do about it. */
  note: string;
  href: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

export type MoneyTile = {
  label: string;
  /** Null means the figure is not known. It never means nothing. */
  value: Cents;
  note: string;
};

export type Attention = { label: string; detail: string; href: string };

export type AdminDashboard = {
  role: "admin";
  tiles: Tile[];
  money: MoneyTile[];
  period: PeriodTotals | null;
  /** Every period, so a trend is visible without an export. */
  periods: PeriodTotals[];
  attention: Attention[];
};

export type EngineerDashboard = {
  role: "engineer";
  tiles: Tile[];
  money: MoneyTile[];
  reviewMinutesThisPeriod: number;
  reviewsThisPeriod: number;
  attention: Attention[];
};

export type TechDashboard = {
  role: "field_tech";
  tiles: Tile[];
  money: MoneyTile[];
  attention: Attention[];
};

export type Dashboard = AdminDashboard | EngineerDashboard | TechDashboard;

const HOURS_48 = 48 * 60 * 60 * 1000;
const TECH_OPEN_STATUSES = ["dispatched", "evidence_in_progress", "revisions_requested"];

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

async function countRows(build: (db: Db) => unknown): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const { count } = (await build(db)) as { count: number | null };
  return count ?? 0;
}

/**
 * Total a set of ledger rows.
 *
 * AN EMPTY LEDGER IS A ZERO, AND A FAILED READ IS NOT
 * ---------------------------------------------------
 * This returned null for an empty set at first, on the reasoning that an absent
 * figure must never render as a zero. That was the rule applied in the wrong
 * direction, and the engineer's dashboard showed it: production for a month with
 * no ledger entries read "not set", when the truthful answer is that nothing has
 * been earned that the ledger records. Turning a real zero into an absence is
 * the same class of lie as the reverse, just the flattering way round.
 *
 * amount_cents is not nullable, so a row always carries a number and a sum over
 * rows is always a number. The one genuinely unknown case is a query that
 * failed, where PostgREST hands back null instead of an array. That, and only
 * that, is what null means here.
 */
const sumCents = (rows: { amount_cents?: unknown }[] | null): Cents =>
  rows === null ? null : rows.reduce((n, r) => n + Number(r.amount_cents ?? 0), 0);

// ------------------------------------------------------------------ admin

async function adminDashboard(actor: Actor): Promise<AdminDashboard> {
  const db = supabaseAdmin();
  if (!db) {
    return { role: "admin", tiles: [], money: [], period: null, periods: [], attention: [] };
  }

  const now = new Date().toISOString();
  const soon = new Date(Date.now() + HOURS_48).toISOString();

  const [inQueue, overdueEvidence, dueSoon, openOffers, activeTechs, atIntake, tasks, unread, margins, expiring, stuckOrders] =
    await Promise.all([
      countRows((d) =>
        d.from("eng_files").select("id", { count: "exact", head: true }).in("status", REVIEW_QUEUE_STATUSES),
      ),
      countRows((d) =>
        d
          .from("eng_files")
          .select("id", { count: "exact", head: true })
          .lt("evidence_due_at", now)
          .in("status", TECH_OPEN_STATUSES),
      ),
      countRows((d) =>
        d
          .from("eng_files")
          .select("id", { count: "exact", head: true })
          .gte("evidence_due_at", now)
          .lt("evidence_due_at", soon)
          .in("status", TECH_OPEN_STATUSES),
      ),
      countRows((d) =>
        d.from("eng_assignments").select("id", { count: "exact", head: true }).eq("state", "offered"),
      ),
      countRows((d) =>
        d
          .from("eng_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "field_tech")
          .eq("status", "active"),
      ),
      countRows((d) => d.from("eng_files").select("id", { count: "exact", head: true }).in("status", ["intake", "needs_dispatch"])),
      taskCounts(actor),
      unreadCount(actor.id),
      fileMargins(actor),
      expiringCredentialCount(),
      ordersNeedingAttention(),
    ]);

  const needsAction = stuckOrders.filter((o) => o.attention.level === "act");
  const watching = stuckOrders.filter((o) => o.attention.level === "watch");

  const periods = marginByPeriod(margins);
  const thisPeriod = periods.find((p) => p.period === periodOf(new Date())) ?? null;

  const tiles: Tile[] = [
    {
      label: "Waiting on an engineer",
      count: inQueue,
      note: inQueue === 0 ? "Nothing is sitting in the review queue." : "Evidence is in and no decision is recorded.",
      href: "/portal/review",
      tone: inQueue === 0 ? "good" : inQueue > 5 ? "warn" : "neutral",
    },
    {
      label: "Evidence past due",
      count: overdueEvidence,
      note:
        overdueEvidence === 0
          ? "No dispatched file has run past its deadline."
          : "A technician holds these and the deadline has gone.",
      href: "/portal/files",
      tone: overdueEvidence === 0 ? "good" : "bad",
    },
    {
      label: "Due in 48 hours",
      count: dueSoon,
      note: "Dispatched files with a deadline inside two days.",
      href: "/portal/files",
      tone: dueSoon === 0 ? "neutral" : "warn",
    },
    {
      label: "Offers out",
      count: openOffers,
      note: openOffers === 0 ? "No offer is waiting on a technician." : "Sent and not yet answered.",
      href: "/portal/dispatch",
      tone: "neutral",
    },
    {
      label: "Not yet dispatched",
      count: atIntake,
      note: "Opened, or waiting on dispatch, with nobody on them.",
      href: "/portal/files",
      tone: atIntake === 0 ? "neutral" : "warn",
    },
    {
      label: "Dispatchable technicians",
      count: activeTechs,
      note: activeTechs === 0 ? "Nobody can be offered work." : "Active field accounts.",
      href: "/portal/techs",
      tone: activeTechs === 0 ? "bad" : "good",
    },
    {
      label: "Credentials expiring",
      count: expiring,
      note:
        expiring === 0
          ? "Nothing is inside the warning window."
          : "Inside the warning window or already past it.",
      href: "/portal/techs",
      tone: expiring === 0 ? "good" : "warn",
    },
    {
      /*
       * Money that may already have moved. This tile is why the whole
       * order-attention module exists: three orders once took 675 dollars each
       * and sat unrecorded because nothing anywhere counted them, and they were
       * found by a person going to look for a row.
       *
       * It reads "act" only, not every order needing attention, so an
       * abandonment nobody has closed does not turn the tile red beside a
       * payment that may be lost.
       */
      label: "Orders stuck on payment",
      count: needsAction.length,
      note:
        needsAction.length === 0
          ? "Nothing is waiting on a payment that should have arrived."
          : "A checkout was started and no payment was ever recorded.",
      href: "/portal/orders",
      tone: needsAction.length === 0 ? "good" : "bad",
    },
    {
      label: "Tasks overdue",
      count: tasks.overdue,
      note: `${tasks.open} open in total.`,
      href: "/portal/tasks",
      tone: tasks.overdue === 0 ? "good" : "bad",
    },
  ];

  const money: MoneyTile[] = [
    {
      label: "Margin this period",
      value: thisPeriod?.margin ?? null,
      note: thisPeriod ? thisPeriod.coverage : "No file carries a period of this month yet.",
    },
    {
      label: "Revenue this period",
      value: thisPeriod?.revenue ?? null,
      note: thisPeriod
        ? `From the ${thisPeriod.complete} file${thisPeriod.complete === 1 ? "" : "s"} with every figure entered.`
        : "No file carries a period of this month yet.",
    },
  ];

  const attention: Attention[] = [];

  /*
   * First in the list, ahead of everything else on this screen, because it is
   * the only entry that can mean a customer has been charged and has no order.
   */
  if (needsAction.length > 0) {
    attention.push({
      label: `${needsAction.length} order${needsAction.length === 1 ? "" : "s"} stuck on payment`,
      detail:
        "A checkout was started more than a day ago and no payment was recorded. Either nobody paid, or somebody paid and the platform never heard. Ask the provider.",
      href: "/portal/orders",
    });
  }
  if (watching.length > 0) {
    attention.push({
      label: `${watching.length} order${watching.length === 1 ? "" : "s"} abandoned before checkout`,
      detail: "Nothing can have been charged on these. They are waiting to be closed.",
      href: "/portal/orders",
    });
  }

  if (overdueEvidence > 0) {
    attention.push({
      label: `${overdueEvidence} file${overdueEvidence === 1 ? "" : "s"} past the evidence deadline`,
      detail: "Nothing chases these automatically. Somebody has to call the technician.",
      href: "/portal/files",
    });
  }
  if (activeTechs === 0) {
    attention.push({
      label: "No technician can be dispatched",
      detail: "Every field account is inactive, suspended, or blocked on a credential.",
      href: "/portal/techs",
    });
  }
  const incomplete = margins.filter(
    (m) => m.clientPriceCents === null || m.techCostCents === null || m.engineerCostCents === null,
  ).length;
  if (incomplete > 0) {
    attention.push({
      label: `${incomplete} file${incomplete === 1 ? "" : "s"} missing a money figure`,
      detail:
        "Those files are left out of every total rather than counted as nothing, so the margin above describes the rest.",
      href: "/portal/billing",
    });
  }
  if (unread > 0) {
    attention.push({
      label: `${unread} unread notification${unread === 1 ? "" : "s"}`,
      detail: "In the bell, oldest first.",
      href: "/portal/notifications",
    });
  }

  return { role: "admin", tiles, money, period: thisPeriod, periods, attention };
}

async function expiringCredentialCount(): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const { data } = await db
    .from("eng_credentials")
    .select("expires_on, status")
    .not("expires_on", "is", null)
    .neq("status", "rejected");
  return (data ?? []).filter((c) => {
    const state = expiryState(c.expires_on as string | null);
    return state === "expiring" || state === "expired";
  }).length;
}

// --------------------------------------------------------------- engineer

async function engineerDashboard(actor: Actor): Promise<EngineerDashboard> {
  const db = supabaseAdmin();
  if (!db) {
    return {
      role: "engineer",
      tiles: [],
      money: [],
      reviewMinutesThisPeriod: 0,
      reviewsThisPeriod: 0,
      attention: [],
    };
  }

  const period = periodOf(new Date());

  const [queue, open, tasks, unread] = await Promise.all([
    countRows((d) =>
      d.from("eng_files").select("id", { count: "exact", head: true }).eq("status", "evidence_submitted"),
    ),
    countRows((d) => d.from("eng_files").select("id", { count: "exact", head: true }).eq("status", "under_review")),
    taskCounts(actor),
    unreadCount(actor.id),
  ]);

  const { data: charge } = await db
    .from("eng_responsible_charge_log")
    .select("review_minutes")
    .eq("engineer_id", actor.id)
    .eq("period", period);

  const reviewsThisPeriod = (charge ?? []).length;
  const reviewMinutesThisPeriod = (charge ?? []).reduce(
    (n, r) => n + ((r.review_minutes as number | null) ?? 0),
    0,
  );

  /*
   * Production pay is read from the ledger rather than recomputed from tiers.
   * The ledger is the record of what was earned; a dashboard that derived the
   * same number a second way would eventually disagree with it, and the
   * engineer would have two answers to a question that has one.
   */
  const { data: ledger } = await db
    .from("eng_production_ledger")
    .select("amount_cents, status")
    .eq("engineer_id", actor.id)
    .eq("period", period);

  /*
   * Kept nullable deliberately. A read that failed and a period with no entries
   * are different facts, and the tile says which one it is.
   */
  const rows = ledger as { amount_cents?: unknown; status?: unknown }[] | null;
  const unpaid = rows === null ? null : rows.filter((r) => r.status !== "paid");

  const tiles: Tile[] = [
    {
      label: "Waiting for review",
      count: queue,
      note: queue === 0 ? "The queue is empty." : "Evidence submitted and nobody has opened it.",
      href: "/portal/review",
      tone: queue === 0 ? "good" : queue > 5 ? "warn" : "neutral",
    },
    {
      label: "Open in review",
      count: open,
      note: "Taken into review and not yet decided.",
      href: "/portal/review",
      tone: "neutral",
    },
    {
      label: `Reviews in ${period}`,
      count: reviewsThisPeriod,
      note: `${reviewMinutesThisPeriod} minute${reviewMinutesThisPeriod === 1 ? "" : "s"} recorded against them.`,
      href: "/portal/charge-log",
      tone: "neutral",
    },
    {
      label: "Tasks overdue",
      count: tasks.overdue,
      note: `${tasks.open} open in total, including the licence and filing dates.`,
      href: "/portal/tasks",
      tone: tasks.overdue === 0 ? "good" : "bad",
    },
    {
      label: "Unread notifications",
      count: unread,
      note: "In the bell.",
      href: "/portal/notifications",
      tone: "neutral",
    },
  ];

  const money: MoneyTile[] = [
    {
      label: `Production in ${period}`,
      value: sumCents(rows),
      note:
        rows === null
          ? "The ledger could not be read, so this is not a zero. Tell an administrator."
          : rows.length
            ? `${rows.length} ledger entr${rows.length === 1 ? "y" : "ies"} in this period.`
            : "No ledger entries this period. Nothing has been earned that the ledger records.",
    },
    {
      label: "Not yet paid",
      value: sumCents(unpaid),
      note:
        unpaid === null
          ? "The ledger could not be read."
          : unpaid.length
            ? `${unpaid.length} entr${unpaid.length === 1 ? "y" : "ies"} pending or approved.`
            : "Nothing outstanding for this period.",
    },
  ];

  const attention: Attention[] = [];
  if (queue > 0) {
    attention.push({
      label: `${queue} package${queue === 1 ? "" : "s"} waiting`,
      detail: "Evidence is in and no engineer has opened it.",
      href: "/portal/review",
    });
  }
  if (tasks.overdue > 0) {
    attention.push({
      label: `${tasks.overdue} compliance task${tasks.overdue === 1 ? "" : "s"} overdue`,
      detail: "Licence renewal, the nonsubscriber filing and the insurance dates all sit in that list.",
      href: "/portal/tasks",
    });
  }

  return { role: "engineer", tiles, money, reviewMinutesThisPeriod, reviewsThisPeriod, attention };
}

// ------------------------------------------------------------ field tech

async function techDashboard(actor: Actor): Promise<TechDashboard> {
  const db = supabaseAdmin();
  if (!db) return { role: "field_tech", tiles: [], money: [], attention: [] };

  const now = new Date().toISOString();
  const soon = new Date(Date.now() + HOURS_48).toISOString();

  const [offers, active, dueSoon, overdue, tasks, unread] = await Promise.all([
    countRows((d) =>
      d
        .from("eng_assignments")
        .select("id", { count: "exact", head: true })
        .eq("tech_id", actor.id)
        .eq("state", "offered"),
    ),
    countRows((d) =>
      d
        .from("eng_files")
        .select("id", { count: "exact", head: true })
        .eq("assigned_tech_id", actor.id)
        .in("status", TECH_OPEN_STATUSES),
    ),
    countRows((d) =>
      d
        .from("eng_files")
        .select("id", { count: "exact", head: true })
        .eq("assigned_tech_id", actor.id)
        .gte("evidence_due_at", now)
        .lt("evidence_due_at", soon)
        .in("status", TECH_OPEN_STATUSES),
    ),
    countRows((d) =>
      d
        .from("eng_files")
        .select("id", { count: "exact", head: true })
        .eq("assigned_tech_id", actor.id)
        .lt("evidence_due_at", now)
        .in("status", TECH_OPEN_STATUSES),
    ),
    taskCounts(actor),
    unreadCount(actor.id),
  ]);

  const { data: pay } = await db.from("eng_tech_pay_ledger").select("amount_cents, status").eq("tech_id", actor.id);
  const rows = pay as { amount_cents?: unknown; status?: unknown }[] | null;
  const outstanding = rows === null ? null : rows.filter((r) => r.status !== "paid");
  const paid = rows === null ? null : rows.filter((r) => r.status === "paid");

  const tiles: Tile[] = [
    {
      label: "Offers waiting on you",
      count: offers,
      note: offers === 0 ? "Nothing has been offered to you right now." : "Answer before they expire.",
      href: "/portal/offers",
      tone: offers === 0 ? "neutral" : "warn",
    },
    {
      label: "Jobs you hold",
      count: active,
      note: active === 0 ? "Nothing is assigned to you." : "Accepted and not yet submitted.",
      href: "/portal/jobs",
      tone: "neutral",
    },
    {
      label: "Due in 48 hours",
      count: dueSoon,
      note: "Evidence deadlines inside two days.",
      href: "/portal/jobs",
      tone: dueSoon === 0 ? "neutral" : "warn",
    },
    {
      label: "Past due",
      count: overdue,
      note: overdue === 0 ? "Nothing of yours is late." : "The deadline has gone and nothing is submitted.",
      href: "/portal/jobs",
      tone: overdue === 0 ? "good" : "bad",
    },
    {
      label: "Tasks overdue",
      count: tasks.overdue,
      note: `${tasks.open} open in total, including credential expiry.`,
      href: "/portal/tasks",
      tone: tasks.overdue === 0 ? "good" : "bad",
    },
    {
      label: "Unread notifications",
      count: unread,
      note: "In the bell.",
      href: "/portal/notifications",
      tone: "neutral",
    },
  ];

  const money: MoneyTile[] = [
    {
      label: "Owed to you",
      value: sumCents(outstanding),
      note:
        outstanding === null
          ? "Your ledger could not be read, so this is not a zero. Tell an administrator."
          : outstanding.length
            ? `${outstanding.length} entr${outstanding.length === 1 ? "y" : "ies"} not yet marked paid.`
            : "Nothing outstanding. An entry appears when a job you completed is approved.",
    },
    {
      label: "Paid to date",
      value: sumCents(paid),
      note:
        paid === null
          ? "Your ledger could not be read."
          : paid.length
            ? "Everything marked paid on your ledger."
            : "Nothing has been marked paid yet.",
    },
  ];

  const attention: Attention[] = [];
  if (offers > 0) {
    attention.push({
      label: `${offers} offer${offers === 1 ? "" : "s"} waiting`,
      detail: "An offer that expires goes to somebody else.",
      href: "/portal/offers",
    });
  }
  if (overdue > 0) {
    attention.push({
      label: `${overdue} job${overdue === 1 ? "" : "s"} past due`,
      detail: "Submit what you have, or say what is blocking it on the file thread.",
      href: "/portal/jobs",
    });
  }

  return { role: "field_tech", tiles, money, attention };
}

/** The dashboard for whoever is asking. Role decides it, never a query parameter. */
export async function dashboardFor(actor: Actor | null): Promise<Dashboard | null> {
  if (!actor || actor.status !== "active") return null;
  if (actor.role === "admin") return adminDashboard(actor);
  if (actor.role === "engineer") return engineerDashboard(actor);
  return techDashboard(actor);
}

/** Whether this actor may open the billing screen. */
export function canSeeBilling(actor: Actor | null): boolean {
  return can(actor, "billing.read");
}

export type { FileMargin };
