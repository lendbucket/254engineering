/**
 * WHAT THE FIRM PROMISES, AND WHETHER ITS OWN PARTS CAN MEET IT.
 *
 *   npx tsx scripts/turnaround-audit.mjs
 *
 * Pure. No server, no database.
 *
 * TWO QUESTIONS, AND THEY ARE DIFFERENT ONES.
 *
 * First, arithmetic: a published figure that is shorter than the sum of the
 * segments behind it is a promise the firm cannot keep on a good day, never
 * mind a bad one. That is checkable and it is checked.
 *
 * Second, the gate: the operator ruled the figure exists from today and reaches
 * a page only when the firm is OPEN. "The gate is registered and trading today,
 * not open, and a published turnaround is a promise about fulfilment the firm
 * cannot yet make with no technician." So the copy function must answer null
 * while the gate is shut, and that is asserted rather than trusted to a comment.
 */
import "./lib/load-env.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("============ WHAT THE FIRM PROMISES ============");
console.log("");

const {
  ROOF_CERTIFICATION_SEGMENTS,
  ROOF_CERTIFICATION_PUBLISHED_DAYS,
  DESIGN_WORKING_DAYS,
  REVISIT_AFTER_JOBS,
  totalDays,
  shareOf,
} = await import("../src/config/turnaround.ts");
const { turnaroundCopy, publishedTurnaround } = await import("../src/content/model-copy.ts");
const { isOpen } = await import("../src/lib/launch.ts");

/* ------------------------------------------------ 1. the arithmetic */

rec(
  "the roof certification clock has segments at all",
  ROOF_CERTIFICATION_SEGMENTS.length > 0,
  ROOF_CERTIFICATION_SEGMENTS.length > 0
    ? `${ROOF_CERTIFICATION_SEGMENTS.length} segments`
    : "no segments, so every check below is passing over an empty set",
);

const total = totalDays(ROOF_CERTIFICATION_SEGMENTS);
rec(
  "the published figure covers the sum of its parts at their worst",
  ROOF_CERTIFICATION_PUBLISHED_DAYS >= total.max,
  `published ${ROOF_CERTIFICATION_PUBLISHED_DAYS}, segments sum to ${total.min} best and ${total.max} worst`,
);

/*
 * AND IT IS NOT ABSURDLY LOOSE EITHER. A published figure of ninety days would
 * pass the check above and would be a different kind of dishonest: a promise so
 * padded that meeting it says nothing. The ceiling is stated as a literal here
 * rather than derived, so moving it costs a deliberate edit, which is the same
 * mechanism the business rulings in CLAUDE.md section 6c use.
 */
rec(
  "and it is not padded so far that meeting it would mean nothing",
  ROOF_CERTIFICATION_PUBLISHED_DAYS <= total.max + 3,
  `${ROOF_CERTIFICATION_PUBLISHED_DAYS - total.max} day(s) of slack over the worst case`,
);

/*
 * WHOSE PART IS WHOSE. The operator asked for his figure and Aman's recorded
 * separately "so we can see which part slips", and a record where every segment
 * belonged to one owner would satisfy the type and defeat the purpose.
 */
const engineer = shareOf("engineer", ROOF_CERTIFICATION_SEGMENTS);
const firm = shareOf("firm", ROOF_CERTIFICATION_SEGMENTS);
rec(
  "and both owners hold part of the clock, which is the point of recording them apart",
  engineer.max > 0 && firm.max > 0,
  `engineer ${engineer.min} to ${engineer.max}, firm ${firm.min} to ${firm.max}`,
);
rec(
  "and every segment names who stated it, so a disagreement has a name on it",
  ROOF_CERTIFICATION_SEGMENTS.every((s) => typeof s.statedBy === "string" && s.statedBy.length > 5),
  ROOF_CERTIFICATION_SEGMENTS.map((s) => s.statedBy).join(" | "),
);

rec(
  "the design figure is recorded as a working figure",
  DESIGN_WORKING_DAYS > 0,
  `${DESIGN_WORKING_DAYS} business days, quoted per job rather than published`,
);
rec(
  "and the revisit is a number rather than an intention",
  REVISIT_AFTER_JOBS > 0,
  `revisited after ${REVISIT_AFTER_JOBS} jobs`,
);

/* -------------------------------------- 2. the gate holds the figure */

/*
 * THE ONE THAT MATTERS MOST, AND IT IS THE OPERATOR'S OWN CORRECTION.
 *
 * He gave the figure as published and then withdrew the rendering when the
 * conflict with section 1 was put to him, saying the hold "is that rule
 * working" rather than an override. This is that hold made mechanical.
 */
{
  const open = isOpen();
  const copy = turnaroundCopy("Sealed within a few business days.");
  const published = publishedTurnaround("roof-inspections");

  rec(
    "the gate is shut, which is what these checks are asserting against",
    open === false,
    open ? "the firm reads as OPEN, so the two checks below are asserting the other case" : "not open",
  );

  if (!open) {
    rec(
      "no turnaround sentence renders while the firm is not open",
      copy === null,
      copy === null ? "renders nothing" : `rendered: ${String(copy).slice(0, 70)}`,
    );
    rec(
      "and the published end to end figure renders nothing either",
      published === null,
      published === null ? "renders nothing" : `rendered: ${String(published).slice(0, 70)}`,
    );
  }

  /*
   * AND THE FIGURE STILL EXISTS, which is the other half of the ruling: record
   * it now, publish when the gate does. A check that only asserted the silence
   * would pass just as happily if somebody deleted the figures.
   */
  rec(
    "while the figure itself exists and is ready to publish",
    ROOF_CERTIFICATION_PUBLISHED_DAYS === 10,
    "ten business days, recorded 2026-09-19, rendering when the gate opens",
  );
}

/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The promise covers its parts, and it is not published yet.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
