/**
 * A PROBE TECHNICIAN AND A PROBE ENGINEER GO FROM INVITE TO ACTIVATED, WITH NO
 * SQL. Robert's ruling P1, 2026-11-01 evening: "Proof: a probe technician and
 * a probe engineer go from invite to activated with no SQL."
 *
 *   npx tsx scripts/onboarding-walk-audit.mjs     (needs the suite's server)
 *
 * WRITES TO DEVELOPMENT, SO IT RUNS ONLY ON A BOARD, in the writers shard,
 * like w2-walk-audit. Never production: the client is built neverProduction.
 *
 * WHAT IS DRIVEN, AND THROUGH WHAT. Every step after the application is a
 * request to the product's own routes, as the person or the administrator
 * would make it:
 *
 *   administrator  POST /api/portal/onboarding  invite_from_application (by
 *                  hand, so the link comes back), decide_item, set_item_dates,
 *                  record_verification, set_coverage, activate
 *   the person     GET /onboarding/<token>, then POST /api/onboarding  upload
 *                  (a signed URL, and the bytes PUT straight to storage), item,
 *                  submit
 *
 * THE ONE ROW WRITTEN DIRECTLY IS THE APPLICATION, because the ruling's path
 * starts at the invite and the careers form is the applicant's act, not the
 * operator's. It is marked is_demo and its address is on the probe domain.
 *
 * WHAT IT ASSERTS ON THE WAY, per role: the invite returns a working link; a
 * rejection without a reason is refused and one with a reason reopens the item
 * for the person, who uploads it again; every item is accepted; identity (and,
 * for the engineer, the I-9) is recorded with a document type and reads back
 * with who and when; activation refuses an engineer with no license number and
 * then succeeds; the profile exists with the role, the license number for the
 * engineer, the coverage for the technician, and the accepted documents as
 * verified credentials.
 *
 * TEARDOWN, PER RUN AND SWEPT BY MARK. The onboardings (their items cascade),
 * the applications and the uploaded objects go first, then destroyProbes,
 * which also sweeps probe onboardings (0105 makes the verifier a restricting
 * foreign key). What stays, by design and as for every writer audit: the audit
 * rows, which that table never deletes, and the queued emails, addressed to
 * the probe domain and so no_external_effect (fixture-identity.ts).
 *
 * WITHOUT 0105 ON THIS DATABASE IT CANNOT MEASURE, and says COULD NOT TELL
 * rather than failing: the verification step writes columns that migration
 * adds, and a red here before the sitting would be a finding nobody made.
 */

import { AUDIT_BASE_URL } from "./lib/ports.mjs";
import { COULD_NOT_TELL } from "./lib/reachable.mjs";
import { createProbe, destroyProbes, PROBE_DOMAIN } from "./lib/portal-probe.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { onboardingProbeLicence } from "./lib/probe-licence.mjs";
import { checklistFor } from "../src/content/onboarding-checklists.ts";

const BASE = process.env.BASE_URL ?? AUDIT_BASE_URL;
const LABEL = "onboarding-walk";
const STARTED = Date.now();
const STAMP = `${STARTED.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const db = auditClient(LABEL, { neverProduction: true });
const BUCKET = "eng-onboarding";
/*
 * Unique to this run since 2026-11-02 (it was a fixed 9000105): 0109 holds one
 * licence number to one engineer profile, and a crashed run's probe, which the
 * sweep has not yet removed, would refuse the next run's activation. Seven
 * digits, because activation takes 4 to 7 (scripts/lib/probe-licence.mjs).
 */
const LICENCE = onboardingProbeLicence(STARTED);
/* A real calendar date years out, so an expiry never lapses under the walk. */
const FAR_EXPIRY = "2031-01-31";
const ISSUED = "2026-01-15";
/* The smallest bytes the bucket accepts as a PDF. Nothing reads them. */
const PDF = new TextEncoder().encode("%PDF-1.4\n% onboarding walk probe\n%%EOF\n");

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
  return ok;
};

const made = { onboardings: [], applications: [], objects: [] };

async function teardown() {
  const notes = [];
  if (made.objects.length) {
    const { error } = await db.storage.from(BUCKET).remove(made.objects);
    if (error) notes.push(`objects: ${error.message}`);
  }
  /* Swept by mark, not only this run's ids, so a crashed run's are removed too. */
  const { error: oErr } = await db.from("eng_onboardings").delete().like("email", `%@${PROBE_DOMAIN}`);
  if (oErr) notes.push(`onboardings: ${oErr.message}`);
  const { error: aErr } = await db.from("eng_applications").delete().like("email", `onboarding-walk-%@${PROBE_DOMAIN}`);
  if (aErr) notes.push(`applications: ${aErr.message}`);
  const swept = await destroyProbes(LABEL);
  const { count: onboardingsLeft } = await db.from("eng_onboardings").select("id", { count: "exact", head: true }).like("email", `%@${PROBE_DOMAIN}`);
  const { count: applicationsLeft } = await db.from("eng_applications").select("id", { count: "exact", head: true }).like("email", `onboarding-walk-%@${PROBE_DOMAIN}`);
  rec(
    "teardown removed every onboarding, application and probe account it made, read back",
    notes.length === 0 && swept.ok && onboardingsLeft === 0 && applicationsLeft === 0,
    [...notes, swept.note, `onboardings left ${onboardingsLeft ?? "unread"}, applications left ${applicationsLeft ?? "unread"}`].filter(Boolean).join("; "),
  );
}

function finish() {
  const failed = out.filter((r) => !r.ok);
  console.log("");
  console.log(failed.length === 0 ? `PASS: a probe engineer went from invite to activated with no SQL, and a probe technician went from invite to the academy's door and was refused there, creating nobody (${out.length} checks).` : `FAIL: ${failed.length} of ${out.length} check(s).`);
  process.exit(failed.length === 0 ? 0 : 1);
}

