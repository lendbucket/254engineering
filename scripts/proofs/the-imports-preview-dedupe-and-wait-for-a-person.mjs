/**
 * PROOF: THE SALES LIST'S IMPORTS PREVIEW, DEDUPE, AND WAIT FOR A PERSON.
 *
 * Robert's sales CRM ruling of 2026-11-02, item R2, migration 0112, with his
 * answers the same afternoon (scheduled runs only preview, a person presses
 * Write; no phone and no email is held; build San Antonio, Austin, TDLR and
 * TREC first; TDLR's two solar files added; Austin on hold until he records
 * its terms). No check here reaches a real portal: every parser reads a
 * recorded sample under scripts/fixtures/crm (manifest.json says when and from
 * where).
 *
 *   A  each ready source's parser on its sample: rows counted, the filter
 *      applied, fields mapped, counts agreeing with an independent count
 *   B  the dedupe: a source record seen before, the same name and phone, the
 *      same phone, the same name, and a second line of the same run, each
 *      decided as R2 says; a company the record could not be is not merged
 *   C  a source runs only when ready, its terms read on a recorded date and
 *      allowing storage; Austin and every waiting city refuse; the schedule
 *      queues only the runnable ones; the job refuses an undeclared source
 *   D  Write refuses a stale preview: the re-plan is compared before anything
 *      is written
 *   E  no phone and no email is held, never added; a run stores at most
 *      HELD_KEEP held rows and counts every one
 *   F  0112 on a replay: counts whole, who asked, written and failure stated,
 *      a conflict names two companies, a source row names its run
 *   G  one vocabulary: the sources and verdicts in code are the ones 0112 holds
 *   H  a bought list goes through the same reading and the same dedupe
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-imports-preview-dedupe-and-wait-for-a-person.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

const parse = await import("../../src/lib/crm-import-parse.ts");
const plan = await import("../../src/lib/crm-import-plan.ts");
const rules = await import("../../src/lib/crm-rules.ts");
const config = await import("../../src/config/crm-sources.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });
const FX = "scripts/fixtures/crm";
const fx = (f) => readFileSync(join(FX, f), "utf8");

/* ------------------------------------------------- A, the parsers on samples */

/* San Antonio. The independent count reads the first column only, which the sample never quotes. */
{
  const text = fx("san-antonio-permits.csv");
  const lines = text.split("\n").filter((l) => l.trim());
  const KEPT = ["Re-Roof Permit", "Solar - Photovoltaic Permit", "Foundation Repair Permit", "Comm Foundation Permit"];
  const expectedPermits = lines.slice(1).filter((l) => KEPT.includes(l.split(",")[0])).length;
  const r = parse.parseSanAntonioPermits(text);
  check("San Antonio: every data row is counted as read", r.rowsRead === lines.length - 1, `${r.rowsRead} of ${lines.length - 1}`);
  const permits = r.records.reduce((n, x) => n + x.permitCount, 0) + r.skipped.length;
  check("San Antonio: every kept permit is in a contractor's count or skipped with a reason, and no other permit is", permits === expectedPermits && expectedPermits > 50, `${permits} against ${expectedPermits}`);
  check("San Antonio: grouped by contractor, so fewer companies than permits", r.records.length > 0 && r.records.length < expectedPermits, `${r.records.length} companies`);
  check("San Antonio: every company is a roofer, solar or foundation repair", r.records.every((x) => ["roofer", "solar", "foundation_repair"].includes(x.vertical)));
  check("San Antonio: every record is keyed by its contractor's normalized name", r.records.every((x) => x.sourceRecordId === `contractor:${rules.normalizeName(x.company)}`));
  check("San Antonio: no telephone and no job-site address is stored as the company's", r.records.every((x) => x.phone === null && x.addressLine === null));
  check("San Antonio: the latest permit date is a date", r.records.every((x) => x.lastPermitOn === null || /^\d{4}-\d{2}-\d{2}$/.test(x.lastPermitOn)));
}

