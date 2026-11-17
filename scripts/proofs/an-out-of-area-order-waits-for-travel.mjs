/**
 * AN OUT-OF-AREA ONLINE ORDER WAITS FOR TRAVEL, AND IS NEVER CHARGED WITHOUT IT.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/an-out-of-area-order-waits-for-travel.mjs
 *
 * Robert's add-on of 2026-11-16 and his answer 12 (6931421644): an online order
 * for a county outside our technicians' coverage takes every answer, copy and
 * upload, stops before payment with his sentence, raises the administrator's
 * travel task, and once travel is set the customer gets one payment link for
 * the letter plus travel.
 *
 *   A  coverage, pure: a county counts only if an active technician covers it,
 *      named with or without "County", in any case.
 *   B  the sentence the customer reads is his, the county filled in.
 *   C  the order flow asks before it opens checkout, holds instead of opening
 *      it, and a hold that failed opens no checkout either.
 *   D  the hold and the setting read the order's own row: a field order only,
 *      held on an unknown or uncovered county; travel is set once, only on an
 *      unpaid held order, by the administrator's grant, and adds its own line,
 *      total and refund terms.
 *   E  the unpaid reminder leaves a held order alone, and sends nothing when the
 *      holds cannot be read.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const src = (p) => readFileSync(p, "utf8");

/* A: coverage. The pure rule lives in coverage-rules.ts, which this imports and runs. */
const coverage = src("src/lib/tech-coverage.ts");
const { countyInCoverage } = await import("../../src/lib/coverage-rules.ts");
check("A: the database read uses the same pure rule", /import \{ countyInCoverage \} from "\.\/coverage-rules";/.test(coverage) && /return countyInCoverage\(county,/.test(coverage));
const rows = [{ coverage_counties: ["Bexar", "Nueces County"] }, { coverage_counties: null }];
check("A: a covered county counts, in any case and with or without County", countyInCoverage("bexar", rows) && countyInCoverage("Nueces", rows) && countyInCoverage("Bexar County", rows));
check("A: an uncovered one does not", !countyInCoverage("Bell", rows));
check("A: nor does an empty name", !countyInCoverage("  ", rows));
check("A: the read takes active field technicians only", /\.eq\("role", "field_tech"\)\.eq\("status", "active"\)/.test(coverage));

/* B: the sentence, his wording. */
const travel = src("src/lib/order-travel.ts");
check(
  "B: the customer reads Robert's sentence, the county filled in",
  travel.includes("`Travel to ${county} County is set by the office. You'll get your payment link with travel included, usually within one business hour, 8 AM to 8 PM.`"),
);

/* C: the order flow. */
const route = src("src/app/api/order-flow/route.ts");
const asks = route.indexOf("if (await orderNeedsTravel(result.orderId))");
const holds = route.indexOf("await holdOrderForTravel(result.orderId)", asks);
const failed = route.indexOf("if (!held.ok)", holds);
const answers = route.indexOf("travelHeld: travelHeldSays(held.county)", holds);
const checkout = route.indexOf("const checkout = await startCheckout(result.orderId);");
check("C: the order flow asks whether the order waits for travel before it opens checkout", asks > 0 && checkout > asks, `${asks} then ${checkout}`);
check("C: it holds instead, and answers with the sentence and no checkout", holds > asks && answers > holds && answers < checkout);
check("C: a hold that failed opens no checkout either", failed > holds && failed < answers && /if \(!held\.ok\) \{\s*return NextResponse\.json\(\{ ok: true, reference: result\.reference, paymentUnavailable: held\.error \}\);/.test(route));

/* D: the hold and the setting. */
const needs = travel.slice(travel.indexOf("export async function orderNeedsTravel("), travel.indexOf("export type OrderWaitingForTravel"));
check("D: only a field order waits, from the order's own row", /if \(order\.order_type !== "field"\) return false;/.test(needs) && /from\("eng_service_orders"\)/.test(needs));
check("D: an uncovered county, and an unknown one, both hold it", /return covered !== true;/.test(needs) && /if \(!order\) return true;/.test(needs));
const setter = travel.slice(travel.indexOf("export async function setOrderTravel("));
check("D: only the administrator's grant sets travel", /can\(actor, "pricing\.override_at_intake"\)/.test(setter));
check("D: only on an order held for travel, unpaid, and only once", /if \(!state\.held\) return/.test(setter) && /order\.status !== "awaiting_payment" \|\| order\.paid_at/.test(setter) && /\.is\("travel_cents", null\)/.test(setter));
check(
  "D: travel becomes its own line inside the total, with its refund terms",
  /travel_cents: travelCents,/.test(setter) && /total_cents: Number\(order\.total_cents\) \+ travelCents,/.test(setter) && /travelRefundTerms\(travelCents, county\)/.test(setter),
);
check("D: and the one payment link opens only after travel is saved", setter.indexOf("await startCheckout(orderId)") > setter.indexOf(".update({"));
const payments = src("src/lib/ops-payments.ts");
check("D: checkout already charges the order's travel as its own line (0135)", /order\.travel_cents !== null/.test(payments) && /travelLabel\(order\.county as string\)/.test(payments));

/* E: the unpaid reminder. */
const reminder = src("src/lib/unpaid-reminder.ts");
check("E: the unpaid reminder skips a held order", /if \(held\.has\(o\.id as string\)\) continue;/.test(reminder));
check("E: and sends nothing when the holds cannot be read", /if \(held === null\) return \{ looked: false, sent: 0/.test(reminder));

console.log(wrong === 0 ? "PASS: an out-of-area order waits for travel, and is never charged without it." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
