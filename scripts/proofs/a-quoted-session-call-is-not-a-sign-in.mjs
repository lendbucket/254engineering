/**
 * A SESSION CALL QUOTED AS SOURCE TEXT IS NOT A SIGN IN, AND A REAL ONE STILL IS.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-quoted-session-call-is-not-a-sign-in.mjs
 *
 * Robert's answer 1 of 6743092030 (2026-11-09). Board 42600011991 failed
 * mfa-audit's "no script signs in except through the shared helper" on
 * scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs, a line that
 * QUOTES the sign out call to check where it sits in two components and signs
 * nobody in. The matcher looked for `fetch(` and the endpoint anywhere on a
 * line. It now blanks a string literal that itself contains `fetch(` before
 * asking whether the line calls fetch (scripts/lib/session-post-scan.mjs).
 *
 * The rule is a class fix, not an exemption, so this proves both halves with
 * lines written the way a script really writes them, and then runs the same
 * scan mfa-audit runs over every script in the repository.
 */
import { readSource } from "../lib/read-source.mjs";
import { directSessionPosts, isDirectSessionPost } from "../lib/session-post-scan.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A real sign in, in the shapes a script would write one. Each must be caught. */
const REAL = [
  "  const res = await fetch(`${base}/api/portal/session`, { method: \"POST\", body });",
  "const r = await fetch(BASE_URL + \"/api/portal/session\", { method: \"POST\" });",
  "    await fetch('http://localhost:4300/api/portal/session', { method: 'POST', headers, body: JSON.stringify(creds) })",
  "return fetch(new URL(\"/api/portal/session\", base), init);",
];
for (const line of REAL) check(`a real call is caught: ${line.trim().slice(0, 60)}`, isDirectSessionPost(line) === true);

/* Source text that quotes the call, as a proof or an audit reads a component. None is a sign in. */
const QUOTED = [
  "check(\"E: both sign outs\", [chrome, signOut].every((s) => s.indexOf(\"await forgetFieldDay();\") < s.indexOf('fetch(\"/api/portal/session\", { method: \"DELETE\" })')));",
  "const needle = 'await fetch(\"/api/portal/session\", { method: \"DELETE\" })';",
  "if (src.includes(`fetch(\"/api/portal/session\"`)) found += 1;",
];
for (const line of QUOTED) check(`quoted source text is not a call: ${line.trim().slice(0, 60)}`, isDirectSessionPost(line) === false);

/* Comments were never sign ins, and stay that way. */
check("a comment line is not a call", isDirectSessionPost("   * await fetch(`${base}/api/portal/session`) used to live here") === false);
check("a line with the endpoint and no call is not a call", isDirectSessionPost("const PATH = \"/api/portal/session\";") === false);

/*
 * THE PREMISE: the line board 42600011991 named is still there and still quotes
 * the call, so the repository scan below is asked about the very line that
 * failed rather than about a file that has since moved.
 */
const fieldDay = readSource("scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs");
check(
  "the premise: the field day proof still quotes the sign out call",
  fieldDay.split(/\r?\n/).some((l) => l.includes("fetch(") && l.includes("/api/portal/session")),
);

/* THE SAME SCAN mfa-audit RUNS, over every script. */
const { offenders, scanned } = directSessionPosts("scripts");
check(`there are scripts to scan (${scanned})`, scanned > 5, "a scan over nothing passes forever");
check("no script signs in except through the shared helper", offenders.length === 0, offenders.join(", "));

console.log(wrong === 0 ? "PASS: a quoted session call is not a sign in, and a real one still is." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
