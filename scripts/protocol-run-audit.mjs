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

const { itemsFor, runView, submitVerdict } = await import("../src/lib/protocol-run.ts");
const { RC001_CHECKLIST } = await import("../src/content/protocols/rc-001-checklist.ts");

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

/* --------------------------------- 2. the three states, and absent is one */

{
  const view = runView({ covering: null, evidenceByItem: {}, exceptionsByItem: {} });
  rec(
    "a job with nothing recorded has every item outstanding, not passed",
    view.outstanding === view.applicable && view.captured === 0 && view.excepted === 0,
    `${view.outstanding} outstanding of ${view.applicable}`,
  );

  const verdict = submitVerdict(view);
  rec(
    "and it cannot be submitted",
    verdict.ok === false,
    verdict.ok ? "it was allowed" : `${verdict.outstanding.length} named`,
  );
  /*
   * THE REFUSAL NAMES THE ITEMS. A refusal that only counts sends somebody
   * scrolling, which is the difference between a guard and an obstacle.
   */
  rec(
    "and the refusal names the outstanding items rather than counting them",
    verdict.ok === false && verdict.outstanding.length === view.applicable,
    verdict.ok ? "no refusal" : `first: ${verdict.outstanding[0]}`,
  );
}

/* ------------------------------------- 3. complete by capture, and by exception */

{
  const items = itemsFor(null);
  const everything = Object.fromEntries(items.map((i) => [i.key, ["evidence-id"]]));
  const view = runView({ covering: null, evidenceByItem: everything, exceptionsByItem: {} });
  const verdict = submitVerdict(view);
  rec(
    "a package with every item captured may be submitted",
    verdict.ok === true,
    verdict.ok ? `${verdict.captured} captured` : verdict.because.slice(0, 60),
  );
}

{
  const items = itemsFor(null);
  const exceptions = Object.fromEntries(
    items.map((i) => [i.key, { reason: "no safe attic access on this property", kind: "not_observed" }]),
  );
  const view = runView({ covering: null, evidenceByItem: {}, exceptionsByItem: exceptions });
  const verdict = submitVerdict(view);
  rec(
    "and a package where every item is properly excepted may be submitted too",
    verdict.ok === true,
    verdict.ok ? `${verdict.excepted} excepted` : verdict.because.slice(0, 60),
  );
}

/* ------------------------------ 4. ONE missing item is enough to refuse */

{
  const items = itemsFor(null);
  const allButOne = Object.fromEntries(items.slice(1).map((i) => [i.key, ["evidence-id"]]));
  const view = runView({ covering: null, evidenceByItem: allButOne, exceptionsByItem: {} });
  const verdict = submitVerdict(view);
  rec(
    "one missing item out of fifty one refuses the whole package",
    verdict.ok === false && verdict.outstanding.length === 1,
    verdict.ok ? "it was allowed" : `outstanding: ${verdict.outstanding[0]}`,
  );
  /*
   * THE CASE THAT MATTERS MOST, because it is the one a tired person would
   * argue about. A package that is fifty out of fifty one is not nearly
   * complete, it is incomplete, and the engineer's determination rests on the
   * whole package rather than most of it.
   */
  rec(
    "and it names the one rather than reporting a percentage",
    verdict.ok === false && /[A-Za-z]/.test(verdict.outstanding[0] ?? ""),
    "a percentage invites a judgement the protocol does not allow",
  );
}

/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A job cannot be submitted incomplete.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("The process page tells customers the app will not let a technician submit an");
  console.log("incomplete job. If this is red, that sentence is not true.");
  process.exitCode = 1;
}
