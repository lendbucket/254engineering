import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEveryIn } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import { territoryFactsForMany } from "./territory-revenue";
import { onboardingStepsFor } from "./franchisee-onboarding";
import { statementRows } from "./franchise-statement-rules";
import { expiringSoon, sumKnown, thisAndLastMonth } from "./franchisor-report-rules";

/**
 * FRANCHISOR REPORTING (platform item X6). franchise.manage, which only admin
 * holds. One pass over every franchisee asked about: its territory revenue
 * (territory-revenue.ts, one order read for all of them), what the statement
 * says it owes this month (franchise-statement-rules.ts), and its health, its
 * onboarding steps and its certificates near expiry (franchisee-onboarding.ts).
 * The rules and the parts not computed are in franchisor-report-rules.ts.
 */

const refuse = (error: string) => ({ ok: false as const, error });

export type FranchiseeHealth = {
  stepsMet: number;
  stepsTotal: number;
  certificatesExpiringSoon: number;
  revenueThisMonthCents: number | null;
  revenueLastMonthCents: number | null;
  dueThisMonthCents: number | null;
};

export type FranchisorReport = {
  thisMonth: string;
  lastMonth: string;
  byFranchisee: Map<string, FranchiseeHealth>;
  revenueThisMonthCents: number | null;
  revenueLastMonthCents: number | null;
  dueThisMonthCents: number | null;
};

export async function franchisorReport(actor: Actor | null, franchiseeIds: readonly string[]): Promise<{ ok: true; report: FranchisorReport } | { ok: false; error: string }> {
  if (!actor || !can(actor, "franchise.manage")) return refuse("Only an administrator reads franchisor reporting.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the report could not be read.");
  const today = todayInFirmCalendar();
  const { thisMonth, lastMonth } = thisAndLastMonth(today);

  /*
   * THE INDEPENDENT READS RUN TOGETHER. Office-ready Batch B, profiled on
   * 2026-11-14: /portal/franchisees was sixteen requests one after another.
   * When each franchisee started and its territory facts do not depend on each
   * other, and each franchisee's onboarding read depends on nothing but its
   * id, so those run eight at a time. A failure is still refused whole, the
   * first in the franchisee order.
   */
  const [started, territory] = await Promise.all([
    readEveryIn<{ id: string; operating_since: string | null }>(franchiseeIds, (chunk, from, to) =>
      db.from("eng_franchisees").select("id, operating_since").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
    ),
    territoryFactsForMany(db, franchiseeIds),
  ]);
  if (!started.ok) return refuse(`When each franchisee started operating could not be read: ${started.error}`);
  const since = new Map(started.rows.map((r) => [String(r.id), r.operating_since ? String(r.operating_since) : null]));
  if (!territory.ok) return refuse(territory.error);

  const onboardings: Awaited<ReturnType<typeof onboardingStepsFor>>[] = [];
  for (let i = 0; i < franchiseeIds.length; i += 8) {
    onboardings.push(...(await Promise.all(franchiseeIds.slice(i, i + 8).map((id) => onboardingStepsFor(db, id)))));
  }

  const byFranchisee = new Map<string, FranchiseeHealth>();
  for (const [index, id] of franchiseeIds.entries()) {
    const onboarding = onboardings[index];
    if (!onboarding.ok) return refuse(onboarding.error);
    const facts = territory.facts.get(id)!;
    const monthOf = (m: string) => facts.revenue.find((r) => r.month === m);
    const statement = statementRows(facts.revenue, since.get(id) ?? null, thisMonth);
    /* No row this month means nothing is due; a row whose total is unknown stays unknown, never zero. */
    const dueRow = statement.find((r) => r.month === thisMonth);
    byFranchisee.set(id, {
      stepsMet: onboarding.onboarding.steps.filter((s) => s.met).length,
      stepsTotal: onboarding.onboarding.steps.length,
      certificatesExpiringSoon: expiringSoon(
        onboarding.onboarding.certificates.map((c) => ({ expiresOn: c.expiresOn, withdrawn: c.withdrawnAt !== null })),
        today,
      ),
      revenueThisMonthCents: monthOf(thisMonth) ? monthOf(thisMonth)!.revenueCents : 0,
      revenueLastMonthCents: monthOf(lastMonth) ? monthOf(lastMonth)!.revenueCents : 0,
      dueThisMonthCents: dueRow ? dueRow.totalCents : 0,
    });
  }
  const all = [...byFranchisee.values()];
  return {
    ok: true,
    report: {
      thisMonth,
      lastMonth,
      byFranchisee,
      revenueThisMonthCents: sumKnown(all.map((h) => h.revenueThisMonthCents)),
      revenueLastMonthCents: sumKnown(all.map((h) => h.revenueLastMonthCents)),
      dueThisMonthCents: sumKnown(all.map((h) => h.dueThisMonthCents)),
    },
  };
}
