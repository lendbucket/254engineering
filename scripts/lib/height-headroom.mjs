/**
 * Which measured routes are close to their height ceiling, so they can be named
 * before a board fails on them.
 *
 * A WARNING ONLY. Robert, 15:08 Central 2026-10-30: "Yes to the height audit
 * warning within 1,000 px of the ceiling, a warning only." The ceiling itself is
 * enforced in scripts/mobile-overflow-audit.mjs and is not touched here; this
 * function returns names and headroom, never a verdict, and nothing it returns
 * is pushed into a finding or changes an exit code.
 *
 * Why it exists: /insights reached 16,027px on 2026-10-30 and failed a board by
 * 27px, and once it was shortened /insights/wpi-8-certificate became the tallest
 * public page at 15,326px, 674px under the ceiling, with nothing on the board
 * saying so.
 */
export const HEIGHT_WARNING_HEADROOM_PX = 1000;

/**
 * @param {{ route: string, height: number }[]} heights measured at 390
 * @param {(route: string) => { limit: number, kind: string }} ceilingFor the audit's own ceiling rule
 * @param {number} [headroom]
 * @returns {{ route: string, height: number, limit: number, kind: string, headroom: number }[]}
 *   routes at or under their ceiling and within `headroom` of it, tallest first.
 *   A route over its ceiling is not returned: it is a finding in the audit's own
 *   path, and naming it here as well would blur a failure into a warning.
 */
export function nearCeiling(heights, ceilingFor, headroom = HEIGHT_WARNING_HEADROOM_PX) {
  return heights
    .map((h) => {
      const c = ceilingFor(h.route);
      return { route: h.route, height: h.height, limit: c.limit, kind: c.kind, headroom: c.limit - h.height };
    })
    .filter((h) => h.height <= h.limit && h.headroom <= headroom)
    .sort((a, b) => b.height - a.height);
}
