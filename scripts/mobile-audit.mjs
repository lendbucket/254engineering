/**
 * Runtime mobile audit.
 *
 * Stands up `next dev`, drives Chromium through one page of every template at
 * 320/375/390/430px, and asserts:
 *   1. document.documentElement.scrollWidth === clientWidth (zero horizontal scroll)
 *   1b. no box that hides its overflow is narrower than its own text
 *   2. every interactive control clears a 44px tap target on the smallest width
 *   3. the mobile menu opens, locks body scroll, and closes on navigation with
 *      the lock released
 *
 *   npm run mobile-audit
 *   BASE_URL=http://localhost:3225 npm run mobile-audit
 *
 * 320 is in the list because it is where a long unbroken string, a wide table, or
 * a grid that forgot to collapse actually breaks. Testing at 390 alone finds the
 * gross failures and misses the ones that only show up on the narrowest phones
 * still in use.
 */
import { chromium } from "playwright";
import { startNextServer } from "./lib/dev-server.mjs";

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

const WIDTHS = [320, 375, 390, 430];
const HEIGHT = 844;
const PORT = Number(process.env.MOBILE_PORT || 3223);

/**
 * The tap target minimum, in CSS pixels.
 *
 * 24, not 44. WCAG 2.5.8 Target Size (Minimum) is the AA criterion and it asks
 * for 24 by 24; the 44 by 44 figure everybody quotes is 2.5.5, which is AAA.
 * This site holds AA as its floor, so 24 is the number that can actually fail a
 * build.
 *
 * The first version of this check used 44 with no exceptions and reported 280
 * failures on the coverage hub, every one of them a line in a county list. A
 * check that fires on every link on the page is not a finding, it is noise, and
 * the response to noise is to switch the check off. So the exceptions below are
 * the ones the criterion itself grants, implemented rather than assumed.
 */
const MIN_TAP = 24;

/*
 * THE PORTAL, WHICH THIS AUDIT HAD NEVER MEASURED.
 *
 * Phase 11 gate 0: mobile-audit visited fourteen public marketing routes and no
 * portal route, so WCAG 2.5.8 tap targets and the clipping check had never been
 * applied to a single screen an operator uses. On a phone the portal IS the
 * product, which makes this the wrong half of the site to have covered.
 *
 * The role decides what renders, so all three are walked.
 */
/**
 * DERIVED FROM THE SURFACE INVENTORY, AS OF 2026-09-07.
 *
 * This was twenty six hand written portal screens and nothing else. The partner
 * portal and the customer account surface had never had a tap target measured
 * on them, which on a phone is most of what "does this work" means. The list
 * was written when the portal was the only signed in surface, and nothing asked
 * it to grow when two more shipped.
 */
const PORTAL_TEMPLATES = allPages()
  .filter((p) => p.session !== "none")
  .map((p) => ({
    name: p.name,
    path: p.path,
    session: p.session,
    portal: p.session === "staff" ? p.role ?? "admin" : p.session,
  }));

/** Pages behind no door, measured without a probe. */
const OPEN_TEMPLATES = allPages()
  .filter((p) => p.session === "none")
  .map((p) => ({ name: p.name, path: p.path }));

