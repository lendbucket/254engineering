// @runtime react-server
//
// Declared because it imports src/lib/ops-insurance.ts, which carries server-only.

/**
 * INSURANCE IS A REGISTER THAT WARNS BEFORE IT LAPSES. Robert's addendum of
 * 2026-10-25, item 1; migration 0090.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/insurance-is-a-register-that-warns-before-it-lapses.mjs
 *
 * Three parts:
 *   1. the database: 0090 replayed into PGlite with the whole chain, and its
 *      guards fired: a policy row cannot be deleted or edited, is withdrawn
 *      once with a reason, and a warning is recorded once per threshold;
 *   2. the rules: a figure as the certificate prints it, every field required,
 *      and which warning is due on which day;
 *   3. the library against a fake PostgREST: only insurance.manage records, a
 *      file that is not a PDF is refused, the sweep records each warning before
 *      raising it and raises it once, and off production it warns probes only.
 *
 * And the line it does not cross: the launch gate still reads the code list.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------ 1. database */
const pg = new PGlite();
await pg.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const last = files.findIndex((f) => f.startsWith("0090_"));
check("0090 is in the chain", last >= 0, last >= 0 ? files[last] : "missing");
for (const f of files.slice(0, last + 1)) await pg.exec(readSource(join(DIR, f)));
const refused = async (sql) => {
  try {
    await pg.query(sql);
    return false;
  } catch {
    return true;
  }
};
const OWNER = "00000000-0000-4000-8000-0000000000c1";
const POLICY = "00000000-0000-4000-8000-0000000000c2";
await pg.exec(`
  insert into auth.users (id) values ('${OWNER}');
  insert into eng_profiles (id, email, display_name, role, status)
    values ('${OWNER}', 'insurance-owner@audit-probe.invalid', 'Insurance proof owner, not a real person', 'admin', 'active');
  insert into eng_insurance_policies (id, kind, carrier, policy_number, limit_per_claim_cents, limit_aggregate_cents,
    named_insureds, effective_on, expires_on, certificate_key, certificate_sha256, certificate_bytes, recorded_by)
  values ('${POLICY}', 'professional_liability', 'Proof Carrier', 'PROOF-1', 100000000, 200000000,
    array['A proof insured, not a real firm'], '2026-11-01', '2027-11-01', 'policies/proof.pdf',
    '${"a".repeat(64)}', 1024, '${OWNER}');
`);
check("a policy row cannot be deleted", await refused(`delete from eng_insurance_policies where id = '${POLICY}'`));
check("nor its carrier or limits edited", await refused(`update eng_insurance_policies set carrier = 'Another' where id = '${POLICY}'`) && await refused(`update eng_insurance_policies set limit_per_claim_cents = 1 where id = '${POLICY}'`));
check("an aggregate below the per claim limit is refused", await refused(`insert into eng_insurance_policies (kind, carrier, policy_number, limit_per_claim_cents, limit_aggregate_cents, named_insureds, effective_on, expires_on, certificate_key, certificate_sha256, certificate_bytes, recorded_by) values ('general_liability','C','P',200,100,array['X'],'2026-01-01','2027-01-01','policies/x.pdf','${"b".repeat(64)}',1,'${OWNER}')`));
check("a withdrawal without a reason is refused", await refused(`update eng_insurance_policies set withdrawn_at = now(), withdrawn_by = '${OWNER}', withdrawn_reason = ' ' where id = '${POLICY}'`));
check("a withdrawal with a reason is written", !(await refused(`update eng_insurance_policies set withdrawn_at = now(), withdrawn_by = '${OWNER}', withdrawn_reason = 'Recorded in error by the proof' where id = '${POLICY}'`)));
check("and a withdrawn policy cannot change again", await refused(`update eng_insurance_policies set withdrawn_reason = 'changed' where id = '${POLICY}'`));
const audited = await pg.query(`select action from eng_audit_events where entity_id = '${POLICY}' order by created_at`);
check("both the recording and the withdrawal are in the audit log, by the database", JSON.stringify(audited.rows.map((r) => r.action)) === JSON.stringify(["insurance.recorded", "insurance.withdrawn"]), JSON.stringify(audited.rows));
await pg.exec(`insert into eng_insurance_alerts (policy_id, days_before) values ('${POLICY}', 45)`);
check("a warning is recorded once per threshold", await refused(`insert into eng_insurance_alerts (policy_id, days_before) values ('${POLICY}', 45)`));
check("and is never changed or removed", await refused(`delete from eng_insurance_alerts where policy_id = '${POLICY}'`) && await refused(`update eng_insurance_alerts set days_before = 14 where policy_id = '${POLICY}'`));
check("only 45, 14 and 1 are thresholds", await refused(`insert into eng_insurance_alerts (policy_id, days_before) values ('${POLICY}', 30)`));
const grants = await pg.query(`select role_key from eng_role_grants where action = 'insurance.manage' order by role_key`);
check("insurance.manage is the administrator's and the operations manager's, and nobody else's", JSON.stringify(grants.rows.map((r) => r.role_key)) === JSON.stringify(["admin", "ops_manager"]), JSON.stringify(grants.rows));

