/**
 * PASS, FAIL, AND COULD NOT TELL.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * It was going to live inside perf-audit.mjs, which launches Chrome on load and
 * therefore cannot be imported by a test. The bucket walk taught that lesson
 * the expensive way in the same week: a function a whole verdict depends on,
 * buried in a script nothing can import, is a function nothing can exercise.
 * The first version of its test had to keep a character for character copy of
 * the source and assert the copy matched, which is a workaround for a shape
 * that should not exist.
 *
 * WHY A THIRD VERDICT EXISTS AT ALL
 * ----------------------------------
 * Operator ruling, 2026-09-07: a gate that says it could not tell is more
 * useful than one that flaps, and the ceiling does not move.
 *
 * /careers/professional-engineer measured 2934ms with a 3ms spread on one suite
 * run and 3454ms with a 521ms spread about an hour later, on the same machine,
 * with nothing touching that route in between. The ceiling is 3400ms, so the
 * failing margin was 54ms and the noise was ten times it. Both readings were
 * reported with total confidence and neither was worth having.
 *
 * That is the fault the operator had ruled on for contrast-audit's networkidle
 * timing the day before: an audit whose red and green both depend on how busy
 * the machine is has stopped being evidence in either direction.
 *
 * WHEN THE MEDIAN IS STILL ALLOWED TO DECIDE
 * -------------------------------------------
 * Noise alone does not make a measurement useless. What makes it useless is
 * noise AND a ceiling falling inside the observed range, because then the
 * answer depends on which samples happened to land where.
 *
 *   every sample under the ceiling   PASS, and noise cannot change it
 *   every sample over the ceiling    FAIL, and noise cannot explain it away
 *   the ceiling inside the range,
 *     and the range is wide          UNSTABLE, which is neither
 *   otherwise                        the median decides, as it always did
 *
 * The first two matter most. A genuinely slow page still fails on a noisy
 * machine, because if even the FASTEST run is over the ceiling then no amount
 * of noise accounts for it. UNSTABLE cannot become a hiding place for a page
 * that is simply slow.
 *
 * WHY THE TOLERANCE IS A FRACTION OF THE CEILING, NOT OF THE MEASUREMENT
 * ----------------------------------------------------------------------
 * The ceiling is the fixed thing. A tolerance defined against the measurement
 * would widen as a page got slower, which is precisely the wrong direction: the
 * slower and noisier a page became, the more willing that rule would be to
 * excuse its own uncertainty.
 */

/**
 * Ten percent. On the 3400ms LCP ceiling that is 340ms.
 *
 * Every healthy route in this suite measures a spread well under 100ms. The two
 * readings that provoked the ruling were 521ms and 523ms. The figure is stated
 * here rather than inlined so that changing it is a visible act.
 */
export const INSTABILITY_FRACTION = 0.1;

/** The widest spread that still permits a verdict, for a given ceiling. */
export function stabilityLimit(ceiling) {
  return ceiling * INSTABILITY_FRACTION;
}

/**
 * @param {number[]} samples  Every successful measurement, unsorted.
 * @param {number} ceiling
 * @returns {"pass"|"fail"|"unstable"}
 */
export function verdictFor(samples, ceiling) {
  const lo = Math.min(...samples);
  const hi = Math.max(...samples);

  /* Conclusive either way, whatever the noise. */
  if (hi <= ceiling) return "pass";
  if (lo > ceiling) return "fail";

  /*
   * The ceiling is inside the range. Only now does the width of that range
   * decide whether a median means anything.
   */
  if (hi - lo > stabilityLimit(ceiling)) return "unstable";

  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return median <= ceiling ? "pass" : "fail";
}
