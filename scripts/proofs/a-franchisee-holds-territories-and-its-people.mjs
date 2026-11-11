/**
 * A FRANCHISEE HOLDS TERRITORIES AND ITS PEOPLE (0125). Robert's overnight
 * orders of 2026-11-10, platform item X1: "a franchise record owning one or
 * more territories, its own technicians and sales reps, its own office NAP",
 * staff and admin only.
 *
 *   A  the rules, pure: a legal name, an office kept whole or not at all, a
 *      phone held as E.164, a status that ends only with a reason and is never
 *      reopened, and only technicians and reps as its people.
 *   B  the grant, pinned as literals: franchise.manage is admin's and nobody
 *      else's, in DEFAULT_ROLES and in the seed.
 *   C  the code: every write asks franchise.manage and is audited before it
 *      touches a row; holdings and memberships are ended, never deleted; the
 *      page and the route ask the same grant; nothing public reaches it.
 *   D  the tables, replayed: row level security on all three, one live holder
 *      per territory, one live franchisee per person, an address whole or not
 *      at all, a phone in E.164, and an end that says why.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/franchisee-rules.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ---------------------------------------------------------------- A, the rules */

check("A: a legal name of one character is refused", rules.legalNameProblem("X") !== null);
check("A: a legal name of 121 characters is refused", rules.legalNameProblem("x".repeat(121)) !== null);
check("A: a real legal name is taken", rules.legalNameProblem("Harris Field Services LLC") === null);
check("A: a phone typed with punctuation is held as E.164", rules.e164("(713) 555-0100") === "+17135550100");
check("A: a leading 1 is kept once", rules.e164("1 713 555 0100") === "+17135550100");
check("A: a short phone is refused", rules.e164("555-0100") === null);
const blank = rules.officeFrom({ street: "", city: "", postalCode: "", phone: "" });
check("A: an office with nothing in it clears the address", blank.ok && blank.office.street === null && blank.office.phone === null);
check("A: a street with no city is refused", !rules.officeFrom({ street: "100 Main St", city: "", postalCode: "77002", phone: "" }).ok);
check("A: a four digit postal code is refused", !rules.officeFrom({ street: "100 Main St", city: "Houston", postalCode: "7700", phone: "" }).ok);
check("A: a bad phone is refused even with a whole address", !rules.officeFrom({ street: "100 Main St", city: "Houston", postalCode: "77002", phone: "12" }).ok);
const whole = rules.officeFrom({ street: " 100 Main St ", city: "Houston", postalCode: "77002", phone: "713.555.0100" });
check("A: a whole office is taken, trimmed, with its phone in E.164", whole.ok && whole.office.street === "100 Main St" && whole.office.phone === "+17135550100");
check("A: ending with no reason is refused", !rules.statusChange("operating", "ended", "").ok);
const end = rules.statusChange("operating", "ended", "Agreement terminated by notice");
check("A: ending with a reason is taken and keeps the reason", end.ok && end.to === "ended" && end.reason === "Agreement terminated by notice");
check("A: an ended franchisee is never reopened", !rules.statusChange("ended", "operating", null).ok);
const go = rules.statusChange("onboarding", "operating", "ignored");
check("A: a live status carries no reason", go.ok && go.reason === null);
check("A: an unknown status is refused", !rules.statusChange("onboarding", "open", null).ok);
check("A: the same status again is refused", !rules.statusChange("operating", "operating", null).ok);
check("A: a technician and a rep may be its people", rules.mayBeMember("field_tech") && rules.mayBeMember("rep"));
check("A: an administrator, an engineer and a customer may not", !rules.mayBeMember("admin") && !rules.mayBeMember("engineer") && !rules.mayBeMember("customer"));

/* ---------------------------------------------------------------- B, the grant */

const holders = DEFAULT_ROLES.filter((r) => (r.grants ?? []).includes("franchise.manage")).map((r) => r.key).sort();
check("B: franchise.manage is admin's and nobody else's", holders.join() === "admin", holders.join() || "nobody");
const seed = readSource("supabase/migrations/0125_a_franchisee_holds_territories_and_its_people.sql");
check("B: 0125 seeds exactly that grant", /insert into eng_role_grants \(role_key, action\) values\s+\('admin', 'franchise\.manage'\)\s+on conflict/.test(seed));

