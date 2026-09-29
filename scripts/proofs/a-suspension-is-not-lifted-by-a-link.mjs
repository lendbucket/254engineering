/**
 * A SUSPENSION IS NOT LIFTED BY A LINK, THROUGH ANY DOOR.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-suspension-is-not-lifted-by-a-link.mjs
 *
 * THE DEFECT. `setCustomerPassword` ended with
 *
 *     .update({ password_hash: hash, password_salt: salt, status: "active" })
 *
 * unconditionally. A link issued while an account was active, a suspension, and
 * then the holder opening the link put the row back to `active`. The platform
 * quietly undid a decision a member of staff had made, and nothing said so.
 *
 * THE RULING, 2026-09-29. "A password reset changes the password only, never
 * the account status. A suspended account stays suspended until I lift it. Only
 * an operator action reactivates." And: a suspended person opening a dead link
 * sees the generic sentence, with no disclosure.
 *
 * WHY THE PROOF IS PER DOOR WHEN THE FIX IS IN ONE PLACE, which is the question
 * worth answering before reading the checks.
 *
 * The operator asked for a proof that a suspended customer cannot reactivate
 * "through any link", and there are three doors that issue one. The tempting
 * proof asserts the guard once and stops, because the guard IS in one function.
 * That proof would be worth very little: it would hold today and say nothing
 * about the day somebody adds a fourth door, or gives an existing door its own
 * password setting route that does not pass through here.
 *
 * So the convergence is the thing proved. Each declared door is asked whether
 * the link it issues lands at the one guarded function, and the door registry
 * supplies the list rather than this file typing three names, so a fourth door
 * is covered the day it is declared rather than the day somebody remembers.
 *
 * WHAT THIS PROOF CANNOT SEE, said plainly rather than implied. It reads source.
 * It does not open a database, so it cannot prove PostgreSQL enforces anything,
 * and a second route written in raw SQL tomorrow would be invisible to it. That
 * guarantee is the trigger migration, which invalidates outstanding tokens at
 * the MOMENT of suspension rather than at the moment of use, and which waits for
 * a sitting with the operator. This is the application half and says so.
 *
 * INJECTION VERIFIED, and the run read for WHICH checks went red rather than
 * only for whether it failed.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const read = (p) => readFileSync(p, "utf8");
/** Comments stripped, so a rule quoted in prose is never mistaken for code. */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const GUARD_FILE = "src/lib/customer-auth.ts";
const GUARD_FN = "setCustomerPassword";
const GENERIC = "That link is not valid.";

const authSrc = read(GUARD_FILE);
const authCode = codeOnly(authSrc);

/** The body of the guarded function, so a rule found elsewhere does not count. */
const fnStart = authCode.indexOf(`export async function ${GUARD_FN}`);
const fnBody = authCode.slice(fnStart, authCode.indexOf("\nexport ", fnStart + 10));

rec(
  `${GUARD_FN} is where a customer link is spent`,
  fnStart > -1 && fnBody.length > 400,
  `${fnBody.split("\n").length} lines read`,
);

/* ------------------------------------------- 1. every door lands on it */

/*
 * THE DOORS COME FROM THE REGISTRY, NOT FROM THIS FILE.
 *
 * ACCOUNT_DOORS declares one entry per way an account can come into being,
 * each naming the route that opens it. Deriving from it means a fourth door is
 * covered the day it is declared. Typing three names here would mean this
 * proof going quietly out of date exactly when the platform grows, which is
 * the declared inventory idiom and the reason that registry exists.
 */
const doorsSrc = read("src/lib/account-doors.ts");

/*
 * EACH DOOR IS BOUNDED BY THE NEXT DOOR, NOT BY A CHARACTER COUNT.
 *
 * The first version of this searched 700 characters after each `origin:` for a
 * `route:`, and silently found two doors out of three: `order_checkout` carries
 * a long `what:` between the two fields, so its route sat outside the window.
 * That is the matcher whose window is wider or narrower than the thing it
 * matches, which CLAUDE.md now records five times, and it failed in the
 * quieter direction: not a wrong answer, a SHORT one.
 *
 * It was caught by the vacuity check below rather than by reading, which is the
 * argument for writing that check at all. A proof walking two thirds of the
 * doors would have printed nothing but PASS lines.
 *
 * So each door's text runs from its own `origin:` to the next one, and the last
 * runs to the end. A field cannot escape its own door's block, whatever anybody
 * writes between the two lines.
 */
const originAt = [...doorsSrc.matchAll(/origin:\s*"([a-z_]+)"/g)];
const doors = originAt
  .map((m, i) => {
    const from = m.index;
    const to = i + 1 < originAt.length ? originAt[i + 1].index : doorsSrc.length;
    const route = doorsSrc.slice(from, to).match(/route:\s*"([^"]+)"/);
    return route ? { origin: m[1], route: route[1] } : null;
  })
  .filter(Boolean);

rec(
  "the door registry names the doors this proof walks",
  doors.length >= 3,
  doors.map((d) => d.origin).join(", ") || "no doors parsed, which would make every check below vacuous",
);

/*
 * EVERY DOOR ISSUES A LINK THAT IS SPENT AT ONE PLACE.
 *
 * The link every door mails points at /account/set-password, whose route calls
 * the guarded function. So the property to prove is that exactly one route
 * spends a customer token, and that nothing else in the source calls the
 * setter. Two spenders would mean two places to guard and one of them
 * forgotten, which is this repository's most frequent defect.
 */
function sourceFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}
const FILES = sourceFiles("src");

const callers = FILES.filter(
  (f) => f !== GUARD_FILE && new RegExp(`\\b${GUARD_FN}\\s*\\(`).test(codeOnly(read(f))),
);
rec(
  "exactly one route spends a customer password link",
  callers.length === 1,
  callers.map((f) => f.replace(/^src\//, "")).join(", ") || "none",
);

/*
 * EVERY DOOR'S LINK POINTS AT THE ONE GUARDED SCREEN.
 *
 * THE FIRST VERSION OF THIS LOOKED IN THE DOOR'S OWN ROUTE FILE, with a
 * fallback for the one door whose route does not build the link itself. It
 * reported the checkout door as broken, and the door was fine: the fallback was
 * written into a `catch` that only fires when the route file is MISSING, and
 * `/api/stripe/webhook/route.ts` exists perfectly well. It simply mails through
 * `ops-payments.ts`. The guard fired on the wrong condition, so the correct
 * answer was unreachable.
 *
 * That is worth the paragraph because the check was WRONG IN THE DIRECTION THAT
 * LOOKS LIKE A FINDING. A red naming a real door, on a proof about a security
 * guarantee, is exactly the sentence somebody would act on, and the thing it
 * accused was working.
 *
 * So it asks the question without assuming which file answers: of every file
 * that builds a set password URL, at least one must also name this door. A
 * door whose link nothing builds is a door whose holder never receives one, and
 * a door built by a file that does not know which door it is serving is the
 * shape that lets a fourth door quietly inherit a third's behaviour.
 */
const linkBuilders = FILES.filter((f) => /account\/set-password\?token=/.test(read(f)));
rec(
  "something builds the set password link at all",
  linkBuilders.length > 0,
  `${linkBuilders.length} file(s) (if this were zero every door check below would pass over nothing)`,
);

for (const door of doors) {
  const builders = linkBuilders.filter((f) => new RegExp(`"${door.origin}"`).test(read(f)));
  rec(
    `the ${door.origin} door's link goes to the one guarded screen`,
    builders.length > 0,
    builders.map((f) => f.replace(/^src\//, "")).join(", ") || `nothing naming ${door.origin} builds a link`,
  );
}

/* --------------------------------------------- 2. the guard itself */

rec(
  "a suspended holder is refused before the token is spent",
  /status === "suspended"/.test(fnBody) &&
    fnBody.indexOf('status === "suspended"') < fnBody.indexOf("used_at"),
  "spending first and refusing second would burn a legitimate link on a refused attempt",
);

rec(
  "and the refusal is the generic sentence, so it discloses nothing",
  new RegExp(`status === "suspended"[\\s\\S]{0,120}${GENERIC.replace(/\./g, "\\.")}`).test(fnBody),
  `"${GENERIC}" is what a mistyped link, a spent link and a suspended account all say`,
);

/*
 * THE RACE GUARD. The status read and the status write are two statements with
 * a gap between them, and a suspension landing in that gap would otherwise walk
 * straight past the check written for it.
 */
rec(
  "the write that sets active refuses to touch a suspended row",
  /\.update\(\{ password_hash[\s\S]{0,200}?\.neq\("status", "suspended"\)/.test(fnBody),
  "the read answers what we saw; the condition answers what was true when we wrote",
);

/*
 * AND THE RESULT IS COUNTED. An update matching nothing is not an error in
 * PostgREST: it succeeds and reports no error, so a version checking only
 * `error` would refuse nothing and return ok, leaving the guard vacuous while
 * reading as though it worked.
 */
rec(
  "and a write that matched nothing is treated as a refusal rather than a success",
  /written\.length === 0/.test(fnBody) || /!written\b/.test(fnBody),
  "an update that matches no row reports no error at all",
);

/* ------------------------------- 3. the half the ruling deliberately keeps */

/*
 * INVITED STILL BECOMES ACTIVE, which is the sign up door completing and is
 * what the operator's ruling preserves. Asserted so that a later reader
 * hardening this further does not remove it by accident: 0043 ties an active
 * self service account to email_verified_at, so an account that can never
 * reach active is a door that can never finish.
 *
 * The condition is on "suspended" alone, so nothing else is blocked. A check
 * that merely looked for the absence of a status write would pass over a
 * version that had removed it entirely and broken sign up.
 */
rec(
  "setting a password still activates an invited account",
  /status: "active"/.test(fnBody),
  "0043 ties an active self service account to a proven address, so this is the door completing",
);
rec(
  "and the only status it refuses to write over is suspended",
  (fnBody.match(/\.neq\("status", "[a-z_]+"\)/g) ?? []).every((m) => m.includes("suspended")),
  "a condition naming any other status would silently close a door that works",
);

/* ---------------------------------------- 4. what this proof cannot see */

console.log("");
console.log(
  "NOTE: this proof reads source. It does not open a database, so it cannot show that",
);
console.log(
  "PostgreSQL refuses anything, and a route written in raw SQL would be invisible to it.",
);
console.log(
  "The guarantee is the trigger that invalidates outstanding tokens AT suspension, which",
);
console.log("is a migration and is held for a sitting with the operator. This is the");
console.log("application half.");

/* ------------------------------------------------------------------ verdict */

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A suspension is not lifted by a link, through any declared door.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
