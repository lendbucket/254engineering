/**
 * A CHARGEBACK IS WRITTEN DOWN AND GIVEN TO THE ADMINISTRATOR, ONCE.
 *
 * Part 1 finding 1, Robert's answer 1 of 2026-11-14. charge.dispute.created
 * reached the webhook, verified, and was logged "not acted on": a disputed
 * charge left no mark on the order or the file and nobody was told.
 *
 * What must hold:
 *   1. The adapter turns charge.dispute.created and charge.dispute.closed into
 *      one event kind, carrying the payment intent a charge row is filed under.
 *   2. The route hands it to recordDispute and answers non 2xx when the write
 *      failed, so Stripe delivers it again.
 *   3. recordDispute reads the charge itself and says a failed read, rather
 *      than reading null as "no order".
 *   4. One timeline entry per dispute and phase: it looks for the entry first
 *      and writes only when there is none.
 *   5. Nothing reaches the customer: the entry is not customer visible.
 *   6. The administrator's task is keyed on the dispute and phase.
 *   7. It says what it does not do: the ledger still counts the charge.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const adapter = codeOf(readFileSync("src/lib/payments-stripe.ts", "utf8"));
check("the adapter reads both dispute events", /event\.type === "charge\.dispute\.created" \|\| event\.type === "charge\.dispute\.closed"/.test(adapter));
check("into one kind, with its phase", /kind: "charge\.dispute",[\s\S]*?phase: event\.type === "charge\.dispute\.created" \? "created" : "closed"/.test(adapter));
check("carrying the payment intent a charge is filed under", /typeof dispute\.payment_intent === "string" \? dispute\.payment_intent : dispute\.payment_intent\?\.id \?\? null/.test(adapter));
check("the account check fetches the dispute itself", /if \(event\.kind === "charge\.dispute"\) \{\s*return stripe\(\)\.disputes\.retrieve\(event\.disputeRef\);/.test(adapter));

const route = codeOf(readFileSync("src/app/api/stripe/webhook/route.ts", "utf8"));
const branch = route.slice(route.indexOf('if (parsed.kind === "charge.dispute")'), route.indexOf('if (parsed.kind === "charge.refund.updated")'));
check("the route hands a dispute to recordDispute", /await recordDispute\(\{/.test(branch));
check("and answers non 2xx when it was not written", /if \(!result\.ok\) \{[\s\S]*?status: 500/.test(branch));

const payments = codeOf(readFileSync("src/lib/ops-payments.ts", "utf8"));
const fn = payments.slice(payments.indexOf("export async function recordDispute("), payments.indexOf("async function raiseRefundTask("));
check("it reads the charge itself and says a failed read", /chargeError\) return \{ ok: false, error: `The charge the dispute is against could not be read/.test(fn) && !fn.includes("orderForCharge("));
const look = fn.indexOf('.eq("event", name)');
const write = fn.indexOf('from("eng_order_events").insert(');
check("it looks for the entry before writing", look > 0 && write > look);
check("and writes only when there is none", /if \(!alreadyRecorded\) \{\s*const \{ error: writeError \} = await db\.from\("eng_order_events"\)\.insert\(/.test(fn));
check("one entry name per dispute and phase", /`payment\.disputed:\$\{input\.disputeRef\}`/.test(fn) && /`payment\.dispute_closed:\$\{input\.disputeRef\}`/.test(fn));
check("nothing reaches the customer", /customer_visible: false,/.test(fn) && !/customer_visible: true/.test(fn));
check("the administrator's task is keyed on dispute and phase", /key: `dispute-\$\{input\.phase\}:\$\{input\.disputeRef\}`/.test(fn));
check("it says the ledger still counts the charge", /still counts the charge as paid/.test(fn));

console.log("");
if (wrong === 0) {
  console.log("PASS: a chargeback is written to the order and file once, given to the administrator, and kept from the customer.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
