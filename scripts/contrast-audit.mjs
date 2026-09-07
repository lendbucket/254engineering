/**
 * Runtime contrast and accessibility audit.
 *
 * Stands up `next dev`, loads one page of every template at a mobile (390px) and
 * a desktop (1280px) viewport, injects axe-core, and runs the WCAG 2.1 A/AA
 * ruleset. Contrast is the headline concern, because the palette carries a brass
 * accent that clears AA at one value and fails it at another, so the report
 * breaks `color-contrast` into its own section with the exact foreground,
 * background, and ratio for every failing node. Every other axe violation is
 * listed beneath it, which makes this a general accessibility gate as well.
 *
 *   npm run contrast-audit
 *   BASE_URL=http://localhost:3225 npm run contrast-audit   # use a running server
 *
 * THE FORM STATES ARE THE PART THAT NEEDS EXPLAINING
 * --------------------------------------------------
 * A form at rest has no error messages on it, and error text is exactly where a
 * contrast failure hides: it is small, it is semantically coloured, and nobody
 * screenshots it. So the templates below include entries that submit an empty
 * form first, which puts every inline error and the invalid field borders on
 * screen before axe runs. Auditing only the resting state would report the forms
 * as clean while the state a person actually sees when something goes wrong has
 * never been measured.
 */
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startNextServer } from "./lib/dev-server.mjs";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

import {
  createProbe,
  cookieFor,
  createPartnerProbe,
  partnerCookieFor,
  createCustomerProbe,
  customerCookieFor,
  destroyProbes,
  destroyPartnerProbes,
  destroyCustomerProbes,
} from "./lib/portal-probe.mjs";
import { allPages } from "./lib/surfaces.mjs";

const WIDTHS = [390, 1280];
const HEIGHT = 900;
const PORT = Number(process.env.CONTRAST_PORT || 3224);

/*
 * THE PORTAL, WHICH THIS AUDIT HAD NEVER MEASURED.
 *
 * Phase 11 gate 0: contrast-audit visited seventeen public marketing routes and
 * no portal route, so its "ALL GREEN" line was about the website while the
 * operations platform the firm runs on was never looked at. The same was true
 * of mobile-audit and forms-audit.
 *
 * Every one of these needs a signed in session, which is what portal: true
 * means. The pre-session screens are in the ordinary list below, because they
 * are reachable without one and there is no reason to spend an account on them.
 *
 * The role is on the template because what a screen RENDERS depends on it: an
 * administrator sees money columns a technician must never see, and auditing
 * only the administrator's view would leave the redacted variants unmeasured.
 */
/**
 * DERIVED FROM THE SURFACE INVENTORY, AS OF 2026-09-07.
 *
 * This was twenty four hand written portal templates. It carried no partner
 * screen and no account screen, so the partner portal, which shipped in Phase 9
 * Section 4, and the customer account surface, which shipped a phase before it,
 * had never been checked for contrast at all. Nobody decided that; the list was
 * written when the portal was the only signed in surface and nothing asked it
 * to grow.
 *
 * The role still travels with the screen, because what a screen RENDERS depends
 * on it: an administrator sees money columns a technician must never see, and
 * auditing only the administrator's view would leave the redacted variants
 * unmeasured. The inventory carries that per route.
 */
const PORTAL_TEMPLATES = allPages()
  .filter((p) => p.session !== "none")
  .map((p) => ({
    name: p.name,
    path: p.path,
    session: p.session,
    portal: p.session === "staff" ? p.role ?? "admin" : p.session,
  }));

/** The pages behind no door, which need no probe and are audited as they are. */
const OPEN_TEMPLATES = allPages()
  .filter((p) => p.session === "none")
  .map((p) => ({ name: p.name, path: p.path }));

