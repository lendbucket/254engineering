/**
 * =============================================================================
 * THE EXPLORATORY SWEEP. EVERY PORTAL SCREEN, EVERY STAFF ROLE, TWO WIDTHS.
 * =============================================================================
 *
 * Operator order, 2026-09-24, item 6: "a full exploratory audit of every
 * portal, run against local and development only. The goal is to find what
 * nobody has thought of, not to re-run the board."
 *
 * SO IT DELIBERATELY DOES NOT MEASURE WHAT THE BOARD MEASURES. Contrast, tap
 * targets, horizontal overflow and page height all have audits, and a second
 * opinion on them would be a second answer that can disagree. This looks at
 * four things nothing on the board looks at:
 *
 *   1  WHAT THE BROWSER SAID. Console errors and uncaught page errors, per
 *      role, per screen. A hydration mismatch, a thrown client handler or a
 *      failed fetch is invisible to every audit in this repository: they all
 *      read the DOM and the status code, and both are fine on a screen whose
 *      JavaScript died. This is the same shape as the comms defect found by
 *      reading a green board's SERVER log, one process further out.
 *
 *   2  WHAT MONEY EACH ROLE CAN SEE. Every money figure rendered on every
 *      screen, recorded per role, so the set can be READ rather than asserted.
 *      The ruling of 2026-09-24 is that the engineer sees no money except his
 *      own pay; redactFile closed the file and the production report closed
 *      today, and nothing has ever swept the other twenty-odd screens.
 *
 *   3  WHAT A SCREEN SAYS WHEN IT HAS NOTHING. A screen rendering as an
 *      almost empty shell for a role is not an error and not a refusal, so
 *      nothing catches it, and a person meets a page that looks broken.
 *
 *   4  HOW LONG IT TOOK. /portal/accounts has stalled for fifty seconds at
 *      least once and measured fine on the next run, and CLAUDE.md records why
 *      that matters: an intermittent stall can only be caught by an instrument
 *      that is already running when one arrives.
 *
 * IT WRITES NOTHING except its probe accounts, and destroys those. It reads a
 * server it is pointed at with BASE_URL and it never points at production: the
 * probes are created through the audit client, which refuses production by
 * construction.
 *
 *   BASE_URL=http://localhost:4318 npx tsx scripts/exploratory-portal-audit.mjs
 */

process.loadEnvFile?.(".env.local");

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { routesOf, surfaces } from "./lib/surfaces.mjs";
import { createProbe, cookieFor, destroyProbes, probeFault } from "./lib/portal-probe.mjs";
import { DEFAULT_ROLES } from "../src/lib/ops-authz.ts";
import { PORTS } from "./lib/ports.mjs";

const BASE = process.env.BASE_URL ?? `http://localhost:${PORTS.exploratory}`;
const LABEL = "explore";
const OUT = process.env.EXPLORE_OUT ?? join("C:/Users/salon/AppData/Local/Temp/claude", "explore");
const WIDTHS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 900 },
];

/* Every money figure a person would read off the screen. Dollars with cents,
 * which is how this platform renders every one of them, so a bare integer in a
 * table is not mistaken for a price. */
const MONEY = /\$[0-9][0-9,]*\.[0-9]{2}/g;

const findings = [];
const note = (kind, role, route, width, detail) =>
  findings.push({ kind, role, route, width, detail });

