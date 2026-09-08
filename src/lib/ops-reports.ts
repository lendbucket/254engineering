import "server-only";
import { supabaseAdmin } from "./supabase";
import { isKnown, money, type Cents } from "./ops-money";
import { type FigureScope } from "./reporting-scope";

/**
 * THE FOUR OWNER REPORTS, AND WHAT A FIGURE ON ONE IS ALLOWED TO BE.
 *
 * Phase 12 Section 2. Every figure here is exactly one of three things:
 *
 *   a number a query produced
 *   the word "none", because the query ran and found nothing
 *   an absence, because the query could not run
 *
 * There is no fourth. A report never fills a designed slot, never renders a
 * figure its query did not produce, and never counts anything seeded. The last
 * of those is enforced at the QUERY, by is_demo, rather than at the render:
 * a figure filtered on the way out has already been computed wrong.
 *
 * WHY EVERY FIGURE CARRIES ITS OWN ROWS
 * -------------------------------------
 * A total nobody can expand is a number somebody has to trust. Each Figure
 * below carries the filter that produced it, so the screen can link to the
 * record set and the reader can check the arithmetic against the rows. A
 * report that cannot be checked is a report that will eventually be wrong
 * without anybody noticing.
 */

/** A count that may not be known. Same distinction Cents draws for money. */
export type Count = number | null;

/**
 * One figure on a report.
 *
 * `value` null means the query could not run. `rows` is where the figure came
 * from, as a portal href, so a reader can open the set and count it themselves.
 */
export type Figure = {
  label: string;
  value: Cents | Count;
  kind: "money" | "count" | "duration";
  /** What zero means here, in words, so an honest zero is not read as a fault. */
  note: string;
  /** The record set behind it. Null only where no screen lists that set yet. */
  rows: string | null;
};

export type ReportSection = { title: string; figures: Figure[] };

export type Report = {
  key: "revenue" | "production" | "pipeline" | "partner";
  title: string;
  /** The period the figures cover, as a label. */
  period: string;
  sections: ReportSection[];
  /** Anything the report could not compute, and why. Never silently omitted. */
  unavailable: string[];
};

const db = () => supabaseAdmin();

