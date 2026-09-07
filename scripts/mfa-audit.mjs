/**
 * A SESSION THAT HAS NOT SATISFIED THE SECOND FACTOR IS NOT A SESSION.
 *
 *   npx tsx --conditions=react-server scripts/mfa-audit.mjs
 *
 * WHAT THIS ASSERTS, AND WHY THE NEGATIVE HALF IS THE POINT
 * ---------------------------------------------------------
 * The brief requires enforcement at the session boundary rather than at the
 * screen, and the argument for the shape built is that every existing caller
 * inherits it. An argument is not a check. So the negative half takes a PENDING
 * session and attempts EVERY portal route the surface inventory declares, page
 * and API, and requires refusal from all of them.
 *
 * Derived from scripts/lib/surfaces.mjs rather than a list written here, for
 * the reason that inventory exists: a list written here would stop describing
 * the portal the moment somebody added a screen, and the failure would be a
 * route quietly outside the boundary.
 *
 * THE THREE EXCEPTIONS ARE NAMED AND COUNTED
 * ------------------------------------------
 * The challenge, the enrolment, and the endpoint both post to. A fourth is a
 * failure here rather than a discovery later, and the same is true of a third
 * caller of readPendingSession anywhere in the tree.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { routesOf, apisOf, surfacesWhere } from "./lib/surfaces.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";

/** The only paths a pending session may reach. Mirrors src/proxy.ts. */
const EXPECTED_MFA_PATHS = ["/portal/mfa", "/portal/mfa/enrol", "/api/portal/mfa"];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========== THE SECOND FACTOR AT THE SESSION BOUNDARY ==========");
console.log("");

/* ----------------------------------------------------- the pure half */

const {
  issueOpsSession,
  readOpsSession,
  readPendingSession,
} = await import("../src/lib/ops-session.ts");

const HAD = process.env.OPS_SESSION_SECRET;
process.env.OPS_SESSION_SECRET = "mfa-audit-fixture-secret-long-enough-here";

const SUB = "00000000-0000-0000-0000-0000000000aa";

{
  const pending = issueOpsSession(SUB, "admin", "pending");
  const full = issueOpsSession(SUB, "admin", "full");

  rec("a pending session can be minted", pending !== null);
  rec("a full session can be minted", full !== null);
  rec(
    "readOpsSession refuses a pending session",
    pending ? readOpsSession(pending.value) === null : false,
    "this one line is what gives every caller in the codebase the enforcement",
  );
  rec(
    "readPendingSession sees it",
    pending ? readPendingSession(pending.value)?.factor === "pending" : false,
  );
  rec(
    "readPendingSession refuses a full session",
    full ? readPendingSession(full.value) === null : false,
    "the two readers do not overlap",
  );

  const parts = (pending?.value ?? "").split(".");
  rec("the cookie carries five segments", parts.length === 5, `${parts.length}`);
  rec(
    "the pre MFA four segment shape is refused",
    readOpsSession(`${parts[0]}.${parts[1]}.${parts[3]}.${parts[4]}`) === null,
    "stripping the factor must not be a downgrade path",
  );
  rec(
    "a factor nobody signed is refused",
    readOpsSession(`${parts[0]}.${parts[1]}.elevated.${parts[3]}.${parts[4]}`) === null,
  );
  rec(
    "editing the factor to full invalidates the signature",
    readOpsSession(`${parts[0]}.${parts[1]}.full.${parts[3]}.${parts[4]}`) === null,
    "the whole boundary rests on this being true",
  );

  /* A pending session is short by design. Twelve hours of half authenticated
   * session would be twelve hours in which a stolen password is most of the
   * way in. */
  const pendingExp = pending ? pending.expiresAt.getTime() - Date.now() : 0;
  const fullExp = full ? full.expiresAt.getTime() - Date.now() : 0;
  rec(
    "a pending session is much shorter than a full one",
    pendingExp > 0 && pendingExp < fullExp / 10,
    `${Math.round(pendingExp / 60000)} minutes against ${Math.round(fullExp / 3600000)} hours`,
  );
}

/*
 * The fixture secret is put back before the live half, which needs the server's
 * own secret rather than this one. Leaving the fixture in place would mint a
 * cookie the server has never seen, every route would refuse it, and the
 * negative half would pass for entirely the wrong reason: a green board proving
 * only that a forged cookie is rejected.
 */
if (HAD === undefined) delete process.env.OPS_SESSION_SECRET;
else process.env.OPS_SESSION_SECRET = HAD;

/* ------------------------------------ exactly two callers of the pending reader */

