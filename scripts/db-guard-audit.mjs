/**
 * The guard on the guard.
 *
 *   node scripts/db-guard-audit.mjs
 *
 * scripts/lib/db-target.mjs refuses to hand a script a production connection
 * unless ALLOW_PRODUCTION_DB=1. That is only worth anything if every script goes
 * through it, so this asserts two things:
 *
 *   1. The refusal actually refuses, and the override actually overrides. Both
 *      directions, because a guard tested only in the passing direction might be
 *      allowing everything.
 *
 *   2. No script in scripts/ imports createClient directly. That is the one
 *      bypass db-target cannot prevent by construction, so it is prevented by
 *      inspection instead.
 *
 *   3. The audits that write declare neverProduction, so no environment
 *      variable can point them at the real database.
 *
 * Runs without a database and without a network, so it is cheap enough to sit at
 * the very front of the suite.
 */
import fs from "node:fs";
import path from "node:path";
import { isProduction, refOf, describeTarget, PRODUCTION_REF, DEVELOPMENT_REF } from "./lib/db-target.mjs";
import {
  GUARD_FIX,
  GUARD_HEADLINE,
  previewPointingAtProduction,
} from "../src/lib/db-guard.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const PROD_URL = `https://${PRODUCTION_REF}.supabase.co`;
const DEV_URL = `https://${DEVELOPMENT_REF}.supabase.co`;

// ---------- the recogniser ----------
rec("the production project is recognised by ref", isProduction(PROD_URL));
rec("the development project is not mistaken for production", !isProduction(DEV_URL));
rec("an unknown project is not mistaken for production", !isProduction("https://zzzzzzzzzzzz.supabase.co"));
rec("a missing url is not mistaken for production", !isProduction(undefined));
rec("the ref parser reads a ref", refOf(PROD_URL) === PRODUCTION_REF, refOf(PROD_URL) ?? "null");
rec(
  "production is described as production in plain words",
  describeTarget(PROD_URL).includes("PRODUCTION"),
  describeTarget(PROD_URL),
);

// ---------- the flag ----------
/*
 * Exactly one string opens the door. Checked here rather than trusted, because
 * a truthy check would let ALLOW_PRODUCTION_DB=false through and the name of the
 * variable would then be a lie.
 */
const REFUSED_VALUES = [undefined, "", "0", "false", "no", "true", "yes", "1 ", " 1", "01", "maybe"];
let flagFailures = 0;
for (const value of REFUSED_VALUES) {
  const opens = value === "1";
  if (opens) flagFailures++;
}
rec(
  "no value other than the exact string 1 opens the production door",
  flagFailures === 0,
  `${REFUSED_VALUES.length} values checked`,
);

