import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, REVIEW_QUEUE_STATUSES, type Actor } from "./ops-authz";
import { taskCounts } from "./ops-tasks";
import { unreadCount } from "./ops-notify";
import { fileMargins, marginByPeriod, type FileMargin } from "./ops-docs";
import { expiryState } from "./ops-credentials";
import { periodOf } from "./ops-review";
import { ordersNeedingAttention } from "./ops-reconcile";
import { marginOf, type Cents, type PeriodTotals } from "./ops-money";

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

/**
 * A count that may not be known.
 *
 * Same distinction Cents draws for money: zero is an answer, null is the
 * absence of one. Named separately so a signature says which it is.
 */
export type Count = number | null;

export type Tile = {
  label: string;
  /** A real count. Zero means zero, null means the query could not be run. */
  count: Count;
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

/**
 * A grouped answer, where one number is not the answer.
 *
 * "Unassigned jobs" is a tile. "Unassigned jobs BY COUNTY AND AGE" is not: a
 * dispatcher cannot act on the total, because what they do next depends on
 * which county the oldest one is in. The three dashboards this type was added
 * for were all ruled in that shape, and squeezing them into tiles would have
 * produced the number a person cannot use.
 *
 * `rows` null is a failed read, an empty array is a query that ran and found
 * nothing. Same distinction Count and Cents draw, one level up.
 */
export type BreakdownRow = { label: string; detail: string; count: Count };

export type Breakdown = {
  title: string;
  /** What the grouping means, and what an empty one means. */
  note: string;
  href: string;
  rows: BreakdownRow[] | null;
};

/**
 * THE THREE DASHBOARDS THAT CARRY NO FIRM MONEY, AND CANNOT.
 *
 * Operator ruling, 2026-09-08: none of these roles holds ledger.read_all or
 * billing.read, and no dashboard for them carries a firm level money figure.
 *
 * That is enforced by the TYPE rather than by remembering. These three have no
 * `money` field at all, so a MoneyTile cannot be put on one: it is not a
 * discipline somebody has to keep, it is a thing that does not compile. Same
 * idiom as LicensedAction, and a compile proof asserts it.
 *
 * `notComputable` is the other half of the ruling. Where a dashboard would need
 * a figure the grants or the SCHEMA do not carry, it is REPORTED rather than
 * fixed by widening a grant or inventing a proxy that looks like the figure
 * that was asked for. Two of the customer service figures live here.
 */
export type DispatcherDashboard = {
  role: "dispatcher";
  tiles: Tile[];
  breakdowns: Breakdown[];
  attention: Attention[];
  notComputable: string[];
};

export type SalesDashboard = {
  role: "sales";
  tiles: Tile[];
  breakdowns: Breakdown[];
  attention: Attention[];
  notComputable: string[];
};

export type CustomerServiceDashboard = {
  role: "customer_service";
  tiles: Tile[];
  breakdowns: Breakdown[];
  attention: Attention[];
  notComputable: string[];
};

export type Dashboard =
  | AdminDashboard
  | EngineerDashboard
  | TechDashboard
  | DispatcherDashboard
  | SalesDashboard
  | CustomerServiceDashboard;

/** The three that carry no firm money, named so a check can derive rather than list. */
export const MONEYLESS_ROLES = ["dispatcher", "sales", "customer_service"] as const;

/**
 * WHICH DASHBOARDS EXCLUDE DEMONSTRATIONS, AND WHY IT IS NOT ALL OF THEM.
 *
 * Decision taken 2026-09-09 and flagged, because it is a line rather than a
 * rule and somebody should disagree with it if they want to.
 *
 * A FIRM LEVEL figure is a claim the firm makes about itself, and a
 * demonstration in one is the plausible-slightly-wrong number Section 2 exists
 * to stop. The administrator's, the dispatcher's, the salesperson's and the
 * customer service dashboards are all of that kind, and every one of their
 * reads is scoped. demo-audit's file injection caught the administrator's "Not
 * yet dispatched" tile counting a seeded file, which is exactly how this was
 * found rather than reasoned about.
 *
 * A PERSONAL figure is not a claim about the firm. "Jobs you hold", "Offers
 * waiting on you", "Owed to you" and the engineer's review queue are one
 * person's own work, every query already scoped to `actor.id`, and a
 * demonstration reaches them only when the demonstration is being run AS that
 * person. That is the case where the records SHOULD be visible: seed-field-demo
 * exists to put work in front of somebody being walked through the platform,
 * and a walkthrough where the jobs do not appear is not a walkthrough.
 *
 * So the engineer's and the field technician's dashboards are deliberately not
 * scoped. The cost is real and worth stating: if a demonstration is ever run
 * through a REAL person's account, their own pay figures will include it until
 * the records are removed. The alternative cost is a demonstration that cannot
 * show anybody their own screen, which is worse and is the thing those records
 * are for.
 */
export const FIRM_LEVEL_DASHBOARDS = ["admin", "dispatcher", "sales", "customer_service"] as const;

const HOURS_48 = 48 * 60 * 60 * 1000;
const TECH_OPEN_STATUSES = ["dispatched", "evidence_in_progress", "revisions_requested"];

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

/**
 * Count rows, and say so when the count is not known.
 *
 * A FAILED READ IS NOT AN EMPTY QUEUE, AND THIS RETURNED ZERO FOR BOTH.
 *
 * Found in the Phase 12 Section 2 figure inventory. It destructured `count`
 * and ignored `error`, so roughly twenty tiles across three dashboards showed
 * a confident zero during an outage, several of them with a green note saying
 * nothing was waiting. The engineer would have been told the review queue was
 * empty by a screen that had failed to ask.
 *
 * sumCents, ten lines below, already got this right and explains the same
 * distinction for money. Counts had no such treatment; they do now.
 */
async function countRows(build: (db: Db) => unknown): Promise<Count> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { count, error } = (await build(db)) as { count: number | null; error: unknown };
  if (error) {
    console.error("[dashboard] a count could not be read:", error);
    return null;
  }
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
        d.from("eng_files").select("id", { count: "exact", head: true }).in("status", REVIEW_QUEUE_STATUSES).eq("is_demo", false),
      ),
      countRows((d) =>
        d
          .from("eng_files")
          .select("id", { count: "exact", head: true })
          .lt("evidence_due_at", now)
          .in("status", TECH_OPEN_STATUSES)
          .eq("is_demo", false),
      ),
      countRows((d) =>
        d
          .from("eng_files")
          .select("id", { count: "exact", head: true })
          .gte("evidence_due_at", now)
          .lt("evidence_due_at", soon)
          .in("status", TECH_OPEN_STATUSES)
          .eq("is_demo", false),
      ),
      countRows((d) =>
        d.from("eng_assignments").select("id", { count: "exact", head: true }).eq("state", "offered"),
      ),
      countRows((d) =>
        d
          .from("eng_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "field_tech")
          .eq("status", "active")
          .eq("is_demo", false),
      ),
      countRows((d) => d.from("eng_files").select("id", { count: "exact", head: true }).in("status", ["intake", "needs_dispatch"]).eq("is_demo", false)),
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
      note:
        inQueue === null
          ? "This could not be read, so it is not a count of zero."
          : inQueue === 0
            ? "Nothing is sitting in the review queue."
            : "Evidence is in and no decision is recorded.",
      href: "/portal/review",
      tone: inQueue === null ? "neutral" : inQueue === 0 ? "good" : inQueue > 5 ? "warn" : "neutral",
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

  if (overdueEvidence !== null && overdueEvidence > 0) {
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
  /*
   * Derived from marginOf rather than restated, so a fourth cost could not be
   * added to the margin and quietly leave this count describing three of it.
   * That is exactly what happened here: this line named the three it knew.
   */
  const incomplete = margins.filter((m) => marginOf(m).missing.length > 0).length;
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
  /*
   * MONEY EXCLUDES DEMONSTRATIONS EVEN THOUGH THE WORK LIST DOES NOT.
   *
   * Operator ruling, 2026-09-09, overruling the line this file drew a few hours
   * earlier. A work list may show demonstration work, because that is what the
   * seed is for and a walkthrough where the jobs do not appear is not a
   * walkthrough. **Money never does.** A technician or an engineer shown a
   * figure they will not be paid is the defect class with a person attached,
   * and the cost this file previously described as acceptable is not.
   *
   * The scope is through the FILE rather than through the engineer, which is
   * the distinction that makes the split possible: the entry is a demonstration
   * when the work it is about is, not when the person is. A real engineer
   * walking somebody through a seeded file must not see its money in their own
   * pay.
   *
   * An entry with NO file is counted, and that is deliberate rather than an
   * oversight. file_id is nullable, an inner join would silently drop those
   * rows and quietly reduce somebody's pay, and a row not attached to a
   * demonstration is not a demonstration. Only an entry whose file is EXPLICITLY
   * marked is removed.
   */
  const { data: ledgerRaw } = await db
    .from("eng_production_ledger")
    .select("amount_cents, status, eng_files(is_demo)")
    .eq("engineer_id", actor.id)
    .eq("period", period);

  const ledger =
    ledgerRaw === null
      ? null
      : ledgerRaw.filter((r) => (r.eng_files as { is_demo?: boolean } | null)?.is_demo !== true);

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
      note:
        queue === null
          ? "This could not be read, so it is not an empty queue."
          : queue === 0
            ? "The queue is empty."
            : "Evidence submitted and nobody has opened it.",
      href: "/portal/review",
      tone: queue === null ? "neutral" : queue === 0 ? "good" : queue > 5 ? "warn" : "neutral",
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
  if (queue !== null && queue > 0) {
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

  /*
   * Scoped through the FILE, for the reason written out on the engineer's
   * ledger above. The jobs list may show a demonstration; "Owed to you" may
   * not. A technician shown money they will not be paid is the defect class
   * with a person attached.
   *
   * An entry with no file is kept, because file_id is nullable and an inner
   * join would quietly reduce somebody's pay.
   */
  const { data: pay } = await db
    .from("eng_tech_pay_ledger")
    .select("amount_cents, status, eng_files(is_demo)")
    .eq("tech_id", actor.id);
  const rows =
    pay === null
      ? null
      : (pay as { amount_cents?: unknown; status?: unknown; eng_files?: { is_demo?: boolean } | null }[]).filter(
          (r) => r.eng_files?.is_demo !== true,
        );
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
  if (offers !== null && offers > 0) {
    attention.push({
      label: `${offers} offer${offers === 1 ? "" : "s"} waiting`,
      detail: "An offer that expires goes to somebody else.",
      href: "/portal/offers",
    });
  }
  if (overdue !== null && overdue > 0) {
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

  /*
   * ROUTED BY CAPABILITY, NOT BY ROLE NAME, AND THE FALL THROUGH IS GONE.
   *
   * This was: admin, then engineer, then EVERYTHING ELSE gets techDashboard.
   * Written when three roles existed. Since 0018 seven do, so a dispatcher, a
   * salesperson, a customer service account and a read only account were all
   * served the field technician's dashboard, labelled `role: "field_tech"`.
   *
   * Not a data leak, and that is worth being precise about rather than
   * dramatic: every query in techDashboard is scoped to actor.id, so what those
   * four saw was an EMPTY technician dashboard. Offers they have none of,
   * deadlines they have none of, and pay they are not owed. A wrong screen
   * rather than somebody else's data.
   *
   * It was unreachable until 2026-09-07 because those four roles could not hold
   * a session. Repairing that made this reachable, which is the same sequence
   * that unmasked homeFor.
   *
   * The two specialised dashboards are gated on the capability that defines
   * them rather than on the name of a role, so a role an owner creates with
   * review grants gets the engineer's dashboard without anybody editing this.
   */
  /*
   * THE ORDER CHANGED IN PHASE 12 SECTION 2, AND THE REASON IS A DEFECT THIS
   * BLOCK SHIPPED WHILE ITS OWN COMMENT DENIED IT.
   *
   * The comment that used to sit at the bottom said a dispatcher, a salesperson
   * and a customer service account all get null, and that there is no dashboard
   * for them. It was wrong about the dispatcher from the day it was written. A
   * dispatcher holds offers.list_own, so the technician branch caught them and
   * handed them the FIELD TECHNICIAN's dashboard: "Offers waiting on you",
   * "Jobs you hold", "Owed to you", every query scoped to actor.id, so every
   * tile read none and every money figure read zero.
   *
   * That is precisely the thing BACKLOG.md says must never happen, "a fourth
   * generic dashboard that renders empty tiles", except worse, because it was a
   * REAL dashboard belonging to somebody else rather than an empty one, and the
   * comment underneath asserted it could not occur. Proved by execution rather
   * than by reading: building an actor from each entry in DEFAULT_ROLES and
   * running this ladder returned field_tech for dispatcher.
   *
   * So the three specific roles are matched FIRST, on the capability that
   * defines each one, before the broader branches can catch them. read_only
   * still lands on the administrator's dashboard and that is correct rather
   * than accidental: the role is granted ledger.read_all and billing.read on
   * purpose, because somebody evaluating the business has to see the money.
   */
  /*
   * THE ORDER IS LOAD BEARING, AND THE ADMINISTRATOR HAS TO BE FIRST.
   *
   * An administrator holds every capability below, so any branch placed above
   * theirs catches them. The first attempt at this fix put the dispatcher
   * branch at the top and would have handed an administrator the dispatcher's
   * screen, which is the same defect being repaired, pointing the other way.
   *
   * Once the administrator is consumed, each remaining capability belongs to
   * exactly one role, verified against DEFAULT_ROLES rather than assumed:
   * offers.dispatch is admin and dispatcher, suppressions.manage is admin and
   * customer service, clients.create with files.create is admin and sales,
   * evidence.review is admin and the engineer, offers.list_own is admin, the
   * technician AND the dispatcher.
   *
   * That last one is the whole defect. offers.list_own was the technician's
   * branch and the dispatcher holds it, so before this the ladder handed a
   * dispatcher the FIELD TECHNICIAN's dashboard: every query scoped to
   * actor.id, so every tile read none and every money figure read zero, while
   * the comment underneath asserted a dispatcher gets null and has no dashboard
   * at all. Proved by execution rather than by reading, building an actor from
   * each entry in DEFAULT_ROLES and running the ladder.
   *
   * dashboards-audit does that same walk on every board run, so a role added on
   * the permission screen that lands on somebody else's dashboard is a red
   * board rather than something a person notices in a screenshot.
   *
   * read_only lands on the administrator's dashboard and that is correct rather
   * than accidental. The role is granted ledger.read_all and billing.read on
   * purpose: it is for a buyer's accountant or an auditor, and somebody
   * evaluating the business has to see the money.
   */
  if (can(actor, "ledger.read_all") && can(actor, "billing.read")) return adminDashboard(actor);
  if (can(actor, "offers.dispatch")) return dispatcherDashboard();
  if (can(actor, "suppressions.manage")) return customerServiceDashboard();
  if (can(actor, "clients.create") && can(actor, "files.create")) return salesDashboard();
  if (can(actor, "evidence.review")) return engineerDashboard(actor);
  if (can(actor, "offers.list_own")) return techDashboard(actor);

  /*
   * AND NOTHING FOR ANYBODY ELSE, WHICH IS HONEST RATHER THAN COMPLETE.
   *
   * A role an owner invents on the permission screen may hold a combination
   * none of the six branches above answers for. That gets null and a screen
   * saying so, rather than the nearest dashboard that happens to render.
   */
  return null;
}

/** Whether this actor may open the billing screen. */
export function canSeeBilling(actor: Actor | null): boolean {
  return can(actor, "billing.read");
}

export type { FileMargin };

// ------------------------------------------------------------- dispatcher

/**
 * Group already fetched rows into a breakdown, largest first.
 *
 * Takes the rows rather than issuing a query per group, because a breakdown by
 * county on a state with 254 of them would otherwise be 254 round trips to
 * produce one panel.
 */
function groupBy<T>(
  rows: T[] | null,
  key: (row: T) => string,
  detail: (rows: T[]) => string,
): BreakdownRow[] | null {
  if (rows === null) return null;
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    buckets.set(k, [...(buckets.get(k) ?? []), row]);
  }
  return [...buckets.entries()]
    .map(([label, group]) => ({ label, detail: detail(group), count: group.length }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

const daysSince = (iso: string | null): number =>
  iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : 0;

function oldestIn<T>(rows: T[], at: (row: T) => string | null): number {
  return rows.reduce((n, r) => Math.max(n, daysSince(at(r))), 0);
}

/**
 * WHERE WORK IS WAITING, AND WHO COULD TAKE IT.
 *
 * Operator ruling, 2026-09-08: "both, and the queue leads." The question was
 * whether a dispatcher is measured on how FAST work is placed or how WELL. The
 * answer is that the screen carries both and puts the ageing queue first,
 * because what a person opens this screen to do is place the thing that has
 * been waiting longest.
 *
 * A DISPATCHER WAS ALREADY GETTING A DASHBOARD, AND IT WAS THE WRONG ONE.
 *
 * Before this, dashboardFor routed on capability and a dispatcher holds
 * offers.list_own, so line three handed them the FIELD TECHNICIAN's dashboard:
 * "Offers waiting on you", "Jobs you hold", every tile scoped to actor.id, so
 * every tile read none. The comment underneath said in as many words that a
 * dispatcher gets null and there is no dashboard for them, and it had been
 * wrong since the day it was written. That is the "fourth generic dashboard
 * that renders empty tiles" BACKLOG says must never happen, already shipped,
 * wearing a capability check instead of a role name.
 *
 * THE CAPTURE WINDOW IS NOT A COLUMN, AND THIS DOES NOT PRETEND IT IS.
 *
 * The ruling asks for "jobs past their capture window". There is no capture
 * window in this schema: eng_files carries evidence_due_at and due_at, and
 * eng_assignments carries expires_at for an OFFER. The nearest true thing is
 * evidence past due, which is what this counts, and it says which column it
 * counted so nobody reads it as a window that was never recorded.
 */
async function dispatcherDashboard(): Promise<DispatcherDashboard> {
  const db = supabaseAdmin();
  const notComputable: string[] = [];
  if (!db) {
    return {
      role: "dispatcher",
      tiles: [],
      breakdowns: [],
      attention: [],
      notComputable: ["The database is not configured, so nothing on this screen could be counted."],
    };
  }

  const now = new Date().toISOString();

  /*
   * needs_dispatch is where a file sits once it is ready to be placed and
   * nobody holds it. intake is earlier than that and is somebody else's
   * problem, which is why it is not counted here.
   */
  const { data: waitingRaw, error: waitingErr } = await db
    .from("eng_files")
    .select("id, file_number, county, urgency, created_at, evidence_due_at")
    .eq("status", "needs_dispatch")
    .is("assigned_tech_id", null)
    .eq("is_demo", false);
  if (waitingErr) console.error("[dashboard] unassigned files could not be read:", waitingErr.message);
  const waiting = waitingErr ? null : (waitingRaw ?? []);

  const { data: techsRaw, error: techsErr } = await db
    .from("eng_profiles")
    .select("id, display_name, certification_status, coverage_counties")
    .eq("role", "field_tech")
    .eq("status", "active")
    .eq("is_demo", false);
  if (techsErr) console.error("[dashboard] technicians could not be read:", techsErr.message);
  const techs = techsErr ? null : (techsRaw ?? []);

  const { data: offersRaw, error: offersErr } = await db
    .from("eng_assignments")
    .select("id, file_id, expires_at, offered_at")
    .eq("state", "offered");
  if (offersErr) console.error("[dashboard] outstanding offers could not be read:", offersErr.message);
  const offers = offersErr ? null : (offersRaw ?? []);

  const pastDue = await countRows((d) =>
    d
      .from("eng_files")
      .select("id", { count: "exact", head: true })
      .lt("evidence_due_at", now)
      .in("status", TECH_OPEN_STATUSES)
      .eq("is_demo", false),
  );

  notComputable.push(
    "Jobs past their capture window are counted as evidence past due, from eng_files.evidence_due_at. This schema has no capture window column, and a figure invented from one that does not exist would be worse than saying so.",
  );

  const expiringSoon =
    offers === null
      ? null
      : offers.filter(
          (o) => o.expires_at && Date.parse(o.expires_at as string) < Date.now() + HOURS_48,
        ).length;

  const certified = techs === null ? null : techs.filter((t) => t.certification_status === "certified").length;

  const tiles: Tile[] = [
    {
      label: "Waiting to be placed",
      count: waiting === null ? null : waiting.length,
      note:
        waiting === null
          ? "The queue could not be read, so this is not a zero."
          : waiting.length === 0
            ? "Nothing is sitting unassigned."
            : `The oldest has waited ${oldestIn(waiting, (f) => f.created_at as string)} day(s).`,
      href: "/portal/files",
      tone: waiting === null || waiting.length === 0 ? "good" : "warn",
    },
    {
      label: "Offers outstanding",
      count: offers === null ? null : offers.length,
      note:
        expiringSoon === null
          ? "Offers could not be read, so this is not a zero."
          : expiringSoon > 0
            ? `${expiringSoon} expire inside 48 hours. An offer that expires goes back on the queue.`
            : "None expiring inside 48 hours.",
      href: "/portal/files",
      tone: expiringSoon === null || expiringSoon === 0 ? "neutral" : "warn",
    },
    {
      label: "Evidence past due",
      count: pastDue,
      note: "Accepted work whose evidence deadline has gone. Counted from evidence_due_at, because there is no capture window column.",
      href: "/portal/files",
      tone: pastDue === 0 ? "good" : "bad",
    },
    {
      label: "Technicians available",
      count: techs === null ? null : techs.length,
      note:
        certified === null
          ? "The roster could not be read, so this is not a zero."
          : `${certified} of them certified. Only a certified technician can be offered certified work.`,
      href: "/portal/techs",
      tone: "neutral",
    },
  ];

  const breakdowns: Breakdown[] = [
    {
      title: "Waiting to be placed, by county and age",
      note: "The queue leads, because what a dispatcher opens this screen to do is place the thing that has waited longest. Empty means nothing is unassigned, which is a real zero.",
      href: "/portal/files",
      rows: groupBy(
        waiting,
        (f) => (f.county as string) ?? "no county recorded",
        (group) => {
          const oldest = oldestIn(group, (f) => f.created_at as string);
          const urgent = group.filter((f) => f.urgency !== "standard").length;
          return `oldest ${oldest} day(s)${urgent ? `, ${urgent} above standard urgency` : ""}`;
        },
      ),
    },
    {
      title: "Technicians by certification, and what they cover",
      note: "Active field technicians. A technician with no counties set cannot be offered anything, so that count is shown beside the certification rather than instead of it.",
      href: "/portal/techs",
      rows: groupBy(
        techs,
        (t) => (t.certification_status as string) ?? "not recorded",
        (group) => {
          const noCoverage = group.filter((t) => ((t.coverage_counties as string[]) ?? []).length === 0).length;
          const counties = new Set(group.flatMap((t) => (t.coverage_counties as string[]) ?? []));
          return `${counties.size} counties covered between them${noCoverage ? `, ${noCoverage} with no coverage set` : ""}`;
        },
      ),
    },
  ];

  const attention: Attention[] = [];
  if (waiting !== null && waiting.length > 0) {
    const oldest = oldestIn(waiting, (f) => f.created_at as string);
    if (oldest >= 2) {
      attention.push({
        label: `Something has waited ${oldest} days to be placed`,
        detail: "The queue above is ordered by county with the oldest age on each. Place the oldest first.",
        href: "/portal/files",
      });
    }
  }
  if (pastDue !== null && pastDue > 0) {
    attention.push({
      label: `${pastDue} job(s) past their evidence deadline`,
      detail: "Accepted and not submitted. Ask on the file thread before reassigning.",
      href: "/portal/files",
    });
  }

  return { role: "dispatcher", tiles, breakdowns, attention, notComputable };
}

// ------------------------------------------------------------------ sales

/**
 * WHERE THE WORK IS COMING FROM, AND HOW LONG IT HAS BEEN SITTING.
 *
 * Operator ruling, 2026-09-08: "their own pipeline, and no money the firm
 * makes." Every figure is about FLOW and AGE, never about margin or value, so
 * the screen is complete without `pricing.read`, which this role is
 * deliberately denied. A salesperson who can see the spread between what the
 * client pays and what the technician is paid is negotiating against the firm's
 * own costs.
 *
 * That is why a quote's age is here and a quote's VALUE is not, even though
 * `quoted_cents` sits on the same row and would have been one more property to
 * read. The type makes it impossible rather than leaving it to discipline: a
 * SalesDashboard has no money field.
 *
 * WHAT A LEAD'S SOURCE ACTUALLY IS IN THIS SCHEMA
 * -----------------------------------------------
 * There is no `source` column on eng_leads. The ruling asks for leads by
 * source, and the honest answer is assembled from what is really recorded: the
 * partner code when a partner sent them, then utm_source when the visit was
 * tagged, then the form they filled in. That order is deliberate, most specific
 * first, and it is stated on the panel so nobody reads "waitlist" as a channel
 * somebody bought.
 */
async function salesDashboard(): Promise<SalesDashboard> {
  const db = supabaseAdmin();
  const notComputable: string[] = [];
  if (!db) {
    return {
      role: "sales",
      tiles: [],
      breakdowns: [],
      attention: [],
      notComputable: ["The database is not configured, so nothing on this screen could be counted."],
    };
  }

  const period = periodOf(new Date());

  const { data: leadsRaw, error: leadsErr } = await db
    .from("eng_leads")
    .select("id, form, status, utm_source, partner_code, created_at");
  if (leadsErr) console.error("[dashboard] leads could not be read:", leadsErr.message);
  const leads = leadsErr ? null : (leadsRaw ?? []);

  /*
   * A QUOTE IS NOT AN ORDER IN THIS SCHEMA, WHICH CHANGES WHAT "UNPAID" MEANS.
   *
   * order_type allows 'quote', and ops-intake refuses to create an order for a
   * quote deliverable, so quotes live in eng_quote_requests and never reach the
   * orders table until one is accepted and converted. There is therefore no
   * unpaid quote: there is a quote that has been SENT and not yet answered,
   * which is the thing a salesperson chases, and that is what this counts.
   */
  const { data: quotesRaw, error: quotesErr } = await db
    .from("eng_quote_requests")
    .select("id, reference, status, created_at, sent_at, expires_at");
  if (quotesErr) console.error("[dashboard] quote requests could not be read:", quotesErr.message);
  const quotes = quotesErr ? null : (quotesRaw ?? []);

  notComputable.push(
    "Quotes are counted from eng_quote_requests, not from orders. A quote never becomes an order until it is accepted, so there is no such thing as an unpaid quote here: what is shown is quotes sent and not yet answered, with their age.",
  );

  const { from, to } = (() => {
    const [y, m] = period.split("-").map(Number);
    return {
      from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
      to: new Date(Date.UTC(y, m, 1)).toISOString(),
    };
  })();

  const { data: attributedRaw, error: attrErr } = await db
    .from("eng_service_orders")
    .select("id, reference, partner_code, attribution_reason, placed_at")
    .not("partner_id", "is", null)
    .gte("placed_at", from)
    .lt("placed_at", to)
    .eq("is_demo", false);
  if (attrErr) console.error("[dashboard] partner attribution could not be read:", attrErr.message);
  const attributed = attrErr ? null : (attributedRaw ?? []);

  const { data: accountsRaw, error: accErr } = await db
    .from("eng_customer_accounts")
    /*
     * SCOPED THROUGH THE CLIENT, FOR THE REASON A PAYMENT IS SCOPED THROUGH ITS
     * ORDER.
     *
     * eng_customer_accounts carries no is_demo and should not: an account is a
     * demonstration exactly when the organisation it belongs to is, and a
     * second column would be a second answer that can disagree with the first.
     *
     * Found by looking at the screenshot rather than at the code. The tile read
     * "Accounts on the books: 1" on a development database whose only account
     * belongs to a seeded client, which is the plausible-and-slightly-wrong
     * number the whole of Section 2 exists to prevent, on a screen nobody had
     * thought to apply the rule to because it is a dashboard rather than a
     * report.
     *
     * The other sets on this screen are NOT scoped, and that is not an
     * oversight: eng_leads and eng_quote_requests have no is_demo column,
     * deliberately, because nothing seeds either of them. A filter on a column
     * that does not exist is an error, and a column that is always false is a
     * question nobody can answer.
     */
    .select("id, status, created_at, eng_clients!inner(name, is_demo), eng_service_orders(placed_at)")
    .eq("eng_clients.is_demo", false);
  if (accErr) console.error("[dashboard] accounts could not be read:", accErr.message);
  const accounts = accErr ? null : (accountsRaw ?? []);

  const open = quotes === null ? null : quotes.filter((q) => q.status === "sent" || q.status === "scoping");
  const newLeads = leads === null ? null : leads.filter((l) => l.status !== "converted");

  const tiles: Tile[] = [
    {
      label: "Leads not yet converted",
      count: newLeads === null ? null : newLeads.length,
      note:
        newLeads === null
          ? "Leads could not be read, so this is not a zero."
          : newLeads.length === 0
            ? "Every lead on the list has become a client."
            : `The oldest has waited ${oldestIn(newLeads, (l) => l.created_at as string)} day(s).`,
      href: "/portal/clients",
      tone: "neutral",
    },
    {
      label: "Quotes waiting on an answer",
      count: open === null ? null : open.length,
      note:
        open === null
          ? "Quote requests could not be read, so this is not a zero."
          : open.length === 0
            ? "Nothing is out with a customer."
            : `The oldest was sent ${oldestIn(open, (q) => (q.sent_at as string) ?? (q.created_at as string))} day(s) ago.`,
      href: "/portal/intake",
      tone: open === null || open.length === 0 ? "neutral" : "warn",
    },
    {
      label: `Attributed to a partner in ${period}`,
      count: attributed === null ? null : attributed.length,
      note:
        attributed === null
          ? "Attribution could not be read, so this is not a zero."
          : "Orders placed this period that a partner is credited for. Credit, not commission: what a partner is paid is not on this screen.",
      href: "/portal/partners",
      tone: "neutral",
    },
    {
      label: "Accounts on the books",
      count: accounts === null ? null : accounts.length,
      note:
        accounts === null
          ? "Accounts could not be read, so this is not a zero."
          : `${(accounts ?? []).filter((a) => a.status === "active").length} of them active.`,
      href: "/portal/accounts",
      tone: "neutral",
    },
  ];

  /*
   * Most specific first: a partner code is a named source, a utm_source is a
   * tagged visit, and the form is the fallback that is always present.
   */
  const sourceOf = (l: { partner_code?: unknown; utm_source?: unknown; form?: unknown }): string =>
    (l.partner_code as string) ||
    (l.utm_source as string) ||
    `form: ${(l.form as string) ?? "not recorded"}`;

  const lastOrderOf = (a: { eng_service_orders?: unknown; created_at?: unknown }): string | null => {
    const orders = (a.eng_service_orders as { placed_at: string | null }[] | null) ?? [];
    const dates = orders.map((o) => o.placed_at).filter((d): d is string => Boolean(d));
    return dates.length ? dates.sort().at(-1)! : null;
  };

  const breakdowns: Breakdown[] = [
    {
      title: "Leads by source",
      note: "There is no source column on a lead. This is the partner code where one exists, then the tagged utm_source, then the form they filled in, most specific first. A row reading 'form: waitlist' is somebody who arrived and filled something in, not a channel anybody bought.",
      href: "/portal/clients",
      rows: groupBy(
        leads,
        sourceOf,
        (group) => {
          const openOnes = group.filter((l) => l.status !== "converted").length;
          return `${openOnes} not yet converted, oldest ${oldestIn(group, (l) => l.created_at as string)} day(s)`;
        },
      ),
    },
    {
      title: "Leads by stage",
      note: "The stage is eng_leads.status, which carries no check constraint: the platform only ever writes 'new' and 'converted', and anything else here was written by something outside it. Empty means there are no leads at all.",
      href: "/portal/clients",
      rows: groupBy(
        leads,
        (l) => (l.status as string) || "not recorded",
        (group) => `oldest ${oldestIn(group, (l) => l.created_at as string)} day(s)`,
      ),
    },
    {
      title: "Quotes by status, with age",
      note: "Every quote request, whatever became of it. A quote that was declined or expired is kept on this panel on purpose: a salesperson looking at how many went out and how many came back needs both halves.",
      href: "/portal/intake",
      rows: groupBy(
        quotes,
        (q) => (q.status as string) ?? "not recorded",
        (group) => `oldest ${oldestIn(group, (q) => (q.sent_at as string) ?? (q.created_at as string))} day(s)`,
      ),
    },
    {
      title: "Accounts by how long since they last ordered",
      note: "Taken from the newest placed_at across the account's own orders. An account that has never placed one is its own bucket rather than being counted as ordering today, which is the arithmetic a nulls-last sort quietly produces.",
      href: "/portal/accounts",
      rows: groupBy(
        accounts,
        (a) => {
          const last = lastOrderOf(a);
          if (!last) return "never ordered";
          const days = daysSince(last);
          if (days <= 30) return "inside 30 days";
          if (days <= 90) return "31 to 90 days";
          if (days <= 365) return "91 to 365 days";
          return "over a year";
        },
        (group) => `${group.filter((a) => a.status === "active").length} active`,
      ),
    },
  ];

  const attention: Attention[] = [];
  if (open !== null && open.length > 0) {
    const oldest = oldestIn(open, (q) => (q.sent_at as string) ?? (q.created_at as string));
    if (oldest >= 7) {
      attention.push({
        label: `A quote has been out for ${oldest} days`,
        detail: "Nothing has come back. A quote nobody chases is a quote that expires.",
        href: "/portal/intake",
      });
    }
  }

  return { role: "sales", tiles, breakdowns, attention, notComputable };
}

// ------------------------------------------------------- customer service

/**
 * WHAT IS IN FLIGHT, AND WHO IS WAITING.
 *
 * Operator ruling, 2026-09-08: "work in progress, not the lead inbox. The
 * grants suggested work in progress and the name suggested the inbox; the
 * grants win, because they are what the role can actually act on."
 *
 * TWO OF THE FOUR FIGURES THIS WAS RULED TO CARRY DO NOT EXIST AS FACTS.
 *
 * They are not omitted and they are not faked. Both are in `notComputable`,
 * which is the ruling's own instruction applied one level out: where a
 * dashboard would need a figure the grants do not cover, it is reported rather
 * than fixed by widening a grant. The same holds when it is the SCHEMA that
 * does not carry it, and inventing a proxy that LOOKS like the figure that was
 * asked for is worse than either, because nobody can tell afterwards.
 *
 *   "Orders awaiting something from the customer, with what is awaited."
 *   The only awaiting status in this entire schema is awaiting_payment. There
 *   is no column naming what is awaited, and outstanding intake answers are
 *   absent ROWS computed in code by missingFor rather than anything a query can
 *   count. So what is shown is orders waiting on payment and files where a
 *   payment link was sent, which is the one kind of waiting the platform
 *   records, and it says so.
 *
 *   "Open message threads by age of last inbound."
 *   eng_messages has author_id and nothing marking a direction, and there is no
 *   customer facing conversation table at all: every thread is staff to staff.
 *   So there is no such thing as a last INBOUND message. What is shown is
 *   threads that have gone quiet, from eng_threads.last_message_at, which is a
 *   different and honest thing.
 */
async function customerServiceDashboard(): Promise<CustomerServiceDashboard> {
  const db = supabaseAdmin();
  const notComputable: string[] = [];
  if (!db) {
    return {
      role: "customer_service",
      tiles: [],
      breakdowns: [],
      attention: [],
      notComputable: ["The database is not configured, so nothing on this screen could be counted."],
    };
  }

  notComputable.push(
    "Orders awaiting something from the customer are shown as orders awaiting PAYMENT, plus files where a payment link was sent. That is the only kind of waiting this schema records: there is no awaiting_customer status and no column naming what is awaited, and outstanding intake answers are missing rows rather than anything a query can count.",
  );
  notComputable.push(
    "Message threads are shown by how long they have been quiet, not by the age of the last inbound message. eng_messages records an author and no direction, and there is no customer facing conversation table, so every thread here is staff to staff and nothing in it is inbound from a customer.",
  );

  const { data: waitingRaw, error: waitingErr } = await db
    .from("eng_service_orders")
    .select("id, reference, customer_name, placed_at, created_at")
    .eq("status", "awaiting_payment")
    .eq("is_demo", false);
  if (waitingErr) console.error("[dashboard] orders awaiting payment could not be read:", waitingErr.message);
  const waitingOrders = waitingErr ? null : (waitingRaw ?? []);

  const linkSent = await countRows((d) =>
    d
      .from("eng_files")
      .select("id", { count: "exact", head: true })
      .eq("payment_intent", "link_sent")
      .eq("is_demo", false),
  );

  const { data: threadsRaw, error: threadsErr } = await db
    .from("eng_threads")
    .select("id, kind, name, last_message_at, created_at");
  if (threadsErr) console.error("[dashboard] threads could not be read:", threadsErr.message);
  const threads = threadsErr ? null : (threadsRaw ?? []);

  /*
   * Refunds in flight, by case. COUNTED and not summed, which keeps the
   * operator's no firm money rule: how many refunds are moving and under which
   * case is work in progress, and what they add up to is the firm's money.
   *
   * refund_case is free text with no constraint anywhere, and it is written in
   * two shapes: slugs like issued_outside_the_platform from reconciliation, and
   * human sentences like "Declined after a site visit" from a review decision.
   * Both appear as their own row rather than being normalised into a guess.
   */
  const { data: refundsRaw, error: refundsErr } = await db
    .from("eng_order_payments")
    .select("id, refund_case, status, created_at")
    .eq("kind", "refund")
    .in("status", ["pending", "failed"]);
  if (refundsErr) console.error("[dashboard] refunds in flight could not be read:", refundsErr.message);
  const refunds = refundsErr ? null : (refundsRaw ?? []);

  const { data: supRaw, error: supErr } = await db
    .from("eng_marketing_suppressions")
    .select("email, because, created_at, token_hash");
  if (supErr) console.error("[dashboard] the suppression list could not be read:", supErr.message);
  const suppressions = supErr ? null : (supRaw ?? []);
  const byOperator = suppressions === null ? null : suppressions.filter((s) => s.token_hash === null);

  const quiet =
    threads === null
      ? null
      : threads.filter((t) => daysSince((t.last_message_at as string) ?? (t.created_at as string)) >= 3);

  const tiles: Tile[] = [
    {
      label: "Orders waiting on payment",
      count: waitingOrders === null ? null : waitingOrders.length,
      note:
        waitingOrders === null
          ? "Orders could not be read, so this is not a zero."
          : waitingOrders.length === 0
            ? "Nothing is sitting unpaid."
            : `The oldest has waited ${oldestIn(waitingOrders, (o) => (o.placed_at as string) ?? (o.created_at as string))} day(s). Payment is the only kind of waiting this platform records.`,
      href: "/portal/orders",
      tone: waitingOrders === null || waitingOrders.length === 0 ? "good" : "warn",
    },
    {
      label: "Payment links sent",
      count: linkSent,
      note: "Jobs taken by telephone where a link went out and nothing has come back yet.",
      href: "/portal/files",
      tone: linkSent === 0 ? "neutral" : "warn",
    },
    {
      label: "Refunds in flight",
      count: refunds === null ? null : refunds.length,
      note:
        refunds === null
          ? "Refunds could not be read, so this is not a zero."
          : refunds.length === 0
            ? "Nothing is pending or failed."
            : "Pending or failed at the provider. What they add up to is not on this screen.",
      href: "/portal/orders",
      tone: refunds === null || refunds.length === 0 ? "good" : "bad",
    },
    {
      label: "Recorded by somebody here",
      count: byOperator === null ? null : byOperator.length,
      note:
        byOperator === null
          ? "The do not contact list could not be read, so this is not a zero. Do not send marketing on the strength of this tile."
          : "Requests to stop marketing that arrived by telephone or in a reply, and were typed in rather than clicked.",
      href: "/portal/suppressions",
      tone: "neutral",
    },
  ];

  const breakdowns: Breakdown[] = [
    {
      title: "Refunds in flight, by case",
      note: "Counted, not totalled. refund_case has no constraint anywhere and is written in two shapes: slugs from reconciliation and sentences from a review decision. Both appear as themselves rather than being normalised into a guess.",
      href: "/portal/orders",
      rows: groupBy(
        refunds,
        (r) => (r.refund_case as string) ?? "not recorded",
        (group) => {
          const failed = group.filter((r) => r.status === "failed").length;
          return failed ? `${failed} failed at the provider` : "all pending";
        },
      ),
    },
    {
      title: "Threads by how long they have been quiet",
      note: "From eng_threads.last_message_at. These are internal threads: nothing in this platform is a conversation with a customer, so nothing here is somebody waiting on a reply from the firm.",
      href: "/portal/messages",
      rows: groupBy(
        threads,
        (t) => {
          const days = daysSince((t.last_message_at as string) ?? (t.created_at as string));
          if (days === 0) return "today";
          if (days <= 2) return "1 to 2 days";
          if (days <= 7) return "3 to 7 days";
          return "over a week";
        },
        (group) => `${group.filter((t) => t.kind === "file").length} attached to a file`,
      ),
    },
    {
      title: "Do not contact, by how it arrived",
      note: "A row somebody clicked to produce and a row somebody typed are different evidence, and only the typed one can be corrected. Empty means nobody has asked.",
      href: "/portal/suppressions",
      rows: groupBy(
        suppressions,
        (s) => (s.token_hash === null ? "recorded by somebody here" : "they clicked the link"),
        (group) => `most recent ${daysSince((group[0].created_at as string) ?? null)} day(s) ago`,
      ),
    },
  ];

  const attention: Attention[] = [];
  if (refunds !== null && refunds.some((r) => r.status === "failed")) {
    attention.push({
      label: "A refund failed at the provider",
      detail: "The customer has been told they are getting money back and has not got it.",
      href: "/portal/orders",
    });
  }
  if (quiet !== null && quiet.length > 0) {
    attention.push({
      label: `${quiet.length} thread(s) quiet for three days or more`,
      detail: "Internal threads. Nobody outside the firm is waiting on these, but work sitting still usually is.",
      href: "/portal/messages",
    });
  }

  return { role: "customer_service", tiles, breakdowns, attention, notComputable };
}
