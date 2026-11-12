/**
 * A FRANCHISEE IS ONBOARDED BEFORE IT OPERATES (0128). Robert's overnight
 * orders of 2026-11-10, platform item X4: "agreement signed, insurance
 * certificates on file (Item 7 coverages), owner through the academy,
 * technicians certified by the engineer before dispatch."
 *
 *   A  the steps, pure: each of the four is met only by the fact it names; a
 *      certificate counts only while it is in force and not withdrawn; workers
 *      compensation or a non-subscriber filing meets the same requirement; an
 *      owner and a technician must exist, not merely be absent; and the
 *      refusal names every unmet step.
 *   B  the gate, read in the code: the status change asks the steps before it
 *      moves onboarding to operating, and before it writes anything; the
 *      agreement is recorded once, audited first; a certificate is stored as a
 *      PDF with its hash before its row, and removed again if the row fails;
 *      every act asks franchise.manage; and the route and the page ask the same.
 *   C  the table, replayed: the agreement is whole or nothing; a certificate
 *      cannot be deleted, edited, or withdrawn twice or without a reason; each
 *      recording and withdrawal writes an audit row in the same transaction;
 *      its kinds are the four named; and the bucket is private.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/franchisee-onboarding-rules.ts");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ----------------------------------------------------------------- A, the steps */

const TODAY = "2026-11-11";
const cert = (kind, over = {}) => ({ kind, effectiveOn: "2026-01-01", expiresOn: "2027-01-01", withdrawn: false, ...over });
const ready = {
  today: TODAY,
  agreementSignedOn: "2026-11-01",
  certificates: [cert("general_liability"), cert("auto"), cert("workers_compensation")],
  owners: [{ name: "Owner One", graduated: true }],
  technicians: [{ name: "Tech One", certifiedLines: 2 }],
};
const stepsOf = (facts) => rules.onboardingSteps(facts);
const met = (facts, key) => stepsOf(facts).find((s) => s.key === key)?.met;

check("A: the four steps are the four X4 names, in order", JSON.stringify(stepsOf(ready).map((s) => s.key)) === JSON.stringify(["agreement", "certificates", "owner", "technicians"]));
check("A: a franchisee with every fact in place may operate", rules.operatingRefusal(stepsOf(ready)) === null);
check("A: no agreement, not met", met({ ...ready, agreementSignedOn: null }, "agreement") === false);
check("A: a non-subscriber filing meets the workers compensation requirement", met({ ...ready, certificates: [cert("general_liability"), cert("auto"), cert("non_subscriber_filing")] }, "certificates") === true);
check("A: without auto, not met, and it says so", met({ ...ready, certificates: [cert("general_liability"), cert("workers_compensation")] }, "certificates") === false && /auto/.test(stepsOf({ ...ready, certificates: [cert("general_liability"), cert("workers_compensation")] })[1].says));
check("A: an expired certificate does not count", met({ ...ready, certificates: [cert("general_liability", { expiresOn: "2026-11-10" }), cert("auto"), cert("workers_compensation")] }, "certificates") === false);
check("A: a certificate not yet in force does not count", met({ ...ready, certificates: [cert("general_liability", { effectiveOn: "2026-11-12" }), cert("auto"), cert("workers_compensation")] }, "certificates") === false);
check("A: a withdrawn certificate does not count", met({ ...ready, certificates: [cert("general_liability", { withdrawn: true }), cert("auto"), cert("workers_compensation")] }, "certificates") === false);
check("A: a certificate expiring today still counts today", met({ ...ready, certificates: [cert("general_liability", { expiresOn: TODAY }), cert("auto"), cert("workers_compensation")] }, "certificates") === true);
check("A: an owner who has not graduated, not met", met({ ...ready, owners: [{ name: "Owner One", graduated: false }] }, "owner") === false);
check("A: no owner at all, not met", met({ ...ready, owners: [] }, "owner") === false);
check("A: a technician certified on no line, not met", met({ ...ready, technicians: [{ name: "Tech One", certifiedLines: 2 }, { name: "Tech Two", certifiedLines: 0 }] }, "technicians") === false);
check("A: no technician at all, not met", met({ ...ready, technicians: [] }, "technicians") === false);
const refusal = rules.operatingRefusal(stepsOf({ ...ready, agreementSignedOn: null, technicians: [] }));
check("A: the refusal names every unmet step and no met one", /agreement signed/.test(refusal ?? "") && /technicians certified/.test(refusal ?? "") && !/owner through/.test(refusal ?? ""), refusal ?? "none");
check(
  "A: the coverages are the standing list's three, written as literals",
  JSON.stringify(rules.REQUIRED_COVERAGES.map((r) => r.anyOf)) === JSON.stringify([["general_liability"], ["auto"], ["workers_compensation", "non_subscriber_filing"]]),
);

