/**
 * A CERTIFICATION FROM SUPERVISED TRAINING COUNTS ONLY WHEN THE ENGINEER OF
 * RECORD APPROVES IT, AND NOBODY ELSE CAN.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-certification-waits-for-the-engineer.mjs
 *
 * Operator ruling of 2026-10-07: an administrator records it, naming the
 * protocol version, the training date and who supervised; it counts for
 * dispatch only once the engineer of record approves it from his own session;
 * until then it shows as awaiting the engineer and dispatch refuses; a refusal
 * needs a reason and is audited. Proof both ways: recorded but unapproved,
 * refused; approved, offered; approval by anyone but the engineer, refused.
 *
 * ON DEVELOPMENT ONLY, against probes on the probe domain, asking DISPATCH
 * ITSELF (dispatchContext) for a job in the probe technician's county. The
 * engineer of record is a probe whose license is pushed onto the register IN
 * THIS PROCESS ONLY, never into the file, as the order path walk does under
 * walk option B; a second engineer-role probe with a license the register does
 * not hold stands for "an engineer, but not the engineer of record". Probes are
 * swept at the end and the sweep read back; the audit events stay, as every
 * probe's do.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the certification approval proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { verifiedEngineers } = await import("../../src/config/credentials.ts");
const { dispatchContext } = await import("../../src/lib/ops-field.ts");
const { recordCredential } = await import("../../src/lib/ops-onboarding.ts");
const { recordTraining, decideTraining, trainingRecords, trainingAwaitingEngineer } = await import("../../src/lib/certification-record.ts");
const { destroyProbes } = await import("../lib/portal-probe.mjs");

const STAMP = Date.now();
const PROOF_LICENCE = `PROOF-CERT-${STAMP}`;
const made = [];
async function probe(role, extra = {}) {
  const email = `cert-${role}-${STAMP}-${made.length}@audit-probe.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, password: `p-${randomUUID()}`, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser ${role}: ${error?.message}`);
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id, email, display_name: `Certification proof ${role}, not a real person`,
    role, status: "active", is_demo: true, ...extra,
  });
  if (pErr) throw new Error(`profile ${role}: ${pErr.message}`);
  made.push(data.user.id);
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", data.user.id).single();
  const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", role);
  return { ...row, grants: new Set((grants ?? []).map((g) => g.action)) };
}

try {
  const { data: tpl } = await db
    .from("eng_protocol_templates").select("id, version_label").eq("document_number", "254-RC-001").eq("status", "published").maybeSingle();
  if (!tpl) {
    console.log("COULD NOT TELL: development holds no published RC-001, so there is nothing to be trained on.");
    process.exit(0);
  }

  const admin = await probe("admin");
  const engineer = await probe("engineer", { license_number: PROOF_LICENCE });
  const otherEngineer = await probe("engineer", { license_number: `NOT-ON-REGISTER-${STAMP}` });
  const COUNTY = "Kenedy";
  const tech = await probe("field_tech", { coverage_counties: [COUNTY], certification_status: "none" });
  for (const input of [
    { kind: "drivers_license", label: "Certification proof, no document", issuedOn: "2026-01-01", expiresOn: "2099-01-01" },
    { kind: "vehicle_insurance", label: "Certification proof insurer, policy PROOF-1", issuedOn: "2026-01-01", expiresOn: "2099-01-01" },
    { kind: "w9", label: "Certification proof, no document" },
    { kind: "ic_agreement", label: "Certification proof, no document" },
  ]) {
    const r = await recordCredential(admin, tech.id, input);
    if (!r.ok) throw new Error(`credential ${input.kind}: ${r.error}`);
  }

  // The engineer of record, in this process only.
  verifiedEngineers.push({
    name: "Certification Proof Engineer, not a real person",
    licenseNumber: PROOF_LICENCE,
    state: "TX",
    verifiedOn: "2026-10-07",
    expires: "2099-12-31",
  });
  check("the engineer of record is on the register in this process only", verifiedEngineers.some((e) => e.licenseNumber === PROOF_LICENCE));

  const job = { id: randomUUID(), county: COUNTY, service_slug: "roof-inspections", latitude: null, longitude: null };
  const offered = async () => {
    const ctx = await dispatchContext(admin, job);
    return { offered: ctx.plan.offers.some((o) => o.techId === tech.id), reason: ctx.plan.ineligible.find((i) => i.id === tech.id)?.reason ?? null };
  };

  check("before anything is recorded, dispatch refuses him", !(await offered()).offered);

  // Recorded by the administrator, not yet approved: still refused, and shown as awaiting.
  const recorded = await recordTraining(admin, tech.id, { serviceSlug: "roof-inspections", trainedOn: "2026-09-23", supervisedBy: "Certification Proof Engineer" });
  check("an administrator records the supervised training", recorded.ok, recorded.ok ? `record ${recorded.id}` : recorded.error);
  const rec = (await trainingRecords(tech.id))?.find((r) => r.id === recorded.id);
  check("it names the protocol version, the training date and who supervised",
    rec?.protocolVersion === tpl.version_label && rec?.trainedOn === "2026-09-23" && rec?.supervisedBy === "Certification Proof Engineer",
    rec ? `${rec.protocolVersion}, ${rec.trainedOn}, ${rec.supervisedBy}` : "not found");
  check("and it shows as awaiting the engineer", rec?.status === "awaiting_engineer");
  check("and it is on the engineer's list", ((await trainingAwaitingEngineer()).records ?? []).some((r) => r.id === recorded.id));
  const waiting = await offered();
  check("RECORDED BUT UNAPPROVED: dispatch refuses him", !waiting.offered, waiting.reason ?? "offered");
  const dup = await recordTraining(admin, tech.id, { serviceSlug: "roof-inspections", trainedOn: "2026-09-24", supervisedBy: "Somebody else" });
  check("a second record for the same line while one awaits is refused", !dup.ok);

  // Approval by anybody but the engineer of record: refused, and nothing changes.
  const byAdmin = await decideTraining(admin, recorded.id, "approve", "");
  check("APPROVAL BY AN ADMINISTRATOR is refused", !byAdmin.ok, byAdmin.ok ? "approved" : byAdmin.error);
  const byTech = await decideTraining(tech, recorded.id, "approve", "");
  check("APPROVAL BY THE TECHNICIAN HIMSELF is refused", !byTech.ok);
  const byOther = await decideTraining(otherEngineer, recorded.id, "approve", "");
  check("APPROVAL BY AN ENGINEER WHO IS NOT THE ENGINEER OF RECORD is refused", !byOther.ok && /engineer of record/.test(byOther.error ?? ""), byOther.ok ? "approved" : byOther.error);
  check("and after all three, he is still refused by dispatch", !(await offered()).offered);
  check("and the record is still awaiting the engineer", (await trainingRecords(tech.id))?.find((r) => r.id === recorded.id)?.status === "awaiting_engineer");

  // The engineer of record approves: offered.
  const approved = await decideTraining(engineer, recorded.id, "approve", "");
  check("THE ENGINEER OF RECORD APPROVES it", approved.ok, approved.ok ? "" : approved.error);
  const now = await offered();
  check("APPROVED: dispatch offers him the job", now.offered, now.reason ?? "");
  const again = await decideTraining(engineer, recorded.id, "refuse", "Changed my mind about this one entirely.");
  check("a decided record cannot be decided again", !again.ok);

  // A refusal needs a reason, is audited, and certifies nothing.
  const tech2 = await probe("field_tech", { coverage_counties: [COUNTY], certification_status: "none" });
  const second = await recordTraining(admin, tech2.id, { serviceSlug: "roof-inspections", trainedOn: "2026-10-01", supervisedBy: "Certification Proof Engineer" });
  const bare = await decideTraining(engineer, second.id, "refuse", "no");
  check("a refusal without a reason is refused", !bare.ok && /reason/.test(bare.error ?? ""));
  const refused = await decideTraining(engineer, second.id, "refuse", "The supervised inspection did not cover the attic items.");
  check("a refusal with his reason is recorded", refused.ok, refused.ok ? "" : refused.error);
  const r2 = (await trainingRecords(tech2.id))?.find((r) => r.id === second.id);
  check("and the record says refused, with the reason", r2?.status === "refused" && /attic items/.test(r2?.refusalReason ?? ""));
  const { data: cert2 } = await db.from("eng_certifications").select("status").eq("profile_id", tech2.id).eq("service_slug", "roof-inspections").maybeSingle();
  check("and no certification was written for him", !cert2 || cert2.status !== "certified", cert2?.status ?? "none");
  const { count: refusedEvents } = await db.from("eng_audit_events").select("id", { count: "exact", head: true })
    .eq("action", "certification.training_refused").eq("entity_id", tech2.id);
  check("and the refusal is in the audit trail", refusedEvents === 1, `${refusedEvents} event(s)`);
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  const swept = await destroyProbes("certification-proof");
  let left = 0;
  for (const id of made) {
    const { data } = await db.auth.admin.getUserById(id);
    if (data?.user) left += 1;
  }
  check("the probes are swept, read back", left === 0 && swept.ok, `${left} left`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a certification from supervised training counts only when the engineer of record approves it.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
