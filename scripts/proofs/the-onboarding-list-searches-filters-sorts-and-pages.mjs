/**
 * THE ONBOARDING LIST SEARCHES, FILTERS, SORTS AND PAGES, ITS COUNT IS OF THE
 * PEOPLE WHO MATCH, AND A FAILED READ IS SAID.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-onboarding-list-searches-filters-sorts-and-pages.mjs
 *
 * Robert's ruling of 10:52 Central 2026-10-29: "Build list controls for
 * onboarding." Office ready, 2026-10-20: "Every list sorts, filters, searches
 * and pages." The query rules are pure and run here on built input; then the
 * source is read for the properties a page rests on: the page and its count
 * apply the same search, filters and technician scope, the page is bounded and
 * tie broken, and neither the onboarding read nor the applications read turns
 * a failure into an empty list.
 */
import { readFileSync } from "node:fs";

const { onboardingListQuery, onboardingSearchOr } = await import("../../src/lib/onboarding-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const none = onboardingListQuery({});
check(
  "with nothing asked, everyone, newest invited first, page one",
  none.term === "" && none.status === "all" && none.role === "all" && none.sort === "invited" && none.ascending === false && none.page === 1,
);
check("by name reads A to Z unless told otherwise", onboardingListQuery({ sort: "name" }).ascending === true && onboardingListQuery({ sort: "name", dir: "desc" }).ascending === false);
check(
  "an unknown status, role or sort falls back rather than reaching the database",
  onboardingListQuery({ status: "x'; drop" }).status === "all" && onboardingListQuery({ role: "admin" }).role === "all" && onboardingListQuery({ sort: "salary" }).sort === "invited",
);
check("every status the table holds is a filter", ["invited", "in_progress", "submitted", "verified", "complete"].every((s) => onboardingListQuery({ status: s }).status === s));
check("a page that is not a number is page one", onboardingListQuery({ page: "x" }).page === 1 && onboardingListQuery({ page: "-2" }).page === 1 && onboardingListQuery({ page: "3" }).page === 3);
const hostile = onboardingListQuery({ q: "smith,email.eq.x)(*%" });
check("the term loses what PostgREST's or() reads as syntax", !/[,()*%\\]/.test(hostile.term), hostile.term);
const or = onboardingSearchOr("Reyna");
check("a search reaches the name and the email", or === "person_name.ilike.%Reyna%,email.ilike.%Reyna%", or ?? "");
check("a phone is matched on its digits however it was typed", (onboardingSearchOr("210 555") ?? "").includes("phone.ilike.%2%1%0%5%5%5%"));
check("no term, no search", onboardingSearchOr("") === null);

const lib = readFileSync("src/lib/onboarding.ts", "utf8");
const list = lib.slice(lib.indexOf("export async function listOnboardingsPage("), lib.indexOf("export async function countOnboardings("));
const count = lib.slice(lib.indexOf("export async function countOnboardings("), lib.indexOf("export async function onboardedEmails("));
const emails = lib.slice(lib.indexOf("export async function onboardedEmails("), lib.indexOf("export async function getOnboarding("));
check("the three readers were found", list.length > 0 && count.length > 0 && emails.length > 0);
for (const [name, body] of [["the page", list], ["the count", count]]) {
  check(
    `${name} applies the search, the status, the role, and the technician scope`,
    /onboardingSearchOr\(query\.term\)/.test(body) &&
      /\.eq\("status", query\.status\)/.test(body) &&
      /if \(options\.fieldTechOnly\) read = read\.eq\("role", "field_tech"\);\s*else if \(query\.role !== "all"\) read = read\.eq\("role", query\.role\);/.test(body),
  );
}
check("the page is bounded, ordered, and tie broken by id", /\.range\(offset, offset \+ ONBOARDING_PAGE_SIZE - 1\)/.test(list) && /\.order\("id", \{ ascending: true \}\)/.test(list));
check("the page answers a failed read with null, never an empty list", /if \(error \|\| !data\) return null;/.test(list) && !/return \[\];/.test(list));
check("the count is exact and null on error", /count: "exact", head: true/.test(count) && /if \(error\) return null;/.test(count));
check(
  "the invited set reads every row against an exact count, or nothing",
  /count: "exact", head: true/.test(emails) && /for \(let offset = 0; offset < count; offset \+= PAGE\)/.test(emails) && /if \(read !== count\) return null;/.test(emails),
);
check("the unbounded listOnboardings() is gone", !/export async function listOnboardings\(/.test(lib));

const apps = readFileSync("src/lib/ops-onboarding.ts", "utf8");
const appsList = apps.slice(apps.indexOf("export async function listApplications("), apps.indexOf("export async function inviteFromApplication("));
check("the applications read is null on error, not an empty list", /if \(error \|\| !data\) return null;/.test(appsList) && !/data \?\? \[\]/.test(appsList));

const page = readFileSync("src/app/portal/(app)/onboarding/page.tsx", "utf8");
check("the screen reads one query and hands it to the page and the count", /const query = onboardingListQuery\(params\);/.test(page) && /listOnboardingsPage\(query, scope\)/.test(page) && /countOnboardings\(query, scope\)/.test(page));
check("the scope is the technician grant the screen already computed", /const scope = \{ fieldTechOnly: technicianOnly \};/.test(page));
check("it offers search, filters and a sort, and pages over the matching count", /<ListControls/.test(page) && /<Pager[\s\S]*?pageSize=\{ONBOARDING_PAGE_SIZE\}[\s\S]*?total=\{total\}/.test(page));
check("a technician-only grant is not offered a role filter it cannot use", /\.\.\.\(technicianOnly\s*\?\s*\[\]/.test(page));
check("both failed reads are said on the screen", /The onboarding list could not be read/.test(page) && /The applications could not be read/.test(page));
check("the applications bound is stated when a read fills it", /allApplications\.length === APPLICATION_READ_LIMIT/.test(page));
check("choosing a person keeps the search and the page", /listHref\("\/portal\/onboarding", listParams, \{ id: o\.id \}\)/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the onboarding list searches, filters, sorts and pages, its count is of the people who match, and a failed read is said.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
