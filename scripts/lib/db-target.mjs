/**
 * The production guard. Every script that opens a database connection goes
 * through here, and it fails closed.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until 2026-09-02 there was one Supabase project and both the site and its
 * audits pointed at it. That meant every audit run wrote to production: the
 * roles audit created accounts there, the mobile audit signed a probe in there,
 * and the forms audit had already once filled production tables with thirty rows
 * while reporting green.
 *
 * There are now two projects. This module is what makes the separation real
 * rather than a convention, because a convention is one forgotten export away
 * from being nothing.
 *
 * HOW IT FAILS
 * ------------
 * Closed. If SUPABASE_URL points at the production project and
 * ALLOW_PRODUCTION_DB is not exactly "1", the script exits before a client is
 * ever constructed. Not a warning, not a prompt: an exit, naming the project it
 * refused and how to override it deliberately.
 *
 * The flag defaults off and is spelled out rather than truthy-checked, so
 * ALLOW_PRODUCTION_DB=0, =false, =no, and =maybe are all refusals. There is
 * exactly one string that opens the door.
 *
 * AND FOR SOME SCRIPTS, NO STRING OPENS IT
 * ----------------------------------------
 * ALLOW_PRODUCTION_DB exists for the handful of things that legitimately belong
 * against production: seeding the first administrator, mainly. It does NOT exist
 * for audits that write.
 *
 * roles-audit creates three accounts, signs them in, attempts escalations, and
 * deletes them. The deletions are verified, but the audit trail rows are
 * permanent because that table refuses deletes by design, so a single run leaves
 * probe sign ins in the firm's regulatory memory forever. The operator ruled on
 * 2026-09-02 that it runs against development only, never production, and that
 * the flag must not be able to override the ruling.
 *
 * So `neverProduction` is a property of the CALLER, checked before the flag is
 * even looked at. A future session that sets ALLOW_PRODUCTION_DB=1 and runs the
 * roles audit gets a refusal explaining why, rather than a green run and a
 * permanent mess.
 *
 * WHY THE CLIENT IS BUILT HERE RATHER THAN CHECKED HERE
 * -----------------------------------------------------
 * A guard you have to remember to call is a guard that will be forgotten by the
 * next script. This module owns client construction, so the only way to get a
 * connection is through the check. A script that imports createClient directly
 * is the one thing this cannot stop, and scripts/db-guard-audit.mjs greps for
 * exactly that.
 */
import { createClient } from "@supabase/supabase-js";

/**
 * The production project reference, written down.
 *
 * Recognising production by its ref rather than by "is it not the dev one"
 * means a third project, a restored snapshot, or a typo in the dev URL is
 * treated as unknown rather than as safe.
 */
export const PRODUCTION_REF = "fsaryeciduszuahgjbly";
export const DEVELOPMENT_REF = "ythzaiqeoijlrdibnieo";

export function refOf(url) {
  const m = String(url ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

export function isProduction(url) {
  return refOf(url) === PRODUCTION_REF;
}

/** Human readable, for an audit's own output. */
export function describeTarget(url) {
  const ref = refOf(url);
  if (!ref) return "an unrecognised database";
  if (ref === PRODUCTION_REF) return `PRODUCTION (${ref})`;
  if (ref === DEVELOPMENT_REF) return `development (${ref})`;
  return `an unknown project (${ref})`;
}

/**
 * A service role client for a script, or a hard exit.
 *
 * `purpose` appears in the refusal so the operator can see which audit tried.
 */
export function auditClient(purpose = "this script", options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  /*
   * Checked FIRST, and deliberately not reachable by the flag. See the note
   * above: this is a standing ruling, not a default.
   */
  if (options.neverProduction && isProduction(url)) {
    console.error("");
    console.error("=".repeat(72));
    console.error("REFUSED: this audit never runs against production.");
    console.error("=".repeat(72));
    console.error("");
    console.error(`  ${purpose} writes to the database. It creates accounts, signs them in,`);
    console.error("  and deletes them again. The deletions work; the audit trail rows do not");
    console.error("  go away, because that table refuses deletes by design.");
    console.error("");
    console.error("  One run against production leaves probe sign ins in the firm's");
    console.error("  regulatory memory permanently. The operator ruled on 2026-09-02 that");
    console.error("  this audit runs against development only.");
    console.error("");
    console.error("  ALLOW_PRODUCTION_DB does not override this and is not meant to.");
    console.error("  Point SUPABASE_URL at the development project.");
    console.error("");
    process.exit(1);
  }

  if (isProduction(url) && process.env.ALLOW_PRODUCTION_DB !== "1") {
    console.error("");
    console.error("=".repeat(72));
    console.error("REFUSED: this database is production.");
    console.error("=".repeat(72));
    console.error("");
    console.error(`  ${purpose} tried to connect to ${describeTarget(url)}.`);
    console.error("");
    console.error("  Audits create accounts, sign them in, and delete them again. Doing that");
    console.error("  against production writes rows the firm has to explain later, and the");
    console.error("  audit trail keeps them permanently because that table refuses deletes.");
    console.error("");
    console.error("  Point SUPABASE_URL at the development project instead. It carries the");
    console.error("  same schema, verified by fingerprint, and no real data.");
    console.error("");
    console.error("  If you genuinely mean production, and you almost never do:");
    console.error("    ALLOW_PRODUCTION_DB=1 <command>");
    console.error("");
    process.exit(1);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "254engineering-audit" } },
  });
}
