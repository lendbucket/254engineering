// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * THE LETTERHEAD AND THE REGISTRATION LINE SAY ONLY WHAT THE BOARD HOLDS.
 * Robert's addendum of 2026-10-25, items 7 and 8.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-letterhead-and-the-registration-line-say-only-what-the-board-holds.mjs
 *
 * 7. A sealed letter's head prints the registrant, "254 Engineering LLC",
 *    until "254 Engineering" is on F-29811's record as an assumed name, and the
 *    brand once it is.
 * 8. Once a registration has existed, the registration line never says
 *    "pending": after an expiry it says nothing, and "pending" is only ever
 *    said before the first registration is recorded.
 */
process.env.SUPABASE_URL = "http://letterhead-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "letterhead-proof-not-a-key";

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { letterheadBrand } = await import("../../src/lib/letter-seal.ts");
const { unregisteredLine } = await import("../../src/lib/launch.ts");

const held = (dbas) => ({ issuedTo: "254 Engineering LLC", number: "F-29811", dbas });
check(
  "7: with the register as it is today, the head is the registrant",
  letterheadBrand() === "254 Engineering LLC",
  letterheadBrand(),
);
check(
  "and with assumed names that do not include 254 Engineering, still the registrant",
  letterheadBrand(held(["Sealed Engineering", "Stamp My Plans", "254 Engineering Services"])) === "254 Engineering LLC",
);
check(
  "and the day 254 Engineering is recorded as an assumed name, the brand, with no other edit",
  letterheadBrand(held(["Sealed Engineering", "254 Engineering"])) === "254 Engineering",
);
check("and never 254 Engineering Services, whatever the register holds", !/Services/.test(letterheadBrand(held(["254 Engineering Services"]))));

check("8: before any registration is recorded, the line says pending", /pending/.test(unregisteredLine([])));
check("once one has existed and none is active, it says nothing, never pending", unregisteredLine([{ status: "lapsed" }]) === "");
const launch = readFileSync("src/lib/launch.ts", "utf8");
const fn = launch.slice(launch.indexOf("export function registrationLine("), launch.indexOf("export function unregisteredLine("));
check(
  "and registrationLine falls through to that rule with the whole register, the expired entries included",
  /return unregisteredLine\(verifiedFirmRegistrations\);/.test(fn) && !/return "Firm registration pending/.test(fn),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the letterhead and the registration line say only what the board holds.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
