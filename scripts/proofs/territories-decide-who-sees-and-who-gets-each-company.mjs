// @runtime react-server
//
// Declared because it imports src/lib/crm-territories.ts and ops-prospects.ts, which carry server-only.

/**
 * PROOF: TERRITORIES DECIDE WHO SEES EACH COMPANY AND WHO GETS EACH NEW ONE.
 * Robert's sales CRM ruling of 2026-11-02, item R5: "Territories by county
 * grouped into regions; a rep holds one or more; new imports assign round robin
 * within the territory; ops_manager and admin reassign singly or in bulk; a rep
 * sees only their own and unassigned in their territory, managers see all."
 * Migration 0114.
 *
 *   A  0114 on a replay: three tables with row level security; a county is in
 *      one territory however it is spelled; a territory name once
 *   B  who sees what: a rep sees their own and the unassigned in their
 *      territories, never another territory's unassigned nor another rep's; a
 *      manager sees all; a company with no county or an unknown one is no rep's
 *   C  counties: a county already in another territory is refused by name; a
 *      string that is not a Texas county is refused; spellings are canonical
 *   D  the round robin: turns cycle through the holders in a fixed order, the
 *      cursor carries on from where it was; a company in no territory, or in one
 *      nobody active holds, stays unassigned
 *   E  against a stand-in database: a suspended holder is skipped; the cursor is
 *      advanced conditionally on the value read; an import's companies take
 *      their owners in turn
 *   F  bulk reassign is a manager's: refused to a rep in the rules, the library
 *      and the route
 *   G  /portal/prospects/[id] reads a company the rep may not see as not found
 *   H  the code: Write and a held record take the round robin before anything
 *      is written; a rep may take an unowned company for themselves but not give
 *      one away; the territories screen and route ask crm.assign; the queue, the
 *      board, the list and the old prospects screens all ask canSeeCompany
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/territories-decide-who-sees-and-who-gets-each-company.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

process.env.SUPABASE_URL = "http://territories-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "territories-proof-not-a-key";
delete process.env.VERCEL_ENV;

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

/* ------------------------------------------------------------------ A, 0114 */
const pg = new PGlite();
await pg.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0114_"));
check("A: 0114 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at + 1)) await pg.exec(readSource(join(DIR, f)));

const rls = await pg.query(`select relname, relrowsecurity from pg_class where relname in ('eng_crm_territories', 'eng_crm_territory_counties', 'eng_crm_territory_reps') order by relname`);
check("A: all three tables exist with row level security", rls.rows.length === 3 && rls.rows.every((r) => r.relrowsecurity), JSON.stringify(rls.rows));
const t1 = (await pg.query(`insert into eng_crm_territories (name) values ('South Texas') returning id`)).rows[0].id;
const t2 = (await pg.query(`insert into eng_crm_territories (name) values ('Hill Country') returning id`)).rows[0].id;
await pg.query(`insert into eng_crm_territory_counties (territory_id, county) values ($1, 'Bexar')`, [t1]);
const twice = await refused(pg, `insert into eng_crm_territory_counties (territory_id, county) values ($1, ' bexar ')`, [t2]);
check("A: a county already in one territory is refused in another, however it is spelled", twice.refused && /eng_crm_territory_counties_county_once/.test(twice.message), twice.message);
const sameName = await refused(pg, `insert into eng_crm_territories (name) values (' south texas ')`);
check("A: a territory name is used once, whatever its case or spacing", sameName.refused && /eng_crm_territories_name_once/.test(sameName.message), sameName.message);
const negative = await refused(pg, `update eng_crm_territories set rr_cursor = -1 where id = $1`, [t1]);
check("A: the round robin cursor cannot go below zero", negative.refused && /eng_crm_territories_cursor_counts/.test(negative.message), negative.message);
const blankName = await refused(pg, `insert into eng_crm_territories (name) values ('   ')`);
check("A: a territory needs a name", blankName.refused && /eng_crm_territories_named/.test(blankName.message), blankName.message);
await pg.close();

/* ------------------------------------------------------------------ B and C */
const rules = await import("../../src/lib/crm-board-rules.ts");
const terr = await import("../../src/lib/crm-territory-rules.ts");

const REP = { id: "rep-1", seesAll: false, counties: new Set(["Bexar", "Comal"]) };
const MANAGER = { id: "mgr-1", seesAll: true, counties: new Set() };
check("B: a rep sees their own company, wherever it is", rules.canSeeCompany(REP, "rep-1", "Travis") && rules.canSeeCompany(REP, "rep-1", null));
check("B: and an unassigned company in their territory", rules.canSeeCompany(REP, null, "Bexar") && rules.canSeeCompany(REP, null, "Comal"));
check("B: written any way the coverage map recognizes", rules.canSeeCompany(REP, null, "bexar county") && rules.canSeeCompany(REP, null, "  COMAL "));
check("B: but not an unassigned company in another territory", !rules.canSeeCompany(REP, null, "Travis"));
check("B: and never another rep's, even in their own territory", !rules.canSeeCompany(REP, "rep-2", "Bexar"));
check("B: an unassigned company with no county, or one the map does not know, is no rep's", !rules.canSeeCompany(REP, null, null) && !rules.canSeeCompany(REP, null, "Atlantis"));
check("B: a manager sees all", rules.canSeeCompany(MANAGER, "rep-2", "Travis") && rules.canSeeCompany(MANAGER, null, null) && rules.canSeeCompany(MANAGER, null, "Atlantis"));

const held = new Map([["Bexar", { territoryId: "t-south", territoryName: "South Texas" }]]);
const clash = terr.countiesProblem("t-hill", ["Travis", "Bexar"], held);
check("C: a county in another territory is refused by name", !clash.ok && /Bexar County is already in South Texas/.test(clash.error), JSON.stringify(clash));
const own = terr.countiesProblem("t-south", ["Bexar", "Comal"], held);
check("C: a territory may keep a county it already holds", own.ok && own.counties.join() === "Bexar,Comal", JSON.stringify(own));
const notTexas = terr.countiesProblem("t-hill", ["Orange County, California"], held);
check("C: a string that is not a Texas county is refused", !notTexas.ok && /not one of the 254 Texas counties/.test(notTexas.error), JSON.stringify(notTexas));
const canon = terr.countiesProblem(null, ["travis county", "Travis", " TRAVIS "], new Map());
check("C: spellings become the one canonical name, once", canon.ok && canon.counties.join() === "Travis", JSON.stringify(canon));
check("C: every region of the coverage map is offered with its counties, 254 in all", terr.countiesByRegion().reduce((n, r) => n + r.counties.length, 0) === 254 && terr.countiesByRegion().length === 8);
check("C: a territory needs a name of at most 80 characters", terr.territoryNameProblem(" ") !== null && terr.territoryNameProblem("x".repeat(81)) !== null && terr.territoryNameProblem("South Texas") === null);

/* ---------------------------------------------------------------------- D */
const countyMap = new Map([["Bexar", "t-south"], ["Comal", "t-south"], ["Travis", "t-hill"]]);
const holders = new Map([["t-south", ["rep-b", "rep-a"]], ["t-hill", []]]);
const plan = terr.planRoundRobin(
  [
    { id: "c1", county: "Bexar" },
    { id: "c2", county: "comal" },
    { id: "c3", county: "Bexar" },
    { id: "c4", county: "Travis" },
    { id: "c5", county: null },
  ],
  countyMap,
  holders,
  new Map([["t-south", 3]]),
);
check("D: turns go to the holders in a fixed order, carrying on from the cursor", plan.owners.get("c1") === "rep-b" && plan.owners.get("c2") === "rep-a" && plan.owners.get("c3") === "rep-b", JSON.stringify([...plan.owners]));
check("D: and the cursor moves on one per company", plan.cursors.get("t-south") === 6);
check("D: a company in a territory nobody active holds stays unassigned", plan.owners.get("c4") === null && !plan.cursors.has("t-hill"));
check("D: and a company in no territory stays unassigned", plan.owners.get("c5") === null);

/* ---------------------------------------------------------------- E, F, G */
const ME = "00000000-0000-4000-8000-0000000000a1";
const REP2 = "00000000-0000-4000-8000-0000000000a2";
const SUSPENDED = "00000000-0000-4000-8000-0000000000a3";
const ROWS = {
  eng_crm_territories: [{ id: "t-south", name: "South Texas", rr_cursor: 0 }],
  eng_crm_territory_counties: [{ territory_id: "t-south", county: "Bexar" }],
  eng_crm_territory_reps: [
    { territory_id: "t-south", profile_id: ME },
    { territory_id: "t-south", profile_id: REP2 },
    { territory_id: "t-south", profile_id: SUSPENDED },
  ],
  eng_profiles: [
    { id: ME, status: "active", display_name: "Jordan Proof", role: "rep" },
    { id: REP2, status: "active", display_name: "Casey Proof", role: "rep" },
    { id: SUSPENDED, status: "suspended", display_name: "Sam Suspended", role: "rep" },
  ],
  eng_prospects: [
    { id: "p-mine", company: "Mine Roofing", owner_id: ME, county: "Travis", status: "open", stage: "new", prospect_type: "roofer", created_at: "2026-11-01", updated_at: "2026-11-01" },
    { id: "p-south", company: "South Unassigned", owner_id: null, county: "Bexar", status: "open", stage: "new", prospect_type: "roofer", created_at: "2026-11-01", updated_at: "2026-11-01" },
    { id: "p-hill", company: "Hill Unassigned", owner_id: null, county: "Travis", status: "open", stage: "new", prospect_type: "roofer", created_at: "2026-11-01", updated_at: "2026-11-01" },
    { id: "p-other", company: "Casey's Roofing", owner_id: REP2, county: "Bexar", status: "open", stage: "new", prospect_type: "roofer", created_at: "2026-11-01", updated_at: "2026-11-01" },
  ],
  eng_contact_log: [],
};
const state = { reads: 0, patches: [], fail: new Set(), cursorRace: false };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const filterRows = (rows, params) => {
  let res = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "or", "on_conflict"].includes(k)) continue;
    if (v.startsWith("eq.")) res = res.filter((r) => String(r[k]) === v.slice(3));
    else if (v.startsWith("in.(")) {
      const set = v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      res = res.filter((r) => set.includes(String(r[k])));
    } else if (v === "is.null") res = res.filter((r) => r[k] === null || r[k] === undefined);
  }
  return res;
};
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const table = url.pathname.replace("/rest/v1/", "");
  const params = [...url.searchParams.entries()];
  const objectWanted = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (req.method === "GET" || req.method === "HEAD") {
    state.reads += 1;
    if (state.fail.has(table)) return json({ message: `proof: ${table} could not be read` }, 500);
    const rows = filterRows(ROWS[table] ?? [], params);
    if (objectWanted) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406);
    return json(rows);
  }
  if (req.method === "PATCH") {
    const body = JSON.parse(await req.text());
    /* A cursor race: another import moved the cursor between the read and this write, once. */
    if (state.cursorRace && table === "eng_crm_territories") {
      state.cursorRace = false;
      ROWS.eng_crm_territories[0].rr_cursor += 1;
    }
    const matched = filterRows(ROWS[table] ?? [], params);
    for (const r of matched) Object.assign(r, body);
    state.patches.push({ table, body, params: Object.fromEntries(params), matched: matched.length });
    return json(matched.map((r) => ({ id: r.id })));
  }
  return json([]);
};

