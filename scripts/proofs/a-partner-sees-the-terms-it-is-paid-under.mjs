/**
 * A PARTNER SEES THE TERMS IT IS PAID UNDER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-partner-sees-the-terms-it-is-paid-under.mjs
 *
 * Run item 20 of 2026-10-10, product audit gap 30: a partner could see what it
 * had earned and not the rate or holdback it was computed under. The partner
 * home now shows the terms in force, read through termsInForce (the read the
 * accrual itself uses), scoped by the session's own partner id; the model's
 * wording has one home, shared with the operator's screen.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const home = readFileSync("src/app/partner/(app)/page.tsx", "utf8");
check("the partner home reads the terms in force for the session's own partner", home.includes("termsInForce(principal.partner.id)"));
check("and shows the model, the figure and the holdback", home.includes("MODEL_LABEL[terms.model]") && home.includes("terms.holdbackDays"));
check("and says so when no terms are set, rather than showing nothing", home.includes("Your terms are not set yet"));

/* One home for the wording: each label appears once in src, in partner-comp.ts. */
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full.split("\\").join("/"));
  }
  return out;
};
const src = walk("src").map((f) => [f, readFileSync(f, "utf8")]);
for (const label of ["A percentage of the order", "A flat fee for each order", "A flat fee for each qualified lead", "A percentage that improves with volume"]) {
  const homes = src.filter(([, text]) => text.includes(`"${label}"`)).map(([f]) => f);
  check(`"${label}" has one home`, homes.length === 1 && homes[0] === "src/lib/partner-comp.ts", homes.join(", "));
}

/* Live: the read the panel makes, for development's demo partner. */
const { auditClient } = await import("../lib/db-target.mjs");
const db = auditClient("the partner terms proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so the live read was not made.");
} else {
  const { termsInForce } = await import("../../src/lib/ops-partner-comp.ts");
  const { data: demo } = await db.from("eng_partners").select("id").eq("code", "demo-title").maybeSingle();
  if (!demo) {
    console.log("  COULD NOT TELL: development holds no demo-title partner.");
  } else {
    const terms = await termsInForce(demo.id);
    check(
      "the demo partner's terms are read with a model and a holdback",
      terms !== null && typeof terms.model === "string" && Number.isInteger(terms.holdbackDays),
      terms ? `${terms.model}, held ${terms.holdbackDays} days` : "none",
    );
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a partner sees the terms it is paid under.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
