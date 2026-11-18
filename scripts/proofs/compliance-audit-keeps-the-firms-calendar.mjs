/**
 * COMPLIANCE-AUDIT KEEPS THE FIRM'S CALENDAR, AS THE PRODUCT DOES.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/compliance-audit-keeps-the-firms-calendar.mjs
 *
 * BACKLOG, "compliance-audit computes today in UTC, so an acknowledgement
 * expires early in Central" (operator ruling 2026-09-22: the firm's calendar is
 * America/Chicago). The product decides every expiry against
 * todayInFirmCalendar() (src/lib/launch.ts since 2026-09-24). This audit
 * compared three expiries against a UTC date: an engineer's licence lapsing, a
 * roster acknowledgement's expiry, and an active registration. From 19:00
 * Central to midnight it believed it was already tomorrow.
 *
 *   A  the instance the entry observed, as a clock reading: at 19:19 Central on
 *      2026-09-22 UTC already says 2026-09-23, and the firm's calendar says
 *      2026-09-22
 *   B  the audit computes no UTC "today" anywhere
 *   C  it takes one firm today, and the licence, roster and registration
 *      comparisons each read it
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { todayInFirmCalendar } = await import("../../src/lib/firm-calendar.ts");

/* A: 2026-09-23T00:19:16Z is 19:19:16 CDT on 2026-09-22, the reading recorded in the entry. */
const observed = new Date("2026-09-23T00:19:16Z");
check("A: at that moment UTC already reads the next day", observed.toISOString().slice(0, 10) === "2026-09-23");
check("A: and the firm's calendar still reads the day it is in Texas", todayInFirmCalendar(observed) === "2026-09-22", todayInFirmCalendar(observed));
/* And in winter, when Central is six hours behind rather than five. */
check("A: the same holds in winter, at 18:30 CST", todayInFirmCalendar(new Date("2026-12-02T00:30:00Z")) === "2026-12-01");

const audit = readFileSync("scripts/compliance-audit.mjs", "utf8");
check("B: compliance-audit computes no UTC today", !/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(audit));
check(
  "C: it takes one firm today, at the top",
  /const \{ todayInFirmCalendar \} = await import\("\.\.\/src\/lib\/firm-calendar\.ts"\);\s*const FIRM_TODAY = todayInFirmCalendar\(\);/.test(audit),
);
check("C: an engineer's licence lapses against it", /e\.expires < FIRM_TODAY/.test(audit));
check("C: the roster acknowledgement expires against it", /const TODAY = FIRM_TODAY;/.test(audit));
check("C: an active registration is current against it", /r\.expires >= FIRM_TODAY/.test(audit));

console.log(wrong === 0 ? "PASS: compliance-audit keeps the firm's calendar." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