const territories = await import("../../src/lib/crm-territories.ts");
const { supabaseAdmin } = await import("../../src/lib/supabase.ts");
const db = supabaseAdmin();

const first = await territories.roundRobinOwners(db, [
  { id: "n1", county: "Bexar" },
  { id: "n2", county: "Bexar" },
  { id: "n3", county: "Bexar" },
  { id: "n4", county: "Travis" },
]);
const owners = first.ok ? [...first.owners.values()] : [];
check("E: an import's companies take their owners in turn", first.ok && first.owners.get("n1") === ME && first.owners.get("n2") === REP2 && first.owners.get("n3") === ME, first.ok ? JSON.stringify([...first.owners]) : first.error);
check("E: a suspended holder is skipped, never handed a company", !owners.includes(SUSPENDED));
check("E: a company in no territory stays unassigned", first.ok && first.owners.get("n4") === null);
const cursorWrite = state.patches.find((p) => p.table === "eng_crm_territories");
check("E: the cursor is advanced conditionally on the value read", cursorWrite?.body.rr_cursor === 3 && cursorWrite.params.rr_cursor === "eq.0", JSON.stringify(cursorWrite));
state.patches = [];
state.cursorRace = true;
const raced = await territories.roundRobinOwners(db, [{ id: "n5", county: "Bexar" }]);
check("E: when another import moved the cursor first, it reads again and takes the next turn", raced.ok && state.patches.filter((p) => p.table === "eng_crm_territories").length === 2 && ROWS.eng_crm_territories[0].rr_cursor === 5, raced.ok ? `cursor ${ROWS.eng_crm_territories[0].rr_cursor}` : raced.error);
state.fail = new Set(["eng_profiles"]);
const blind = await territories.roundRobinOwners(db, [{ id: "n6", county: "Bexar" }]);
check("E: a holder read that fails assigns nothing, never a guess", !blind.ok && /nothing was assigned/.test(blind.error), blind.ok ? "assigned" : blind.error);
state.fail = new Set();

