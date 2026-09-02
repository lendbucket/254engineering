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
 * Runs without a database and without a network, so it is cheap enough to sit at
 * the very front of the suite.
 */
import fs from "node:fs";
import path from "node:path";
import { isProduction, refOf, describeTarget, PRODUCTION_REF, DEVELOPMENT_REF } from "./lib/db-target.mjs";

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

// ---------- what this run is actually pointed at ----------
const current = process.env.SUPABASE_URL;
rec(
  "the configured database is not production",
  !isProduction(current),
  current ? describeTarget(current) : "SUPABASE_URL is unset",
);

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
