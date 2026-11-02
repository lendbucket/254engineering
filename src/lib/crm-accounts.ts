import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery, readEveryIn } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import { canSeeCompany, type Viewer } from "./crm-board-rules";
import { viewerFor } from "./crm-territories";
import {
  COUNTED_ORDER_STATUSES,
  accountStanding,
  accountTasksWanted,
  byRisk,
  type AccountOrder,
  type AccountStanding,
} from "./crm-account-rules";

/**
 * ACCOUNT MANAGEMENT. Robert's sales CRM ruling of 2026-11-02, item R6; the
 * rules are crm-account-rules.ts. No table of its own: every figure is read
 * from eng_service_orders by the account a prospect was converted into
 * (eng_prospects.converted_account_id, 0079), and the reminders and check-ins
 * are ordinary tasks (eng_tasks) keyed by source_key, raised by the daily job
 * crm.account_tasks.
 *
 * WHO SEES WHICH ACCOUNT is the sales list's one rule, canSeeCompany, asked of
 * the converted prospect: a manager sees all, a rep their own (Robert's answer
 * 2: the rep is also the account manager).
 *
 * WHO SEES MONEY. Lifetime revenue is shown only to a holder of crm.reports
 * (admin and ops_manager, whose R8 reports carry revenue by Robert's ruling) or
 * of billing.read (the existing money grant, the administrator's). A rep sees
 * order counts and dates and no revenue at all until R8 attributes orders to
 * the rep: "reps see no revenue figures beyond their own attributed orders",
 * and until attribution exists no order is theirs to see the money of. The
 * figure is never computed into a rep's response, not hidden on the screen.
 */

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

export type AccountRow = {
  prospectId: string;
  accountId: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  openedOn: string;
  /** The standing without its money: revenue lives only in lifetimeRevenueCents, so a rep's row carries no figure at all. */
  standing: Omit<AccountStanding, "lifetimeRevenueCents">;
  /** Present only for a viewer who may see money; null for a rep, never a zero that reads as "no revenue". */
  lifetimeRevenueCents: number | null;
};

export type AccountsView =
  | { ok: true; rows: AccountRow[]; seesRevenue: boolean; today: string }
  | { ok: false; error: string };

/** Whether this person may see an account's revenue. Never widened: crm.reports or the existing billing grant. */
export function seesAccountRevenue(actor: Actor | null): boolean {
  return can(actor, "crm.reports") || can(actor, "billing.read");
}

type ConvertedProspect = {
  id: string;
  company: string;
  owner_id: string | null;
  county: string | null;
  converted_account_id: string;
  converted_at: string;
  owner: { display_name?: string } | null;
};

