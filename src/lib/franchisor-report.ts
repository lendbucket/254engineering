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

  const started = await readEveryIn<{ id: string; operating_since: string | null }>(franchiseeIds, (chunk, from, to) =>
    db.from("eng_franchisees").select("id, operating_since").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
  );
  if (!started.ok) return refuse(`When each franchisee started operating could not be read: ${started.error}`);
  const since = new Map(started.rows.map((r) => [String(r.id), r.operating_since ? String(r.operating_since) : null]));

  const territory = await territoryFactsForMany(db, franchiseeIds);
  if (!territory.ok) return refuse(territory.error);

  const byFranchisee = new Map<string, FranchiseeHealth>();
  for (const id of franchiseeIds) {
    const onboarding = await onboardingStepsFor(db, id);
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
