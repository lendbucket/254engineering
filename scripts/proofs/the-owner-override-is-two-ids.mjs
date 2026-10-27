/**
 * THE OWNER OVERRIDE IS TWO USER IDS, AND NO OTHER ACCOUNT REACHES IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-owner-override-is-two-ids.mjs
 *
 * Operator ruling, 2026-10-19 (src/lib/owner-override.ts). The owner's
 * administrator id re-enters his password in place of the authenticator code on
 * a job at no charge; the owner's field technician id is not held to the driver
 * licence and vehicle insurance at dispatch. Every use is recorded through
 * writeAuditOrRefuse, and /portal/launch shows both.
 *
 * The ids are PINNED HERE AS LITERALS, never imported as the expectation, so a
 * drifted constant reads as drifted: changing either, or adding a third, costs
 * this file and the declaration, each on purpose. The injections the ruling
 * asked for are the probe ids below: a second administrator and a second
 * technician take the same paths and are refused. Probe ids only; the real
 * ids do not exist in development, so the override is inert there.
 */
import { readFileSync } from "node:fs";

const { OWNER_OVERRIDE, OWNER_OVERRIDES, OWNER_OVERRIDE_ACTION, isOwnerAdmin, isOwnerFieldTech } = await import(
  "../../src/lib/owner-override.ts"
);
const { credentialBlockers, exemptKindsFor, REQUIRED_FOR_DISPATCH, OWNER_OVERRIDE_KINDS } = await import(
  "../../src/lib/ops-credentials.ts"
);
const { noChargeRefusal } = await import("../../src/lib/job-intake-rules.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ADMIN = "fd2dceac-cb9e-4471-89d5-1b00ab9f25f9";
const TECH = "c9d46cd2-9ee3-4479-9768-2b27e13c0044";
const PROBE_ADMIN = "11111111-1111-4111-8111-111111111111";
const PROBE_TECH = "22222222-2222-4222-8222-222222222222";
const kinds = (bs) => bs.map((b) => b.kind).sort().join(", ");

/* ---- the declaration, counted ---- */
check(
  "the declaration holds exactly the two ids read from production, and the ruling date",
  OWNER_OVERRIDE.adminUserId === ADMIN && OWNER_OVERRIDE.fieldTechUserId === TECH && OWNER_OVERRIDE.ruledOn === "2026-10-19" &&
    Object.keys(OWNER_OVERRIDE).length === 3,
  JSON.stringify(OWNER_OVERRIDE),
);
/* Three since Robert's answer 3 of 2026-10-26 (0093): the sign in second factor, on the same admin id. */
check(
  "exactly three overrides are declared: the no-charge password, the dispatch credentials, and the sign in second factor",
  OWNER_OVERRIDES.length === 3 &&
    OWNER_OVERRIDES.map((o) => o.key).join(",") === "no_charge_password,dispatch_credentials,sign_in_second_factor",
);
check("the waived kinds are exactly the licence and the vehicle insurance", [...OWNER_OVERRIDE_KINDS].sort().join(", ") === "drivers_license, vehicle_insurance");
check("every use is recorded under one action", OWNER_OVERRIDE_ACTION === "owner_override.used");

/* ---- the predicates match one id each, and nothing that resembles it ---- */
check("the admin id is the owner's admin, and not his technician", isOwnerAdmin(ADMIN) && !isOwnerFieldTech(ADMIN));
check("the technician id is the owner's technician, and not his admin", isOwnerFieldTech(TECH) && !isOwnerAdmin(TECH));
check(
  "a second administrator, a second technician, an empty or a missing id match neither",
  [PROBE_ADMIN, PROBE_TECH, "", null, undefined, ADMIN.toUpperCase(), ` ${ADMIN}`].every((id) => !isOwnerAdmin(id) && !isOwnerFieldTech(id)),
);

/* ---- INJECTION 1: a second administrator takes the no-charge password path ---- */
const ask = (over) =>
  noChargeRefusal({
    actorId: ADMIN,
    actorRole: "admin",
    reason: "The owner's own property, inspected at no charge.",
    paymentIntent: "released_unpaid",
    code: null,
    password: "a-password",
    ...over,
  });
check("the owner's admin id with a password and no code passes the rule", ask({}) === null, ask({}) ?? "");
check("the owner's admin id with no password is refused", ask({ password: null }) !== null && ask({ password: "" }) !== null);
check(
  "a second administrator with a password and no code is refused, and told to use the code",
  /authenticator/.test(ask({ actorId: PROBE_ADMIN }) ?? ""),
  ask({ actorId: PROBE_ADMIN }) ?? "allowed",
);
check("the owner's id under any other role is still refused", ask({ actorRole: "sales" }) !== null && ask({ actorRole: "field_tech" }) !== null);
check("the owner's TECHNICIAN id does not open the admin path", ask({ actorId: TECH }) !== null);

/* ---- INJECTION 2: a second technician takes the dispatch credentials path ---- */
const all = [...REQUIRED_FOR_DISPATCH].sort().join(", ");
check("a second technician with nothing on file is blocked on all four", kinds(credentialBlockers([], new Date(), exemptKindsFor("probe@audit-probe.invalid", PROBE_TECH))) === all);
check(
  "the owner's technician id with nothing on file, and his address, is blocked on nothing",
  kinds(credentialBlockers([], new Date(), exemptKindsFor("robertreyna88@yahoo.com", TECH))) === "",
);
check(
  "the owner's technician id under another address is blocked on the W-9 and agreement only",
  kinds(credentialBlockers([], new Date(), exemptKindsFor("probe@audit-probe.invalid", TECH))) === "ic_agreement, w9",
);
check(
  "the owner's ADMIN id gets nothing at dispatch",
  kinds(credentialBlockers([], new Date(), exemptKindsFor("probe@audit-probe.invalid", ADMIN))) === all,
);

/* ---- where it is read, and where it is never read ---- */
const src = (f) => readFileSync(f, "utf8");
const field = src("src/lib/ops-field.ts");
const send = field.slice(field.indexOf("export async function sendOffers("));
const overrideAt = send.indexOf("for (const id of techIds.filter((t) => isOwnerFieldTech(t))) {");
const refuseAt = send.indexOf("if (!used.ok) return { ok: false, error: used.error };");
const upsertAt = send.indexOf('await db.from("eng_assignments").upsert(rows');
check(
  "sendOffers records a relied-on override, refusing on failure, before any offer is written",
  overrideAt > 0 && refuseAt > overrideAt && upsertAt > refuseAt,
  `override ${overrideAt}, refuses ${refuseAt}, offers written ${upsertAt}`,
);
check("and an override that cannot be checked sends nothing", /if \(reliedOn === null\) return \{ ok: false/.test(send));
for (const f of ["src/lib/letter-seal.ts", "src/lib/protocol-sign.ts", "src/lib/seal-store.ts", "src/lib/ops-mfa.ts"]) {
  check(`${f} never reads the override`, !/owner-override|isOwnerAdmin|OWNER_OVERRIDE/.test(src(f)));
}
const launch = src("src/app/portal/(app)/launch/page.tsx");
check("/portal/launch renders every declared override as active", /OWNER_OVERRIDES\.map\(/.test(launch) && /label="Active"/.test(launch));

console.log("");
if (wrong === 0) {
  console.log("PASS: the owner override is two ids, recorded on every use, and no other account reaches it.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
