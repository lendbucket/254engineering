/**
 * W3 ROUND 2, 2026-10-28: THE ONBOARDING INVITE IS EMAILED, AND THE
 * CERTIFICATION REFUSAL SAYS WHO CAN ACTUALLY DO IT.
 *
 *   node scripts/proofs/the-onboarding-invite-is-emailed-and-the-licence-refusal-is-true.mjs
 *
 * 254-WF-016 step 3: the onboardingInvite template existed and nothing sent it,
 * so every link was carried by hand. inviteFromApplication now queues it by
 * default, and hands the link back only when it is delivered by hand or the
 * email could not be queued: eng_onboardings holds only the hash, so a link
 * nobody holds is a dead invite, and a link handed back beside a sent email is
 * a credential in a second place for no reason.
 *
 * 254-WF-017 step 6: revokeCertification and restoreCertification refuse
 * everybody but the licensed role (holdsLicence), and both said "an engineer or
 * an administrator", telling an administrator he could do what the line above
 * refuses him. They now give licenceRefusal, as every other licensed action does.
 *
 * Read from the source, because both properties are about what a function
 * returns on a path no fixture here can reach without a database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const body = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`);
  const next = src.indexOf("\nexport ", at + 10);
  return at < 0 ? "" : src.slice(at, next < 0 ? undefined : next);
};

const onboarding = readFileSync("src/lib/ops-onboarding.ts", "utf8");
const invite = strip(body(onboarding, "inviteFromApplication"));
check("the invite function is found", invite.length > 0);
check("by default the link goes by email", /const deliverBy = input\.deliverBy === "hand" \? "hand" : "email";/.test(invite));
check("and the email is the onboardingInvite template, queued", /await queueEmail\(\s*onboardingInvite\(\{/.test(invite));
check(
  "an emailed invite hands back no link",
  /\? \{ ok: true, onboardingId: created\.data\.onboarding\.id, delivered: "email", sentTo: app\.email \}/.test(invite),
);
check(
  "the link comes back only when it goes by hand or the email could not be queued",
  /const emailed = deliverBy === "email" && !emailFailed;/.test(invite) &&
    /: \{ ok: true, onboardingId: created\.data\.onboarding\.id, delivered: "hand", token: created\.data\.token/.test(invite),
);
const audit = /summary: `Invited \$\{app\.name\}[\s\S]*?`,\n/.exec(invite)?.[0] ?? "";
check("the audit row says how the link went out", /queued by email/.test(audit) && /handed to/.test(audit), audit ? "" : "summary not found");
check("and never carries the link", audit.length > 0 && !/token/.test(audit));

const route = strip(readFileSync("src/app/api/portal/onboarding/route.ts", "utf8"));
const branch = route.slice(route.indexOf('if (action === "invite_from_application")'), route.indexOf('if (action === "set_item_dates")'));
check("the route passes the choice through", /deliverBy: body\?\.deliverBy === "hand" \? "hand" : "email"/.test(branch));
check(
  "and returns a link only on the by-hand branch",
  /result\.delivered === "email"\s*\? NextResponse\.json\(\{ ok: true, onboardingId: result\.onboardingId, delivered: "email", sentTo: result\.sentTo \}\)/.test(branch) &&
    (branch.match(/token:/g) ?? []).length === 1,
);

const field = strip(readFileSync("src/lib/ops-field.ts", "utf8"));
for (const [name, what] of [
  ["revokeCertification", "Withdrawing a certification"],
  ["restoreCertification", "Restoring a certification"],
]) {
  const fn = body(field, name);
  check(`${name} refuses with the licence sentence`, fn.includes(`licenceRefusal("${what}")`));
  check(`and no longer tells an administrator he may`, fn.length > 0 && !/or an administrator/.test(fn));
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the onboarding invite is emailed unless sent by hand, and the certification refusal names who can act.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
