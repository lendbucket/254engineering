/**
 * The guard the deployed app was missing.
 *
 * WHAT HAPPENED
 * -------------
 * scripts/lib/db-target.mjs has guarded every SCRIPT since the two databases
 * were split: it owns client construction, so the only way a script gets a
 * connection is through the check, and pointing one at production takes a
 * deliberate environment variable.
 *
 * The deployed application had no such guard. It read SUPABASE_URL from its
 * environment and believed it.
 *
 * On 2026-09-03 a preview deployment of an unmerged branch was pushed for the
 * operator to walk. Vercel previews inherit the Preview environment, and adding
 * a variable to a Vercel project defaults to All Environments, so the preview
 * inherited the production values. The operator's sign in attempt landed in
 * PRODUCTION's audit trail, where it remains, because that table refuses
 * deletes by design.
 *
 * Nothing worse happened only because the demo accounts do not exist in
 * production and the sign in failed. Had it succeeded, walking the preview would
 * have written real tasks, threads, messages and notifications into the firm's
 * database, and any review taken would have written append only responsible
 * charge rows that can never be removed.
 *
 * WHY THE CHECK IS THIS NARROW
 * ----------------------------
 * It trips on exactly one combination: Vercel says this is a preview, and the
 * database is the production project. Production itself reports
 * VERCEL_ENV=production and is never affected. A local machine reports nothing
 * and is never affected. A preview pointed at development is the correct state
 * and is never affected.
 *
 * That narrowness is deliberate and it is the whole design. A guard that could
 * misfire on production would be a worse defect than the one it prevents, so it
 * refuses to fire unless both halves are unambiguous.
 */

/** The production project reference, written down as it is in db-target.mjs. */
export const PRODUCTION_REF = "fsaryeciduszuahgjbly";
export const DEVELOPMENT_REF = "ythzaiqeoijlrdibnieo";

export function refOf(url: string | undefined | null): string | null {
  const match = String(url ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

export type GuardEnv = {
  VERCEL_ENV?: string;
  SUPABASE_URL?: string;
  ALLOW_PRODUCTION_PREVIEW?: string;
};

/**
 * Is this a preview deployment talking to the production database?
 *
 * The escape hatch is spelled out rather than truthy checked, exactly as
 * ALLOW_PRODUCTION_DB is for scripts, so "0", "false", "no" and "true" are all
 * refusals and there is one string that opens the door. It exists because a
 * deliberate read only verification against production from a preview is a
 * thing somebody might one day genuinely need, and a guard with no documented
 * way past it gets removed rather than configured.
 */
export function previewPointingAtProduction(env: GuardEnv = process.env as GuardEnv): boolean {
  if (env.VERCEL_ENV !== "preview") return false;
  if (refOf(env.SUPABASE_URL) !== PRODUCTION_REF) return false;
  if (env.ALLOW_PRODUCTION_PREVIEW === "1") return false;
  return true;
}

/** What to tell whoever is looking at it. One message, used by both layers. */
export const GUARD_HEADLINE = "This preview is pointed at the production database";

export const GUARD_EXPLANATION =
  "A preview deployment inherited the production Supabase project, which means anything done here " +
  "would write to the firm's real records rather than to development. The application has refused " +
  "to open a database connection rather than let that happen.";

export const GUARD_FIX =
  "In the Vercel project settings, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY scoped to the " +
  "Preview environment only, pointed at the development project, then redeploy this branch. " +
  "OPS_SESSION_SECRET needs a Preview value too.";

/** The error a caller sees if it reaches for a client anyway. */
export function guardError(): Error {
  return new Error(`${GUARD_HEADLINE}. ${GUARD_EXPLANATION} ${GUARD_FIX}`);
}
