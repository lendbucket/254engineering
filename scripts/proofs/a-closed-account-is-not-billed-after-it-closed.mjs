/**
 * A CLOSED ACCOUNT IS BILLED FOR THE MONTH IT CLOSED IN, AND NO LATER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-closed-account-is-not-billed-after-it-closed.mjs
 *
 * Operator ruling, 2026-10-10 (decision 5). statementAfterClosure is the rule
 * closePeriod asks for a closed account, with the time of its account.closed
 * audit row. Asked directly here, including at the month boundary in the
 * firm's time zone: an account closed at 23:30 Central on 31 October closed in
 * October, though that instant is already 1 November in UTC.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { statementAfterClosure } = await import("../../src/lib/ops-statements.ts");

const closed = "2026-10-15T15:00:00Z";
check("the month it closed in may still be billed", statementAfterClosure("2026-10", closed) === null);
check("an earlier month may be billed", statementAfterClosure("2026-09", closed) === null);
check("a later month is refused, naming both", /closed in 2026-10.*2026-11/.test(statementAfterClosure("2026-11", closed) ?? ""));
/* 23:30 on 31 October in Chicago (CDT, UTC-5) is 04:30 on 1 November UTC. */
check(
  "the boundary is the firm's month: closed late on 31 October Central is October, so November is refused",
  statementAfterClosure("2026-10", "2026-11-01T04:30:00Z") === null && statementAfterClosure("2026-11", "2026-11-01T04:30:00Z") !== null,
);
check("a closed account with no closure on record is refused outright", /not on record/.test(statementAfterClosure("2026-10", null) ?? ""));

const src = readFileSync("src/lib/ops-statements.ts", "utf8");
const body = src.slice(src.indexOf("export async function closePeriod"));
check(
  "closePeriod asks the rule for a closed account, with the account.closed audit row's time, before anything is issued",
  /account\.status === "closed"/.test(body) && body.indexOf("statementAfterClosure(") > 0 &&
    body.indexOf("statementAfterClosure(") < body.indexOf("A SECOND STATEMENT FOR A PERIOD"),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a closed account is billed for the month it closed in, and no later.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