console.log("");
console.log("========== ONBOARDING, INVITE TO ACTIVATED ==========");
console.log("");

if (!db) {
  console.log("  COULD NOT TELL: no development database client, so nothing was walked.");
  process.exit(COULD_NOT_TELL);
}

/* 0105 present? Asked of the column the verification step writes. */
{
  const { error } = await db.from("eng_onboardings").select("identity_document_type").limit(1);
  if (error) {
    console.log(`  COULD NOT TELL: this database does not carry 0105 (${error.message}), so the verification step cannot be walked. Nothing was written.`);
    process.exit(COULD_NOT_TELL);
  }
}

const admin = await createProbe(BASE, "admin", LABEL);
if (!admin.cookie) {
  console.log(`  COULD NOT TELL: the administrator probe could not be built: ${admin.fault}`);
  await destroyProbes(LABEL);
  process.exit(COULD_NOT_TELL);
}
const staff = async (body) => {
  const res = await fetch(`${BASE}/api/portal/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `eng_ops=${admin.cookie}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const person = async (token, body) => {
  const res = await fetch(`${BASE}/api/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
async function upload(token, itemKey) {
  const signed = await person(token, { action: "upload", itemKey, filename: "probe.pdf", contentType: "application/pdf", size: PDF.byteLength });
  if (!signed.body?.ok) return `the upload was not prepared: ${signed.body?.error ?? signed.status}`;
  made.objects.push(signed.body.path);
  const put = await fetch(signed.body.url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: PDF });
  if (!put.ok) return `the bytes did not reach storage: ${put.status}`;
  const item = await person(token, { action: "item", itemKey, storageKey: signed.body.path });
  return item.body?.ok ? null : `the item was not recorded: ${item.body?.error ?? item.status}`;
}

async function walk(role) {
  const word = role === "engineer" ? "engineer" : "technician";
  const email = `onboarding-walk-${role.replace("_", "-")}-${STAMP}@${PROBE_DOMAIN}`;

  const { data: application, error: appError } = await db
    .from("eng_applications")
    .insert({ site: "254", role: role === "engineer" ? "professional_engineer" : "field_technician", name: `Walk Probe ${word}`, email, status: "new", is_demo: true })
    .select("id")
    .single();
  if (!rec(`${word}: the probe application is written`, !appError && Boolean(application), appError?.message ?? "")) return;
  made.applications.push(application.id);

  const invited = await staff({ action: "invite_from_application", applicationId: application.id, role, deliverBy: "hand" });
  if (!rec(`${word}: the invite returns its link once, by hand`, invited.body?.ok === true && typeof invited.body?.token === "string", invited.body?.error ?? "")) return;
  const { token, onboardingId } = invited.body;
  made.onboardings.push(onboardingId);

  /*
   * L6, Robert's answer of 2026-11-05: the invite link is exchanged for a
   * short lived httpOnly cookie and redirected to /onboarding/invite, so the
   * walk follows it the way a browser does, carrying the cookie, and reads the
   * flow's own heading rather than a status: the "not active" page is a 200 too.
   */
  const first = await fetch(`${BASE}/onboarding/${encodeURIComponent(token)}`, { redirect: "manual" });
  const inviteCookie = (first.headers.get("set-cookie") ?? "").split(";")[0];
  const inviteAt = first.headers.get("location") ?? "";
  rec(
    `${word}: the invite link is redirected to /onboarding/invite with its token in a cookie`,
    first.status === 307 && new URL(inviteAt || "/", BASE).pathname === "/onboarding/invite" && /^__Host-254-link-[0-9a-f]{20}=/.test(inviteCookie),
    `HTTP ${first.status}, location ${new URL(inviteAt || "/", BASE).pathname}`,
  );
  const page = await fetch(new URL(inviteAt || "/onboarding/invite", BASE), { redirect: "manual", headers: { cookie: inviteCookie } });
  const pageText = page.status === 200 ? await page.text() : "";
  rec(`${word}: the invite link opens the flow`, page.status === 200 && /Welcome,/.test(pageText), `HTTP ${page.status}`);

  const checklist = checklistFor(role);
  const personItems = checklist.filter((i) => i.actor === "person");
  for (const item of personItems) {
    const fault = item.acknowledgeOnly ? ((await person(token, { action: "item", itemKey: item.key })).body?.ok ? null : "the acknowledgement was refused") : await upload(token, item.key);
    rec(`${word}: the person completes "${item.label}"`, fault === null, fault ?? "");
  }
  const submitted = await person(token, { action: "submit" });
  rec(`${word}: the person sends the checklist`, submitted.body?.ok === true, submitted.body?.error ?? "");

  /* A rejection: refused without a reason, then made with one, then redone by the person. */
  const redo = personItems.find((i) => !i.acknowledgeOnly) ?? personItems[0];
  const bare = await staff({ action: "decide_item", onboardingId, itemKey: redo.key, decision: "rejected", reason: "  " });
  rec(`${word}: a rejection with no reason is refused`, bare.status === 400 && /reason/i.test(String(bare.body?.error)), bare.body?.error ?? `HTTP ${bare.status}`);
  const rejected = await staff({ action: "decide_item", onboardingId, itemKey: redo.key, decision: "rejected", reason: "Walk probe: the copy shown is not legible." });
  rec(`${word}: a rejection with a reason is recorded and the email queued`, rejected.body?.ok === true && rejected.body?.emailed === true, rejected.body?.error ?? rejected.body?.emailError ?? "");
  const { data: reopened } = await db.from("eng_onboarding_items").select("status, rejected_reason").eq("onboarding_id", onboardingId).eq("item_key", redo.key).maybeSingle();
  rec(`${word}: the rejected item reads rejected, with the reason the person is shown`, reopened?.status === "rejected" && /not legible/.test(reopened?.rejected_reason ?? ""), JSON.stringify(reopened));
  const { count: rejectedRows } = await db.from("eng_audit_events").select("id", { count: "exact", head: true }).eq("entity_id", onboardingId).eq("action", "onboarding.item_rejected");
  rec(`${word}: the rejection wrote its audit row`, rejectedRows === 1, `${rejectedRows ?? "unread"} row(s)`);
  if (!redo.acknowledgeOnly) {
    const again = await upload(token, redo.key);
    rec(`${word}: the person uploads the rejected item again`, again === null, again ?? "");
  }

  /* Every item accepted, as the screen offers it; the two verification items are not decided here. */
  for (const item of checklist) {
    if (item.key === "identity_verified_video" || item.key === "i9_documents_examined") {
      const refused = await staff({ action: "decide_item", onboardingId, itemKey: item.key, decision: "accepted", reason: "" });
      rec(`${word}: "${item.label}" cannot be accepted as an item, only recorded`, refused.status === 400, refused.body?.error ?? "");
      continue;
    }
    const accepted = await staff({ action: "decide_item", onboardingId, itemKey: item.key, decision: "accepted", reason: "" });
    rec(`${word}: "${item.label}" is accepted`, accepted.body?.ok === true, accepted.body?.error ?? "");
  }

  const { data: expiring } = await db.from("eng_onboarding_items").select("item_key").eq("onboarding_id", onboardingId);
  for (const key of (expiring ?? []).map((r) => r.item_key).filter((k) => ["drivers_license", "vehicle_insurance", "general_liability", "pe_license_card", "drone_license"].includes(k))) {
    const dated = await staff({ action: "set_item_dates", onboardingId, itemKey: key, issuedOn: ISSUED, expiresOn: FAR_EXPIRY });
    rec(`${word}: ${key} carries its expiry`, dated.body?.ok === true, dated.body?.error ?? "");
  }

  const checks = role === "engineer" ? [["identity", "us_passport"], ["i9", "list_a_us_passport"]] : [["identity", "drivers_license"]];
  for (const [check, documentType] of checks) {
    const recorded = await staff({ action: "record_verification", onboardingId, check, documentType });
    rec(`${word}: ${check} is recorded as ${documentType}`, recorded.body?.ok === true, recorded.body?.error ?? "");
  }
  if (role !== "engineer") {
    const i9 = await staff({ action: "record_verification", onboardingId, check: "i9", documentType: "list_a_us_passport" });
    rec("technician: an I-9 is refused for a contractor", i9.status === 400, i9.body?.error ?? "");
  }
  const { data: verified } = await db
    .from("eng_onboardings")
    .select("identity_verified_at, identity_document_type, identity_verified_by, i9_examined_at, i9_document_type, i9_examined_by")
    .eq("id", onboardingId)
    .maybeSingle();
  rec(
    `${word}: the record reads back with the type, who and when`,
    Boolean(verified?.identity_verified_at) && verified?.identity_verified_by === admin.id && verified?.identity_document_type === checks[0][1] &&
      (role === "engineer" ? Boolean(verified?.i9_examined_at) && verified?.i9_examined_by === admin.id : verified?.i9_examined_at === null),
    JSON.stringify(verified),
  );

  if (role === "field_tech") {
    const coverage = await staff({ action: "set_coverage", onboardingId, counties: ["Nueces"], baseCity: "Corpus Christi", baseCounty: "Nueces" });
    rec("technician: coverage is set", coverage.body?.ok === true, coverage.body?.error ?? "");
  } else {
    const missing = await staff({ action: "activate", onboardingId });
    rec("engineer: activation with no license number is refused", missing.status === 400 && /license number/i.test(String(missing.body?.error)), missing.body?.error ?? "");
  }

  const activated = await staff({ action: "activate", onboardingId, ...(role === "engineer" ? { licenseNumber: LICENCE } : {}) });

  /*
   * THE TECHNICIAN STOPS AT THE ACADEMY, Robert's ruling P3 with his answer of
   * 2026-11-02 (Q2, "accepted; merge P3 after P1's walk"): a field technician is
   * enrolled only after graduating from both required courses. This probe
   * records no quiz attempt, so it has graduated from nothing whatever state the
   * courses are in, and the refusal is the only right answer in every state of
   * the academy, approved or not. P1's own board (bundle 73) walked a
   * technician to activated before this gate existed; from here the walk proves
   * the gate holds at the door, and that the refusal created nobody.
   */
  if (role === "field_tech") {
    rec(
      "technician: activation is refused until both training courses are graduated",
      activated.body?.ok === false && /not graduated from both required training courses/.test(String(activated.body?.error)) && (activated.body?.blockers ?? []).length > 0,
      [activated.status, activated.body?.error, ...(activated.body?.blockers ?? [])].filter(Boolean).join(" | "),
    );
    const { count: madeProfiles } = await db.from("eng_profiles").select("id", { count: "exact", head: true }).eq("email", email);
    rec("technician: and the refusal created no profile", madeProfiles === 0, `profiles for the probe address: ${madeProfiles}`);
    return;
  }
  if (!rec(`${word}: activation succeeds with no SQL`, activated.body?.ok === true, [activated.body?.error, ...(activated.body?.blockers ?? [])].filter(Boolean).join(" | "))) return;

  const { data: profile } = await db.from("eng_profiles").select("id, role, license_number, coverage_counties").eq("id", activated.body.profileId).maybeSingle();
  rec(
    `${word}: the profile exists with the role${role === "engineer" ? " and the license number" : " and the coverage"}`,
    profile?.role === role && (role === "engineer" ? profile?.license_number === LICENCE : (profile?.coverage_counties ?? []).includes("Nueces")),
    JSON.stringify(profile),
  );
  const { data: credentials } = await db.from("eng_credentials").select("kind, status, expires_on").eq("profile_id", activated.body.profileId);
  const kinds = (credentials ?? []).filter((c) => c.status === "verified").map((c) => c.kind);
  const expected = role === "engineer" ? ["pe_license"] : ["drivers_license", "vehicle_insurance", "w9", "ic_agreement"];
  rec(`${word}: the accepted documents are verified credentials`, expected.every((k) => kinds.includes(k)), kinds.join(", "));
  if (role === "engineer") {
    rec("engineer: the license credential carries the recorded expiry", (credentials ?? []).some((c) => c.kind === "pe_license" && c.expires_on === FAR_EXPIRY), JSON.stringify(credentials));
  }
}

try {
  await walk("field_tech");
  await walk("engineer");
} catch (err) {
  rec("the walk ran to its end", false, err instanceof Error ? err.message : String(err));
} finally {
  await teardown();
}
finish();
