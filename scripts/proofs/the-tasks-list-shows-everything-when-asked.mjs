/**
 * THE TASKS LIST SHOWS EVERYTHING WHEN ASKED, SEARCHES AND PAGES, AND SAYS A
 * FAILED READ RATHER THAN "NOTHING ON THE LIST".
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-tasks-list-shows-everything-when-asked.mjs
 *
 * Office ready, operator ruling of 2026-10-20, and the 2026-10-12 ruling that a
 * failed read is not an empty list. Two defects found doing it: the Everything
 * chip sent status=all, which fell into the branch that leaves out done and
 * cancelled tasks, so Everything showed what Open showed; and the screen called
 * listTasks, which folded a failed read into []. Read from the source, because
 * the read runs against a database through the actor's own scope.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const lib = readFileSync("src/lib/ops-tasks.ts", "utf8");
const fn = lib.slice(lib.indexOf("export async function listTasksPage("), lib.indexOf("export type CreateTaskInput"));
check("everything means no status filter at all", /if \(filters\.status === "all"\) \{\s*\/\* no status filter \*\/\s*\}/.test(fn));
check("no status is open: done and cancelled left out", /else query = query\.not\("status", "in", "\(done,cancelled\)"\);/.test(fn) && /else if \(filters\.status\) query = query\.eq\("status", filters\.status\);/.test(fn));
check("a search over the title, cleaned by the shared rule", /const term = cleanSearchTerm\(filters\.q \?\? ""\);/.test(fn) && /query\.ilike\("title", `%\$\{term\}%`\)/.test(fn));
check("it pages, reading one past the page to say whether more follow", /\.range\(from, from \+ TASK_PAGE_SIZE\)/.test(fn) && /more: all\.length > TASK_PAGE_SIZE/.test(fn) && /\.order\("id", \{ ascending: true \}\)/.test(fn));
check("a failed read is null, never an empty page", /if \(error\) \{[\s\S]*?return null;/.test(fn));
check("and what a person may see is still filtered, page by page", /canSeeTask\(actor, \{ assigneeId: t\.assignee_id, createdBy: t\.created_by, fileId: t\.file_id \}\)/.test(fn));
const read = lib.slice(lib.indexOf("export async function listTasksRead("), lib.indexOf("/** One page of tasks. */"));
check("the dashboard's read is the first page of the same rule, so the two cannot drift", /const page = await listTasksPage\(actor, filters\);\s*return page \? page\.rows : null;/.test(read));

const page = readFileSync("src/app/portal/(app)/tasks/page.tsx", "utf8");
check("the screen reads the page, not the read that folds a failure to []", /const read = await listTasksPage\(actor, \{ status: params\.status, q: params\.q, page \}\);/.test(page) && !/await listTasks\(/.test(page));
check("a failed read says the list could not be loaded", /\{!read \? \(\s*<div role="alert" data-list-not-loaded/.test(page));
check("it has a search box that keeps the chosen status", /name="q"/.test(page) && /<input type="hidden" name="status" value=\{params\.status\} \/>/.test(page));
check("it links to the previous and next page", /Previous page/.test(page) && /pageHref\(page \+ 1\)/.test(page));
check("the overdue figure says when it is of one page", /overdue\{read\?\.more \|\| page > 1 \? " on this page" : ""\}/.test(page));
check("and 'not seeded yet' is said only of the unfiltered first page", /read && !params\.q && page === 1 && seeded\.length === 0/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the tasks list shows everything when asked, searches and pages, and says a failed read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
