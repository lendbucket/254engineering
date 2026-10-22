/**
 * PROOF: THE EMAILS AN INTAKE ROUTE QUEUES AFTER ITS ANSWER ARE QUEUED INSIDE
 * after(), AND EVERY ENQUEUE IS AWAITED.
 *
 * Operator ruling, 2026-10-21. The design, windstorm and lead routes answer
 * the person before the firm notification and the acknowledgement are queued
 * (10fa468, so forms-audit reads the success on screen at 900ms). On Vercel a
 * promise left running after the response can be stopped with the function,
 * and the emails then never queue and nothing says so. Next's after() keeps
 * the function alive until the callback settles, so the enqueue has to be
 * inside it, and awaited there, because after() waits only for the promise
 * its callback returns.
 *
 * WHAT IT REFUSES, each one a way the email is silently lost:
 *   - an enqueue that is not awaited, inside after() or out of it (a bare
 *     promise, `void queueEmail(...)`, or `queueEmail(...).then(...)`);
 *   - an acknowledgement or inquiry notification queued outside after();
 *   - an after() that is not the one from next/server;
 *   - an after() callback that is not async, so an await inside cannot exist.
 *
 * IT READS THE SOURCE, and the judge is one function run twice: over the
 * shapes below, which it must refuse, and then over the three route files,
 * which it must pass. A judge that refuses nothing would pass the routes for
 * the wrong reason, so the refusals are asserted first.
 */
import { readFileSync } from "node:fs";

/* The templates a route sends after it has answered, by ruling Q6 and addition d. */
const AFTER_RESPONSE = new Set(["inquiryAcknowledged", "inquiryNotification"]);

/* Each route, and how many after-response enqueues it carries, so a judge that finds none cannot pass. */
const ROUTES = [
  { file: "src/app/api/design-inquiry/route.ts", afterResponse: 2 },
  { file: "src/app/api/windstorm-inquiry/route.ts", afterResponse: 2 },
  { file: "src/app/api/lead/route.ts", afterResponse: 1 },
];

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => (/^\s*\/\//.test(line) ? "" : line))
    .join("\n");
}

/* The span of a call whose opening parenthesis is at `open`, by counting parentheses. */
function closeOf(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function callsOf(src, name) {
  const out = [];
  const re = new RegExp(`(^|[^A-Za-z0-9_$.])${name}\\(`, "g");
  for (const m of src.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    out.push({ at: open - name.length, open, close: closeOf(src, open) });
  }
  return out;
}

/** Returns a list of findings; empty means the source passes. Also counts the after-response enqueues. */
export function judge(raw) {
  const src = stripComments(raw);
  const findings = [];
  const afters = callsOf(src, "after");
  if (afters.length > 0 && !/import\s*\{[^}]*\bafter\b[^}]*\}\s*from\s*"next\/server"/.test(src)) {
    findings.push("after() is called but is not imported from next/server");
  }
  for (const a of afters) {
    if (!/^\(\s*async\s*\(/.test(src.slice(a.open, a.open + 40))) findings.push("an after() callback is not async");
  }
  let afterResponse = 0;
  for (const q of callsOf(src, "queueEmail")) {
    const template = /^\(\s*([A-Za-z0-9_$]+)/.exec(src.slice(q.open))?.[1] ?? "(unnamed)";
    const before = src.slice(Math.max(0, q.at - 40), q.at);
    const awaited = /await\s*$/.test(before);
    const inside = afters.some((a) => q.at > a.open && q.at < a.close);
    if (!awaited) findings.push(`queueEmail(${template}) is not awaited, so nothing keeps it alive`);
    if (AFTER_RESPONSE.has(template)) {
      if (inside) afterResponse++;
      else findings.push(`queueEmail(${template}) is outside after()`);
    }
  }
  return { findings, afterResponse };
}

let wrong = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) wrong++;
}

/* ------------------------------------------------ the shapes it must refuse */

const IMPORT = 'import { NextResponse, after } from "next/server";\n';
const REFUSE = [
  ["a bare promise after the answer", IMPORT + "queueEmail(inquiryAcknowledged({ kind, email }));\nreturn NextResponse.json({ ok: true });"],
  ["a void enqueue", IMPORT + "void queueEmail(inquiryAcknowledged({ kind, email }));"],
  ["an enqueue chained with then", IMPORT + "queueEmail(inquiryNotification(x)).then((r) => r);"],
  ["a bare promise inside after()", IMPORT + "after(async () => {\n  queueEmail(inquiryAcknowledged({ kind, email }));\n});"],
  ["an awaited acknowledgement outside after()", IMPORT + "await queueEmail(inquiryAcknowledged({ kind, email }));"],
  ["an after() from somewhere else", 'import { after } from "./mine";\nafter(async () => { await queueEmail(inquiryAcknowledged(x)); });'],
  ["a callback that is not async", IMPORT + "after(() => queueEmail(inquiryAcknowledged(x)));"],
];
for (const [label, src] of REFUSE) {
  const { findings } = judge(src);
  check(`refuses ${label}`, findings.length > 0, findings.join("; ") || "nothing found");
}
const good = judge(IMPORT + "after(async () => {\n  const ack = await queueEmail(inquiryAcknowledged({ kind, email }));\n});");
check("passes the shape the routes use", good.findings.length === 0 && good.afterResponse === 1, good.findings.join("; "));

/* ----------------------------------------------------------- the routes */

for (const r of ROUTES) {
  const { findings, afterResponse } = judge(readFileSync(r.file, "utf8"));
  check(`${r.file}: every enqueue is awaited and every after-response email is inside after()`, findings.length === 0, findings.join("; "));
  check(`${r.file}: carries ${r.afterResponse} after-response enqueue(s)`, afterResponse === r.afterResponse, `${afterResponse} found`);
}

console.log("");
if (wrong > 0) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: the intake emails queue inside after(), awaited, so the function lives until they are on the queue.");