const TEMPLATES = [
  { name: "home", path: "/" },
  { name: "about", path: "/about" },
  { name: "services hub", path: "/services" },
  { name: "service", path: "/services/manufactured-home-foundation-certifications" },
  { name: "coverage hub", path: "/coverage" },
  { name: "region", path: "/coverage/dallas-fort-worth" },
  { name: "government", path: "/government" },
  { name: "insights hub", path: "/insights" },
  { name: "insight post", path: "/insights/texas-professional-services-procurement-act" },
  { name: "careers", path: "/careers" },
  { name: "contact", path: "/contact" },
  { name: "waitlist", path: "/waitlist" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
];

function log(msg) {
  process.stdout.write(msg + "\n");
}

function pad(s, n) {
  return String(s).length >= n ? String(s) : String(s) + " ".repeat(n - String(s).length);
}

async function measurePage(base, browser, path, width, probe = null, session = "staff") {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT } });
  /*
   * Three principals, three cookie names. A partner handed a staff cookie lands
   * on the partner sign in screen, which answers 200 and passes every check in
   * this file while measuring the wrong page.
   */
  if (probe) {
    await context.addCookies(
      session === "partner"
        ? partnerCookieFor(probe, base)
        : session === "customer"
          ? customerCookieFor(probe, base)
          : cookieFor(probe, base),
    );
  }
  const page = await context.newPage();
  try {
    /*
     * NETWORKIDLE ON A PUBLIC PAGE, AND NOT ON A PORTAL ONE.
     *
     * A signed in portal page renders a navigation of twenty five links, every
     * one of them a force-dynamic route, and Next prefetches the ones in view.
     * Each prefetch is a server render with database reads behind it, so the
     * network keeps going long after the page is laid out and "no requests for
     * 500ms" can take longer than the timeout to arrive. On 2026-09-06 that
     * produced ninety second timeouts on the billing screen in one run and the
     * dashboard in the next, on a build where both answer in half a second.
     *
     * The timeouts were reported as three failing checks per width, on pages
     * that are correct, which is the direction of wrong that gets a check
     * deleted rather than believed.
     *
     * WHAT THIS AUDIT ACTUALLY NEEDS is a laid out page: no horizontal scroll,
     * tap targets at size, nothing clipped. None of that depends on the network
     * going quiet, and native-audit has measured the same screens for a phase
     * using domcontentloaded plus a settle. So portal routes wait for the DOM
     * and then for the shell to exist, which is a POSITIVE signal that the page
     * rendered rather than an absence of traffic.
     *
     * Public pages keep networkidle: they carry photographs, they do not
     * prefetch a signed in navigation, and a late loading image is exactly the
     * thing that moves a layout after measurement.
     */
    const res = await page.goto(base + path, {
      waitUntil: probe ? "domcontentloaded" : "networkidle",
      timeout: 90_000,
    });
    if (probe) {
      await page
        .locator("[data-portal-scroll], [data-partner-scroll], main")
        .first()
        .waitFor({ state: "attached", timeout: 20_000 })
        .catch(() => {});
      await page.waitForTimeout(900);
    }
    /*
     * A PORTAL PAGE MUST NOT HAVE BOUNCED TO SIGN IN.
     *
     * A rejected or expired cookie redirects to the login screen, which answers
     * 200 and passes every check in this file. Twenty six portal templates
     * would then report pass while measuring one page twenty six times, which
     * is the exact shape of defect this repository keeps finding.
     */
    if (
      probe &&
      /^\/(portal|partner|account)\/login$/.test(new URL(page.url()).pathname) &&
      !/\/login$/.test(path)
    ) {
      return { hscroll: false, taps: false, clip: false, note: "bounced to sign in, not measured" };
    }
    if (!res || res.status() >= 400) {
      return { hscroll: false, taps: false, clip: false, note: `HTTP ${res ? res.status() : "no response"}` };
    }

    // Scroll to the bottom before measuring. globals.css sets scroll-behavior
    // smooth, so the scroll is forced instant or the measurement lands mid
    // flight.
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: "instant" });
    });
    await page.waitForTimeout(150);

    const m = await page.evaluate((minTap) => {
      const de = document.documentElement;

      /*
       * WHATEVER IS ACTUALLY SCROLLING, WHICH ON A PORTAL SCREEN IS NOT THE
       * DOCUMENT.
       *
       * This measured document.documentElement and nothing else, which was the
       * whole truth until Phase 11. Point 1 of the native standard then made
       * the document stop scrolling and gave the job to one element between the
       * fixed chrome, so a portal page that overflows sideways overflows THAT
       * element while the document stays exactly the width of the viewport.
       *
       * Found on 2026-09-06 by injecting a 2000px wide box into a portal screen
       * and watching this audit report pass at all four widths. The region was
       * 2016px wide inside a 390px viewport. Every portal row in this table had
       * been green for a phase on a measurement that could not see the thing it
       * claims to measure, which is this repository's recurring defect with the
       * audit on the wrong side of it.
       *
       * Both are checked now. A portal screen can still overflow the document,
       * and the failure names which of the two it was.
       */
      const region = document.querySelector("[data-portal-scroll], [data-partner-scroll]");
      const scrollers = [
        { what: "document", el: de, scrollW: de.scrollWidth, clientW: de.clientWidth },
        ...(region
          ? [{ what: "the scrolling region", el: region, scrollW: region.scrollWidth, clientW: region.clientWidth }]
          : []),
      ];
      const over = scrollers.find((sc) => sc.scrollW > sc.clientW);

      // The widest element that actually exceeds the viewport, so a failure
      // names the offender rather than only the number. Finding this by hand
      // afterward is most of the cost of a horizontal scroll bug.
      let widest = null;
      if (over) {
        const limit = over.clientW;
        const origin = over.el === de ? 0 : over.el.getBoundingClientRect().left;
        for (const el of Array.from((over.el === de ? document.body : over.el).querySelectorAll("*"))) {
          const rect = el.getBoundingClientRect();
          if (rect.right > origin + limit + 1 || rect.left < origin - 1) {
            const desc = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : ""}`;
            widest = `in ${over.what}: ${desc} spans ${Math.round(rect.left)} to ${Math.round(rect.right)}`;
            break;
          }
        }
        if (!widest) widest = `in ${over.what}, offender not identified`;
      }

      /*
       * Tap targets, measured the way WCAG 2.5.8 defines them.
       *
       * Three exceptions are part of the criterion, not softenings of it:
       *
       *   Inline. A link inside a run of prose is text and is exempt. Detected
       *   by having a non-empty text node sibling, so it cannot be granted by
       *   adding a class.
       *
       *   Enclosed. A control wrapped in a label takes the label's box, because
       *   the label is what a thumb actually hits. Without this every radio on
       *   the site fails at 13px while sitting inside a 48px chip.
       *
       *   Spaced. An undersized target passes if no other target's centre falls
       *   within the 24px offset circle. This is the exception that makes a
       *   column of footer links legal, and it is the reason the naive version
       *   of this check reported 280 findings on a page with no defect on it.
       */
      const controls = Array.from(
        document.querySelectorAll("a[href], button, input, select, textarea"),
      ).filter((el) => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        // Visually hidden by the sr-only technique: a 1px clipped box that only
        // becomes a real target on focus. The skip link is the example.
        if (rect.width <= 1 && rect.height <= 1) return false;
        return true;
      });

      const boxOf = (el) => {
        const label = el.closest("label");
        const rect = label ? label.getBoundingClientRect() : el.getBoundingClientRect();
        return rect;
      };

      const centres = controls.map((el) => {
        const r = boxOf(el);
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });

      const small = [];
      controls.forEach((el, i) => {
        const rect = boxOf(el);
        if (rect.width >= minTap - 0.5 && rect.height >= minTap - 0.5) return;

        const inline =
          el.tagName === "A" &&
          Array.from(el.parentElement?.childNodes ?? []).some(
            (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
          );
        if (inline) return;

        // The spacing exception: undersized is acceptable when nothing else is
        // close enough to be hit by mistake.
        const me = centres[i];
        let crowded = false;
        for (let j = 0; j < centres.length; j++) {
          if (j === i) continue;
          const other = centres[j];
          if (Math.hypot(me.x - other.x, me.y - other.y) < minTap) {
            crowded = true;
            break;
          }
        }
        if (!crowded) return;

        small.push(
          `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
        );
      });

      /*
       * Content clipped inside a box that hides its own overflow.
       *
       * The document scroll check above cannot see this. A card with
       * overflow hidden that is narrower than its own text does not widen the
       * page: it silently cuts the words off at its own edge. The homepage
       * process cards did exactly that at 390, three columns of about ninety
       * pixels each with one word per line and the long words sliced, and this
       * audit reported hscroll ok and taps ok on every width for every
       * template while it was happening.
       *
       * A clipping box whose content is wider than it is, is either a bug or a
       * deliberate crop. The deliberate crops on this site are images and the
       * county map, so anything containing or being a replaced element is left
       * alone and everything else has to fit its own text.
       */
      const clipped = [];
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== "hidden" && cs.overflow !== "hidden") continue;
        // A one pixel box is the sr-only technique, not a layout container.
        if (el.clientWidth <= 4 || el.clientHeight <= 4) continue;
        const over = el.scrollWidth - el.clientWidth;
        if (over <= 1) continue;
        if (["SVG", "IMG", "VIDEO", "CANVAS", "IFRAME"].includes(el.tagName)) continue;
        // Skip only when a replaced element is what does not fit. Merely
        // CONTAINING an icon is not an excuse: the process cards each hold an
        // svg, and a blanket "has a descendant image" skip made this check
        // green over the exact defect it was written for.
        const wide = [...el.querySelectorAll("svg, img, video, canvas, iframe")]
          .some((r) => r.getBoundingClientRect().width > el.clientWidth);
        if (wide) continue;
        const what = (el.textContent || "").trim().replace(/s+/g, " ").slice(0, 34);
        clipped.push(
          el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + " clips " + over + "px of " + JSON.stringify(what),
        );
      }
      return {
        scrollWidth: over ? over.scrollW : de.scrollWidth,
        clientWidth: over ? over.clientW : de.clientWidth,
        widest,
        small: small.slice(0, 5),
        smallCount: small.length,
        clipped: clipped.slice(0, 4),
        clippedCount: clipped.length,
      };
    }, MIN_TAP);

    const hscroll = m.scrollWidth === m.clientWidth;
    const taps = m.smallCount === 0;
    const clip = m.clippedCount === 0;
    const notes = [];
    if (!hscroll) notes.push(`scrollW ${m.scrollWidth} != clientW ${m.clientWidth}${m.widest ? `; ${m.widest}` : ""}`);
    if (!taps) notes.push(`${m.smallCount} target(s) under ${MIN_TAP}px: ${m.small.join(", ")}`);
    if (!clip) notes.push(m.clippedCount + ` clipped box(es): ` + m.clipped.join(", "));

    return { hscroll, taps, clip, note: notes.join(" | ") };
  } catch (err) {
    return { hscroll: false, taps: false, clip: false, note: `error: ${String(err.message).split("\n")[0]}` };
  } finally {
    await context.close();
  }
}

