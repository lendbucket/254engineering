import "server-only";
import { supabaseAdmin } from "./supabase";
import { isKnown, money, type Cents } from "./ops-money";
import { type FigureScope } from "./reporting-scope";
import { twiaStatus } from "./ops-counties";
import { FIRST_TIER_COASTAL } from "@/content/windstorm";

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
 * A FIGURE CARRIES ITS ROWS, IT DOES NOT LINK TO A SCREEN THAT MIGHT HAVE THEM
 * ---------------------------------------------------------------------------
 * The first version of this module gave every figure an href, and most of them
 * pointed at /portal/orders. That screen is not a list of orders. Its own
 * comment says so in as many words: it deliberately shows only orders that have
 * stopped moving, because "a list of everything would be a list nobody reads".
 * So the expansion under a revenue figure would have opened a screen that did
 * not contain the rows the figure was computed from, and in the ordinary case
 * would have been empty while the figure said thousands of dollars.
 *
 * That is the recurring defect of this repository wearing a link: a thing that
 * looks like a check and is looking at a different set. So a Figure now carries
 * the rows themselves, taken from the same result the total was summed over.
 * They cannot disagree, because there is no second query to disagree with.
 *
 * It also makes the expansion checkable. reporting-audit adds up the rows under
 * every count and money figure and requires the total to match, which is an
 * assertion no href could ever have supported.
 */

/** A count that may not be known. Same distinction Cents draws for money. */
export type Count = number | null;

/**
 * One row behind a figure.
 *
 * `value` is the row's own contribution to the total, so the expansion can be
 * added up and compared to the figure above it. Null where the row genuinely
 * has no amount, which is why a row's absence and a row's zero stay different.
 */
export type FigureRow = {
  label: string;
  detail: string;
  value: Cents | Count;
};

/**
 * One figure on a report.
 *
 * `value` null means the query could not run. `rows` is what it was computed
 * from, and is null only in that same case.
 */
export type Figure = {
  label: string;
  value: Cents | Count;
  kind: "money" | "count" | "duration";
  /** What zero means here, in words, so an honest zero is not read as a fault. */
  note: string;
  /** The records the figure was computed from. Null only when the query failed. */
  rows: FigureRow[] | null;
};

export type ReportSection = { title: string; figures: Figure[] };

/**
 * HOW MANY ROWS OF AN EXPANSION REACH THE PAGE AT ONCE.
 *
 * A figure carries every row it was computed from, because that is what makes
 * the total checkable. What it must not do is put every row into the HTML: a
 * revenue figure over a busy month carries one row per payment, and the
 * pipeline figures carry one row per order that has EVER existed, because
 * "orders in this state right now" is deliberately a standing count rather
 * than a count for the period.
 *
 * So the sum stays over the full set, server side, and the page renders a
 * window onto it. Twenty five rows is roughly seven hundred pixels at the row
 * height this table uses, which is one scrolling region at 390 rather than a
 * screen the reader has to swipe through to reach the next figure.
 *
 * The remainder is STATED rather than dropped. A table that silently stops at
 * twenty five is a reader counting twenty five rows under a figure that says
 * four hundred, which is the same defect as an expansion pointing at the wrong
 * set: it invites somebody to trust an arithmetic that does not add up.
 */
export const ROWS_PER_PAGE = 25;

/** A window onto one figure's rows, plus what the window is not showing. */
export function pageOfRows(rows: FigureRow[], page: number): {
  shown: FigureRow[];
  page: number;
  pages: number;
  from: number;
  to: number;
} {
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const from = (current - 1) * ROWS_PER_PAGE;
  const to = Math.min(from + ROWS_PER_PAGE, rows.length);
  return { shown: rows.slice(from, to), page: current, pages, from, to };
}

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

const day = (value: string | null): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "no date recorded";

/** Sum the rows an expansion holds, so a figure and its expansion cannot drift. */
const sumRows = (rows: FigureRow[]): Cents =>
  rows.reduce((n, r) => n + (isKnown(r.value) ? (r.value as number) : 0), 0);

// ------------------------------------------------------------------ revenue

