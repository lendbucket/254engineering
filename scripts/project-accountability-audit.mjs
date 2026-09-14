/**
 * A PROJECT NO DOCUMENT ACCOUNTS FOR IS NAMED BY THE BOARD.
 *
 *   npx tsx scripts/project-accountability-audit.mjs
 *
 * WHY IT EXISTS
 * -------------
 * `docs/production-cutover-plan.md` said of `254engineering-rehearsal`, in
 * writing, "since deleted". Eleven days later that project was alive, billable,
 * and holding 239 audit events, 2 order payments, 1 profile and 1 service order.
 *
 * Nobody deleted it and nobody checked. Operator ruling, 2026-09-14: a document
 * that records a destructive action as done is a claim nothing supports unless
 * something checked, and any project in the organisation that no document
 * accounts for is named by the board.
 *
 * WHAT IT CAN SEE, AND THE HALF IT CANNOT
 * ----------------------------------------
 * It cannot list the organisation's projects. That needs a Supabase management
 * credential and standing law keeps those out of the working tree. This is the
 * same split `schema-ledger-audit` has always had, and the reasoning is the
 * same: the failure was not a wrong answer, it was a question nobody was made
 * to answer.
 *
 * So it asserts, with no credentials at all:
 *
 *   1. Every ref in the declaration is accounted for by a document that EXISTS
 *      and that actually NAMES it. A pointer at a document that does not mention
 *      the project is a pointer nobody can follow, which is the failure one
 *      level in.
 *   2. Every project ref that appears ANYWHERE in the tracked source is in the
 *      declaration. This is the reverse scan, and it is the half that catches a
 *      project somebody wired up without telling this file, exactly as the
 *      environment file scan catches a credential nothing reads.
 *   3. A retired project says when it was confirmed gone AND how. Intending to
 *      delete is not confirming.
 *   4. Nothing is declared twice, and no two entries share a ref.
 *
 * It prints the by hand command for the half it cannot do, rather than implying
 * it has done it.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PROJECTS, RETIRED, REFS } from "../supabase/projects.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========= A PROJECT NO DOCUMENT ACCOUNTS FOR =========");

/*
 * A Supabase project ref is exactly twenty lower case letters. Anchored on word
 * boundaries so it cannot match the middle of a hash, and the corpus is
 * filtered below so ordinary English words of that length do not count.
 */
const REF_PATTERN = /\b[a-z]{20}\b/g;

// ------------------------------------------------- 1. the declaration is sane

{
  const seen = new Set();
  const dupes = [];
  for (const p of [...PROJECTS, ...RETIRED]) {
    if (seen.has(p.ref)) dupes.push(p.ref);
    seen.add(p.ref);
  }
  rec(
    `every declared project is declared once (${REFS.length})`,
    dupes.length === 0,
    dupes.length ? `declared twice: ${dupes.join(", ")}` : "",
  );

  const shapeless = [...PROJECTS, ...RETIRED].filter(
    (p) => !/^[a-z]{20}$/.test(p.ref) || !p.name || !p.because || !p.status,
  );
  rec(
    "every declared project carries a ref, a name, a status and a reason",
    shapeless.length === 0,
    shapeless.length ? `incomplete: ${shapeless.map((p) => p.ref || "(no ref)").join(", ")}` : "",
  );
}

// -------------------------------------- 2. the document exists and names it

for (const p of PROJECTS) {
  const path = p.accountedFor;
  if (!existsSync(path)) {
    rec(`${p.name} is accounted for by ${path}`, false, "that document does not exist");
    continue;
  }
  const body = readFileSync(path, "utf8");
  const named = body.includes(p.ref) || body.includes(p.name);
  rec(
    `${p.name} is accounted for by ${path}, which names it`,
    named,
    named ? "" : `${path} exists and mentions neither ${p.ref} nor ${p.name}`,
  );
}

// ------------------------------------------------------- 3. retired says how

for (const r of RETIRED) {
  const complete = Boolean(r.confirmedGoneAt) && Boolean(r.confirmedHow);
  rec(
    `retired project ${r.name} says when it was confirmed gone and how`,
    complete,
    complete
      ? ""
      : "a retired project records the date it was READ BACK as absent and what read it. " +
        "Intending to delete it is not confirming it, which is the defect this whole check exists for",
  );
}
if (RETIRED.length === 0) {
  rec("no project is declared retired (0)", true, "nothing has been confirmed deleted, which is honest");
}

// ----------------------------------- 4. the reverse scan, over tracked source

{
  /*
   * THE SCAN RUNS FROM THE FILES RATHER THAN FROM THE DECLARATION, which is the
   * half that can find something nobody told this file about. The same shape as
   * the environment file scan: a check derived only from the declaration can
   * find what the declaration already knows.
   */
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|mjs|js|md|json|sql|yml|yaml)$/.test(f));

  /*
   * Twenty letter English words exist and a few are in this repository's prose.
   * A ref is only interesting where it appears in a SUPABASE context, so the
   * corpus is the lines that mention one, which is also what makes a finding
   * actionable: the check can print the line.
   */
  const found = new Map();
  for (const file of tracked) {
    let body;
    try {
      body = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!/supabase|project.?ref|PRODUCTION_REF/i.test(body)) continue;
    for (const line of body.split("\n")) {
      if (!/supabase\.co|supabase\.com|project|ref/i.test(line)) continue;
      for (const m of line.match(REF_PATTERN) ?? []) {
        if (!found.has(m)) found.set(m, `${file}: ${line.trim().slice(0, 100)}`);
      }
    }
  }

  const declared = new Set(REFS);
  /*
   * Twenty letter lower case words that are not refs. Listed rather than
   * pattern matched away, because a list somebody has to add to on purpose is
   * the mechanism, and a cleverer pattern would silently swallow a real ref.
   */
  const NOT_REFS = new Set([
    "responsibilities",
    "indistinguishable",
    "unrepresentable",
    "reconciliation",
  ]);

  const unaccounted = [...found.keys()].filter((r) => !declared.has(r) && !NOT_REFS.has(r));

  rec(
    `every project ref in the tracked source is declared (${found.size} found, ${declared.size} declared)`,
    unaccounted.length === 0,
    unaccounted.length
      ? unaccounted.map((r) => `${r} is not in supabase/projects.mjs -> ${found.get(r)}`).join(" | ")
      : "",
  );

  /*
   * The count is asserted rather than trusted. A scan that matched nothing would
   * pass this check silently while proving nothing, which is the vacuous green
   * this repository has been caught by before.
   */
  rec(
    "the reverse scan actually found refs to check",
    found.size > 0,
    found.size === 0
      ? "the scan matched no project ref anywhere, so the check above passed over an empty set"
      : "",
  );
}

// ------------------------------------------------------------------- verdict

console.log("");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}

const failed = out.filter((r) => !r.ok);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A Supabase project nobody accounts for is a database with the firm's data in it,");
  console.log("costing money, that no document explains and nobody is watching.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Every project this repository knows about is accounted for.`);
console.log("");
console.log("THIS CANNOT SEE THE ORGANISATION. It asserts that every project the REPOSITORY");
console.log("names is declared and explained; it cannot list what Supabase actually holds,");
console.log("because that needs a management credential and those stay out of the tree.");
console.log("For the other half, through the Supabase MCP, by hand:");
console.log("");
console.log("  list_projects, then compare every ref against supabase/projects.mjs");
console.log("");
console.log(`Declared: ${PROJECTS.length} live, ${RETIRED.length} retired.`);
