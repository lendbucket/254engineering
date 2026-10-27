/**
 * EVERY MONEY DOOR READS THE ENGINEER'S SIGNED RECORD BEFORE IT TAKES MONEY.
 *
 * Ruling 11 and ruling 13 of 2026-10-06: lineIsSellable (offered in
 * configuration AND signed in the database with a hash matching the
 * transcription) is called from every door that takes money, and "a check
 * fails the board if any money door does not call it, proven red by removing
 * one call".
 *
 * The doors call it through orderBlockedNow in src/lib/line-gate.ts. Three
 * assertions, read from the source:
 *
 *   1. every declared door calls orderBlockedNow, the number of times declared;
 *   2. nothing else in src asks the catalogue with the protocol answered by
 *      configuration alone: orderBlockedReason is called with a literal false or
 *      from line-gate.ts and nowhere else, so a new door that copies the old
 *      shape goes red here rather than selling a voided line;
 *   3. serviceLineIsOffered, the configuration-only predicate, is read only by
 *      the gate itself and by the DISPLAY surfaces the ruling accepted
 *      (OfferCta and lineOffer), never by anything that takes money.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/*
 * The doors, declared: the file and how many calls it makes.
 *
 * /order/start/[slug] LEFT THIS LIST ON 2026-10-25, by Robert's instruction
 * from the Ahrefs crawl (1.1 seconds to first byte). It only DISPLAYS whether a
 * deliverable can be ordered, from an answer kept for at most 60 seconds; the
 * money behind it is taken by placeOrder in ops-intake.ts, which is still here
 * and still reads live. It is declared below as a display page instead, and
 * the check after that one refuses any money door that reads the cached answer.
 */
const DOORS = {
  "src/app/account/order/page.tsx": 1,
  "src/lib/ops-bulk.ts": 1,
  /*
   * placeOrder, and duplicateStillSellable for a retried web order (audit
   * finding F10, 2026-10-24). requestQuote LEFT ON 2026-10-27, by Robert's
   * addendum of 2026-10-25, item 3: a request takes no money, and asking it the
   * money door's question refused every quote line. The question moved to the
   * door that takes the money, acceptQuote in ops-quotes.ts, declared below,
   * and requestQuote is held to quoteRequestBlocked by the check after this.
   */
  "src/lib/ops-intake.ts": 2,
  "src/lib/ops-job-billing.ts": 1,
  /* acceptQuote: the customer accepts a quote and pays (addendum item 3, 0098). */
  "src/lib/ops-quotes.ts": 1,
};

for (const [file, want] of Object.entries(DOORS)) {
  const got = readFileSync(file, "utf8").split("orderBlockedNow(").length - 1;
  check(`${file} reads the signed record (${want} call${want === 1 ? "" : "s"})`, got === want, `${got} found`);
}

/*
 * THE REQUEST DOOR, declared (2026-10-27). quoteRequestBlocked answers without
 * the signed record, which is right for a request and would be a hole in any
 * door that takes money. So it is called by requestQuote alone, inside
 * ops-intake.ts, and by the start page's display through line-gate.ts; a money
 * door that started calling it would go red here.
 */
const REQUEST_ONLY = { "src/lib/ops-intake.ts": 1, "src/lib/line-gate.ts": 1 };
{
  const intake = readFileSync("src/lib/ops-intake.ts", "utf8");
  const requestBody = intake.slice(intake.indexOf("export async function requestQuote("), intake.indexOf("export async function issueCustomerLink("));
  check(
    "requestQuote asks the request question and never the money door's",
    requestBody.includes("quoteRequestBlocked(") && !requestBody.includes("orderBlockedNow("),
  );
  const quotes = readFileSync("src/lib/ops-quotes.ts", "utf8");
  const acceptBody = quotes.slice(quotes.indexOf("export async function acceptQuote("), quotes.indexOf("async function convertAndCheckout("));
  check(
    "and acceptQuote, where the money is taken, reads the signed record before it accepts",
    acceptBody.indexOf("orderBlockedNow(") !== -1 && acceptBody.indexOf("orderBlockedNow(") < acceptBody.indexOf('status: "accepted"'),
  );
}

