/**
 * A PROFILE LINKED TO AN EXISTING LOGIN IS RECORDED AS LINKED, NOT INVITED.
 *
 *   node scripts/proofs/a-linked-login-is-recorded-as-linked.mjs
 *
 * Operator ruling 4 of 2026-10-07. createAccount (src/lib/ops-auth.ts) has two
 * outcomes: a new address gets an auth user, status invited and a one time set
 * password link; an address that already has a login on the shared project is
 * linked, ACTIVE at once, with no link. The People route wrote status invited
 * and an invite delivery into the profile.create audit diff for both, so the
 * permanent trail contradicted the row the first time it mattered: Robert's
 * technician profile on production, 2026-10-07.
 *
 * The decision lives in the route's two diff literals, so this reads them: the
 * linked branch must record active and linked_to_existing_login and must not
 * name an invite delivery; the new-address branch keeps invited and its
 * delivery. And the status each branch records must be the status createAccount
 * actually writes, read from ops-auth.ts rather than assumed.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const route = readFileSync("src/app/api/portal/people/route.ts", "utf8");
const at = route.indexOf('action: "profile.create"');
check("the route still writes the profile.create audit event", at > 0);
const block = route.slice(at, route.indexOf("ip,", at));
const diffAt = block.indexOf("diff: created.linked");
check("the diff is decided by whether the account was linked", diffAt > 0);

/* The two branches of the ternary: "? {" opens the linked one, a line starting ": {" opens the other. */
const linkedStart = block.indexOf("? {", diffAt);
const sep = block.slice(linkedStart).search(/\n\s*: \{/);
const newStart = sep < 0 ? -1 : linkedStart + sep;
const linked = newStart < 0 ? "" : block.slice(linkedStart, newStart);
const fresh = newStart < 0 ? "" : block.slice(newStart);
check("both branches were found", linkedStart > 0 && newStart > linkedStart);

check("a linked profile is recorded active", /status: \{ from: null, to: "active" \}/.test(linked), linked.replace(/\s+/g, " ").slice(0, 120));
check("and as linked to an existing login", /linked_to_existing_login: \{ from: null, to: true \}/.test(linked));
check("and names no invite delivery, because no link was issued", !/invite_delivery/.test(linked));
check("a new address is still recorded invited", /status: \{ from: null, to: "invited" \}/.test(fresh));
check("with how its invite was delivered", /invite_delivery/.test(fresh));
check("and the linked summary says it was linked, not created", /an existing login/.test(block) && /no invite link was issued/.test(block));

/* The statuses recorded must be the ones createAccount writes. */
const auth = readFileSync("src/lib/ops-auth.ts", "utf8");
check(
  "createAccount writes active for an existing login and invited for a new one",
  /status: existingUserId \? "active" : "invited"/.test(auth),
  "if this moves, the recorded statuses above are describing a different rule",
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a linked login is recorded as linked, and a new one as invited.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
