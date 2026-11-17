/**
 * THE /start FORMS ARE LEADS THE OFFICE SEES, REFUSED AND RECOMPUTED AS THE
 * LEAD ROUTE IS. Robert's add-on of 2026-11-15, items 5, 11, 14 and 15.
 *
 *   node scripts/proofs/the-start-forms-are-leads-the-office-sees.mjs
 *
 * /api/start takes three forms and one upload signature with no session. It
 * reads the route's own source and asserts, in order:
 *   1. The honeypot answers success before anything is counted or written.
 *   2. The rate limit is taken before the lead is written.
 *   3. The price is recomputed from the price book (quoteFor), and nothing in
 *      the request named price, cents or total is read.
 *   4. The ad click and the partner are read on the server, from cookies.
 *   5. An attachment key is accepted only in the exact shape the route signs,
 *      under the draft the form names; anything else is dropped, not stored.
 *   6. A write that did not land is never answered with success.
 *   7. Each form's follow up runs after the answer: the callback alert, the
 *      first price email, the inquiry notification, and the Ads conversion.
 *   8. The upload is signed under the "leads" space only.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const route = codeOf(readFileSync("src/app/api/start/route.ts", "utf8"));
const at = (s) => route.indexOf(s);

check("the route exists at /api/start and exports POST through the save outcome wrapper", /export const POST = withSaveOutcome\(handlePOST\);/.test(route));
check("1: the honeypot answers success", /if \(data\.company\) return NextResponse\.json\(\{ ok: true \}\);/.test(route));
check("1: before the rate limit is counted", at("if (data.company)") > 0 && at("if (data.company)") < at("takePublicFormAttempt("));
check("2: the rate limit is taken", /takePublicFormAttempt\("start", request\.headers, who\)/.test(route));
check("2: before the lead is written", at("takePublicFormAttempt(") < at("await insertLead("));
check("3: the price is recomputed from the price book", /quoteFor\(letter, coastal\)/.test(route));
check("3: no price, cents or total is read from the request", !/(payload|data)\.(price|cents|total|quotedCents|amount)/i.test(route));
check("4: the ad click is read on the server", /const click = await adClickOfRequest\(\);/.test(route));
check("4: and the partner from its own cookie", /partnerForVisitor\(\(await cookies\(\)\)\.get\(VISITOR_COOKIE\)\?\.value\)/.test(route));
check("5: an attachment must sit under the draft the form names", /data\.attachmentKey\.startsWith\(`leads\/\$\{data\.draftId\}\/report\/`\)/.test(route));
check("5: and match the exact shape the route signs, or it is dropped", /\? data\.attachmentKey\s*:\s*null;/.test(route) && /report\\\/\[0-9a-f-\]\{36\}/.test(route));
check("6: a write that missed is answered 503, not success", /if \(!write\.ok \|\| !write\.id\) \{[\s\S]*?status: 503/.test(route));
check("6: and success is answered only after that check", at("{ status: 503 }") < at("return NextResponse.json({ ok: true });\n}"));
check("7: the callback alerts the office", /callbackRequested\(\{/.test(route) && /recordLeadConversion\("callback", leadId, click\)/.test(route));
check("7: email me the price starts its three emails", /await startPriceEmails\(leadId\)/.test(route) && /recordLeadConversion\("email_price", leadId, click\)/.test(route));
check("7: something else notifies the office", /leadNotification\(\{/.test(route) && /recordLeadConversion\("inquiry", leadId, click\)/.test(route));
check("7: all of it after the answer, so none of it can change the answer", at("after(async () => {") > at("const leadId = write.id;"));
check("8: the upload is signed under the leads space only", /space: "leads",/.test(route) && (route.match(/signOrderUpload\(/g) ?? []).length === 1);

const uploads = codeOf(readFileSync("src/lib/order-uploads.ts", "utf8"));
check("8: and leads is a space the signer knows", /space\?: "orders" \| "intake" \| "status" \| "leads";/.test(uploads));

console.log("");
if (wrong === 0) {
  console.log("PASS: the /start forms are leads the office sees, refused and recomputed as the lead route is.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
