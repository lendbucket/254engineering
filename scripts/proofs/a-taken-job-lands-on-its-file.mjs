/**
 * A TAKEN JOB LANDS ON ITS FILE, AND THE FILE SAYS WHAT IT TOUCHES AND WHAT IS NEXT.
 *
 * The Killeen call, items 3 and 4 (Robert, 2026-11-14), and Part 1 finding 14.
 *
 * What must hold:
 *   1. New job goes to /portal/files?id=<the file> on success, with its warnings.
 *   2. The file screen shows the next step and its owner (nextStepFor), the
 *      payment state with a resend button, when the customer opened their
 *      status page, and links to client, order, technician, engineer and letter.
 *   3. Money follows ruling 6b-i: payment state is read only for orders.read.
 *   4. A resend never raises a second order, and says when it could not queue.
 *   5. The route gates the resend exactly as the first send.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const intake = codeOf(readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8"));
check("New job goes to the file it made", /router\.push\(`\/portal\/files\?\$\{to\.toString\(\)\}`\)/.test(intake) && /new URLSearchParams\(\{ id: String\(body\.fileId\), taken: "1" \}\)/.test(intake));
check("carrying every warning it got back", ["alreadyTaken", "landingWarning", "paymentLinkWarning", "partnerWarning"].every((w) => intake.includes(`body.${w}`)));

const page = codeOf(readFileSync("src/app/portal/(app)/files/page.tsx", "utf8"));
check("the file reads what it touches", /const related = selected \? await fileRelated\(actor, selected\) : null;/.test(page));
check("and its next step", /nextStepFor\(selected\.status, related\.payment, Boolean\(selected\.assigned_tech_id\)\)/.test(page));
check("it shows the next step and its owner", /\{nextStep\.step\}/.test(page) && /Owner: \{nextStep\.owner\}/.test(page));
check("a waiting payment offers a resend", /related\.payment\.kind === "waiting"[\s\S]*?<ResendPaymentLink fileId=\{selected\.id\} \/>/.test(page));
check("it says when the customer last opened their status page", /related\.statusLinkOpened/.test(page) && /has not opened their status page/.test(page));
check("it links client, order, technician, engineer and letter", ['"Client"', '"Order and its status page"', '"Technician"', '"Engineer"', "Letter:"].every((s) => page.includes(s)));
check("the arrival's warnings are not carried into list links", /k !== "taken" && k !== "warn"/.test(page));

const related = codeOf(readFileSync("src/lib/file-related.ts", "utf8"));
check("payment state is read only for orders.read", /const seesMoney = can\(actor, "orders\.read"\);\s*out\.order = /.test(related) && /if \(seesMoney\) \{/.test(related));
check("no payment line at all without it", /out\.payment = can\(actor, "orders\.read"\) \? \{ kind: "none" \} : null;/.test(related));
check("a failed read is said, not shown as none", (related.match(/out\.unreadable\.push\(/g) ?? []).length >= 5);

const billing = codeOf(readFileSync("src/lib/ops-job-billing.ts", "utf8"));
const resend = billing.slice(billing.indexOf("export async function resendPaymentLink("), billing.indexOf("export async function invoiceAccount("));
check("a resend raises no second order", resend.length > 0 && !resend.includes("createOrderForFile(") && /\.eq\("status", "awaiting_payment"\)/.test(resend));
check("it uses the first send's checkout", /await startCheckout\(order\.id as string\)/.test(resend));
check("a resend that could not queue says so and records nothing", /if \(!queued\.ok\) return \{ ok: false, error: `[^`]*Nothing was sent\.` \};/.test(resend) && resend.indexOf("if (!queued.ok)") < resend.indexOf('"payment_link.resent"'));

const route = codeOf(readFileSync("src/app/api/portal/files/route.ts", "utf8"));
check("the route gates the resend as the first send", /action === "invoice_account"\s*\? can\(actor, "payments\.charge"\)\s*: can\(actor, "payments\.charge"\) \|\| can\(actor, "payments\.send_link"\);/.test(route) && /await resendPaymentLink\(actor, fileId\)/.test(route));

const clientPage = codeOf(readFileSync("src/app/portal/(app)/clients/[id]/page.tsx", "utf8"));
check("the client lists every file it has", /const files = await filesForClient\(actor, id\);/.test(clientPage) && /href=\{`\/portal\/files\?id=\$\{f\.id\}`\}/.test(clientPage));
const forClient = related.slice(related.indexOf("export async function filesForClient("), related.indexOf("export function nextStepFor("));
check("every row, through readEvery, and a failed read said", /await readEvery</.test(forClient) && /\.eq\("client_id", clientId\)/.test(forClient) && /could not be read/.test(forClient));
check("and only for a role that may open files", /if \(!actor \|\| !can\(actor, "files\.list"\)\) return null;/.test(forClient));

const opener = codeOf(readFileSync("src/lib/ops-intake.ts", "utf8"));
const token = opener.slice(opener.indexOf("export async function orderForCustomerToken("), opener.indexOf("export { landingStatusFor };"));
check("the first open takes the null once", /\.update\(\{ last_seen_at: DB_NOW \}\)\s*\.eq\("id", access\.id\)\s*\.is\("last_seen_at", null\)\s*\.select\("id"\)/.test(token));
check("and only that writes the first-open line", /if \(\(firstOpen \?\? \[\]\)\.length > 0 && access\.order_id\) \{\s*await event\(access\.order_id as string, "customer_link\.first_opened", false,/.test(token));
check("every later open still moves last_seen_at", /else if \(access\.last_seen_at !== null\) \{\s*await db\s*\.from\("eng_customer_access"\)\s*\.update\(\{ last_seen_at: DB_NOW \}\)/.test(token));
check("the file reads the first open", /\.eq\("event", "customer_link\.first_opened"\)/.test(related));

console.log("");
if (wrong === 0) {
  console.log("PASS: a taken job lands on its file, which says what is next, who owns it, the payment, and everything it touches.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
