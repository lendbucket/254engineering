/**
 * NEW JOB ASKS WHAT THE CALL ACTUALLY NEEDS, AND NOTHING IS TYPED TWICE.
 * The Killeen call, item 2 (Robert, 2026-11-14), and 0132.
 *
 * What must hold:
 *   1. The report's items, its pages and photos are asked on New job (firm
 *      audience, so the customer's form is unchanged), and attic access is asked
 *      on every field line but roof, whose signed protocol asks it.
 *   2. The closing or permit date the caller gives (hard_deadline) becomes the
 *      due date unless the rep set one; the due-date hint no longer asks for it
 *      to be typed twice.
 *   3. Who else gets the letter is contacts, each with a role and an email, and
 *      the free text copy_to is not asked on New job as well.
 *   4. Contacts are checked before anything is written, at most one pays, and
 *      the payment link goes to whoever pays; a failed read of who pays refuses.
 *   5. 0132's table holds the same rules as the code: roles, an email, one payer.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const fields = codeOf(readFileSync("data/intake-fields.ts", "utf8"));
const field = (id) => {
  const at = fields.indexOf(`id: "${id}"`);
  return at < 0 ? "" : fields.slice(at, fields.indexOf("}", at));
};
for (const id of ["report_items", "report_pages", "report_photos", "attic_access"]) {
  check(`${id} is asked, by the firm only`, /audience: "firm"/.test(field(id)));
}
check("the report pages and photos are uploads", /kind: "file"/.test(field("report_pages")) && /kind: "file"/.test(field("report_photos")));
check("attic access skips roof, whose protocol asks it", !field("attic_access").includes("roof-inspections") && field("attic_access").includes("structural-letters"));

const intake = codeOf(readFileSync("src/lib/ops-job-intake.ts", "utf8"));
check("the caller's date becomes the due date unless the rep set one", /dueAt: input\.dueAt \|\| \(answers\.hard_deadline \? endOfFirmDay\(answers\.hard_deadline\.trim\(\)\) : null\) \|\| null,/.test(intake));
const take = intake.slice(intake.indexOf("export async function takeJob("));
check("contacts are checked before anything is written", take.indexOf("contactProblem(contacts)") > 0 && take.indexOf("contactProblem(contacts)") < take.indexOf("await createClient("));
check("and saved before the payment link", take.indexOf("await addFileContacts(") > 0 && take.indexOf("await addFileContacts(") < take.indexOf("await sendPaymentLink("));
check("contacts that could not be saved stop the link", /if \(input\.paymentIntent === "link_sent" && contactsWarning\) \{/.test(take));

check("an empty New job is told what to choose, not that the catalog lacks it", take.indexOf('error: "Choose the service line."') > 0 && take.indexOf('error: "Choose the service line."') < take.indexOf("catalogFor(input.serviceSlug, input.tier)"));

const screen = codeOf(readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8"));
check("New job does not ask copy_to as well", /fieldsFor\(serviceSlug, tier\)\.filter\(\(f\) => f\.id !== "copy_to"\)/.test(screen));
check("it asks for contacts with a role, a name and an email", /id=\{`contact-role-\$\{i\}`\}/.test(screen) && /id=\{`contact-email-\$\{i\}`\}/.test(screen));
check("and who pays", /<legend className=\{label\}>Who pays<\/legend>/.test(screen) && /pays: payer === i/.test(screen));
check("the due-date hint does not ask for the closing date twice", /A closing or permit date the caller gives below becomes the due date/.test(screen));

const contacts = codeOf(readFileSync("src/lib/file-contacts.ts", "utf8"));
check("at most one pays", /if \(payers > 1\) return \{ error: "Only one person pays\./.test(contacts));
check("a failed read of who pays refuses", /const contacts = await fileContacts\(fileId\);\s*if \(!contacts\.ok\) return contacts;/.test(contacts));
const billing = codeOf(readFileSync("src/lib/ops-job-billing.ts", "utf8"));
check("the payment link goes to whoever pays", /const payer = await payerFor\(fileId,/.test(billing) && /if \(!payer\.ok\) return \{ ok: false, error: `\$\{payer\.error\} No link was sent\.` \};/.test(billing));

const sql = codeOf(readFileSync("supabase/migrations/0132_a_job_names_who_else_gets_the_letter.sql", "utf8"));
check("0132 holds the same roles", /check \(role in \('agent', 'lender', 'title', 'other'\)\)/.test(sql));
check("an email on every contact", /email\s+text not null check/.test(sql));
check("and one payer per file", /create unique index if not exists eng_file_contacts_one_payer[\s\S]*?where pays and removed_at is null;/.test(sql));
check("with row level security on", /alter table eng_file_contacts enable row level security;/.test(sql));

console.log("");
if (wrong === 0) {
  console.log("PASS: New job asks what the call needs, in one place each, and the link goes to whoever pays.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