const REP_ACTOR = { id: ME, role: "rep", status: "active", email: "jordan@audit-probe.invalid", grants: new Set(["crm.use", "contact_log.write"]) };
const pipeline = await import("../../src/lib/crm-pipeline.ts");
const repAssign = rules.bulkTargets(REP, "assign", ["p-south"], new Map([["p-south", { ownerId: null, county: "Bexar" }]]));
check("F: bulk reassign is refused to a rep in the rules", !repAssign.ok && /sales manager/.test(repAssign.error));
/* The library refuses at its own crm.assign guard, before reading a row; bulkTargets behind it says the same sentence, so the read count is what tells the two apart. */
state.reads = 0;
const byTerritory = await pipeline.bulkAssignByTerritory(REP_ACTOR, { ids: ["p-south"] });
check("F: and in the library, assigning by territory too, before a row is read", !byTerritory.ok && /sales manager/.test(byTerritory.error) && state.reads === 0, byTerritory.ok ? "assigned" : `${byTerritory.error} (reads ${state.reads})`);
state.reads = 0;
const byPerson = await pipeline.bulkAssign(REP_ACTOR, { ids: ["p-south"], ownerId: ME });
check("F: and assigning to a person, before a row is read", !byPerson.ok && /sales manager/.test(byPerson.error) && state.reads === 0, byPerson.ok ? "assigned" : `${byPerson.error} (reads ${state.reads})`);
const route = readSource("src/app/api/portal/crm/route.ts");
check("F: and in the route", /action === "bulk_assign_by_territory"\) \{\s*if \(!can\(actor, "crm\.assign"\)\)/.test(route) && /action === "bulk_assign"\) \{\s*if \(!can\(actor, "crm\.assign"\)\)/.test(route));