/**
 * What the firm took, what it gave back, and which service lines it came from.
 *
 * A CHARGE THAT DID NOT SUCCEED IS NOT REVENUE, AND IS NOT HIDDEN EITHER.
 *
 * eng_order_payments records attempts, not only settlements: `status` carries
 * pending, succeeded, failed and cancelled. Gross counts succeeded rows only,
 * because a failed charge counted as revenue is exactly the plausible-and-wrong
 * number this section exists to prevent.
 *
 * Everything the filter removes is shown as its own figure rather than dropped,
 * so the two numbers sit beside each other and nobody has to know the rule to
 * see what it did. A silent exclusion and a silent inclusion are the same
 * defect from opposite sides.
 *
 * A PAYMENT IS NOT A DEMONSTRATION; ITS ORDER IS.
 *
 * eng_order_payments carries no is_demo column and should not: a payment is a
 * demonstration exactly when the order it belongs to is, and a second column
 * would be a second answer that can disagree with the first. So the scope is
 * applied through the parent with an inner join.
 *
 * Found by running this report rather than by reading it. The first version
 * filtered on a column this table does not have, which PostgREST answered with
 * an error, so gross reported "not computed" instead of a wrong number. The
 * refunds query had no filter at all and counted $2,025 of probe refunds, which
 * is the contamination this whole section exists to stop.
 */
