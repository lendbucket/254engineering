/**
 * The guard the deployed app was missing.
 *
 * WHAT HAPPENED, TWICE, IN TWO DAYS
 * ---------------------------------
 * scripts/lib/db-target.mjs has guarded every SCRIPT since the two databases
 * were split: it owns client construction, so the only way a script gets a
 * connection is through the check, and pointing one at production takes a
 * deliberate environment variable.
 *
 * The deployed application had no such guard. It read SUPABASE_URL from its
 * environment and believed it.
 *
 * FAULT ONE, 2026-09-03 morning. A preview deployment of an unmerged branch was
 * pushed for the operator to walk. Vercel previews inherit the Preview
 * environment, and adding a variable to a Vercel project defaults to All
 * Environments, so the preview inherited the production values. The operator's
 * sign in attempt landed in PRODUCTION's audit trail, where it remains, because
 * that table refuses deletes by design.
 *
 * Nothing worse happened only because the demo accounts do not exist in
 * production and the sign in failed. Had it succeeded, walking the preview would
 * have written real tasks, threads, messages and notifications into the firm's
 * database, and any review taken would have written append only responsible
 * charge rows that can never be removed.
 *
 * FAULT TWO, the same afternoon, and it is the mirror image. Production's
 * service role key was wrong, so the portal was down. While correcting it the
 * URL was left pointing at DEVELOPMENT, and for a few minutes production wrote
 * into the development database. One probe row landed there before it was
 * caught, and it was caught only because the verification checked both
 * databases rather than the one it expected to change.
 *
 * The first fault had a guard by then. The second did not, because the guard
 * only ever asked one question. Now it asks both.
 *
 * WHY THE CHECKS ARE THIS NARROW
 * ------------------------------
 * Each trips on exactly one shape:
 *
 *   preview_on_production   Vercel says preview, and the database is production.
 *   production_on_other     Vercel says production, and the database is not.
 *
 * A local machine reports no VERCEL_ENV and is never affected by either. A
 * Vercel "development" deployment is never affected. A deployment with no
 * database configured is never affected, because unconfigured is a different
 * fault with a different message and firing here would bury it.
 *
 * That narrowness is deliberate and it is the whole design. A guard that could
 * misfire on production would be a worse defect than the ones it prevents, so
 * neither fires unless both halves are unambiguous, and db-guard-audit asserts
 * the negative cases harder than the positive ones.
 */

/** The production project reference, written down as it is in db-target.mjs. */
export const PRODUCTION_REF = "fsaryeciduszuahgjbly";
export const DEVELOPMENT_REF = "ythzaiqeoijlrdibnieo";

/**
 * What a production deployment must be pointed at.
 *
 * An alias rather than a second value, on purpose. Two constants holding one
 * project reference is two things that can disagree, and the disagreement would
 * be silent. This exists because the assertion reads better with the intent in
 * the name: production is not merely "the production ref", it is the ref a
 * production deployment is EXPECTED to have, and anything else is the fault.
 */
export const PRODUCTION_EXPECTED_REF = PRODUCTION_REF;

