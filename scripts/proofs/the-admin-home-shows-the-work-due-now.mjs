/**
 * THE ADMINISTRATOR'S HOME SHOWS THE WORK DUE NOW, COUNTED AS THE DESK COUNTS IT.
 *
 *   node scripts/proofs/the-admin-home-shows-the-work-due-now.mjs
 *
 * Office ready, operator ruling of 2026-10-20: "A home screen per role showing
 * the work due now: new inquiries, unassigned jobs, follow-ups due, refund
 * requests and holds." The 2026-10-24 survey found the desk's home met it and
 * the administrator's carried none of the five. dashboards-audit, which runs
 * these against a database, is a writer and runs in the cloud board; this
 * reads the source for the four things that matter.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const dash = readFileSync("src/lib/ops-dashboard.ts", "utf8");
const desk = readFileSync("src/lib/staff-desk.ts", "utf8");
const home = readFileSync("src/app/portal/(app)/page.tsx", "utf8");
check(
  "the administrator's due tiles are the desk's own, from deskDashboard, so the two homes count one way",
  /if \(can\(actor, "crm\.use"\)\) \{\s*const desk = await deskDashboard\(actor\);\s*due = desk\.tiles;/.test(dash),
);
check("only for an administrator who works the desk (crm.use), so a read only viewer gets no uncountable tiles", /if \(can\(actor, "crm\.use"\)\) \{\s*const desk = await deskDashboard/.test(dash));
check("what the desk could not count is said on the administrator's home too", /notComputable\.push\(\.\.\.desk\.notComputable\)/.test(dash));
check("the due tiles' links are pruned for whoever cannot open them, like every other tile", /if \("due" in next\) next\.due = next\.due\.map\(prune\);/.test(dash));
const five = ["New inquiries", "Follow-ups due", "Unassigned jobs", "Holds", "Refund requests"];
check("the desk's tiles are the five the ruling names", five.every((l) => desk.includes(`label: "${l}`) || desk.includes(`"${l} to decide"`) || desk.includes(`"${l} waiting"`)));
check("and the home renders them first, under Work due now", /dashboard\.role === "admin" && dashboard\.due\.length > 0[\s\S]{0,300}<CountTiles tiles=\{dashboard\.due\} \/>[\s\S]{0,120}<CountTiles tiles=\{dashboard\.tiles\} \/>/.test(home));

console.log("");
if (wrong === 0) {
  console.log("PASS: the administrator's home shows the work due now, counted as the desk counts it.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