/* ------------------------------------------------------------ 2. the rules */
process.env.SUPABASE_URL = "http://insurance-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "insurance-proof-not-a-key";
delete process.env.VERCEL_ENV;

const state = { inserted: [], alerts: [], raised: [], uploads: [], people: [] };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const ROW = {
  id: "pol-1", created_at: "2026-10-25T00:00:00Z", kind: "professional_liability", carrier: "Proof Carrier",
  policy_number: "PROOF-1", limit_per_claim_cents: 100000000, limit_aggregate_cents: 200000000,
  named_insureds: ["A proof insured"], effective_on: "2026-01-01", expires_on: "2026-11-08",
  certificate_key: "policies/proof.pdf", certificate_sha256: "a".repeat(64), withdrawn_at: null, withdrawn_reason: null,
};
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const path = url.pathname;
  if (path.startsWith("/storage/v1/object/")) {
    state.uploads.push(path);
    return json({ Key: path });
  }
  const table = path.replace("/rest/v1/", "");
  if (req.method === "POST" && table === "eng_insurance_alerts") {
    const row = JSON.parse(await req.text());
    const key = `${row.policy_id}:${row.days_before}`;
    if (state.alerts.includes(key)) return json({ message: "duplicate key", code: "23505" }, 409);
    state.alerts.push(key);
    return json([], 201);
  }
  if (req.method === "POST" && table === "eng_insurance_policies") {
    state.inserted.push(JSON.parse(await req.text()));
    return json({ id: "pol-new" }, 201);
  }
  if (req.method === "POST" && table === "eng_notifications") {
    state.raised.push(JSON.parse(await req.text()));
    return json({ id: `n-${state.raised.length}` }, 201);
  }
  if (table === "eng_insurance_policies") return json([ROW]);
  if (table === "eng_insurance_alerts") return json(state.alerts.map((k) => ({ policy_id: k.split(":")[0], days_before: Number(k.split(":")[1]) })));
  if (table === "eng_profiles") {
    const email = url.searchParams.get("id") ? state.people.find((p) => `eq.${p.id}` === url.searchParams.get("id"))?.email : null;
    return url.searchParams.get("id") ? json(email ? { email } : null) : json(state.people);
  }
  if (table === "eng_notification_prefs") return json([]);
  return json([]);
};

