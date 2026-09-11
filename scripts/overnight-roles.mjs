// @runtime react-server
/**
 * ROUND 3: SEVEN ROLES, EVERY SCREEN EACH ONE REACHES, AND ONE IT DOES NOT.
 *
 *   npx tsx --conditions=react-server scripts/overnight-roles.mjs
 *
 * Development only. createProbe goes through db-target's neverProduction flag,
 * which is checked before ALLOW_PRODUCTION_DB is even read, so this cannot be
 * pointed at production by an environment variable or by a mistake.
 *
 * WHAT THIS ROUND IS FOR, AND WHY IT IS NOT AN AUDIT
 * --------------------------------------------------
 * The board measures contrast, overflow, tap targets and the perimeter, and it
 * is green. Phase 12 Section 2 found nine defects in one pass and FOUR of them
 * came from reading output rather than from any check: a sales tile counting a
 * seeded client, an export manifest saying "Real records only" above eighteen
 * demonstration rows, a dashboard reporting margin that was entirely seeded,
 * and amounts written in cents. Two of those sat behind checks that had just
 * been widened to look straight at them.
 *
 * So this round photographs and TRANSCRIBES. It records, for every screen every
 * role can open, at 390 and at 1280: the status, the heading, whether anything
 * on the page is empty or broken in words a person would notice, and the file
 * the screenshot went to. The reading is done afterwards, by a person or by
 * something reading like one, against the transcript and the images.
 *
 * WHERE THE LIST OF SCREENS COMES FROM
 * -------------------------------------
 * The rendered shell, not a list here and not a re-derivation of the
 * authorization matrix.
 *
 * src/components/portal/nav.ts states why: a hand written nav per role is a
 * second authorization model, and the first time the two drift a link appears
 * for somebody who is then denied when they click it. Re-deriving the same
 * predicate in this file would be a THIRD account of it. What the shell
 * actually rendered is the platform's own answer to "what does this role
 * reach", and asking it that way turns the drift into a finding rather than
 * into a blind spot: a link the shell offered that then refuses is recorded as
 * exactly that.
 *
 * NAV is imported for one thing only, which is the opposite question. "One
 * screen it does not reach" needs a destination this role was NOT offered, and
 * that has to come from the full list of destinations.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startNextServer } from "./lib/dev-server.mjs";
import { createProbe, cookieFor, destroyProbes } from "./lib/portal-probe.mjs";

const { NAV } = await import("../src/components/portal/nav.ts");
const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");

const PORT = Number(process.env.ROUND3_PORT || 3228);
const WIDTHS = [390, 1280];
const OUT = path.join(process.cwd(), "screenshots", "overnight");
const LABEL = "overnight-round3";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const findings = [];
/** One line per screen actually opened. This is the transcript, and it is the point. */
const transcript = [];

const slug = (route) =>
  route === "/portal" ? "dashboard" : route.replace(/^\/portal\/?/, "").replace(/[/?=&]/g, "-") || "root";

/**
 * WHAT A PERSON WOULD NOTICE, read off the rendered page.
 *
 * Deliberately not a pass or a fail. Each of these is a thing worth LOOKING at
 * in the screenshot, and several of them are legitimate: an empty queue on a
 * database with no work in it is correct, and a screen saying so in a sentence
 * is better than one showing a blank panel. What is not acceptable is not
 * knowing which of the two it is, which is what a green board over an
 * unphotographed screen amounts to.
 */
function readAsAPerson(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const notes = [];

    const h1 = document.querySelector("h1")?.innerText?.trim() ?? "";
    if (!h1) notes.push("NO H1: nothing on this screen says what it is");

    /* The shapes that mean a value did not arrive. A person reads these as a
     * broken product even when the data is genuinely absent. */
    for (const bad of ["undefined", "NaN", "[object Object]", "Invalid Date", "null"]) {
      if (text.includes(bad)) notes.push(`THE WORD "${bad}" IS ON THE SCREEN`);
    }

    /* Money written in cents reaches an accountant's spreadsheet as 67500.
     * Phase 12 Section 2 found exactly this in an export. */
    const bareCents = text.match(/\b\d{5,}\b(?!\s*(?:counties|county))/g);
    if (bareCents) notes.push(`FIVE DIGIT BARE NUMBERS: ${[...new Set(bareCents)].slice(0, 5).join(", ")}`);

    /* A demonstration record on a screen that does not say it is one. */
    const saysDemo = /demonstration|sample|demo data|seeded/i.test(text);
    const looksDemo = /\bDemo\b|example\.com|\.invalid\b/i.test(text);
    if (looksDemo && !saysDemo) notes.push("DEMONSTRATION DATA IS SHOWN AND THE SCREEN DOES NOT SAY SO");

    /* An empty screen with no sentence explaining the emptiness. */
    const words = text.trim().split(/\s+/).length;
    if (words < 40) notes.push(`ALMOST NOTHING ON THE PAGE (${words} words)`);

    /* A framework error page. */
    if (/Application error|Unhandled Runtime Error|call stack/i.test(text)) {
      notes.push("A FRAMEWORK ERROR IS RENDERED WHERE THE SCREEN SHOULD BE");
    }

    /* Controls a person can see and cannot use. */
    const dead = [...document.querySelectorAll("button")].filter(
      (b) => !b.disabled && !b.getAttribute("type") && !b.onclick && b.form === null,
    ).length;

    return {
      h1,
      title: document.title,
      words,
      notes,
      dead,
      /* The first sentence, which is what a person reads before anything else. */
      lead: text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4),
      /* What the shell offered this role. */
      nav: [...document.querySelectorAll("a[href^='/portal']")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && !h.includes("?")),
    };
  });
}