{
  const walk = (dir) => {
    const found = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) found.push(...walk(path));
      else if (/\.(ts|tsx)$/.test(entry)) found.push(path);
    }
    return found;
  };

  const callers = [];
  for (const file of walk("src")) {
    const normalised = file.split("\\").join("/");
    if (normalised.endsWith("src/lib/ops-session.ts")) continue;
    const source = readFileSync(file, "utf8");
    if (/\breadPendingSession\b/.test(source)) callers.push(normalised);
  }

  /*
   * The proxy, the challenge screen, the enrolment screen, and the endpoint.
   * Four files, and each one is somewhere a pending session legitimately has to
   * be seen. A fifth is how the boundary stops being one.
   */
  const EXPECTED_CALLERS = [
    "src/app/api/portal/mfa/route.ts",
    "src/app/portal/(public)/mfa/enrol/page.tsx",
    "src/app/portal/(public)/mfa/page.tsx",
    "src/proxy.ts",
  ];

  rec(
    "the pending reader is used somewhere",
    callers.length > 0,
    "zero callers would mean this check is measuring nothing",
  );
  rec(
    `only the declared files read a pending session (${callers.length})`,
    callers.length === EXPECTED_CALLERS.length &&
      EXPECTED_CALLERS.every((f) => callers.includes(f)),
    callers.filter((c) => !EXPECTED_CALLERS.includes(c)).join(", ") ||
      (callers.length !== EXPECTED_CALLERS.length ? `expected ${EXPECTED_CALLERS.length}` : ""),
  );
}

/* --------------------------------- one sign in path, not a copy per audit */

/*
 * EVERY PROBE SIGNS IN THROUGH THE SHARED HELPER.
 *
 * mobile-overflow-audit kept its own copy of the sign in, a bare POST to the
 * session endpoint. On 2026-09-07 the shared helper was taught to complete a
 * real enrolment, because 0024 made admin and engineer require a second factor,
 * and the duplicate was not. Both of its probes then received a PENDING session
 * and all fifty of its portal measurements bounced to the sign in screen.
 *
 * The bounce guard caught it rather than reporting fifty passes, which is why
 * that guard exists. What no guard could do is stop a second implementation
 * existing, and a second implementation is how one of them stays behind.
 *
 * So: no script may POST to the session endpoint except the shared helper. The
 * check is on the SCRIPTS, not the app, because a route handler and a form
 * legitimately post there.
 */
{
  const walkScripts = (dir) => {
    const found = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) found.push(...walkScripts(path));
      else if (entry.endsWith(".mjs")) found.push(path);
    }
    return found;
  };

  const OWNER = "scripts/lib/probe-mfa.mjs";

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
  const ALLOWED_TO_POST = {
    "scripts/security-audit.mjs":
      "it attacks the sign in endpoint rather than using it: empty bodies, wrong passwords, the rate limiter and the enumeration answer.",
  };

  const offenders = [];
  let scanned = 0;

  for (const file of walkScripts("scripts")) {
    const normalised = file.split("\\").join("/");
    if (normalised === OWNER) continue;
    if (ALLOWED_TO_POST[normalised]) continue;
    scanned += 1;
    const source = readFileSync(file, "utf8");
    for (const [n, line] of source.split(/\r?\n/).entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
      if (/\/api\/portal\/session/.test(line) && /fetch\(/.test(line)) {
        offenders.push(`${normalised}:${n + 1}`);
      }
    }
  }

  rec(`there are scripts to scan (${scanned})`, scanned > 5, "a scan over nothing passes forever");
  rec(
    "no script signs in except through the shared helper",
    offenders.length === 0,
    offenders.length
      ? `${offenders.join(", ")} posts to the session endpoint directly. A second sign in path is how one of them misses the next change to what a session is.`
      : `only ${OWNER} does`,
  );
}

/* ------------------------------------------- the proxy declares three paths */

{
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const match = /const MFA_PATHS = new Set\(\[([^\]]*)\]\)/.exec(proxy);
  const declared = match
    ? [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
    : [];

  rec("the proxy declares the pending paths", declared.length > 0, declared.join(", "));
  rec(
    `exactly the three expected paths, no more (${declared.length})`,
    declared.length === EXPECTED_MFA_PATHS.length &&
      EXPECTED_MFA_PATHS.every((p) => declared.includes(p)),
    declared.filter((p) => !EXPECTED_MFA_PATHS.includes(p)).join(", "),
  );
  rec(
    "and they are matched exactly rather than by prefix",
    proxy.includes("MFA_PATHS.has(pathname)") && !proxy.includes('pathname.startsWith("/portal/mfa")'),
    "a prefix would admit every future route under it without anybody deciding",
  );
}

/* -------------------------------------------------------- the live half */

