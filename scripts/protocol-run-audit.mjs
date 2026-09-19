/**
 * CAN A JOB BE SUBMITTED INCOMPLETE?
 *
 *   npx tsx scripts/protocol-run-audit.mjs
 *
 * The process page tells customers: "Our technician cannot submit the job
 * incomplete. The app will not let him." This is the check that makes that
 * sentence true rather than aspirational, and it is the one assertion on that
 * page a customer could not verify for themselves.
 *
 * WHY IT IS ITS OWN AUDIT. protocol-registry-audit asks whether the declaration
 * matches the signed document. This asks whether the RULES the document states
 * are actually enforced when a job runs. Those are different questions and the
 * second is the one that decides whether a sealed letter rests on a complete
 * package.
 */
import "./lib/load-env.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("============ WORKING A PROTOCOL ON A JOB ============");
console.log("");

const { itemsFor } = await import("../src/lib/protocol-run.ts");
const { RC001_CHECKLIST } = await import("../src/content/protocols/rc-001-checklist.ts");
const { checklistState } = await import("../src/lib/ops-evidence.ts");

/* ------------------------------------------------ 1. which items apply */

const all = itemsFor(null);
rec(
  "with no covering recorded, every item applies",
  all.length === RC001_CHECKLIST.length,
  `${all.length} of ${RC001_CHECKLIST.length}`,
);

/*
 * THE CONSERVATIVE DIRECTION, ASSERTED RATHER THAN ASSUMED. An unknown covering
 * must widen the list rather than narrow it. If this ever inverts, a job with no
 * covering recorded would present a SHORT checklist and read as complete, which
 * is the failure that matters here.
 */
const conditional = RC001_CHECKLIST.filter((i) => i.coveringOnly !== null);
rec(
  "and the conditional items are the ones a covering decides",
  conditional.length > 0,
  `${conditional.length} item(s) qualified by covering: ${[...new Set(conditional.map((i) => i.coveringOnly))].join(", ")}`,
);

if (conditional.length > 0) {
  const covering = conditional[0].coveringOnly;
  const forCovering = itemsFor(covering);
  const otherCoverings = conditional.filter((i) => i.coveringOnly !== covering);
  rec(
    `a ${covering} job drops the items printed for another covering`,
    forCovering.length === RC001_CHECKLIST.length - otherCoverings.length,
    `${forCovering.length} apply, ${otherCoverings.length} dropped`,
  );
  rec(
    "and an unknown covering is never shorter than a known one",
    all.length >= forCovering.length,
    `${all.length} unknown, ${forCovering.length} for ${covering}`,
  );
}

/* ----------- 2. the gate, which lives in ops-evidence and not in a second file */

/*
 * THE GATE IS checklistState AND THERE IS ONLY ONE OF IT.
 *
 * This audit briefly tested a second implementation in protocol-run.ts, written
 * two commits earlier by a session that had recorded one-fact-two-homes five
 * times that week. Both were correct and both agreed, which is why nothing
 * would have caught it: two right answers to one question is not a
 * contradiction anything can detect, until somebody changes one of them.
 *
 * So these exercise the REAL gate, the one /portal/jobs/[id] calls.
 */
const item = (key, required = true) => ({
  id: key,
  itemKey: key,
  kind: "note",
  label: key,
  required,
  instructions: null,
});
const capture = (key) => ({ itemKey: key, kind: "note", valueText: "seen" });

{
  const state = checklistState([item("a"), item("b")], []);
  rec(
    "a job with nothing captured cannot be submitted, and the blockers name the items",
    state.canSubmit === false && state.blockers.length === 2,
    state.blockers.join("; ").slice(0, 70),
  );
}

{
  const state = checklistState([item("a"), item("b")], [capture("a"), capture("b")]);
  rec(
    "a job with everything captured can be submitted",
    state.canSubmit === true,
    `${state.requiredDone} of ${state.requiredTotal}`,
  );
}

{
  const state = checklistState([item("a"), item("b")], [capture("a")]);
  rec(
    "one missing required item refuses the whole package",
    state.canSubmit === false && state.blockers.length === 1,
    state.blockers[0] ?? "no blocker named",
  );
}

/* ------------------- 3. an exception satisfies an item, and says it did */

/*
 * SECTION 7 OF THE SIGNED PROTOCOL: "the technician records each item that could
 * not be observed and the reason. No item is estimated, assumed, or left blank."
 *
 * Until 2026-09-19 an item was satisfied or it was not, so a roof that genuinely
 * could not be walked left a technician with nothing to record but a blank,
 * which is the one outcome the document rules out. The platform was quietly
 * asking for it.
 */
{
  const exception = {
    itemKey: "b",
    reason: "roof too steep to walk safely, inspected from ladder level",
    kind: "not_observed",
  };
  const state = checklistState([item("a"), item("b")], [capture("a")], [exception]);
  rec(
    "an item recorded as not observed, with a reason, satisfies the checklist",
    state.canSubmit === true,
    `${state.requiredDone} of ${state.requiredTotal}`,
  );
  const excepted = state.items.find((s) => s.item.itemKey === "b");
  /*
   * AND IT IS DISTINGUISHABLE FROM A PHOTOGRAPH, which is the half that
   * matters. Appendix C asks the engineer to weigh the package; an absence
   * recorded as an absence is a different input from an observation, and
   * folding them into one boolean would hide that from the person whose seal
   * goes on the letter.
   */
  rec(
    "and the engineer can tell it apart from a captured one",
    Boolean(excepted?.exception) && excepted?.exception?.reason === exception.reason,
    excepted?.exception ? `carries: ${excepted.exception.kind}` : "the exception is invisible",
  );
  const captured = state.items.find((s) => s.item.itemKey === "a");
  rec(
    "while a genuinely captured item carries no exception",
    captured?.satisfied === true && captured?.exception === undefined,
    "a photograph and a recorded absence are different facts",
  );
}


/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A job cannot be submitted incomplete, and an absence is recorded as one.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("The process page tells customers the app will not let a technician submit an");
  console.log("incomplete job. If this is red, that sentence is not true.");
  process.exitCode = 1;
}
