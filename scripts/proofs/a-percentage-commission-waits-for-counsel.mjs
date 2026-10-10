/**
 * A PERCENTAGE COMMISSION WAITS FOR COUNSEL.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-percentage-commission-waits-for-counsel.mjs
 *
 * Run item 21 of 2026-10-10. Whether a partner may be paid a percentage of an
 * engineering fee is a question for counsel (partner-comp.ts says so at its
 * head). Until the register records an answer of "permitted",
 * percent_of_order and tiered_by_volume cannot be selected; the flat models can.
 *
 * The decision is proved with all three states of the answer, and the door is
 * proved by calling setPartnerTerms itself with the register as it is today:
 * the refusal returns before any database write, so nothing is written.
 */
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { counselOnPercentageCompensation } = await import("../../src/config/credentials.ts");
const { modelRefusal, percentageCompensationAllowed, PERCENTAGE_MODELS } = await import("../../src/lib/partner-comp.ts");
const { setPartnerTerms } = await import("../../src/lib/ops-partners-admin.ts");

/* The premise: the register holds no answer today. Without it the rest proves nothing. */
check("the register holds no counsel answer today", counselOnPercentageCompensation === null);

check("exactly two models pay a percentage", PERCENTAGE_MODELS.length === 2 && PERCENTAGE_MODELS.includes("percent_of_order") && PERCENTAGE_MODELS.includes("tiered_by_volume"));

const permitted = { answer: "permitted" };
const refused = { answer: "not_permitted" };
for (const model of ["percent_of_order", "tiered_by_volume"]) {
  check(`${model} is refused with no answer recorded`, modelRefusal(model, null) !== null);
  check(`${model} is refused when counsel says no`, modelRefusal(model, refused) !== null);
  check(`${model} is allowed once counsel says yes`, modelRefusal(model, permitted) === null);
}
for (const model of ["flat_per_order", "flat_per_qualified_lead"]) {
  check(`${model} is allowed whatever the answer`, [null, refused, permitted].every((c) => modelRefusal(model, c) === null));
}
check("allowed only on a recorded yes", !percentageCompensationAllowed(null) && !percentageCompensationAllowed(refused) && percentageCompensationAllowed(permitted));

/*
 * The door, with the register as it is. setPartnerTerms asks for a database
 * before anything else, so the environment is loaded through the guarded
 * db-target (development only); the refusal returns before any write.
 */
const { auditClient } = await import("../lib/db-target.mjs");
const db = auditClient("the percentage commission proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so the door itself was not called.");
} else {
  const admin = { id: "00000000-0000-0000-0000-000000000000", role: "admin", status: "active", grants: new Set(["partners.manage"]) };
  const result = await setPartnerTerms(admin, "00000000-0000-0000-0000-000000000001", {
    model: "percent_of_order",
    percentBps: 250,
    holdbackDays: 30,
    effectiveFrom: "2026-10-10",
  });
  check(
    "setPartnerTerms refuses a percentage model today, with the reason",
    result.ok === false && /counsel/.test(result.error),
    result.ok ? "accepted" : result.error,
  );
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a percentage commission waits for counsel.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
