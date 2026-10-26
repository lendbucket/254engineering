/**
 * A BLANK OR UNREADABLE AMOUNT IS NO AMOUNT, NEVER ZERO AND NEVER THE
 * CATALOGUE PRICE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-blank-or-unreadable-amount-is-no-amount.mjs
 *
 * Section 6 of Robert's audit of 2026-10-24:
 *   M-partner-blank   Number("") is 0, so an empty field became a $0.00 flat
 *                     fee, or 0%, stored as a partner's terms.
 *   M-intake-override "$1,200" read as NaN, was sent as no override, and the
 *                     catalogue price was charged with no word.
 * Neither fix changes a price: a blank or an unreadable entry is refused, and
 * the person types it again.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { typedDollarsToCents, typedPercentToBps } = await import("../../src/lib/money-input.ts");

for (const blank of ["", "  ", "$", null, undefined, " % "]) {
  check(`a blank (${JSON.stringify(blank)}) is no amount and no rate, never zero`, typedDollarsToCents(blank) === null && typedPercentToBps(blank) === null);
}
check("an amount that is not a number is no amount", typedDollarsToCents("twelve") === null && typedPercentToBps("about 5") === null);
check("$1,200 reads as people write it", typedDollarsToCents("$1,200") === 120000);
check("and 12.345 rounds to whole cents", typedDollarsToCents("12.345") === 1235);
check("a real zero is still zero, which each caller judges on its own", typedDollarsToCents("0") === 0);
check("2.5% is 250 basis points", typedPercentToBps("2.5%") === 250);

const route = readFileSync("src/app/api/portal/partners/[id]/route.ts", "utf8");
check(
  "the partner route parses through these, for the flat fee, the rate and an adjustment",
  /const dollarsToCents = typedDollarsToCents;/.test(route) && /const percentToBps = typedPercentToBps;/.test(route) && /percentToBps\(body\.percent\)/.test(route) && !/Number\(body\.percent\)/.test(route),
);
const terms = readFileSync("src/lib/ops-partners-admin.ts", "utf8");
check("and a flat model with no amount is refused, so a blank never becomes a $0.00 fee", /return \{ ok: false, error: "A flat fee model needs an amount\." \}/.test(terms));

const intake = readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8");
check(
  "the intake screen refuses a typed price it cannot read, rather than charging the catalogue price",
  /const unreadablePrice = overridePrice\.trim\(\) !== "" && !Number\.isFinite\(enteredCents\);/.test(intake) && /const priceError = unreadablePrice\s*\?/.test(intake),
);
check("and a price error stops the job being taken", /!priceError &&/.test(intake));

/* E3e, on the same screen: a failed client search is said, never "Nobody matches that". */
check(
  "a refused or unreachable client search is recorded as failed, not as no matches",
  /setSearchFailed\(body\?\.error \? String\(body\.error\) : `the server answered \$\{res\.status\}`\)/.test(intake) &&
    /\} catch \{\s*if \(live\) \{\s*setMatches\(\[\]\);\s*setSearchFailed\("the request did not reach the server"\);/.test(intake),
);
check(
  "and the screen says the search failed before it would ever say nobody matches",
  /* The rendered sentence, not the comment that quotes it. */
  intake.indexOf("!searching && searchFailed ?") > 0 &&
    intake.indexOf("!searching && searchFailed ?") < intake.indexOf("<p className={hint}>Nobody matches that."),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a blank or unreadable amount is no amount, never zero and never the catalogue price.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
