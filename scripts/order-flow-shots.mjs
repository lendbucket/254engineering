/**
 * CAPTURE THE ORDER FLOW, WHICH ONLY RENDERS WITH THE GATE OPEN.
 *
 * Operator order, 2026-09-30. Every capture so far of /order/start/... has been
 * of the BLOCKED path, because the gate is shut and the page says so instead of
 * mounting the flow. So the restyle of OrderFlow itself has never been seen.
 *
 * WHY THIS PATCHES DISK AND BUILDS, rather than patching in process. The gate's
 * conditions are module level constants, read once at first import, and
 * CLAUDE.md records three separate runs lost to exactly that: a patch lands, a
 * fresh import is not fresh enough, and the code goes on refusing correctly for
 * the unpatched state. A build reads the files as they are on disk, so the
 * patch has to be there before the build starts.
 *
 * IT TOUCHES NO DATABASE, NO STRIPE AND NOTHING THAT SENDS. The gate is
 * configuration. The flow renders from the catalogue. Nothing is submitted:
 * these are screenshots of steps, not an order.
 *
 * THE RESTORE IS CHECKED AGAINST GIT, not assumed. withGateConditionsMet
 * restores in a finally, and "restored" reads identically whether it happened
 * or not, which is the reason this repository restores by copy and verifies.
 * Here the verification is `git diff --quiet` on the three files the fixture
 * touches. If it is dirty at the end, this says so loudly: an open gate left on
 * disk is the single worst thing a screenshot run could leave behind.
 */
process.loadEnvFile?.(".env.local");

import { execFileSync } from "node:child_process";
import { openSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

import { withGateConditionsMet, FIXTURE_ENV } from "./lib/gate-fixture.mjs";
import { startNextServer } from "./lib/dev-server.mjs";
import { takeLock } from "./lib/machine-lock.mjs";
import { PORTS } from "./lib/ports.mjs";

const OUT = process.env.SHOTS_OUT ?? "docs/design-v10/screens/captured";
const GATE_FILES = [
  "src/config/credentials.ts",
  "src/config/launch-readiness.ts",
  "src/config/launch-conditions.ts",
];

const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

function gitClean() {
  const out = execFileSync("git", ["status", "--porcelain", "--", ...GATE_FILES], {
    encoding: "utf8",
  });
  return { clean: out.trim().length === 0, detail: out.trim() };
}

const before = gitClean();
if (!before.clean) {
  console.log("REFUSING TO START: the gate config files are already modified:");
  console.log(before.detail);
  console.log("This run patches them, so it cannot tell its own patch from yours.");
  process.exit(1);
}

const release = await takeLock({
  project: "254engineering",
  label: "order flow captures with the gate open",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let captured = 0;
try {
  await withGateConditionsMet(async () => {
    console.log("gate patched on disk, building so the build reads it");
    /*
     * THE BUILD'S OUTPUT GOES TO A FILE RATHER THAN TO /dev/null.
     *
     * The first run used stdio "ignore" and reported only "Command failed: npm
     * run build", which is the harness telling me something broke and refusing
     * to say what. A run that can fail in a way nobody can read is a run that
     * costs four minutes per guess.
     */
    const log = "C:/Users/salon/AppData/Local/Temp/claude/order-flow-build.log";
    try {
      execFileSync("npm", ["run", "build"], {
        stdio: ["ignore", openSync(log, "w"), openSync(log, "a")],
        shell: true,
      });
    } catch (e) {
      const tail = readFileSync(log, "utf8").split("\n").slice(-40).join("\n");
      throw new Error(`the build failed under the patched gate. Its last lines:\n${tail}`);
    }
    console.log("built");

    /*
     * THE ENVIRONMENT HALF OF THE GATE, WHICH THE FILE PATCHES CANNOT COVER.
     *
     * Nine conditions, and two of them are not in any config file: `switch`
     * reads LAUNCH_MODE and `phone` reads FIRM_PHONE. Patching the three config
     * files satisfies the other seven and leaves the gate correctly SHUT, which
     * is what the first successful build produced: a page answering 200 with
     * the blocked copy on it, and no progress rail.
     *
     * That is the gate working, not failing. It is also exactly the trap this
     * script's own rail check exists for: a 200 on the blocked page reads like
     * a captured flow to anything that only asks for a status code.
     *
     * FIXTURE_ENV carries the phone. LAUNCH_MODE is the operator's switch and
     * is set here, for this server only, and never written to any file.
     */
    const server = await startNextServer({
      port: PORTS.orderFlowShots,
      env: { ...FIXTURE_ENV, LAUNCH_MODE: "live" },
    });
    try {
      const browser = await chromium.launch();
      for (const w of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width: w.width, height: w.height },
        });
        const page = await context.newPage();

        const res = await page.goto(server.base + "/order/start/roof-inspections", {
          waitUntil: "networkidle",
          timeout: 45_000,
        });

        /*
         * THE FLOW HAS TO BE ON THE PAGE, not merely a 200. The blocked path
         * also answers 200 and says the firm is not taking orders, which is the
         * exact shape CLAUDE.md warns about on the order status page: a check
         * that asks for a 200 passes on the refusal. So the step rail is looked
         * for by name before anything is filed as the flow.
         */
        const hasFlow = await page.locator("ol[aria-label='Order progress']").count();
        const blocked = await page
          .getByText(/not taking orders|cannot be ordered online/i)
          .count();

        const file = `${OUT}/order-flow-step1-${w.name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        captured += 1;
        console.log(
          `  order flow ${w.name.padEnd(5)} HTTP ${res?.status()}  progress rail: ${hasFlow ? "PRESENT" : "ABSENT"}  blocked copy: ${blocked ? "PRESENT" : "absent"}  ->  ${file}`,
        );
        if (!hasFlow) {
          console.log(
            "    COULD NOT TELL: the gate did not open for this build, so this is the blocked",
          );
          console.log("    page again rather than the flow. The capture is kept and labelled.");
        }

        await context.close();
      }
      await browser.close();
    } finally {
      await server.stop();
    }
  });
} catch (e) {
  console.log("FAILED: " + String(e).slice(0, 300));
} finally {
  release();
  const after = gitClean();
  console.log("");
  if (after.clean) {
    console.log("RESTORED: the three gate config files are byte identical to git.");
  } else {
    console.log("*** THE GATE CONFIG IS STILL PATCHED ON DISK. RESTORE IT BEFORE ANYTHING ELSE. ***");
    console.log(after.detail);
    process.exitCode = 1;
  }
  console.log(`captures written: ${captured}`);
}