/* Austin, parsed even though it is on hold, so it runs the day Robert records its terms. */
{
  const rows = JSON.parse(fx("austin-permits.json"));
  const r = parse.parseAustinPermits(rows);
  const remodels = rows.filter((x) => x.work_class === "Remodel").length;
  check("Austin: every Socrata row is counted as read", r.rowsRead === rows.length, `${r.rowsRead}`);
  const counted = r.records.reduce((n, x) => n + x.permitCount, 0) + r.skipped.length;
  const kept = rows.filter((x) => {
    const d = String(x.description ?? "").toUpperCase();
    return x.work_class === "Roof" || (x.work_class === "Auxiliary Power" && (d.includes("SOLAR") || /\bPV\b/.test(d))) || (x.work_class === "Repair" && d.includes("FOUNDATION"));
  }).length;
  check("Austin: the remodels and every other class are dropped by the filter", counted === kept && remodels > 0 && kept < rows.length, `${counted} of ${kept} kept, ${remodels} remodels dropped`);
  check("Austin: a contractor's own telephone is carried", r.records.some((x) => rules.normalizePhone(x.phone)));
}

/* TDLR electrical: the independent count of licenses past their date. */
{
  const text = fx("tdlr-electrical-contractors.csv");
  const today = "2026-11-02";
  const r = parse.parseTdlrElectrical(text, today);
  const rows = [...parse.csvObjects(text)].map((x) => x.row);
  const expired = rows.filter((x) => (parse.isoDate(x["LICENSE EXPIRATION DATE"]) ?? "9999") < today).length;
  check("TDLR electrical: every row counted, expired licenses dropped, the rest one company per license", r.rowsRead === 200 && r.records.length + r.skipped.length === 200 - expired, `${r.records.length} kept, ${expired} expired, ${r.skipped.length} skipped`);
  check("TDLR electrical: keyed by license number and tagged an electrical contractor", r.records.every((x) => x.sourceRecordId.startsWith("license:") && x.tags.includes("electrical_contractor")));
  check("TDLR electrical: business telephones are carried", r.records.filter((x) => rules.normalizePhone(x.phone)).length > r.records.length / 2);
}

/* TDLR's two solar files, Robert's answer to 6588393366. */
{
  const ret = parse.parseTdlrSolarRetailers(fx("tdlr-solar-retailers.csv"));
  const current = [...parse.csvObjects(fx("tdlr-solar-retailers.csv"))].filter((x) => x.row["License Status"] === "Current").length;
  check("TDLR solar retailers: only Current registrations, each a solar company with a phone", ret.records.length + ret.skipped.length === current && ret.records.every((x) => x.vertical === "solar") && ret.records.some((x) => rules.normalizePhone(x.phone)), `${ret.records.length} of ${ret.rowsRead}`);
  const sp = parse.parseTdlrSolarSalespeople(fx("tdlr-solar-salespeople.csv"));
  check("TDLR solar salespeople: the name read as a person, with no phone", sp.records.length > 0 && sp.records.every((x) => x.phone === null && !x.company.includes(",")), sp.records[0]?.company ?? "none");
}

/* TREC. */
{
  const rows = JSON.parse(fx("trec-license-holders.json"));
  const r = parse.parseTrec(rows);
  const kept = rows.filter((x) => x.status === "Active" && ["Broker Company", "Broker Individual", "Sales Agent"].includes(x.license_type)).length;
  check("TREC: only active brokers and agents, each a real estate record with no phone or email", r.records.length + r.skipped.length === kept && kept > 0 && kept < rows.length && r.records.every((x) => x.vertical === "real_estate" && x.phone === null && x.email === null), `${r.records.length} of ${rows.length}`);
}

