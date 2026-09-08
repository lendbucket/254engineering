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

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { routesOf, apisOf, surfacesWhere } from "./lib/surfaces.mjs";
import { auditClient } from "./lib/db-target.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";

/** The only paths a pending session may reach. Mirrors src/proxy.ts. */
const EXPECTED_MFA_PATHS = ["/portal/mfa", "/portal/mfa/enrol", "/api/portal/mfa"];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

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
        const makeProbe = async (roleKey, tag) => {
          if (!db) return { cookie: null, redirect: null, id: null };
          const email = `mfaprobe-${tag}-${stamp}@mobile-audit.invalid`;
          const password = `mfaprobe-${tag}-${stamp}-enrolment-screen`;
          const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
          if (!made.data?.user) return { cookie: null, redirect: null, id: null };
          const id = made.data.user.id;
          probeIds.push(id);
          const inserted = await db.from("eng_profiles").insert({
            id,
            email,
            display_name: `MFA Probe ${tag}`,
            role: roleKey,
            status: "active",
          });
          if (inserted.error) return { cookie: null, redirect: null, id };
          const res = await fetch(`${BASE}/api/portal/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const body = await res.json().catch(() => null);
          return {
            cookie: (res.headers.get("set-cookie") ?? "").match(/eng_ops=([^;]+)/)?.[1] ?? null,
            redirect: typeof body?.redirect === "string" ? body.redirect : null,
            id,
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
        const required = roleMade ? await makeProbe(REQUIRED_ROLE, "required") : { cookie: null, redirect: null };

        const probeCookie = optional.cookie;

        rec(
          "an un-enrolled probe on an optional role signed in",
          Boolean(probeCookie),
          probeCookie ? "" : "without one the enrolment screen cannot be walked at all",
        );

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
        rec(
          "an optional role with no factor is OFFERED enrolment",
          optional.redirect === "/portal/mfa/enrol",
          optional.redirect ?? "no redirect came back",
        );

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
          rec("and can DECLINE into the portal", false, "no optional probe to try it with");
        }

        /*
         * ------------------------------------------------------------------
         * A REQUIRED ROLE STILL CANNOT.
         *
         * The other half of the same ruling, and the reason the requirement is
         * still worth having in the code. Same sign in, same screen, and the
         * portal must refuse.
         */
        rec(
          "a required role with no factor is sent to enrolment",
          required.redirect === "/portal/mfa/enrol",
          required.redirect ?? (roleMade ? "no redirect came back" : "no required role was created"),
        );

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
          rec("and CANNOT decline into the portal", false, "no required probe to try it with");
          rec("and is not shown a way out of it", false, "no required probe to try it with");
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

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. A half authenticated session is not a session.`);
