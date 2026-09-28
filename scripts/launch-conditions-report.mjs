/**
 * EVERY LAUNCH CONDITION, MET OR UNMET, READ FROM THE GATE ITSELF.
 *
 * Operator order, 2026-09-28, item 1: report before changing anything.
 *
 * IT IMPORTS THE GATE RATHER THAN RESTATING IT. An audit that types its own
 * copy of the condition list is a second account of the gate, and this
 * repository's most frequent defect is one fact with two homes. What this adds
 * is the reading, not the list.
 *
 * TWO CONDITIONS ARE ANSWERED BY THE ENVIRONMENT AND ARE MARKED AS SUCH.
 * `switch` reads LAUNCH_MODE and `phone` reads FIRM_PHONE, so their answer here
 * is the answer for THIS process, which is the one `next build` would get from
 * the same `.env.local`. On Vercel both come from the project's environment and
 * can differ. Saying which world was measured is the rule launch-audit already
 * follows, and a report that quietly reported one world as the world would be
 * the ambient-state defect wearing a launch gate.
 *
 *   npx tsx scripts/launch-conditions-report.mjs
 */
process.loadEnvFile?.(".env.local");

const { LAUNCH_CONDITIONS, launchMode, isPrelaunch, isTrading, isOpen, tradingBlockers, openBlockers } =
  await import("../src/lib/launch.ts");

/* Which conditions read the process environment rather than a file in the
 * repository. Named explicitly, because "met" means something different for
 * these two. */
const FROM_ENVIRONMENT = new Set(["switch", "phone"]);

const rows = LAUNCH_CONDITIONS.map((c) => {
  const unmet = c.unmet();
  return {
    id: c.id,
    gates: c.gates,
    met: unmet === null,
    why: unmet,
    what: c.what,
    statedIn: c.statedIn,
    whoClears: c.whoClears,
  };
});

console.log("");
console.log("============ THE LAUNCH GATE, AS THIS PROCESS READS IT ============");
console.log(`mode: ${launchMode()}   prelaunch ${isPrelaunch()}   trading ${isTrading()}   open ${isOpen()}`);
console.log(`${rows.length} conditions declared`);
console.log("");

for (const r of rows) {
  const env = FROM_ENVIRONMENT.has(r.id) ? "  [from the environment]" : "";
  console.log(`${r.met ? "MET  " : "UNMET"}  ${r.id.padEnd(22)} gates ${String(r.gates).padEnd(9)}${env}`);
  if (!r.met) console.log(`         ${r.why}`);
}

console.log("");
console.log(`trading blockers: ${tradingBlockers().length}`);
console.log(`open blockers:    ${openBlockers().length}`);
console.log("");
console.log("unmet, by what gate they hold:");
for (const gate of ["trading", "open", "naming"]) {
  const held = rows.filter((r) => !r.met && r.gates === gate);
  console.log(`  ${gate.padEnd(9)} ${held.length ? held.map((r) => r.id).join(", ") : "none"}`);
}

console.log("");
console.log("who clears each unmet one, and where it is stated:");
for (const r of rows.filter((x) => !x.met)) {
  console.log(`  ${r.id}`);
  console.log(`      ${r.whoClears}`);
  console.log(`      stated in ${r.statedIn}`);
}
