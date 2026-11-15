/**
 * WHEN PAYMENT LANDS, THE FILE IS READY FOR DISPATCH AND SAYS WHO TO OFFER IT TO.
 * The Killeen call, item 5 (Robert, 2026-11-14). What must hold:
 *   1. Payment moves a field job to needs_dispatch by itself (releaseForFulfilment).
 *   2. The dispatch panel names the plan's first choice and offers it in one click,
 *      through the same send_offers request as the full list.
 *   3. The first choice is planDispatch's own ranking, not a second one.
 *   4. It is not offered while somebody holds a live offer on the file.
 *   5. Until an engineer takes the review, the file names the engineer of record
 *      from the register.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const payments = codeOf(readFileSync("src/lib/ops-payments.ts", "utf8"));
const release = payments.slice(payments.indexOf("export async function releaseForFulfilment("));
check("payment releases a field job to needs_dispatch by itself", /target === "needs_dispatch"/.test(release) && /transitionFile\(/.test(release.slice(0, 6000)));

const panel = codeOf(readFileSync("src/app/portal/(app)/files/DispatchPanel.tsx", "utf8"));
check("the first choice is the plan's own first offer, and only while nobody holds a live offer", /const suggested = !liveOffer && offers\.length > 0 \? offers\[0\] : null;/.test(panel));
check("a live offer is one offered or accepted", /const liveOffer = alreadyOffered\.some\(\(o\) => o\.state === "offered" \|\| o\.state === "accepted"\);/.test(panel));
check("one click offers it, through the same request", /onClick=\{\(\) => void send\(\[suggested\.techId\]\)\}/.test(panel) && /techIds: only \?\? selected,/.test(panel));
check("it says the distance is a straight line", /miles in a straight line/.test(panel));

const dispatch = codeOf(readFileSync("src/lib/ops-dispatch.ts", "utf8"));
check("the plan ranks its offers best first", /offers\.sort\(\(a, b\) => \{/.test(dispatch) && /offers\.forEach\(\(o, i\) => \(o\.rank = i \+ 1\)\);/.test(dispatch));

const page = codeOf(readFileSync("src/app/portal/(app)/files/page.tsx", "utf8"));
check("the file names the engineer of record until one takes the review", /const engineerOfRecord = activeEngineer\(\)\?\.name \?\? null;/.test(page) && /!related\.engineer && engineerOfRecord \?/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: a paid job is ready for dispatch, names the plan's first choice with a one-click offer, and names the engineer of record.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
