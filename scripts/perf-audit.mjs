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
 * So each route is measured RUNS times and judged on its MEDIAN.
 *
 * IT USED TO BE JUDGED ON ITS BEST RUN, AND THAT WAS WRONG
 * -------------------------------------------------------
 * Operator ruling, 2026-09-04. The argument for the best run was that it is
 * "what this page is capable of on this machine" and that a real regression
 * moves the floor. Both halves are true and it is still the wrong statistic for
 * a gate, because the minimum of three samples is decided by a single lucky
 * run. That is the same thing as calibrating on one sample, which is the
 * practice the paragraph above exists to reject, wearing a disguise.
 *
 * The median is representative. One fast sample cannot carry a route past its
 * ceiling, and one slow sample cannot fail it either.
 *
 * THIS IS STRICTER, NOT MORE FORGIVING, AND THAT IS THE POINT
 * -----------------------------------------------------------
 * Best of three fails only when all three samples exceed the ceiling. The
 * median fails when two of three do. Moving to the median therefore raises
 * every measured number and can turn a route that has always passed into one
 * that does not. A route that fails at the median is a real finding and is to
 * be reported as one, never absorbed by moving the line it crossed.
 *
 * The full spread is printed either way, so a page that is merely getting
 * noisier is visible before it starts failing.
 *
 * AND THERE IS A THIRD VERDICT, BECAUSE TWO WERE NOT ENOUGH
 * ---------------------------------------------------------
 * Operator ruling, 2026-09-07. The paragraph above says a page getting noisier
 * is visible before it starts failing, and that turned out to be optimistic:
 * the noise arrived and the failure arrived with it, in the same run.
 *
 * /careers/professional-engineer measured 2934ms with a 3ms spread on one suite
 * run and 3454ms with a 521ms spread an hour later, same machine, nothing
 * touching that route in between. The ceiling is 3400ms, so the failing margin
 * was 54ms against noise ten times its size. Both readings were reported with
 * complete confidence and neither was worth having.
 *
 * So LCP can now come back COULD NOT TELL: neither a pass nor a failure, when
 * the ceiling falls inside the observed range and that range is wider than a
 * stated fraction of the ceiling. The rule and the reasoning are in
 * scripts/lib/perf-verdict.mjs, which is a separate module precisely so it can
 * be exercised, since this file launches Chrome the moment it is imported.
 *
 * THE CEILING DOES NOT MOVE, AND UNSTABLE IS NOT A HIDING PLACE
 * -------------------------------------------------------------
 * Both halves of that are load bearing. Nothing here widens a budget: the
 * doctrine three paragraphs up still holds, and a route that fails at a
 * trustworthy median is still a real finding. And a genuinely slow page cannot
 * shelter in the new verdict, because a route whose FASTEST sample is over the
 * ceiling fails outright and never reaches it. What lands in COULD NOT TELL is
 * only the genuinely ambiguous case.
 *
 * A route that keeps landing there is telling you this profile cannot resolve
 * it. That is a finding about the instrument, and it is answered by measuring
 * on a deployment rather than by moving the line.
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
import { METRIC_BUDGETS, ROUTE_BUDGETS, REMOTE_LCP_TARGET } from "./perf-budgets.mjs";
/*
 * Pass, fail, and could not tell. In its own module so it can be exercised:
 * this file launches Chrome on load, so anything defined here is unreachable to
 * a test. See the header of scripts/lib/perf-verdict.mjs, and the bucket walk,
 * which taught the same lesson the same week.
 */
import { verdictFor, stabilityLimit } from "./lib/perf-verdict.mjs";
import { checkVerdictLogic } from "./proofs/perf-verdict-fires-where-it-should.mjs";

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