/* ---------------------------------------------------------------- C, the code */

const lib = readSource("src/lib/franchisees.ts");
const fnBody = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`);
  const next = src.indexOf("\nexport ", at + 1);
  return at === -1 ? "" : src.slice(at, next === -1 ? undefined : next);
};
const writes = ["createFranchisee", "saveOffice", "setFranchiseeStatus", "setFranchiseeTerritory", "setFranchiseeMember"];
for (const name of writes) {
  const body = fnBody(lib, name);
  const asks = body.indexOf("keeper(actor)");
  const audits = body.indexOf("writeAuditOrRefuse(");
  const touches = Math.min(...[".insert(", ".update("].map((s) => body.indexOf(s)).filter((i) => i !== -1));
  check(`C: ${name} asks the grant, then audits, then writes`, asks !== -1 && audits > asks && Number.isFinite(touches) && touches > audits, `${asks} < ${audits} < ${touches}`);
}
for (const name of ["listFranchisees", "franchiseeDetail"]) check(`C: ${name} asks the grant first`, fnBody(lib, name).includes("if (!keeper(actor)) return refuse(NOT_ALLOWED);"));
check("C: the keeper is franchise.manage", /function keeper\(actor: Actor \| null\): Actor \| null \{\s+return actor && can\(actor, "franchise\.manage"\) \? actor : null;/.test(lib));
check("C: nothing is ever deleted from the three tables", !/\.delete\(/.test(lib));
check("C: a holding is ended, not removed", /from\("eng_franchisee_territories"\)\s+\.update\(\{ ended_at: DB_NOW, ended_by: a\.id \}\)/.test(lib));
check("C: a membership is ended, not removed", /from\("eng_franchisee_members"\)\s+\.update\(\{ ended_at: DB_NOW, ended_by: a\.id \}\)/.test(lib));
check("C: a status change only lands on the status it read", /\.eq\("status", String\(row\.status\)\)/.test(fnBody(lib, "setFranchiseeStatus")));
const route = readSource("src/app/api/portal/franchisees/route.ts");
const postAt = route.indexOf("async function handlePOST(");
check("C: the route's POST asks for a person, then franchise.manage", route.indexOf("currentActor()", postAt) > postAt && route.indexOf('can(actor, "franchise.manage")', postAt) > route.indexOf("currentActor()", postAt));
check("C: the route's CSV writes its audit row before the file", route.indexOf("auditExportOrRefuse(") !== -1 && route.indexOf("auditExportOrRefuse(") < route.indexOf("csv({"));
const page = readSource("src/app/portal/(app)/franchisees/page.tsx");
check("C: the page is not found without franchise.manage", /if \(!can\(actor, "franchise\.manage"\)\) notFound\(\);/.test(page));
const proxy = readSource("src/proxy.ts");
check("C: the perimeter opens nothing of it", !proxy.includes("/api/portal/franchisees") && !proxy.includes("/portal/franchisees"));
const nav = readSource("src/components/portal/nav.ts");
check("C: the navigation offers it on franchise.manage only", /href: "\/portal\/franchisees",[\s\S]{0,120}action: "franchise\.manage"/.test(nav));
const publicPages = readdirSync("src/app/(site)", { recursive: true }).filter((f) => /franchis/i.test(String(f)));
check("C: no public page carries the word franchise in its path", publicPages.length === 0, publicPages.join(", ") || "none");

/* ---------------------------------------------------------------- D, the tables */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));
for (const t of ["eng_franchisees", "eng_franchisee_territories", "eng_franchisee_members"]) {
  const rls = (await db.query(`select relrowsecurity from pg_class where oid = 'public.${t}'::regclass`)).rows[0]?.relrowsecurity;
  check(`D: row level security is on ${t}`, rls === true);
}
const grants = (await db.query(`select role_key from eng_role_grants where action = 'franchise.manage' order by role_key`)).rows.map((r) => r.role_key);
check("D: the replayed grant is admin's alone", grants.join() === "admin", grants.join());

const P1 = "00000000-0000-4000-8000-0000000000c1";
const P2 = "00000000-0000-4000-8000-0000000000c2";
await db.exec(`insert into auth.users (id) values ('${P1}'), ('${P2}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${P1}', 'franchise-proof-1@audit-probe.invalid', 'Franchise proof one, not a real person', 'field_tech', 'active'),
    ('${P2}', 'franchise-proof-2@audit-probe.invalid', 'Franchise proof two, not a real person', 'rep', 'active');`);
const refused = async (sql) => {
  try {
    await db.query(sql);
    return "";
  } catch (e) {
    return String(e?.message ?? e);
  }
};
const one = async (sql) => (await db.query(sql)).rows[0];
check("D: a franchisee by legal name alone is taken, onboarding", (await refused(`insert into eng_franchisees (legal_name) values ('Proof Field One LLC')`)) === "");
const F1 = (await one(`select id, status from eng_franchisees where legal_name = 'Proof Field One LLC'`));
check("D: it starts onboarding", F1?.status === "onboarding", F1?.status);
await db.exec(`insert into eng_franchisees (legal_name) values ('Proof Field Two LLC')`);
const F2 = (await one(`select id from eng_franchisees where legal_name = 'Proof Field Two LLC'`)).id;
check("D: the same legal name twice is refused", (await refused(`insert into eng_franchisees (legal_name) values ('proof field one llc ')`)).includes("eng_franchisees_name_once"));
check("D: a half address is refused", (await refused(`update eng_franchisees set office_street = '100 Main St' where id = '${F1.id}'`)).includes("eng_franchisees_address_whole"));
check("D: a whole address is taken", (await refused(`update eng_franchisees set office_street = '100 Main St', office_city = 'Houston', office_postal_code = '77002' where id = '${F1.id}'`)) === "");
check("D: a phone not in E.164 is refused", (await refused(`update eng_franchisees set office_phone = '713-555-0100' where id = '${F1.id}'`)).includes("eng_franchisees_phone_e164"));
check("D: an unknown status is refused", (await refused(`update eng_franchisees set status = 'open' where id = '${F1.id}'`)).includes("eng_franchisees_status_known"));
check("D: ended with no reason is refused", (await refused(`update eng_franchisees set status = 'ended', ended_at = now() where id = '${F2}'`)).includes("eng_franchisees_end_says_why"));
check("D: a reason on a live franchisee is refused", (await refused(`update eng_franchisees set ended_at = now(), ended_reason = 'not ended' where id = '${F2}'`)).includes("eng_franchisees_end_says_why"));

await db.exec(`insert into eng_crm_territories (name) values ('Proof Harris')`);
const T = (await one(`select id from eng_crm_territories where name = 'Proof Harris'`)).id;
check("D: a franchisee can hold a territory", (await refused(`insert into eng_franchisee_territories (franchisee_id, territory_id) values ('${F1.id}', '${T}')`)) === "");
check("D: a second franchisee cannot hold it at the same time", (await refused(`insert into eng_franchisee_territories (franchisee_id, territory_id) values ('${F2}', '${T}')`)).includes("eng_franchisee_territories_one_holder"));
await db.exec(`update eng_franchisee_territories set ended_at = now() where franchisee_id = '${F1.id}' and territory_id = '${T}'`);
check("D: once the holding is ended, another franchisee may hold it", (await refused(`insert into eng_franchisee_territories (franchisee_id, territory_id) values ('${F2}', '${T}')`)) === "");
check("D: the ended holding is still on record", Number((await one(`select count(*)::int as n from eng_franchisee_territories where territory_id = '${T}'`)).n) === 2);
check("D: an ended_by with no ended_at is refused", (await refused(`update eng_franchisee_territories set ended_by = '${P1}' where franchisee_id = '${F2}' and ended_at is null`)).includes("eng_franchisee_territories_end_whole"));
check("D: a franchisee holding a territory cannot be deleted", (await refused(`delete from eng_franchisees where id = '${F2}'`)) !== "");

check("D: a person can belong to a franchisee", (await refused(`insert into eng_franchisee_members (franchisee_id, profile_id) values ('${F1.id}', '${P1}')`)) === "");
check("D: the same person cannot belong to a second one at the same time", (await refused(`insert into eng_franchisee_members (franchisee_id, profile_id) values ('${F2}', '${P1}')`)).includes("eng_franchisee_members_one_franchisee"));
check("D: another person can", (await refused(`insert into eng_franchisee_members (franchisee_id, profile_id) values ('${F2}', '${P2}')`)) === "");

console.log(wrong === 0 ? "PASS: a franchisee holds territories and its people, and only an administrator keeps the record." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
