// @runtime react-server
/**
 * THE FRANCHISE SEED: ONE DEMONSTRATION FRANCHISEE ON DEVELOPMENT, ONCE.
 *
 *   npx tsx --conditions=react-server scripts/seed-franchise-demo.mjs
 *
 * Robert's order of 2026-11-12, item 1: "one demonstration franchisee, Demo
 * names and example.com, holding one territory with a member, a recorded
 * agreement and certificates, so the browser audits finally open the
 * onboarding panel, the agreement and certificate forms, the statement panel
 * and its CSV." X4 and X6 named the gap: every franchise screen on development
 * rendered its empty state, so every audit that walked it measured an empty
 * screen (BACKLOG.md, "THE FRANCHISE SCREENS ARE NOT YET SWEPT FIGURE
 * SURFACES").
 *
 * DEVELOPMENT ONLY, and refused anywhere else before a client exists
 * (neverProduction). Nothing here touches production, and nothing is public:
 * the franchisee screens are staff and administrator only.
 *
 * IDEMPOTENT. Every step looks for what it would make and makes it only when
 * absent, so a second run changes nothing and says so. Several of the rows it
 * writes cannot be deleted (a certificate is withdrawn, never deleted; a
 * holding and a membership are ended, never deleted; every step writes an
 * audit row), which is why it runs once and is not a teardown fixture.
 *
 * MADE THROUGH THE PRODUCT, never written by hand: createFranchisee,
 * saveOffice, setFranchiseeTerritory, setFranchiseeMember, recordAgreement and
 * recordCertificate, each with its own guards and its own audit row. The one
 * exception is the owner's ACCOUNT, which the product creates only by an
 * emailed invitation; it is made the way scripts/seed-field-demo.mjs makes its
 * demonstration people, an auth user with a random password that is never
 * printed, because nobody signs in as it. The browser audits sign in as a
 * probe owner attached to this franchisee for the run (scripts/lib/
 * franchise-seed.mjs), never as this account.
 *
 * THE RECORDER IS THE DEMONSTRATION ADMINISTRATOR, demo.admin@example.com,
 * which scripts/seed-field-demo.mjs makes. The agreement and every certificate
 * name who recorded them, and naming the operator's own account for a
 * demonstration would put his name on a record he never made.
 *
 * EVERYTHING READS AS A DEMONSTRATION: the legal name starts "Demo", the office
 * is a Demo street on a 555 number, the owner is "Demo Franchise Owner" at
 * example.com marked is_demo, and the carrier and policy numbers say DEMO. The
 * certificate PDFs are one page saying so.
 *
 * THE STATEMENT IS EMPTY, AND THAT IS THE TRUE ANSWER. Its rows are paid orders
 * in the territory's counties, net of refunds, and territory revenue reads
 * only orders that are not demonstrations (territory-revenue.ts). A seeded
 * order would be a demonstration and count for nothing, and a real one cannot
 * be invented. The franchisee stays onboarding, so no technology fee is due
 * either. The panel and its CSV open, and both say nothing is due yet.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { auditClient } from "./lib/db-target.mjs";
import { SEED_FRANCHISEE, SEED_ONBOARDING } from "./lib/franchise-seed.mjs";

const db = auditClient("seed-franchise-demo", { neverProduction: true });
if (!db) {
  console.log("REFUSED: no development database client.");
  process.exit(1);
}

const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");
const { createFranchisee, saveOffice, setFranchiseeTerritory, setFranchiseeMember } = await import("../src/lib/franchisees.ts");
const { recordAgreement, recordCertificate } = await import("../src/lib/franchisee-onboarding.ts");
const { createTerritory, setTerritoryCounties } = await import("../src/lib/crm-territories.ts");

const made = [];
const found = [];
const stop = (why) => {
  console.log(`STOPPED: ${why}`);
  if (made.length) console.log(`Made before stopping:\n  ${made.join("\n  ")}`);
  process.exit(1);
};

// ------------------------------------------------------------- the recorder
const RECORDER_EMAIL = "demo.admin@example.com";
const { data: recorder, error: recorderError } = await db
  .from("eng_profiles")
  .select("id, email, role, status")
  .eq("email", RECORDER_EMAIL)
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();
if (recorderError) stop(`the demonstration administrator could not be read: ${recorderError.message}`);
if (!recorder) stop(`${RECORDER_EMAIL} is not on this database. Run scripts/seed-field-demo.mjs first; it makes the demonstration administrator.`);
if (recorder.role !== "admin" || recorder.status !== "active") stop(`${RECORDER_EMAIL} is ${recorder.role}, ${recorder.status}, not an active administrator.`);
const actor = {
  id: recorder.id,
  email: recorder.email,
  role: "admin",
  status: "active",
  grants: new Set(DEFAULT_ROLES.find((r) => r.key === "admin").grants),
};
found.push(`recorder ${RECORDER_EMAIL} (${recorder.id})`);

// ------------------------------------------------------------- the franchisee
let { data: franchisee } = await db.from("eng_franchisees").select("id, status, office_street, agreement_signed_on").eq("legal_name", SEED_FRANCHISEE.legalName).maybeSingle();
if (!franchisee) {
  const created = await createFranchisee(actor, { legalName: SEED_FRANCHISEE.legalName });
  if (!created.ok) stop(`the franchisee was refused: ${created.error}`);
  made.push(`eng_franchisees: ${SEED_FRANCHISEE.legalName} (${created.id}), onboarding`);
  ({ data: franchisee } = await db.from("eng_franchisees").select("id, status, office_street, agreement_signed_on").eq("id", created.id).single());
} else {
  found.push(`franchisee ${SEED_FRANCHISEE.legalName} (${franchisee.id}, ${franchisee.status})`);
}
const fid = franchisee.id;

// ------------------------------------------------------------------ the office
if (!franchisee.office_street) {
  const saved = await saveOffice(actor, { id: fid, ...SEED_FRANCHISEE.office });
  if (!saved.ok) stop(`the office was refused: ${saved.error}`);
  made.push(`office: ${SEED_FRANCHISEE.office.street}, ${SEED_FRANCHISEE.office.city} ${SEED_FRANCHISEE.office.postalCode}, ${SEED_FRANCHISEE.office.phone}`);
} else {
  found.push(`office ${franchisee.office_street}`);
}

// --------------------------------------------------------------- the territory
const { data: held } = await db.from("eng_franchisee_territories").select("territory_id").eq("franchisee_id", fid).is("ended_at", null);
if ((held ?? []).length) {
  found.push(`${held.length} territory held`);
} else {
  /*
   * Its own demonstration territory, made through the territories screen's
   * writers, rather than one taken from the sales list: development held no
   * territory when this was written (2026-11-12), and a real one handed to a
   * demonstration would move the sales screens' holdings for somebody else.
   */
  const { data: existing, error: tError } = await db.from("eng_crm_territories").select("id, name").eq("name", SEED_FRANCHISEE.territory.name).maybeSingle();
  if (tError) stop(`the territories could not be read: ${tError.message}`);
  let territoryId = existing?.id ?? null;
  if (!territoryId) {
    const created = await createTerritory(actor, { name: SEED_FRANCHISEE.territory.name });
    if (!created.ok) stop(`the territory was refused: ${created.error}`);
    territoryId = created.id;
    made.push(`eng_crm_territories: ${SEED_FRANCHISEE.territory.name} (${territoryId})`);
  } else {
    found.push(`territory ${SEED_FRANCHISEE.territory.name} (${territoryId})`);
  }
  const counties = await setTerritoryCounties(actor, { territoryId, counties: [...SEED_FRANCHISEE.territory.counties] });
  if (!counties.ok) stop(`the territory's counties were refused: ${counties.error}`);
  made.push(`counties: ${counties.said}`);
  const given = await setFranchiseeTerritory(actor, { id: fid, territoryId, holds: true });
  if (!given.ok) stop(`the holding was refused: ${given.error}`);
  made.push(`eng_franchisee_territories: ${SEED_FRANCHISEE.territory.name}`);
}