/*
 * THE NEGATIVE HALF. A pending session against every portal route the
 * inventory declares, and every one must refuse.
 */
{
  const portal = surfacesWhere((s) => s.key === "portal")[0];
  const pages = portal ? routesOf(portal) : [];
  const apis = portal ? apisOf(portal) : [];
  const all = [...pages, ...apis];

  rec(
    `the inventory yielded portal routes to attempt (${all.length})`,
    all.length > 5,
    "a negative half over an empty list passes forever, which is the failure this file exists to prevent",
  );

  let reachable = true;
  try {
    const probe = await fetch(`${BASE}/portal/login`, { redirect: "manual" });
    reachable = probe.status > 0;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    rec(
      "the server is answering, so the negative half could run",
      false,
      `${BASE} did not answer. The pure half above still ran; the boundary was NOT exercised over HTTP.`,
    );
  } else {
    /*
     * A REAL PENDING COOKIE, SIGNED WITH THE SERVER'S OWN SECRET.
     *
     * Read from .env.local, the same file the dev server reads, for exactly the
     * reason db-target.mjs gives: an audit that decides what the server accepts
     * by consulting a different secret is an audit measuring a different
     * system. forms-audit recorded that defect once already.
     *
     * Without this the negative half could only try the three MFA paths signed
     * out, which is a far weaker claim than the one the brief asks for.
     */
    try {
      process.loadEnvFile(".env.local");
    } catch {
      /* Absent on a fresh clone. Handled below by saying so rather than by
       * passing over an empty attempt. */
    }

    const secret = process.env.OPS_SESSION_SECRET;
    rec(
      "the server's session secret is readable, so a real pending cookie can be minted",
      typeof secret === "string" && secret.trim().length >= 24,
      secret ? "" : "OPS_SESSION_SECRET is not in .env.local, so the negative half cannot run",
    );

    const pending = secret ? issueOpsSession(SUB, "admin", "pending") : null;

    if (!pending) {
      rec("a pending cookie was minted for the negative half", false, "nothing was attempted");
    } else {
      const cookie = `eng_ops=${pending.value}`;

      /*
       * A sanity check before the sweep: the same cookie must open the
       * challenge screen. If it opened nothing at all, every refusal below
       * would be a refusal of a cookie the server never recognised, and the
       * negative half would pass for the wrong reason.
       */
      const challenge = await fetch(`${BASE}/portal/mfa`, {
        headers: { cookie },
        redirect: "manual",
      });
      rec(
        "the pending cookie opens the challenge screen",
        challenge.status === 200,
        challenge.status === 200
          ? ""
          : `status ${challenge.status}. Every refusal below would otherwise prove nothing.`,
      );

      /*
       * THE OPEN PATHS ARE NOT A HOLE, AND THE FIRST VERSION OF THIS CHECK
       * REPORTED THEM AS ONE.
       *
       * It excluded only the three MFA paths, so the sign in screen, the set
       * password screen and the health probe came back 200 and were reported as
       * a pending session opening a portal surface. They answer 200 to a signed
       * out visitor too; that is what OPEN_PATHS means, and it is asserted by
       * security-audit rather than here.
       *
       * Read from src/proxy.ts rather than restated, so a path added to that
       * list cannot silently become a failure here, and a path REMOVED from it
       * cannot silently keep an exemption in this file.
       */
      const proxySource = readFileSync("src/proxy.ts", "utf8");
      const openMatch = /const OPEN_PATHS = new Set\(\[([\s\S]*?)\]\);/.exec(proxySource);
      const openPaths = openMatch ? [...openMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

      rec(
        `the open paths were read from the proxy (${openPaths.length})`,
        openPaths.length > 0,
        "without them this check reports the sign in screen as a hole",
      );

      const allowed = new Set([...EXPECTED_MFA_PATHS, ...openPaths]);
      const admitted = [];
      let attempted = 0;

      for (const path of all) {
        if (allowed.has(path)) continue;
        attempted += 1;
        const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
        /*
         * A page redirects to the sign in, an API answers 401. A 200 means a
         * half authenticated session opened a portal surface, which is the
         * thing this entire section exists to make impossible.
         */
        if (res.status === 200) admitted.push(`${path} (200)`);
      }

      rec(
        `every portal route refuses a pending session (${attempted} attempted)`,
        admitted.length === 0 && attempted > 5,
        admitted.length
          ? `ADMITTED: ${admitted.join(", ")}`
          : attempted > 5
            ? ""
            : `only ${attempted} routes were attempted, which is too few to mean anything`,
      );
    }
  }
}

// ------------------------------------------------------------------- verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. A half authenticated session is not a session.`);
