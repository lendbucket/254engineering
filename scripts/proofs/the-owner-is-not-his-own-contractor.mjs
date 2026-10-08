/**
 * THE OWNER IS NOT HIS OWN CONTRACTOR, AND NOBODY ELSE IS EXEMPT FROM ANYTHING.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-owner-is-not-his-own-contractor.mjs
 *
 * Operator ruling, 2026-10-06: a field_tech profile for Robert, "an owner
 * exemption in code for the W-9 and contractor agreement, never a credential
 * row for a document that does not exist." OWNER_EXEMPTIONS in
 * src/lib/ops-credentials.ts. The exemption is COUNTED here at one entry and
 * two kinds, because an exemption nobody counts becomes the rule, and both
 * doors that compute dispatch blockers are asserted to pass it.
 */
import { readFileSync } from "node:fs";

const { credentialBlockers, exemptKindsFor, OWNER_EXEMPTIONS, REQUIRED_FOR_DISPATCH } = await import(
  "../../src/lib/ops-credentials.ts"
);

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const OWNER = "robertreyna88@yahoo.com";
const kinds = (bs) => bs.map((b) => b.kind).sort().join(", ");

check(
  "exactly one exemption, for the owner, of exactly the W-9 and the contractor agreement",
  OWNER_EXEMPTIONS.length === 1 &&
    OWNER_EXEMPTIONS[0].email === OWNER &&
    JSON.stringify([...OWNER_EXEMPTIONS[0].exempt].sort()) === JSON.stringify(["ic_agreement", "w9"]),
  OWNER_EXEMPTIONS.map((o) => `${o.email}: ${o.exempt.join(", ")}`).join("; "),
);

const nobody = credentialBlockers([], new Date(), exemptKindsFor("somebody@example.com"));
check(
  "anybody else with nothing on file is blocked on all four",
  kinds(nobody) === [...REQUIRED_FOR_DISPATCH].sort().join(", "),
  kinds(nobody),
);

const owner = credentialBlockers([], new Date(), exemptKindsFor(OWNER));
check(
  "the owner with nothing on file is blocked on his licence and vehicle insurance only",
  kinds(owner) === "drivers_license, vehicle_insurance",
  kinds(owner),
);
check("however the address is typed", JSON.stringify(exemptKindsFor(" RobertReyna88@Yahoo.com ")) === JSON.stringify(exemptKindsFor(OWNER)));
check("and no address exempts nothing", exemptKindsFor(null).length === 0 && exemptKindsFor("").length === 0);

for (const [file, call] of [
  ["src/lib/ops-onboarding.ts", "exemptKindsFor(emails.get(id))"],
  ["src/app/portal/(app)/certification/page.tsx", "exemptKindsFor(actor!.email)"],
]) {
  check(`${file} passes the exemption to the blockers`, readFileSync(file, "utf8").includes(call), call);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the owner is not his own contractor, and nobody else is exempt from anything.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