async function readConverted(db: Db): Promise<{ ok: true; rows: ConvertedProspect[] } | { ok: false; error: string }> {
  const read = await readEvery<ConvertedProspect>((from, to) =>
    db
      .from("eng_prospects")
      .select("id, company, owner_id, county, converted_account_id, converted_at, owner:eng_profiles!eng_prospects_owner_id_fkey(display_name)")
      .not("converted_account_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return { ok: false, error: `The converted accounts could not be read: ${read.error}` };
  return { ok: true, rows: read.rows };
}

async function readOrders(db: Db, accountIds: readonly string[]): Promise<{ ok: true; byAccount: Map<string, AccountOrder[]> } | { ok: false; error: string }> {
  const orders = await readEveryIn<{ id: string; account_id: string; status: string; total_cents: number | null; placed_at: string | null; created_at: string }>(
    accountIds,
    (chunk, from, to) =>
      db
        .from("eng_service_orders")
        .select("id, account_id, status, total_cents, placed_at, created_at")
        .in("account_id", chunk as string[])
        .in("status", [...COUNTED_ORDER_STATUSES])
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!orders.ok) return { ok: false, error: `The accounts' orders could not be read: ${orders.error}` };
  const refunds = await readEveryIn<{ order_id: string; amount_cents: number }>(
    orders.rows.map((o) => o.id),
    (chunk, from, to) =>
      db
        .from("eng_order_payments")
        .select("order_id, amount_cents")
        .in("order_id", chunk as string[])
        .eq("kind", "refund")
        .eq("status", "succeeded")
        .order("order_id", { ascending: true })
        .range(from, to),
  );
  if (!refunds.ok) return { ok: false, error: `The accounts' refunds could not be read: ${refunds.error}` };
  const refunded = new Map<string, number>();
  for (const r of refunds.rows) refunded.set(r.order_id, (refunded.get(r.order_id) ?? 0) + Number(r.amount_cents));
  const byAccount = new Map<string, AccountOrder[]>();
  for (const o of orders.rows) {
    const list = byAccount.get(o.account_id) ?? [];
    list.push({
      day: todayInFirmCalendar(new Date(o.placed_at ?? o.created_at)),
      status: o.status,
      totalCents: o.total_cents === null ? null : Number(o.total_cents),
      refundedCents: refunded.get(o.id) ?? 0,
    });
    byAccount.set(o.account_id, list);
  }
  return { ok: true, byAccount };
}

function standingsFor(prospects: readonly ConvertedProspect[], byAccount: Map<string, AccountOrder[]>, today: string) {
  return prospects.map((p) => {
    const openedOn = todayInFirmCalendar(new Date(p.converted_at));
    return {
      prospect: p,
      openedOn,
      standing: accountStanding({ openedOn, today, orders: byAccount.get(p.converted_account_id) ?? [] }),
    };
  });
}

/** The account manager view: this person's accounts, riskiest first. */
export async function accountsFor(actor: Actor | null, now: Date = new Date()): Promise<AccountsView> {
  if (!actor || !can(actor, "crm.use")) return { ok: false, error: "Your role cannot open the accounts." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const who = await viewerFor(actor);
  if (!who.ok) return { ok: false, error: who.error };
  const viewer: Viewer = who.viewer;
  const converted = await readConverted(db);
  if (!converted.ok) return converted;
  const mine = converted.rows.filter((p) => canSeeCompany(viewer, p.owner_id, p.county));
  const orders = await readOrders(db, [...new Set(mine.map((p) => p.converted_account_id))]);
  if (!orders.ok) return orders;
  const today = todayInFirmCalendar(now);
  const money = seesAccountRevenue(actor);
  const rows: AccountRow[] = standingsFor(mine, orders.byAccount, today).map(({ prospect, openedOn, standing }) => {
    const { lifetimeRevenueCents, ...rest } = standing;
    return {
      prospectId: prospect.id,
      accountId: prospect.converted_account_id,
      name: prospect.company,
      ownerId: prospect.owner_id,
      ownerName: prospect.owner?.display_name ?? null,
      openedOn,
      standing: rest,
      lifetimeRevenueCents: money ? lifetimeRevenueCents : null,
    };
  });
  return { ok: true, rows: byRisk(rows), seesRevenue: money, today };
}

export type AccountTaskReport = { accounts: number; wanted: number; raised: number; existing: number; faults: string[] };

/**
 * The daily reminders and check-ins. For every converted account, the tasks it
 * wants today (crm-account-rules.ts accountTasksWanted), each raised once by
 * its source_key: the unique index on eng_tasks.source_key means a second run
 * the same day, or any later day, finds the row and adds nothing. Assigned to
 * the company's owner, the account manager by Robert's answer 2; unassigned
 * when the company has no owner. Every fault is returned, never swallowed.
 */
export async function refreshAccountTasks(now: Date = new Date()): Promise<AccountTaskReport> {
  const report: AccountTaskReport = { accounts: 0, wanted: 0, raised: 0, existing: 0, faults: [] };
  const db = supabaseAdmin();
  if (!db) {
    report.faults.push("The database is not configured.");
    return report;
  }
  const converted = await readConverted(db);
  if (!converted.ok) {
    report.faults.push(converted.error);
    return report;
  }
  const orders = await readOrders(db, [...new Set(converted.rows.map((p) => p.converted_account_id))]);
  if (!orders.ok) {
    report.faults.push(orders.error);
    return report;
  }
  const today = todayInFirmCalendar(now);
  report.accounts = converted.rows.length;
  for (const { prospect, openedOn, standing } of standingsFor(converted.rows, orders.byAccount, today)) {
    for (const task of accountTasksWanted({ accountId: prospect.converted_account_id, name: prospect.company, openedOn, today, standing })) {
      report.wanted += 1;
      const { data: found, error: findErr } = await db.from("eng_tasks").select("id").eq("source_key", task.key).maybeSingle();
      if (findErr) {
        report.faults.push(`reading the task ${task.key}: ${findErr.message}`);
        continue;
      }
      if (found) {
        report.existing += 1;
        continue;
      }
      const { error } = await db.from("eng_tasks").insert({
        title: task.title,
        description: task.description,
        created_by: null,
        assignee_id: prospect.owner_id,
        due_at: `${task.dueOn}T00:00:00.000Z`,
        priority: task.kind === "reorder" ? "normal" : "low",
        source_key: task.key,
      });
      /* 23505 is the unique source_key: a concurrent run raised it first, which is the outcome wanted. */
      if (error && error.code === "23505") report.existing += 1;
      else if (error) report.faults.push(`raising ${task.key}: ${error.message}`);
      else report.raised += 1;
    }
  }
  return report;
}