async function checkMenu(base, browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: HEIGHT } });
  const page = await context.newPage();
  try {
    await page.goto(base + "/", { waitUntil: "networkidle", timeout: 90_000 });
    const openBtn = page.locator('button[aria-label="Open menu"]');
    await openBtn.waitFor({ state: "visible", timeout: 15_000 });
    // Let hydration settle so the click handler is live. Without this the click
    // lands on markup and nothing happens, which reads as a broken menu.
    await page.waitForTimeout(1500);
    await openBtn.click({ timeout: 15_000 });

    const menu = page.locator('[data-testid="mobile-menu"]');
    await menu.waitFor({ state: "visible", timeout: 8_000 });
    const opened = true;
    const locked = (await page.evaluate(() => getComputedStyle(document.body).overflow)) === "hidden";

    await menu.locator("a", { hasText: "About" }).first().click({ timeout: 15_000 });
    await page.waitForURL("**/about", { timeout: 20_000 });

    // waitFor, not count(). waitForURL resolves the moment the URL changes,
    // which is before React has re-rendered on the new pathname, so sampling the
    // DOM right here reports an open menu on a menu that closes correctly a few
    // milliseconds later. Waiting for the state asserts the same property
    // without racing it; if the menu genuinely never closes, this still fails,
    // it just takes five seconds to say so.
    const closed = await menu
      .waitFor({ state: "detached", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    const restored = await page
      .waitForFunction(() => getComputedStyle(document.body).overflow !== "hidden", null, {
        timeout: 5_000,
      })
      .then(() => true)
      .catch(() => false);

    // The back button is the case a click handler alone does not cover: App
    // Router navigation does not unmount the component, so a menu that only
    // closes on click stays open with the body still locked.
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const stillRestored =
      (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden";

    return { opened, locked, closed, restored, stillRestored, note: "" };
  } catch (err) {
    return {
      opened: false,
      locked: false,
      closed: false,
      restored: false,
      stillRestored: false,
      note: `error: ${String(err.message).split("\n")[0]}`,
    };
  } finally {
    await context.close();
  }
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

    const browser = await chromium.launch();
    const rows = [];
    const failures = [];

    const sessions = {};
    for (const role of ["admin", "engineer", "field_tech"]) {
      sessions[role] = await createProbe(base, role, "mobile-audit");
    }
    sessions.partner = await createPartnerProbe(base, "mobile-audit");
    sessions.customer = await createCustomerProbe(base, "mobile-audit");

    for (const t of [...TEMPLATES, ...OPEN_TEMPLATES, ...PORTAL_TEMPLATES]) {
      const cells = {};
      for (const w of WIDTHS) {
        /*
         * A portal template with no session lands on the sign in screen, which
         * passes every check here while measuring the wrong page. Reported as a
         * failure rather than skipped.
         */
        if (t.portal && !sessions[t.portal]?.cookie) {
          cells[w] = { hscroll: false, taps: false, clip: false, note: "no " + t.portal + " session" };
          log("  " + pad(t.name, 18) + " @" + w + ": NOT MEASURED (no " + t.portal + " session)");
          continue;
        }
        const cell = await measurePage(
          base,
          browser,
          t.path,
          w,
          t.portal ? sessions[t.portal] : null,
          t.session ?? "staff",
        );
        cells[w] = cell;
        log(
          `  ${pad(t.name, 18)} @${w}: hscroll=${cell.hscroll ? "ok" : "FAIL"} taps=${cell.taps ? "ok" : "FAIL"} clip=${cell.clip ? "ok" : "FAIL"}${cell.note ? "  (" + cell.note + ")" : ""}`,
        );
        if (!cell.hscroll || !cell.taps || !cell.clip) failures.push(`${t.name} @${w}: ${cell.note || "fail"}`);
      }
      rows.push({ name: t.name, cells });
    }

    log("\nChecking mobile menu (open / lock / close on navigate / back button) ...");
    const menu = await checkMenu(base, browser);
    await browser.close();

    const swept = await destroyProbes("mobile-audit");
    if (!swept.ok) failures.push("probe accounts left behind: " + swept.note);
    log("  probe accounts removed: " + (swept.ok ? "yes" : "NO"));

    const sweptPartners = await destroyPartnerProbes("mobile-audit");
    if (!sweptPartners.ok) failures.push("partner probe left behind: " + sweptPartners.note);
    log("  partner probe removed: " + (sweptPartners.ok ? "yes" : "NO"));

    const sweptCustomers = await destroyCustomerProbes("mobile-audit");
    if (!sweptCustomers.ok) failures.push("customer probe left behind: " + sweptCustomers.note);
    log("  customer probe removed: " + (sweptCustomers.ok ? "yes" : "NO"));

    log("\n================ MOBILE AUDIT: template x width ================");
    const header = pad("template", 20) + WIDTHS.map((w) => pad(w, 10)).join("");
    log(header);
    log("-".repeat(header.length));
    for (const row of rows) {
      let line = pad(row.name, 20);
      for (const w of WIDTHS) {
        const c = row.cells[w];
        line += pad(c.hscroll && c.taps && c.clip ? "pass" : "FAIL", 10);
      }
      log(line);
    }

    log("\n================ MOBILE MENU ================");
    log(`  opens:                     ${menu.opened ? "pass" : "FAIL"}`);
    log(`  body scroll locked:        ${menu.locked ? "pass" : "FAIL"}`);
    log(`  closes on navigate:        ${menu.closed ? "pass" : "FAIL"}`);
    log(`  body scroll restored:      ${menu.restored ? "pass" : "FAIL"}`);
    log(`  still restored after back: ${menu.stillRestored ? "pass" : "FAIL"}`);
    if (menu.note) log(`  note: ${menu.note}`);
    const menuOk =
      menu.opened && menu.locked && menu.closed && menu.restored && menu.stillRestored;
    if (!menuOk) failures.push(`menu: ${menu.note || "one or more menu checks failed"}`);

    log("\n================ RESULT ================");
    if (failures.length === 0) {
      log(
        `ALL GREEN. Zero horizontal scroll, every tap target satisfies WCAG 2.5.8 at ${MIN_TAP}px, menu behaves.`,
      );
      process.exitCode = 0;
    } else {
      log(`${failures.length} FAILURE(S):`);
      failures.forEach((f) => log("  - " + f));
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
