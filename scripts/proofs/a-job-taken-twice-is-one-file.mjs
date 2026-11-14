/**
 * A NEW JOB SAVED TWICE IS ONE FILE. Part 1 finding 6, 0131.
 *
 * takeJob had no duplicate guard: a save answered "may not have saved" after
 * 20 seconds could still be running when the button came back, and a second
 * press made a second file and, once the gate opens, a second payment link.
 *
 * What must hold:
 *   1. 0131 adds eng_files.intake_request_id and a unique index over the
 *      non-null values, named eng_files_intake_request_once.
 *   2. takeJob asks for a file under the form's draftId BEFORE anything is
 *      written: no-charge record, client, file, answers, touch or link.
 *   3. A failed read refuses rather than reads as "not saved yet".
 *   4. createFile writes the id, and meeting the index returns the FIRST file
 *      (told apart from a file number collision by the index name) rather than
 *      retrying a number.
 *   5. takeJob stops at a duplicate: nothing after the file is written again.
 *   6. The form sends one draftId per sitting, and the done screen says so.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const sql = codeOf(readFileSync("supabase/migrations/0131_a_job_taken_twice_is_one_file.sql", "utf8"));
check("0131 adds the request id column", /alter table eng_files add column if not exists intake_request_id uuid;/.test(sql));
check("with a unique index over the non-null values", /create unique index if not exists eng_files_intake_request_once\s+on eng_files \(intake_request_id\)\s+where intake_request_id is not null;/.test(sql));

const intake = codeOf(readFileSync("src/lib/ops-job-intake.ts", "utf8"));
const take = intake.slice(intake.indexOf("export async function takeJob("));
const ask = take.indexOf('.eq("intake_request_id", intakeRequestId)');
const firstWrites = ["await writeAuditOrRefuse(", "await createClient(", "await createFile(", 'from("eng_file_inputs").insert(', "await recordTouch(", "await sendPaymentLink("]
  .map((w) => ({ w, at: take.indexOf(w) }));
check("takeJob asks for an earlier save", ask > 0);
for (const { w, at } of firstWrites) check(`before ${w.replace("await ", "").replace("(", "")}`, at > ask);
check("a failed read refuses", /if \(firstError\) \{\s*return \{ ok: false, error: `Whether this job was already saved could not be read/.test(take));
check("an earlier save is returned as it is", /if \(first\) \{\s*return \{[\s\S]*?alreadyTaken: true,/.test(take));
check("the id is passed to createFile", /intakeRequestId,\s*\},\s*context,\s*\);/.test(take));
const dup = take.indexOf("if (file.duplicate) {");
check("a duplicate from the index stops takeJob", dup > 0 && /if \(file\.duplicate\) \{\s*return \{[^}]*alreadyTaken: true \};/.test(take));
check("before the answers, touch and link", dup > 0 && ['from("eng_file_inputs").insert(', "await recordTouch(", "await sendPaymentLink("].every((w) => take.indexOf(w) > dup));

const crm = codeOf(readFileSync("src/lib/ops-crm.ts", "utf8"));
const create = crm.slice(crm.indexOf("export async function createFile("));
check("createFile writes the id", /intake_request_id: input\.intakeRequestId \|\| null,/.test(create));
check("and knows the index by name", /const INTAKE_REQUEST_INDEX = "eng_files_intake_request_once";/.test(crm));
const meet = create.indexOf("error.message.includes(INTAKE_REQUEST_INDEX)");
const retry = create.indexOf("if (error && !/duplicate key/i.test(error.message))");
check("meeting it is checked before a number is retried", meet > 0 && retry > meet);
check("and returns the first file, marked duplicate", /return \{ ok: true, id: first\.id as string, fileNumber: first\.file_number as string, duplicate: true \};/.test(create));

const screen = readFileSync("src/app/portal/(app)/intake/IntakeClient.tsx", "utf8");
check("the form mints one draftId per sitting", /const \[draftId\] = useState\(\(\) => crypto\.randomUUID\(\)\);/.test(screen));
check("and sends it with the save", /draftId,\s*uploads:/.test(screen));
check("the done screen says nothing was saved twice", /done\.alreadyTaken \?/.test(screen));

console.log("");
if (wrong === 0) {
  console.log("PASS: a New job saved twice returns the first file and writes nothing a second time.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