export function refOf(url: string | undefined | null): string | null {
  const match = String(url ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

export type GuardEnv = {
  VERCEL_ENV?: string;
  /**
   * Set by Vercel at RUNTIME only, and that is the whole reason it is here.
   * See onAVercelDeployment below.
   */
  VERCEL_DEPLOYMENT_ID?: string;
  SUPABASE_URL?: string;
  ALLOW_PRODUCTION_PREVIEW?: string;
  ALLOW_PRODUCTION_ON_OTHER_DB?: string;
};

/**
 * Are we actually running as a Vercel deployment, rather than on a laptop that
 * has a copy of a Vercel environment?
 *
 * WHY THIS EXISTS, AND IT IS NOT A THEORETICAL CONCERN
 * ---------------------------------------------------
 * VERCEL_ENV is not proof of anything. `vercel env pull` writes the project's
 * configured variables into .env.local, and this repository's .env.local
 * contains VERCEL_ENV="production" for exactly that reason. So "VERCEL_ENV is
 * production" is true on the operator's machine while it points at development,
 * which is the correct and normal state for local work.
 *
 * The first version of productionPointingElsewhere trusted VERCEL_ENV alone. It
 * fired on the developer machine immediately, refused every local database
 * connection, and would have broken every audit in the harness. It was caught
 * by running the health probe locally and seeing it answer 503.
 *
 * VERCEL_DEPLOYMENT_ID is set by the platform at runtime and is not written by
 * `vercel env pull`, so it separates "a real deployment" from "a machine
 * holding a deployment's variables".
 *
 * THE FAILURE DIRECTION IS DELIBERATE
 * -----------------------------------
 * If Vercel ever stops setting VERCEL_DEPLOYMENT_ID, this returns false and the
 * production guard silently stops guarding. That is a fail open, and it is the
 * right direction for a check that can take the firm's production portal down:
 * a guard that wrongly refuses production is a worse outage than the one it
 * prevents. BACKLOG records it as a known fragility rather than pretending the
 * signal is guaranteed.
 */
function onAVercelDeployment(env: GuardEnv): boolean {
  return typeof env.VERCEL_DEPLOYMENT_ID === "string" && env.VERCEL_DEPLOYMENT_ID.length > 0;
}

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

/**
 * Is this the production deployment talking to something that is not production?
 *
 * IT MUST BE AN ACTUAL DEPLOYMENT, NOT A MACHINE THAT PULLED THE VARIABLES
 * ------------------------------------------------------------------------
 * See onAVercelDeployment. .env.local in this repository carries
 * VERCEL_ENV="production", so without that check this fires on the operator's
 * own laptop and refuses every local database connection. It did.
 *
 * THE ORDER OF THESE CHECKS IS THE SAFETY PROPERTY
 * ------------------------------------------------
 * The correct case exits first and exits on a positive identification, not on
 * the absence of a problem. A production deployment pointed at the production
 * ref returns false at line three and never reaches any other condition, so no
 * later edit to this function can make it fire on a healthy production
 * deployment without deleting that line.
 *
 * An unset or unparseable SUPABASE_URL returns false as well. That is not a
 * deployment pointed at the wrong database, it is one pointed at no database,
 * and supabaseConfigured already has a message for it. Firing here would
 * replace a clear "not configured" with a confusing "pointed at development".
 *
 * Everything else, meaning a real Supabase project that is not the firm's
 * production project, fires. Development is the case that actually happened and
 * it is not special cased: a production deployment pointed at a third project
 * nobody recognises is just as wrong and gets the same refusal.
 */
export function productionPointingElsewhere(env: GuardEnv = process.env as GuardEnv): boolean {
  if (env.VERCEL_ENV !== "production") return false;
  if (!onAVercelDeployment(env)) return false;

  const ref = refOf(env.SUPABASE_URL);
  if (ref === PRODUCTION_EXPECTED_REF) return false;
  if (ref === null) return false;

  if (env.ALLOW_PRODUCTION_ON_OTHER_DB === "1") return false;
  return true;
}

// --------------------------------------------------------------- the messages

export type MispointingKind = "preview_on_production" | "production_on_other";

export type Mispointing = {
  kind: MispointingKind;
  headline: string;
  explanation: string;
  fix: string;
  /** The one variable that opens the door, and what it costs. */
  hatch: string;
  hatchNote: string;
};

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

const PREVIEW_ON_PRODUCTION: Mispointing = {
  kind: "preview_on_production",
  headline: GUARD_HEADLINE,
  explanation: GUARD_EXPLANATION,
  fix: GUARD_FIX,
  hatch: "ALLOW_PRODUCTION_PREVIEW",
  hatchNote:
    "It is spelled exactly, so anything else is a refusal, and it is almost never the right " +
    "answer: a preview is an unmerged branch, and an unmerged branch writing to the firm's " +
    "records is how a test becomes a permanent row.",
};

export const PRODUCTION_GUARD_HEADLINE =
  "This production deployment is pointed at the wrong database";

export const PRODUCTION_GUARD_EXPLANATION =
  "Production is serving from a Supabase project that is not the firm's production project. Real " +
  "clients, files and portal accounts are not in the database this deployment can see, and " +
  "anything done here would be written somewhere it does not belong. The application has refused " +
  "to open a database connection rather than let that happen.";

export const PRODUCTION_GUARD_FIX =
  `In the Vercel project settings, set SUPABASE_URL scoped to Production only to ` +
  `https://${PRODUCTION_EXPECTED_REF}.supabase.co, and SUPABASE_SERVICE_ROLE_KEY scoped to ` +
  `Production only to that same project's service role key. Both halves have to move together: ` +
  `correcting the key while the url still points elsewhere is what produced this, and it turns an ` +
  `outage into production writing to the wrong records, which is worse. Then redeploy.`;

const PRODUCTION_ON_OTHER: Mispointing = {
  kind: "production_on_other",
  headline: PRODUCTION_GUARD_HEADLINE,
  explanation: PRODUCTION_GUARD_EXPLANATION,
  fix: PRODUCTION_GUARD_FIX,
  hatch: "ALLOW_PRODUCTION_ON_OTHER_DB",
  hatchNote:
    "It is spelled exactly, so anything else is a refusal. There is almost no legitimate reason " +
    "to run the production hostname against another database, and a migration to a new project " +
    "should change PRODUCTION_REF in a reviewed commit rather than be waved through here.",
};

/**
 * The one function both layers ask.
 *
 * Returns the fault or null. Callers do not need to know there are two kinds,
 * which is what stops a third one being added in six months and enforced in
 * only one of the two places that matter.
 */
export function mispointing(env: GuardEnv = process.env as GuardEnv): Mispointing | null {
  if (previewPointingAtProduction(env)) return PREVIEW_ON_PRODUCTION;
  if (productionPointingElsewhere(env)) return PRODUCTION_ON_OTHER;
  return null;
}

/** The error a caller sees if it reaches for a client anyway. */
export function guardError(fault: Mispointing = PREVIEW_ON_PRODUCTION): Error {
  return new Error(`${fault.headline}. ${fault.explanation} ${fault.fix}`);
}
