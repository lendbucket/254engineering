/**
 * THE OWNER'S ADMINISTRATOR ACCOUNT SIGNS IN WITHOUT THE SECOND FACTOR, WRITES
 * AN AUDIT ROW EVERY TIME, AND NO OTHER ACCOUNT IS EXEMPT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-owner-signs-in-without-the-second-factor-and-nobody-else-does.mjs
 *
 * Robert's answer 3 of 2026-10-26, 09:49 Central, made with 0093, which
 * requires the factor for every administrator, operations manager and rep. The
 * decision (src/lib/sign-in-factor.ts) is asked every question the session
 * route asks it, with the owner's id PINNED HERE as a literal; then the route
 * is read for the order that matters: the override's audit row is written,
 * refusing on failure, before any session is issued.
 */
import { readFileSync } from "node:fs";

const { signInFactor } = await import("../../src/lib/sign-in-factor.ts");
const { OWNER_OVERRIDE_ACTION } = await import("../../src/lib/owner-override.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const OWNER = "fd2dceac-cb9e-4471-89d5-1b00ab9f25f9";
const OTHER_ADMIN = "11111111-1111-4111-8111-111111111111";
const ask = (over) => signInFactor({ profileId: OWNER, role: "admin", enrolled: false, requirement: "required", ...over });

const owner = ask({});
check(
  "the owner's admin account, not enrolled, under a required role, signs in with a full session and the override named",
  owner.factor === "full" && owner.next === null && owner.ownerOverride === true,
  JSON.stringify(owner),
);
const other = ask({ profileId: OTHER_ADMIN });
check(
  "any other administrator, not enrolled, is sent to enrolment",
  other.factor === "pending" && other.next === "/portal/mfa/enrol" && other.ownerOverride === false,
  JSON.stringify(other),
);
for (const role of ["ops_manager", "rep"]) {
  const r = ask({ profileId: OTHER_ADMIN, role });
  check(`and so is any ${role}`, r.factor === "pending" && r.next === "/portal/mfa/enrol" && !r.ownerOverride, JSON.stringify(r));
}
const ownerIdOtherRole = ask({ role: "ops_manager" });
check("the owner's id under any role but admin is not exempt", ownerIdOtherRole.next === "/portal/mfa/enrol" && !ownerIdOtherRole.ownerOverride, JSON.stringify(ownerIdOtherRole));
check(
  "nothing that resembles the id is exempt",
  [OWNER.toUpperCase(), ` ${OWNER}`, `${OWNER} `, "", "fd2dceac"].every((id) => ask({ profileId: id }).ownerOverride === false),
);
const ownerEnrolled = ask({ enrolled: true });
check("if the owner enrols anyway, he is challenged like anybody enrolled", ownerEnrolled.factor === "pending" && ownerEnrolled.next === "/portal/mfa" && !ownerEnrolled.ownerOverride);
const optional = ask({ profileId: OTHER_ADMIN, requirement: "optional" });
check("an optional role still gets a full session and the offer, unchanged", optional.factor === "full" && optional.offer === "/portal/mfa/enrol" && !optional.ownerOverride);

/* The route: the row is written, refusing on failure, before any session exists. */
const route = readFileSync("src/app/api/portal/session/route.ts", "utf8");
const decideAt = route.indexOf("const decided = signInFactor({");
const overrideAt = route.indexOf("if (ownerOverride) {");
const rowAt = route.indexOf("const used = await writeAuditOrRefuse({", overrideAt);
const refuseAt = route.indexOf("if (!used.ok) return fail(503,", rowAt);
const sessionAt = route.indexOf("const session = issueOpsSession(");
check(
  "the session route decides through signInFactor, and on the override writes its audit row and refuses on failure, before the session is issued",
  decideAt > 0 && overrideAt > decideAt && rowAt > overrideAt && refuseAt > rowAt && sessionAt > refuseAt,
  `decide ${decideAt}, override ${overrideAt}, row ${rowAt}, refuse ${refuseAt}, session ${sessionAt}`,
);
check(
  "and the row names the override under the one override action",
  OWNER_OVERRIDE_ACTION === "owner_override.used" &&
    /action: OWNER_OVERRIDE_ACTION,[\s\S]{0,200}override: "sign_in_second_factor"/.test(route.slice(rowAt, refuseAt)),
);
check("the route writes nothing about the override on any other sign in", (route.match(/sign_in_second_factor/g) ?? []).length === 1);

console.log("");
if (wrong === 0) {
  console.log("PASS: the owner's administrator account signs in without the second factor and writes the audit row; nobody else is exempt.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
