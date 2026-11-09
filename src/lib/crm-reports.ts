import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery, readEveryIn } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import {
  conversionBy,
  leaderboard,
  repPeriodRows,
  type CallFact,
  type ConversionFact,
  type ConversionRow,
  type LeaderRow,
  type OpenedFact,
  type OrderFact,
  type Period,
  type RepPeriodRow,
} from "./crm-report-rules";

/**
 * THE MANAGER'S SALES REPORTS. Robert's sales CRM ruling R8 of 2026-11-02; the
 * rules are crm-report-rules.ts. Only a holder of crm.reports (admin and
 * ops_manager, the sales manager by Robert's answer 2) reads them: they carry
 * every rep's attributed revenue, which a rep may not see beyond their own.
 *
 * EVERY ROW, NEVER A SAMPLE. Each read goes through readEvery or readEveryIn,
 * which page until the set is whole and refuse a short answer, so a firm with
 * more calls than one page reports all of them rather than the first thousand.
 * A failed read is reported as one, never as zero calls.
 *
 * THE MISSED CREDIT, SAID. An order placed for a converted account whose
 * attribution failed to save is counted and shown, so a gap is a number on the
 * screen rather than a quiet hole in a rep's figures.
 */

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

export type SalesReport = {
  period: Period;
  rows: (RepPeriodRow & { repName: string })[];
  leaders: (LeaderRow & { repName: string })[];
  byVertical: ConversionRow[];
  bySource: ConversionRow[];
  /** Orders on converted accounts with no attribution row: credit that did not save. */
  unattributedOrders: number;
  today: string;
};

export type SalesReportRead = { ok: true; report: SalesReport } | { ok: false; error: string };

const dayOf = (instant: string) => todayInFirmCalendar(new Date(instant));

async function readFacts(db: Db) {
  const calls = await readEvery<{ by_id: string; created_at: string; crm_outcome: string | null }>((from, to) =>
    db
      .from("eng_contact_log")
      .select("by_id, created_at, crm_outcome")
      .eq("subject_type", "prospect")
      .eq("channel", "call")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!calls.ok) return { ok: false as const, error: `The calls could not be read: ${calls.error}` };

  const attributions = await readEvery<{ kind: string; order_id: string | null; account_id: string; rep_id: string | null; attributed_at: string }>((from, to) =>
    db
      .from("eng_crm_attributions")
      .select("kind, order_id, account_id, rep_id, attributed_at")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!attributions.ok) return { ok: false as const, error: `The attributions could not be read: ${attributions.error}` };

  const orderIds = attributions.rows.filter((a) => a.kind === "order" && a.order_id).map((a) => a.order_id as string);
  const orders = await readEveryIn<{ id: string; status: string; total_cents: number | null; placed_at: string | null; created_at: string }>(orderIds, (chunk, from, to) =>
    db
      .from("eng_service_orders")
      .select("id, status, total_cents, placed_at, created_at")
      .in("id", chunk as string[])
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!orders.ok) return { ok: false as const, error: `The attributed orders could not be read: ${orders.error}` };
  const refunds = await readEveryIn<{ order_id: string; amount_cents: number }>(orderIds, (chunk, from, to) =>
    db
      .from("eng_order_payments")
      .select("order_id, amount_cents")
      .in("order_id", chunk as string[])
      .eq("kind", "refund")
      .eq("status", "succeeded")
      .order("order_id", { ascending: true })
      .range(from, to),
  );
  if (!refunds.ok) return { ok: false as const, error: `The attributed orders' refunds could not be read: ${refunds.error}` };

  const prospects = await readEvery<{ id: string; vertical: string | null; converted_account_id: string | null }>((from, to) =>
    db.from("eng_prospects").select("id, vertical, converted_account_id").order("id", { ascending: true }).range(from, to),
  );
  if (!prospects.ok) return { ok: false as const, error: `The sales list could not be read: ${prospects.error}` };
  const sources = await readEvery<{ prospect_id: string; source: string }>((from, to) =>
    db.from("eng_prospect_sources").select("prospect_id, source").order("id", { ascending: true }).range(from, to),
  );
  if (!sources.ok) return { ok: false as const, error: `The sales list's sources could not be read: ${sources.error}` };

  /* Orders on converted accounts, to count any whose credit did not save. */
  const convertedAccounts = [...new Set(prospects.rows.map((p) => p.converted_account_id).filter((a): a is string => Boolean(a)))];
  const accountOrders = await readEveryIn<{ id: string; status: string }>(convertedAccounts, (chunk, from, to) =>
    db
      .from("eng_service_orders")
      .select("id, status")
      .in("account_id", chunk as string[])
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!accountOrders.ok) return { ok: false as const, error: `The converted accounts' orders could not be read: ${accountOrders.error}` };

  return { ok: true as const, calls: calls.rows, attributions: attributions.rows, orders: orders.rows, refunds: refunds.rows, prospects: prospects.rows, sources: sources.rows, accountOrders: accountOrders.rows };
}

