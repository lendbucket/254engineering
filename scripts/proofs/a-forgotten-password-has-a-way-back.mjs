/**
 * A FORGOTTEN PASSWORD HAS A WAY BACK, AND THE WAY BACK TELLS NOBODY WHO HOLDS
 * AN ACCOUNT.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-forgotten-password-has-a-way-back.mjs
 *
 * WHAT IT PROVES, AND WHY THE FIRST ONE IS THE POINT.
 *
 * Until 2026-09-29 `reset_password` was a declared token purpose that NOTHING
 * ANYWHERE MINTED. The type compiled, the table's check constraint allowed it,
 * `/account/set-password` worked, and `setCustomerPassword` spends a token of
 * either purpose without caring which. Every piece was in place except the one
 * that issues the token, so a customer who forgot their password had no route
 * back into the account they had bought through, and nobody at the firm could
 * send them one either.
 *
 * That is the dormant register shape CLAUDE.md records twice: a capability
 * declared and never exercised, invisible from every direction because nothing
 * about it looks wrong. The first check below is the one that would have gone
 * red on the day the purpose was declared, and it is the reason this file
 * exists rather than the reason it is thorough.
 *
 * THE SECOND GROUP IS THE ENUMERATION ORACLE, which is the hazard a recovery
 * form carries that a sign in form does not. "That address has no account" is a
 * complete answer to the question an attacker is actually asking, so the route
 * must answer identically for an address that holds an account, one that holds
 * a suspended account, one that holds nothing, and one that was rate limited.
 * Proved by counting the shapes the route can answer with rather than by
 * driving it, because a driven test can only visit the cases somebody thought
 * to drive.
 *
 * WHY SOURCE ANALYSIS AND NOT A LIVE WALK. A live walk needs a server and a
 * database and proves the four cases it was given. What can go wrong here is a
 * FIFTH branch added later that answers differently, and only reading every
 * success response in the file can see that. The live half is covered by the
 * browser audits, which discover this screen from the surface inventory.
 *
 * INJECTION VERIFIED. Every check below has been made to fail by editing the
 * thing it names, and the run was read for WHICH checks went red rather than
 * only for whether it failed.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const read = (p) => readFileSync(p, "utf8");

/** Every .ts and .tsx under src, so a mint added anywhere is found. */
function sourceFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

const FILES = sourceFiles("src");

/* ------------------------------------------------------------------ 1. mint */

/*
 * THE CHECK THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT.
 *
 * It looks for a CALL that passes "reset_password" to issueCustomerToken, not
 * for the string anywhere: the string appears in the type union, in three
 * migrations and in the staff and partner issuers, and a check matching the
 * string would have been green for the whole time the capability was dead.
 * That is the matcher lesson, which this repository has now recorded five
 * times: match the thing you mean.
 */
