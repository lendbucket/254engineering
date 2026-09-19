/**
 * ===========================================================================
 * WHAT THE FIRM PUBLISHES, AND WHICH PART OF IT BELONGS TO WHOM.
 * Operator ruling, 2026-09-19.
 * ===========================================================================
 *
 * The published figure is ONE number a customer reads. It is made of parts
 * owned by different people, and the operator's instruction was to record his
 * and Aman's SEPARATELY "so we can see which part slips". A single published
 * figure with no parts behind it is a promise nobody can diagnose: when it is
 * missed, there is no way to say whether the engineer was slow, the scheduling
 * was slow, or the figure was always wrong.
 *
 * So the segments are the record and the published figure is asserted against
 * them rather than typed beside them.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE RENDERS WHILE THE GATE IS SHUT, AND THAT IS THE OPERATOR'S OWN
 * CORRECTION RATHER THAN A CONSTRAINT HE WORKED AROUND.
 * ---------------------------------------------------------------------------
 *
 * He gave the figure as "turnaround, published", and then withdrew the
 * rendering himself when the conflict was put to him:
 *
 *   "Hold it behind the gate. You are right and I gave the wrong instruction by
 *    implication. The gate is registered and trading today, not open, and a
 *    published turnaround is a promise about fulfilment the firm cannot yet
 *    make with no technician. Render it when the gate opens. Record both
 *    figures in the price book now so they exist; publish when the gate does."
 *
 * And the part worth keeping above the figures themselves: "That is not an
 * override request. I asked you to refuse a false public claim even with my
 * word given, and holding it is that rule working."
 *
 * So these constants EXIST from today and REACH A PAGE when `isOpen()` answers
 * true. `turnaroundCopy` in src/content/model-copy.ts is the one caller, and
 * launch-audit asserts no rendered page carries a figure while prelaunch.
 *
 * ---------------------------------------------------------------------------
 * REVISIT AFTER TEN JOBS. Recorded as a number rather than an intention.
 * ---------------------------------------------------------------------------
 *
 * The operator ruled the figures are provisional and revisited after ten
 * completed jobs. A resolution to revisit something, recorded nowhere, is a
 * resolution nobody will keep: this platform has met that failure already in a
 * document that recorded a deletion as done when nothing had checked.
 */

export type Segment = {
  /** Who is accountable for this stretch of the clock. */
  owner: "engineer" | "firm";
  /** What happens during it, in the words the owner used. */
  what: string;
  /**
   * Business days. `max` is what the published figure is checked against,
   * because a range published as its own minimum is a promise kept only on the
   * good days.
   */
  minDays: number;
  maxDays: number;
  /** Whose figure this is, so a disagreement has a name attached. */
  statedBy: string;
};

/**
 * THE ROOF CERTIFICATION CLOCK, END TO END.
 *
 * Aman's figure is engineer side only and begins at a COMPLETE PACKAGE, which
 * is the phrase he used and it matters: his clock does not start until the
 * evidence is in and complete, so a technician who submits a short package has
 * not started it. The operator's two segments are the firm's.
 */
export const ROOF_CERTIFICATION_SEGMENTS: Segment[] = [
  {
    owner: "firm",
    what: "From the order to the technician standing at the property.",
    minDays: 2,
    maxDays: 2,
    statedBy: "the operator, 2026-09-19",
  },
  {
    owner: "engineer",
    what: "From a complete evidence package to a sealed determination.",
    minDays: 5,
    maxDays: 7,
    statedBy: "Aman Dhakal, 2026-09-19",
  },
  {
    owner: "firm",
    what: "From the seal to the document in the customer's hands.",
    /*
     * Same day. Recorded as zero business days rather than as a special case,
     * so the arithmetic below needs no branch: the sum is what the customer
     * waits, and a same day step adds nothing to it.
     */
    minDays: 0,
    maxDays: 0,
    statedBy: "the operator, 2026-09-19",
  },
];

/**
 * What the firm publishes for a roof certification, end to end.
 *
 * TEN, AND THE SEGMENTS SUM TO NINE AT WORST. The extra day is slack and it is
 * deliberate rather than a rounding: a published figure equal to the sum of its
 * parts is a figure that is missed the first time any part has a bad week.
 *
 * `turnaround-audit` asserts the published figure is at least the sum of the
 * maxima. If somebody later shortens the published number without shortening a
 * segment, the firm would be publishing a promise its own parts cannot meet,
 * and that is the check rather than a comment.
 */
export const ROOF_CERTIFICATION_PUBLISHED_DAYS = 10;

/**
 * Design, which is quoted per job.
 *
 * TEN BUSINESS DAYS IS A WORKING FIGURE RATHER THAN A PUBLISHED PROMISE, and
 * the distinction is the operator's: design is quoted from the engineer's own
 * estimate once he has read the brief, so the honest public sentence is that
 * the date is agreed when the work is scoped. The number exists here so that
 * somebody quoting has a default to start from and a figure to be measured
 * against.
 */
export const DESIGN_WORKING_DAYS = 10;

/** The figures are provisional. This is when they are looked at again. */
export const REVISIT_AFTER_JOBS = 10;

/** The sum of a clock's segments, at its worst. */
export function totalDays(segments: Segment[]): { min: number; max: number } {
  return segments.reduce(
    (acc, s) => ({ min: acc.min + s.minDays, max: acc.max + s.maxDays }),
    { min: 0, max: 0 },
  );
}

/**
 * What each side owns, for the screen that will eventually show which part
 * slipped.
 *
 * Kept here rather than computed on a screen, because "the engineer's share of
 * the published figure" is a fact about the ruling rather than a presentation
 * detail, and a screen computing its own version is the second home this
 * repository keeps finding.
 */
export function shareOf(owner: Segment["owner"], segments: Segment[]): { min: number; max: number } {
  return totalDays(segments.filter((s) => s.owner === owner));
}