export async function revenueReport(period = periodOf(), scope: FigureScope = "real"): Promise<Report> {
  const unavailable: string[] = [];
  const client = db();

  if (!client) {
    return {
      key: "revenue",
      title: "Revenue",
      period,
      sections: [],
      unavailable: ["The database is not configured, so no revenue figure could be computed."],
    };
  }

  const { from, to } = boundsOf(period);
  let q = client
    .from("eng_order_payments")
    .select(
      "amount_cents, kind, status, provider, refund_case, created_at, eng_service_orders!inner(reference, service_slug, is_demo)",
    )
    .gte("created_at", from)
    .lt("created_at", to);
  if (scope !== "including_demonstrations") q = q.eq("eng_service_orders.is_demo", false);

  const { data, error } = await q;
  if (error) {
    return {
      key: "revenue",
      title: "Revenue",
      period,
      sections: [],
      unavailable: [`Payments could not be read: ${error.message}`],
    };
  }

  type Row = {
    amount_cents: number | null;
    kind: string;
    status: string;
    provider: string;
    refund_case: string | null;
    created_at: string;
    eng_service_orders: { reference: string; service_slug: string; is_demo: boolean };
  };
  const all = (data ?? []) as unknown as Row[];

  const unpriced = all.filter((r) => !isKnown(r.amount_cents));
  if (unpriced.length > 0) {
    unavailable.push(
      `${unpriced.length} payment row${unpriced.length === 1 ? "" : "s"} carried no amount and ${unpriced.length === 1 ? "was" : "were"} excluded from every figure here.`,
    );
  }

  const priced = all.filter((r) => isKnown(r.amount_cents));
  const rowOf = (r: Row, sign = 1): FigureRow => ({
    label: r.eng_service_orders.reference,
    detail: `${r.eng_service_orders.service_slug}, ${day(r.created_at)}`,
    value: sign * (r.amount_cents as number),
  });

  const settled = priced.filter((r) => r.status === "succeeded");
  const charges = settled.filter((r) => r.kind === "charge");
  const refunds = settled.filter((r) => r.kind === "refund");
  const attempted = priced.filter((r) => r.status !== "succeeded");

  const chargeRows = charges.map((r) => rowOf(r));
  const refundRows = refunds.map((r) => rowOf(r));
  const netRows = [...chargeRows, ...refunds.map((r) => rowOf(r, -1))];

  /* By service line. Derived from the slugs present rather than from the
   * catalogue, because a line that took no money in the period is not a zero
   * this report has any business inventing. */
  const lines = [...new Set(charges.map((r) => r.eng_service_orders.service_slug))].sort();
  const byLine: Figure[] = lines.map((slug) => {
    const rows = charges.filter((r) => r.eng_service_orders.service_slug === slug).map((r) => rowOf(r));
    return {
      label: slug.replace(/-/g, " "),
      value: sumRows(rows),
      kind: "money" as const,
      note: "Charged against orders on this service line in the period, before refunds.",
      rows,
    };
  });
  if (byLine.length === 0) {
    byLine.push({
      label: "No line took money",
      value: 0,
      kind: "money",
      note: "The query ran and found no settled charge in the period, which is a real zero.",
      rows: [],
    });
  }

  /* Refunds by case, because the three cases are different facts and a net
   * figure hides which one happened. */
  const cases = [...new Set(refunds.map((r) => r.refund_case ?? "not recorded"))].sort();
  const byCase: Figure[] = cases.map((c) => {
    const rows = refunds.filter((r) => (r.refund_case ?? "not recorded") === c).map((r) => rowOf(r));
    return {
      label: c,
      value: sumRows(rows),
      kind: "money" as const,
      note: "Refunded under this case in the period.",
      rows,
    };
  });
  if (byCase.length === 0) {
    byCase.push({
      label: "No refunds",
      value: 0,
      kind: "money",
      note: "The query ran and found none, which is a real zero.",
      rows: [],
    });
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
            value: sumRows(chargeRows),
            kind: "money",
            note: "Settled charges in the period, before refunds. Zero means nothing was charged.",
            rows: chargeRows,
          },
          {
            label: "Refunded",
            value: sumRows(refundRows),
            kind: "money",
            note: "Everything given back in the period, whatever the case.",
            rows: refundRows,
          },
          {
            label: "Net",
            value: sumRows(netRows),
            kind: "money",
            note: "Gross less refunds. The expansion holds both halves, refunds negative, so the arithmetic is visible.",
            rows: netRows,
          },
          {
            label: "Attempted and not settled",
            value: sumRows(attempted.map((r) => rowOf(r))),
            kind: "money",
            note: "Pending, failed or cancelled, and therefore in no figure above. Shown so the exclusion is not silent.",
            rows: attempted.map((r) => ({
              label: r.eng_service_orders.reference,
              detail: `${r.status}, ${day(r.created_at)}`,
              value: r.amount_cents,
            })),
          },
        ],
      },
      { title: "By service line", figures: byLine },
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

  /*
   * THE LEDGER HAS NO is_demo AND SHOULD NOT.
   *
   * An entry is a demonstration exactly when the ENGINEER on it is, for the
   * same reason a payment is one exactly when its order is. eng_profiles
   * carries the column, so the scope is applied through the engineer.
   */
  let q = client
    .from("eng_production_ledger")
    .select("engineer_id, decision, amount_cents, status, period, eng_profiles!inner(display_name, is_demo)")
    .eq("period", period);
  if (scope !== "including_demonstrations") q = q.eq("eng_profiles.is_demo", false);

  const { data, error } = await q;

  if (error) {
    return {
      key: "production",
      title: "Production",
      period,
      sections: [],
      unavailable: [`The production ledger could not be read: ${error.message}`],
    };
  }

  type Row = {
    engineer_id: string;
    decision: string | null;
    amount_cents: number | null;
    status: string;
    eng_profiles: { display_name: string; is_demo: boolean };
  };
  const rows = (data ?? []) as unknown as Row[];

  const priced = rows.filter((r) => isKnown(r.amount_cents));
  const unpriced = rows.length - priced.length;
  if (unpriced > 0) {
    unavailable.push(
      `${unpriced} ledger entr${unpriced === 1 ? "y" : "ies"} carried no amount and ${unpriced === 1 ? "was" : "were"} excluded from every money figure here.`,
    );
  }

  const rowOf = (r: Row): FigureRow => ({
    label: r.eng_profiles.display_name,
    detail: `${r.decision ?? "no decision recorded"}, ${r.status}`,
    value: r.amount_cents,
  });

  const sealed = priced.filter((r) => r.decision === "seal");
  const unsealed = priced.filter((r) => r.decision !== "seal");

  /* By engineer. Names come from the joined profile, so a figure never shows a
   * bare uuid and never invents a name for one it could not resolve. */
  const engineers = [...new Set(priced.map((r) => r.engineer_id))];
  const byEngineer: Figure[] = engineers
    .map((id) => {
      const mine = priced.filter((r) => r.engineer_id === id);
      return {
        label: mine[0].eng_profiles.display_name,
        value: sumRows(mine.map(rowOf)),
        kind: "money" as const,
        note: "Everything this engineer's completed reviews earned in the period, as the platform pays.",
        rows: mine.map(rowOf),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  if (byEngineer.length === 0) {
    byEngineer.push({
      label: "No engineer earned in this period",
      value: 0,
      kind: "money",
      note: "The ledger was read and holds no priced entry for the period, which is a real zero.",
      rows: [],
    });
  }

  return {
    key: "production",
    title: "Production",
    period,
    unavailable,
    sections: [
      {
        title: "What the firm owes for this period: the executed agreement beside the unsigned amendment",
        figures: [
          {
            label: "Executed agreement, section 3.2",
            value: sumRows(sealed.map(rowOf)),
            kind: "money",
            note: "SIGNED. Seals only, which is section 3.2 as the operator describes it. The agreement itself is not in this repository and nothing here quotes it.",
            rows: sealed.map(rowOf),
          },
          {
            label: "Unsigned amendment, which is what the platform already pays",
            value: sumRows(priced.map(rowOf)),
            kind: "money",
            note: "UNSIGNED, AND NOT YET DRAFTED. Every completed review, whatever the engineer decided. This is the larger of the two and it is the one the ledger holds and the one that will be paid.",
            rows: priced.map(rowOf),
          },
          {
            label: "The gap between them",
            value: sumRows(unsealed.map(rowOf)),
            kind: "money",
            note: "Paid under a term the executed contract does not contain. This is the firm's exposure, computed from the ledger's own decisions rather than estimated.",
            rows: unsealed.map(rowOf),
          },
        ],
      },
      { title: "By engineer", figures: byEngineer },
      {
        title: "Decisions in the period",
        figures: (["seal", "revisions", "site_visit", "refuse"] as const).map((d) => {
          const mine = rows.filter((r) => r.decision === d);
          return {
            label: d === "refuse" ? "declined to seal" : d.replace("_", " "),
            value: mine.length,
            kind: "count" as const,
            note: "Completed reviews recorded with this decision.",
            rows: mine.map(rowOf),
          };
        }),
      },
    ],
  };
}

// ----------------------------------------------------------------- pipeline

/**
 * Where the work is, how long it has been there, and how the coastal figure
 * was arrived at.
 *
 * AGE IN STATE IS DERIVED FROM THE COLUMN THAT RECORDS THE STATE, NOT updated_at
 * ----------------------------------------------------------------------------
 * `updated_at` moves whenever anything on the row is written, so an order that
 * has sat untouched for a month reads as fresh the moment somebody corrects a
 * postcode. The state machine writes its own timestamps and those are used:
 * placed_at for an order awaiting payment, paid_at for one in fulfilment,
 * created_at for a draft. An order in one of those states with no such
 * timestamp is EXCLUDED and named, rather than aged from a column that means
 * something else.
 *
 * Terminal states get no age figure at all. "How long has this order been
 * complete" is not a question anybody is asking, and answering it would be
 * three more figures nobody reads sitting next to the three that matter.
 *
 * Cycle time is the one figure here with a history. It had no query at all when
 * this section began, so it was an absence with the reason "not computed" until
 * it got one. It has one now: the state machine's own timestamps, an order's
 * paid_at to its file's sealed_at, sealed files only. It will be absent in
 * every period until the certificate issues, because nothing can be sealed
 * before then. That is a true absence rather than a missing feature.
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

  let q = client
    .from("eng_service_orders")
    .select("reference, status, county, twia_county, created_at, placed_at, paid_at, is_demo, file_id");
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

  type Order = {
    reference: string;
    status: string;
    county: string;
    twia_county: boolean;
    created_at: string;
    placed_at: string | null;
    paid_at: string | null;
    file_id: string | null;
  };
  const all = (orders ?? []) as unknown as Order[];

  const STATES = ["draft", "awaiting_payment", "in_fulfilment", "complete", "refunded", "cancelled"] as const;

  const byState: Figure[] = STATES.map((s) => {
    const mine = all.filter((o) => o.status === s);
    return {
      label: s.replace("_", " "),
      value: mine.length,
      kind: "count" as const,
      note: "Orders sitting in this state right now. This is a standing count, not a count for the period.",
      rows: mine.map((o) => ({ label: o.reference, detail: o.county, value: null })),
    };
  });

  // ------------------------------------------------------------ age in state

  const ENTERED: Record<string, { column: keyof Order; label: string }> = {
    draft: { column: "created_at", label: "created_at" },
    awaiting_payment: { column: "placed_at", label: "placed_at" },
    in_fulfilment: { column: "paid_at", label: "paid_at" },
  };
  const now = Date.now();

  const ageFigures: Figure[] = Object.entries(ENTERED).map(([state, source]) => {
    const mine = all.filter((o) => o.status === state);
    const dated = mine.filter((o) => typeof o[source.column] === "string");
    const undated = mine.length - dated.length;
    if (undated > 0) {
      unavailable.push(
        `${undated} order${undated === 1 ? "" : "s"} in ${state.replace("_", " ")} carr${undated === 1 ? "ies" : "y"} no ${source.label}, so ${undated === 1 ? "it is" : "they are"} not aged.`,
      );
    }

    const rows: FigureRow[] = dated
      .map((o) => ({
        label: o.reference,
        detail: `${source.label} ${day(o[source.column] as string)}`,
        value: Math.floor((now - Date.parse(o[source.column] as string)) / 86_400_000),
      }))
      .sort((a, b) => (b.value as number) - (a.value as number));

    return {
      label: `oldest in ${state.replace("_", " ")}`,
      value: rows.length > 0 ? (rows[0].value as number) : 0,
      kind: "duration" as const,
      note: `Days since ${source.label} for the oldest order in this state. Zero means nothing is waiting, which is a real zero. The expansion lists every order in the state, oldest first.`,
      rows,
    };
  });

  // ------------------------------- the designated area, and how it was derived

  /*
   * TWO SOURCES DISAGREE HERE AND THE REPORT SHOWS BOTH RATHER THAN PICKING ONE.
   *
   * An order carries `twia_county`, a boolean written at intake, and it also
   * carries the county name, from which twiaStatus() derives an answer. A
   * report that showed one number would be asserting that one of them is the
   * truth, and neither is: the flag can be stale or wrong, and the NAME cannot
   * answer at all for Harris, because the designated area is fourteen whole
   * counties plus the part of Harris east of State Highway 146.
   *
   * So the derivation is on the report. Three figures for what the name says,
   * one for what the order records, and one for the orders where the two do not
   * agree, which is the only one anybody has to act on. Development already
   * holds such a row: a seeded Nueces order with twia_county false.
   */
  const derived = (o: Order) => twiaStatus(o.county);
  const twiaFigures: Figure[] = [
    {
      label: "the county name says designated",
      value: all.filter((o) => derived(o) === "designated").length,
      kind: "count",
      note: `The county is one of the ${FIRST_TIER_COASTAL.length} first tier coastal counties. Derived from the name on the order, not from the flag.`,
      rows: all
        .filter((o) => derived(o) === "designated")
        .map((o) => ({ label: o.reference, detail: o.county, value: null })),
    },
    {
      label: "the county name cannot answer",
      value: all.filter((o) => derived(o) === "check").length,
      kind: "count",
      note: "Harris County. The designated area is the part east of State Highway 146, which a county name cannot resolve, so intake asks. None means no Harris order, which is a real zero.",
      rows: all
        .filter((o) => derived(o) === "check")
        .map((o) => ({ label: o.reference, detail: o.county, value: null })),
    },
    {
      label: "the order records TWIA",
      value: all.filter((o) => o.twia_county).length,
      kind: "count",
      note: "The boolean written on the order at intake, whatever the county name says.",
      rows: all.filter((o) => o.twia_county).map((o) => ({ label: o.reference, detail: o.county, value: null })),
    },
    {
      label: "the two disagree",
      value: all.filter((o) => derived(o) !== "check" && (derived(o) === "designated") !== o.twia_county).length,
      kind: "count",
      note: "The flag on the order and the answer the county name gives are different. Harris is excluded because the name has no answer to disagree with. Anything here is a row somebody has to look at.",
      rows: all
        .filter((o) => derived(o) !== "check" && (derived(o) === "designated") !== o.twia_county)
        .map((o) => ({
          label: o.reference,
          detail: `${o.county}: name says ${derived(o) === "designated" ? "designated" : "not designated"}, order records ${o.twia_county ? "TWIA" : "not TWIA"}`,
          value: null,
        })),
    },
  ];

  // ------------------------------------------------------------- cycle time

  let cycle: Count = null;
  let cycleRows: FigureRow[] = [];
  let cycleNote =
    "Sealed orders only, from payment to seal. Nothing has been sealed, which is expected until the registration is active.";

  const withFiles = all.filter((o) => o.file_id && o.paid_at);
  if (withFiles.length > 0) {
    const { data: files, error: fErr } = await client
      .from("eng_files")
      .select("id, sealed_at")
      .in("id", withFiles.map((o) => o.file_id as string))
      .not("sealed_at", "is", null);

    if (fErr) {
      unavailable.push(`Cycle time could not be computed: ${fErr.message}`);
    } else {
      const sealedAt = new Map((files ?? []).map((f) => [f.id as string, f.sealed_at as string]));
      const spans = withFiles
        .filter((o) => sealedAt.has(o.file_id as string))
        .map((o) => ({
          reference: o.reference,
          hours: Math.round(
            (Date.parse(sealedAt.get(o.file_id as string)!) - Date.parse(o.paid_at as string)) / 3_600_000,
          ),
        }))
        .filter((s) => Number.isFinite(s.hours) && s.hours >= 0);

      if (spans.length > 0) {
        cycle = Math.round(spans.reduce((n, s) => n + s.hours, 0) / spans.length);
        cycleRows = spans.map((s) => ({ label: s.reference, detail: "payment to seal", value: s.hours }));
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
      { title: "Age in state", figures: ageFigures },
      { title: "The designated area, and how it was derived", figures: twiaFigures },
      {
        title: "Cycle time",
        figures: [
          {
            label: "Payment to seal",
            value: cycle,
            kind: "duration",
            note: cycleNote,
            rows: cycle === null ? [] : cycleRows,
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

  /* Scoped through the partner, for the reason recorded on the production
   * ledger: a statement is a demonstration exactly when its partner is. */
  let q = client
    .from("eng_partner_statements")
    .select("reference, total_cents, status, period, eng_partners!inner(organisation, is_demo)")
    .eq("period", period);
  if (scope !== "including_demonstrations") q = q.eq("eng_partners.is_demo", false);

  const { data, error } = await q;

  if (error) {
    return {
      key: "partner",
      title: "Partner",
      period,
      sections: [],
      unavailable: [`Partner statements could not be read: ${error.message}`],
    };
  }

  type Row = {
    reference: string;
    total_cents: number | null;
    status: string;
    eng_partners: { organisation: string; is_demo: boolean };
  };
  const rows = (data ?? []) as unknown as Row[];

  const priced = rows.filter((r) => isKnown(r.total_cents));
  const missing = rows.length - priced.length;
  if (missing > 0) {
    unavailable.push(
      `${missing} statement${missing === 1 ? "" : "s"} carried no total and ${missing === 1 ? "was" : "were"} excluded from the money figures.`,
    );
  }

  const rowsFor = (status: string): FigureRow[] =>
    priced
      .filter((r) => r.status === status)
      .map((r) => ({ label: r.reference, detail: r.eng_partners.organisation, value: r.total_cents }));

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
            value: sumRows(rowsFor("issued")),
            kind: "money",
            note: "Told to a partner and not yet recorded as paid.",
            rows: rowsFor("issued"),
          },
          {
            label: "Paid",
            value: sumRows(rowsFor("paid")),
            kind: "money",
            note: "Recorded as settled.",
            rows: rowsFor("paid"),
          },
          {
            label: "Statements",
            value: rows.length,
            kind: "count",
            note: "How many statements cover this period, priced or not.",
            rows: rows.map((r) => ({
              label: r.reference,
              detail: `${r.eng_partners.organisation}, ${r.status}`,
              value: r.total_cents,
            })),
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
  if (f.kind === "duration") return `${f.value} ${f.label.startsWith("oldest") ? "days" : "hours"}`;
  return f.value === 0 ? "none" : String(f.value);
}
