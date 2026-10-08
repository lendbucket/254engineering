/**
 * A WINDSTORM ORDER OUTSIDE THE CATASTROPHE AREA IS DECLINED, AT EVERY DOOR.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-windstorm-order-outside-the-area-is-declined.mjs
 *
 * docs/conflicts-v1.1.md item 6, WS-001 section 12: "A property outside the
 * designated catastrophe area. Declined." order-audit, bulk-audit and
 * intake-audit all passed before and after this was built, because none of
 * them orders a windstorm certificate for an inland county; this builds that
 * subject rather than waiting for one.
 *
 * Three doors take an order and every caller reaches one of them (placeOrder,
 * the bulk split, takeJob; placeBatch places each property through placeOrder).
 * The bulk split is pure and is DRIVEN. placeOrder and takeJob write rows, so
 * for those two this asserts the call in the source, after the county is
 * resolved and before anything is priced or written: a stated proxy, because a
 * live order would leave a row on an append only table.
 */
import { readFileSync } from "node:fs";

const { windstormAreaRefusal, WINDSTORM_SERVICE_SLUGS, TEXAS_COUNTIES } = await import("../../src/lib/ops-counties.ts");
const { splitBatch } = await import("../../src/lib/bulk-order.ts");
const { CATALOG } = await import("../../data/catalog.ts");
const { FIRST_TIER_COASTAL } = await import("../../src/content/windstorm.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const SLUG = "windstorm-wpi-8";

/* The rule, both directions. */
const travis = windstormAreaRefusal(SLUG, "Travis");
check("an inland county is declined, naming the county", typeof travis === "string" && travis.includes("Travis County is outside"), travis ?? "null");
check("however the county is typed", windstormAreaRefusal(SLUG, "travis county") === travis);
check("a designated county is not", windstormAreaRefusal(SLUG, "Nueces") === null);
check("Harris is not declined, because the part east of SH 146 is inside", windstormAreaRefusal(SLUG, "Harris") === null);
check("an unknown county is not called outside", windstormAreaRefusal(SLUG, null) === null && windstormAreaRefusal(SLUG, "Gotham") === null);
check("and another line in an inland county is untouched", windstormAreaRefusal("roof-inspections", "Travis") === null);

/* Every designated county passes and every other county but Harris is declined: the whole set, not a sample. */
const designated = new Set(FIRST_TIER_COASTAL);
const misjudged = TEXAS_COUNTIES.filter((c) => {
  const refused = windstormAreaRefusal(SLUG, c) !== null;
  return designated.has(c) || c === "Harris" ? refused : !refused;
});
check(`all ${TEXAS_COUNTIES.length} counties answer as the designated list says`, misjudged.length === 0 && TEXAS_COUNTIES.length === 254, misjudged.join(", ") || `${designated.size} designated, Harris checked, the rest declined`);

/* The declared slug set covers every windstorm line in the catalogue. */
const windstormLines = [...new Set(CATALOG.filter((e) => /windstorm/i.test(e.serviceSlug)).map((e) => e.serviceSlug))];
const uncovered = windstormLines.filter((s) => !WINDSTORM_SERVICE_SLUGS.includes(s));
check("every windstorm line in the catalogue is covered", windstormLines.length > 0 && uncovered.length === 0, uncovered.join(", ") || windstormLines.join(", "));

/* The bulk door, driven. Qualifiers answered with an accepted option, so the area is the only reason left to refuse. */
const entries = CATALOG.filter((e) => e.serviceSlug === SLUG);
for (const entry of entries) {
  const answers = entry.qualifiers.map((q) => ({
    qualifierId: q.id,
    optionIndex: q.options.findIndex((_, i) => !q.disqualifyOn.includes(i)),
  }));
  const split = splitBatch(
    entry,
    [
      { ref: "inland", propertyAddress: "1 Probe Street", county: "Travis", answers },
      { ref: "coastal", propertyAddress: "2 Probe Street", county: "Nueces", answers },
    ],
    new Set(FIRST_TIER_COASTAL),
    null,
  );
  const inland = split.rejected.find((r) => r.ref === "inland");
  check(`bulk, ${entry.tier}: the inland property is rejected with the area sentence`, inland?.reason === travis, inland?.reason?.slice(0, 60) ?? "accepted");
  check(`bulk, ${entry.tier}: and the coastal one is not rejected for its area`, !split.rejected.some((r) => r.ref === "coastal" && r.reason === windstormAreaRefusal(SLUG, "Nueces")), split.rejected.find((r) => r.ref === "coastal")?.reason?.slice(0, 60) ?? "accepted");
}

/* The two doors that write: the call sits after the county is resolved and before the price. */
for (const [file, after, before] of [
  ["src/lib/ops-intake.ts", "const county = resolved.county;", "const priced = quoteFor("],
  ["src/lib/ops-job-intake.ts", "const resolved = resolveCounty(", "const priced = priceForJob("],
]) {
  const src = readFileSync(file, "utf8");
  const call = src.indexOf("windstormAreaRefusal(");
  const a = src.indexOf(after);
  const b = src.indexOf(before, a);
  check(`${file}: refuses outside the area after resolving the county and before pricing`, call > a && a >= 0 && b > call, `call at ${call}, resolved at ${a}, priced at ${b}`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a windstorm order outside the catastrophe area is declined at every door.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
