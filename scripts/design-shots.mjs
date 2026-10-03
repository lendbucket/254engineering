/**
 * SCREENSHOT THE RESTYLED SCREENS BESIDE THEIR DESIGNS.
 *
 * Operator order, 2026-09-29: "Screenshot every restyled screen next to its
 * design for me."
 *
 * IT SHOOTS WHAT A CUSTOMER SEES, at both widths, against a server this process
 * owns and tears down. The designs are in docs/design-v10/screens/ and are named
 * beside each capture so the two can be opened side by side.
 *
 * ROUTES ONLY, NO SIGNED IN STATE, in this first pass. The signed in screens
 * need a probe account and that is a separate concern from whether the restyle
 * landed; the sign in, sign up and order flow entry points are the ones the
 * token and type change moves first.
 *
 *   npx tsx scripts/design-shots.mjs
 */
process.loadEnvFile?.(".env.local");

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

import { startNextServer } from "./lib/dev-server.mjs";
import { takeLock } from "./lib/machine-lock.mjs";
import { PORTS } from "./lib/ports.mjs";
import { withGateConditionsMet, FIXTURE_ENV } from "./lib/gate-fixture.mjs";

/**
 * SHOTS_GATE=open CAPTURES THE SITE AS A CUSTOMER SEES IT IN PRODUCTION.
 * Added 2026-10-03 for the ordering work.
 *
 * WHY IT IS NEEDED AT ALL. `.env.local` carries no live LAUNCH_MODE and no
 * FIRM_PHONE, so a server started here renders PRELAUNCH. Every capture of a
 * public page taken that way shows a site with no order button and no price,
 * which is not what production serves and is precisely the thing the operator
 * asked to look at.
 *
 * WHY IT IS OPT IN RATHER THAN THE DEFAULT. The account screens in this list are
 * gate independent and have been captured in the default mode for weeks. Making
 * every future capture run open the gate would silently change what those images
 * mean, and a screenshot whose conditions nobody stated is a screenshot nobody
 * can compare against anything.
 *
 * It uses the same fixture launch-audit's live crawl uses: the register is
 * written, the gate is ASKED in a child process whether it actually opened, and
 * the files are put back afterwards.
 */
const GATE_OPEN = process.env.SHOTS_GATE === "open";

/**
 * SHOTS_ONLY and SHOTS_LABEL, added 2026-10-03 for the zero open capture.
 *
 * The gate state is a property of a whole RUN, not of one screen, so capturing
 * the chooser both open and shut takes two runs. Without a label the second
 * would overwrite the first, and the pair the operator asked to compare would be
 * one image twice.
 *
 * SHOTS_ONLY narrows the run to named screens so the second pass does not
 * re-shoot nine pages to get one. SHOTS_LABEL is appended to each filename.
 * Both default to the behaviour this script already had.
 */
