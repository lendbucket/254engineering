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
try {
  server = await startNextServer({ port: PORTS.designShots });
  console.log("server up at " + server.base);
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: width.width, height: width.height },
    });
    const page = await context.newPage();

    for (const screen of SCREENS) {
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
      const file = `${OUT}/${screen.name}-${width.name}.png`;
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
