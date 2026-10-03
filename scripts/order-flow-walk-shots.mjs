/**
 * CAPTURE EVERY ORDER FLOW STEP THAT RENDERS WITHOUT A STRIPE CALL.
 *
 * Operator order, 2026-09-30: service, visit and pay up to the point before any
 * Stripe call, plus done if it renders without one.
 *
 * WHERE IT STOPS, AND WHY THAT IS THE LINE. The review step's button reads
 * "Continue to payment" and calls /api/order-flow with action submit. That
 * creates an order row, queues the customer's confirmation, and returns a
 * Stripe checkout URL. So the walk fills every step and captures the review
 * screen, and NEVER PRESSES THAT BUTTON. Nothing is submitted, no order exists,
 * no job is queued, and Stripe is never contacted.
 *
 * `done` THEREFORE CANNOT BE CAPTURED, and that is reported rather than faked.
 * It is a state of this component reached only after a submit returns without a
 * checkout URL, which is the payment-unavailable path. Producing it means
 * placing a real order on development and queueing mail. The operator's own
 * constraint forbids the mail, so `done` comes back COULD NOT TELL.
 *
 * FILLING IS GENERIC ON PURPOSE. The requirements step renders whatever
 * `customerFieldsFor` returns, which is the protocol's own sixteen Appendix A
 * questions plus the universal fields. Typing a bespoke answer per field would
 * be this script carrying a second copy of the intake definition, which is the
 * defect the shared definition exists to prevent. So every control is filled by
 * KIND, and if the flow ever asks for something new the walk fills it too.
 *
 * The address it types is under .invalid, and nothing is submitted, so even the
 * draft never leaves the browser.
 */
process.loadEnvFile?.(".env.local");

import { execFileSync } from "node:child_process";
import { openSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

import { withGateConditionsMet, FIXTURE_ENV } from "./lib/gate-fixture.mjs";
import { startNextServer } from "./lib/dev-server.mjs";
import { takeLock } from "./lib/machine-lock.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { syntheticPng } from "./lib/synthetic-png.mjs";
import { PORTS } from "./lib/ports.mjs";

/*
 * THE UPLOADS ARE REAL WRITES AND ARE TRACKED SO THEY CAN BE SWEPT.
 *
 * Operator ruling, 2026-09-30: upload a synthetic test image to the
 * development bucket so the walk can pass the required photo and reach the
 * price screen, then sweep it and report what was removed.
 *
 * The component signs each upload through /api/order-flow and PUTs to the
 * signed URL itself. This script never sees the storage key from the page's
 * state, so it reads it off the wire: every sign-upload response is
 * intercepted and its bucket and key recorded here. The sweep at the end
 * removes exactly those, and lists the bucket afterwards to confirm.
 */
const uploaded = [];
const PNG = syntheticPng();

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
  process.exit(1);
}

/** Fill every control on the current step, by kind rather than by name. */
async function fillStep(page) {
  /* Radios: the FIRST option in each group, which is the qualifying answer on
   * this line. A disqualifying choice ends the flow, which is the point of the
   * step, and would leave the walk capturing the refusal instead. */
  const groups = await page.locator("fieldset").all();
  for (const g of groups) {
    const radios = await g.locator("input[type=radio]").all();
    if (radios.length > 0) await radios[0].check({ force: true }).catch(() => {});
  }

  for (const input of await page.locator("input[type=text], input:not([type])").all()) {
    await input.fill("Fixture answer").catch(() => {});
  }
  for (const input of await page.locator("input[type=email]").all()) {
    await input.fill("probe@example.invalid").catch(() => {});
  }
  for (const input of await page.locator("input[type=tel]").all()) {
    await input.fill("2542542542").catch(() => {});
  }
  for (const input of await page.locator("input[type=date]").all()) {
    await input.fill("2027-01-15").catch(() => {});
  }
  for (const area of await page.locator("textarea").all()) {
    await area.fill("Fixture answer").catch(() => {});
  }
  for (const sel of await page.locator("select").all()) {
    const options = await sel.locator("option").all();
    if (options.length > 1) {
      const value = await options[1].getAttribute("value");
      await sel.selectOption(value ?? { index: 1 }).catch(() => {});
    }
  }
  /*
   * FILE INPUTS GET THE SYNTHETIC IMAGE. The component uploads on change, so
   * after setting each one the page is given time to sign and PUT before the
   * next control is touched. Every upload's key is caught by the response
   * listener registered on the page, not read from React state.
   */
  /*
   * ONE AT A TIME, WAITING FOR THE WIRE, STOPPING AS SOON AS THE STEP PASSES.
   *
   * The first version set every file input and checked Continue straight
   * after. The component signs and PUTs asynchronously, and networkidle can
   * resolve in the tick before the fetch has even started, so the check saw
   * the button still disabled and reported the step as blocked. Diagnosed by
   * watching the wire: the upload had worked perfectly and the walk had
   * simply not waited for it.
   *
   * So each upload is awaited by its own signed response, then a settle, and
   * the walk stops uploading the moment Continue enables. That keeps the number
   * of objects written to the development bucket at the minimum the step
   * requires, which is what makes the sweep afterwards a short list.
   */
  const next = page.getByRole("button", { name: "Continue" });
  for (const file of await page.locator("input[type=file]").all()) {
    if ((await next.count()) > 0 && !(await next.isDisabled())) break;
    const signed = page
      .waitForResponse((r) => r.url().includes("/api/order-flow") && r.request().method() === "POST", {
        timeout: 15_000,
      })
      .catch(() => null);
    await file
      .setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: PNG })
      .catch((e) => console.log(`    setInputFiles failed: ${String(e).slice(0, 120)}`));
    await signed;
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(800);
  }
  /* The review step's terms checkbox. Ticking it enables the submit button,
   * which this walk never presses. */
  for (const box of await page.locator("input[type=checkbox]").all()) {
    await box.check({ force: true }).catch(() => {});
  }
}