/* ---------------------------------------------------------------- B, dedupe */
const rec = (line, company, extra = {}) => ({
  line, sourceRecordId: `t:${line}`, company, contactName: null, phone: null, email: null, addressLine: null, city: null,
  postalCode: null, county: null, vertical: "roofer", tags: [], website: null, permitCount: null, lastPermitOn: null, raw: {}, ...extra,
});
const index = plan.buildIndex(
  [
    { id: "p-acme", nameKey: rules.normalizeName("Acme Roofing, LLC"), phoneKey: "2105550100", county: "Bexar", addressLine: "1 Main Street" },
    { id: "p-shared-1", nameKey: "lone star solar", phoneKey: "3615550199", county: "Nueces", addressLine: null },
    { id: "p-shared-2", nameKey: "gulf solar", phoneKey: null, county: "Nueces", addressLine: null },
    { id: "p-twin-a", nameKey: "hill country roofing", phoneKey: null, county: null, addressLine: null },
    { id: "p-twin-b", nameKey: "hill country roofing", phoneKey: null, county: null, addressLine: null },
    { id: "p-travis", nameKey: "capital foundation", phoneKey: null, county: "Travis", addressLine: null },
  ],
  [{ source: "tdlr_electrical", sourceRecordId: "license:42", prospectId: "p-acme" }],
  [{ prospectId: "p-shared-2", phoneKey: "3615550199" }],
);
const B = plan.planRecords(
  "tdlr_electrical",
  [
    rec(2, "Anything", { sourceRecordId: "license:42", phone: "(999) 555-0000" }),
    rec(3, "ACME ROOFING", { phone: "+1 210 555 0100" }),
    rec(4, "Somebody Else Solar", { phone: "361-555-0199" }),
    rec(5, "Hill Country Roofing Inc", {}),
    rec(6, "Capital Foundation", { county: "Bexar", phone: "512 555 0123" }),
    rec(7, "Brand New Co", { phone: "830 555 0111" }),
    rec(8, "Brand New Co.", { phone: "(830) 555-0111" }),
    rec(9, "Nobody Reachable", {}),
    rec(10, "Mail Only", { email: "office@example.com" }),
  ],
  [{ line: 11, sourceRecordId: "t:11", reason: "The license names no business.", raw: {} }],
  index,
);
const at = (line) => B.find((r) => r.line === line);
check("a record this source gave before is refreshed on the same company", at(2).verdict === "merge" && at(2).prospectId === "p-acme");
check("the same name and telephone, spelled differently, merges", at(3).verdict === "merge" && at(3).prospectId === "p-acme");
check("a telephone two companies carry (one by a person) is a conflict naming both", at(4).verdict === "conflict" && at(4).candidateIds.join(",") === "p-shared-1,p-shared-2", at(4).candidateIds.join(","));
check("a name two companies share is a conflict naming both", at(5).verdict === "conflict" && at(5).candidateIds.length === 2);
check("a name whose only company is in another county is not merged, it is added", at(6).verdict === "add" && at(6).prospectId === null, `${at(6).verdict}`);
check("a new company with a telephone is added", at(7).verdict === "add");
check("the same new company twice in one run merges into its first line", at(8).verdict === "merge" && at(8).mergeLine === 7 && at(8).prospectId === null);
check("an email without a telephone is enough to add", at(10).verdict === "add");
check("a record with neither is held, with the sentence that says why", at(9).verdict === "held" && at(9).reason === plan.HELD_REASON);
check("a skip keeps its reason", at(11).verdict === "skip" && /no business/.test(at(11).reason));
const t = plan.tally(B);
check("the tally counts every row once", t.adds + t.merges + t.conflicts + t.held + t.skipped === B.length && t.adds === 3 && t.merges === 3 && t.conflicts === 2 && t.held === 1 && t.skipped === 1, JSON.stringify(t));

