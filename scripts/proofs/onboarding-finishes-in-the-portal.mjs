/**
 * ONBOARDING FINISHES IN THE PORTAL. Robert's ruling P1, 2026-11-01 evening
 * (BACKLOG "Technician onboarding cannot finish"):
 *
 *   - an administrator screen to accept or reject each item, a required reason
 *     on reject, an audit row, and the person told by email;
 *   - identity and I-9 recorded as "verified", the document type seen, who and
 *     when, with no copy of any ID or I-9;
 *   - activation records the engineer's license number and expiry, and the
 *     coverage form renders for every role readiness asks counties of;
 *   - the checklist text asks for no photo ID, W-4, I-9 or voided check, and
 *     the completion screen's count is per role.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/onboarding-finishes-in-the-portal.mjs
 *
 * The pure rules are exercised with items handed to them; the order of the
 * acts in the server functions, the screen's use of the shared rules and the
 * text are read from the source. The live walk, invite to activated through
 * the routes, is scripts/onboarding-walk-audit.mjs on the board.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const body = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`);
  if (at < 0) return "";
  const next = src.indexOf("\nexport ", at + 10);
  return src.slice(at, next < 0 ? undefined : next);
};
const pos = (src, re) => {
  const m = re.exec(src);
  return m ? m.index : -1;
};

const { decisionProblem, decisionsOffered } = await import("../../src/lib/onboarding-decision-rules.ts");
const { IDENTITY_DOCUMENT_TYPES, I9_DOCUMENT_TYPES, VERIFICATION_ITEM, verificationItemStatus, checkForItem } = await import("../../src/lib/onboarding-verification.ts");
const { activationReadiness, COVERAGE_REQUIRED_ROLES, licenceNumberProblem } = await import("../../src/lib/ops-credentials.ts");
const { checklists, ONBOARDING_STEPS, firmItemLabels } = await import("../../src/content/onboarding-checklists.ts");
const { allTemplatesForAudit, onboardingItemDecision } = await import("../../src/lib/email-templates.ts");

/* ---------------------------------------------------------------- the decision rule */
const item = (over) => ({ itemKey: "vehicle_insurance", actor: "person", status: "uploaded", ...over });
check("a person's uploaded item may be accepted", decisionProblem(item({}), "accepted", "", false) === null);
check("a rejection with no reason is refused, and says the person is told the reason", /reason/i.test(decisionProblem(item({}), "rejected", "   ", false) ?? ""));
check("a rejection with a reason is allowed", decisionProblem(item({}), "rejected", "The card shown has expired.", false) === null);
check("a person's item with nothing uploaded cannot be accepted", decisionProblem(item({ status: "pending" }), "accepted", "", false) !== null);
check("an operator's item may be accepted while pending: that is him marking it done", decisionProblem(item({ itemKey: "w9", actor: "admin", status: "pending" }), "accepted", "", false) === null);
check("accepting what is accepted is refused, so one decision is one line", decisionProblem(item({ status: "accepted" }), "accepted", "", false) !== null);
check("nothing is decided once the person is activated", /activated/i.test(decisionProblem(item({}), "accepted", "", true) ?? ""));
check("an unknown decision is refused", decisionProblem(item({}), "approved", "", false) !== null);
for (const key of Object.values(VERIFICATION_ITEM)) {
  check(`"${key}" is never decided as an item, only recorded through verification`, /verification/i.test(decisionProblem(item({ itemKey: key, actor: "admin", status: "pending" }), "accepted", "", false) ?? ""));
}
check("the screen is offered exactly what the rule allows: an uploaded item, both", JSON.stringify(decisionsOffered(item({}), false)) === '["accepted","rejected"]');
check("a pending person item, reject only", JSON.stringify(decisionsOffered(item({ status: "pending" }), false)) === '["rejected"]');
check("an activated onboarding, nothing", decisionsOffered(item({}), true).length === 0);

/* ---------------------------------------------------------------- verification: one record, three facts */
check("a record with time, type and verifier makes the item accepted", verificationItemStatus({ at: "2026-11-01T15:00:00Z", type: "us_passport", by: "p" }) === "accepted");
check("a record missing its verifier is pending, never accepted", verificationItemStatus({ at: "2026-11-01T15:00:00Z", type: "us_passport", by: null }) === "pending");
check("an unread record is pending", verificationItemStatus(null) === "pending");
check("the two verification items map to the two checks", checkForItem("identity_verified_video") === "identity" && checkForItem("i9_documents_examined") === "i9" && checkForItem("w9") === null);

