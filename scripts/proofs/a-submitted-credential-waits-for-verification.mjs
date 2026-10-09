/**
 * A SUBMITTED CREDENTIAL WAITS FOR AN OPERATOR, AND DISPATCH WAITS WITH IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-submitted-credential-waits-for-verification.mjs
 *
 * Operator ruling of 2026-10-09 (fix/certification-unblock): a technician
 * submits each required credential themselves, the type, the issuing state and
 * the expiry only; it is "Submitted, awaiting verification" until an operator
 * verifies it on /portal/techs, which records who and when; a rejection carries
 * a reason the technician sees; dispatch counts only verified, current
 * credentials, exactly as before.
 *
 * The tests the ruling names, on development, with probe accounts on
 * @audit-probe.invalid only:
 *   submit, verify, dispatchable;
 *   submit an expired date, refused;
 *   reject with a reason, and the reason is what the technician reads.
 *
 * It asks DISPATCH ITSELF, through dispatchContext, at each step, and calls the
 * screens' own server functions. The probes are swept at the end and read back;
 * their credential and certification rows go with them by cascade.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the credential submission proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { dispatchContext } = await import("../../src/lib/ops-field.ts");
const { credentialSheet } = await import("../../src/lib/ops-onboarding.ts");
const { submitCredential, verifyCredential, rejectCredential, submissionsFor, awaitingVerification } = await import(
  "../../src/lib/ops-credential-submissions.ts"
);
const { destroyProbes } = await import("../lib/portal-probe.mjs");

const STAMP = Date.now();
const made = [];
async function probe(role, extra = {}) {
  const email = `credsub-${role}-${STAMP}@audit-probe.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, password: `p-${randomUUID()}`, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser ${role}: ${error?.message}`);
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id, email, display_name: `Credential submission proof ${role}, not a real person`,
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
    .from("eng_protocol_templates").select("id").eq("document_number", "254-RC-001").eq("status", "published").maybeSingle();
  if (!tpl) {
    console.log("COULD NOT TELL: development holds no published RC-001, so no technician can be certified to dispatch.");
    process.exit(0);
  }

  const admin = await probe("admin");
  const COUNTY = "Kenedy";
  const tech = await probe("field_tech", { coverage_counties: [COUNTY], certification_status: "certified" });
  const { error: certError } = await db.from("eng_certifications").insert({
    profile_id: tech.id, service_slug: "roof-inspections", template_id: tpl.id,
    status: "certified", attempts: 1, certified_at: new Date().toISOString(),
  });
  if (certError) throw new Error(`certification: ${certError.message}`);

  const job = { id: randomUUID(), county: COUNTY, service_slug: "roof-inspections", latitude: null, longitude: null };
  const ask = async () => {
    const ctx = await dispatchContext(admin, job);
    const offered = ctx.plan.offers.some((o) => o.techId === tech.id);
    const refused = ctx.plan.ineligible.find((i) => i.id === tech.id);
    return { offered, reason: refused?.reason ?? null };
  };
  const stateOf = async (kind) => (await credentialSheet(tech.id)).standing.find((s) => s.kind === kind)?.state;

  // 1. The expired date is refused, and nothing is written.
  const expired = await submitCredential(tech, { kind: "drivers_license", issuingState: "TX", expiresOn: "2020-01-01" });
  check("a submission with an expiry date that has passed is refused", !expired.ok && /has passed/.test(expired.error ?? ""), expired.ok ? "accepted" : expired.error);
  check("and nothing was written", (await submissionsFor(tech.id)).length === 0);

  // 2. A number or a document is not a field; a W-9 takes no state or expiry; a license needs its state.
  const noState = await submitCredential(tech, { kind: "drivers_license", issuingState: null, expiresOn: "2099-01-01" });
  check("a driver license without its issuing state is refused", !noState.ok);
  const w9WithDate = await submitCredential(tech, { kind: "w9", expiresOn: "2099-01-01" });
  check("a W-9 with an expiry date is refused, because it does not expire", !w9WithDate.ok);

  // 3. Reject with a reason: the technician reads it, and a rejection is not "on file".
  const first = await submitCredential(tech, { kind: "drivers_license", issuingState: "TX", expiresOn: "2099-01-01" });
  check("a driver license is submitted", first.ok, first.ok ? "" : first.error);
  check("and reads as submitted, awaiting verification", (await stateOf("drivers_license")) === "unverified");
  const queue = await awaitingVerification();
  check("and it is in the operator's queue", (queue ?? []).some((q) => q.id === first.id));
  const noReason = await rejectCredential(admin, first.id, "no");
  check("a rejection without a real reason is refused", !noReason.ok);
  const REASON = "The expiry typed does not match the card the operator holds; submit it again.";
  const rejected = await rejectCredential(admin, first.id, REASON);
  check("the operator rejects it with a reason", rejected.ok, rejected.ok ? "" : rejected.error);
  const seen = (await submissionsFor(tech.id)).find((s) => s.id === first.id);
  check("and the reason is what the technician's screen reads", seen?.status === "rejected" && seen?.rejectReason === REASON, seen?.rejectReason ?? "none");
  check("and a rejected license reads as missing, not as on file", (await stateOf("drivers_license")) === "missing");
  const again = await rejectCredential(admin, first.id, REASON);
  check("and a decided submission cannot be decided twice", !again.ok);

  // 4. Submit all four; nothing verified, so dispatch still refuses.
  for (const input of [
    { kind: "drivers_license", issuingState: "TX", expiresOn: "2099-01-01" },
    { kind: "vehicle_insurance", issuingState: "TX", expiresOn: "2099-01-01" },
    { kind: "w9" },
    { kind: "ic_agreement" },
  ]) {
    const r = await submitCredential(tech, input);
    if (!r.ok) throw new Error(`submitting ${input.kind}: ${r.error}`);
  }
  const twice = await submitCredential(tech, { kind: "w9" });
  check("a second submission of a kind already waiting is refused", !twice.ok);
  const unverified = await ask();
  check("with everything submitted and nothing verified, dispatch refuses him", !unverified.offered, unverified.reason ?? "offered");
  check("and names a submission awaiting verification as the reason", /awaiting verification/.test(unverified.reason ?? ""), unverified.reason ?? "");

  // 5. A technician cannot verify their own.
  const pendingNow = (await submissionsFor(tech.id)).filter((s) => s.status === "pending");
  const selfVerify = await verifyCredential(tech, pendingNow[0].id);
  check("a technician cannot verify their own submission", !selfVerify.ok);

  // 6. The operator verifies each, one action each: dispatchable.
  for (const s of pendingNow) {
    const v = await verifyCredential(admin, s.id);
    if (!v.ok) throw new Error(`verifying ${s.kind}: ${v.error}`);
  }
  const cleared = await ask();
  check("once the operator verifies all four, dispatch offers him the job", cleared.offered, cleared.reason ?? "");
  const after = await submissionsFor(tech.id);
  const { data: rows } = await db.from("eng_credentials").select("verified_by, verified_at, status").eq("profile_id", tech.id).eq("status", "verified");
  check(
    "and each verification records who and when",
    (rows ?? []).length === 4 && rows.every((r) => r.verified_by === admin.id && r.verified_at),
    `${(rows ?? []).length} verified`,
  );
  check("and the issuing state is stored as submitted", after.some((s) => s.kind === "drivers_license" && s.status === "verified" && s.issuingState === "TX"));
  const { count: audited } = await db
    .from("eng_audit_events").select("id", { count: "exact", head: true })
    .in("action", ["credential.submitted", "credential.verified", "credential.rejected"]).eq("entity_id", tech.id);
  check("every submission and decision wrote an audit event", audited === 10, `${audited} event(s): 5 submitted, 4 verified, 1 rejected`);
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  const swept = await destroyProbes("credential-submission-proof");
  let left = 0;
  for (const id of made) {
    const { data } = await db.auth.admin.getUserById(id);
    if (data?.user) left += 1;
  }
  check("the probes are swept, read back", left === 0 && swept.ok, `${left} left`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a submitted credential waits for an operator, and dispatch waits with it.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
