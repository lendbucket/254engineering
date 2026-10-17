/**
 * THE ADMINISTRATOR'S DASHBOARD SETTLES IN UNDER THREE SECONDS, AND OPENING IT
 * EXPORTS NOTHING.
 *
 *   BASE_URL=http://localhost:<port> node scripts/dashboard-speed-audit.mjs
 *
 * Operator ruling of the overnight of 2026-10-08: measure /portal as an
 * administrator on a production build against development data, fix the cause
 * without changing what the dashboard shows, target under two seconds, and add
 * a check that fails above three.
 *
 * WHAT THE MEASUREMENT FOUND, 2026-10-09
 * --------------------------------------
 * The page itself was never slow: its document arrived in 560 to 890 ms and
 * the load event fired inside a second. What never finished was a request to
 * /api/portal/exports?report=period. The dashboard's "Export" button was a
 * ButtonLink, which is a Next <Link>, and Next prefetches every link in view.
 * The prefetch hung for the full sixty seconds the measurement allowed, so the
 * network never went quiet and every screenshot run timed out at ninety.
 *
 * AND IT WAS WORSE THAN SLOW. The export route writes an audit row before it
 * answers, so every administrator who merely OPENED the dashboard recorded
 * "Exported margin by period" in the append-only audit log. Five measured
 * loads and two screenshot attempts wrote seven such rows on development in
 * ten minutes; development held 1,196 in all. A false entry in the firm's
 * regulatory memory, written by looking at a screen.
 *
 * THE FIX IS IN ButtonLink, so it closes the class rather than the instance:
 * an href under /api/ renders a plain anchor, which Next never prefetches.
 * Every other API link in the portal was already a plain anchor.
 *
 * THREE CHECKS, AND EACH CAN FAIL ON ITS OWN
 * ------------------------------------------
 *   time         the median of five loads reaches network idle within 3000 ms,
 *                on a page that is asserted to BE the administrator's
 *                dashboard (a redirect to sign in measured as "fast" once,
 *                before the subject was asserted)
 *   the cause    no request under /api/ is made while it loads
 *   the record   the count of export.period audit rows is the same after the
 *                loads as before them
 *
 * COULD NOT TELL when no server answers or no administrator probe can be made:
 * an unmeasured page is not a slow one and not a fast one.
 */
import { chromium } from "playwright";
import { createProbe, cookieFor, destroyProbes, probeFault } from "./lib/portal-probe.mjs";
import { COULD_NOT_TELL } from "./lib/reachable.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";

const BASE = process.env.BASE_URL ?? AUDIT_BASE_URL;
/** The ruled ceiling. A literal, so the threshold is moved on purpose or not at all. */
const CEILING_MS = 3000;
const RUNS = 5;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========== THE ADMINISTRATOR'S DASHBOARD, TIMED ==========");
console.log(`${BASE}\n`);

const alive = await fetch(`${BASE}/portal/login`).then((r) => r.ok).catch(() => false);
if (!alive) {
  console.log(`  COULD NOT TELL: nothing answers at ${BASE}, so the dashboard was not measured.`);
  process.exit(COULD_NOT_TELL);
}

const db = auditClient("dashboard-speed-audit", { neverProduction: true });
const admin = await createProbe(BASE, "admin", "dashboard-speed-audit");
const fault = probeFault({ "the administrator": admin });
if (fault || !db) {
  console.log(`  COULD NOT TELL: the dashboard was not measured (${fault ?? "no database client"}).`);
  await destroyProbes("dashboard-speed-audit");
  process.exit(COULD_NOT_TELL);
}

const exportsBefore = await db
  .from("eng_audit_events")
  .select("id", { count: "exact", head: true })
  .eq("action", "export.period");

const browser = await chromium.launch();
const times = [];
const apiCalls = [];
const seen = [];
try {
  for (let run = 1; run <= RUNS; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
    await ctx.addCookies(cookieFor(admin, BASE));
    const page = await ctx.newPage();
    page.on("request", (r) => {
      const path = r.url().replace(BASE, "");
      if (path.startsWith("/api/")) apiCalls.push(`run ${run}: ${path.slice(0, 80)}`);
    });
    const t0 = Date.now();
    await page.goto(`${BASE}/portal`, { waitUntil: "commit", timeout: 30000 }).catch(() => null);
    const idle = await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .then(() => Date.now() - t0)
      .catch(() => null);
    const what = await page
      .evaluate(() => ({
        path: location.pathname,
        h1: document.querySelector("main h1")?.textContent?.trim() ?? "",
        eyebrow: document.querySelector("main h1")?.previousElementSibling?.textContent?.trim() ?? "",
      }))
      .catch(() => ({ path: "unreadable", h1: "", eyebrow: "" }));
    seen.push(what);
    /* Network idle is 500 ms of quiet after the last request; the page settled 500 ms earlier. */
    times.push(idle === null ? null : Math.max(0, idle - 500));
    console.log(`  run ${run}: ${idle === null ? "did NOT settle within 15s" : `settled in ${idle - 500} ms`} on ${what.path} (${what.eyebrow} / ${what.h1})`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

const onDashboard = seen.every((s) => s.path === "/portal" && s.h1 === "Dashboard" && s.eyebrow === "Administrator");
rec(
  "every load measured is the administrator's dashboard, not a redirect",
  onDashboard,
  onDashboard ? `${RUNS} loads` : seen.map((s) => `${s.path} ${s.eyebrow}/${s.h1}`).join("; "),
);

const settled = times.filter((t) => t !== null).sort((a, b) => a - b);
const median = settled.length === RUNS ? settled[Math.floor(RUNS / 2)] : null;
rec(
  `the administrator's dashboard settles within ${CEILING_MS} ms (median of ${RUNS})`,
  onDashboard && median !== null && median <= CEILING_MS,
  median === null
    ? `${RUNS - settled.length} of ${RUNS} loads never went quiet, which is the hung prefetch this check exists for`
    : `median ${median} ms, runs ${times.join(", ")} ms`,
);

rec(
  "and opening it calls no API route, so no link to one is prefetched",
  apiCalls.length === 0,
  apiCalls.slice(0, 4).join("; "),
);

const exportsAfter = await db
  .from("eng_audit_events")
  .select("id", { count: "exact", head: true })
  .eq("action", "export.period");
const wrote = (exportsAfter.count ?? 0) - (exportsBefore.count ?? 0);
rec(
  "and opening it writes no export into the audit log",
  !exportsBefore.error && !exportsAfter.error && wrote === 0,
  exportsBefore.error || exportsAfter.error
    ? `the audit log could not be read: ${(exportsBefore.error ?? exportsAfter.error).message}`
    : wrote === 0
      ? `export.period rows unchanged at ${exportsAfter.count} across ${RUNS} loads`
      : `${wrote} "Exported margin by period" row(s) written by ${RUNS} loads in which nobody exported anything`,
);

const torn = await destroyProbes("dashboard-speed-audit");
rec("the probe administrator is removed", torn.ok && torn.left === 0, torn.note ?? `${torn.left} left`);

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok).length;
console.log("");
console.log(failed ? `FAIL: ${failed} of ${out.length} checks.` : `PASS: ${out.length} checks. The dashboard settles, and looking at it exports nothing.`);
process.exitCode = failed ? 1 : 0;