const migration = readFileSync("supabase/migrations/0105_identity_and_i9_record_what_was_seen_and_by_whom.sql", "utf8");
const listIn = (constraint) => {
  const at = migration.indexOf(`add constraint ${constraint}`);
  const seg = migration.slice(at, migration.indexOf(")", migration.indexOf(" in (", at)) + 1);
  return [...seg.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};
const sqlIdentity = listIn("eng_onboardings_identity_document_type_known");
const sqlI9 = listIn("eng_onboardings_i9_document_type_known");
check("the identity vocabulary on the screen is the migration's, exactly", JSON.stringify(IDENTITY_DOCUMENT_TYPES.map((d) => d.value)) === JSON.stringify(sqlIdentity), sqlIdentity.join(", "));
check("the I-9 vocabulary on the screen is the migration's, exactly", JSON.stringify(I9_DOCUMENT_TYPES.map((d) => d.value)) === JSON.stringify(sqlI9), sqlI9.join(", "));
check(
  "0105 refuses a timestamp without its type and its verifier, for both checks",
  /\(identity_verified_at is null and identity_document_type is null and identity_verified_by is null\)\s*or \(identity_verified_at is not null and identity_document_type is not null and identity_verified_by is not null\)/.test(migration) &&
    /\(i9_examined_at is null and i9_document_type is null and i9_examined_by is null\)\s*or \(i9_examined_at is not null and i9_document_type is not null and i9_examined_by is not null\)/.test(migration),
);
check("and adds no column for a number, an expiry, a birth date or a file", !/add column if not exists \w*(number|expir|birth|dob|file|image|storage)/i.test(migration));

const adminOnboarding = strip(readFileSync("src/lib/admin-onboarding.ts", "utf8"));
for (const fn of ["recordVerification", "clearVerification"]) {
  const src = body(adminOnboarding, fn);
  const gate = pos(src, /const allowed = await guard\(actor, onboardingId, check\);/);
  const audit = pos(src, /await writeAuditOrRefuse\(\{/);
  const update = pos(src, /\.from\("eng_onboardings"\)\s*\.update\(/);
  check(`${fn}: the role is asked first, the audit row is written before the change`, gate >= 0 && gate < audit && audit < update);
  check(`${fn}: a record that fails stops it`, /if \(!recorded\.ok\) return recorded;/.test(src.slice(audit, update)));
  check(`${fn}: never on an activated onboarding, and says which rows changed`, /\.is\("activated_at", null\)\s*\.select\("id"\);/.test(src.slice(update)));
  check(`${fn}: writes all three facts together`, /\[columns\.at\]: (DB_NOW|null), \[columns\.type\]: (documentType|null), \[columns\.by\]: (actor\.id|null)/.test(src.slice(update)));
}
check("recordVerification refuses a type nobody declared", /if \(!isKnownDocumentType\(check, documentType\)\)/.test(body(adminOnboarding, "recordVerification")));
check("clearVerification needs a reason", /if \(!reason\.trim\(\)\) return \{ ok: false/.test(body(adminOnboarding, "clearVerification")));
check("an I-9 is refused for anybody but an engineer", /if \(check === "i9" && role !== "engineer"\)/.test(adminOnboarding));
check("and the role test is the onboarding's own, with profiles.update", /mayOnboardRole\(actor, role, "profiles\.update"\)/.test(adminOnboarding));

/* ---------------------------------------------------------------- the decision, server side */
const decisions = strip(readFileSync("src/lib/onboarding-decisions.ts", "utf8"));
const decide = body(decisions, "decideOnboardingItem");
{
  const gate = pos(decide, /mayOnboardRole\(actor, onboarding\.role as string, "profiles\.update"\)/);
  const rule = pos(decide, /const problem = decisionProblem\(item, decision, reason, Boolean\(onboarding\.activated_at\)\);/);
  const audit = pos(decide, /await writeAuditOrRefuse\(\{/);
  const write = pos(decide, /await setItemDecision\(\{/);
  const mail = pos(decide, /await queueEmail\(\s*onboardingItemDecision\(\{/);
  check("decideOnboardingItem: role, then the shared rule, then the audit row, then the write, then the email", gate >= 0 && gate < rule && rule < audit && audit < write && write < mail, `${gate} ${rule} ${audit} ${write} ${mail}`);
  check("a write that fails is recorded as failed and refused", /action: `onboarding\.item_\$\{decision\}_failed`/.test(decide) && /return \{ ok: false, error: `"\$\{label\}" was not/.test(decide));
  check("the rejection's reason is what the person's email carries", /reason: decision === "rejected" \? reason\.trim\(\) : null,/.test(decide));
}
const onboardingLib = strip(readFileSync("src/lib/onboarding.ts", "utf8"));
check("setItemDecision says which rows it changed, and a decision on no row fails", /\.eq\("item_key", params\.itemKey\)\s*\.select\("item_key"\);/.test(body(onboardingLib, "setItemDecision")) && /if \(!data\?\.length\) return \{ ok: false/.test(body(onboardingLib, "setItemDecision")));
const callers = ["src/lib/onboarding-decisions.ts"].filter((f) => /setItemDecision\(/.test(strip(readFileSync(f, "utf8"))));
check("setItemDecision has its caller", callers.length === 1);

const mail = onboardingItemDecision({ personName: "P", personEmail: "p@x.invalid", itemLabel: "Vehicle insurance card", decision: "rejected", reason: "Expired." });
check("the decision email names the item and carries the reason, in both parts", mail.text.includes("Vehicle insurance card") && mail.text.includes("Expired.") && (mail.html ?? "").includes("Expired."));
check("and it is rendered by the email audit's inventory", allTemplatesForAudit().some((t) => t.id === "onboarding.item_decision"));
check("it carries no onboarding link, since the token is held only as a hash", !/\/onboarding\//.test(mail.text));

/* ---------------------------------------------------------------- readiness, coverage and the license */
const accepted = (itemKey, actor = "person", expiresOn = "2031-01-31") => ({ itemKey, label: itemKey, status: "accepted", actor, expiresOn });
const engineerItems = [accepted("pe_license_card"), accepted("w4", "admin", null), accepted("identity_verified_video", "admin", null)];
check("the roles readiness asks counties of are the technician alone, written out", JSON.stringify(COVERAGE_REQUIRED_ROLES) === '["field_tech"]');
check("an engineer with his license accepted and dated, and no counties, is ready", activationReadiness(engineerItems, [], new Date("2026-11-01T12:00:00Z"), "engineer").ready);
check("an engineer whose license has no expiry recorded is not", !activationReadiness([{ ...engineerItems[0], expiresOn: null }, ...engineerItems.slice(1)], [], new Date("2026-11-01T12:00:00Z"), "engineer").ready);
check("an engineer whose license is not accepted is not", !activationReadiness([{ ...engineerItems[0], status: "uploaded" }, ...engineerItems.slice(1)], [], new Date("2026-11-01T12:00:00Z"), "engineer").ready);
check("a technician with no counties is still not ready", !activationReadiness([accepted("vehicle_insurance")], [], new Date("2026-11-01T12:00:00Z"), "field_tech").ready);
check("a license number is digits only", licenceNumberProblem("123456") === null && licenceNumberProblem("PE-123456") !== null && licenceNumberProblem("") !== null);

const page = strip(readFileSync("src/app/portal/(app)/onboarding/page.tsx", "utf8"));
check("the screen renders the coverage form for exactly the roles readiness reads", /\{COVERAGE_REQUIRED_ROLES\.includes\(selected\.onboarding\.role\) \? \(/.test(page) && !/selected\.onboarding\.role === "field_tech" \? \(\s*<div[^>]*>\s*<CoverageForm/.test(page));
check("its decision buttons are the shared rule's, and verification items get none", /offered=\{decisionsOffered\(/.test(page) && /\{checkForItem\(item\.itemKey\) \? \(/.test(page));
check("identity for everybody, the I-9 for an engineer only", /selected\.onboarding\.role === "engineer" \? \(\["identity", "i9"\] as const\) : \(\["identity"\] as const\)/.test(page));
check("a failed read of the record is said, not shown as unverified", /!selected\.verification\.ok \? \(/.test(page));

const onboardingOps = strip(readFileSync("src/lib/ops-onboarding.ts", "utf8"));
const activate = body(onboardingOps, "activateTechnician");
check(
  "activation refuses an engineer without a valid license number before any account is made",
  pos(activate, /const problem = licenceNumberProblem\(licenseNumber\);/) >= 0 && pos(activate, /const problem = licenceNumberProblem\(licenseNumber\);/) < pos(activate, /await createAccount\(\{/),
);
check("and puts the number on the profile", /licenseNumber: isEngineer \? licenseNumber : null,/.test(activate));
check("the view reads the role into readiness", /activationReadiness\(items, \(onboarding\.coverage_counties as string\[\]\) \?\? \[\], new Date\(\), role\)/.test(onboardingOps));
check("and derives the two verification items from the record, not their rows", /const status = check\s*\? verificationItemStatus\(verification\.ok \? verification\.record\[check\] : null\)/.test(onboardingOps));
check("a failed verification read makes the person not ready", /verification\.ok\s*\? readiness\s*: \{[\s\S]{0,80}ready: false,/.test(onboardingOps));

const route = strip(readFileSync("src/app/api/portal/onboarding/route.ts", "utf8"));
check("the route carries the three new actions", ['action === "decide_item"', 'action === "record_verification"', 'action === "clear_verification"'].every((s) => route.includes(s)));
check(
  "a working technician's coverage save reaches setTechCoverage, before the onboarding branch can catch it",
  pos(route, /if \(action === "set_coverage" && body\?\.profileId && !body\?\.onboardingId\) \{/) >= 0 &&
    pos(route, /if \(action === "set_coverage" && body\?\.profileId && !body\?\.onboardingId\) \{/) < pos(route, /if \(action === "set_coverage"\) \{/) &&
    (route.match(/action === "set_coverage"/g) ?? []).length === 2,
);

/* ---------------------------------------------------------------- the text */
const asked = Object.values(checklists).flat().filter((i) => i.actor === "person");
const forbiddenAsk = /photo ID|W-4|I-9|W-9|voided check|bank letter|direct deposit/i;
check("no item the person completes asks for a photo ID, a W-4, an I-9, a W-9 or a voided check", asked.every((i) => !forbiddenAsk.test(`${i.label} ${i.help}`)), asked.filter((i) => forbiddenAsk.test(`${i.label} ${i.help}`)).map((i) => i.key).join(", "));
const blurbs = Object.values(ONBOARDING_STEPS).flat();
check("no step blurb asks for an uploaded ID, tax form or check", blurbs.every((s) => !/government issued photo ID|uploaded as (a )?documents?|voided check|bank letter/i.test(s.blurb)), blurbs.map((s) => s.blurb).filter((b) => /photo ID|uploaded as|voided|bank letter/i.test(b)).join(" | "));
check("every blurb that names a tax form says it is in Gusto", blurbs.filter((s) => /W-4|I-9|W-9/.test(s.blurb)).every((s) => /Gusto/.test(s.blurb)));
const flow = strip(readFileSync("src/components/onboarding/OnboardingFlow.tsx", "utf8"));
check("the completion screen types no count and reads the role's operator items", !/Two steps|two steps/.test(flow) && /firmItems\.length/.test(flow) && /firmItems\.map\(/.test(flow));
check("and the invite page hands it firmItemLabels for the person's role", /firmItems=\{firmItemLabels\(onboarding\.role\)\}/.test(strip(readFileSync("src/app/(site)/onboarding/[token]/page.tsx", "utf8"))));
check("an engineer has more operator items than a technician, so a typed count would be wrong for one", firmItemLabels("engineer").length !== firmItemLabels("field_tech").length, `${firmItemLabels("engineer").length} and ${firmItemLabels("field_tech").length}`);
const invite = allTemplatesForAudit().find((t) => t.id === "onboarding.invite");
check("the invite email no longer asks for a photo ID or an uploaded form", invite && !/government issued photo ID|you upload the completed document/i.test(invite.text) && /Gusto/.test(invite.text));

console.log("");
console.log(wrong === 0 ? "PASS: onboarding finishes in the portal: decisions, verification, the license, coverage and the text, per P1." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