if (/254engineering\.com|vercel\.app/.test(BASE)) {
  console.log("REFUSED: this sweep signs accounts in and is for local and development only.");
  process.exitCode = 1;
} else {
  mkdirSync(OUT, { recursive: true });

  const portal = surfaces().find((s) => s.key === "portal");
  /* The SURFACE OBJECT, never the string. routesOf reads properties off it, and
   * a string yields an empty array and a green run over nothing, which is
   * exactly how a live-deployment round once passed having fetched one page. */
  const routes = routesOf(portal);

  console.log("");
  console.log("============ THE EXPLORATORY SWEEP ============");
  console.log(`base ${BASE}`);
  console.log(`${routes.length} portal routes, ${DEFAULT_ROLES.length} roles, ${WIDTHS.length} widths`);
  console.log("");

  if (routes.length < 10) {
    console.log(`REFUSED: only ${routes.length} routes were derived, which is not the portal.`);
    process.exitCode = 1;
  } else {
    const browser = await chromium.launch();
    const moneyByRole = new Map();

    for (const role of DEFAULT_ROLES) {
      const probe = await createProbe(BASE, role.key, LABEL);
      const fault = probeFault([probe]);
      if (fault) {
        note("no probe", role.key, "", "", fault);
        console.log(`  COULD NOT TELL: ${role.key}: ${fault}`);
        continue;
      }

      const seen = new Set();
      moneyByRole.set(role.key, seen);

      for (const width of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width: width.width, height: width.height },
        });
        /* cookieFor returns the ARRAY Playwright wants, so it is passed as is.
         * Wrapping it in another array nests it and Playwright reports a cookie
         * with no name, which reads like a session problem and is a shape one. */
        const cookies = cookieFor(probe, BASE);
        if (cookies.length === 0) {
          note("no cookie", role.key, "", width.name, "the probe signed in but no session cookie came back");
          await context.close();
          continue;
        }
        await context.addCookies(cookies);
        const page = await context.newPage();

        const consoleErrors = [];
        const pageErrors = [];
        page.on("console", (m) => {
          if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
        });
        page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));

        for (const route of routes) {
          consoleErrors.length = 0;
          pageErrors.length = 0;

          const began = Date.now();
          let status = 0;
          try {
            const response = await page.goto(`${BASE}${route}`, {
              waitUntil: "domcontentloaded",
              timeout: 45_000,
            });
            status = response?.status() ?? 0;
            await page.waitForTimeout(400);
          } catch (e) {
            note("navigation failed", role.key, route, width.name, String(e).slice(0, 200));
            continue;
          }
          const took = Date.now() - began;

          /*
           * WHERE IT ACTUALLY LANDED, AND THE FIRST RUN OF THIS SWEEP DID NOT
           * RECORD IT. Half the portal redirects a role it refuses: /portal/
           * accounts sends anybody without accounts.manage to /portal. So the
           * first run reported "engineer sees a money figure on
           * /portal/accounts" when the engineer was looking at /portal, and
           * reported money on /portal/login, which has no money on it at all.
           *
           * A measurement labelled with the route ASKED FOR rather than the
           * page received is this repository's recurring defect wearing a
           * redirect: a thing looking at the right subject in the wrong place.
           */
          const landed = new URL(page.url()).pathname;
          if (landed !== route) note("redirected", role.key, route, width.name, `to ${landed}`);

          const text = await page.evaluate(() => document.body?.innerText ?? "");

          /*
           * A 404 HERE IS USUALLY CORRECT AND MUST NOT BE READ AS A DEFECT.
           * CLAUDE.md, 2026-09-19: four audits reported /portal/protocols/
           * rc-001 as broken while roles-audit watched an engineer open it,
           * and both were right. A screen gated on holdsLicence answers
           * notFound to an administrator, which is the refusal working.
           *
           * So it is counted under its own name rather than "status", and a
           * 500 is kept separate, because that one is never a refusal.
           */
          if (status >= 500) note("server error", role.key, route, width.name, `HTTP ${status}`);
          else if (status >= 400) note("refused (expected for most roles)", role.key, route, width.name, `HTTP ${status}`);
          if (took > 8000) note("slow", role.key, route, width.name, `${took}ms`);
          for (const line of pageErrors) note("page error", role.key, route, width.name, line);
          for (const line of consoleErrors) note("console error", role.key, route, width.name, line);

          /* Words, not bytes: an app shell with a nav and nothing else reads as
           * a broken page to the person looking at it. */
          const words = text.trim().split(/\s+/).filter(Boolean).length;
          if (words < 40 && status < 400) {
            note("almost empty", role.key, route, width.name, `${words} words`);
          }

          /* Keyed on where the browser ENDED UP, so a refusal's landing page
           * is never reported as money visible on the route that refused. */
          for (const m of text.match(MONEY) ?? []) seen.add(`${landed}  ${m}`);

          if (width.name === "1280") {
            const safe = route.replace(/\//g, "_") || "_root";
            await page.screenshot({
              path: join(OUT, `${role.key}${safe}.png`),
              fullPage: false,
            });
          }
        }

        await context.close();
      }

      console.log(`  swept ${role.key}: ${routes.length} routes at two widths`);
    }

    await browser.close();
    await destroyProbes(LABEL);

    // ------------------------------------------------------------- the report

    console.log("");
    console.log("---- what the browser said, which nothing on the board reads ----");
    const byKind = new Map();
    for (const f of findings) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
    for (const [kind, list] of byKind) {
      console.log(`  ${kind}: ${list.length}`);
      for (const f of list.slice(0, 12)) {
        console.log(`    ${f.role} ${f.route} ${f.width}  ${f.detail}`);
      }
      if (list.length > 12) console.log(`    and ${list.length - 12} more`);
    }
    if (findings.length === 0) console.log("  nothing");

    console.log("");
    console.log("---- what money each role can see ----");
    for (const [role, seen] of moneyByRole) {
      console.log(`  ${role}: ${seen.size} money figure(s) on screen`);
      for (const line of [...seen].sort().slice(0, 30)) console.log(`    ${line}`);
      if (seen.size > 30) console.log(`    and ${seen.size - 30} more`);
    }

    writeFileSync(
      join(OUT, "findings.json"),
      JSON.stringify(
        { base: BASE, findings, money: Object.fromEntries([...moneyByRole].map(([k, v]) => [k, [...v]])) },
        null,
        2,
      ),
    );
    console.log("");
    console.log(`screenshots and findings.json in ${OUT}`);
  }
}