const minters = FILES.filter((f) => {
  const src = read(f);
  return /issueCustomerToken\(\s*[^)]*?,\s*["']reset_password["']/s.test(src);
});

rec(
  "something mints a reset_password token for a CUSTOMER",
  minters.length > 0,
  minters.length > 0
    ? minters.map((f) => f.replace(/^src\//, "")).join(", ")
    : "the purpose is declared and nothing issues it, which is the state this proof exists to prevent",
);

/*
 * AND IT IS REACHED. A minting function nothing calls is the same dormant
 * capability one level up, and it is exactly how this would come back: somebody
 * deletes the route and leaves the library function behind.
 */
const RESET_ISSUER = "issueResetForAccount";
const callers = FILES.filter(
  (f) =>
    f !== "src/lib/account-creation.ts" &&
    new RegExp(`\\b${RESET_ISSUER}\\s*\\(`).test(read(f)),
);
rec(
  "and at least one route calls it, so the capability is reachable",
  callers.length > 0,
  callers.map((f) => f.replace(/^src\//, "")).join(", ") || "nothing calls it",
);

/*
 * BOTH DOORS EXIST. The operator asked for a self service route AND a way for
 * staff to send one, and they are different routes with different answers. A
 * check that only counted callers would pass with one of the two deleted.
 */
rec(
  "the customer can ask for one themselves",
  callers.includes("src/app/api/account/forgot-password/route.ts"),
  "a customer who cannot sign in is the person who needs this",
);
rec(
  "and a member of staff can send one on the telephone",
  callers.includes("src/app/api/portal/accounts/reset-password/route.ts"),
  "before this existed, the answer to a customer who could not get in was to open a second account",
);

/* --------------------------------------------------- 2. the public sentence */

const PUBLIC_ROUTE = "src/app/api/account/forgot-password/route.ts";
const publicSrc = read(PUBLIC_ROUTE);

/*
 * EVERY SUCCESS RESPONSE SAYS THE SAME THING.
 *
 * Counted rather than eyeballed: the route may answer ok:true from several
 * branches, the honeypot, the rate limit, the mint, and the miss, and the
 * property that matters is that a caller cannot tell which one they got. So
 * every `message:` on a success response must be the one constant.
 *
 * It asserts the COUNT of distinct message expressions is one, which is a
 * fact that can go false when somebody adds a fifth branch with a helpful
 * sentence in it. A check that merely asserted the constant exists could not.
 */
const successMessages = [...publicSrc.matchAll(/ok:\s*true,\s*message:\s*([A-Za-z_][\w.]*)/g)].map(
  (m) => m[1],
);
const distinct = [...new Set(successMessages)];
rec(
  "every success answer on the public route is the same sentence",
  successMessages.length >= 3 && distinct.length === 1,
  `${successMessages.length} success responses, ${distinct.length} distinct message(s): ${distinct.join(", ") || "none"}`,
);

/*
 * AND IT NEVER SAYS WHAT IT FOUND. These are the words a helpful future edit
 * reaches for, and any of them turns the form into the address oracle the rest
 * of this is built to prevent.
 */
const TELLS = [
  /no account/i,
  /not found/i,
  /does not exist/i,
  /unknown address/i,
  /suspended/i,
  /too many/i,
  /rate limit(?!ed, and)/i,
];
const said = TELLS.filter((p) => p.test(publicSrc.replace(/\/\*[\s\S]*?\*\//g, "")));
rec(
  "and the public route's code says nothing about what it found",
  said.length === 0,
  said.length === 0
    ? "no branch names an account, a suspension or a limit"
    : `${said.length} disclosing phrase(s) outside comments`,
);

/*
 * NO TOKEN LEAVES ON THE RESPONSE, on either route. The link is a credential;
 * the mailbox is the channel, and returning the token would make the form its
 * own bypass.
 */
const staffSrc = read("src/app/api/portal/accounts/reset-password/route.ts");
const leaks = [];
for (const [name, src] of [
  ["the public route", publicSrc],
  ["the staff route", staffSrc],
]) {
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/NextResponse\.json\([^)]*\btoken\b/s.test(body)) leaks.push(name);
}
rec(
  "neither route returns the token to its caller",
  leaks.length === 0,
  leaks.join(", ") || "the mailbox is the only channel, which is the whole mechanism",
);

/* ------------------------------------------------- 3. the suspended account */

const creation = read("src/lib/account-creation.ts");
const issuerBody = creation.slice(
  creation.indexOf(`export async function ${RESET_ISSUER}`),
  creation.indexOf(`export async function ${RESET_ISSUER}`) + 1400,
);
rec(
  "a suspended account is refused a reset link",
  /status === "suspended"\)\s*return null;/.test(issuerBody),
  "mailing a working link into an account somebody closed would be this door undoing another one",
);

/*
 * AND THE REFUSAL IS INDISTINGUISHABLE FROM A MISS, which is why it returns
 * null rather than a reason. A caller that cannot see the difference cannot
 * leak it, even by accident.
 */
rec(
  "and it refuses by returning null, so no caller can tell it apart from no account",
  /Promise<\{ token: string; displayName: string; customerUserId: string \} \| null>/.test(
    issuerBody,
  ),
  "the two states arrive at the caller as one value",
);

/* ------------------------------ 4. recovery is not gated on the sign up flag */

/*
 * THIS IS A PIN ON A DECISION, NOT A BUG CHECK.
 *
 * /api/account/sign-up refuses with a 404 when `selfServiceSignUpOpen()` is
 * false, and copying that line into the recovery route is the obvious,
 * reasonable thing for a later reader to do. It would mean the operator
 * closing public sign up silently locked every existing customer out of their
 * own password, which is not what that condition says and is not what anybody
 * would intend by setting it.
 *
 * So the absence is asserted, and if somebody means to change it they will
 * have to come here and say so.
 */
rec(
  "password recovery is not gated on the sign up condition",
  !/selfServiceSignUpOpen/.test(publicSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
  "that condition governs NEW accounts; everybody reaching this route already has one",
);

/* ------------------------------------------------------ 5. the staff side */

rec(
  "the staff route requires a signed in actor and the accounts permission",
  /currentActor\(\)/.test(staffSrc) && /can\(actor,\s*"accounts\.manage"\)/.test(staffSrc),
  "it mails a live credential to an address of the caller's choosing",
);

rec(
  "and it records which member of staff caused the link to be sent",
  /writeAudit\(\{[\s\S]{0,400}?reset_link_sent_by_staff/.test(staffSrc),
  "the question asked afterwards about every link not requested by its own holder",
);

/* ------------------------------------------------------------------ verdict */

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A forgotten password has a way back, and it tells nobody who holds an account.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
