/**
 * A BUSINESS DATE IS THE FIRM'S CALENDAR, NOT UTC.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-business-date-is-the-firms-calendar.mjs
 *
 * THE INSTANT THAT MATTERS. Chicago is UTC minus five or six, so an order
 * placed at 19:30 on the last day of a month is already the FIRST of the next
 * month in UTC. `termsInForce` chose which commission terms applied by
 * formatting that instant as a UTC date, so a rate change dated the first took
 * effect the previous evening and every order in that window accrued at the
 * wrong rate.
 *
 * IT IS PROVEN ON THE DATE FUNCTION, NOT ON THE DATABASE READ, and that
 * limitation is stated rather than hidden. `termsInForce` needs a database and
 * a partner with terms; what decides the defect is which DAY string it builds,
 * and that is a pure function of the instant. So this proves the day string,
 * and asserts separately that `ops-partner-comp.ts` is the thing building it
 * that way, which is the source guard that stops a revert going unnoticed.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */

import { readFileSync } from "node:fs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const { todayInFirmCalendar, FIRM_TIME_ZONE } = await import("../../src/lib/firm-calendar.ts");

console.log("");
console.log("========== A BUSINESS DATE IS THE FIRM'S CALENDAR ==========");
console.log("");

rec("the firm's zone is America/Chicago", FIRM_TIME_ZONE === "America/Chicago", FIRM_TIME_ZONE);

/*
 * 2026-10-01T00:30:00Z is 2026-09-30 19:30 in Chicago, during daylight time.
 * The month boundary is the case that matters: commission terms change at a
 * month end far more often than on any other day.
 */
const monthEnd = new Date("2026-10-01T00:30:00Z");

rec(
  "an instant in the evening of the last day of a month is still that month here",
  todayInFirmCalendar(monthEnd) === "2026-09-30",
  `${monthEnd.toISOString()} is ${todayInFirmCalendar(monthEnd)} in the firm's calendar`,
);
rec(
  "and UTC would have called it the first of the next month",
  monthEnd.toISOString().slice(0, 10) === "2026-10-01",
  "which is how a rate change dated the first took effect the previous evening",
);

/* The same boundary in standard time, so the proof is not a daylight accident. */
const winter = new Date("2026-01-01T05:30:00Z");
rec(
  "and the same holds in standard time, when the offset is six rather than five",
  todayInFirmCalendar(winter) === "2025-12-31",
  `${winter.toISOString()} is ${todayInFirmCalendar(winter)} in the firm's calendar`,
);

/* Midday is the case that must NOT move, or the fix would break every ordinary day. */
const midday = new Date("2026-06-15T17:00:00Z");
rec(
  "an ordinary midday is the same date either way, so the fix moved only the edge",
  todayInFirmCalendar(midday) === "2026-06-15" && midday.toISOString().slice(0, 10) === "2026-06-15",
  "without this, a function returning a constant would pass everything above",
);

/*
 * THE SOURCE GUARD. The cases above prove the calendar function. They prove
 * nothing about whether the money path calls it, which is the rule tested with
 * its input handed to it.
 */
const comp = readFileSync("src/lib/ops-partner-comp.ts", "utf8");
rec(
  "the partner commission path builds its day from the firm's calendar",
  /const day = todayInFirmCalendar\(at\)/.test(comp),
  "termsInForce decides WHICH terms apply, so this is the line that pays a partner",
);
rec(
  "and no longer derives that day from a UTC ISO string",
  !/const day = at\.toISOString\(\)\.slice\(0, 10\)/.test(comp),
  "that spelling is what took a rate change into effect the previous evening",
);

console.log("");
const failed = out.filter((r) => !r.ok);
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`All ${out.length} checks correct.`);
}
