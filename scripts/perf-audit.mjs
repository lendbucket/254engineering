/**
 * The performance gate.
 *
 *   BASE_URL=http://localhost:3225 node scripts/perf-audit.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * seo-audit runs Lighthouse for the SEO category only, deliberately. That left
 * loading, bundle size, image weight, and layout stability with no gate at all,
 * which means every regression in them shipped silently. The site measures well
 * today. This is here so it still does in six months.
 *
 * WHAT IT ASSERTS
 * ---------------
 * Per route: LCP, CLS, and TBT against the ceilings in perf-budgets.mjs, and
 * total transferred bytes against a per template budget. Budgets and ceilings
 * live in that file with the reasoning; nothing is hardcoded here.
 *
 * LIGHTHOUSE VARIES RUN TO RUN, AND THE GATE IS BUILT FOR THAT
 * ------------------------------------------------------------
 * Measured on this site: the same route, same profile, same build, moved by up
 * to 740ms of LCP between consecutive runs. A gate calibrated on a single run is
 * a coin toss that wakes somebody up at two in the morning.
 *
 * So each route is measured RUNS times and judged on its BEST run rather than
 * its worst or its mean. That is the right choice for a gate rather than for a
 * report: the best run is the closest thing available to "what this page is
 * capable of on this machine", and a genuine regression moves the floor, not
 * just the noise. A page that cannot hit the budget once in three attempts has
 * really regressed. The full spread is printed either way, so a page that is
 * merely getting noisier is visible before it starts failing.
 *
 * THE THROTTLING PROFILE IS WRITTEN OUT RATHER THAN INHERITED
 * -----------------------------------------------------------
 * 4x CPU, 1.6Mbps, 150ms RTT, stated explicitly. Lighthouse's mobile default is
 * currently the same, and if that default ever moves, the budgets in
 * perf-budgets.mjs would silently start measuring something else.
 */
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "playwright";
import { METRIC_BUDGETS, ROUTE_BUDGETS } from "./perf-budgets.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const RUNS = Number(process.env.PERF_RUNS || 3);

/*
 * Which ceilings apply is decided by the host being measured, not by a flag
 * somebody can set to make a red build green. A localhost build is judged
 * against the empirical local ceiling; anything else is a real deployment and
 * gets the operator's specification. The measurements behind the two numbers,
 * and the part of the gap this pass could not explain, are in perf-budgets.mjs.
 */
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(BASE);
const CEILINGS = IS_LOCAL ? METRIC_BUDGETS.local : METRIC_BUDGETS.remote;

const SETTINGS = {
  formFactor: "mobile",
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
  throttlingMethod: "simulate",
  throttling: {
    rttMs: 150,
    throughputKbps: 1600,
    cpuSlowdownMultiplier: 4,
    requestLatencyMs: 150 * 3.75,
    downloadThroughputKbps: 1600 * 0.9,
    uploadThroughputKbps: 750,
  },
};

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const kb = (bytes) => Math.round(bytes / 1024);

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

const rows = [];

for (const route of ROUTE_BUDGETS) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      const r = await lighthouse(
        `${BASE}${route.path}`,
        { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
        { extends: "lighthouse:default", settings: SETTINGS },
      );
      const a = r.lhr.audits;
      const summary = {};
      for (const item of a["resource-summary"]?.details?.items ?? []) {
        summary[item.resourceType] = item.transferSize;
      }
      runs.push({
        lcp: a["largest-contentful-paint"]?.numericValue ?? Infinity,
        cls: a["cumulative-layout-shift"]?.numericValue ?? Infinity,
        tbt: a["total-blocking-time"]?.numericValue ?? Infinity,
        bytes: summary.total ?? Infinity,
        summary,
      });
    } catch (err) {
      runs.push({ error: String(err.message).split("\n")[0] });
    }
  }

  const ok = runs.filter((r) => !r.error);
  if (ok.length === 0) {
    rec(`${route.name}: measured`, false, runs[0]?.error ?? "no successful run");
    rows.push({ ...route, failed: true });
    continue;
  }

  // Best run per metric, and the spread, so noise is visible.
  const best = {
    lcp: Math.min(...ok.map((r) => r.lcp)),
    cls: Math.min(...ok.map((r) => r.cls)),
    tbt: Math.min(...ok.map((r) => r.tbt)),
    bytes: Math.min(...ok.map((r) => r.bytes)),
  };
  const spread = {
    lcp: Math.max(...ok.map((r) => r.lcp)) - best.lcp,
    bytes: Math.max(...ok.map((r) => r.bytes)) - best.bytes,
  };
  const summary = ok[0].summary;

  rows.push({ ...route, best, spread, summary, runs: ok.length });

  rec(
    `${route.name}: LCP ${Math.round(best.lcp)}ms within ${CEILINGS.lcp}ms`,
    best.lcp <= CEILINGS.lcp,
    `${route.path}, best of ${ok.length}, spread ${Math.round(spread.lcp)}ms`,
  );
  rec(
    `${route.name}: CLS ${best.cls.toFixed(3)} within ${CEILINGS.cls}`,
    best.cls <= CEILINGS.cls,
    route.path,
  );
  rec(
    `${route.name}: TBT ${Math.round(best.tbt)}ms within ${CEILINGS.tbt}ms`,
    best.tbt <= CEILINGS.tbt,
    route.path,
  );
  rec(
    `${route.name}: ${kb(best.bytes)}KB within ${route.kb}KB budget`,
    kb(best.bytes) <= route.kb,
    route.path,
  );
  console.error(`  measured ${route.path}`);
}

try {
  await chrome.kill();
} catch {
  /* chrome-launcher cannot always remove its temp dir on Windows */
}

console.log("================ PERFORMANCE ================");
console.log(`${BASE}, 4x CPU, 1.6Mbps, 150ms RTT, best of ${RUNS} runs`);
console.log(
  `ceilings: ${IS_LOCAL ? "local" : "remote"} profile, LCP ${CEILINGS.lcp}ms, CLS ${CEILINGS.cls}, TBT ${CEILINGS.tbt}ms\n`,
);
console.log("  LCP ms  (spread)   CLS    TBT ms   total KB / budget   HTML   JS  font   img  route");
for (const r of rows) {
  if (r.failed) {
    console.log(`  measurement failed: ${r.path}`);
    continue;
  }
  const s = (k) => String(kb(r.summary[k] ?? 0)).padStart(4);
  console.log(
    `  ${String(Math.round(r.best.lcp)).padStart(6)}  ${`(+${Math.round(r.spread.lcp)})`.padStart(8)}  ${r.best.cls
      .toFixed(3)
      .padStart(5)}  ${String(Math.round(r.best.tbt)).padStart(6)}   ${String(kb(r.best.bytes)).padStart(
      8,
    )} / ${String(r.kb).padEnd(5)}  ${s("document")}  ${s("script")}  ${s("font")}  ${s("image")}  ${r.path}`,
  );
}

console.log("\n=== RESULT ===");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks across ${rows.length} templates.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("Budgets are in scripts/perf-budgets.mjs. Raise one only with the reason recorded.");
  process.exitCode = 1;
}
