/**
 * A LICENCE, A POLICY AND A PROTOCOL APPROVAL EXPIRE ON THE FIRM'S CALENDAR.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/an-expiry-is-judged-on-the-firms-calendar.mjs
 *
 * Robert's audit of 2026-10-24, finding F6. The operator ruled on 2026-09-24
 * that an expiry is compared with today in Chicago, and src/lib/launch.ts says
 * so in its header. Two of its comparisons still read the UTC date
 * (licenceIsCurrentToday and activeInsurance), and protocol approval in
 * src/lib/ops-field.ts did the same. So on an expiry date, from 7 pm Central
 * (6 pm in winter), letter sealing, certification, protocol signing and the
 * payment gate refused a licence or policy still current in Texas.
 *
 * Both read the clock at call time, so the clock is fixed here in process.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const RealDate = Date;
let fixed = null;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [fixed ?? RealDate.now()]));
  }
  static now() {
    return fixed ?? RealDate.now();
  }
};

const { licenceIsCurrentToday } = await import("../../src/lib/launch.ts");

/* 9 pm in Chicago on 24 October 2026 is 02:00 UTC on the 25th. */
fixed = new RealDate("2026-10-25T02:00:00Z").getTime();
check("at 9 pm Chicago on its expiry date, a licence expiring that day is still current", licenceIsCurrentToday("2026-10-24") === true);
check("and one that expired the day before is not", licenceIsCurrentToday("2026-10-23") === false);

/* 1 am in Chicago on the 25th is 06:00 UTC. */
fixed = new RealDate("2026-10-25T06:00:00Z").getTime();
check("after midnight in Chicago, the licence that expired on the 24th has lapsed", licenceIsCurrentToday("2026-10-24") === false);
check("an unrecorded expiry is never current", licenceIsCurrentToday(null) === false);
fixed = null;

const launch = readFileSync("src/lib/launch.ts", "utf8");
const insurance = launch.slice(launch.indexOf("export function activeInsurance"), launch.indexOf("export function activeInsurance") + 400);
check("activeInsurance compares against today on the firm's calendar", /const today = todayInFirmCalendar\(\);/.test(insurance) && !/toISOString\(\)\.slice\(0, 10\)/.test(insurance));
const code = launch.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check("and no comparison left in launch.ts reads the UTC date", !/toISOString\(\)\.slice\(0, 10\)/.test(code));
const field = readFileSync("src/lib/ops-field.ts", "utf8");
check(
  "protocol approval asks licenceIsCurrentToday, so it shares the firm's calendar",
  /if \(!licenceIsCurrentToday\(onRegister\.expires\)\) \{/.test(field) && !/licenceIsCurrent\(onRegister\.expires, new Date\(\)/.test(field),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a licence, a policy and a protocol approval expire on the firm's calendar, not in UTC.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