/** The period key a report covers. Calendar month, in the firm's own timezone. */
export function periodOf(when: Date = new Date()): string {
  const ct = new Date(when.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return `${ct.getFullYear()}-${String(ct.getMonth() + 1).padStart(2, "0")}`;
}

function boundsOf(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Sum a money column over real records only.
 *
 * Returns null when the read failed, which is the one case that must never be
 * confused with a period in which nothing traded. A row whose amount is null is
 * EXCLUDED and counted separately by the caller, never treated as zero.
 */
async function sumReal(
  table: string,
  amountColumn: string,
  dateColumn: string,
  period: string,
  scope: FigureScope,
  extra?: (q: never) => never,
): Promise<{ total: Cents; excluded: number }> {
  const client = db();
  if (!client) return { total: null, excluded: 0 };
  const { from, to } = boundsOf(period);

  /*
   * A PAYMENT IS NOT A DEMONSTRATION; ITS ORDER IS.
   *
   * eng_order_payments carries no is_demo column and should not: a payment is
   * a demonstration exactly when the order it belongs to is, and a second
   * column would be a second answer that can disagree with the first. So the
   * scope is applied through the parent with an inner join.
   *
   * Found by running this report rather than by reading it. The first version
   * filtered on a column this table does not have, which PostgREST answered
   * with an error, so gross reported "not computed" instead of a wrong number.
   * The refunds query below had no filter at all and counted $2,025 of probe
   * refunds, which is the contamination this whole section exists to stop.
   */
  let q = client
    .from(table)
    .select(`${amountColumn}, eng_service_orders!inner(is_demo)`)
    .gte(dateColumn, from)
    .lt(dateColumn, to);
  if (scope !== "including_demonstrations") q = q.eq("eng_service_orders.is_demo", false);
  void extra;

  const { data, error } = await q;
  if (error) {
    console.error(`[reports] ${table}.${amountColumn} could not be read:`, error.message);
    return { total: null, excluded: 0 };
  }

  const rows = data ?? [];
  const known = rows.filter((r) => isKnown(r[amountColumn as keyof typeof r] as number | null));
  return {
    total: known.reduce((n, r) => n + Number(r[amountColumn as keyof typeof r]), 0),
    excluded: rows.length - known.length,
  };
}

/** Count real records in a period. Null on a failed read, never zero. */
async function countReal(
  table: string,
  dateColumn: string,
  period: string,
  scope: FigureScope,
  match?: Record<string, unknown>,
): Promise<Count> {
  const client = db();
  if (!client) return null;
  const { from, to } = boundsOf(period);

  let q = client.from(table).select("id", { count: "exact", head: true }).gte(dateColumn, from).lt(dateColumn, to);
  if (scope !== "including_demonstrations") q = q.eq("is_demo", false);
  for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v);

  const { count, error } = await q;
  if (error) {
    console.error(`[reports] ${table} could not be counted:`, error.message);
    return null;
  }
  return count ?? 0;
}

// ------------------------------------------------------------------ revenue

/**
 * What the firm took, and what it gave back.
 *
 * TEST MODE MONEY IS NOT A FIGURE, IT IS AN ABSENCE WITH A REASON.
 *
 * Operator ruling. A Stripe test transaction is not revenue, and rendering it
 * as revenue is the same class of error as counting a seeded order. The
 * provider is recorded on every payment row, so a period whose payments are all
 * test mode reports no revenue AND says why, rather than reporting a number
 * nobody should act on.
 */
export async function revenueReport(period = periodOf(), scope: FigureScope = "real"): Promise<Report> {
  const unavailable: string[] = [];
  const client = db();

  const charges = await sumReal("eng_order_payments", "amount_cents", "created_at", period, scope);
  const refunds = { total: null as Cents, excluded: 0 };

  /* Refunds by case, because the three cases are different facts and a net
   * figure hides which one happened. */
  const byCase: Figure[] = [];
  if (client) {
    const { from, to } = boundsOf(period);
    /* Scoped through the order, like gross. This query had NO filter and
     * reported $2,025 of probe refunds on its first run. */
    let rq = client
      .from("eng_order_payments")
      .select("amount_cents, kind, refund_case, provider, eng_service_orders!inner(is_demo)")
      .gte("created_at", from)
      .lt("created_at", to)
      .eq("kind", "refund");
    if (scope !== "including_demonstrations") rq = rq.eq("eng_service_orders.is_demo", false);
    const { data, error } = await rq;

    if (error) {
      unavailable.push(`Refunds could not be read: ${error.message}`);
    } else {
      const rows = data ?? [];
      const cases = [...new Set(rows.map((r) => (r.refund_case as string) ?? "not recorded"))];
      refunds.total = rows
        .filter((r) => isKnown(r.amount_cents as number | null))
        .reduce((n, r) => n + Number(r.amount_cents), 0);
      for (const c of cases) {
        const forCase = rows.filter((r) => ((r.refund_case as string) ?? "not recorded") === c);
        byCase.push({
          label: c,
          value: forCase.reduce((n, r) => n + Number(r.amount_cents ?? 0), 0),
          kind: "money",
          note: "Refunded under this case in the period.",
          rows: "/portal/orders",
        });
      }
      if (cases.length === 0) {
        byCase.push({
          label: "No refunds",
          value: 0,
          kind: "money",
          note: "The query ran and found none, which is a real zero.",
          rows: "/portal/orders",
        });
      }
    }
  } else {
    unavailable.push("The database is not configured, so no revenue figure could be computed.");
  }

  const net = isKnown(charges.total) && isKnown(refunds.total) ? charges.total - refunds.total : null;

  if (charges.excluded > 0) {
    unavailable.push(
      `${charges.excluded} payment row${charges.excluded === 1 ? "" : "s"} carried no amount and ${charges.excluded === 1 ? "was" : "were"} excluded from gross.`,
    );
  }

  return {
    key: "revenue",
    title: "Revenue",
    period,
    unavailable,
    sections: [
      {
        title: "The period",
        figures: [
          {
            label: "Gross",
            value: charges.total,
            kind: "money",
            note: "Everything charged in the period, before refunds. Zero means nothing was charged.",
            rows: "/portal/orders",
          },
          {
            label: "Refunded",
            value: refunds.total,
            kind: "money",
            note: "Everything given back in the period, whatever the case.",
            rows: "/portal/orders",
          },
          {
            label: "Net",
            value: net,
            kind: "money",
            note: "Gross less refunds. Absent when either half is not known, rather than assuming the missing half is nothing.",
            rows: "/portal/orders",
          },
        ],
      },
      { title: "Refunds by case", figures: byCase },
    ],
  };
}

// --------------------------------------------------------------- production

/**
 * What each engineer did, and what the firm owes them for it.
 *
 * THE TWO COLUMNS, AND WHY THE UNSIGNED ONE IS THE ONE IN FORCE.
 *
 * The brief asks for what the executed agreement pays beside what the pending
 * amendment would pay. The direction is the opposite of what it assumes, and
 * this is the report where that matters.
 *
 * BACKLOG records the operator's own account: production pay attaches to the
 * COMPLETED REVIEW rather than to the seal, by their ruling of 2026-09-02, and
 * that is MORE generous than section 3.2 of the signed agreement as written.
 * The platform already behaves the generous way. So the amendment is not a
 * proposal the firm is considering; it is the paperwork catching up with what
 * the software has been paying since September.
 *
 * The agreement itself is not in this repository, and neither is the amendment.
 * Nothing here quotes either, and no figure is derived from a document nobody
 * can read. What IS knowable is the difference the rule makes, because the
 * ledger stores the decision on every row:
 *
 *   as section 3.2 reads    entries whose decision was a seal
 *   as the platform pays    every completed review, whatever the outcome
 *
 * Both are computed from the same ledger, so the gap is the firm's actual
 * exposure rather than an estimate.
 */
export async function productionReport(period = periodOf(), scope: FigureScope = "real"): Promise<Report> {
  const unavailable: string[] = [];
  const client = db();

  if (!client) {
    return {
      key: "production",
      title: "Production",
      period,
      sections: [],
      unavailable: ["The database is not configured, so no production figure could be computed."],
    };
  }

  const { data, error } = await client
    .from("eng_production_ledger")
    .select("engineer_id, decision, amount_cents, status, period")
    .eq("period", period);

  if (error) {
    return {
      key: "production",
      title: "Production",
      period,
      sections: [],
      unavailable: [`The production ledger could not be read: ${error.message}`],
    };
  }

  const rows = data ?? [];
  const priced = rows.filter((r) => isKnown(r.amount_cents as number | null));
  const unpriced = rows.length - priced.length;
  if (unpriced > 0) {
    unavailable.push(
      `${unpriced} ledger entr${unpriced === 1 ? "y" : "ies"} carried no amount and ${unpriced === 1 ? "was" : "were"} excluded from both figures.`,
    );
  }

  const sealed = priced.filter((r) => r.decision === "seal");
  const asWritten = sealed.reduce((n, r) => n + Number(r.amount_cents), 0);
  const asPaid = priced.reduce((n, r) => n + Number(r.amount_cents), 0);

  return {
    key: "production",
    title: "Production",
    period,
    unavailable,
    sections: [
      {
        title: "What the firm owes for this period",
        figures: [
          {
            label: "As the platform pays",
            value: asPaid,
            kind: "money",
            note: "Every completed review, whatever the engineer decided. This is what the ledger holds and what will be paid.",
            rows: "/portal/charge-log",
          },
          {
            label: "As section 3.2 reads today",
            value: asWritten,
            kind: "money",
            note: "Seals only. The signed agreement as the operator describes it, which is narrower than what the software does.",
            rows: "/portal/charge-log",
          },
          {
            label: "The gap the amendment would paper",
            value: asPaid - asWritten,
            kind: "money",
            note: "Paid under a term the executed contract does not yet contain. UNSIGNED: the amendment has not been drafted.",
            rows: "/portal/charge-log",
          },
        ],
      },
      {
        title: "Decisions in the period",
        figures: (["seal", "revisions", "site_visit", "refuse"] as const).map((d) => ({
          label: d === "refuse" ? "declined to seal" : d.replace("_", " "),
          value: rows.filter((r) => r.decision === d).length,
          kind: "count" as const,
          note: "Completed reviews recorded with this decision.",
          rows: "/portal/charge-log",
        })),
      },
    ],
  };
}

// ----------------------------------------------------------------- pipeline

/**
 * Where the work is, and how long it has been there.
 *
 * Cycle time is the one figure here with a history. It had no query at all when
 * this section began, so it was an absence with the reason "not computed" until
 * it got one. It has one now: the state machine's own timestamps, an order's
 * paid_at to its file's sealed_at, sealed files only.
 *
 * It will be absent in every period until the certificate issues, because
 * nothing can be sealed before then. That is a true absence rather than a
 * missing feature, and the note says which.
 */
export async function pipelineReport(period = periodOf(), scope: FigureScope = "real"): Promise<Report> {
  const unavailable: string[] = [];
  const client = db();

  if (!client) {
    return {
      key: "pipeline",
      title: "Pipeline",
      period,
      sections: [],
      unavailable: ["The database is not configured, so no pipeline figure could be computed."],
    };
  }

  let q = client.from("eng_service_orders").select("status, placed_at, paid_at, is_demo, file_id");
  if (scope !== "including_demonstrations") q = q.eq("is_demo", false);
  const { data: orders, error } = await q;

  if (error) {
    return {
      key: "pipeline",
      title: "Pipeline",
      period,
      sections: [],
      unavailable: [`Orders could not be read: ${error.message}`],
    };
  }

  const STATES = [
    "draft",
    "awaiting_payment",
    "in_fulfilment",
    "complete",
    "refunded",
    "cancelled",
  ] as const;

  const byState: Figure[] = STATES.map((s) => ({
    label: s.replace("_", " "),
    value: (orders ?? []).filter((o) => o.status === s).length,
    kind: "count" as const,
    note: "Orders sitting in this state right now.",
    rows: "/portal/orders",
  }));

  /* Cycle time, from the state machine's own timestamps. */
  let cycle: Cents | Count = null;
  let cycleNote =
    "Sealed orders only, from payment to seal. Nothing has been sealed, which is expected until the registration is active.";

  const sealedIds = (orders ?? []).filter((o) => o.file_id && o.paid_at).map((o) => o.file_id as string);
  if (sealedIds.length > 0) {
    const { data: files, error: fErr } = await client
      .from("eng_files")
      .select("id, sealed_at")
      .in("id", sealedIds)
      .not("sealed_at", "is", null);

    if (fErr) {
      unavailable.push(`Cycle time could not be computed: ${fErr.message}`);
    } else {
      const sealedAt = new Map((files ?? []).map((f) => [f.id as string, f.sealed_at as string]));
      const spans = (orders ?? [])
        .filter((o) => o.file_id && o.paid_at && sealedAt.has(o.file_id as string))
        .map(
          (o) =>
            Date.parse(sealedAt.get(o.file_id as string)!) - Date.parse(o.paid_at as string),
        )
        .filter((ms) => Number.isFinite(ms) && ms >= 0);

      if (spans.length > 0) {
        cycle = Math.round(spans.reduce((n, v) => n + v, 0) / spans.length / 3_600_000);
        cycleNote = `Mean hours from payment to seal across ${spans.length} sealed order${spans.length === 1 ? "" : "s"}.`;
      }
    }
  }

  return {
    key: "pipeline",
    title: "Pipeline",
    period,
    unavailable,
    sections: [
      { title: "Orders by state", figures: byState },
      {
        title: "Cycle time",
        figures: [
          {
            label: "Payment to seal",
            value: cycle,
            kind: "duration",
            note: cycleNote,
            rows: "/portal/orders",
          },
        ],
      },
    ],
  };
}

// ------------------------------------------------------------------ partner

/**
 * What partner statements already say, surfaced rather than recomputed.
 *
 * The brief is explicit that this is not a rebuild. eng_partner_statements is
 * the record of what a partner has been told they are owed, and a report that
 * recomputed it from the ledger would produce a second number that disagrees
 * with the statement in somebody's inbox.
 */
export async function partnerReport(period = periodOf(), scope: FigureScope = "real"): Promise<Report> {
  const unavailable: string[] = [];
  const client = db();

  if (!client) {
    return {
      key: "partner",
      title: "Partner",
      period,
      sections: [],
      unavailable: ["The database is not configured, so no partner figure could be computed."],
    };
  }

  const { data, error } = await client
    .from("eng_partner_statements")
    .select("total_cents, status, period")
    .eq("period", period);

  if (error) {
    return {
      key: "partner",
      title: "Partner",
      period,
      sections: [],
      unavailable: [`Partner statements could not be read: ${error.message}`],
    };
  }

  const rows = data ?? [];
  const priced = rows.filter((r) => isKnown(r.total_cents as number | null));
  const missing = rows.length - priced.length;
  if (missing > 0) {
    unavailable.push(
      `${missing} statement${missing === 1 ? "" : "s"} carried no total and ${missing === 1 ? "was" : "were"} excluded.`,
    );
  }

  const totalFor = (status: string) =>
    priced.filter((r) => r.status === status).reduce((n, r) => n + Number(r.total_cents), 0);

  return {
    key: "partner",
    title: "Partner",
    period,
    unavailable,
    sections: [
      {
        title: "Statements in the period",
        figures: [
          {
            label: "Issued",
            value: totalFor("issued"),
            kind: "money",
            note: "Told to a partner and not yet recorded as paid.",
            rows: "/portal/partners",
          },
          {
            label: "Paid",
            value: totalFor("paid"),
            kind: "money",
            note: "Recorded as settled.",
            rows: "/portal/partners",
          },
          {
            label: "Statements",
            value: rows.length,
            kind: "count",
            note: "How many statements cover this period.",
            rows: "/portal/partners",
          },
        ],
      },
    ],
  };
}

/**
 * THE REGISTRY. The declared inventory, the surfaces idiom.
 *
 * reporting-audit derives from this and fails on a report it is not measuring,
 * so a fifth report added without a check is a red board rather than a gap
 * somebody notices later.
 */
export const REPORTS = [
  { key: "revenue", title: "Revenue", action: "reports.revenue", build: revenueReport },
  { key: "production", title: "Production", action: "reports.production", build: productionReport },
  { key: "pipeline", title: "Pipeline", action: "reports.pipeline", build: pipelineReport },
  { key: "partner", title: "Partner", action: "reports.partner", build: partnerReport },
] as const;

export function formatFigure(f: Figure): string {
  if (f.value === null) return "not computed";
  if (f.kind === "money") return money(f.value as Cents);
  if (f.kind === "duration") return `${f.value} hours`;
  return f.value === 0 ? "none" : String(f.value);
}
