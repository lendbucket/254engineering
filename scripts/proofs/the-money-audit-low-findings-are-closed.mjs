// @runtime react-server
/**
 * PROOF: THE MONEY AUDIT'S LOW FINDINGS F9, F11, F13 AND F14 ARE CLOSED.
 *
 * The chat counterpart's money audit of 2026-11-02 (issue #1 comment
 * 6585008424), built by Robert's ruling: "Low findings: build after Q14 as one
 * bundle per audit file, skipping any that touch a ruling." F12's database
 * half and F6 need a migration or a database function and are not here.
 *
 *   F9   a commission reversal is capped at what is left of the accrual, so
 *        two partial refunds never reverse more than was accrued
 *   F11  a telephoned order carries its price breakdown when its price is the
 *        catalog's, and none when an operator overrode it
 *   F13  an override price is a whole number of cents
 *   F14  placeOrder answers duplicate only to the same site, and the same
 *        account when the caller names one
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-money-audit-low-findings-are-closed.mjs
 */
import { readFileSync } from "node:fs";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });
const read = (p) => readFileSync(p, "utf8");

/* F9 */
const { reversalFor } = await import("../../src/lib/partner-comp.ts");
// A 10% commission on $333.33 is $33.33. Two refunds of $166.67 each round
// their share half up to $16.67, which is $33.34 against $33.33 accrued.
const base = { model: "percent_of_order", accruedCents: 3333, basisCents: 33333 };
const first = reversalFor({ ...base, refundedCents: 16667 });
const second = reversalFor({ ...base, refundedCents: 16666, alreadyReversedCents: first.reverse ? -first.amountCents : 0 });
const total = (first.reverse ? -first.amountCents : 0) + (second.reverse ? -second.amountCents : 0);
check("F9: two partial refunds never reverse more than was accrued", total <= 3333, `reversed ${total} of 3333`);
check("F9: and the second still reverses what is left", total === 3333, `reversed ${total} of 3333`);
const done = reversalFor({ ...base, refundedCents: 5000, alreadyReversedCents: 3333 });
check("F9: an accrual already reversed in full reverses nothing more", done.reverse === false, JSON.stringify(done));
const flat = reversalFor({ model: "flat_per_order", accruedCents: 5000, basisCents: 40000, refundedCents: 40000, alreadyReversedCents: 2000 });
check("F9: a flat fee reverses only what is left of it", flat.reverse === true && flat.amountCents === -3000, JSON.stringify(flat));
const plain = reversalFor({ ...base, refundedCents: 33333 });
check("F9: a caller naming nothing reversed gets the old answer", plain.reverse === true && plain.amountCents === -3333, JSON.stringify(plain));
const comp = read("src/lib/ops-partner-comp.ts");
check("F9: planReversals reads what was already reversed of each accrual", /\.eq\("kind", "reversal"\)/.test(comp) && /alreadyReversedCents: reversedOf\.get\(accrual\.id as string\) \?\? 0/.test(comp));
check("F9: and refuses to plan when that read fails", /if \(priorError\) return \{ ok: false, error: `The commission already reversed on that order could not be read/.test(comp));

/* F11 */
const { orderBreakdownFor } = await import("../../src/lib/ops-job-billing.ts");
const coastal = orderBreakdownFor({ client_price_cents: 78400, catalog_price_cents: 78400, coastal_surcharge_cents: 17500, twia_county: true });
check("F11: a coastal file at the catalog price carries both lines", coastal.price_cents === 60900 && coastal.coastal_surcharge_cents === 17500 && coastal.twia_county === true, JSON.stringify(coastal));
check("F11: and the lines add up to the total charged", coastal.price_cents + coastal.coastal_surcharge_cents === 78400);
const inland = orderBreakdownFor({ client_price_cents: 60900, catalog_price_cents: 60900, coastal_surcharge_cents: null, twia_county: false });
check("F11: an inland file carries its base price and no coastal line", inland.price_cents === 60900 && inland.coastal_surcharge_cents === null && inland.twia_county === false, JSON.stringify(inland));
const overridden = orderBreakdownFor({ client_price_cents: 70000, catalog_price_cents: 78400, coastal_surcharge_cents: 17500, twia_county: true });
check("F11: an overridden price carries no breakdown, so checkout keeps one line at the total", overridden.price_cents === null && overridden.coastal_surcharge_cents === null, JSON.stringify(overridden));
const unflagged = orderBreakdownFor({ client_price_cents: 78400, catalog_price_cents: 78400, coastal_surcharge_cents: 17500, twia_county: false });
check("F11: a coastal amount without the county flag carries no breakdown", unflagged.price_cents === null, JSON.stringify(unflagged));
const billing = read("src/lib/ops-job-billing.ts");
check("F11: createOrderForFile writes the breakdown beside the total", /\.\.\.orderBreakdownFor\(file\),\n      total_cents: file\.client_price_cents,/.test(billing));
check("F11: and the file read selects the three fields", /client_price_cents, catalog_price_cents, coastal_surcharge_cents, twia_county, payment_intent/.test(billing));

/* F13 */
const { decidePrice } = await import("../../src/lib/job-intake-rules.ts");
const REASON = "Agreed with the owner on the telephone after a site description.";
const half = decidePrice({ catalogCents: 70900, enteredCents: 70900.5, reason: REASON, floorCents: 70200 });
check("F13: a fractional cent is refused in the platform's own words", "error" in half && half.error === "A price is a whole number of cents.", JSON.stringify(half));
const str = decidePrice({ catalogCents: 70900, enteredCents: "80000", reason: REASON, floorCents: 70200 });
check("F13: a string is refused", "error" in str, JSON.stringify(str));
const nan = decidePrice({ catalogCents: 70900, enteredCents: Number.NaN, reason: REASON, floorCents: 70200 });
check("F13: NaN is refused", "error" in nan, JSON.stringify(nan));
const whole = decidePrice({ catalogCents: 70900, enteredCents: 80000, reason: REASON, floorCents: 70200 });
check("F13: a whole cents override is still accepted", !("error" in whole) && whole.cents === 80000, JSON.stringify(whole));

/* F14 */
const { isSameCallersOrder, SPENT_KEY_SENTENCE } = await import("../../src/lib/ops-intake.ts");
check("F14: the same site with no account is the caller's retry", isSameCallersOrder({ site: "254", account_id: null }, { site: "254" }));
check("F14: another site is not", !isSameCallersOrder({ site: "sealed", account_id: null }, { site: "254" }));
check("F14: another account is not", !isSameCallersOrder({ site: "254", account_id: "acct-a" }, { site: "254", accountId: "acct-b" }));
check("F14: the same account is", isSameCallersOrder({ site: "254", account_id: "acct-a" }, { site: "254", accountId: "acct-a" }));
check("F14: a caller with no account is not compared against an account the order gained at release", isSameCallersOrder({ site: "254", account_id: "acct-a" }, { site: "254" }));
const intake = read("src/lib/ops-intake.ts");
const bulk = read("src/lib/ops-bulk.ts");
check("F14: the refusal is the batch path's sentence", bulk.includes(`"${SPENT_KEY_SENTENCE}"`));
const placeStart = intake.indexOf("export async function placeOrder(");
const placeBody = intake.slice(placeStart, intake.indexOf("\nasync function ", placeStart));
const firstAnswer = placeBody.indexOf("duplicate: true");
const firstCheck = placeBody.indexOf("isSameCallersOrder(existing");
check("F14: placeOrder asks before it answers duplicate", firstCheck > 0 && firstCheck < firstAnswer, `check at ${firstCheck}, answer at ${firstAnswer}`);
check("F14: and the race path asks too", /if \(raced && !isSameCallersOrder\(raced/.test(placeBody));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note && !x.ok ? ` (${x.note})` : ""}`);
}
console.log(failed === 0 ? `PASS: the money audit's low findings F9, F11, F13 and F14 are closed (${out.length} checks).` : `FAIL: ${failed} of ${out.length} check(s).`);
process.exitCode = failed === 0 ? 0 : 1;
