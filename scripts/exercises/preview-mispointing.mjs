/**
 * PHASE 14 RANK 6: THE PREVIEW MISPOINTING GUARD, WITH THE COMBINATION PRODUCED.
 *
 *   npm run build   (once, beforehand)
 *   npx tsx scripts/exercises/preview-mispointing.mjs
 *
 * What proved it before tonight: `db-guard-audit` calls
 * `previewPointingAtProduction()` with hand-made environment objects. That is a
 * proof about a predicate. What was NOT proven, in the survey's own words, is
 * "that a real preview deployment pointed at production actually refuses".
 *
 * WHAT THIS DOES, AND WHAT IT STILL DOES NOT
 * ------------------------------------------
 * It starts the BUILT application, the same `.next` a deployment runs, under
 * `next start`, with the environment a mispointed Vercel preview would have:
 * VERCEL_ENV=preview and SUPABASE_URL naming the production project. Then it
 * asks the running app for the two things that matter: the portal a person
 * would open, and the cron route a preview's scheduler would call. Each case is
 * its own server process, so nothing is module-bound between cases.
 *
 * It is not a Vercel preview. Vercel injects more than VERCEL_ENV, and a real
 * preview's build is Vercel's, not this machine's. Tonight's limits forbid
 * pushing, deploying and sending anything outward, so the closest honest thing
 * is the real build under the real variable. The report says that rather than
 * calling this rank closed.
 *
 * WHY THIS CANNOT REACH PRODUCTION
 * --------------------------------
 * Every case runs with SUPABASE_SERVICE_ROLE_KEY set to a string that is not a
 * key. If the guard failed open, whatever request escaped would be refused
 * unauthenticated at the gateway: nothing can be read or written with it. The
 * production key is not in this working tree and is not needed.
 *
 * THE EXPECTED SENTENCE IS WRITTEN HERE AS A LITERAL, because an audit never
 * imports its expectation from the thing it audits.
 */

import { spawn, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const HEADLINE = "This preview is pointed at the production database";
const PROD_URL = "https://fsaryeciduszuahgjbly.supabase.co";
const DEV_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
const NOT_A_KEY = "not-a-key-preview-mispointing-exercise";
const PORT = 3227;
const BASE = `http://localhost:${PORT}`;
const CRON_SECRET = `exercise-${randomUUID()}`;

let failures = 0;
const rec = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

async function withServer(env, body) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: NOT_A_KEY, CRON_SECRET, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i += 1) {
      await new Promise((r) => setTimeout(r, 1000));
      up = await fetch(`${BASE}/`).then((r) => r.status === 200).catch(() => false);
    }
    if (!up) throw new Error(`the server did not come up on ${PORT}:\n${log.slice(-800)}`);
    await body();
  } finally {
    try {
      execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: "ignore" });
    } catch {
      child.kill();
    }
    for (let i = 0; i < 20; i += 1) {
      const down = await fetch(`${BASE}/`).then(() => false).catch(() => true);
      if (down) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return log;
}

const portal = async () => {
  const r = await fetch(`${BASE}/portal/login`);
  return { status: r.status, text: await r.text() };
};
const cron = async () => {
  const r = await fetch(`${BASE}/api/cron/jobs`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  return { status: r.status, text: await r.text() };
};

const busy = await fetch(`${BASE}/`).then(() => true).catch(() => false);
if (busy) {
  console.error(`REFUSED: something already answers on ${PORT}, so a reading could come from it rather than from this case.`);
  process.exit(1);
}

console.log("preview mispointing guard, against the built application\n");

console.log("  case 1: VERCEL_ENV=preview, SUPABASE_URL=production. The combination.");
const log1 = await withServer({ VERCEL_ENV: "preview", SUPABASE_URL: PROD_URL }, async () => {
  const p = await portal();
  rec("the portal a person opens renders the refusal, headline and all", p.text.includes(HEADLINE), `status ${p.status}`);
  rec("and does not render the sign in form behind it", !/>Sign in</.test(p.text));
  /*
   * Recorded, not failed: the refusal answers 200. A monitor asking only for a
   * status would read a mispointed preview as healthy, which is the order status
   * trap in CLAUDE.md section 6 in another place.
   */
  console.log(`  NOTE: the refusal page answers HTTP ${p.status}`);
  if (process.env.SHOTS) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${BASE}/portal/login`);
      await page.screenshot({ path: `${process.env.SHOTS}/mispointed-${width}.png`, fullPage: true });
      await page.close();
    }
    await browser.close();
    console.log(`  screenshots at 390 and 1280 written to ${process.env.SHOTS}`);
  }
  const c = await cron();
  rec("the cron route a preview's scheduler calls refuses rather than running a batch",
    c.status === 500 && !/"claimed"/.test(c.text), `status ${c.status}, ${c.text.slice(0, 60)}`);
});
{
  const line = log1.split(/\r?\n/).find((l) => l.includes(HEADLINE));
  rec("and the server's own log carries the guard's sentence, so the 500 is the guard and not a bad key",
    Boolean(line), line ? line.trim().slice(0, 90) : "no line in the server log names the guard");
}

console.log("\n  case 2: VERCEL_ENV=preview, SUPABASE_URL=development. Must be untouched.");
await withServer({ VERCEL_ENV: "preview", SUPABASE_URL: DEV_URL }, async () => {
  const p = await portal();
  rec("a preview on development renders the sign in screen and no refusal",
    p.status === 200 && !p.text.includes(HEADLINE) && />Sign in</.test(p.text), `status ${p.status}`);
  const c = await cron();
  rec("and its cron route is not refused by the guard", c.status === 200, `status ${c.status}, ${c.text.slice(0, 60)}`);
});

console.log("\n  case 3: VERCEL_ENV=production locally, SUPABASE_URL=production. Production must never be blocked.");
await withServer({ VERCEL_ENV: "production", SUPABASE_URL: PROD_URL }, async () => {
  const p = await portal();
  rec("production pointed at production renders no refusal", !p.text.includes(HEADLINE), `status ${p.status}`);
});

console.log("\n  case 4: the combination with ALLOW_PRODUCTION_PREVIEW=true. Not the string 1, so still refused.");
await withServer({ VERCEL_ENV: "preview", SUPABASE_URL: PROD_URL, ALLOW_PRODUCTION_PREVIEW: "true" }, async () => {
  const p = await portal();
  rec("\"true\" does not open the hatch", p.text.includes(HEADLINE), `status ${p.status}`);
});

console.log("\n  case 5, the injection: the combination with ALLOW_PRODUCTION_PREVIEW=1.");
await withServer({ VERCEL_ENV: "preview", SUPABASE_URL: PROD_URL, ALLOW_PRODUCTION_PREVIEW: "1" }, async () => {
  const p = await portal();
  rec("with the guard disabled by its own hatch, the refusal is gone, so the refusal in case 1 was the guard and nothing else",
    !p.text.includes(HEADLINE), `status ${p.status}`);
});

console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
