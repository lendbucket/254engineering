/**
 * PROOF: THE PIPELINE MOVES, LISTS AND KEEPS EACH PERSON'S VIEWS. Robert's
 * sales CRM ruling of 2026-11-02, item R4, migration 0113, with his answer 5.
 *
 *   A  0113 on a replay: both tables with row level security; a saved view is
 *      one per person per name, a name another person uses is theirs to use,
 *      its query is an object and its view is the board or the list; a company
 *      has one notes thread and a thread belongs to one company
 *   B  who sees what: a rep sees their own companies and the unowned ones in
 *      the counties of territories they hold (R5, 2026-11-02, which narrowed
 *      R4's "nobody's"), never another rep's; a holder of crm.assign sees all
 *   C  bulk acts: assign is refused to a rep outright; tag touches only what
 *      the person may change and counts what it left alone
 *   D  the list's filters and sorts, each narrowing the whole set: vertical,
 *      stage, region (derived from the county), owner, source, score band,
 *      last activity, and the sorts with an unscheduled company last
 *   E  the board: a column per stage with its whole count, fifty cards, the
 *      rest counted; the two customer stages take no drop
 *   F  saved views keep the search, filters and sort and never the page
 *   G  the company page: the timeline merges the contact log, the notes and
 *      the sources newest first; the linked account carries no money
 *   H  the code: a stage move is refused when the company is not at the stage
 *      the screen showed, before setStage; one read keeps what a person may
 *      see; saved views are read and deleted for their owner only; bulk
 *      assign asks crm.assign in the library and the route; the board offers
 *      a Move to select beside the drag; the old sales list opens the company
 *      page
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-pipeline-moves-lists-and-keeps-each-persons-views.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

const rules = await import("../../src/lib/crm-board-rules.ts");
const { staffListQuery, staffListRows, STAFF_LIST_PAGE_SIZE } = await import("../../src/lib/staff-lists.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });

async function refused(db, sql, params = []) {
  try {
    await db.query(sql, params);
    return { refused: false, message: "" };
  } catch (e) {
    return { refused: true, message: e.message };
  }
}

/* ------------------------------------------------------------------ A, 0113 */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0113_"));
check("A: 0113 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));

const rls = await db.query(`select relname, relrowsecurity from pg_class where relname in ('eng_crm_saved_views', 'eng_prospect_threads') order by relname`);
check("A: both tables exist with row level security on", rls.rows.length === 2 && rls.rows.every((r) => r.relrowsecurity), JSON.stringify(rls.rows));

const ME = "00000000-0000-4000-8000-0000000004a1";
const YOU = "00000000-0000-4000-8000-0000000004a2";
await db.exec(`
  insert into auth.users (id) values ('${ME}'), ('${YOU}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ME}', 'crm-r4-a@audit-probe.invalid', 'CRM proof person A, not a real person', 'admin', 'active'),
    ('${YOU}', 'crm-r4-b@audit-probe.invalid', 'CRM proof person B, not a real person', 'admin', 'active');
`);
await db.query(`insert into eng_crm_saved_views (profile_id, name, view, query) values ($1, 'My roofers', 'list', '{"vertical":"roofer"}')`, [ME]);
const twice = await refused(db, `insert into eng_crm_saved_views (profile_id, name) values ($1, 'My roofers')`, [ME]);
check("A: one person cannot keep two views of one name", twice.refused && /eng_crm_saved_views_name_once/.test(twice.message), twice.message);
const theirs = await refused(db, `insert into eng_crm_saved_views (profile_id, name) values ($1, 'My roofers')`, [YOU]);
check("A: and another person may use the same name for their own", !theirs.refused, theirs.message);
const notObject = await refused(db, `insert into eng_crm_saved_views (profile_id, name, query) values ($1, 'Array', '[1,2]')`, [ME]);
check("A: a view's query is an object", notObject.refused && /eng_crm_saved_views_query_is_object/.test(notObject.message), notObject.message);
const badView = await refused(db, `insert into eng_crm_saved_views (profile_id, name, view) values ($1, 'Calendar', 'calendar')`, [ME]);
check("A: and it opens the board or the list, nothing else", badView.refused && /eng_crm_saved_views_view_known/.test(badView.message), badView.message);
const blank = await refused(db, `insert into eng_crm_saved_views (profile_id, name) values ($1, '   ')`, [ME]);
check("A: and it has a name", blank.refused && /eng_crm_saved_views_named/.test(blank.message), blank.message);

const p1 = (await db.query(`insert into eng_prospects (company, phone, prospect_type, created_by) values ('Proof Roofing One', '361 555 0141', 'roofer', $1) returning id`, [ME])).rows[0].id;
const p2 = (await db.query(`insert into eng_prospects (company, phone, prospect_type, created_by) values ('Proof Roofing Two', '361 555 0142', 'roofer', $1) returning id`, [ME])).rows[0].id;
const t1 = (await db.query(`insert into eng_threads (kind, direct_key, name, created_by) values ('direct', $1, 'Notes', $2) returning id`, [`prospect:${p1}`, ME])).rows[0].id;
const t2 = (await db.query(`insert into eng_threads (kind, direct_key, name, created_by) values ('direct', $1, 'Notes', $2) returning id`, [`prospect:${p2}`, ME])).rows[0].id;
await db.query(`insert into eng_prospect_threads (prospect_id, thread_id, created_by) values ($1, $2, $3)`, [p1, t1, ME]);
const secondThread = await refused(db, `insert into eng_prospect_threads (prospect_id, thread_id) values ($1, $2)`, [p1, t2]);
check("A: a company has one notes thread", secondThread.refused && /eng_prospect_threads_pkey/.test(secondThread.message), secondThread.message);
const sharedThread = await refused(db, `insert into eng_prospect_threads (prospect_id, thread_id) values ($1, $2)`, [p2, t1]);
check("A: and a thread belongs to one company", sharedThread.refused && /eng_prospect_threads_thread_once/.test(sharedThread.message), sharedThread.message);
const sameKey = await refused(db, `insert into eng_threads (kind, direct_key, created_by) values ('direct', $1, $2)`, [`prospect:${p1}`, ME]);
check("A: and 0005's key keeps one thread keyed to a company", sameKey.refused && /eng_threads_direct_key/.test(sameKey.message), sameKey.message);

/* ---------------------------------------------------------------- B and C */
/* R5 (2026-11-02) narrowed "nobody's" to the unowned in the rep's territories; this rep holds Nueces. */
const REP = { id: "rep-1", seesAll: false, counties: new Set(["Nueces"]) };
const MANAGER = { id: "mgr-1", seesAll: true, counties: new Set() };
check("B: a rep sees their own company", rules.canSeeCompany(REP, "rep-1", "Travis"));
check("B: and a company nobody owns in their territory", rules.canSeeCompany(REP, null, "Nueces"));
check("B: but not an unowned one outside it", !rules.canSeeCompany(REP, null, "Travis"));
check("B: and never another rep's", !rules.canSeeCompany(REP, "rep-2", "Nueces"));
check("B: a holder of crm.assign sees every company", rules.canSeeCompany(MANAGER, "rep-2", "Travis") && rules.canSeeCompany(MANAGER, null, null));

const owners = new Map([["a", { ownerId: "rep-1", county: "Travis" }], ["b", { ownerId: null, county: "Nueces" }], ["c", { ownerId: "rep-2", county: "Nueces" }]]);
const repAssign = rules.bulkTargets(REP, "assign", ["a", "b"], owners);
check("C: bulk assign is refused to a rep outright", !repAssign.ok && /sales manager/.test(repAssign.error), JSON.stringify(repAssign));
const mgrAssign = rules.bulkTargets(MANAGER, "assign", ["a", "b", "c"], owners);
check("C: and a manager's touches every company named", mgrAssign.ok && mgrAssign.ids.length === 3 && mgrAssign.refused === 0, JSON.stringify(mgrAssign));
const repTag = rules.bulkTargets(REP, "tag", ["a", "b", "c", "gone", "a"], owners);
check("C: a rep's tag touches their own and nobody's, once each", repTag.ok && repTag.ids.join() === "a,b", JSON.stringify(repTag));
check("C: and counts what it left alone (another rep's, and one that is not there)", repTag.ok && repTag.refused === 2, JSON.stringify(repTag));
check("C: nothing ticked is refused", !rules.bulkTargets(REP, "tag", [], owners).ok);
check("C: more than 500 at once is refused", !rules.bulkTargets(MANAGER, "tag", Array.from({ length: 501 }, (_, i) => `x${i}`), owners).ok);
check("C: none of them yours is refused, not a quiet nothing", !rules.bulkTargets(REP, "tag", ["c"], owners).ok);
check("C: a tag is cleaned and checked", rules.cleanTag("  Storm   Season ").ok && rules.cleanTag("  Storm   Season ").tag === "storm season" && !rules.cleanTag("a;drop").ok && !rules.cleanTag("").ok);

/* ------------------------------------------------------------------- D */
const NOW = Date.parse("2026-11-02T18:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const base = { contactName: null, phone: null, email: null, city: null, tags: [], createdAt: daysAgo(100) };
const ROWS = [
  { ...base, id: "r1", company: "Alpha Roofing", county: "Nueces", vertical: "roofer", stage: "new", score: 80, ownerId: "rep-1", ownerName: "Rep One", sources: ["permits_san_antonio"], nextActionAt: daysAgo(-1), lastActivityAt: daysAgo(3) },
  { ...base, id: "r2", company: "Bravo Solar", county: "Bexar", vertical: "solar", stage: "attempted", score: 30, ownerId: null, ownerName: null, sources: ["tdlr_solar_retailers"], nextActionAt: null, lastActivityAt: daysAgo(40) },
  { ...base, id: "r3", company: "Charlie Realty", county: "Travis", vertical: "real_estate", stage: "interested", score: 55, ownerId: "rep-1", ownerName: "Rep One", sources: ["trec", "csv"], nextActionAt: daysAgo(-3), lastActivityAt: null },
  { ...base, id: "r4", company: "Delta Roofing", county: "Nueces", vertical: "roofer", stage: "dormant", score: 10, ownerId: null, ownerName: null, sources: ["manual"], nextActionAt: daysAgo(-2), lastActivityAt: daysAgo(200), tags: ["storm"] },
];
const spec = rules.crmListSpec("rep-1", NOW);
const ids = (params) => staffListRows(ROWS, staffListQuery(params, spec), spec).map((r) => r.id).join();
check("D: vertical narrows", ids({ vertical: "roofer" }).split(",").sort().join() === "r1,r4", ids({ vertical: "roofer" }));
check("D: stage narrows", ids({ stage: "interested" }) === "r3", ids({ stage: "interested" }));
check("D: region narrows by the county's region, never a stored region", ids({ territory: "coastal-bend" }).split(",").sort().join() === "r1,r4", ids({ territory: "coastal-bend" }));
check("D: owner mine and nobody's", ids({ owner: "mine" }).split(",").sort().join() === "r1,r3" && ids({ owner: "unowned" }).split(",").sort().join() === "r2,r4");
check("D: source narrows on any source the company came from", ids({ source: "csv" }) === "r3" && ids({ source: "trec" }) === "r3", ids({ source: "csv" }));
check("D: score band narrows", ids({ score: "75-100" }) === "r1" && ids({ score: "0-24" }) === "r4", ids({ score: "0-24" }));
check("D: last activity in the last 7 days, older than 90, and never", ids({ activity: "7" }) === "r1" && ids({ activity: "older" }) === "r4" && ids({ activity: "never" }) === "r3");
check("D: filters combine", ids({ vertical: "roofer", owner: "unowned" }) === "r4", ids({ vertical: "roofer", owner: "unowned" }));
check("D: search reads the tags and the owner's name", ids({ q: "storm" }) === "r4" && ids({ q: "rep one" }).split(",").sort().join() === "r1,r3");
check("D: an unknown filter value is ignored, never a filter that hides everything", ids({ stage: "won" }).split(",").length === 4);
check("D: the default sort is the next action, soonest first, unscheduled last", ids({}) === "r1,r4,r3,r2", ids({}));
check("D: score sorts highest first", ids({ sort: "score" }) === "r1,r3,r2,r4", ids({ sort: "score" }));
check("D: company sorts A to Z, and turns round", ids({ sort: "company" }) === "r1,r2,r3,r4" && ids({ sort: "company", dir: "desc" }) === "r4,r3,r2,r1");

/* ------------------------------------------------------------------- E */
const many = Array.from({ length: 60 }, (_, i) => ({ ...ROWS[0], id: `n${i}`, stage: "new" }));
const cols = rules.boardColumns([...many, ROWS[2]]);
const newCol = cols.find((c) => c.stage === "new");
check("E: a column per stage, in the stage order", cols.map((c) => c.stage).join() === "new,attempted,connected,interested,account_opened,ordering,dormant,do_not_contact");
check("E: a column's count is the whole column, its cards at most fifty, the rest counted", newCol.count === 60 && newCol.rows.length === rules.BOARD_COLUMN_CARDS && newCol.more === 10, JSON.stringify({ count: newCol.count, rows: newCol.rows.length, more: newCol.more }));
check("E: the two customer stages take no drop; the others do", cols.filter((c) => !c.acceptsDrop).map((c) => c.stage).join() === "account_opened,ordering");

/* ------------------------------------------------------------------- F */
const saved = rules.cleanSavedQuery({ q: "roof", vertical: "roofer", page: "3", sort: "score", evil: "x", dir: "desc", stage: "" });
check("F: a saved view keeps the search, filters and sort", saved.q === "roof" && saved.vertical === "roofer" && saved.sort === "score" && saved.dir === "desc");
check("F: and never the page, an empty value or a key it does not know", !("page" in saved) && !("evil" in saved) && !("stage" in saved), JSON.stringify(saved));
check("F: a view needs a name of at most 80 characters", rules.savedViewNameProblem("  ") && rules.savedViewNameProblem("x".repeat(81)) && !rules.savedViewNameProblem("My roofers"));

/* ------------------------------------------------------------------- G */
const merged = rules.mergeTimeline(
  [{ at: "2026-11-01T10:00:00Z", kind: "call", title: "Call", body: null, byName: null }, { at: "2026-11-01T10:00:00Z", kind: "stage_change", title: "Stage change", body: null, byName: null }],
  [{ at: "2026-11-02T09:00:00Z", kind: "message", title: "Note", body: "x", byName: null }],
  [{ at: "2026-10-01T00:00:00Z", kind: "source", title: "Arrived", body: null, byName: null }],
);
check("G: the timeline is the three histories, newest first", merged.map((e) => e.kind).join() === "message,call,stage_change,source", merged.map((e) => e.kind).join());
const acct = rules.linkedAccountView("acc-1", [
  { reference: "254-A", placed_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", status: "complete" },
  { reference: "254-B", placed_at: null, created_at: "2026-10-20T00:00:00Z", status: "awaiting_payment" },
]);
check("G: the linked account counts the orders and dates them", acct.orderCount === 2 && acct.firstOrderAt === "2026-10-01T00:00:00Z" && acct.lastOrderAt === "2026-10-20T00:00:00Z" && acct.recent[0].reference === "254-B");
check("G: and carries no money field at all", !JSON.stringify(acct).match(/cents|total|price|revenue|amount/i), JSON.stringify(acct));

/* ------------------------------------------------------------------- H */
const pipeline = readSource("src/lib/crm-pipeline.ts");
const moveBody = pipeline.slice(pipeline.indexOf("export async function moveStage("), pipeline.indexOf("/* --------------------------------------------------------------- bulk acts */"));
check("H: a stage move needs the stage the screen showed", /if \(!input\.from\) return refuse\(/.test(moveBody));
check("H: and is refused, before setStage, when the company is not at it", moveBody.indexOf("if (input.from !== now)") > 0 && moveBody.indexOf("if (input.from !== now)") < moveBody.indexOf("setStage("));
check("H: and the move itself is R1's setStage, which writes the stage change to the history", /await setStage\(actor, input\.prospectId, input\.to as CrmStage\)/.test(moveBody));
const listBody = pipeline.slice(pipeline.indexOf("export async function companiesFor("), pipeline.indexOf("async function visibleCompany("));
check("H: one read keeps what a person may see, by canSeeCompany with the county", /read\.rows\.filter\(\(r\) => canSeeCompany\(viewer, \(r\.owner_id as string \| null\) \?\? null, \(r\.county as string \| null\) \?\? null\)\)/.test(listBody) && /if \(!viewer\.seesAll\) q = q\.or\(`owner_id\.eq\.\$\{actor\.id\},owner_id\.is\.null`\)/.test(listBody));
check("H: the company page and every write go through visibleCompany or the same rule", /canSeeCompany\(who\.viewer, \(row\.owner_id as string \| null\) \?\? null, \(row\.county as string \| null\) \?\? null\)/.test(pipeline) && (pipeline.match(/await visibleCompany\(actor, db,/g) ?? []).length >= 2);
const viewsBody = pipeline.slice(pipeline.indexOf("export async function savedViewsFor("), pipeline.indexOf("/* ----------------------------------------------------- the company's notes */"));
check("H: saved views are read for their owner only", /from\("eng_crm_saved_views"\)\.select\("id, name, view, query"\)\.eq\("profile_id", actor\.id\)/.test(viewsBody));
check("H: and deleted for their owner only, somebody else's being not found", /\.delete\(\)\.eq\("id", id\)\.eq\("profile_id", actor\.id\)/.test(viewsBody) && /That view is not one of yours/.test(viewsBody));
check("H: bulk assign asks crm.assign in the library", /if \(!can\(actor, "crm\.assign"\)\) return refuse\(/.test(pipeline));
const route = readSource("src/app/api/portal/crm/route.ts");
check("H: and in the route", /action === "bulk_assign"\) \{\s*if \(!can\(actor, "crm\.assign"\)\)/.test(route));
const pageBody = pipeline.slice(pipeline.indexOf("export async function companyPage("));
check("H: the company page reads no money from the orders", /select\("reference, placed_at, created_at, status"\)/.test(pageBody) && !/total_cents|price_cents/.test(pageBody));
check("H: and merges the contact log, the notes and the sources", /mergeTimeline\(logEntries, noteEntries, sourceEntries\)/.test(pageBody));
const client = readSource("src/app/portal/(app)/crm/PipelineClient.tsx");
check("H: the board offers a Move to select beside the drag, for a keyboard and a phone", /draggable=\{/.test(client) && /htmlFor=\{`move-\$\{card\.id\}`\}/.test(client) && /onChange=\{\(e\) => void moveTo\(card\.id, col\.stage, e\.target\.value\)\}/.test(client));
check("H: every move sends the stage the card showed", /action: "move_stage", prospectId, from, to/.test(client));
check("H: the board scrolls inside its own region, not the page", /role="region" aria-label="Stage board" tabIndex=\{0\} className="mt-3 overflow-x-auto/.test(client));
const listPage = readSource("src/app/portal/(app)/crm/list/page.tsx");
check("H: the list pages fifty at a time and counts the whole match", /staffListPage\(read\.matching, read\.query\.page\)/.test(listPage) && STAFF_LIST_PAGE_SIZE === 50);
check("H: the old sales list opens the company page", /href=\{`\/portal\/crm\/\$\{r\.id\}`\}/.test(readSource("src/app/portal/(app)/prospects/page.tsx")));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note && !x.ok ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the pipeline moves a company only from the stage the screen showed, lists and filters the whole set a person may see, assigns for a manager, tags what is yours, keeps each person's views to themselves, and shows a company's whole history and account with no money."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