const TEMPLATES = [
  { name: "home", path: "/" },
  { name: "about", path: "/about" },
  { name: "services hub", path: "/services" },
  { name: "service", path: "/services/windstorm-wpi-8" },
  { name: "coverage hub", path: "/coverage" },
  { name: "region", path: "/coverage/coastal-bend" },
  { name: "government", path: "/government" },
  { name: "insights hub", path: "/insights" },
  { name: "insight post", path: "/insights/engineer-of-record-texas" },
  { name: "careers hub", path: "/careers" },
  { name: "position: engineer", path: "/careers/professional-engineer" },
  { name: "position: technician", path: "/careers/field-inspection-technician" },
  { name: "contact", path: "/contact" },
  { name: "waitlist", path: "/waitlist" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "404", path: "/this-route-does-not-exist", expectStatus: 404 },
  /*
   * The screens a person meets BEFORE they hold a session, which gate 0 found
   * had never been measured by anything except horizontal scroll. The set
   * password screen is the first thing a new engineer or technician ever sees.
   */
  { name: "portal: sign in", path: "/portal/login" },
  { name: "portal: sign in, suspended", path: "/portal/login?suspended=1" },
  { name: "portal: sign in, after reset", path: "/portal/login?reset=1" },
  { name: "portal: set password, dead link", path: "/portal/set-password" },
  // The states a resting page never shows. See the note above.
  {
    name: "contact form errors",
    path: "/contact",
    submitEmpty: "Send message",
    expect: "Enter your name.",
  },
  {
    name: "waitlist form errors",
    path: "/waitlist",
    submitEmpty: "Join the waitlist",
    expect: "Enter your name.",
  },
  {
    // The careers application is five steps now, so the error state under test
    // is step one refusing to advance rather than a submit being refused.
    name: "application step errors",
    path: "/careers/field-inspection-technician",
    submitEmpty: "Continue",
    expect: "Enter your full name.",
  },
];

function log(msg) {
  process.stdout.write(msg + "\n");
}

async function auditPage(browser, base, t, width, sessions = {}) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT } });
  /*
   * A portal template without its session would redirect to the sign in screen
   * and be audited as the sign in screen, which is the shape of check this
   * repository keeps finding: green about the wrong page. The status assertion
   * below does not catch it, because the redirect resolves to a 200.
   */
  if (t.portal) {
    const probe = sessions[t.portal];
    if (!probe?.cookie) {
      return { error: `no ${t.portal} session, so this screen was not measured`, contrast: [], other: [] };
    }
    /*
     * THREE PRINCIPALS, THREE COOKIE SHAPES. A partner handed a staff cookie
     * lands on the partner sign in screen, which answers 200 and would be
     * audited as the screen it is not.
     */
    const cookies =
      t.session === "partner"
        ? partnerCookieFor(probe, base)
        : t.session === "customer"
          ? customerCookieFor(probe, base)
          : cookieFor(probe, base);
    await context.addCookies(cookies);
  }
  const page = await context.newPage();
  try {
    /*
     * NETWORKIDLE ON A PUBLIC PAGE, AND NOT ON A SIGNED IN ONE.
     *
     * Operator ruling, 2026-09-07: an audit whose red and green both depend on
     * how busy the machine is has stopped being evidence in either direction.
     *
     * A signed in shell renders a navigation of twenty five links, every one of
     * them a force-dynamic route that Next prefetches, so the network keeps
     * going long after the page is laid out and "no requests for 500ms" can
     * take longer than the timeout to arrive. On this machine it produced four
     * page errors on the dashboard and the billing screen, at both widths, on a
     * build where both answer in half a second. Those four screens were not
     * measured, and the same run an hour earlier had been green.
     *
     * axe reads the DOM, not the network. What it needs is a rendered page, so
     * a signed in route waits for the DOM and then for the shell to exist,
     * which is a positive signal that the page rendered rather than an absence
     * of traffic. Public pages keep networkidle: they carry photographs, and a
     * late loading image is exactly the thing that changes a contrast result.
     */
    const res = await page.goto(base + t.path, {
      waitUntil: t.portal ? "domcontentloaded" : "networkidle",
      timeout: 90_000,
    });
    if (t.portal) {
      await page
        .locator("[data-portal-scroll], main")
        .first()
        .waitFor({ state: "attached", timeout: 20_000 })
        .catch(() => {});
      await page.waitForTimeout(900);
    }
    const status = res ? res.status() : 0;
    const wanted = t.expectStatus ?? 200;
    if (status !== wanted) {
      return { error: `HTTP ${status}, expected ${wanted}`, contrast: [], other: [] };
    }

    /*
     * And it is the screen that was asked for. A rejected cookie redirects to a
     * sign in page which answers 200, and auditing it as the screen behind the
     * door is the defect this file's own header describes.
     */
    const landed = new URL(page.url()).pathname;
    if (t.portal && /\/(portal|partner|account)\/login$/.test(landed)) {
      return {
        error: `bounced to ${landed}, so this screen was not measured`,
        contrast: [],
        other: [],
      };
    }

    /*
     * A portal screen must not have bounced to sign in. Asserted rather than
     * assumed: an expired or rejected cookie produces a 200 on the login page,
     * and every contrast check would then pass while measuring nothing.
     */
    if (t.portal && new URL(page.url()).pathname.startsWith("/portal/login")) {
      return { error: "bounced to the sign in screen, so this screen was not measured", contrast: [], other: [] };
    }

    if (t.submitEmpty) {
      // Hydration has to have landed or the click does nothing and the page is
      // audited at rest while reporting as the error state.
      const button = page.getByRole("button", { name: new RegExp(t.submitEmpty, "i") }).first();
      await button.waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(1200);
      await button.click({ timeout: 15_000 });
      await page.waitForTimeout(600);
    }

    /*
     * Prove the page is the one we meant to audit.
     *
     * This matters more than its size suggests on the form-error entries. Every
     * way they can fail, hydration not landing, a renamed button, a validation
     * rule that stopped firing, ends in the same place: a 200 rendering a
     * perfectly clean form. That page has no contrast problems, so the run goes
     * green while auditing a state that never appeared. A false green is worse
     * than a red.
     */
    if (t.expect) {
      const text = await page.locator("body").innerText();
      if (!text.includes(t.expect)) {
        const head = text.replace(/\s+/g, " ").trim().slice(0, 90);
        return {
          error: `wrong state: expected ${JSON.stringify(t.expect)}, page begins "${head}"`,
          contrast: [],
          other: [],
        };
      }
    }

    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async () => {
      // @ts-expect-error axe is injected above
      return await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        resultTypes: ["violations"],
      });
    });

    const contrast = [];
    const other = [];
    for (const v of result.violations) {
      const bucket = v.id === "color-contrast" ? contrast : other;
      for (const node of v.nodes) {
        bucket.push({
          id: v.id,
          impact: node.impact || v.impact || "",
          target: Array.isArray(node.target) ? node.target.join(" ") : String(node.target),
          summary: node.failureSummary ? node.failureSummary.replace(/\s+/g, " ").trim() : "",
          data: node.any?.[0]?.data || null,
        });
      }
    }
    return { error: null, contrast, other };
  } catch (err) {
    return { error: `error: ${String(err.message).split("\n")[0]}`, contrast: [], other: [] };
  } finally {
    await context.close();
  }
}