/* ------------------------------------------------- C, who may run, and when */
for (const d of config.CRM_SOURCE_DECLS) {
  const refusal = config.sourceRefusal(d);
  const shouldRun = d.state === "ready" && Boolean(d.termsReadOn) && d.allowed === true && Boolean(d.fetchUrl) && Boolean(d.format);
  check(`${d.label}: ${shouldRun ? "runs" : "refuses"} by its declaration`, shouldRun === (refusal === null), refusal ?? "runs");
}
check("Austin refuses until its terms are recorded", /on hold/.test(config.sourceRefusal(config.sourceDecl("permits_austin")) ?? ""));
for (const k of ["permits_houston", "permits_dallas", "permits_fort_worth", "permits_corpus_christi", "tdhca_mh"]) {
  check(`${k} refuses`, config.sourceRefusal(config.sourceDecl(k)) !== null);
}
const unread = { ...config.sourceDecl("tdlr_electrical"), termsReadOn: null };
check("a ready source with no terms date refuses", /no recorded read date/.test(config.sourceRefusal(unread) ?? ""));
const forbidden = { ...config.sourceDecl("tdlr_electrical"), allowed: false };
check("a ready source whose terms forbid storage refuses", /allowing storage/.test(config.sourceRefusal(forbidden) ?? ""));
check("an undeclared source refuses", config.sourceRefusal(config.sourceDecl("not-a-source")) !== null);
const scheduled = config.scheduledSources().map((d) => d.key).sort().join(",");
check("the schedule queues exactly the runnable sources", scheduled === "permits_san_antonio,tdlr_electrical,tdlr_solar_retailers,tdlr_solar_salespeople,trec", scheduled);
const handlers = readSource("src/lib/job-handlers.ts");
const job = handlers.slice(handlers.indexOf('registerJob("crm.import_preview"'), handlers.indexOf("// ------------------------------------------------------------- errors.alert"));
check("the scheduled job refuses an undeclared or waiting source as fatal before it reads anything", /sourceRefusal\(sourceDecl\(source\)\)/.test(job) && job.indexOf("sourceRefusal") < job.indexOf("runPreview(") && /kind: "fatal", error: refusal/.test(job));
check("and the scheduled job only previews", /trigger: "schedule"/.test(job) && !/writeRun/.test(job));
const daily = readSource("src/app/api/cron/daily/route.ts");
check("the daily cron queues from scheduledSources, one job per source and day", /for \(const decl of scheduledSources\(\)\)/.test(daily) && /enqueue\("crm\.import_preview", \{ source: decl\.key, day: firmDay \}\)/.test(daily));

