/**
 * THE CLOUD BOARD REFUSES TO RUN IF ANYTHING IT HOLDS LOOKS LIVE OR PRODUCTION.
 * Operator ruling, 2026-10-22: development secrets only, never a production or
 * live key, and the workflow refuses to run if any secret looks otherwise.
 *
 *   node scripts/ci/refuse-live.mjs [.env.local]
 *
 * It reads this process's environment AND the env file the app will read,
 * because the file is what the server and every audit actually load, and a
 * check of the job environment alone would pass over a production value written
 * into the file. It prints NAMES and reasons, never a value.
 *
 * WHAT IT REFUSES
 *   - SUPABASE_URL naming any project but development, or absent.
 *   - SUPABASE_SERVICE_ROLE_KEY that is not a JWT whose ref is development.
 *   - Any value carrying a declared project ref other than development's.
 *   - Any value shaped like a live Stripe key (secret, restricted or publishable).
 *   - A Stripe secret that is not a test key, and a webhook secret without one.
 *   - An email provider key: nothing on a board may send mail to a person.
 *   - Any production override flag, and Vercel's deployment identity.
 */
import { existsSync, readFileSync } from "node:fs";
import { DECLARED_REFS } from "../../supabase/projects.mjs";

const DEV_REF = "ythzaiqeoijlrdibnieo";
const file = process.argv[2] ?? null;

const fromFile = {};
if (file) {
  if (!existsSync(file)) {
    console.log(`REFUSED: ${file} does not exist, so there is nothing to check and nothing to run.`);
    process.exit(1);
  }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) fromFile[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const refusals = [];
const sources = [
  ["the job environment", process.env],
  [file ?? "(no file)", fromFile],
];

function payloadOf(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const OTHER_REFS = DECLARED_REFS.filter((r) => r !== DEV_REF);
if (OTHER_REFS.length < 3) refusals.push(`the declared project list read ${OTHER_REFS.length} non-development refs, too few to trust`);

for (const [where, env] of sources) {
  for (const [name, raw] of Object.entries(env)) {
    const value = String(raw ?? "");
    if (!value) continue;
    for (const ref of OTHER_REFS) {
      if (value.includes(ref)) refusals.push(`${name} in ${where} names a project other than development`);
    }
    if (/\b(sk|rk|pk)_live_/.test(value)) refusals.push(`${name} in ${where} is shaped like a live Stripe key`);
    if (value.startsWith("eyJ")) {
      const p = payloadOf(value);
      if (p && p.ref && p.ref !== DEV_REF) refusals.push(`${name} in ${where} is a token for a project other than development`);
    }
  }
  if ("RESEND_API_KEY" in env && env.RESEND_API_KEY) refusals.push(`RESEND_API_KEY is set in ${where}; a board sends no mail to people`);
  if (env.ALLOW_PRODUCTION_DB) refusals.push(`ALLOW_PRODUCTION_DB is set in ${where}`);
  if (env.ALLOW_PRODUCTION_PREVIEW) refusals.push(`ALLOW_PRODUCTION_PREVIEW is set in ${where}`);
  if (env.ALLOW_REAL_EMAIL_SENDS) refusals.push(`ALLOW_REAL_EMAIL_SENDS is set in ${where}`);
  if (env.VERCEL_OIDC_TOKEN || env.VERCEL_ENV || env.VERCEL_DEPLOYMENT_ID) {
    refusals.push(`a Vercel deployment identity is set in ${where}; the board is not a deployment`);
  }
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    refusals.push(`STRIPE_SECRET_KEY in ${where} is not a test key`);
  }
  if (env.STRIPE_WEBHOOK_SECRET && !(env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) {
    refusals.push(`STRIPE_WEBHOOK_SECRET in ${where} has no test key beside it to say which mode it belongs to`);
  }
}

if (file) {
  const url = fromFile.SUPABASE_URL ?? "";
  if (!url) refusals.push(`SUPABASE_URL is absent from ${file}`);
  else if (!url.includes(`${DEV_REF}.supabase.co`)) refusals.push(`SUPABASE_URL in ${file} is not the development project`);
  const key = fromFile.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const p = key.startsWith("eyJ") ? payloadOf(key) : null;
  if (!p) refusals.push(`SUPABASE_SERVICE_ROLE_KEY in ${file} is not a readable JWT, so its project cannot be checked`);
  else if (p.ref !== DEV_REF) refusals.push(`SUPABASE_SERVICE_ROLE_KEY in ${file} is not development's`);
}

const unique = [...new Set(refusals)];
if (unique.length) {
  console.log("REFUSED: the board will not run.");
  for (const r of unique) console.log(`  ${r}`);
  process.exit(1);
}
console.log(
  `Checked ${Object.keys(process.env).length} job variables and ${Object.keys(fromFile).length} in ${file ?? "no file"}: ` +
    "development only, nothing live, no mail provider, no production override.",
);
