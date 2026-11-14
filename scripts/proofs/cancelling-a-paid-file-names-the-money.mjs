/**
 * CANCELLING A PAID FILE NAMES THE PAYMENT AND OFFERS THE REFUND IN THE SAME STEP.
 *
 * Part 1 finding 2, Robert's answer 6 of 2026-11-14 with his approved wording
 * (6878458673, draft 4). What must hold:
 *   1. A paid file's cancel opens the confirmation, in his words exactly.
 *   2. Its three choices: cancel and ask for a refund, cancel with no refund
 *      now, keep the file.
 *   3. The refund is asked for only after the cancel succeeded, through the
 *      same request as the order screen's "Ask for a refund".
 *   4. A refund request that fails after the cancel is said, with where to
 *      finish it.
 *   5. An unpaid file keeps today's confirm.
 *   6. The page passes the paid order only when there is one.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const client = codeOf(readFileSync("src/app/portal/(app)/files/FileClient.tsx", "utf8"));
check("his first line, exactly", /Order \{paid\.reference\} was paid \{paid\.amount\} on \{paid\.paidOn\}\. Cancelling this file does not refund it\./.test(client));
check("his second line, exactly", /Ask for a refund now, or cancel without one and settle the money later from the order\./.test(client));
check("his three buttons, exactly", ["Cancel and ask for a refund", "Cancel, no refund now", "Keep the file"].every((b) => client.includes(`>\n              ${b}\n`) || client.includes(`>${b}<`) || new RegExp(`>\\s*${b.replace(/[,]/g, ",")}\\s*<`).test(client)));
check("a paid file opens the confirmation instead of the plain confirm", /if \(destructive && paid\) \{\s*setConfirmingPaid\(true\);\s*return;\s*\}/.test(client));
check("an unpaid file keeps today's confirm", /Cancel this file\? Canceled is final: the file cannot be moved again afterwards\./.test(client));
const fn = client.slice(client.indexOf("async function cancelAndRefund("), client.indexOf("const blocked = "));
check("the refund is asked for only after the cancel succeeded", /const cancelled = await move\("cancelled"\);\s*if \(!cancelled\) return;/.test(fn) && fn.indexOf('await move("cancelled")') < fn.indexOf('fetch("/api/portal/refunds"'));
check("through the order screen's own request", /body: JSON\.stringify\(\{ action: "request", orderId: paid\.orderId, reason \}\)/.test(fn));
check("a failed refund request after the cancel is said, with where to finish it", /The file is cancelled and the refund was not asked for: .*Ask for it from order \$\{paid\.reference\}\./.test(fn));

const page = codeOf(readFileSync("src/app/portal/(app)/files/page.tsx", "utf8"));
check("the page passes the paid order only when there is one", /related\?\.payment\?\.kind === "paid" && related\.order\s*\?/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: cancelling a paid file names the payment in Robert's words and offers the refund in the same step.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