const ins = await import("../../src/lib/ops-insurance.ts");
check("a figure as the certificate prints it is read to cents", ins.dollarsToCentsStrict("$1,000,000") === 100000000 && ins.dollarsToCentsStrict("2500.50") === 250050);
check("and a blank, a word or a negative is refused, never zero", [" ", "", "one million", "-5", "1.234"].every((s) => ins.dollarsToCentsStrict(s) === null));
const good = { kind: "professional_liability", carrier: "Proof Carrier", policyNumber: "P-1", limitPerClaim: "1,000,000", limitAggregate: "2,000,000", namedInsureds: "A proof insured\n", effectiveOn: "2026-11-01", expiresOn: "2027-11-01" };
check("a complete policy validates", ins.validatePolicy(good).ok === true);
for (const [field, value, why] of [
  ["kind", "flood", "a kind"],
  ["carrier", " ", "the carrier"],
  ["policyNumber", "", "the policy number"],
  ["limitAggregate", "500,000", "the aggregate below the per claim limit"],
  ["namedInsureds", "\n \n", "no named insured"],
  ["expiresOn", "2026-10-01", "an expiry before the effective date"],
  ["effectiveOn", "2026-02-30", "a date that does not exist"],
]) {
  check(`and ${why} is refused with a sentence`, ins.validatePolicy({ ...good, [field]: value }).ok === false);
}
check("90 days out, no warning is due", ins.alertDue({ expiresOn: "2027-01-23", withdrawnAt: null }, [], "2026-10-25") === null);
check("45 days out, the 45 day warning is due", ins.alertDue({ expiresOn: "2026-12-09", withdrawnAt: null }, [], "2026-10-25") === 45);
check("recorded nine days out, it is warned once at 14 and never at 45", ins.alertDue({ expiresOn: "2026-11-03", withdrawnAt: null }, [], "2026-10-25") === 14);
check("a threshold already sent is not sent again", ins.alertDue({ expiresOn: "2026-11-03", withdrawnAt: null }, [14], "2026-10-25") === null);
check("the last day is the 1 day warning", ins.alertDue({ expiresOn: "2026-10-26", withdrawnAt: null }, [45, 14], "2026-10-25") === 1);
check("a withdrawn or expired policy warns nobody", ins.alertDue({ expiresOn: "2026-10-26", withdrawnAt: "x" }, [], "2026-10-25") === null && ins.alertDue({ expiresOn: "2026-10-20", withdrawnAt: null }, [], "2026-10-25") === null);

/* ------------------------------------------------------------ 3. library */
const admin = { id: "a1", role: "admin", status: "active", email: "x@audit-probe.invalid", grants: new Set(["insurance.manage"]) };
const engineer = { id: "e1", role: "engineer", status: "active", email: "e@audit-probe.invalid", grants: new Set(["files.list"]) };
const pdf = new TextEncoder().encode("%PDF-1.7 proof certificate");
const refusedRole = await ins.recordPolicy(engineer, good, pdf);
check("an engineer cannot record a policy", refusedRole.ok === false && state.uploads.length === 0, JSON.stringify(refusedRole));
const notPdf = await ins.recordPolicy(admin, good, new TextEncoder().encode("hello, not a pdf"));
check("a file that is not a PDF is refused before anything is stored", notPdf.ok === false && state.uploads.length === 0, JSON.stringify(notPdf));
const recorded = await ins.recordPolicy(admin, good, pdf);
check(
  "the owner records a policy: the certificate is stored and the row carries its SHA-256",
  recorded.ok === true && state.uploads.length === 1 && /^[0-9a-f]{64}$/.test(state.inserted[0]?.certificate_sha256 ?? "") && state.inserted[0]?.recorded_by === "a1",
  JSON.stringify({ recorded, uploads: state.uploads.length }),
);

state.people = [
  { id: "p-real", role: "admin", email: "a-real-person@example.com" },
  { id: "p-probe", role: "ops_manager", email: "office-probe@audit-probe.invalid" },
];
const first = await ins.sendInsuranceExpiryAlerts("2026-10-25");
const raisedFor = state.raised.map((r) => r.profile_id);
check("the sweep raises the due warning (14 days, 2026-11-08)", first.ok === true && first.sent === 1 && state.alerts.includes("pol-1:14"), JSON.stringify(first));
check("off production it warns the probe and never the real address", raisedFor.includes("p-probe") && !raisedFor.includes("p-real"), JSON.stringify(raisedFor));
const before = state.raised.length;
const second = await ins.sendInsuranceExpiryAlerts("2026-10-25");
check("run again the same day, it raises nothing more", second.ok === true && second.sent === 0 && state.raised.length === before, JSON.stringify(second));

/* The line it does not cross, and the doors. */
const launch = readFileSync("src/lib/launch.ts", "utf8");
check("the launch gate does not read the register yet (a ruling asked of Robert)", !/ops-insurance|eng_insurance_policies/.test(launch));
const route = readFileSync("src/app/api/portal/insurance/route.ts", "utf8");
const page = readFileSync("src/app/portal/(app)/insurance/page.tsx", "utf8");
check("the route and the page refuse anybody without insurance.manage", /can\(actor, "insurance\.manage"\)/.test(route) && /!can\(actor, "insurance\.manage"\)\) notFound\(\)/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: insurance is a register that keeps every policy as recorded and warns the office and the owner before it lapses.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