function fmtContrast(n) {
  const d = n.data;
  if (d && d.fgColor && d.bgColor) {
    const ratio = d.contrastRatio != null ? `${d.contrastRatio}:1` : "?";
    const need = d.expectedContrastRatio || "?";
    return `${n.target}\n      fg ${d.fgColor} on bg ${d.bgColor}, ratio ${ratio}, needs ${need}${d.fontSize ? ` (${d.fontSize}, ${d.fontWeight})` : ""}`;
  }
  return `${n.target} - ${n.summary}`;
}

async function main() {
  const externalBase = process.env.BASE_URL;
  let server = null;
  let base = externalBase;

  try {
    if (externalBase) {
      log(`Using ${externalBase} (BASE_URL is set).\n`);
    } else {
      log(`Starting next dev on port ${PORT} ...`);
      server = await startNextServer({ port: PORT, command: "dev", timeoutMs: 180_000 });
      base = server.base;
    }
    log(`Server ready at ${base}\n`);

    /*
     * One account per role, made once for the whole run rather than per
     * template, because each sign in writes a permanent audit row.
     */
    const sessions = {};
    for (const role of ["admin", "engineer", "field_tech"]) {
      sessions[role] = await createProbe(base, role, "contrast-audit");
    }
    /*
     * Keyed by what the template asks for, which for the other two principals is
     * the session name rather than a role: a partner has no role and must never
     * appear in the staff authorization matrix.
     */
    sessions.partner = await createPartnerProbe(base, "contrast-audit");
    sessions.customer = await createCustomerProbe(base, "contrast-audit");

    const missing = Object.entries(sessions).filter(([, p]) => !p?.cookie).map(([r]) => r);
    if (missing.length) {
      log(`  probe sign in failed for: ${missing.join(", ")}`);
    }

    const browser = await chromium.launch();
    // Dedupe identical (template, target, colours) hits across widths so the
    // summary counts distinct problems rather than viewport repeats.
    const contrastSeen = new Map();
    const otherSeen = new Map();
    let pageErrors = 0;

    for (const t of [...TEMPLATES, ...OPEN_TEMPLATES, ...PORTAL_TEMPLATES]) {
      for (const w of WIDTHS) {
        const r = await auditPage(browser, base, t, w, sessions);
        if (r.error) {
          log(`  ${t.name} @${w}: ${r.error}`);
          pageErrors++;
          continue;
        }
        log(
          `  ${t.name.padEnd(22)} @${w}: contrast=${r.contrast.length === 0 ? "ok" : r.contrast.length + " FAIL"}  other-a11y=${r.other.length === 0 ? "ok" : r.other.length + " FAIL"}`,
        );
        for (const n of r.contrast) {
          const key = `${t.name}|${n.target}|${n.data?.fgColor}|${n.data?.bgColor}`;
          if (!contrastSeen.has(key)) contrastSeen.set(key, { template: t.name, ...n });
        }
        for (const n of r.other) {
          const key = `${t.name}|${n.id}|${n.target}`;
          if (!otherSeen.has(key)) otherSeen.set(key, { template: t.name, ...n });
        }
      }
    }
    await browser.close();

    /*
     * The probes go before anything is reported, and the removal is VERIFIED.
     * An audit that leaves a live staff account behind has done more harm than
     * the violation it was looking for.
     */
    const swept = await destroyProbes("contrast-audit");
    if (!swept.ok) pageErrors += 1;
    log("  probe accounts removed: " + (swept.ok ? "yes" : "NO, " + swept.note));

    /* The other two principals, each verified the same way. */
    const sweptPartners = await destroyPartnerProbes("contrast-audit");
    if (!sweptPartners.ok) pageErrors += 1;
    log("  partner probe removed: " + (sweptPartners.ok ? "yes" : "NO, " + sweptPartners.note));

    const sweptCustomers = await destroyCustomerProbes("contrast-audit");
    if (!sweptCustomers.ok) pageErrors += 1;
    log("  customer probe removed: " + (sweptCustomers.ok ? "yes" : "NO, " + sweptCustomers.note));

    log("\n================ COLOR CONTRAST (WCAG AA) ================");
    if (contrastSeen.size === 0) {
      log("  PASS: no color-contrast violations on any template.");
    } else {
      log(`  ${contrastSeen.size} distinct contrast violation(s):`);
      for (const n of contrastSeen.values()) log(`  - [${n.template}] ${fmtContrast(n)}`);
    }

    log("\n================ OTHER A11Y (WCAG A/AA) ================");
    if (otherSeen.size === 0) {
      log("  PASS: no other WCAG A/AA violations on any template.");
    } else {
      log(`  ${otherSeen.size} distinct violation(s):`);
      for (const n of otherSeen.values()) log(`  - [${n.template}] ${n.id} (${n.impact}): ${n.target}`);
    }

    log("\n================ RESULT ================");
    log(
      `${TEMPLATES.length + OPEN_TEMPLATES.length} public and pre-session templates plus ` +
        `${PORTAL_TEMPLATES.length} signed in screens across ` +
        `${new Set(PORTAL_TEMPLATES.map((t) => t.session)).size} principals, at ${WIDTHS.join(" and ")}.`,
    );
    const total = contrastSeen.size + otherSeen.size;
    if (total === 0 && pageErrors === 0) {
      log("ALL GREEN. No WCAG A/AA violations across templates.");
      process.exitCode = 0;
    } else {
      log(
        `${contrastSeen.size} contrast + ${otherSeen.size} other violation(s)${pageErrors ? `, ${pageErrors} page error(s)` : ""}.`,
      );
      process.exitCode = 1;
    }
  } catch (err) {
    log(`Harness error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (server) await server.stop();
  }
}

main();