/*
 * THE GATE CHECKS ITS OWN DECISION RULE BEFORE IT MEASURES ANYTHING.
 *
 * Fourteen cases, pure, in under a second, run on every invocation rather than
 * on the day somebody remembers the proof file exists. If the rule that decides
 * pass, fail and could not tell is broken, every number below it is worthless,
 * so this aborts rather than reporting a board nobody should read.
 */
{
  const { failed, total } = checkVerdictLogic(false);
  if (failed.length) {
    console.log("");
    console.log(`THE VERDICT RULE IS BROKEN: ${failed.length} of ${total} cases fail.`);
    for (const f of failed) console.log(`  ${f}`);
    console.log("");
    console.log("Nothing was measured. A gate whose decision rule is wrong reports nothing useful.");
    console.log("  node scripts/proofs/perf-verdict-fires-where-it-should.mjs");
    process.exit(1);
  }
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/** Recorded like a check, and counted separately: it is not a pass. */
const recUnstable = (name, note) => out.push({ name, ok: true, unstable: true, note });
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

  /*
   * MEDIAN per metric, and the spread, so noise is visible.
   *
   * Each metric is taken independently rather than picking one "median run" and
   * reading every metric off it. A run can be fast to paint and heavy on the
   * wire, so a single representative run would report a bytes figure that no
   * ceiling was ever calibrated against. Per metric is what the budgets mean.
   */
  const medianOf = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const median = {
    lcp: medianOf(ok.map((r) => r.lcp)),
    cls: medianOf(ok.map((r) => r.cls)),
    tbt: medianOf(ok.map((r) => r.tbt)),
    bytes: medianOf(ok.map((r) => r.bytes)),
  };
  /*
   * Spread is the full observed RANGE, slowest minus fastest, which is what it
   * always meant. It is deliberately not measured from the median: a spread
   * reported relative to the median would understate the noise by about half,
   * and this number exists to make noise visible.
   */
  const spread = {
    lcp: Math.max(...ok.map((r) => r.lcp)) - Math.min(...ok.map((r) => r.lcp)),
    bytes: Math.max(...ok.map((r) => r.bytes)) - Math.min(...ok.map((r) => r.bytes)),
  };
  const summary = ok[0].summary;

  rows.push({ ...route, median, spread, summary, runs: ok.length });

  /*
   * A route may carry its OWN lcp ceiling, and one does. Everything else is
   * judged against the shared one, so re-deriving a number for the page that
   * needed it does not quietly loosen the other nine. The reasoning for the one
   * override is in perf-budgets.mjs above ROUTE_BUDGETS.
   */
  const lcpCeiling = route.lcp ?? CEILINGS.lcp;

  /*
   * LCP is the only metric that gets the three state verdict, because it is the
   * only one whose noise has ever been comparable to its margin. CLS and TBT
   * measure in the single digits against ceilings of 0.05 and 200ms, and bytes
   * do not vary between runs of the same build at all. Giving them a stability
   * rule they cannot exercise would be a check that never fires.
   */
  const lcpSamples = ok.map((r) => r.lcp);
  const lcpVerdict = verdictFor(lcpSamples, lcpCeiling);
  const lcpNote = `${route.path}, median of ${ok.length}, spread ${Math.round(spread.lcp)}ms${
    route.lcp ? ", its own ceiling" : ""
  }`;

  if (lcpVerdict === "unstable") {
    recUnstable(
      `${route.name}: LCP ${Math.round(median.lcp)}ms against ${lcpCeiling}ms, NOT STABLE ENOUGH TO GATE ON`,
      `${lcpNote}. The range ${Math.round(Math.min(...lcpSamples))} to ${Math.round(
        Math.max(...lcpSamples),
      )}ms straddles the ceiling and is wider than ${Math.round(
        stabilityLimit(lcpCeiling),
      )}ms, so this run cannot say. Measure on a deployment.`,
    );
  } else {
    rec(
      `${route.name}: LCP ${Math.round(median.lcp)}ms within ${lcpCeiling}ms`,
      lcpVerdict === "pass",
      lcpVerdict === "fail" && Math.min(...lcpSamples) > lcpCeiling
        ? `${lcpNote}. Every sample was over, so this is not noise.`
        : lcpNote,
    );
  }
  rec(
    `${route.name}: CLS ${median.cls.toFixed(3)} within ${CEILINGS.cls}`,
    median.cls <= CEILINGS.cls,
    route.path,
  );
  rec(
    `${route.name}: TBT ${Math.round(median.tbt)}ms within ${CEILINGS.tbt}ms`,
    median.tbt <= CEILINGS.tbt,
    route.path,
  );
  rec(
    `${route.name}: ${kb(median.bytes)}KB within ${route.kb}KB budget`,
    kb(median.bytes) <= route.kb,
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
console.log(`${BASE}, 4x CPU, 1.6Mbps, 150ms RTT, MEDIAN of ${RUNS} runs`);
console.log(
  `ceilings: ${IS_LOCAL ? "local" : "remote"} profile, LCP ${CEILINGS.lcp}ms, CLS ${CEILINGS.cls}, TBT ${CEILINGS.tbt}ms\n`,
);
console.log("  median values. (spread) is the full observed range, slowest minus fastest.");
console.log("  LCP ms  (spread)   CLS    TBT ms   total KB / budget   HTML   JS  font   img  route");
for (const r of rows) {
  if (r.failed) {
    console.log(`  measurement failed: ${r.path}`);
    continue;
  }
  const s = (k) => String(kb(r.summary[k] ?? 0)).padStart(4);
  console.log(
    `  ${String(Math.round(r.median.lcp)).padStart(6)}  ${`(+${Math.round(r.spread.lcp)})`.padStart(8)}  ${r.median.cls
      .toFixed(3)
      .padStart(5)}  ${String(Math.round(r.median.tbt)).padStart(6)}   ${String(kb(r.median.bytes)).padStart(
      8,
    )} / ${String(r.kb).padEnd(5)}  ${s("document")}  ${s("script")}  ${s("font")}  ${s("image")}  ${r.path}`,
  );
}

console.log("\n=== RESULT ===");
for (const r of out) {
  const label = r.unstable ? "COULD NOT TELL" : r.ok ? "PASS" : "FAIL";
  console.log(`  ${label}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}

const failed = out.filter((r) => !r.ok);
const unstable = out.filter((r) => r.unstable);
console.log("");

/*
 * UNSTABLE IS REPORTED LOUDLY AND DOES NOT FAIL THE RUN.
 *
 * That is the ruling and it is the right trade, but it has one edge worth
 * naming rather than discovering: a page that is genuinely slow AND always
 * noisy would report this forever and never fail. It cannot hide here, because
 * a route whose FASTEST sample is over the ceiling fails outright and never
 * reaches this state. What lands here is only the genuinely ambiguous case,
 * where the ceiling sits inside the observed range.
 *
 * A route that keeps landing here is telling you the local profile cannot
 * resolve it, which is a finding about the instrument and is answered by
 * measuring on a deployment, not by widening the ceiling.
 */
if (unstable.length) {
  console.log(`${unstable.length} measurement(s) were too unstable to gate on:`);
  for (const r of unstable) console.log(`  ${r.name}`);
  console.log("");
  console.log("These are neither passes nor failures. The ceiling has not moved and the page");
  console.log("has not been absolved. This machine could not resolve the margin, which is a");
  console.log("fact about the measurement. Measure on a deployment:");
  console.log("");
  console.log("  BASE_URL=https://254engineering.com PERF_RUNS=5 npx tsx scripts/perf-audit.mjs");
  console.log("");
}

/*
 * THE TARGET, REPORTED BESIDE THE GATE AND NEVER ENFORCED AS ONE.
 *
 * Operator ruling, 2026-09-07, when the two were separated: the gap between
 * what the site does and what the operator wants it to do stays visible rather
 * than being absorbed by a ceiling it can pass.
 *
 * This is the only place in the suite where a number is printed that cannot
 * turn the board red, and that is deliberate. It is a target. Enforcing it from
 * this measuring position is what produced eight COULD NOT TELL verdicts in a
 * row, because the instrument's resolution is wider than the distance between
 * the target and the pages.
 */
if (!IS_LOCAL && rows.some((r) => !r.failed)) {
  const measured = rows.filter((r) => !r.failed);
  const meeting = measured.filter((r) => r.median.lcp <= REMOTE_LCP_TARGET);

  console.log("");
  console.log(`AGAINST THE ${REMOTE_LCP_TARGET}ms TARGET, which is not a gate and cannot fail this run:`);
  console.log("");
  for (const r of measured) {
    const over = Math.round(r.median.lcp) - REMOTE_LCP_TARGET;
    console.log(
      `  ${(over <= 0 ? "meets " : "over  ").padEnd(7)}${String(Math.round(r.median.lcp)).padStart(5)}ms  ${
        over <= 0 ? `${String(-over).padStart(4)}ms under` : `${String(over).padStart(4)}ms over `
      }  ${r.path}`,
    );
  }
  console.log("");
  console.log(
    `  ${meeting.length} of ${measured.length} routes meet the target at the median. The gate is ${CEILINGS.lcp}ms and is a different number for a reason: see perf-budgets.mjs.`,
  );
}

if (failed.length === 0) {
  const solid = out.length - unstable.length;
  console.log(
    `PASS: ${solid} checks across ${rows.length} templates${
      unstable.length ? `, and ${unstable.length} that could not be decided` : ""
    }.`,
  );
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("Budgets are in scripts/perf-budgets.mjs. Raise one only with the reason recorded.");
  process.exitCode = 1;
}
