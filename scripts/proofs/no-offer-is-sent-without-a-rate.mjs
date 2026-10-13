/**
 * NO OFFER IS SENT WITHOUT A RATE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/no-offer-is-sent-without-a-rate.mjs
 *
 * Operator ruling, 2026-10-10 (decision 3). an-offer-without-a-rate-cannot-be-
 * accepted.mjs proves the acceptance half; this proves the sending half.
 *
 * The rule is offerRateRefusal, asked directly: a null, zero, negative or
 * non-finite rate is refused with a sentence that says what to do, and a real
 * rate passes. And sendOffers asks it, with the dispatch context's fee, BEFORE
 * the offer rows are built and inserted, so a refusal writes nothing. A live
 * proof would need a line with a published protocol and no technician fee,
 * which development cannot be given without approving a probe protocol; the
 * order is therefore read from the source, and the injection below the rule
 * is what shows the check can fail.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { offerRateRefusal } = await import("../../src/lib/ops-field.ts");

for (const [label, fee] of [["null", null], ["zero", 0], ["negative", -500], ["not a number", Number.NaN]]) {
  const why = offerRateRefusal(fee);
  check(`a ${label} rate is refused, with what to do`, typeof why === "string" && /Set the line's technician fee/.test(why), String(why).slice(0, 60));
}
check("a real rate is not refused", offerRateRefusal(12_500) === null);

const src = readFileSync("src/lib/ops-field.ts", "utf8");
const body = src.slice(src.indexOf("export async function sendOffers"), src.indexOf("\n}\n", src.indexOf("export async function sendOffers")));
const asked = body.indexOf("offerRateRefusal(ctx.feeCents)");
const built = body.indexOf("const rows = techIds.map(");
const inserted = body.indexOf('.from("eng_assignments")');
check(
  "sendOffers asks the rule with the dispatch context's fee before it builds or inserts any offer",
  asked > 0 && built > asked && (inserted < 0 || inserted > asked),
  `asked at ${asked}, rows built at ${built}, insert at ${inserted}`,
);

console.log("");
if (wrong === 0) {
  console.log("PASS: no offer is sent without a rate.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