/** Remove every object this walk uploaded, and read the bucket back. */
async function sweepUploads() {
  console.log("");
  console.log("=== UPLOAD SWEEP ===");
  if (uploaded.length === 0) {
    console.log("  nothing was uploaded, so nothing to remove");
    return;
  }
  const db = auditClient("sweeping the walk's synthetic uploads");
  const byBucket = new Map();
  for (const u of uploaded) {
    if (!byBucket.has(u.bucket)) byBucket.set(u.bucket, []);
    byBucket.get(u.bucket).push(u.storageKey);
  }
  for (const [bucket, keys] of byBucket) {
    const { data, error } = await db.storage.from(bucket).remove(keys);
    if (error) {
      console.log(`  FAILED to remove ${keys.length} from ${bucket}: ${error.message}`);
      continue;
    }
    console.log(`  removed ${data?.length ?? 0} of ${keys.length} object(s) from ${bucket}`);
    /* Read back by listing the prefix each key shares, against the bucket. */
    const prefix = keys[0].split("/").slice(0, -1).join("/");
    const { data: left } = await db.storage.from(bucket).list(prefix);
    const remaining = (left ?? []).filter((o) => keys.includes(`${prefix}/${o.name}`));
    console.log(`  read back: ${remaining.length} of those key(s) still present under ${bucket}/${prefix}`);
  }
}

const release = await takeLock({
  project: "254engineering",
  label: "order flow walk captures",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

const findings = [];
try {
  await withGateConditionsMet(async () => {
    console.log("gate patched on disk, building");
    const log = "C:/Users/salon/AppData/Local/Temp/claude/order-walk-build.log";
    try {
      execFileSync("npm", ["run", "build"], {
        stdio: ["ignore", openSync(log, "w"), openSync(log, "a")],
        shell: true,
      });
    } catch {
      const tail = readFileSync(log, "utf8").split("\n").slice(-30).join("\n");
      throw new Error("build failed:\n" + tail);
    }
    console.log("built");

    const server = await startNextServer({
      port: PORTS.orderFlowWalkShots,
      env: { ...FIXTURE_ENV, LAUNCH_MODE: "live" },
    });

    try {
      const browser = await chromium.launch();
      for (const w of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width: w.width, height: w.height },
        });
        const page = await context.newPage();

        /* Catch every signed upload off the wire, so the sweep knows its keys. */
        page.on("response", async (res) => {
          if (!res.url().includes("/api/order-flow") || res.request().method() !== "POST") return;
          try {
            const body = await res.json();
            if (body?.ok && body?.storageKey && body?.bucket) {
              uploaded.push({ bucket: body.bucket, storageKey: body.storageKey });
            }
          } catch {
            /* not JSON, not an upload */
          }
        });

        await page.goto(server.base + "/order/start/roof-inspections", {
          waitUntil: "networkidle",
          timeout: 45_000,
        });

        const rail = page.locator("ol[aria-label='Order progress'] li");
        const stepCount = await rail.count();
        if (w.name === "1280") {
          const labels = await rail.allInnerTexts();
          findings.push(`the flow has ${stepCount} steps: ${labels.map((l) => l.replace(/\s+/g, " ").trim()).join(" | ")}`);
        }

        for (let i = 0; i < stepCount; i += 1) {
          const heading = (await page.locator("h2").first().innerText().catch(() => "")).trim();
          const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `step${i + 1}`;
          const file = `${OUT}/order-${i + 1}-${slug}-${w.name}.png`;
          await page.screenshot({ path: file, fullPage: true });
          console.log(`  ${w.name.padEnd(5)} step ${i + 1}  "${heading}"  ->  ${file}`);

          /*
           * THE SUBMIT IS NEVER PRESSED. Its label is what identifies it, and
           * reaching it means the walk is done: everything past this point is
           * an order row, a queued email and a Stripe redirect.
           */
          const submit = page.getByRole("button", { name: /Continue to payment|Send the request/ });
          if ((await submit.count()) > 0) {
            console.log(`  ${w.name.padEnd(5)} reached the submit. Not pressing it, so nothing is placed.`);
            break;
          }

          await fillStep(page);
          const next = page.getByRole("button", { name: "Continue" });
          if ((await next.count()) === 0) break;
          if (await next.isDisabled()) {
            const blockers = await page.locator("text=Still needed").count();
            console.log(
              `  ${w.name.padEnd(5)} step ${i + 1}: Continue is disabled${blockers ? " and the blocker list is showing" : ""}. Stopping here.`,
            );
            findings.push(
              `at ${w.name}, the walk could not pass step ${i + 1} ("${heading}"): Continue stayed disabled after filling every control by kind.`,
            );
            break;
          }
          await next.click();
          await page.waitForTimeout(400);
        }
        await context.close();
      }
      await browser.close();
    } finally {
      await server.stop();
    }
  });
} catch (e) {
  console.log("FAILED: " + String(e).slice(0, 400));
} finally {
  release();
  await sweepUploads();
  const after = gitClean();
  console.log("");
  console.log(
    after.clean
      ? "RESTORED: the three gate config files are byte identical to git."
      : "*** THE GATE CONFIG IS STILL PATCHED. RESTORE IT BEFORE ANYTHING ELSE. ***",
  );
  if (!after.clean) {
    console.log(after.detail);
    process.exitCode = 1;
  }
  console.log("");
  console.log("=== NOTES ===");
  for (const f of findings) console.log("  " + f);
  console.log("  done: COULD NOT TELL. It renders only after a submit that returns no checkout");
  console.log("  URL, which means placing an order and queueing mail. Not done.");
}
