/**
 * A BATCH PAID AFTER ITS EXPIRY SAYS SO ON EACH ORDER IT COULD NOT RELEASE.
 *
 *   node scripts/proofs/a-batch-paid-after-its-expiry-says-so-on-each-order.mjs
 *
 * Robert's answer 6 to the evening report of 2026-11-17 (6963018405), from the
 * webhook work of 2026-10-13, item 5. A single order paid after its expiry gets
 * an internal payment.unexpected line (0075, 0122). A batch in the same race
 * was accepted with its expired orders still cancelled, and nothing said a
 * payment had arrived. markBatchPaid now writes that line on each cancelled
 * order.
 *
 *   A  only orders that were cancelled before the payment was applied: on a
 *      redelivery, the orders the first delivery released cannot be released
 *      again either, and calling those unexpected would be false
 *   B  not when the amount differs, which releases nothing and raises its own task
 *   C  after the release, so it can never hold one up, and a failure fails the
 *      delivery so Stripe delivers it again
 *   D  once per order and charge: the write first reads for the same charge, and
 *      both the read and the write are checked, unlike event(), which discards
 *      its error
 *   E  internal, never shown to the customer, like the single order's line
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const src = readFileSync("src/lib/ops-payments.ts", "utf8");
const start = src.indexOf("export async function markBatchPaid(");
const fn = src.slice(start, src.indexOf("\n}\n", start) + 2);
const helperAt = src.indexOf("async function unexpectedPaymentOnce(");
const helper = src.slice(helperAt, src.indexOf("\n}\n", helperAt) + 2);

check("markBatchPaid and its helper are where this proof reads them", start !== -1 && helperAt !== -1);
check("A: only the orders that were cancelled before the payment", /orders\.filter\(\(x\) => x\.expected_status === "cancelled"\)/.test(fn));
check("B: not when the amount differs", /if \(applied\.detail\.amount_differs !== true\) \{/.test(fn));
const releaseAt = fn.indexOf("await releaseAndFinish(");
const sayAt = fn.indexOf("await unexpectedPaymentOnce(");
check("C: written after the release, so it cannot hold one up", releaseAt !== -1 && sayAt > releaseAt);
check("C: and a failure fails the delivery", /if \(!said\.ok\) return \{ ok: false, error: said\.error \};/.test(fn));
check("D: it reads for the same charge on the same order first", /\.eq\("event", "payment\.unexpected"\)\s*\.contains\("detail", \{ charge_ref: chargeRef \}\)/.test(helper));
check("D: and a failed read refuses", /if \(error\) return \{ ok: false/.test(helper));
check("D: and a failed write refuses", /if \(insertError\) return \{ ok: false/.test(helper));
check("E: the line is internal", /customer_visible: false,/.test(helper) && /event: "payment\.unexpected",/.test(helper));
check("E: and carries the charge, which is what makes it once per charge", /detail: \{ charge_ref: chargeRef \},/.test(helper));

console.log(wrong === 0 ? "PASS: a batch paid after its expiry says so on each order it could not release." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
