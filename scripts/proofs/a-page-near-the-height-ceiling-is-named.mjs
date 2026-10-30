/**
 * A page close to its height ceiling is named before a board fails on it, and
 * the naming is a warning only.
 *
 * Robert, 15:08 Central 2026-10-30: "Yes to the height audit warning within
 * 1,000 px of the ceiling, a warning only." mobile-overflow-audit runs only on
 * the board, so the decision of which routes warn lives in a pure function,
 * scripts/lib/height-headroom.mjs, and this proof tests that function with no
 * server.
 *
 * The figures are the board's own: /insights failed at 16,027px on
 * 2026-10-30, and /insights/wpi-8-certificate then stood at 15,326px, 674px
 * under the 16,000px public ceiling, with nothing saying so.
 */
import { nearCeiling, HEIGHT_WARNING_HEADROOM_PX } from "../lib/height-headroom.mjs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

/* The audit's rule for public content, pinned as a literal rather than imported. */
const ceilingFor = (route) =>
  /^\/(portal|partner|account)(\/|$)/.test(route)
    ? { limit: 9_000, kind: "application" }
    : { limit: 16_000, kind: "public content" };

check("the headroom is the ruled 1,000px", HEIGHT_WARNING_HEADROOM_PX === 1000, `${HEIGHT_WARNING_HEADROOM_PX}`);

const heights = [
  { route: "/insights/wpi-8-certificate", height: 15_326 },
  { route: "/insights/pre-purchase-home-inspection", height: 14_999 },
  { route: "/insights", height: 16_027 },
  { route: "/coverage", height: 7_356 },
  { route: "/portal/queue", height: 8_500 },
];
const near = nearCeiling(heights, ceilingFor);
const byRoute = new Map(near.map((h) => [h.route, h]));

const wpi = byRoute.get("/insights/wpi-8-certificate");
check("a page at 15,326px is named", Boolean(wpi), JSON.stringify(near.map((h) => h.route)));
check("with 674px of headroom", wpi?.headroom === 674, `${wpi?.headroom}`);
check("a page at 14,999px is not named", !byRoute.has("/insights/pre-purchase-home-inspection"));
check(
  "a page over its ceiling is not a warning (it stays a finding in the audit's own path)",
  !byRoute.has("/insights"),
);
check("an application screen within 1,000px of its own 9,000px ceiling is named", byRoute.has("/portal/queue"));
check("a page far under its ceiling is not named", !byRoute.has("/coverage"));
check(
  "the function returns names and headroom, never a verdict",
  near.every((h) => Object.keys(h).sort().join(",") === "headroom,height,kind,limit,route"),
  JSON.stringify(near[0] ?? {}),
);

/* The audit must call it and must not turn it into a finding. */
const { readFileSync } = await import("node:fs");
const audit = readFileSync(new URL("../mobile-overflow-audit.mjs", import.meta.url), "utf8");
const block = audit.slice(audit.indexOf("const near = nearCeiling("), audit.indexOf("const checks = [];"));
check("mobile-overflow-audit calls nearCeiling", audit.includes("nearCeiling(sorted, ceilingFor)"));
check("and pushes nothing from it into findings or checks", block.length > 0 && !/findings\.push|checks\.push/.test(block), `${block.length} chars read`);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: a page within ${HEIGHT_WARNING_HEADROOM_PX}px of its height ceiling is named as a warning, and the warning decides nothing.`
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
