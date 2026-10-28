/**
 * THE OPERATIONS MANAGER KEEPS TECHNICIANS, AND ONLY TECHNICIANS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-operations-manager-keeps-technicians-only.mjs
 *
 * Robert's answer 3 of 2026-10-28 (0104) gave the operations manager
 * profiles.list and profiles.update "for the technician screens", and the
 * reading taken on issue #1 (comment 6470846047) is the narrower one: his
 * profiles.update does not let him onboard, verify or certify anybody but a
 * field technician. The administrator's reach is unchanged. Asked of the one
 * decision every onboarding, credential and certification guard calls,
 * mayOnboardRole, with actors built from DEFAULT_ROLES; then the certification
 * record is read for the guard that routes through it.
 */
import { readFileSync } from "node:fs";

const { mayOnboardRole, WIDE_GRANT_TECHNICIANS_ONLY } = await import("../../src/lib/onboarding-scope.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const actorFor = (role) => ({
  id: `probe-${role}`,
  role,
  status: "active",
  grants: new Set(DEFAULT_ROLES.find((r) => r.key === role)?.grants ?? []),
});
const ops = actorFor("ops_manager");
const admin = actorFor("admin");
const rep = actorFor("rep");

check("the operations manager holds profiles.update (0104), so the narrowing is about something", ops.grants.has("profiles.update"));
check("only the operations manager is narrowed, by name", WIDE_GRANT_TECHNICIANS_ONLY.length === 1 && WIDE_GRANT_TECHNICIANS_ONLY[0] === "ops_manager");

for (const wide of ["profiles.update", "profiles.create"]) {
  check(`ops manager, ${wide}: a field technician, yes`, mayOnboardRole(ops, "field_tech", wide) === true);
  for (const role of ["engineer", "admin", "ops_manager", "rep", "dispatcher"]) {
    check(`ops manager, ${wide}: ${role}, no`, mayOnboardRole(ops, role, wide) === false);
  }
  check(`ops manager, ${wide}: an unreadable role, no`, mayOnboardRole(ops, null, wide) === false);
}
for (const role of ["field_tech", "engineer", "admin"]) {
  check(`administrator, profiles.update: ${role}, yes (unchanged)`, mayOnboardRole(admin, role, "profiles.update") === true);
}
check("the rep onboards nobody", ["field_tech", "engineer"].every((role) => mayOnboardRole(rep, role, "profiles.update") === false));
check("a suspended operations manager onboards nobody", mayOnboardRole({ ...ops, status: "suspended" }, "field_tech", "profiles.update") === false);
check("no actor onboards nobody", mayOnboardRole(null, "field_tech", "profiles.update") === false);

const cert = readFileSync("src/lib/certification-record.ts", "utf8");
check(
  "recording a certification asks mayOnboardRole of the profile's own role",
  /if \(!mayOnboardRole\(actor, await profileRole\(profileId\), "profiles\.update"\)\) \{/.test(cert),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the operations manager keeps field technicians and nobody else, and the administrator's reach is unchanged.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
