// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees, so this line and the
// invocation cannot drift apart.
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

import { readdirSync, statSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { join } from "node:path";
import { routesOf, apisOf, surfacesWhere } from "./lib/surfaces.mjs";
import { auditClient } from "./lib/db-target.mjs";
/*
 * The platform's own TOTP module, for the acknowledgement walk below. The same
 * trade scripts/lib/probe-mfa.mjs argues at length: RFC 6238's published
 * vectors are what prove the module, and using it here tests the WIRING.
 */
import { base32Decode, codeForStep, stepAt } from "../src/lib/totp.ts";

const BASE = process.env.BASE_URL || "http://localhost:3225";

/** The only paths a pending session may reach. Mirrors src/proxy.ts. */
const EXPECTED_MFA_PATHS = ["/portal/mfa", "/portal/mfa/enrol", "/api/portal/mfa"];

const out = [];
/*
 * `ok` is true, false, or NULL for could not tell.
 *
 * Operator ruling, 2026-09-22. Three checks here reported a hard FAIL when
 * their PROBE could not be built, which is a different statement from the
 * property being violated. On the board of 2026-09-22 one of them went red
 * with the note "no probe"; a standalone re-run minutes later passed 57 of 57
 * and nothing in the diff touched MFA, sessions, roles or profiles. The check
 * had not found a way for an un-enrolled account to acknowledge its way to a
 * session. It had failed to create an account to try it with.
 *
 * `unreachable is not failed`, and the cost of confusing them runs both ways: a
 * red nobody can reproduce teaches people to discount this audit, and the next
 * real finding arrives wearing the same colour.
 */
const rec = (name, ok, note = "") => out.push({ name, ok, note });
/** Could not tell: the subject could not be built, so nothing was measured. */
const cnt = (name, note) => out.push({ name, ok: null, note });

console.log("");
console.log("========== THE SECOND FACTOR AT THE SESSION BOUNDARY ==========");
console.log("");

/* ------------------------------- the qr the enrolment screen hands over */

/*
 * THE ENCODER IS CHECKED ON EVERY RUN, NOT WHEN SOMEBODY REMEMBERS.
 *
 * Operator instruction, 2026-09-07, and the reason is the encoder's own
 * history: five bugs on the way in, four of which produced a QR that rendered
 * perfectly and decoded to nothing, while versions 5 and 6 worked throughout.
 * Short payloads were fine and a real otpauth URI was not, which is the failure
 * shape that ships.
 *
 * It belongs here rather than in its own audit because the QR is part of the
 * enrolment this file already covers, and because nothing else in the platform
 * draws one. Pure, no server, under a second.
 */
{
  const { checkQrEncoder } = await import("./proofs/qr-decodes-to-what-it-encoded.mjs");
  const { failed, total } = checkQrEncoder(false);
  rec(
    `the qr encoder round trips through an independent decoder (${total} cases)`,
    failed.length === 0 && total > 5,
    failed.length
      ? `${failed.join(" | ")}. A QR that scans to the wrong secret strands somebody mid enrolment.`
      : total > 5
        ? ""
        : `only ${total} cases ran, which is too few to mean anything`,
  );
}

/*
 * AND THE KEY FAULT PROOF, FOR THE SAME REASON, AFTER THE SAME KIND OF COST.
 *
 * 2026-09-13: the operator was locked out of production for four hours because
 * this file's subject, the second factor, answered a working phone with
 * "MFA_ENCRYPTION_KEY is configured." A key REPLACED with another valid value
 * passes every test mfaStatus applies, so the one fault that had happened was
 * the one the sentence could not describe.
 *
 * It runs here rather than in its own audit because it is the challenge path,
 * which is what this file covers, and because the live half needs the same
 * development database this audit already holds. It puts one enrolment on
 * development, reads the three sentences answerChallenge returns, and removes
 * what it made.
 */
{
  const { checkKeyFault } = await import("./proofs/a-replaced-key-says-so.mjs");
  const { failed, total, notes } = await checkKeyFault(false);
  rec(
    `a replaced key says so and a wrong code still says that (${total} cases)`,
    failed.length === 0 && total > 15,
    failed.length
      ? `${failed.join(" | ")}. This is the 2026-09-13 lockout coming back.`
      : total > 15
        ? notes.join("; ")
        : `only ${total} cases ran, which is too few to mean anything`,
  );
}

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
    const source = readSource(file);
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
    "scripts/mfa-audit.mjs":
      "it needs an account that has deliberately NOT enrolled, in order to walk the enrolment screen. signInFully exists to complete an enrolment, which is the one thing this check must not do.",
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
    const source = readSource(file);
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
  const proxy = readSource("src/proxy.ts");
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
      const proxySource = readSource("src/proxy.ts");
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

      /*
       * AND THE QR ACTUALLY REACHES THE SCREEN.
       *
       * Everything above this verifies the encoder. On 2026-09-07 the encoder
       * was correct, byte identical to a reference across five versions and
       * proven against an independent decoder, and the enrolment screen showed
       * NO QR AT ALL: the client declared `setQr` and never called it, so the
       * value was thrown away between an endpoint that returned it and a branch
       * that rendered nothing.
       *
       * Typecheck passed, because a destructured array element that is never
       * used is not an unused variable. Eight proof cases passed, because they
       * test the encoder and not the wiring. The operator found it by looking
       * at the page.
       *
       * So this walks the real screen in a real browser and requires an image.
       * It is the only check here that would have caught it, and the flow it
       * covers is the one with no second chance: somebody enrolling a second
       * factor, once, with recovery codes shown once.
       */
      {
        /*
         * TWO REAL, DELIBERATELY UN-ENROLLED ACCOUNTS: ONE OPTIONAL, ONE REQUIRED.
         *
         * The synthetic cookie above is signed correctly and names a uuid with
         * no profile behind it, so the screen renders and the endpoint answers
         * 401. That is right of the endpoint and useless for these checks,
         * which have to get as far as a QR and as far as a portal screen.
         *
         * They sign in with a bare POST rather than through signInFully, and
         * this is the one place in this repository where doing so is correct:
         * signInFully COMPLETES an enrolment, and what these need is accounts
         * that have not. mfa-audit is in that helper's allowlist for this
         * reason.
         *
         * WHY THE REQUIRED PROBE BRINGS ITS OWN ROLE.
         * After 0025 no shipped role requires a factor, so an assertion that a
         * required role is still refused has nothing to stand on unless it
         * makes one. Roles are rows since 0018, so it inserts one, uses it, and
         * deletes it. Checked before this was built rather than assumed: no
         * audit anywhere reads eng_roles from the database, roles-audit
         * compares the migration chain to DEFAULT_ROLES in the TypeScript, and
         * nothing asserts a live role count. The profiles foreign key added in
         * 0018 also enforces the teardown order, so the role cannot be removed
         * while its probe still exists.
         *
         * That assertion is the one that matters most here. Making the default
         * an offer is only safe if the requirement it replaces still bites when
         * a role asks for it, and "still bites" is a claim, not a fact, until
         * something signs in under it and is refused.
         */
        const db = auditClient("mfa-audit", { neverProduction: true });
        const stamp = Date.now();
        const REQUIRED_ROLE = `mfa_probe_required_${stamp}`;
        const probeIds = [];
        let roleMade = false;

        /* Sign a fresh account in and report what came back, without enrolling it. */
        /*
         * FOUR WAYS TO COME BACK WITHOUT A COOKIE, AND THEY USED TO LOOK
         * IDENTICAL. Operator ruling, 2026-09-22.
         *
         * Every caller that could not get a probe said "no probe", which is a
         * status note that can only name the faults its author enumerated, and
         * this one enumerated none of them. A reader of the 2026-09-22 board
         * could not tell a missing service key from a refused createUser from a
         * failed profile insert from a sign in that returned no cookie. Those
         * are four different problems and three of them are not about MFA at
         * all.
         *
         * `why` is null on success and a sentence otherwise, and the sentence
         * carries the provider's own message where there is one.
         */
        const makeProbe = async (roleKey, tag) => {
          if (!db) {
            return {
              cookie: null, redirect: null, id: null,
              why: "no database client: this process has no SUPABASE_URL or service role key, so no account could be created",
            };
          }
          const email = `mfaprobe-${tag}-${stamp}@mobile-audit.invalid`;
          const password = `mfaprobe-${tag}-${stamp}-enrolment-screen`;
          const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
          if (!made.data?.user) {
            return {
              cookie: null, redirect: null, id: null,
              why: `createUser returned no user for ${email}: ${made.error?.message ?? "no error message given"}`,
            };
          }
          const id = made.data.user.id;
          probeIds.push(id);
          const inserted = await db.from("eng_profiles").insert({
            id,
            email,
            display_name: `MFA Probe ${tag}`,
            role: roleKey,
            status: "active",
          });
          if (inserted.error) {
            return {
              cookie: null, redirect: null, id,
              why: `the account was created but its eng_profiles row was refused: ${inserted.error.message}`,
            };
          }
          const res = await fetch(`${BASE}/api/portal/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const body = await res.json().catch(() => null);
          const cookie = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/)?.[1] ?? null;
          return {
            cookie,
            redirect: typeof body?.redirect === "string" ? body.redirect : null,
            id,
            why: cookie
              ? null
              : `signing in as ${email} returned HTTP ${res.status} and no eng_ops cookie`,
          };
        };

        if (db) {
          const inserted = await db.from("eng_roles").insert({
            key: REQUIRED_ROLE,
            name: "MFA probe, required",
            landing_path: "/portal",
            is_system: false,
            mfa_requirement: "required",
          });
          roleMade = !inserted.error;
          rec(
            "a role requiring a second factor could be created to test against",
            roleMade,
            roleMade ? REQUIRED_ROLE : (inserted.error?.message ?? "insert failed"),
          );

          /*
           * AND IT NEEDS A GRANT, OR THE REFUSAL BELOW PROVES NOTHING.
           *
           * The first version of this check created a role with no grants, and
           * /portal redirects any actor without files.list or offers.list_own
           * to the profile screen before it looks at anything else. So the
           * portal answered 307 for that role whatever its session was, and
           * "a required role cannot decline into the portal" passed while
           * measuring the role's permissions rather than its second factor.
           *
           * It passed on a green board and went red only under injection, in
           * the half of the injection it was not supposed to be watching. That
           * is the recurring defect in this repository: a check looking at the
           * right thing for the wrong reason. The grant fixes the cause and the
           * control below makes it unable to come back.
           */
          if (roleMade) {
            const granted = await db
              .from("eng_role_grants")
              .insert({ role_key: REQUIRED_ROLE, action: "files.list" });
            rec(
              "and it can open the portal at all, so a refusal means the factor",
              !granted.error,
              granted.error?.message ?? "",
            );
          }
        }

        const optional = await makeProbe("admin", "optional");
        const required = roleMade
          ? await makeProbe(REQUIRED_ROLE, "required")
          : {
              cookie: null, redirect: null,
              why: "the probe role requiring a second factor could not be created, so no account could hold it",
            };

        const probeCookie = optional.cookie;

        if (probeCookie) {
          rec("an un-enrolled probe on an optional role signed in", true, "");
        } else {
          cnt(
            "an un-enrolled probe on an optional role signed in",
            `${optional.why ?? "no reason given"}. Without one the enrolment screen cannot be walked at all.`,
          );
        }

        /*
         * ------------------------------------------------------------------
         * AN OPTIONAL ROLE IS OFFERED ENROLMENT AND CAN DECLINE INTO THE PORTAL.
         *
         * Operator ruling, 2026-09-07. Two halves, and both are needed: being
         * sent to enrolment is the offer, and the portal opening is the
         * decline. A build that did the first and not the second would be the
         * old behaviour with softer wording.
         *
         * The portal check is done with the cookie itself rather than by
         * reading a factor out of it, because what is being claimed is that
         * the portal opens, and that is a thing the server decides.
         */
        if (optional.cookie) {
          rec(
            "an optional role with no factor is OFFERED enrolment",
            optional.redirect === "/portal/mfa/enrol",
            optional.redirect ?? "no redirect came back",
          );
        } else {
          cnt("an optional role with no factor is OFFERED enrolment", optional.why ?? "no reason given");
        }

        const portalPath = all.includes("/portal") ? "/portal" : (pages[0] ?? "/portal");

        if (probeCookie) {
          const opened = await fetch(`${BASE}${portalPath}`, {
            headers: { cookie: `eng_ops=${probeCookie}` },
            redirect: "manual",
          });
          rec(
            `and can DECLINE into the portal (${portalPath})`,
            opened.status === 200,
            opened.status === 200
              ? ""
              : `status ${opened.status}. The offer was made and the portal was still shut, which is the behaviour this ruling replaced.`,
          );
        } else {
          cnt("and can DECLINE into the portal", optional.why ?? "no optional probe to try it with, and no reason given");
        }

        /*
         * ------------------------------------------------------------------
         * A REQUIRED ROLE STILL CANNOT.
         *
         * The other half of the same ruling, and the reason the requirement is
         * still worth having in the code. Same sign in, same screen, and the
         * portal must refuse.
         */
        if (required.cookie) {
          rec(
            "a required role with no factor is sent to enrolment",
            required.redirect === "/portal/mfa/enrol",
            required.redirect ?? "no redirect came back",
          );
        } else {
          cnt("a required role with no factor is sent to enrolment", required.why ?? "no reason given");
        }

        if (required.cookie) {
          /*
           * THE CONTROL, AND IT COMES FIRST.
           *
           * A FULL session on the very same account and role must open the
           * portal. If it does not, then the refusal below is being produced by
           * something other than the second factor, the assertion is measuring
           * the wrong thing, and it says so instead of passing.
           *
           * This is the shape the check should have had from the start, and it
           * is the same idiom as "the pending cookie opens the challenge
           * screen" above: prove the instrument reads before trusting what it
           * reads.
           */
          const control = required.id ? issueOpsSession(required.id, REQUIRED_ROLE, "full") : null;
          let controlOk = false;
          if (control) {
            const open = await fetch(`${BASE}${portalPath}`, {
              headers: { cookie: `eng_ops=${control.value}` },
              redirect: "manual",
            });
            controlOk = open.status === 200;
            rec(
              `the same role with a FULL session DOES open the portal (${portalPath})`,
              controlOk,
              controlOk
                ? ""
                : `status ${open.status}. The refusal below would then prove nothing about the second factor.`,
            );
          } else {
            rec("the same role with a FULL session DOES open the portal", false, "no control cookie could be minted");
          }

          const shut = await fetch(`${BASE}${portalPath}`, {
            headers: { cookie: `eng_ops=${required.cookie}` },
            redirect: "manual",
          });
          rec(
            `and CANNOT decline into the portal (${portalPath})`,
            shut.status !== 200 && controlOk,
            shut.status === 200
              ? "a required role reached a portal screen without a factor, which is the requirement not existing"
              : controlOk
                ? `refused with ${shut.status}`
                : `refused with ${shut.status}, but the control failed, so this refusal is not evidence`,
          );

          /*
           * And the decline is not merely ineffective for them, it is not
           * offered. A link that appears and then fails is a worse screen than
           * one that never offered, and the server decides this from the
           * session rather than from the requirement read.
           */
          const shown = await fetch(`${BASE}/portal/mfa/enrol`, {
            headers: { cookie: `eng_ops=${required.cookie}` },
          });
          const html = shown.ok ? await shown.text() : "";
          rec(
            "and is not shown a way out of it",
            shown.ok && !/Not now/i.test(html),
            shown.ok ? (/Not now/i.test(html) ? "the decline was rendered for a required role" : "") : `enrol screen answered ${shown.status}`,
          );
        } else {
          const why = required.why ?? "no required probe to try it with, and no reason given";
          cnt("and CANNOT decline into the portal", why);
          cnt("and is not shown a way out of it", why);
        }

        /*
         * ==================================================================
         * AN ENROLMENT DOES NOT COMPLETE UNTIL THE CODES ARE ACKNOWLEDGED.
         * ==================================================================
         *
         * Operator instruction, 2026-09-13, after being locked out of
         * production holding no recovery codes at all.
         *
         * The screen already had a checkbox reading "I have saved these codes
         * somewhere I can reach without my phone" and a continue button
         * disabled until it was ticked. That looked like a gate and was not
         * one: `confirm` had already issued the FULL session, so the
         * acknowledgement governed a redirect somebody could perform by typing
         * a URL, and nothing recorded whether it had happened.
         *
         * WHY THE SESSION IS THE THING ASSERTED. "The flow does not complete"
         * has to mean something a server decides, or it is a claim about a
         * disabled attribute. What the server decides is whether this person
         * holds a session that opens the portal, so that is what is measured,
         * on both sides of the acknowledgement.
         *
         * The three answers are kept apart deliberately: confirmed but not
         * acknowledged, acknowledged, and never enrolled at all. A fixture
         * that could not separate the first two would prove neither.
         */
        if (db) {
          /*
           * ON THE REQUIRED ROLE, AND THE FIRST VERSION OF THIS USED admin.
           *
           * It passed every check except the one that mattered and failed that
           * one honestly: "the portal is still shut before the
           * acknowledgement" went red, because an OPTIONAL role with no factor
           * is handed a FULL session at sign in and offered enrolment. That
           * person is already inside, so nothing the enrolment screen does can
           * gate them, and the check was measuring a door that was open before
           * it started.
           *
           * The gate only bites where a pending session is what somebody
           * holds, which is a role that REQUIRES a factor. That is where it is
           * measured. Worth stating plainly rather than quietly switching
           * roles: for an optional role the acknowledgement is a RECORD and
           * not a gate, and no amount of check writing changes that.
           */
          const ack = roleMade
            ? await makeProbe(REQUIRED_ROLE, "ack")
            : {
                cookie: null, redirect: null, id: null,
                why: "the probe role requiring a second factor could not be created, so no account could hold it",
              };
          if (!ack.cookie) {
            cnt(
              "a probe could be signed in to walk the acknowledgement",
              ack.why ?? "no reason given",
            );
          } else {
            const header = `eng_ops=${ack.cookie}`;
            const post = async (body) => {
              const res = await fetch(`${BASE}/api/portal/mfa`, {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: header },
                body: JSON.stringify(body),
              });
              return {
                status: res.status,
                cookie: (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/)?.[1] ?? null,
                body: await res.json().catch(() => null),
              };
            };

            const begun = await post({ action: "begin" });
            rec("an enrolment can be begun", begun.body?.ok === true && Boolean(begun.body?.secret));

            const bytes = begun.body?.secret ? base32Decode(begun.body.secret) : null;
            const confirmed = bytes
              ? await post({ action: "confirm", code: codeForStep(bytes, stepAt(Date.now())) })
              : { status: 0, cookie: null, body: null };

            rec(
              "confirming a code returns the recovery codes",
              Array.isArray(confirmed.body?.recoveryCodes) && confirmed.body.recoveryCodes.length > 0,
              `${confirmed.body?.recoveryCodes?.length ?? 0} codes`,
            );
            rec(
              "and hands back a completion token instead",
              typeof confirmed.body?.completion === "string" && confirmed.body.completion.split(".").length === 3,
              "without one nothing below is testing a binding, it is testing an unguarded call",
            );
            rec(
              "and does NOT hand over a session",
              confirmed.body?.ok === true && confirmed.cookie === null,
              confirmed.cookie ? "confirm issued a session, so the acknowledgement below governs nothing" : "",
            );

            const issuedRow = await db
              .from("eng_mfa_enrolments")
              .select("recovery_codes_issued_at, recovery_codes_acknowledged_at")
              .eq("user_id", ack.id)
              .maybeSingle();
            rec(
              "the record notes when the codes were issued",
              Boolean(issuedRow.data?.recovery_codes_issued_at),
              issuedRow.data?.recovery_codes_issued_at ?? "nothing was written",
            );
            rec(
              "and does not yet say they were saved",
              issuedRow.data?.recovery_codes_acknowledged_at === null,
              issuedRow.data?.recovery_codes_acknowledged_at ?? "",
            );

            /*
             * THE CONTROL AND THE MEASUREMENT, in the shape the required role
             * check above already uses: prove the instrument reads before
             * trusting what it reads. The account IS enrolled at this point, so
             * a portal that opened here would mean the acknowledgement is
             * decoration.
             */
            /*
             * WITH WHATEVER THE FLOW HAS HANDED OVER SO FAR, which is the
             * pending cookie it came in with unless confirm gave a better one.
             *
             * The first version used the incoming cookie only. That proved the
             * ORIGINAL session stays pending, which is true and is not the
             * claim: a confirm that handed back a full session would leave this
             * green while the gate governed nothing. Reading the cookie the
             * flow actually produces is the only version that cannot pass on
             * the defect it exists to catch.
             */
            const carried = confirmed.cookie ?? ack.cookie;
            const beforeAck = await fetch(`${BASE}${portalPath}`, {
              headers: { cookie: `eng_ops=${carried}` },
              redirect: "manual",
            });
            rec(
              `and the portal is still shut before the acknowledgement (${portalPath})`,
              beforeAck.status !== 200,
              beforeAck.status === 200
                ? "the enrolment completed without anybody saying they had the codes, which is the state this was ordered to end"
                : `refused with ${beforeAck.status}`,
            );

            const saved = await post({
      action: "codes_saved",
      completion: confirmed.body?.completion,
    });
            rec(
              "acknowledging the codes hands over the session",
              saved.body?.ok === true && Boolean(saved.cookie),
              saved.body?.error ?? (saved.cookie ? "" : "no session cookie came back"),
            );

            const ackedRow = await db
              .from("eng_mfa_enrolments")
              .select("recovery_codes_acknowledged_at")
              .eq("user_id", ack.id)
              .maybeSingle();
            rec(
              "and the record notes when",
              Boolean(ackedRow.data?.recovery_codes_acknowledged_at),
              ackedRow.data?.recovery_codes_acknowledged_at ?? "nothing was written",
            );

            if (saved.cookie) {
              const afterAck = await fetch(`${BASE}${portalPath}`, {
                headers: { cookie: `eng_ops=${saved.cookie}` },
                redirect: "manual",
              });
              rec(
                `and THAT session opens the portal (${portalPath})`,
                afterAck.status === 200,
                afterAck.status === 200
                  ? ""
                  : `status ${afterAck.status}. The gate would then be a wall rather than a step.`,
              );
            } else {
              rec("and THAT session opens the portal", false, "no session came back to try it with");
            }

            /*
             * ==============================================================
             * AND IT IS NOT A WAY PAST THE SECOND FACTOR WITH A PASSWORD.
             * ==============================================================
             *
             * THE HOLE THIS CLOSES WAS OPENED BY THE FIX ABOVE, and it is
             * worth being exact about that. Moving the session from confirm to
             * the acknowledgement means a call that upgrades a half
             * authenticated session into a full one without a code being
             * typed. Sound, because the code WAS typed a moment earlier by the
             * confirm that produced the codes.
             *
             * Unsound the moment the two are in different sign ins. An account
             * left in "codes issued, never acknowledged" would then be
             * reachable with a password alone, forever, and that state is
             * precisely the one this whole feature exists to make visible. The
             * protection would have opened the hole it was measuring.
             *
             * So the enrolment's verified_at has to be later than the moment
             * the calling session began. This walks the attack: enrol in one
             * sign in, abandon before acknowledging, sign in again, and try.
             */
            const stale = roleMade
              ? await makeProbe(REQUIRED_ROLE, "ackstale")
              : {
                  cookie: null, redirect: null, id: null,
                  why: "the probe role requiring a second factor could not be created, so no account could hold it",
                };
            if (stale.cookie) {
              const staleHeader = `eng_ops=${stale.cookie}`;
              const begun2 = await fetch(`${BASE}/api/portal/mfa`, {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: staleHeader },
                body: JSON.stringify({ action: "begin" }),
              });
              const s2 = await begun2.json().catch(() => null);
              const bytes2 = s2?.secret ? base32Decode(s2.secret) : null;

              let staleCompletion = null;
              if (bytes2) {
                const c2 = await fetch(`${BASE}/api/portal/mfa`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: staleHeader },
                  body: JSON.stringify({ action: "confirm", code: codeForStep(bytes2, stepAt(Date.now())) }),
                });
                const b2 = await c2.json().catch(() => null);
                staleCompletion = typeof b2?.completion === "string" ? b2.completion : null;
              }
              rec(
                "the abandoning probe was handed its own completion token",
                typeof staleCompletion === "string",
                "the control below needs it, and without it the refusals prove nothing",
              );

              /*
               * A SECOND SIGN IN. This is the attacker's position: the
               * password, and nothing else. The enrolment is real, the codes
               * are issued, and nobody has acknowledged them.
               */
              const second = await fetch(`${BASE}/api/portal/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: `mfaprobe-ackstale-${stamp}@mobile-audit.invalid`,
                  password: `mfaprobe-ackstale-${stamp}-enrolment-screen`,
                }),
              });
              const secondCookie = (second.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/)?.[1] ?? null;

              /* The control: that second sign in really is a pending session. */
              rec(
                "a second sign in on an enrolled account is challenged",
                Boolean(secondCookie) &&
                  (await second.json().catch(() => null))?.redirect === "/portal/mfa",
                secondCookie ? "" : "no cookie came back, so the attack below proves nothing",
              );

              if (secondCookie) {
                /*
                 * THE ATTACKER'S POSITION, EXACTLY: the password, a pending
                 * session, and no completion token, because only the confirm
                 * that produced the codes can mint one and that confirm
                 * happened in a sign in this caller was not part of.
                 *
                 * THE FIRST VERSION OF THIS CHECK WATCHED A CLOCK COMPARISON
                 * and the board caught it. verified_at is written by the
                 * database and the session was minted by the application, so
                 * the boundary rested on two unsynchronised clocks agreeing: it
                 * passed standalone twice and went red on a board run. What is
                 * asserted now is a signature nobody without the key can
                 * produce, which has no timing in it at all.
                 */
                const attack = await fetch(`${BASE}/api/portal/mfa`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: `eng_ops=${secondCookie}` },
                  body: JSON.stringify({ action: "codes_saved" }),
                });
                const minted = (attack.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
                rec(
                  "and CANNOT acknowledge an earlier enrolment into a full session",
                  attack.status === 400 && !minted,
                  minted
                    ? "A PASSWORD ALONE REACHED A FULL SESSION. The acknowledgement is a bypass of the second factor."
                    : `refused with ${attack.status}`,
                );

                /*
                 * AND NOT WITH SOMEBODY ELSE'S TOKEN EITHER.
                 *
                 * The one the ack probe was handed is real, correctly signed
                 * and unexpired. It names a different account. A check that
                 * only ever posted an ABSENT token could not tell "the
                 * signature is verified" from "the token is read and its
                 * subject ignored", and the second of those is a bypass for
                 * anybody who can see one response body.
                 */
                const stolen = await fetch(`${BASE}/api/portal/mfa`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: `eng_ops=${secondCookie}` },
                  body: JSON.stringify({ action: "codes_saved", completion: confirmed.body?.completion }),
                });
                const mintedStolen = (stolen.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
                rec(
                  "and not with a valid token minted for another account",
                  stolen.status === 400 && !mintedStolen,
                  mintedStolen
                    ? "A TOKEN FOR SOMEBODY ELSE COMPLETED THIS ENROLMENT. The signature is checked and the subject is not."
                    : `refused with ${stolen.status}`,
                );

                /*
                 * AND THE CONTROL, WHICH IS WHAT MAKES THE TWO ABOVE EVIDENCE.
                 *
                 * This account's OWN token, from its own confirm, must
                 * complete it. Without this the two refusals are consistent
                 * with codes_saved being broken for everybody, which would pass
                 * every assertion here while the feature did not work.
                 */
                const own = await fetch(`${BASE}/api/portal/mfa`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", cookie: `eng_ops=${secondCookie}` },
                  body: JSON.stringify({ action: "codes_saved", completion: staleCompletion }),
                });
                const mintedOwn = (own.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
                rec(
                  "while this account's own token from its own confirm does complete it",
                  own.status === 200 && Boolean(mintedOwn),
                  own.status === 200
                    ? ""
                    : `HTTP ${own.status}. The refusals above would then prove nothing about the binding.`,
                );
              } else {
                /*
                 * The probe existed; the SECOND SIGN IN returned no cookie, so
                 * the attacker's position could not be set up. Same shape as a
                 * probe that could not be built: nothing was measured, and a
                 * red here would claim the binding was tested and broken.
                 */
                const why = `the second sign in as mfaprobe-ackstale-${stamp}@mobile-audit.invalid returned no eng_ops cookie, so the attacker's position could not be set up`;
                cnt("and CANNOT acknowledge an earlier enrolment into a full session", why);
                cnt("and not with a valid token minted for another account", why);
                cnt("while this account's own token from its own confirm does complete it", why);
              }
            } else {
              const why = stale.why ?? "the probe could not be built and makeProbe gave no reason, which is itself a defect";
              cnt("a second sign in on an enrolled account is challenged", why);
              cnt("and CANNOT acknowledge an earlier enrolment into a full session", why);
            }

            /*
             * AND IT IS NOT A SESSION VENDING MACHINE. An account with no
             * enrolment must not be able to acknowledge its way to a full
             * session, or the step added to protect recovery codes would be a
             * way around the second factor.
             */
            const bare = roleMade
              ? await makeProbe(REQUIRED_ROLE, "ackbare")
              : {
                  cookie: null, redirect: null, id: null,
                  why: "the probe role requiring a second factor could not be created, so no account could hold it",
                };
            if (bare.cookie) {
              const res = await fetch(`${BASE}/api/portal/mfa`, {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `eng_ops=${bare.cookie}` },
                body: JSON.stringify({ action: "codes_saved" }),
              });
              const minted = (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/);
              rec(
                "an account with no enrolment cannot acknowledge its way to a session",
                res.status === 400 && !minted,
                minted ? "it minted one" : `refused with ${res.status}`,
              );
            } else {
              cnt(
                "an account with no enrolment cannot acknowledge its way to a session",
                bare.why ?? "the probe could not be built and makeProbe gave no reason, which is itself a defect",
              );
            }
          }
        }

        const { chromium } = await import("playwright");
        const browser = probeCookie ? await chromium.launch() : null;
        try {
          if (!browser) throw new Error("no browser");
          const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
          await ctx.addCookies([
            { name: "eng_ops", value: probeCookie, domain: "localhost", path: "/" },
          ]);
          const page = await ctx.newPage();
          await page.goto(`${BASE}/portal/mfa/enrol`, { waitUntil: "domcontentloaded" });

          const started = page.getByRole("button", { name: /set up a second factor/i });
          const reachable = (await started.count()) > 0;
          rec("the enrolment screen offers to start", reachable, page.url());

          if (reachable) {
            await started.click();
            await page.waitForTimeout(3000);

            const qr = page.locator("svg[role='img']").first();
            const drawn = (await page.locator("svg[role='img']").count()) > 0;
            rec(
              "and a QR is on the page once it does",
              drawn,
              drawn ? "" : "the encoder can be perfect and the screen still show nothing, which is exactly what shipped",
            );

            if (drawn) {
              const box = await qr.boundingBox();
              rec(
                "the QR is big enough to scan",
                Boolean(box) && box.width >= 150 && box.height >= 150,
                box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "no box",
              );
              /* A QR is roughly a third to a half dark. An empty or nearly
               * empty box would satisfy every check above and scan as nothing. */
              const modules = await qr.locator("path").count();
              rec("and it has geometry rather than being an empty box", modules > 0);
            }

            /* The typed fallback has to survive beside it, because a desktop
             * authenticator has no camera pointed at this screen. */
            rec(
              "the typed secret is still available as a fallback",
              (await page.getByText(/Cannot scan it/i).count()) > 0,
            );
          }

          /*
           * THE DECLINE IS A LINK SOMEBODY CAN ACTUALLY FOLLOW.
           *
           * Asserted in the browser rather than by finding the words in the
           * HTML, for the reason the QR check above exists: markup that is
           * present and markup that works are different claims, and this file
           * has already been wrong about that once. This one goes back to the
           * start of the screen, finds the link, and follows it.
           */
          await page.goto(`${BASE}/portal/mfa/enrol`, { waitUntil: "domcontentloaded" });
          const notNow = page.getByRole("link", { name: /not now/i });
          const offered = (await notNow.count()) > 0;
          rec("the optional probe is shown a way to decline", offered);

          if (offered) {
            await notNow.first().click();
            await page.waitForLoadState("domcontentloaded");
            const landed = page.url();
            rec(
              "and following it lands inside the portal rather than back at the sign in",
              !/\/portal\/login/.test(landed) && !/\/portal\/mfa/.test(landed),
              landed,
            );
          }
        } catch {
          /* Reported by the checks above rather than thrown; a probe that could
           * not be made has already failed its own assertion. */
        } finally {
          if (browser) await browser.close();
          /*
           * PROFILES FIRST, THEN THE ROLE. eng_profiles.role is a foreign key
           * to eng_roles(key) since 0018, so removing the role while a probe
           * still references it fails and leaves both behind. The order is not
           * a preference.
           */
          if (db) {
            for (const id of probeIds) {
              await db.from("eng_profiles").delete().eq("id", id);
              await db.auth.admin.deleteUser(id).catch(() => {});
            }
            if (roleMade) {
              /* Grants reference the role too, so they go before it. */
              await db.from("eng_role_grants").delete().eq("role_key", REQUIRED_ROLE);
              const removed = await db.from("eng_roles").delete().eq("key", REQUIRED_ROLE);
              rec(
                "the throwaway required role was cleaned up",
                !removed.error,
                removed.error
                  ? `${REQUIRED_ROLE} is still on development: ${removed.error.message}`
                  : "",
              );
            }
          }
        }
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

const verdictOf = (r) => (r.ok === null ? "COULD NOT TELL" : r.ok ? "PASS" : "FAIL");
for (const r of out) console.log(`  ${verdictOf(r)}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => r.ok === false);
const unmeasured = out.filter((r) => r.ok === null);
console.log("");

/*
 * SAID LOUDLY EVEN THOUGH IT DOES NOT FAIL THE RUN, because a green board over
 * a half that never happened is the other way to lie. Each line names WHICH of
 * makeProbe's four failure paths it hit, so the next reader is not left with
 * "no probe" covering four different causes.
 */
if (unmeasured.length) {
  console.log(`COULD NOT TELL: ${unmeasured.length} of ${out.length} checks did not run, because the probe they need could not be built:`);
  for (const r of unmeasured) console.log(`  ${r.name}: ${r.note}`);
  console.log("");
}

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exit(1);
}
console.log(
  `PASS: ${out.length - unmeasured.length} checks. A half authenticated session is not a session.` +
    (unmeasured.length ? ` ${unmeasured.length} could not be measured and are listed above.` : ""),
);
