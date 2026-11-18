/**
 * THE WALK GIVES THE REP A PROSPECT THE REP CAN SEE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-walk-gives-the-rep-a-prospect-the-rep-can-see.mjs
 *
 * The W2 walk (scripts/w2-walk-audit.mjs) opens /portal/prospects/[id] as the
 * rep, on a prospect it makes for the run. It made that prospect with no owner
 * and no county, and the sales list's visibility rule R5 (canSeeCompany)
 * shows a rep only the companies they own or unowned ones in their territory.
 * So the rep was refused, correctly, and the walk printed 254-WF-007 step 4 and
 * 254-WF-011 step 2 as "broken" on every board: a fixture the product's own
 * rule could never let through, read as a defect in the product. Found in the
 * nightly of 2026-11-17 (44174184672).
 *
 *   A  the rule, exercised: a rep who owns a company sees it; an unowned company
 *      with no county is not seen, which is the state the fixture was in
 *   B  the fixture now names the walking principal as the owner
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { canSeeCompany } = await import("../../src/lib/crm-board-rules.ts");
const rep = { id: "rep-1", seesAll: false, counties: new Set() };
check("A: a rep sees a company they own", canSeeCompany(rep, "rep-1", null) === true);
check("A: and does not see an unowned company with no county, the fixture's old state", canSeeCompany(rep, null, null) === false);

const walk = readFileSync("scripts/w2-walk-audit.mjs", "utf8");
const insert = walk.slice(walk.indexOf('.from("eng_prospects")\n      .insert({'));
const block = insert.slice(0, insert.indexOf("})"));
check("B: the walk's prospect insert is where it was", block.length > 0 && /company: `\$\{WALK_PROSPECT\}/.test(block));
check("B: and it is owned by the principal that walks it", /owner_id: owner,/.test(block) && /const owner = sessions\.rep\?\.probe\?\.id/.test(walk));

console.log(wrong === 0 ? "PASS: the walk gives the rep a prospect the rep can see." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
