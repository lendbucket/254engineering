/**
 * A COPY CONTACT GETS THE SEALED LETTER, ALONE, AND THE FILE SAYS WHO WAS SENT WHAT.
 *
 * The Killeen call, item 7 (Robert, 2026-11-14), with his answer 3: "copies get
 * a link to the sealed letter alone, through the same check as the customer's
 * download, nothing else of the order"; the email copy approved as drafted.
 *
 * What must hold:
 *   1. The link resolves to one order and one document, by its id AND its token
 *      hash, and a revoked or expired link opens nothing.
 *   2. The route serves the bytes only through customerLetterFor, the
 *      customer's own check, and serves nothing but a PDF.
 *   3. The token leaves the address: /letter/<id> is a tokened page to the
 *      planner, the proxy matches it, and a letter path never reaches a gate.
 *   4. The email is Robert's approved words, linking to /letter, never /order.
 *   5. At sealing, and at a replacement, every contact on the file is sent, and
 *      each outcome is written to the order and the file; a failed send is
 *      never reported as sent.
 *   6. The audit trail never records a contact's download as the customer's.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const links = codeOf(readFileSync("src/lib/letter-links.ts", "utf8"));
check("only the token's hash is stored", /createHash\("sha256"\)\.update\(token, "utf8"\)\.digest\("hex"\)/.test(links) && /token_hash: tokenHash,/.test(links));
check("a link is found by its id and its token together", /\.eq\("id", id\)\s*\.eq\("token_hash", tokenHash\)/.test(links));
check("a revoked or expired link opens nothing", /if \(!data \|\| data\.revoked_at\) return null;/.test(links) && /expires_at as string\)\.getTime\(\) <= Date\.now\(\)\) return null;/.test(links));

const route = codeOf(readFileSync("src/app/letter/[id]/route.ts", "utf8"));
check("the route serves only through the customer's own check", /await customerLetterFor\(link\.orderId, link\.documentId, \{ kind: "copy",/.test(route));
check("and only a PDF", /"Content-Type": "application\/pdf"/.test(route) && !/eng_service_orders|total_cents|refund/.test(route));

const planner = codeOf(readFileSync("src/lib/link-cookie.ts", "utf8"));
check("/letter/<id> is a tokened page to the planner", /const LETTER_PAGE = \/\^\\\/letter\\\/\[A-Za-z0-9-\]\+\$\/;/.test(planner) && /LETTER_PAGE\.test\(pathname\)\) return pathname;/.test(planner));
const proxy = codeOf(readFileSync("src/proxy.ts", "utf8"));
check("the proxy matches it", /"\/letter\/:path\*"/.test(proxy));
check("and a letter path never reaches a gate", /pathname\.startsWith\("\/letter\/"\)\s*\)\s*\{\s*return NextResponse\.next\(\);/.test(proxy));

const templates = codeOf(readFileSync("src/lib/email-templates.ts", "utf8"));
const email = templates.slice(templates.indexOf("export function orderLetterCopy("), templates.indexOf("export function orderLetterCopy(") + 1600);
check("the subject is his", /`Sealed letter for \$\{input\.propertyAddress\}`/.test(email));
check("the body is his", /asked us to send you a copy of the sealed letter for \$\{input\.propertyAddress\}\. It is ready to download\./.test(email));
check("the button is his", /label: "Download the sealed letter", url: input\.letterUrl/.test(email));
check("the footer is his", /named you as a recipient\. Reply to this message if it reached you in error\./.test(email));
check("email-audit sees it", /orderLetterCopy\(\{\s*customerName: "Sample Customer",/.test(templates));

const payments = codeOf(readFileSync("src/lib/ops-payments.ts", "utf8"));
const send = payments.slice(payments.indexOf("export async function sendCopyLetters("), payments.indexOf("export async function sendLetterReplaced("));
check("the email links to the letter, never the order page", /letterUrl: `\$\{business\.url\}\/letter\/\$\{link\.id\}\?token=\$\{encodeURIComponent\(link\.token\)\}`/.test(send) && !send.includes("statusUrlFor("));
check("each outcome is written to the order", /await event\(orderId, queued\.ok \? "copy_letter\.queued" : "copy_letter\.not_sent", false, line\);/.test(send));
check("and to the file", /from\("eng_file_events"\)\.insert\(\{ file_id: fileId, actor_id: null, kind: "delivery", body: line \}\)/.test(send));
check("a failed send is never reported as sent", /const line = queued\.ok\s*\?[\s\S]*?was sent to[\s\S]*?: `The sealed letter was not sent to/.test(send));
check("it runs at sealing", /await sendOrderSealed\(input\.orderId\);\s*await sendCopyLetters\(input\.orderId\);/.test(payments));
const seal = codeOf(readFileSync("src/lib/letter-seal.ts", "utf8"));
check("and at a replacement", /await sendLetterReplaced\(order\.id as string\);\s*const copies = await sendCopyLetters\(order\.id as string\);/.test(seal));

const delivery = codeOf(readFileSync("src/lib/letter-delivery.ts", "utf8"));
check("a contact's download is recorded as a contact's", /via\.kind === "customer" \? "document\.customer_download" : "document\.copy_download"/.test(delivery));

console.log("");
if (wrong === 0) {
  console.log("PASS: a copy contact gets the sealed letter alone, in Robert's email, and the order and the file say who was sent what.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