const prospects = await import("../../src/lib/ops-prospects.ts");
const seenSouth = await prospects.prospectById(REP_ACTOR, "p-south");
const seenHill = await prospects.prospectById(REP_ACTOR, "p-hill");
const seenOther = await prospects.prospectById(REP_ACTOR, "p-other");
const seenMine = await prospects.prospectById(REP_ACTOR, "p-mine");
check("G: the old prospect page opens an unassigned company in the rep's territory", seenSouth.ok && seenSouth.row?.id === "p-south", JSON.stringify(seenSouth).slice(0, 120));
check("G: and the rep's own anywhere", seenMine.ok && seenMine.row?.id === "p-mine");
check("G: but reads an unassigned company in another territory as not found", seenHill.ok && seenHill.row === null, JSON.stringify(seenHill).slice(0, 120));
check("G: and another rep's as not found", seenOther.ok && seenOther.row === null);
const list = await prospects.listProspects(REP_ACTOR, { status: "all" });
check("G: the old sales list shows the rep their own and their territory's unassigned only", list.ok && list.rows.map((r) => r.id).sort().join() === "p-mine,p-south", list.ok ? list.rows.map((r) => r.id).join() : list.error);
const giveAway = await prospects.updateProspect(REP_ACTOR, "p-south", { ownerId: REP2 });
check("G: a rep cannot give a company to somebody else", !giveAway.ok && /Only a sales manager/.test(giveAway.error), giveAway.ok ? "given" : giveAway.error);

