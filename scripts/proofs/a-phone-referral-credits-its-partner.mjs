/**
 * A PARTNER WHO REFERS BY TELEPHONE IS CREDITED BY THE CHECKOUT'S OWN RULES.
 *
 * Part 1 finding 3, Robert's answer 1 of 2026-11-14. The partner home promises
 * the code "works as a link and as a code somebody says on the telephone", and
 * New job had nowhere to write a code: takeJob recorded no touch and the order
 * raised for a telephoned job was never attributed. A partner who sent a
 * homeowner by phone earned nothing.
 *
 * What must hold, each asked of the source in the order it has to happen:
 *   1. takeJob refuses a code no active partner holds, BEFORE any client or
 *      file is written, so a typo is corrected on the call, not credited to
 *      nobody.
 *   2. The code is recorded as a touch under the file's key BEFORE the payment
 *      link is raised, because the order is attributed when it is raised.
 *   3. The order raised for a file is attributed by ops-partners' attributeOrder,
 *      the function the web checkout calls, under the same key. No second rule.
 *   4. The key has one home, fileTouchKey, and both sides use it.
 *   5. The screen posts the code.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const intake = codeOf(readFileSync("src/lib/ops-job-intake.ts", "utf8"));
const take = intake.slice(intake.indexOf("export async function takeJob("));
const at = (needle) => take.indexOf(needle);

const lookup = at("await partnerByCode(partnerCode)");
const refuse = at('field: "partnerCode"');
const makeClient = at("await createClient(");
const makeFile = at("await createFile(");
const touch = at("await recordTouch(");
const link = at("await sendPaymentLink(");

check("takeJob looks the code up", lookup > 0);
check("and refuses an unknown code naming the field", refuse > lookup);
check("before any client is written", lookup > 0 && makeClient > refuse);
check("the touch is recorded after the file exists", touch > makeFile && makeFile > 0);
check("and before the payment link raises the order", link > touch && touch > 0);
check("the touch is a code, under the file's key", /kind: "code",\s*visitorKey: fileTouchKey\(file\.id\)/.test(take));
check("a touch that could not be written is said, not lost", /partnerWarning = `/.test(take) && /partnerWarning \? \{ partnerWarning \}/.test(take));

const billing = codeOf(readFileSync("src/lib/ops-job-billing.ts", "utf8"));
const raise = billing.slice(billing.indexOf("async function createOrderForFile("), billing.indexOf("async function termsGap("));
check("the order raised for a file is attributed through ops-partners", /import \{ attributeOrder as attributeToPartner, fileTouchKey \} from "\.\/ops-partners"/.test(billing));
check("under the file's key", /await attributeToPartner\(\{[\s\S]*?visitorKey: fileTouchKey\(file\.id\),?\s*\}\)/.test(raise));
check("after the order row exists", raise.indexOf("await attributeToPartner(") > raise.indexOf('.from("eng_service_orders")'));

const partners = codeOf(readFileSync("src/lib/ops-partners.ts", "utf8"));
check("the key has one home", /export function fileTouchKey\(fileId: string\): string \{\s*return `file:\$\{fileId\}`;/.test(partners));
check("and the web checkout uses the same attributeOrder", /import \{ attributeOrder, VISITOR_COOKIE \} from "@\/lib\/ops-partners"/.test(readFileSync("src/app/api/order-flow/route.ts", "utf8")));

const screen = readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8");
check("New job posts the partner code", /partnerCode: partnerCode\.trim\(\) \|\| null,/.test(screen));
check("and has a labelled field for it", /htmlFor="partnerCode"/.test(screen) && /id="partnerCode"/.test(screen));

console.log("");
if (wrong === 0) {
  console.log("PASS: a code given on the telephone is checked, recorded as a touch on the file, and the order is attributed by the checkout's own rules.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
