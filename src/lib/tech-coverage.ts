import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { TEXAS_COUNTIES } from "./ops-counties";

/**
 * ===========================================================================
 * ADD A COUNTY TO A TECHNICIAN'S COVERAGE, IN ONE STEP. The Killeen call,
 * item 1 (Robert, 2026-11-14): "let an administrator add the county to a
 * technician's coverage ... in one step".
 * ===========================================================================
 *
 * Coverage was set when the account was made (createAccount) and nothing could
 * change it afterwards, so a job in a county nobody covered could only wait.
 * This adds ONE county to ONE field technician, named from the 254, and never
 * removes one: taking coverage away is a different decision with its own
 * consequences for open offers, and is not this button.
 *
 * profiles.update, the grant that changes somebody's record (administrator and
 * operations manager). The audit row is written first and a failure to write it
 * refuses the change (writeAuditOrRefuse), because who widened a technician's
 * territory, and when, is the question asked after a far-away job goes wrong.
 */
export async function addCoverageCounty(
  actor: (Actor & { email: string }) | null,
  techId: string,
  county: string,
): Promise<{ ok: true; counties: string[]; already: boolean } | { ok: false; error: string }> {
  if (!actor || !can(actor, "profiles.update")) return { ok: false, error: "Only an administrator or operations manager changes a technician's coverage." };
  const named = TEXAS_COUNTIES.find((c) => c.toLowerCase() === county.trim().toLowerCase());
  if (!named) return { ok: false, error: `"${county}" is not one of the 254 Texas counties.` };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: tech, error: readError } = await db
    .from("eng_profiles")
    .select("id, display_name, role, coverage_counties")
    .eq("id", techId)
    .maybeSingle();
  if (readError) return { ok: false, error: `The technician could not be read: ${readError.message}` };
  if (!tech || tech.role !== "field_tech") return { ok: false, error: "That is not a field technician." };

  const current = ((tech.coverage_counties as string[] | null) ?? []).filter(Boolean);
  if (current.some((c) => c.toLowerCase() === named.toLowerCase())) return { ok: true, counties: current, already: true };
  const next = [...current, named];

  const audited = await writeAuditOrRefuse({
    actor,
    action: "profile.coverage_added",
    entityType: "profile",
    entityId: techId,
    summary: `${named} County added to ${tech.display_name as string}'s coverage`,
    diff: { coverage_counties: { from: current, to: next } },
  });
  if (!audited.ok) return { ok: false, error: audited.error };

  /*
   * A plain write of the list read above. Two administrators adding different
   * counties to the same technician in the same second could lose one; that is
   * not guarded, because a whole-array comparison through PostgREST is not one
   * this code has proven, and an unproven guard is worse than none. The audit
   * rows above record both adds, so a lost one is visible.
   */
  const { data: written, error: writeError } = await db
    .from("eng_profiles")
    .update({ coverage_counties: next })
    .eq("id", techId)
    .select("id");
  if (writeError) return { ok: false, error: `The coverage could not be saved: ${writeError.message}` };
  if (!written?.length) return { ok: false, error: "The technician could not be found to save their coverage." };
  return { ok: true, counties: next, already: false };
}
