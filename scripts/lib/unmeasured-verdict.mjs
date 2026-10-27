/**
 * ===========================================================================
 * WHAT A BROWSER AUDIT ANSWERS WHEN SOME OF WHAT IT WAS ASKED NEVER LOADED.
 * ===========================================================================
 *
 * Robert's ruling of 2026-10-26, 08:19 Central, answer 9, from board
 * 40266030302: the run's probe accounts were deleted mid-run, every later
 * route bounced to sign in, and mobile-audit printed 284 combinations as
 * `hscroll=FAIL taps=FAIL clip=FAIL phone=FAIL`, measurements that never
 * happened. Meanwhile a route that never loaded for another reason exited 0
 * ("GREEN ON WHAT LOADED"), which the board records as PASS.
 *
 * The ruling, in three parts, each one line below:
 *   - a route it never measured reports COULD NOT TELL, never FAIL and never
 *     PASS (exit 3, which the board counts against a merge exactly as a FAIL);
 *   - a FAIL on anything it did measure is still a FAIL (exit 1);
 *   - and if more than MAX_UNMEASURED_ROUTE_SHARE of the routes could not be
 *     measured, the audit fails outright (exit 1), so a run that loses its sign
 *     in cannot look partial and fine.
 *
 * A route counts as unmeasured when any one of its widths was not measured.
 * The share is pinned as a literal in the proof, so moving it costs two edits.
 */
import { COULD_NOT_TELL } from "./reachable.mjs";

/** Above this share of routes unmeasured, the run measured too little to stand. */
export const MAX_UNMEASURED_ROUTE_SHARE = 0.1;

/**
 * @param {{ failures: string[], unmeasuredRoutes: number, totalRoutes: number }} run
 * @returns {{ exitCode: 0 | 1 | 3, verdict: "PASS" | "FAIL" | "COULD NOT TELL", headline: string }}
 */
export function unmeasuredVerdict({ failures, unmeasuredRoutes, totalRoutes }) {
  if (!Number.isInteger(totalRoutes) || totalRoutes <= 0) {
    return { exitCode: 1, verdict: "FAIL", headline: "No routes were declared, so nothing was measured, which is not a pass." };
  }
  const share = unmeasuredRoutes / totalRoutes;
  if (share > MAX_UNMEASURED_ROUTE_SHARE) {
    return {
      exitCode: 1,
      verdict: "FAIL",
      headline:
        `${unmeasuredRoutes} of ${totalRoutes} routes could not be measured, more than ` +
        `${Math.round(MAX_UNMEASURED_ROUTE_SHARE * 100)}%, so this run measured too little to stand. ` +
        "A lost sign in or a dead server looks like this.",
    };
  }
  if (failures.length > 0) {
    return { exitCode: 1, verdict: "FAIL", headline: `${failures.length} FAILURE(S) on what was measured.` };
  }
  if (unmeasuredRoutes > 0) {
    return {
      exitCode: COULD_NOT_TELL,
      verdict: "COULD NOT TELL",
      headline: `COULD NOT TELL: ${unmeasuredRoutes} of ${totalRoutes} routes were not measured. Nothing measured failed, and that is not a pass.`,
    };
  }
  return { exitCode: 0, verdict: "PASS", headline: "Every route measured." };
}