/* ------------------------------------------------------------------ B, the gate */

const statusSrc = readSource("src/lib/franchisees.ts");
const fn = statusSrc.slice(statusSrc.indexOf("export async function setFranchiseeStatus("), statusSrc.indexOf("export async function setFranchiseeTerritory("));
const gateAt = fn.indexOf('if (row.status === "onboarding" && change.to === "operating") {');
check("B: the status change asks onboarding when onboarding becomes operating", gateAt > 0 && /const read = await onboardingStepsFor\(db, input\.id\);/.test(fn) && /const refusal = operatingRefusal\(read\.onboarding\.steps\);\s*if \(refusal\) return refuse\(refusal\);/.test(fn));
check("B: and before it writes the audit row or the status", gateAt > 0 && gateAt < fn.indexOf("writeAuditOrRefuse(") && gateAt < fn.indexOf('.from("eng_franchisees")\n    .update('));
check("B: a failed read of onboarding refuses rather than lets it through", /if \(!read\.ok\) return refuse\(`Onboarding could not be read, so the status was not changed/.test(fn));

const lib = readSource("src/lib/franchisee-onboarding.ts");
const exported = [...lib.matchAll(/export async function ([a-zA-Z]+)\(actor: Actor \| null/g)].map((m) => m[1]);
const keeperGuarded = exported.filter((name) => {
  const body = lib.slice(lib.indexOf(`export async function ${name}(`));
  const firstLines = body.split("\n").slice(1, 4).join("\n");
  return /if \(!(a|keeper\(actor\))\) return refuse\(NOT_ALLOWED\);/.test(firstLines);
});
check("B: every act and read asks franchise.manage first", exported.length === 5 && keeperGuarded.length === exported.length, `${keeperGuarded.length} of ${exported.length}: ${exported.join(", ")}`);
check("B: the keeper is franchise.manage", /const keeper = \(actor: Actor \| null\): Actor \| null => \(actor && can\(actor, "franchise\.manage"\) \? actor : null\);/.test(lib));
const agreement = lib.slice(lib.indexOf("export async function recordAgreement("), lib.indexOf("export type CertificateInput"));
check("B: the agreement is audited before it is written", agreement.indexOf("writeAuditOrRefuse(") > 0 && agreement.indexOf("writeAuditOrRefuse(") < agreement.indexOf(".update("));
check("B: the agreement is written only while none is recorded", /\.is\("agreement_signed_on", null\)/.test(agreement));
check("B: a day in the future is refused", /if \(day > todayInFirmCalendar\(\)\) return refuse\(/.test(agreement));
const record = lib.slice(lib.indexOf("export async function recordCertificate("), lib.indexOf("export async function withdrawCertificate("));
check("B: a certificate must be a PDF", /if \(!isPdf\(pdf\)\) return refuse\(/.test(record));
check("B: the PDF is stored before its row, and removed if the row fails", record.indexOf(".upload(") > 0 && record.indexOf(".upload(") < record.indexOf(".insert(") && /\.remove\(\[key\]\)/.test(record));
check("B: its hash is the hash of the bytes stored", /const sha256 = createHash\("sha256"\)\.update\(pdf\)\.digest\("hex"\);/.test(record) && /certificate_sha256: sha256,/.test(record));
const withdraw = lib.slice(lib.indexOf("export async function withdrawCertificate("), lib.indexOf("export async function franchiseeCertificateLink("));
check("B: a withdrawal needs a reason and touches only a live certificate", /if \(why\.length < 3\) return refuse\(/.test(withdraw) && /\.is\("withdrawn_at", null\)/.test(withdraw));

const route = readSource("src/app/api/portal/franchisees/certificates/route.ts");
check("B: the certificate route asks franchise.manage on every method", (route.match(/if \(!can\(actor, "franchise\.manage"\)\) return bad\(NOT_ALLOWED, 403\);/g) ?? []).length === 2);
const page = readSource("src/app/portal/(app)/franchisees/page.tsx");
check("B: the page shows onboarding from the same read", /const onboarding = await onboardingFor\(actor, f\.id\);/.test(page));

/* ----------------------------------------------------------------- C, replayed */

const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const at = files.indexOf("0128_a_franchisee_is_onboarded_before_it_operates.sql");
check("C: 0128 is in the chain", at >= 0);
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));
const refused = (sql) => db.exec(sql).then(() => "").catch((e) => String(e.message));
const one = async (sql) => (await db.query(sql)).rows[0];

const P = "00000000-0000-4000-8000-0000000000a1";
await db.exec(`insert into auth.users (id) values ('${P}');
  insert into eng_profiles (id, email, display_name, role, status) values ('${P}', 'onboard-proof@audit-probe.invalid', 'Proof Admin', 'admin', 'active')`);
const F = (await one(`insert into eng_franchisees (legal_name) values ('Proof Field Services LLC') returning id`)).id;

check("C: half an agreement is refused", (await refused(`update eng_franchisees set agreement_signed_on = '2026-11-01' where id = '${F}'`)).includes("eng_franchisees_agreement_whole"));
check("C: a whole agreement is taken", (await refused(`update eng_franchisees set agreement_signed_on = '2026-11-01', agreement_recorded_by = '${P}', agreement_recorded_at = now() where id = '${F}'`)) === "");

const insert = (over = {}) => {
  const v = { kind: "general_liability", carrier: "Proof Mutual", policy: "GL-1", eff: "2026-01-01", exp: "2027-01-01", key: `k-${Math.random()}`, ...over };
  return `insert into eng_franchisee_certificates (franchisee_id, kind, carrier, policy_number, effective_on, expires_on, certificate_key, certificate_sha256, certificate_bytes, recorded_by)
          values ('${F}', '${v.kind}', '${v.carrier}', '${v.policy}', '${v.eff}', '${v.exp}', '${v.key}', '${"a".repeat(64)}', 100, '${P}') returning id`;
};
check("C: a kind outside the four is refused", (await refused(insert({ kind: "professional_liability" }))).includes("eng_franchisee_certificates_kind_known"));
check("C: a certificate that expires before it starts is refused", (await refused(insert({ eff: "2027-01-02" }))).includes("eng_franchisee_certificates_dates"));
const before = Number((await one(`select count(*)::int as n from eng_audit_events where action = 'franchisee_certificate.recorded'`)).n);
const C = (await one(insert())).id;
const after = Number((await one(`select count(*)::int as n from eng_audit_events where action = 'franchisee_certificate.recorded'`)).n);
check("C: recording one writes its audit row in the same transaction", after === before + 1);
check("C: it cannot be deleted", (await refused(`delete from eng_franchisee_certificates where id = '${C}'`)).includes("cannot be deleted"));
check("C: it cannot be edited", (await refused(`update eng_franchisee_certificates set expires_on = '2030-01-01' where id = '${C}'`)).includes("Only its withdrawal may be written"));
check("C: it cannot be withdrawn without a reason", (await refused(`update eng_franchisee_certificates set withdrawn_at = now(), withdrawn_by = '${P}' where id = '${C}'`)).includes("eng_franchisee_certificates_withdrawn_whole"));
check("C: it can be withdrawn with one", (await refused(`update eng_franchisee_certificates set withdrawn_at = now(), withdrawn_by = '${P}', withdrawn_reason = 'Replaced at renewal' where id = '${C}'`)) === "");
check("C: and the withdrawal is audited", Number((await one(`select count(*)::int as n from eng_audit_events where action = 'franchisee_certificate.withdrawn' and entity_id = '${C}'`)).n) === 1);
check("C: a withdrawn certificate cannot change again", (await refused(`update eng_franchisee_certificates set withdrawn_reason = 'Something else' where id = '${C}'`)).includes("cannot change again"));
const bucket = await one(`select public, allowed_mime_types from storage.buckets where id = 'eng-franchisee-certificates'`);
check("C: the bucket is private and takes PDFs only", bucket?.public === false && JSON.stringify(bucket?.allowed_mime_types) === JSON.stringify(["application/pdf"]), JSON.stringify(bucket));
await db.close();

console.log(wrong === 0 ? "PASS: a franchisee is onboarded before it operates." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