// ------------------------------------------------------------------- the owner
let { data: owner } = await db.from("eng_profiles").select("id, role, status").eq("email", SEED_FRANCHISEE.owner.email).maybeSingle();
if (!owner) {
  /* eng_profiles.id references auth.users. The password is random and never printed: nobody signs in as this account. */
  const { data: created, error } = await db.auth.admin.createUser({
    id: randomUUID(),
    email: SEED_FRANCHISEE.owner.email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (error || !created?.user) stop(`the owner's account was refused: ${error?.message ?? "no user came back"}`);
  const { error: pError } = await db.from("eng_profiles").insert({
    id: created.user.id,
    email: SEED_FRANCHISEE.owner.email,
    display_name: SEED_FRANCHISEE.owner.name,
    role: "franchisee_owner",
    status: "active",
    is_demo: true,
  });
  if (pError) {
    await db.auth.admin.deleteUser(created.user.id);
    stop(`the owner's profile was refused: ${pError.message}`);
  }
  owner = { id: created.user.id, role: "franchisee_owner", status: "active" };
  made.push(`owner: ${SEED_FRANCHISEE.owner.name}, ${SEED_FRANCHISEE.owner.email} (${owner.id}), franchisee_owner, is_demo`);
} else {
  if (owner.role !== "franchisee_owner") stop(`${SEED_FRANCHISEE.owner.email} is on this database as ${owner.role}, not a franchisee owner.`);
  found.push(`owner ${SEED_FRANCHISEE.owner.email} (${owner.id})`);
}
const { data: membership } = await db.from("eng_franchisee_members").select("franchisee_id").eq("profile_id", owner.id).is("ended_at", null).maybeSingle();
if (membership) {
  if (membership.franchisee_id !== fid) stop(`${SEED_FRANCHISEE.owner.email} belongs to another franchisee (${membership.franchisee_id}).`);
  found.push("owner is a member");
} else {
  const joined = await setFranchiseeMember(actor, { id: fid, profileId: owner.id, belongs: true });
  if (!joined.ok) stop(`the membership was refused: ${joined.error}`);
  made.push(`eng_franchisee_members: ${SEED_FRANCHISEE.owner.name}`);
}

// --------------------------------------------------------------- the agreement
if (franchisee.agreement_signed_on) {
  found.push(`agreement signed ${franchisee.agreement_signed_on}`);
} else {
  const recorded = await recordAgreement(actor, { id: fid, signedOn: SEED_FRANCHISEE.agreementSignedOn });
  if (!recorded.ok) stop(`the agreement was refused: ${recorded.error}`);
  made.push(`agreement: signed ${SEED_FRANCHISEE.agreementSignedOn}`);
}

// ------------------------------------------------------------ the certificates
/** A one page PDF that says what it is. Built by hand so no library is needed; the offsets are computed, not typed. */
function demoPdf(line) {
  const text = `BT /F1 14 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

const { data: certs } = await db.from("eng_franchisee_certificates").select("kind").eq("franchisee_id", fid).is("withdrawn_at", null);
const haveKinds = new Set((certs ?? []).map((c) => c.kind));
for (const c of SEED_FRANCHISEE.certificates) {
  if (haveKinds.has(c.kind)) {
    found.push(`certificate ${c.kind}`);
    continue;
  }
  const pdf = demoPdf(`DEMONSTRATION ONLY. ${c.label} certificate for ${SEED_FRANCHISEE.legalName}. Not insurance.`);
  const recorded = await recordCertificate(
    actor,
    { franchiseeId: fid, kind: c.kind, carrier: SEED_FRANCHISEE.carrier, policyNumber: c.policyNumber, effectiveOn: SEED_FRANCHISEE.effectiveOn, expiresOn: SEED_FRANCHISEE.expiresOn },
    pdf,
  );
  if (!recorded.ok) stop(`the ${c.kind} certificate was refused: ${recorded.error}`);
  made.push(`eng_franchisee_certificates: ${c.kind}, ${c.policyNumber}, ${pdf.length} bytes (${recorded.id})`);
}

// --------------------------------------- the second seed, with nothing recorded
/*
 * Robert's answer 1 of 2026-11-12 (to 6835287178): a demonstration franchisee
 * with nothing recorded, so the agreement form and every unmet step are
 * measured. Made through createFranchisee and nothing else; it must stay empty,
 * and scripts/lib/franchise-seed.mjs reports it as not whole if it gains
 * anything.
 */
{
  const { data: second } = await db.from("eng_franchisees").select("id, status").eq("legal_name", SEED_ONBOARDING.legalName).maybeSingle();
  if (second) {
    found.push(`franchisee ${SEED_ONBOARDING.legalName} (${second.id}, ${second.status})`);
  } else {
    const created = await createFranchisee(actor, { legalName: SEED_ONBOARDING.legalName });
    if (!created.ok) stop(`the second franchisee was refused: ${created.error}`);
    made.push(`eng_franchisees: ${SEED_ONBOARDING.legalName} (${created.id}), onboarding, nothing recorded`);
  }
}

console.log(`\nThe franchise seed on development, ${SEED_FRANCHISEE.legalName} and ${SEED_ONBOARDING.legalName}:`);
console.log(made.length ? `Made:\n  ${made.join("\n  ")}` : "Made: nothing, everything was already there.");
console.log(found.length ? `Found:\n  ${found.join("\n  ")}` : "Found: nothing.");