/* ------------------------------------------------------------------ the run */

fs.mkdirSync(OUT, { recursive: true });

console.log("");
console.log("========== ROUND 3: SEVEN ROLES, READ AS A PERSON ==========");
console.log("");

const ROLES = DEFAULT_ROLES.map((r) => ({ key: r.key, landing: r.landingPath }));
console.log(`${ROLES.length} roles from DEFAULT_ROLES: ${ROLES.map((r) => r.key).join(", ")}`);
console.log(`${NAV.length} destinations in NAV, ${WIDTHS.join(" and ")} px, into ${path.relative(process.cwd(), OUT)}/`);
console.log("");

let server = null;
let browser = null;

try {
  console.log(`Starting next dev on port ${PORT} ...`);
  server = await startNextServer({ port: PORT, command: "dev", timeoutMs: 240000 });
  const base = server.base;
  console.log(`Server ready at ${base}\n`);

  browser = await chromium.launch();

  for (const role of ROLES) {
    console.log(`--- ${role.key} `.padEnd(70, "-"));
    const dir = path.join(OUT, role.key);
    fs.mkdirSync(dir, { recursive: true });

    const probe = await createProbe(base, role.key, LABEL);
    if (!probe?.cookie) {
      rec(`${role.key}: a probe could be created and signed in`, false, "no cookie, so nothing below ran");
      findings.push(`${role.key}: could not be signed in, so this role was NOT looked at`);
      continue;
    }
    rec(`${role.key}: a probe could be created and signed in`, true, probe.email);

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(cookieFor(probe, base));
    const page = await ctx.newPage();

    /* THE LANDING PATH THE ROLE DECLARES. A role sent somewhere it cannot open
     * is a sign in that ends in a refusal, which is the worst first screen a
     * platform has. */
    const landRes = await page.goto(base + role.landing, { waitUntil: "networkidle", timeout: 120000 });
    const landStatus = landRes?.status() ?? 0;
    const landed = await readAsAPerson(page);
    rec(
      `${role.key}: its declared landing path opens (${role.landing})`,
      landStatus === 200 && !/not permitted|no access|refused/i.test(landed.lead.join(" ")),
      `HTTP ${landStatus}, h1 "${landed.h1}"`,
    );

    /* WHAT THE SHELL OFFERED, which is the platform's own answer. */
    const offered = [...new Set(landed.nav)].filter((h) => NAV.some((n) => n.href === h)).sort();
    const notOffered = NAV.map((n) => n.href).filter((h) => !offered.includes(h));
    console.log(`  the shell offered ${offered.length} of ${NAV.length} destinations`);
    rec(
      `${role.key}: the shell offered a destination at all`,
      offered.length > 0,
      offered.join(" ") || "the sidebar rendered nothing this role may open",
    );

    for (const route of offered) {
      for (const width of WIDTHS) {
        const c = await browser.newContext({ viewport: { width, height: 900 } });
        await c.addCookies(cookieFor(probe, base));
        const p = await c.newPage();
        const consoleErrors = [];
        p.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 120)));
        let status = 0;
        try {
          const r = await p.goto(base + route, { waitUntil: "networkidle", timeout: 120000 });
          status = r?.status() ?? 0;
        } catch (err) {
          transcript.push({ role: role.key, route, width, status: 0, error: String(err.message).split("\n")[0] });
          findings.push(`${role.key} ${route} @${width}: did not load`);
          await c.close();
          continue;
        }
        const seen = await readAsAPerson(p);
        const file = path.join(dir, `${slug(route)}-${width}.png`);
        await p.screenshot({ path: file, fullPage: true });

        transcript.push({
          role: role.key,
          route,
          width,
          status,
          h1: seen.h1,
          words: seen.words,
          lead: seen.lead,
          notes: seen.notes,
          consoleErrors: [...new Set(consoleErrors)],
          shot: path.relative(process.cwd(), file),
        });

        /*
         * THE DRIFT nav.ts WARNS ABOUT, and it is a real finding rather than a
         * note: the shell offered this link and the thing behind it refused.
         */
        if (status !== 200) {
          findings.push(
            `${role.key} ${route} @${width}: THE SHELL OFFERED THIS LINK AND IT ANSWERS HTTP ${status}. ` +
              "nav.ts exists so a link appears exactly when the thing behind it is permitted; this is the drift it names.",
          );
        }
        for (const n of seen.notes) findings.push(`${role.key} ${route} @${width}: ${n}`);
        for (const e of [...new Set(consoleErrors)]) findings.push(`${role.key} ${route} @${width}: console error: ${e}`);

        console.log(
          `  ${route.padEnd(26)} @${String(width).padEnd(5)} HTTP ${status}  ${String(seen.words).padStart(4)}w  ${seen.h1.slice(0, 40)}`,
        );
        await c.close();
      }
    }

    /*
     * AND ONE IT DOES NOT REACH.
     *
     * The refusal has to be READ, not inferred from a status. A screen that
     * answers 200 and says nothing is the worst of the three outcomes, because
     * a person cannot tell a locked door from a broken one, and the repository
     * has already recorded that exact trap on the order status page.
     */
    const denied = notOffered[0];
    if (!denied) {
      rec(`${role.key}: there is a destination it does not reach`, false, "it was offered every destination in NAV");
    } else {
      for (const width of WIDTHS) {
        const c = await browser.newContext({ viewport: { width, height: 900 } });
        await c.addCookies(cookieFor(probe, base));
        const p = await c.newPage();
        const r = await p.goto(base + denied, { waitUntil: "networkidle", timeout: 120000 }).catch(() => null);
        const status = r?.status() ?? 0;
        const seen = await readAsAPerson(p);
        const file = path.join(dir, `${slug(denied)}-DENIED-${width}.png`);
        await p.screenshot({ path: file, fullPage: true });
        const body = seen.lead.join(" ");
        const saysNo = /not permitted|do not have|cannot|no access|refused|sign in|Professional Engineer/i.test(body);
        const bounced = status === 200 && !p.url().includes(denied);

        transcript.push({
          role: role.key,
          route: denied,
          width,
          status,
          denied: true,
          landedAt: p.url().replace(base, ""),
          h1: seen.h1,
          lead: seen.lead,
          shot: path.relative(process.cwd(), file),
        });

        if (width === WIDTHS[0]) {
          rec(
            `${role.key}: a destination it was NOT offered refuses in words or sends it somewhere (${denied})`,
            saysNo || bounced || status >= 400,
            saysNo
              ? `it says so: "${body.slice(0, 80)}"`
              : bounced
                ? `it was sent to ${p.url().replace(base, "")}`
                : `HTTP ${status} AND THE PAGE READS AS AN ORDINARY SCREEN: "${body.slice(0, 80)}"`,
          );
          if (!saysNo && !bounced && status < 400) {
            findings.push(
              `${role.key} ${denied}: NOT OFFERED IN THE SHELL AND OPENS ANYWAY, HTTP ${status}, reading as an ordinary screen. ` +
                "A door the nav hides and the route does not close is a door.",
            );
          }
        }
        console.log(`  ${denied.padEnd(26)} @${String(width).padEnd(5)} HTTP ${status}  DENIED-CHECK  landed ${p.url().replace(base, "")}`);
        await c.close();
      }
    }

    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  const swept = await destroyProbes(LABEL);
  rec("every probe account this round made was removed", swept.ok && swept.left === 0, JSON.stringify(swept));
  if (server) await server.stop();
}

/* -------------------------------------------------------------- the record */

const tf = path.join(OUT, "transcript.json");
fs.writeFileSync(tf, JSON.stringify(transcript, null, 2));

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");
console.log(`${transcript.length} screens opened and photographed. Transcript: ${path.relative(process.cwd(), tf)}`);
console.log("");
console.log(`--- ${findings.length} thing(s) worth looking at:`);
for (const f of findings) console.log(`  ${f}`);
console.log("");

const failed = out.filter((r) => !r.ok);
console.log(
  failed.length
    ? `ROUND 3: ${failed.length} check(s) failed, ${findings.length} finding(s).`
    : `ROUND 3: ${out.length} checks, ${findings.length} finding(s) to read.`,
);
process.exitCode = failed.length ? 1 : 0;