/* ---------------------------------------------------------------------- H */
const imports = readSource("src/lib/crm-imports.ts");
const write = imports.slice(imports.indexOf("export async function writeRun("), imports.indexOf("/* ---------------------------------------------------- settling what waits */"));
const rr = write.indexOf("await roundRobinOwners(db,");
check("H: Write takes the round robin before it audits or writes anything", rr > 0 && rr < write.indexOf("writeAuditOrRefuse") && rr < write.indexOf('from("eng_prospects").insert'));
check("H: and writes each new company with the owner it was given", /owner_id: territoryOwners\.owners\.get\(id\) \?\? null/.test(write));
const heldBody = imports.slice(imports.indexOf("export async function resolveHeld("), imports.indexOf("export async function resolveConflict("));
check("H: a held record brought onto the list takes the round robin too", /await roundRobinOwners\(db, \[\{ id: prospectId, county: record\.county \?\? null \}\]\)/.test(heldBody));
const ops = readSource("src/lib/ops-prospects.ts");
check("H: a rep may take an unowned company for themselves, but giving one away is crm.assign", /const takingForSelf = next === actor\.id && current\.row\.ownerId === null;/.test(ops) && /if \(next !== current\.row\.ownerId && !takingForSelf && !can\(actor, "crm\.assign"\)\)/.test(ops));
const terrRoute = readSource("src/app/api/portal/crm/territories/route.ts");
const terrPage = readSource("src/app/portal/(app)/crm/territories/page.tsx");
check("H: the territories screen and its route ask crm.assign", /if \(!can\(actor, "crm\.assign"\)\) return bad\(/.test(terrRoute) && /if \(!actor \|\| !can\(actor, "crm\.assign"\)\) notFound\(\)/.test(terrPage));
const lib = readSource("src/lib/crm-territories.ts");
check("H: every territory change is audited first", (lib.match(/await writeAuditOrRefuse\(/g) ?? []).length >= 4);
check("H: a failed read of the viewer's territories refuses, never an empty set", /if \(!held\.ok\) return refuse\(`Your territories could not be read, so no company is shown/.test(lib));
const queueSrc = readSource("src/lib/crm-queue.ts");
const pipeSrc = readSource("src/lib/crm-pipeline.ts");
check("H: the queue, the board, the list and the old prospects screens all ask canSeeCompany with the county", /canSeeCompany\(who\.viewer, \(r\.owner_id as string \| null\) \?\? null, \(r\.county as string \| null\) \?\? null\)/.test(queueSrc) && /canSeeCompany\(viewer, \(r\.owner_id as string \| null\) \?\? null, \(r\.county as string \| null\) \?\? null\)/.test(pipeSrc) && /canSeeCompany\(viewer, \(r\.owner_id as string \| null\) \?\? null, \(r\.county as string \| null\) \?\? null\)/.test(ops));
check("H: the nav offers the territories to crm.assign, matching the page", /href: "\/portal\/crm\/territories", label: "Territories", short: "Territories", action: "crm\.assign"/.test(readSource("src/components/portal/nav.ts")));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note && !x.ok ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: territories decide who sees each company and who gets each new one: a rep their own and their territories' unassigned, a manager all, imports in turn to active holders, reassigning a manager's (${out.length} checks).`
    : `FAIL: ${failed} of ${out.length} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