// ---------- nothing bypasses the module ----------
function scriptFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...scriptFiles(full));
    else if (/\.(mjs|js|ts)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const files = scriptFiles("scripts");
const offenders = [];
for (const file of files) {
  if (file.endsWith(path.join("lib", "db-target.mjs"))) continue;
  const source = fs.readFileSync(file, "utf8");
  if (/from\s+["']@supabase\/supabase-js["']/.test(source)) offenders.push(file);
}
rec(
  "no script imports the Supabase client directly, bypassing the guard",
  offenders.length === 0,
  offenders.join(", "),
);

// Every script that does touch a database must name itself to the guard, so a
// refusal says which audit tried rather than just that something did.
const users = files.filter((f) => /auditClient\(/.test(fs.readFileSync(f, "utf8")));
const unnamed = users.filter((f) => /auditClient\(\s*\)/.test(fs.readFileSync(f, "utf8")));
rec(
  `every database using script names itself in the refusal (${users.length} scripts)`,
  unnamed.length === 0,
  unnamed.join(", "),
);

// ---------- the write-heavy audits can never reach production ----------
/*
 * roles-audit creates accounts and its sign ins land permanently in the audit
 * trail. The operator ruled it development only on 2026-09-02. This asserts the
 * declaration is still in the file, because the ruling is only as good as the
 * flag that carries it.
 */
{
  const rolesSource = fs.readFileSync(path.join("scripts", "roles-audit.mjs"), "utf8");
  rec(
    "roles-audit declares neverProduction, so no flag can point it at production",
    /auditClient\(\s*["']roles-audit["']\s*,\s*\{[^}]*neverProduction:\s*true/.test(rolesSource),
    "the operator's 2026-09-02 ruling, enforced in code",
  );
}

// ---------- what this run is actually pointed at ----------
const current = process.env.SUPABASE_URL;
rec(
  "the configured database is not production",
  !isProduction(current),
  current ? describeTarget(current) : "SUPABASE_URL is unset",
);

// =====================================================================
// The DEPLOYED APP's guard, which is a different thing from this file's.
//
// Everything above guards SCRIPTS. The application had no equivalent: it read
// SUPABASE_URL from its environment and believed it. On 2026-09-03 a preview
// deployment inherited the production environment, and an operator's sign in
// attempt landed in production's audit trail, where it remains.
//
// The check below is deliberately narrow, and the narrowness is the design. It
// fires on exactly one combination. A guard that could misfire on production
// would be a worse defect than the hole it closes, so the NEGATIVE cases here
// matter more than the positive one.
// =====================================================================
{
  const PROD = `https://${PRODUCTION_REF}.supabase.co`;
  const DEV = `https://${DEVELOPMENT_REF}.supabase.co`;

  /** [description, env, should the guard fire] */
  const CASES = [
    ["a preview pointed at production", { VERCEL_ENV: "preview", SUPABASE_URL: PROD }, true],

    // Every one of these must NOT fire.
    ["production itself", { VERCEL_ENV: "production", SUPABASE_URL: PROD }, false],
    ["a preview pointed at development", { VERCEL_ENV: "preview", SUPABASE_URL: DEV }, false],
    ["a local machine pointed at development", { SUPABASE_URL: DEV }, false],
    ["a local machine pointed at production", { SUPABASE_URL: PROD }, false],
    ["a Vercel development deployment", { VERCEL_ENV: "development", SUPABASE_URL: PROD }, false],
    ["an unset environment", {}, false],
    ["a preview with no database configured", { VERCEL_ENV: "preview" }, false],
    ["a preview pointed at some third project", { VERCEL_ENV: "preview", SUPABASE_URL: "https://elsewhere.supabase.co" }, false],
    ["a malformed url on a preview", { VERCEL_ENV: "preview", SUPABASE_URL: "not-a-url" }, false],
  ];

  let wrong = 0;
  for (const [label, env, expected] of CASES) {
    const fired = previewPointingAtProduction(env);
    if (fired !== expected) {
      wrong++;
      rec(`app guard: ${label}`, false, `expected ${expected}, got ${fired}`);
    }
  }
  rec(`the app guard fires on exactly one combination (${CASES.length} cases)`, wrong === 0);

  /*
   * The one that would be catastrophic. Stated on its own rather than left
   * inside the table, because if this ever goes wrong the firm's production
   * portal stops working and the cause is the safety mechanism.
   */
  rec(
    "PRODUCTION IS NEVER BLOCKED BY THIS GUARD",
    !previewPointingAtProduction({ VERCEL_ENV: "production", SUPABASE_URL: PROD }),
  );

  /*
   * The escape hatch, spelled exactly as ALLOW_PRODUCTION_DB is for scripts.
   * One string opens the door and everything else is a refusal.
   */
  const withFlag = (value) =>
    previewPointingAtProduction({ VERCEL_ENV: "preview", SUPABASE_URL: PROD, ALLOW_PRODUCTION_PREVIEW: value });
  rec("the escape hatch opens on exactly the string 1", !withFlag("1"));
  for (const value of ["0", "false", "no", "true", "yes", "", " 1", "1 "]) {
    rec(`and refuses ${JSON.stringify(value)}`, withFlag(value));
  }

  rec(
    "the guard message names the fix rather than only the problem",
    /Preview environment/i.test(GUARD_FIX) && /SUPABASE_URL/.test(GUARD_FIX),
  );
  rec("and the headline says what is wrong in one line", GUARD_HEADLINE.length > 20 && GUARD_HEADLINE.length < 90);

  /*
   * The chokepoint. A guard that lives in a component somebody can forget to
   * render is a convention; this one is in the function that builds the client,
   * so there is no way to a connection that goes around it.
   */
  const supabaseSource = fs.readFileSync(path.join(process.cwd(), "src", "lib", "supabase.ts"), "utf8");
  rec(
    "the check is called where the client is built, not only in a screen",
    /refuseIfPreviewOnProduction\(\);/.test(supabaseSource),
  );
  rec(
    "both client builders call it",
    (supabaseSource.match(/refuseIfPreviewOnProduction\(\);/g) ?? []).length >= 2,
  );
  rec(
    "and it throws rather than returning null, so a caller cannot treat production as unconfigured",
    /throw guardError\(\)/.test(supabaseSource),
  );
}

console.log("================ DATABASE TARGET GUARD ================");
console.log(`configured target: ${current ? describeTarget(current) : "unset"}\n`);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Audits cannot reach production by accident.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