/*
 * THE DISPLAY PAGES, declared (2026-10-25): they read the cached answer and
 * take no money. Each must call the display function exactly as declared, and
 * no other file may call it at all, so a money door cannot quietly start
 * reading a minute old answer. line-gate.ts itself is where /order's
 * sellableLineOffers asks it.
 */
const DISPLAY = {
  /* Through deliverableBlockedForDisplay since 2026-10-27, which asks a quote as a request (addendum item 3). */
  "src/app/(order)/order/start/[slug]/page.tsx": { deliverableBlockedForDisplay: 1 },
  "src/lib/line-gate.ts": { lineIsSellableForDisplay: 2, orderBlockedForDisplay: 1 },
};
for (const [file, calls] of Object.entries(DISPLAY)) {
  for (const [fn, want] of Object.entries(calls)) {
    const src = readFileSync(file, "utf8").replace(new RegExp(`function ${fn}\\(`, "g"), "");
    const got = src.split(`${fn}(`).length - 1;
    check(`${file} displays through ${fn} (${want} call${want === 1 ? "" : "s"})`, got === want, `${got} found`);
  }
}
for (const file of Object.keys(DOORS)) {
  const src = readFileSync(file, "utf8");
  check(`${file}, a money door, never reads the cached display answer`, !/ForDisplay\(/.test(src));
}

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p.split("\\").join("/"));
  }
};
walk("src");
check("the source tree was read", files.length > 200, `${files.length} files`);

const displayReaders = files.filter((f) => !(f in DISPLAY) && /(lineIsSellableForDisplay|orderBlockedForDisplay|deliverableBlockedForDisplay)\(/.test(readFileSync(f, "utf8")));
const requestReaders = files
  .filter((f) => readFileSync(f, "utf8").includes("quoteRequestBlocked("))
  .map((f) => [f, readFileSync(f, "utf8").replace(/function quoteRequestBlocked\(/g, "").split("quoteRequestBlocked(").length - 1]);
check(
  "the request question is asked by requestQuote and the display alone",
  requestReaders.length === Object.keys(REQUEST_ONLY).length && requestReaders.every(([f, n]) => REQUEST_ONLY[f] === n),
  requestReaders.map(([f, n]) => `${f} ${n}`).join(", "),
);
check(
  "nothing but the declared display pages reads the cached display answer",
  displayReaders.length === 0,
  displayReaders.join(", ") || "the start page and /order's offers only",
);

const askedByConfig = [];
for (const f of files) {
  if (f === "src/lib/line-gate.ts") continue;
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/orderBlockedReason\(([^;]*?)\)/g)) {
    if (!/,\s*false\s*$/.test(m[1].trim())) askedByConfig.push(`${f}: orderBlockedReason(${m[1].slice(0, 60)})`);
  }
}
check(
  "nothing outside the line gate asks the catalogue with a protocol answer of its own",
  askedByConfig.length === 0,
  askedByConfig.join(" | ") || "every other call passes false, the shut answer",
);

const DISPLAY_AND_GATE = new Set([
  "src/lib/launch.ts",
  "src/lib/line-gate.ts",
  "src/lib/ordering.ts",
  "src/components/launch/OfferCta.tsx",
]);
const configReaders = files.filter((f) => !DISPLAY_AND_GATE.has(f) && readFileSync(f, "utf8").includes("serviceLineIsOffered("));
check(
  "the configuration-only predicate is read by the gate and the display surfaces alone",
  configReaders.length === 0,
  configReaders.join(", ") || "OfferCta and lineOffer only, as ruled",
);

console.log("");
if (wrong === 0) {
  console.log("PASS: every money door reads the engineer's signed record before it takes money.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
