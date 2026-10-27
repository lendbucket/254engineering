/**
 * A LOAD THAT NEVER GOES QUIET NAMES THE REQUESTS STILL OPEN: THE METHOD, THE
 * URL, AND HOW LONG EACH HAS BEEN OPEN.
 *
 *   node scripts/proofs/a-load-that-never-goes-quiet-names-its-open-requests.mjs
 *
 * Robert's answer 14 of 2026-10-26, 09:12 Central, after two boards
 * (40169333114, 40320368396) said "5 of 5 loads never went quiet" and nothing
 * more. A hung request is injected into a page that speaks Playwright's own
 * events (request, requestfinished, requestfailed) on a clock this proof
 * moves, so the open time is exact. Then the source: dashboard-speed-audit
 * attaches the tracker to every load, prints what is open when a load does not
 * settle, and carries it into the failing check's note.
 */
import { readFileSync } from "node:fs";
import { trackOpenRequests } from "../lib/open-requests.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A page with Playwright's request events, and requests with its method() and url(). */
function fakePage() {
  const handlers = {};
  return {
    on: (event, fn) => ((handlers[event] ??= []).push(fn)),
    emit: (event, r) => (handlers[event] ?? []).forEach((fn) => fn(r)),
  };
}
const request = (method, url) => ({ method: () => method, url: () => url });

let t = 1_000;
const clock = { now: () => t };
const page = fakePage();
const tracked = trackOpenRequests(page, clock);

check("a page with nothing requested has nothing open, and says so", tracked.openNow().length === 0 && /no request was still open/.test(tracked.describe()), tracked.describe());

const doc = request("GET", "http://localhost:4300/portal");
const css = request("GET", "http://localhost:4300/_next/static/app.css");
const prefetch = request("GET", "http://localhost:4300/portal/reports/export?period=2026-10");
const post = request("POST", "http://localhost:4300/api/portal/telemetry");
page.emit("request", doc);
t += 40;
page.emit("request", css);
page.emit("request", prefetch); /* the hung request, injected: it never finishes */
t += 10;
page.emit("request", post);
t += 200;
page.emit("requestfinished", doc);
page.emit("requestfinished", css);
page.emit("requestfailed", post);
t += 15_000;

const open = tracked.openNow();
check("a finished request and a failed one are no longer open", !open.some((o) => o.url.endsWith("/portal") || o.url.endsWith("app.css") || o.url.endsWith("/telemetry")), JSON.stringify(open));
check(
  "the hung request is named with its method, its URL, and how long it has been open",
  open.length === 1 && open[0].method === "GET" && open[0].url === "http://localhost:4300/portal/reports/export?period=2026-10" && open[0].openMs === 15_210,
  JSON.stringify(open),
);
check(
  "and the sentence a board prints carries all three",
  tracked.describe() === "GET http://localhost:4300/portal/reports/export?period=2026-10 open 15210 ms",
  tracked.describe(),
);

/* Two hung requests: both named, the longest open first. */
const second = request("PUT", "http://localhost:4300/api/portal/presence");
page.emit("request", second);
t += 500;
const two = tracked.openNow();
check("two hung requests are both named, the longest open first", two.length === 2 && two[0].openMs > two[1].openMs && two[1].method === "PUT", JSON.stringify(two));

/* The audit: attached to every load, printed, and carried into the failing note. */
const src = readFileSync("scripts/dashboard-speed-audit.mjs", "utf8");
const loop = src.slice(src.indexOf("for (let run = 1; run <= RUNS; run++)"), src.indexOf("} finally {"));
check("dashboard-speed-audit attaches the tracker to every load's page", /const tracked = trackOpenRequests\(page\);/.test(loop));
check(
  "and when a load does not settle, it records and prints what is still open",
  /if \(idle === null\) \{[\s\S]*?tracked\.describe\(\)[\s\S]*?stillOpen\.push\(/.test(loop) && /console\.log\(`    still open: \$\{named\}`\)/.test(loop),
);
check(
  "and the failing check's note names them",
  /never went quiet, which is the hung prefetch this check exists for\. Still open: \$\{stillOpen\.join\(" \| "\)\}/.test(src),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a load that never goes quiet names every request still open, with its method, URL and open time.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