/* ------------------------------------------------------- D, a stale preview */
{
  const records = [rec(2, "Fresh Roofing", { phone: "210 555 0177" }), rec(3, "Other Roofing", { phone: "210 555 0178" })];
  const empty = plan.buildIndex([], [], []);
  const first = plan.planRecords("csv", records, [], empty);
  check("an unchanged list re-plans to the same verdicts", plan.staleLines(first, plan.planRecords("csv", records, [], empty)).length === 0);
  const moved = plan.buildIndex([{ id: "p-new", nameKey: "fresh roofing", phoneKey: "2105550177", county: null, addressLine: null }], [], []);
  const stale = plan.staleLines(first, plan.planRecords("csv", records, [], moved));
  check("a company added since the preview makes its line stale", stale.length === 1 && stale[0] === 2, stale.join(","));
  const imports = readSource("src/lib/crm-imports.ts");
  const write = imports.slice(imports.indexOf("export async function writeRun("), imports.indexOf("/* ---------------------------------------------------- settling what waits */"));
  const staleAt = write.indexOf("staleLines(asPlanned, replanned)");
  check("Write re-plans and refuses on any stale line before it audits or writes anything", staleAt > 0 && /if \(moved\.length\)/.test(write) && staleAt < write.indexOf("writeAuditOrRefuse") && staleAt < write.indexOf('from("eng_prospects").insert'));
  check("and Write takes only a previewed run, once", /run\.status === "written"/.test(write) && /run\.status !== "previewed"/.test(write) && /\.eq\("status", "previewed"\)/.test(write));
  check("Write is crm.import's", /can\(actor, "crm\.import"\)/.test(write));
  check("a merge keeps every source: it adds the source row to the company or refreshes its own, never moves another's", /insert\(\{ prospect_id: target, source, source_record_id/.test(write) && /seenOn === target/.test(write));
}

/* -------------------------------------------------------- E, held and stored */
{
  const many = Array.from({ length: plan.HELD_KEEP + 37 }, (_, i) => rec(i + 2, `Agent ${i}`));
  const planned = plan.planRecords("trec", many, [], plan.buildIndex([], [], []));
  const stored = plan.rowsToStore(planned);
  check("every record with no phone and no email is held, never added", planned.every((r) => r.verdict === "held"));
  check("a run stores at most HELD_KEEP held rows and counts every one", stored.length === plan.HELD_KEEP && plan.tally(planned).held === plan.HELD_KEEP + 37, `${stored.length} stored of ${plan.tally(planned).held}`);
  const trec = parse.parseTrec(JSON.parse(fx("trec-license-holders.json")));
  const tp = plan.planRecords("trec", trec.records, trec.skipped, plan.buildIndex([], [], []));
  check("TREC's sample is held whole on an empty list", tp.filter((r) => r.verdict === "held").length === trec.records.length);
}

/* --------------------------------------------------------- F, 0112 on a replay */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at12 = files.findIndex((f) => f.startsWith("0112_"));
check("0112 is in the chain", at12 >= 0, at12 >= 0 ? files[at12] : "missing");
for (const f of files.slice(0, at12 + 1)) await db.exec(readSource(join(DIR, f)));

async function refused(sql) {
  try {
    await db.query(sql);
    return { refused: false, message: "" };
  } catch (e) {
    return { refused: true, message: e.message };
  }
}
const ADMIN = "00000000-0000-4000-8000-0000000002a1";
await db.exec(`insert into auth.users (id) values ('${ADMIN}');
  insert into eng_profiles (id, email, display_name, role, status) values ('${ADMIN}', 'crm-r2@audit-probe.invalid', 'CRM R2 proof administrator, not a real person', 'admin', 'active');`);
const okRun = await db.query(`insert into eng_crm_import_runs (source, trigger, status, finished_at, terms_read_on, records, adds, held, held_kept)
  values ('tdlr_electrical', 'schedule', 'previewed', now(), '2026-11-02', 3, 2, 1, 1) returning id`);
const RUN = okRun.rows[0].id;
check("a scheduled preview with whole counts is accepted", Boolean(RUN));
const notWhole = await refused(`insert into eng_crm_import_runs (source, trigger, status, finished_at, terms_read_on, records, adds) values ('trec', 'schedule', 'previewed', now(), '2026-11-02', 5, 2)`);
check("a run whose counts do not add up is refused", notWhole.refused && /counts_whole/.test(notWhole.message), notWhole.message);
const schedWithPerson = await refused(`insert into eng_crm_import_runs (source, trigger, requested_by) values ('trec', 'schedule', '${ADMIN}')`);
check("a scheduled run that names a person is refused", schedWithPerson.refused && /who_asked/.test(schedWithPerson.message));
const personWithout = await refused(`insert into eng_crm_import_runs (source, trigger) values ('trec', 'person')`);
check("a person's run that names nobody is refused", personWithout.refused && /who_asked/.test(personWithout.message));
const writtenHalf = await refused(`update eng_crm_import_runs set status = 'written' where id = '${RUN}'`);
check("a run marked written without who and when is refused", writtenHalf.refused && /written_is_whole/.test(writtenHalf.message));
const failedSilent = await refused(`insert into eng_crm_import_runs (source, trigger, status, finished_at) values ('trec', 'schedule', 'failed', now())`);
check("a failed run that says nothing is refused", failedSilent.refused && /failure_says_why/.test(failedSilent.message));
const noTerms = await refused(`insert into eng_crm_import_runs (source, trigger, status, finished_at) values ('trec', 'schedule', 'previewed', now())`);
check("a public source's finished preview with no terms date is refused", noTerms.refused && /terms_recorded/.test(noTerms.message));
const unknownSource = await refused(`insert into eng_crm_import_runs (source, trigger) values ('google_places', 'schedule')`);
check("a source the list does not declare is refused, Google Places among them", unknownSource.refused && /source_known/.test(unknownSource.message));
const oneCandidate = await refused(`insert into eng_crm_import_rows (run_id, line, source_record_id, verdict, reason, candidate_ids, payload)
  values ('${RUN}', 2, 'license:1', 'conflict', 'two names', array['00000000-0000-4000-8000-000000000001']::uuid[], '{}')`);
check("a conflict naming fewer than two companies is refused", oneCandidate.refused && /conflict_has_candidates/.test(oneCandidate.message));
const heldSilent = await refused(`insert into eng_crm_import_rows (run_id, line, source_record_id, verdict, payload) values ('${RUN}', 3, 'license:2', 'held', '{}')`);
check("a held row that says nothing is refused", heldSilent.refused && /says_why/.test(heldSilent.message));
const addResolved = await refused(`insert into eng_crm_import_rows (run_id, line, source_record_id, verdict, payload, resolution, resolved_at, resolved_by) values ('${RUN}', 4, 'license:3', 'add', '{}', 'added', now(), '${ADMIN}')`);
check("only a held row or a conflict is settled by a person", addResolved.refused && /resolution_is_whole/.test(addResolved.message));
const P = (await db.query(`insert into eng_prospects (company, phone, prospect_type, created_by) values ('Replay Roofing', '210 555 0190', 'roofer', '${ADMIN}') returning id`)).rows[0].id;
await db.query(`insert into eng_prospect_sources (prospect_id, source, source_record_id) values ('${P}', 'manual', 'm:1')`);
await db.query(`insert into eng_prospect_sources (prospect_id, source, source_record_id, import_run_id) values ('${P}', 'tdlr_electrical', 'license:9', '${RUN}')`);
const two = await db.query(`select count(*)::int as n from eng_prospect_sources where prospect_id = '${P}'`);
check("a company keeps every source it was merged from", two.rows[0].n === 2);
const orphan = await refused(`insert into eng_prospect_sources (prospect_id, source, source_record_id, import_run_id) values ('${P}', 'trec', 'license:10', '00000000-0000-4000-8000-00000000dead')`);
check("a source row names only a run that exists", orphan.refused && /import_run_fkey/.test(orphan.message));
const rls = await db.query(`select count(*)::int as n from pg_class where relname in ('eng_crm_import_runs', 'eng_crm_import_rows') and relrowsecurity`);
check("both import tables have row level security on", rls.rows[0].n === 2);

/* ------------------------------------------------------- G, one vocabulary */
const sql = readSource(join(DIR, files[at12]));
const listIn = (constraint) => {
  const i = sql.indexOf(constraint);
  const block = sql.slice(i, sql.indexOf(")", sql.indexOf("in (", i)) + 1);
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort().join(",");
};
check("0112's source list is CRM_SOURCES", listIn("eng_crm_import_runs_source_known") === [...rules.CRM_SOURCES].sort().join(","), listIn("eng_crm_import_runs_source_known"));
check("0112's verdicts are the planner's", listIn("eng_crm_import_rows_verdict_known") === "add,conflict,held,merge,skip");
check("every declared source is one the list knows", config.CRM_SOURCE_DECLS.every((d) => rules.CRM_SOURCES.includes(d.key)));
check("TDLR's two solar files are declared, vertical solar, under TDLR's terms", ["tdlr_solar_retailers", "tdlr_solar_salespeople"].every((k) => {
  const d = config.sourceDecl(k);
  return d && d.vertical === "solar" && d.termsUrl === "https://www.tdlr.texas.gov/disclaimer.htm" && /TDLR|Texas Department of Licensing/.test(d.attribution ?? "");
}));

/* ------------------------------------------------------ H, a bought list */
{
  const list = [
    "Company,Contact,Phone,Email,County,Vertical",
    "Alamo Solar LLC,Pat Doe,(210) 555-0101,,Bexar,solar",
    ",Nobody,(210) 555-0102,,,roofer",
    "Bad Mail Co,,,not-an-email,,lender",
    "Quiet Brokers,,,,Travis,real estate",
    "Mystery Trade,,(210) 555-0103,,,underwater welding",
  ].join("\n");
  const r = parse.parseBoughtList(list, null);
  check("a bought list reads every row", r.error === null && r.rowsRead === 5);
  check("a row with no company, a bad email or an unknown vertical is skipped with its reason", r.skipped.length === 3 && r.skipped.every((s) => s.reason));
  check("a row with no phone and no email becomes a record the planner holds", r.records.some((x) => x.company === "Quiet Brokers" && x.vertical === "real_estate"));
  const p = plan.planRecords("csv", r.records, r.skipped, plan.buildIndex([], [], []));
  check("and it is held, not added", p.find((x) => x.payload.company === "Quiet Brokers")?.verdict === "held");
  const again = parse.parseBoughtList(list, null).records[0].sourceRecordId === r.records[0].sourceRecordId;
  check("the same company in a second list carries the same record id, so it finds the first", again && r.records[0].sourceRecordId.startsWith("row:"));
  check("a list with no company column is refused with a sentence", /No company column/.test(parse.parseBoughtList("Name,Phone\nX,1", "roofer").error ?? ""));
}

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: the imports read every ready source from its sample, dedupe by name, phone and address, keep every source on a merge, hold what nobody can call, refuse what may not run, and write only a preview a person read (${out.length} checks).`
    : `FAIL: ${failed} of ${out.length} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
