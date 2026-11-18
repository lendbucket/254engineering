/**
 * A CLIENT WHOSE EMAIL ANOTHER CLIENT HOLDS IS MARKED A POSSIBLE DUPLICATE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-shared-email-marks-a-possible-duplicate-client.mjs
 *
 * Robert's answer 8 to the evening report of 2026-11-17 (6963018405): a second
 * client at the same address is a real second client, there is no unique
 * constraint, and the clients screen marks a possible duplicate when two clients
 * share an address (their email: src/lib/client-duplicate-rules.ts).
 *
 *   A  the rule, exercised: two clients with one email, in any case or with
 *      stray spaces, are shared; one client is not shared with itself; clients
 *      with no email share nothing
 *   B  the read covers every client that is not a demonstration, not only the
 *      page, compares again exactly before marking, and says null on a failure
 *   C  the screen marks the row and the phone card, never merges or refuses,
 *      and says so when the check could not run
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { sharedEmails, comparableEmail } = await import("../../src/lib/client-duplicate-rules.ts");
const set = (rows) => [...sharedEmails(rows)].sort().join(",");

check("A: two clients with one email are shared", set([{ id: "1", email: "a@x.com" }, { id: "2", email: "a@x.com" }]) === "a@x.com");
check("A: whatever the case, and stray spaces", set([{ id: "1", email: "Bob@Example.com" }, { id: "2", email: " bob@example.com " }]) === "bob@example.com");
check("A: one client is not a duplicate of itself, even read twice", set([{ id: "1", email: "a@x.com" }, { id: "1", email: "a@x.com" }]) === "");
check("A: clients with no email share nothing", set([{ id: "1", email: null }, { id: "2", email: "" }, { id: "3", email: "  " }]) === "");
check("A: different emails are not shared", set([{ id: "1", email: "a@x.com" }, { id: "2", email: "b@x.com" }]) === "");
check("A: a blank address compares as none", comparableEmail("   ") === null && comparableEmail(" A@B.C ") === "a@b.c");

const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
const at = crm.indexOf("export async function sharedClientEmails(");
const read = crm.slice(at, crm.indexOf("\n}\n", at) + 2);
check("B: the read is there", at !== -1);
check("B: it reads every client that is not a demonstration", /\.from\("eng_clients"\)\.select\("id, email"\)\.not\("is_demo", "is", true\)/.test(read));
check("B: it compares again exactly before marking", /return sharedEmails\(seen\);/.test(read));
check("B: and a failed read says null, never an empty set", /if \(error\) \{[\s\S]*?return null;/.test(read));

const page = readFileSync("src/app/portal/(app)/clients/page.tsx", "utf8");
check("C: the screen asks the read for this page's emails", /await sharedClientEmails\(clients\.map\(\(c\) => c\.email\)\)/.test(page));
const marks = page.match(/<Chip label="Possible duplicate: another client has this email" tone="warn" \/>/g) ?? [];
check("C: it marks the table row and the phone card", marks.length === 2, `${marks.length} mark(s)`);
check("C: and says so when the check could not run", /shared === null \?/.test(page) && /could not be checked, so no possible duplicate is marked/.test(page));

console.log(wrong === 0 ? "PASS: a client whose email another client holds is marked a possible duplicate." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
