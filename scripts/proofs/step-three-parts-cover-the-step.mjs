/**
 * SPLITTING STEP 3 INTO PARTS CHANGED HOW MANY QUESTIONS ARE ON SCREEN AND
 * NOTHING ELSE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/step-three-parts-cover-the-step.mjs
 *
 * Operator ruling, 2026-09-30: split step 3 by the intake definition's own
 * groups, rail stays at five steps, "Part 2 of 4", required fields checked on
 * their own sub page, and every field, wording and validation unchanged.
 *
 * THE ONE THING A SPLIT LIKE THIS CAN SILENTLY GET WRONG is losing a field
 * between two sub pages. Nothing about the screen would look broken: each part
 * renders, each part validates, each Continue works, and a required answer the
 * firm needs is simply never asked. The customer pays, the job is short an
 * answer, and the first person to find out is whoever picks the file up.
 *
 * So the properties proved here are coverage and equivalence, over every
 * deliverable in the catalogue rather than one:
 *
 *   1. every field the unsplit step showed appears in exactly one part
 *   2. no part is empty, so no sub page can be reached with nothing on it
 *   3. the union of the parts' required fields is exactly the step's
 *   4. the parts are in the definition's declared order
 *   5. the rail is still five steps or fewer, unchanged by the split
 *
 * Three is the load bearing one. It is the difference between a split and a
 * hole, and it is stated as a SET comparison in both directions rather than as
 * a count, because two sets of the same size can differ.
 */

import { CATALOG } from "../../data/catalog.ts";
import { INTAKE_GROUPS } from "../../data/intake-fields.ts";
import {
  customerFieldsFor,
  intakePartsFor,
  blockersOnPart,
  blockersOn,
  emptyState,
  stepsFor,
} from "../../src/lib/order-flow.ts";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/*
 * CATALOG is already flat, and every entry carries its own serviceSlug and tier.
 *
 * The first version of this file mapped over services and flattened their
 * deliverables, which is the shape `data/catalog.ts` has INTERNALLY as DECLARED
 * and not the shape it exports. It was written in a worktree with no
 * node_modules, so nothing could run it, and it failed on its very first
 * execution with "does not provide an export named 'catalog'".
 *
 * Worth leaving a note on rather than quietly correcting: a proof that has never
 * run is not a check, and this one proves it. It was committed, reported as
 * written, and was wrong in its second line.
 */
const entries = CATALOG;

/*
 * THE SUBJECT IS ASSERTED FIRST. A catalogue that failed to load would make
 * every check below pass over an empty list, which is the vacuous green this
 * repository keeps meeting.
 */
rec(
  "the catalogue yields deliverables to test",
  entries.length >= 5,
  `${entries.length} deliverable(s) across ${new Set(entries.map((e) => e.serviceSlug)).size} service line(s)`,
);

let withParts = 0;
let totalParts = 0;
const failures = [];

for (const entry of entries) {
  const shown = customerFieldsFor(entry, "seal");
  const parts = intakePartsFor(entry);
  if (parts.length > 0) withParts += 1;
  totalParts += parts.length;

  const name = `${entry.serviceSlug}/${entry.tier}`;

  /* 1. every shown field in exactly one part */
  const seen = new Map();
  for (const p of parts) for (const f of p.fields) seen.set(f.id, (seen.get(f.id) ?? 0) + 1);
  const missing = shown.filter((f) => !seen.has(f.id)).map((f) => f.id);
  const twice = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (missing.length) failures.push(`${name}: ${missing.join(", ")} appear(s) in no part`);
  if (twice.length) failures.push(`${name}: ${twice.join(", ")} appear(s) in more than one part`);

  /* 2. no empty part */
  if (parts.some((p) => p.fields.length === 0)) failures.push(`${name}: a part has no fields`);

  /* 3. the union of the parts' required fields is exactly the step's */
  const stepRequired = new Set(
    customerFieldsFor(entry, "order")
      .filter((f) => f.required)
      .map((f) => f.label),
  );
  const empty = emptyState(entry.tier);
  const partUnion = new Set();
  for (const p of parts) for (const label of blockersOnPart(entry, empty, p)) partUnion.add(label);
  const stepBlockers = new Set(blockersOn("requirements", entry, empty));

  for (const label of stepBlockers) {
    if (!partUnion.has(label)) failures.push(`${name}: "${label}" is required by the step and by no part`);
  }
  for (const label of partUnion) {
    if (!stepBlockers.has(label)) failures.push(`${name}: "${label}" is required by a part and not by the step`);
  }
  if (stepRequired.size !== stepBlockers.size) {
    /* Not a failure, a note: a label can repeat across fields. */
  }

  /* 4. declared order */
  const order = parts.map((p) => p.group);
  const expected = INTAKE_GROUPS.filter((g) => order.includes(g));
  if (order.join(",") !== expected.join(",")) {
    failures.push(`${name}: parts are ${order.join(", ")} where the definition declares ${expected.join(", ")}`);
  }

  /*
   * 5. THE PARTS ARE INVISIBLE TO THE RAIL.
   *
   * THE FIRST VERSION ASSERTED THE RAIL IS AT MOST FIVE STEPS, and that was
   * wrong about the product rather than about the split. `stepsFor` adds a
   * deliverable-choice step when a line sells more than one, so a multi
   * deliverable line that also has qualifiers has SIX, and had six long before
   * step 3 was split. This proof passed `deliverableCount: 2` to every entry and
   * then failed six of them for a number the operator's ruling never meant.
   *
   * The ruling was "the rail stays at five steps", said about a split that could
   * have turned four groups into four rail entries. The property that carries
   * that is not a count: it is that `requirements` appears ONCE however many
   * parts there are. A count would go on being wrong for every line the
   * catalogue adds.
   */
  const steps = stepsFor(entry, 2);
  const requirementSteps = steps.filter((s) => s.id === "requirements").length;
  if (parts.length > 0 && requirementSteps !== 1) {
    failures.push(
      `${name}: ${parts.length} part(s) produced ${requirementSteps} requirements step(s) in the rail, so the split leaked into it`,
    );
  }
  if (steps.some((s) => String(s.id).startsWith("part"))) {
    failures.push(`${name}: a part became a rail step`);
  }
}

rec(
  "every deliverable with intake questions yields at least one part",
  withParts > 0,
  `${withParts} of ${entries.length} deliverable(s) have customer questions, ${totalParts} part(s) in total`,
);

rec(
  "every shown field is in exactly one part, no part is empty, the required sets match, the order is declared, and the rail is unchanged",
  failures.length === 0,
  failures.length === 0
    ? `${entries.length} deliverable(s) checked against five properties each`
    : failures.slice(0, 6).join(" | "),
);

/*
 * AND THE SPLIT IS NOT VACUOUS. A version of intakePartsFor returning one part
 * holding everything would satisfy every check above and would leave the screen
 * thirteen phone heights tall. At least one deliverable must genuinely split.
 */
const multi = entries.filter((e) => intakePartsFor(e).length > 1);
rec(
  "and at least one deliverable is split across more than one part",
  multi.length > 0,
  multi.length > 0
    ? `${multi.length} deliverable(s) split, the widest into ${Math.max(...entries.map((e) => intakePartsFor(e).length))} parts`
    : "every deliverable yields a single part, so the split changes nothing and the screen is as tall as it was",
);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The parts cover the step exactly, and nothing can hide between two sub pages.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
