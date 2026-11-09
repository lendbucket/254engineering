/*
 * WHICH SCRIPTS SIGN IN WITHOUT THE SHARED HELPER. mfa-audit's "no script signs
 * in except through the shared helper", moved here so a static proof can run
 * the same scan over the same files without a server or a database
 * (scripts/proofs/a-quoted-session-call-is-not-a-sign-in.mjs).
 *
 * SHARPENED ON ROBERT'S ANSWER 1 OF 6743092030 (2026-11-09). The first version
 * flagged any line holding both `fetch(` and `/api/portal/session`, so on board
 * 42600011991 it named a proof that QUOTES the sign out call as source text to
 * check where it sits, and signs nobody in. A call written inside a string
 * literal is text, not a call. So a string literal that itself contains
 * `fetch(` is blanked before the line is asked whether it calls fetch; the
 * endpoint is still looked for on the whole line, because a real call carries
 * its address inside a string. A real fetch to the session endpoint outside the
 * shared helper still fails, which is the point of the check, and the proof
 * asserts it with a line written the way a script would actually write it.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "./read-source.mjs";

export const OWNER = "scripts/lib/probe-mfa.mjs";

/*
 * One file legitimately posts there without going through the helper, and it
 * is worth stating why rather than widening the pattern until it stops
 * complaining.
 *
 * security-audit ATTACKS the sign in endpoint: an empty body, a wrong
 * password, an unknown address, the rate limiter, the enumeration answer. It
 * is not obtaining a session, it is testing what the endpoint refuses, and
 * routing that through a helper whose job is to succeed would defeat the
 * point of every one of those checks.
 *
 * Declared with a reason, like role-cast-audit's allowlist, so a second entry
 * has to argue for itself.
 */
export const ALLOWED_TO_POST = {
  "scripts/mfa-audit.mjs":
    "it needs an account that has deliberately NOT enrolled, in order to walk the enrolment screen. signInFully exists to complete an enrolment, which is the one thing this check must not do.",
  "scripts/security-audit.mjs":
    "it attacks the sign in endpoint rather than using it: empty bodies, wrong passwords, the rate limiter and the enumeration answer.",
};

const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

/** True when this source line calls fetch on the session endpoint. */
export function isDirectSessionPost(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("*") || trimmed.startsWith("//")) return false;
  if (!/\/api\/portal\/session/.test(line)) return false;
  const code = line.replace(STRING_LITERAL, (lit) => (lit.includes("fetch(") ? '""' : lit));
  return /fetch\(/.test(code);
}

function walkScripts(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walkScripts(path));
    else if (entry.endsWith(".mjs")) found.push(path);
  }
  return found;
}

/** Every script line, outside the owner and the allowed files, that posts to the session endpoint. */
export function directSessionPosts(root = "scripts") {
  const offenders = [];
  let scanned = 0;
  for (const file of walkScripts(root)) {
    const normalised = file.split("\\").join("/");
    if (normalised === OWNER) continue;
    if (ALLOWED_TO_POST[normalised]) continue;
    scanned += 1;
    for (const [n, line] of readSource(file).split(/\r?\n/).entries()) {
      if (isDirectSessionPost(line)) offenders.push(`${normalised}:${n + 1}`);
    }
  }
  return { offenders, scanned };
}
