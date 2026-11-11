import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { todayInFirmCalendar } from "./firm-calendar";
import { territoryFacts } from "./territory-revenue";
import { statementRows, technologyFeeFirstMonth, type StatementRow } from "./franchise-statement-rules";

/**
 * THE ROYALTY AND FEE STATEMENT (platform item X3, part two). Per franchisee,
 * per calendar month: its territory revenue, the royalty and brand fund on it,
 * the technology fee once due, and the capacity fee as not decided.
 * franchise.manage, which only admin holds; staff and admin only, and not an
 * invoice: nothing here charges anybody or is sent to anybody.
 *
 * The revenue is territory-revenue.ts, the one read the owner's own screen
 * (X2) also uses, so the two cannot disagree. The fees are
 * src/config/franchise-fees.ts, read by franchise-statement-rules.ts.
 */

const refuse = (error: string) => ({ ok: false as const, error });

export type FranchiseStatement = {
  legalName: string;
  operatingSince: string | null;
  technologyFeeFrom: string | null;
  through: string;
  rows: StatementRow[];
};

export async function statementFor(actor: Actor | null, franchiseeId: string): Promise<{ ok: true; statement: FranchiseStatement } | { ok: false; error: string }> {
  if (!actor || !can(actor, "franchise.manage")) return refuse("Only an administrator reads a franchisee's statement.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the statement could not be read.");
  const f = await db.from("eng_franchisees").select("legal_name, operating_since").eq("id", franchiseeId).maybeSingle();
  if (f.error) return refuse(`The franchisee could not be read: ${f.error.message}`);
  if (!f.data) return refuse("That franchisee is not on record.");
  const territory = await territoryFacts(db, franchiseeId);
  if (!territory.ok) return refuse(territory.error);
  const operatingSince = f.data.operating_since ? String(f.data.operating_since) : null;
  const through = todayInFirmCalendar().slice(0, 7);
  return {
    ok: true,
    statement: {
      legalName: String(f.data.legal_name),
      operatingSince,
      technologyFeeFrom: technologyFeeFirstMonth(operatingSince),
      through,
      rows: statementRows(territory.facts.revenue, operatingSince, through),
    },
  };
}
