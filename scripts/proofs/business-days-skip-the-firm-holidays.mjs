/**
 * BUSINESS DAYS SKIP THE FIRM'S SEVEN HOLIDAYS. Robert's ruling, 2026-11-01
 * evening, item P8: "Declare New Year's Day, Memorial Day, Independence Day,
 * Labor Day, Thanksgiving, the day after Thanksgiving and Christmas in one
 * config file, and have business days skip them."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/business-days-skip-the-firm-holidays.mjs
 *
 * THE EXPECTED DATES ARE TYPED HERE, read off a calendar, and never computed
 * from the rules in src/config/firm-holidays.ts. A check that derived its
 * expectation from the module under test would compare the rules to
 * themselves. 2026 and 2027 between them carry every case the rules have:
 * Independence Day on a Saturday (observed Friday) and on a Sunday (observed
 * Monday), Christmas on a Saturday, and New Year's Day 2028 on a Saturday,
 * which is observed on 31 December 2027, in the year before.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { FIRM_HOLIDAYS, firmHolidaysFor, isFirmHoliday } = await import("../../src/config/firm-holidays.ts");
const { addBusinessDays } = await import("../../src/lib/firm-calendar.ts");

const RULED = ["New Year's Day", "Memorial Day", "Independence Day", "Labor Day", "Thanksgiving", "Day after Thanksgiving", "Christmas Day"];
check("exactly the seven ruled holidays are declared", JSON.stringify(FIRM_HOLIDAYS.map((h) => h.name)) === JSON.stringify(RULED), FIRM_HOLIDAYS.map((h) => h.name).join(", "));

const EXPECTED = {
  2026: ["2026-01-01", "2026-05-25", "2026-07-03", "2026-09-07", "2026-11-26", "2026-11-27", "2026-12-25"],
  2027: ["2027-01-01", "2027-05-31", "2027-07-05", "2027-09-06", "2027-11-25", "2027-11-26", "2027-12-24"],
};
for (const [year, dates] of Object.entries(EXPECTED)) {
  const got = firmHolidaysFor(Number(year)).map((h) => h.date);
  check(`the days off in ${year} are the calendar's`, JSON.stringify(got) === JSON.stringify(dates), got.join(", "));
}
check("New Year's Day 2028, a Saturday, is observed on Friday 31 December 2027", isFirmHoliday("2027-12-31"));
check("and Saturday 4 July 2026 itself is not a day off on top of the Friday", !isFirmHoliday("2026-07-04"));
check("an ordinary weekday is not a holiday", !isFirmHoliday("2026-11-24"));

check("the Wednesday before Thanksgiving plus one business day is the Monday after", addBusinessDays("2026-11-25", 1) === "2026-11-30", addBusinessDays("2026-11-25", 1));
check("Christmas is skipped: 23 December 2026 plus two is 28 December", addBusinessDays("2026-12-23", 2) === "2026-12-28", addBusinessDays("2026-12-23", 2));
check("an observed Friday is skipped: 2 July 2026 plus one is 6 July", addBusinessDays("2026-07-02", 1) === "2026-07-06", addBusinessDays("2026-07-02", 1));
check("weekdays with no holiday are unchanged: 2 November 2026 plus five is 9 November", addBusinessDays("2026-11-02", 5) === "2026-11-09", addBusinessDays("2026-11-02", 5));

const calendar = readFileSync("src/lib/firm-calendar.ts", "utf8");
const body = calendar.slice(calendar.indexOf("export function addBusinessDays"), calendar.indexOf("export function endOfFirmDay"));
check("addBusinessDays asks isFirmHoliday, so the config file is the one home", /isFirmHoliday\(/.test(body));

console.log(wrong === 0 ? "PASS: business days skip the firm's seven holidays, read from one file." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