/** The reports for one period kind: rows per rep per period, the leaderboard, conversion, and the missed credit. */
export async function salesReport(actor: Actor | null, period: Period, now: Date = new Date()): Promise<SalesReportRead> {
  if (!actor || !can(actor, "crm.reports")) return { ok: false, error: "Your role cannot open the sales reports." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const facts = await readFacts(db);
  if (!facts.ok) return facts;

  const refunded = new Map<string, number>();
  for (const r of facts.refunds) refunded.set(r.order_id, (refunded.get(r.order_id) ?? 0) + Number(r.amount_cents));
  const orderById = new Map(facts.orders.map((o) => [o.id, o]));

  const calls: CallFact[] = facts.calls.map((c) => ({ repId: c.by_id, day: dayOf(c.created_at), crmOutcome: c.crm_outcome }));
  const opened: OpenedFact[] = facts.attributions
    .filter((a) => a.kind === "account_opened")
    .map((a) => ({ repId: a.rep_id, day: dayOf(a.attributed_at) }));
  const orders: OrderFact[] = [];
  for (const a of facts.attributions) {
    if (a.kind !== "order" || !a.order_id) continue;
    const o = orderById.get(a.order_id);
    if (!o) continue;
    orders.push({
      repId: a.rep_id,
      day: dayOf(o.placed_at ?? o.created_at),
      status: o.status,
      totalCents: o.total_cents === null ? null : Number(o.total_cents),
      refundedCents: refunded.get(o.id) ?? 0,
    });
  }

  const rows = repPeriodRows(period, { calls, opened, orders });
  const leaders = leaderboard(rows);

  const sourcesOf = new Map<string, string[]>();
  for (const s of facts.sources) sourcesOf.set(s.prospect_id, [...(sourcesOf.get(s.prospect_id) ?? []), s.source]);
  const conversion: ConversionFact[] = facts.prospects.map((p) => ({
    prospectId: p.id,
    vertical: p.vertical,
    sources: sourcesOf.get(p.id) ?? [],
    converted: Boolean(p.converted_account_id),
  }));

  const attributedOrderIds = new Set(orderById.keys());
  const unattributedOrders = facts.accountOrders.filter((o) => !attributedOrderIds.has(o.id)).length;

  const repIds = [...new Set([...rows.map((r) => r.repId), ...leaders.map((l) => l.repId)].filter((r): r is string => Boolean(r)))];
  const names = await readEveryIn<{ id: string; display_name: string | null }>(repIds, (chunk, from, to) =>
    db.from("eng_profiles").select("id, display_name").in("id", chunk as string[]).order("id", { ascending: true }).range(from, to),
  );
  if (!names.ok) return { ok: false, error: `The reps' names could not be read: ${names.error}` };
  const nameOf = new Map(names.rows.map((n) => [n.id, n.display_name ?? "A person with no name on file"]));
  const label = (repId: string | null) => (repId ? (nameOf.get(repId) ?? "A person no longer on file") : "Nobody (an unowned company)");

  return {
    ok: true,
    report: {
      period,
      rows: rows.map((r) => ({ ...r, repName: label(r.repId) })),
      leaders: leaders.map((l) => ({ ...l, repName: label(l.repId) })),
      byVertical: conversionBy("vertical", conversion),
      bySource: conversionBy("source", conversion),
      unattributedOrders,
      today: todayInFirmCalendar(now),
    },
  };
}