const ONLY = (process.env.SHOTS_ONLY ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LABEL = process.env.SHOTS_LABEL ?? "";

/*
 * BESIDE THE DESIGNS, because that is where they are compared.
 *
 * Operator order: "Screenshot each screen next to its design in
 * docs/design-v10/screens". A subfolder rather than the same directory, so a
 * capture is never mistaken for a design: the designs are the authority and the
 * captures are evidence about one commit.
 */
const OUT = process.env.SHOTS_OUT ?? "docs/design-v10/screens/captured";

/**
 * Each restyled route beside the design it is meant to match.
 *
 * `design: null` MEANS THERE IS NO DRAWING FOR IT, which is a fact worth
 * carrying rather than a gap to fill with the nearest picture. Forgot password
 * did not exist when V10 was drawn, and the customer account home has no
 * customer design at all: V10A-dashboard is the OPERATIONS overview, a staff
 * screen carrying revenue and margin, and pairing it with this one would invite
 * somebody to build the firm's money onto a buyer's screen.
 *
 * `/order` IS NOT A ROUTE AND WAS LISTED AS ONE. Corrected 2026-09-29: the
 * order flow lives at /order/start/[slug] and /order/[reference], and the entry
 * in this list pointing at a bare /order would have captured a 404 and filed it
 * beside V10O-property.png as though it were the screen.
 */
const SCREENS = [
  { route: "/account/login", design: "V10-login.png", name: "login" },
  { route: "/account/sign-up", design: "V10-signup.png", name: "signup" },
  { route: "/account/forgot-password", design: null, name: "forgot-password" },
  { route: "/order/start/roof-inspections", design: "V10O-service.png", name: "order-service" },
  /*
   * THE TWO PUBLIC PAGES THE ORDERING WORK CHANGED, 2026-10-03. The operator
   * asked for captures of the home page and the roof page at both widths, and
   * they are added to this list rather than taken by hand so the next person to
   * change either one captures them the same way.
   *
   * `design: null` on both, truthfully: V10 draws the portal and the customer
   * account, and the public site is v5. Pairing these with a V10 artifact would
   * invite somebody to restyle the public site to match a drawing that was never
   * about it.
   */
  { route: "/", design: null, name: "home" },
  { route: "/services/roof-inspections", design: null, name: "service-roof" },
  { route: "/order", design: null, name: "order-chooser" },
  /*
   * A QUOTE ONLY LINE, asked for by the operator on 2026-10-03 so the pair can
   * be compared. Foundation is one of the seven that is not open: its card, its
   * chooser row and its service page must all say Request a quote and must not
   * imply it can be ordered. Capturing only the orderable line would show the
   * half of this work that is easy to get right.
   */
  { route: "/services/foundation-inspections", design: null, name: "service-quote-only" },
];

const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

mkdirSync(OUT, { recursive: true });

const release = await takeLock({
  project: "254engineering",
  label: "design v10 screenshots",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let server = null;

/**
 * The capture run, lifted into a function so the gate fixture can wrap it.
 *
 * The fixture writes the register, runs this, and puts the files back. Wrapping
 * only the server start would not do: the pages are RENDERED during the walk, so
 * the conditions have to still be true while the browser is driving.
 */
async function capture() {
  server = await startNextServer({
    port: PORTS.designShots,
    /*
     * LAUNCH_MODE and FIRM_PHONE are read by the spawned server from its own
     * environment rather than from the patched files, which is the trap
     * launch-audit records: without them the live crawl renders the PRELAUNCH
     * site while asserting live things about it.
     */
    /*
     * AND IT MUST BE `dev`, NOT `start`, WHEN THE GATE IS OPENED BY A FIXTURE.
     * The public pages are statically prerendered, so the gate's answer is baked
     * in AT BUILD TIME: a `next start` serving an artifact built before the
     * register was patched renders the prelaunch site no matter what the files
     * say while the browser is driving. CLAUDE.md states the same fact from the
     * other side, that flipping the mode requires a rebuild, and launch-audit's
     * live crawl uses dev for exactly this reason.
     */
    ...(GATE_OPEN
      ? { command: "dev", timeoutMs: 180_000, env: { LAUNCH_MODE: "live", ...FIXTURE_ENV } }
      : {}),
  });
  console.log("server up at " + server.base);
  console.log(
    GATE_OPEN
      ? "gate OPEN for this run: these are the pages a customer sees in production"
      : "gate as .env.local leaves it, which is prelaunch. Pass SHOTS_GATE=open for the trading site",
  );
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: width.width, height: width.height },
    });
    const page = await context.newPage();

    for (const screen of SCREENS) {
      if (ONLY.length > 0 && !ONLY.includes(screen.name)) continue;
      let status = 0;
      try {
        const res = await page.goto(server.base + screen.route, {
          waitUntil: "networkidle",
          timeout: 45_000,
        });
        status = res?.status() ?? 0;
      } catch (e) {
        console.log(`  ${screen.name} ${width.name}: NAVIGATION FAILED ${String(e).slice(0, 90)}`);
        continue;
      }

      /*
       * A NON 200 IS REPORTED AND STILL CAPTURED, because a screenshot of a
       * refusal is evidence and a missing file is not. What is NOT done is
       * filing it silently beside a design as though it were the screen: the
       * status is on the line, and an earlier version of this list pointed at a
       * route that does not exist and would have done exactly that.
       */
      const file = `${OUT}/${screen.name}${LABEL}-${width.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(
        `  ${screen.name.padEnd(16)} ${width.name.padEnd(5)} HTTP ${status}${status === 200 ? "" : "  <-- NOT 200"}  ->  ${file}`,
      );
      console.log(
        `  ${" ".repeat(16)} ${" ".repeat(5)} design: ${
          screen.design ? `docs/design-v10/screens/${screen.design}` : "none drawn for this screen"
        }`,
      );
    }

    await context.close();
  }

  await browser.close();
}

try {
  if (GATE_OPEN) await withGateConditionsMet(capture);
  else await capture();
} finally {
  if (server) {
    await server.stop();
    console.log("server stopped");
  }
  release();
  console.log("lock released");
}

console.log("");
console.log("shots in " + OUT);
