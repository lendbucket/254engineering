/**
 * Writes the runner's .env.local from the job environment, which the workflow
 * fills from GitHub encrypted secrets and repository variables for this one
 * step. Prints names only.
 *
 * The list is the set of names this repository's own .env.local carries for the
 * app and the audits, minus everything `vercel env pull` adds about a
 * deployment: the board is not a deployment, and refuse-live.mjs refuses a
 * Vercel identity outright. A name missing from the job is a refusal, because a
 * board run without, say, MFA_ENCRYPTION_KEY measures a different app.
 */
import { writeFileSync } from "node:fs";

const NAMES = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPS_SESSION_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "PARTNER_SESSION_SECRET",
  "MFA_ENCRYPTION_KEY",
  "INTAKE_KEY_SEALED",
  "INTAKE_KEY_STAMP",
  "LAUNCH_MODE",
  "NEXT_PUBLIC_SITE_URL",
  "FIRM_PHONE",
];

const missing = NAMES.filter((n) => !process.env[n]);
if (missing.length) {
  console.log(`REFUSED: not set for this step: ${missing.join(", ")}. Nothing was written.`);
  process.exit(1);
}
const body = NAMES.map((n) => `${n}="${process.env[n]}"`).join("\n") + "\n";
writeFileSync(".env.local", body, { mode: 0o600 });
console.log(`Wrote .env.local with ${NAMES.length} names: ${NAMES.join(", ")}.`);
