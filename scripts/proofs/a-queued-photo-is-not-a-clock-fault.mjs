/**
 * A PHOTOGRAPH THAT WAITED FOR SIGNAL IS NOT A CLOCK THAT DISAGREED.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-queued-photo-is-not-a-clock-fault.mjs
 *
 * Operator ruling, 2026-10-15. recordCapture compared the CAPTURE time with
 * the server's clock at sync, so the skew it recorded was how long the
 * photograph sat in the offline queue. Every photograph synced more than sixty
 * seconds after it was taken, which is every photograph taken on a roof with
 * no signal, was shown to the engineer as "The device clock disagreed with the
 * server at sync ... The time this photograph reports is not certain."
 *
 * The phone now sends its own clock at the moment it sends the record, and the
 * skew is that against the server at the same instant. The capture time is
 * still stored as the device's statement of when the photograph was taken.
 *
 * The behaviour below is driven by WHICH input field recordCapture actually
 * hands to clockReading, read from the source, so reverting that one argument
 * turns the first check red rather than leaving a hand-built input green.
 */
import { readSource } from "../lib/read-source.mjs";

const { clockReading } = await import("../../src/lib/clock-skew.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const field = readSource("src/lib/ops-field.ts");
const route = readSource("src/app/api/portal/field/route.ts");
const queue = readSource("src/lib/offline-queue.ts");

/* The one argument this whole fix is about, located at the call itself. */
const arg = /const reading = clockReading\(input\.(\w+) \?\? null, serverNow\)/.exec(field)?.[1] ?? null;
check(
  "recordCapture's reading is found at its call, so the checks below measure the code",
  arg !== null,
  arg ? `clockReading(input.${arg}, serverNow)` : "the call was not found, so nothing below would mean anything",
);

/* What recordCapture would compute for an input, using the field it really reads. */
const readingFor = (input, serverNow) => clockReading(arg ? (input[arg] ?? null) : null, serverNow);

const at = (iso, seconds) => new Date(Date.parse(iso) + seconds * 1000).toISOString();
const SYNC = "2026-10-17T15:30:00.000Z";

/* A correct phone, offline on the roof, syncing twenty minutes after the shutter. */
const queued = { capturedAt: at(SYNC, -20 * 60), deviceNow: SYNC };
const q = readingFor(queued, SYNC);
check(
  "a photograph that waited twenty minutes for signal, on a correct clock, does NOT disagree",
  q !== null && q.disagrees === false,
  q ? `skew ${q.skewSeconds}s` : "no reading",
);

/* A phone set an hour wrong. It reports the wrong hour at sync as well. */
const wrongHour = { capturedAt: at(SYNC, 3600 - 600), deviceNow: at(SYNC, 3600) };
const w = readingFor(wrongHour, SYNC);
check(
  "a phone set an hour ahead still disagrees, and the sign is kept",
  w !== null && w.disagrees === true && w.skewSeconds === 3600,
  w ? `skew ${w.skewSeconds}s` : "no reading",
);

/* And one an hour behind, synced at once. */
const behind = { capturedAt: at(SYNC, -3600), deviceNow: at(SYNC, -3600) };
const b = readingFor(behind, SYNC);
check(
  "a phone an hour behind disagrees too",
  b !== null && b.disagrees === true && b.skewSeconds === -3600,
  b ? `skew ${b.skewSeconds}s` : "no reading",
);

/* A record from a phone that sent no clock: unmeasured, never agreeing. */
const silent = { capturedAt: at(SYNC, -20 * 60) };
check(
  "a record that carries no device clock is unmeasured rather than agreeing",
  readingFor(silent, SYNC) === null,
  "null, so the screen says nobody measured",
);

/* The two hops that carry the clock, read from the source. */
check(
  "the route passes the device clock through to recordCapture",
  /deviceNow: body\?\.deviceNow \? String\(body\.deviceNow\) : null/.test(route),
);
check(
  "the queue sends the clock at the moment of sending, not the capture time",
  /deviceNow: new Date\(\)\.toISOString\(\)/.test(queue) && !/deviceNow: entry\.capturedAt/.test(queue),
);

/* The capture time is still written as the device's account of the shutter. */
check(
  "the capture time is still stored as the device reported it",
  /captured_at: input\.capturedAt \?\? DB_NOW/.test(field),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a queued photograph is judged on its clock, not on how long it waited.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
