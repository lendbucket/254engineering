/**
 * WHAT THE CREDENTIALS SCREEN RECORDS IS WHAT DISPATCH READS, BOTH WAYS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-credentials-screen-opens-and-closes-dispatch.mjs
 *
 * Operator ruling of 2026-10-07: an administrator records a technician's
 * credentials on /portal/techs/[id]; dispatch refuses a technician with a
 * missing or expired credential and accepts him once it is recorded there; the
 * screen and dispatch can never disagree; a credential is replaced by a new
 * record, never edited, and the old one stays.
 *
 * ON DEVELOPMENT ONLY. It makes a probe administrator and a probe technician on
 * the probe domain (certified on the published RC-001, covering one county),
 * then asks DISPATCH ITSELF, through dispatchContext, the plan the dispatch
 * panel shows, for a job in that county. It records credentials through
 * recordCredential, the screen's own server function, and reads the screen's
 * own sheet beside each answer. No file row is made: dispatchContext plans for
 * the county and service it is given. The probes are swept at the end and the
 * sweep is read back; the audit rows recordCredential writes stay, as every
 * probe's do.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the credentials screen proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { dispatchContext } = await import("../../src/lib/ops-field.ts");
const { recordCredential, credentialSheet, setTechCoverage } = await import("../../src/lib/ops-onboarding.ts");
const { destroyProbes } = await import("../lib/portal-probe.mjs");

const STAMP = Date.now();
const made = [];
async function probe(role, extra = {}) {
  const email = `creds-${role}-${STAMP}@audit-probe.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, password: `p-${randomUUID()}`, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser ${role}: ${error?.message}`);
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id, email, display_name: `Credentials proof ${role}, not a real person`,
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
  const COUNTY = "Kenedy"; // sparsely covered on purpose; the plan is read for THIS technician only
  const tech = await probe("field_tech", { coverage_counties: [COUNTY], certification_status: "certified" });
  const { error: certError } = await db.from("eng_certifications").insert({
    profile_id: tech.id, service_slug: "roof-inspections", template_id: tpl.id,
    status: "certified", attempts: 1, certified_at: new Date().toISOString(),
  });
  if (certError) throw new Error(`certification: ${certError.message}`);

  const job = { id: randomUUID(), county: COUNTY, service_slug: "roof-inspections", latitude: null, longitude: null };
  const ask = async () => {
    const ctx = await dispatchContext(admin, job);
    if (!ctx) throw new Error("dispatchContext returned nothing for an administrator");
    const offered = ctx.plan.offers.some((o) => o.techId === tech.id);
    const refused = ctx.plan.ineligible.find((i) => i.id === tech.id);
    return { offered, reason: refused?.reason ?? null };
  };
  const sheetSays = async (kind) => (await credentialSheet(tech.id)).standing.find((s) => s.kind === kind);
  const record = (input) => recordCredential(admin, tech.id, input);
  const LABEL = "Credentials proof, no document";

  // 1. Nothing recorded: dispatch refuses, and the screen says missing.
  const none = await ask();
  check("with no credentials recorded, dispatch refuses him", !none.offered && Boolean(none.reason), none.reason ?? "offered");
  check("and the screen says the driver license is missing", (await sheetSays("drivers_license"))?.state === "missing");

  // 2. Three current, the driver license EXPIRED: dispatch still refuses, and says why.
  for (const input of [
    { kind: "vehicle_insurance", label: `${LABEL}, Test Insurer policy TEST-1`, issuedOn: "2026-01-01", expiresOn: "2099-01-01" },
    { kind: "w9", label: LABEL, issuedOn: "2026-01-01" },
    { kind: "ic_agreement", label: LABEL, issuedOn: "2026-01-01" },
    { kind: "drivers_license", label: LABEL, issuedOn: "2020-01-01", expiresOn: "2025-01-01" },
  ]) {
    const r = await record(input);
    if (!r.ok) throw new Error(`recording ${input.kind}: ${r.error}`);
  }
  const expired = await ask();
  check("with the driver license expired, dispatch still refuses him", !expired.offered, expired.reason ?? "offered");
  check("and names the expired license as the reason", /Driver license expired on 2025-01-01/.test(expired.reason ?? ""), expired.reason ?? "");
  check("and the screen says expired, from the same rule", (await sheetSays("drivers_license"))?.state === "expired");

  // 3. A current driver license recorded on the screen: dispatch now offers him the job.
  const renewal = await record({ kind: "drivers_license", label: LABEL, issuedOn: "2026-01-01", expiresOn: "2099-01-01" });
  check("a current license is recorded through the screen's function", renewal.ok, renewal.ok ? "" : renewal.error);
  const cleared = await ask();
  check("and dispatch now offers him the job", cleared.offered, cleared.reason ?? "");
  const sheet = await credentialSheet(tech.id);
  check("and the screen says his credentials are clear", sheet.credentialsClear);

  // 4. Replaced, never edited: the expired license is still there, unchanged, beside the new one.
  const licenses = sheet.history.filter((h) => h.kind === "drivers_license");
  check(
    "the expired license stays on record, unchanged, beside its replacement",
    licenses.length === 2 && licenses.some((h) => h.expiresOn === "2025-01-01") && licenses.some((h) => h.expiresOn === "2099-01-01"),
    licenses.map((h) => h.expiresOn).join(", "),
  );
  check("and every record names the administrator who verified it", sheet.history.every((h) => h.verifiedBy === admin.id));

  // 5. What the screen refuses, from the server rule.
  const noPolicy = await record({ kind: "vehicle_insurance", issuedOn: "2026-01-01", expiresOn: "2099-01-01" });
  check("insurance without the insurer and policy is refused", !noPolicy.ok && /insurer and policy/.test(noPolicy.error ?? ""));
  const noExpiry = await record({ kind: "drivers_license", label: LABEL, issuedOn: "2026-01-01" });
  check("a license without its expiration date is refused", !noExpiry.ok && /expiration date/.test(noExpiry.error ?? ""));
  const notTracked = await record({ kind: "drone_license", label: LABEL, expiresOn: "2099-01-01" });
  check("a kind dispatch does not read is refused", !notTracked.ok);
  const onAdmin = await recordCredential(admin, admin.id, { kind: "w9", label: LABEL });
  check("a credential for somebody who is not a technician is refused", !onAdmin.ok);
  const byTech = await recordCredential(tech, tech.id, { kind: "w9", label: LABEL });
  check("a technician cannot record his own credentials", !byTech.ok && /cannot record/.test(byTech.error ?? ""));

  // 6. The audit trail.
  const { count: audited } = await db
    .from("eng_audit_events").select("id", { count: "exact", head: true })
    .eq("action", "credential.recorded").eq("entity_id", tech.id);
  check("every recording wrote an audit event, five recordings and five events", audited === 5, `${audited} event(s)`);

  // 7. Coverage counties, set on the same page: dispatch reads them, both ways.
  const away = await setTechCoverage(admin, tech.id, ["Bexar"]);
  check("coverage is set through the page's function", away.ok, away.ok ? "" : away.error);
  const uncovered = await ask();
  check("with the job's county off his coverage, dispatch refuses him", !uncovered.offered, uncovered.reason ?? "offered");
  const back = await setTechCoverage(admin, tech.id, ["Bexar", COUNTY.toLowerCase()]);
  check("and a county typed in lower case is stored as its canonical name", back.ok && back.counties.includes(COUNTY), back.ok ? back.counties.join(", ") : back.error);
  const covered = await ask();
  check("with it back on his coverage, dispatch offers him the job", covered.offered, covered.reason ?? "");
  const typo = await setTechCoverage(admin, tech.id, ["Bexar", "Kenedyy"]);
  check("a name that is not a Texas county is refused, not dropped", !typo.ok && /Not a Texas county: Kenedyy/.test(typo.error ?? ""));
  const { data: after } = await db.from("eng_profiles").select("coverage_counties").eq("id", tech.id).single();
  check("and the refused save changed nothing", (after?.coverage_counties ?? []).includes(COUNTY));
  const byTechCoverage = await setTechCoverage(tech, tech.id, ["Bexar"]);
  check("a technician cannot set his own coverage", !byTechCoverage.ok);
  const { data: coverageEvents } = await db
    .from("eng_audit_events").select("diff").eq("action", "profile.coverage_set").eq("entity_id", tech.id).order("id");
  const removedKenedy = (coverageEvents ?? []).some((e) => (e.diff?.removed?.from ?? []).includes(COUNTY));
  check("each change wrote an audit event naming what was removed", (coverageEvents ?? []).length === 2 && removedKenedy, `${(coverageEvents ?? []).length} event(s)`);
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  const swept = await destroyProbes("credentials-proof");
  let left = 0;
  for (const id of made) {
    const { data } = await db.auth.admin.getUserById(id);
    if (data?.user) left += 1;
  }
  check("the probes are swept, read back", left === 0 && swept.ok, `${left} left`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: what the credentials screen records is what dispatch reads, both ways.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
