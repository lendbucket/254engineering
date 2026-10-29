/**
 * FIVE MORE STAFF LISTS SEARCH, FILTER, SORT AND PAGE, AND COUNT THE WHOLE SET.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/five-staff-lists-search-filter-sort-and-page.mjs
 *
 * Office ready, CLAUDE.md section 2d: "Every list sorts, filters, searches and
 * pages." People, do not contact, asked to be forgotten, insurance and
 * credential review had none of it. Asked of the pure engine with rows handed
 * to it, and of the screens and their reads by their source: each screen reads
 * the whole register (no unbounded select, no hand cap) and pages it here, so
 * every count on it is a count of the whole matching set.
 */
import { readFileSync } from "node:fs";

const { STAFF_LIST_PAGE_SIZE, staffListQuery, staffListRows, staffListPage, PEOPLE_LIST, SUPPRESSION_LIST, DELETION_LIST, CREDENTIAL_LIST, policyList } =
  await import("../../src/lib/staff-lists.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ---- the engine ---- */
const people = Array.from({ length: 123 }, (_, i) => ({
  email: `p${i}@x.invalid`,
  display_name: `Person ${String(i).padStart(3, "0")}`,
  role: "field_tech",
  status: i % 10 === 0 ? "suspended" : "active",
  phone: null,
  base_county: i === 7 ? "Nueces" : null,
  last_sign_in_at: i % 2 === 0 ? `2026-10-${String((i % 28) + 1).padStart(2, "0")}` : null,
  created_at: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:${String(i % 60).padStart(2, "0")}Z`,
}));
const all = staffListRows(people, staffListQuery({}, PEOPLE_LIST), PEOPLE_LIST);
const p3 = staffListPage(all, 3);
check("the total is the whole set, not the page", p3.total === 123 && p3.rows.length === 23 && p3.pages === 3, `${p3.total} total, ${p3.rows.length} on page 3`);
check("a page past the end is the last page, not an empty one", staffListPage(all, 99).page === 3 && staffListPage(all, 99).rows.length === 23);
check("the page size is fifty", STAFF_LIST_PAGE_SIZE === 50);

const suspended = staffListRows(people, staffListQuery({ status: "suspended" }, PEOPLE_LIST), PEOPLE_LIST);
check("a filter keeps only its rows", suspended.length === 13 && suspended.every((p) => p.status === "suspended"), `${suspended.length}`);
check("an unknown filter value shows everything rather than nothing", staffListRows(people, staffListQuery({ status: "deleted" }, PEOPLE_LIST), PEOPLE_LIST).length === 123);
check("a search reads every field it names, case blind", staffListRows(people, staffListQuery({ q: "NUECES" }, PEOPLE_LIST), PEOPLE_LIST).map((p) => p.email).join() === "p7@x.invalid");

const seenDesc = staffListRows(people, staffListQuery({ sort: "seen" }, PEOPLE_LIST), PEOPLE_LIST);
const seenAsc = staffListRows(people, staffListQuery({ sort: "seen", dir: "asc" }, PEOPLE_LIST), PEOPLE_LIST);
const firstNull = (rows) => rows.findIndex((p) => p.last_sign_in_at === null);
check("a missing sign in sorts last read newest first", firstNull(seenDesc) === 62 && seenDesc.slice(62).every((p) => p.last_sign_in_at === null), `first null at ${firstNull(seenDesc)}`);
check("and last read oldest first too, never heading the list", firstNull(seenAsc) === 62);
check("the order is descending then ascending as asked", seenDesc[0].last_sign_in_at >= seenDesc[61].last_sign_in_at && seenAsc[0].last_sign_in_at <= seenAsc[61].last_sign_in_at);
const byName = staffListRows(people, staffListQuery({ sort: "name" }, PEOPLE_LIST), PEOPLE_LIST);
check("name reads A to Z by default", byName[0].display_name === "Person 000" && byName.at(-1).display_name === "Person 122");
check("the engine never reorders the rows it was given", people[0].display_name === "Person 000" && people[1].display_name === "Person 001");

/* Suppressions, deletions, credentials, policies: each filter does what its label says. */
const sup = [
  { email: "a@x.invalid", because: "unsubscribed", createdAt: "2026-10-01", enteredByOperator: false, voided: null },
  { email: "b@x.invalid", because: "asked on the phone", createdAt: "2026-10-02", enteredByOperator: true, voided: null },
  { email: "c@x.invalid", because: "typed", createdAt: "2026-10-03", enteredByOperator: true, voided: { at: "x" } },
];
const supWhere = (params) => staffListRows(sup, staffListQuery(params, SUPPRESSION_LIST), SUPPRESSION_LIST).map((r) => r.email[0]).join("");
check("do not contact: clicked, recorded, in force, marked as a mistake", supWhere({ source: "clicked" }) === "a" && supWhere({ source: "recorded" }) === "cb" && supWhere({ state: "standing" }) === "ba" && supWhere({ state: "mistake" }) === "c");
check("do not contact searches the reason", supWhere({ q: "phone" }) === "b");

const del = [
  { subjectEmail: "z@x.invalid", subjectNote: null, askedFor: "erase me", answered: null, suppressed: true },
  { subjectEmail: "a@x.invalid", subjectNote: "met at the office", askedFor: "remove my photos", answered: { at: "x", because: "y" }, suppressed: true },
];
const delWhere = (params) => staffListRows(del, staffListQuery(params, DELETION_LIST), DELETION_LIST).map((r) => r.subjectEmail[0]).join("");
check("asked to be forgotten: received keeps the read's newest first, address sorts", delWhere({}) === "za" && delWhere({ sort: "email" }) === "az");
check("and waiting and answered filter, and the request's own words are searched", delWhere({ answer: "waiting" }) === "z" && delWhere({ answer: "answered" }) === "a" && delWhere({ q: "photos" }) === "a");

const creds = [
  { name: "Bea", label: "Licence", issuingState: "TX", expiresOn: "2027-01-01", submittedAt: "2026-10-02" },
  { name: "Al", label: "Insurance", issuingState: null, expiresOn: null, submittedAt: "2026-10-01" },
];
const credWhere = (params) => staffListRows(creds, staffListQuery(params, CREDENTIAL_LIST), CREDENTIAL_LIST).map((r) => r.name).join();
check("credentials: oldest submission first, undated expiry last", credWhere({}) === "Al,Bea" && credWhere({ sort: "expires" }) === "Bea,Al" && credWhere({ expiry: "undated" }) === "Al");

const spec = policyList("2026-10-29");
const pols = [
  { kind: "professional_liability", carrier: "Acme", policyNumber: "1", namedInsureds: ["254 Engineering LLC"], expiresOn: "2027-10-01", withdrawnAt: null },
  { kind: "general_liability", carrier: "Bolt", policyNumber: "2", namedInsureds: [], expiresOn: "2026-10-28", withdrawnAt: null },
  { kind: "general_liability", carrier: "Crane", policyNumber: "3", namedInsureds: [], expiresOn: "2027-12-01", withdrawnAt: "2026-10-20" },
];
const polWhere = (params) => staffListRows(pols, staffListQuery(params, spec), spec).map((p) => p.carrier).join();
check("insurance: in force, expired and withdrawn are three, judged on the firm's today", polWhere({ standing: "force" }) === "Acme" && polWhere({ standing: "expired" }) === "Bolt" && polWhere({ standing: "withdrawn" }) === "Crane");
check("and a policy expiring today is in force", staffListRows([{ ...pols[1], expiresOn: "2026-10-29" }], staffListQuery({ standing: "force" }, spec), spec).length === 1);

/* ---- the screens page through the engine, and read the whole register ---- */
for (const [screen, list] of [
  ["people", "PEOPLE_LIST"],
  ["suppressions", "SUPPRESSION_LIST"],
  ["deletion-requests", "DELETION_LIST"],
  ["credentials", "CREDENTIAL_LIST"],
  ["insurance", "spec"],
]) {
  const src = readFileSync(`src/app/portal/(app)/${screen}/page.tsx`, "utf8");
  check(
    `/portal/${screen} filters, sorts and pages through the engine, with controls and a pager`,
    new RegExp(`staffListQuery\\(params, ${list}\\)`).test(src) && new RegExp(`staffListRows\\([^)]*, query, ${list}\\)`).test(src) && /staffListPage\(/.test(src) && /<ListControls\b/.test(src) && /<Pager\b/.test(src),
  );
}
const peoplePage = readFileSync("src/app/portal/(app)/people/page.tsx", "utf8");
check("/portal/people no longer selects the profiles itself", !/\.from\("eng_profiles"\)/.test(peoplePage) && /await readPeople\(\)/.test(peoplePage));
const roster = readFileSync("src/lib/people-roster.ts", "utf8");
check("and its read is every profile, through readEvery", /readEvery<Person>\(\(from, to\) =>[\s\S]*?\.range\(from, to\)/.test(roster));
const supLib = readFileSync("src/lib/marketing-suppression.ts", "utf8");
const listSup = supLib.slice(supLib.indexOf("export async function listSuppressions"), supLib.indexOf("\n}\n", supLib.indexOf("export async function listSuppressions")));
check("the do not contact list is read whole, through readEvery", /readEvery<Record<string, unknown>>\(\(from, to\) =>/.test(listSup) && /\.range\(from, to\)/.test(listSup));
const credLib = readFileSync("src/lib/ops-credential-submissions.ts", "utf8");
const awaiting = credLib.slice(credLib.indexOf("export async function awaitingVerification"), credLib.indexOf("\n}\n", credLib.indexOf("export async function awaitingVerification")));
check("the credential queue is no longer cut at 200, and a failed name read is a failed read", !/\.limit\(/.test(awaiting) && /readEvery</.test(awaiting) && /readEveryIn</.test(awaiting) && /if \(!people\.ok\) return null;/.test(awaiting));
const delPage = readFileSync("src/app/portal/(app)/deletion-requests/page.tsx", "utf8");
check("the unanswered count is of every request, not of the page", /const open = all\?\.filter\(\(r\) => r\.answered === null\)/.test(delPage));
check("and the deletion requests carry no CSV, which is a question for Robert", !/csvHref/.test(delPage));

console.log("");
if (wrong === 0) {
  console.log("PASS: five more staff lists search, filter, sort and page, and every count is of the whole matching set.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
