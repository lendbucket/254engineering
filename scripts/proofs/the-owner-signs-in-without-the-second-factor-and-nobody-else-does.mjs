/**
 * THE OWNER'S TWO ACCOUNTS SIGN IN WITHOUT THE SECOND FACTOR, WRITE AN AUDIT
 * ROW EVERY TIME, AND NO OTHER ACCOUNT IS EXEMPT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-owner-signs-in-without-the-second-factor-and-nobody-else-does.mjs
 *
 * Robert's answer 3 of 2026-10-26, 09:49 Central, made with 0093, which
 * requires the factor for every administrator, operations manager and rep, for
 * his administrator account; and his ruling of 2026-10-28, 08:54 Central, made
 * with 0103, which requires it for every field technician, for his field
 * technician profile. The decision (src/lib/sign-in-factor.ts) is asked every
 * question the session route asks it, with both of the owner's ids PINNED HERE
 * as literals; then the route is read for the order that matters: the
 * override's audit row is written, refusing on failure, before any session is
 * issued.
 */
import { readFileSync } from "node:fs";

const { signInFactor } = await import("../../src/lib/sign-in-factor.ts");
const { OWNER_OVERRIDE_ACTION, SIGN_IN_OVERRIDE_RECORD } = await import("../../src/lib/owner-override.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const OWNER = "fd2dceac-cb9e-4471-89d5-1b00ab9f25f9";
const OWNER_TECH = "c9d46cd2-9ee3-4479-9768-2b27e13c0044";
const OTHER = "11111111-1111-4111-8111-111111111111";
const ask = (over) => signInFactor({ profileId: OWNER, role: "admin", enrolled: false, requirement: "required", ...over });

/* ---- the administrator account, 2026-10-26 ---- */
const owner = ask({});
check(
  "the owner's admin account, not enrolled, under a required role, signs in with a full session and the override named",
  owner.factor === "full" && owner.next === null && owner.ownerOverride === "sign_in_second_factor",
  JSON.stringify(owner),
);
const other = ask({ profileId: OTHER });
check(
  "any other administrator, not enrolled, is sent to enrolment",
  other.factor === "pending" && other.next === "/portal/mfa/enrol" && other.ownerOverride === null,
  JSON.stringify(other),
);
for (const role of ["ops_manager", "rep", "field_tech"]) {
  const r = ask({ profileId: OTHER, role });
  check(`and so is any ${role}`, r.factor === "pending" && r.next === "/portal/mfa/enrol" && r.ownerOverride === null, JSON.stringify(r));
}
const ownerIdOtherRole = ask({ role: "ops_manager" });
check("the owner's admin id under any role but admin is not exempt", ownerIdOtherRole.next === "/portal/mfa/enrol" && ownerIdOtherRole.ownerOverride === null, JSON.stringify(ownerIdOtherRole));
check("and the owner's admin id under field_tech is not exempt either", ask({ role: "field_tech" }).ownerOverride === null);

/* ---- the field technician profile, 2026-10-28 ---- */
const tech = ask({ profileId: OWNER_TECH, role: "field_tech" });
check(
  "the owner's technician profile, not enrolled, under the required field_tech role, signs in with a full session and its own override named",
  tech.factor === "full" && tech.next === null && tech.ownerOverride === "sign_in_second_factor_tech",
  JSON.stringify(tech),
);
check("the owner's technician id under admin is not exempt", ask({ profileId: OWNER_TECH }).ownerOverride === null);
check("nor under any other required role", ["ops_manager", "rep", "engineer"].every((role) => ask({ profileId: OWNER_TECH, role }).ownerOverride === null));

check(
  "nothing that resembles either id is exempt",
  [OWNER, OWNER_TECH].every((id) =>
    [id.toUpperCase(), ` ${id}`, `${id} `, "", id.slice(0, 8)].every(
      (near) => ask({ profileId: near }).ownerOverride === null && ask({ profileId: near, role: "field_tech" }).ownerOverride === null,
    ),
  ),
);
const ownerEnrolled = ask({ enrolled: true });
const techEnrolled = ask({ profileId: OWNER_TECH, role: "field_tech", enrolled: true });
check(
  "if either enrols anyway, he is challenged like anybody enrolled",
  [ownerEnrolled, techEnrolled].every((r) => r.factor === "pending" && r.next === "/portal/mfa" && r.ownerOverride === null),
);
const optional = ask({ profileId: OTHER, requirement: "optional" });
check("an optional role still gets a full session and the offer, unchanged", optional.factor === "full" && optional.offer === "/portal/mfa/enrol" && optional.ownerOverride === null);

/* ---- the record each writes, pinned here ---- */
check(
  "each sign in override carries its own ruling date",
  SIGN_IN_OVERRIDE_RECORD.sign_in_second_factor.ruledOn === "2026-10-26" &&
    SIGN_IN_OVERRIDE_RECORD.sign_in_second_factor_tech.ruledOn === "2026-10-28" &&
    Object.keys(SIGN_IN_OVERRIDE_RECORD).length === 2,
  JSON.stringify(SIGN_IN_OVERRIDE_RECORD),
);

/* ---- the route: the row is written, refusing on failure, before any session exists ---- */
const route = readFileSync("src/app/api/portal/session/route.ts", "utf8");
const decideAt = route.indexOf("const decided = signInFactor({");
const overrideAt = route.indexOf("if (ownerOverride) {");
const rowAt = route.indexOf("const used = await writeAuditOrRefuse({", overrideAt);
const refuseAt = route.indexOf("if (!used.ok) return fail(503,", rowAt);
const sessionAt = route.indexOf("const session = issueOpsSession(");
check(
  "the session route decides through signInFactor, and on an override writes its audit row and refuses on failure, before the session is issued",
  decideAt > 0 && overrideAt > decideAt && rowAt > overrideAt && refuseAt > rowAt && sessionAt > refuseAt,
  `decide ${decideAt}, override ${overrideAt}, row ${rowAt}, refuse ${refuseAt}, session ${sessionAt}`,
);
check(
  "and the row names which override, under the one override action, from the declaration",
  OWNER_OVERRIDE_ACTION === "owner_override.used" &&
    /action: OWNER_OVERRIDE_ACTION,[\s\S]{0,300}override: ownerOverride,/.test(route.slice(rowAt, refuseAt)) &&
    /SIGN_IN_OVERRIDE_RECORD\[ownerOverride\]/.test(route.slice(overrideAt, rowAt)),
);
check("the route types no override name of its own", !/"sign_in_second_factor(_tech)?"/.test(route));

console.log("");
if (wrong === 0) {
  console.log("PASS: the owner's two accounts sign in without the second factor and write the audit row; nobody else is exempt.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
