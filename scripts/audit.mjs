// The whole suite, in one command.
//
//   npm run build && npx next start -p 3225      (in one terminal)
//   AUDIT_KILL_STALE=1 npm run audit             (in another)
//
// WHY IT RUNS THROUGH npm RATHER THAN CALLING THE SCRIPTS DIRECTLY
// ----------------------------------------------------------------
// Every audit has a `pre` hook wired in package.json, and those hooks are the
// guards: the BUILD_ID handshake for the ones that read the shared server, and
// the build guard for the ones that spawn their own. Spawning
// `node scripts/foo-audit.mjs` from here would bypass all of it and hand back a
// green suite measured against a stale artifact. Going through `npm run` means
// the runner cannot weaken a check the individual command enforces.
//
// WHY THE SUITE IS IN TWO PHASES
// ------------------------------
// The two halves want opposite states of the world:
//
//   Phase one reads a `next start` on 3225. It needs that server up, and the
//   BUILD_ID handshake refuses if it is serving anything other than the build
//   currently on disk.
//
//   Phase two spawns `next dev`, which WRITES .next. Running it while the phase
//   one server is serving out of .next is the tearing incident the build guard
//   exists to prevent, so the guard refuses unless AUDIT_KILL_STALE=1 lets it
//   clear the way first.
//
// So phase two stops the server phase one needed. That is stated out loud below
// rather than left as a surprise, because the server not being there afterward
// looks like a crash if you were not expecting it.
//
// Every audit runs even when an earlier one fails. A suite that stops at the
// first failure hides how much else is broken, which turns one fix into five
// round trips.
import { spawnSync } from "node:child_process";
import { assertClearToBuild } from "./lib/build-guard.mjs";
import { startNextServer } from "./lib/dev-server.mjs";

const PORT = Number(process.env.AUDIT_PORT || 3225);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;

/**
 * Phase zero needs neither a server nor a build. Cheap, fast, and run first so
 * that a broken registry or a bad email template is known before anything
 * expensive starts.
 */
const PHASE_ZERO = [
  {
    // First, because everything after it may touch a database and this is what
    // decides which one. It needs no server, no build, and no network.
    name: "db-guard-audit",
    why: "audits cannot reach production without an explicit flag that defaults off",
  },
  {
    // Pure: the file state machine, the compliance gate, and county derivation.
    // No server, no database, no network.
    name: "files-audit",
    why: "the transition grammar, and that the prelaunch gate does not leak",
  },
  {
    // Pure: dispatch eligibility and ranking, and the evidence submission gate.
    // Beside files-audit because it is the other half of the same question,
    // what the platform will and will not let happen to a file.
    name: "dispatch-audit",
    why: "the three eligibility gates, offer responses, and the submission gate",
  },
  {
    // Pure: what a technician must hold to be dispatchable, whether it is still
    // current, and how a service line is earned. Beside dispatch-audit because
    // it asserts the fourth gate that one now has.
    name: "onboarding-audit",
    why: "credential expiry, activation readiness, and the protocol certification check",
  },
  {
    // Pure: the four review actions, the responsible charge log, and the export.
    // The check that matters most in the whole suite is in here: that declining
    // to seal is always available, including while the compliance gate is on.
    name: "review-audit",
    why: "the four review actions, and that declining to seal is never blocked",
  },
  {
    // Pure: thread visibility, notification channels, recurrence arithmetic.
    // The check that matters most here is that an administrator cannot read a
    // direct message they are not in, which is a deliberate limit on the most
    // powerful role and exactly the kind of rule a support case quietly removes.
    name: "comms-audit",
    why: "who can read a thread, and what reaches somebody outside the app",
  },
  { name: "registry-audit", why: "keyword ownership is self consistent and every live claim resolves" },
  { name: "email-audit", why: "every outbound template: voice, absolute links, plaintext part" },
];

const PHASE_ONE = [
  { name: "coverage-audit", why: "all 254 counties, exactly once, rendered" },
  { name: "placeholder-audit", why: "scaffolding, dashes, emoji, contact details, unverified credentials" },
  { name: "voice-audit", why: "banned phrases, structural tells, present tense service claims" },
  { name: "cta-audit", why: "a conversion path on every route, honest under the gate" },
  { name: "seo-audit", why: "title and description budgets, uniqueness, schema, Lighthouse SEO 100" },
  { name: "forms-audit", why: "all four forms end to end, plus the server side guards" },
  {
    // Phase one, not phase two, because it measures the PRODUCTION build through
    // the shared server on 3225. Phase two audits each start their own next dev,
    // and mobile-audit's does so by killing whatever is on that port, which left
    // this one with nothing to fetch and a preflight failure that had nothing to
    // do with overflow.
    // Phase one: it needs the production server on 3225, like the audits above
    // it, and it asserts the deployed behaviour rather than reading the source.
    name: "security-audit",
    why: "the portal perimeter is closed to an unauthenticated client",
  },
  {
    // Phase one: it signs in through the running server as each role and
    // attempts everything, so it needs both the server and the service role key.
    // security-audit is the unauthenticated perimeter; this is what happens once
    // somebody is legitimately inside.
    // DEVELOPMENT ONLY, by the operator's ruling of 2026-09-02, and enforced in
    // scripts/lib/db-target.mjs rather than here so that running the script
    // directly is bound by it too. It writes, and the audit trail rows it
    // produces cannot be deleted afterwards. Against production run only
    // security-audit and db-guard-audit, neither of which writes anything.
    name: "roles-audit",
    why: "the authorization matrix, asserted independently and then over HTTP",
  },
  {
    name: "mobile-overflow-audit",
    why: "zero horizontal document scroll on EVERY sitemap route at 360 and 390",
  },
  {
    // Phase one for the same reason security-audit is, and this file already
    // warned about it: phase two audits start their own server by killing
    // whatever holds 3225, so an audit placed after them finds nothing to
    // fetch. Put here first time would have saved a red suite.
    //
    // Last within phase one because it is by far the slowest: three Lighthouse
    // runs per template, ten templates.
    name: "perf-audit",
    why: "LCP, CLS, TBT, and per template byte budgets",
  },
];

const PHASE_TWO = [
  { name: "launch-audit", why: "the compliance gate, in both modes" },
  { name: "mobile-audit", why: "zero horizontal scroll and 44px tap targets at four widths" },
  { name: "contrast-audit", why: "WCAG 2.1 A and AA including the form error states" },
];

const results = [];

/**
 * The suite owns its server.
 *
 * WHY THIS EXISTS
 * ---------------
 * The suite used to assume a server was already running on 3225, started by
 * hand in another terminal. Three runs in one session were invalidated because
 * a build at the end of an earlier step killed it, and the suite then measured
 * nothing: eleven audits failed with ECONNREFUSED and the summary looked like a
 * catastrophic regression rather than an absent server.
 *
 * The preflights were never wrong. Each one said "Nothing is answering at
 * http://localhost:3225" and printed the command to fix it. The defect was that
 * a run could get that far at all. A suite that can be pointed at nothing, and
 * report failures about it, is a suite whose red means two different things.
 *
 * So the runner builds once, starts the server, waits until the pages the suite
 * actually depends on answer, runs, and tears it down. A run can no longer
 * measure nothing.
 *
 * THE ESCAPE HATCH, AND WHY IT IS AN ENVIRONMENT VARIABLE
 * -------------------------------------------------------
 * Setting BASE_URL says "I have a server, use it and do not manage one". That
 * is what a run against production is: BASE_URL=https://254engineering.com with
 * only the audits that write nothing. Building and starting a local server for
 * that would be absurd, and refusing to allow it would remove the one workflow
 * that verifies a deployment.
 */
const MANAGED = !process.env.BASE_URL;

/**
 * The pages the suite depends on. Both, because either can be up alone.
 *
 * Both are public and both must answer 200. The home page proves the marketing
 * build rendered; the sign in page proves the portal half did, and it is open by
 * design so it does not redirect.
 */
const HEALTH_PATHS = ["/", "/portal/login"];

/**
 * Is this page actually there?
 *
 * A 2xx and nothing else. The first version accepted anything under 500, on the
 * reasoning that a portal route redirecting an unauthenticated caller is correct
 * rather than down. True, but neither path here is a guarded route, and the
 * looseness meant a 404 counted as healthy: an app serving nothing but 404s
 * would have passed the check and every content audit after it would have failed
 * with the real cause nowhere on screen.
 *
 * Found by injecting a health path that does not exist and watching the suite
 * run anyway. The check was the thing being tested and it was wrong.
 */
async function answers(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.ok;
  } catch {
    return false;
  }
}

async function healthy(base) {
  for (const path of HEALTH_PATHS) {
    if (!(await answers(base + path))) return false;
  }
  return true;
}

async function waitUntilHealthy(base, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBad = "";
  while (Date.now() < deadline) {
    let allGood = true;
    for (const path of HEALTH_PATHS) {
      if (!(await answers(base + path))) {
        allGood = false;
        lastBad = path;
        break;
      }
    }
    if (allGood) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `The server came up but ${lastBad} never answered within ${Math.round(timeoutMs / 1000)}s. ` +
      "The suite refuses to run against a half started server, because the audits would " +
      "report content failures about pages that were simply not there yet.",
  );
}

/**
 * Build once, start the server, and prove it is answering.
 *
 * The build is not optional and there is no flag to skip it. seo-audit and
 * perf-audit measure the production bundle, so a suite run against a stale
 * build is a suite measuring the wrong artifact, which is the same class of
 * problem as measuring nothing and harder to notice.
 */
async function bringUpServer() {
  console.log(`${"=".repeat(72)}`);
  console.log("SETUP: the suite starts its own server.");
  console.log("=".repeat(72));

  // The runner owns the audit ports, so it clears them rather than refusing.
  // Anything holding one is a leftover from an earlier run.
  assertClearToBuild({ kill: true, label: "the audit suite" });

  console.log("\n  building ...");
  const build = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    throw new Error(
      "The build failed, so there is nothing to audit. The suite stops here rather than " +
        "running against whatever .next happened to contain.",
    );
  }

  console.log("\n  starting the server ...");
  const server = await startNextServer({ port: PORT });
  await waitUntilHealthy(server.base);
  console.log(`  serving ${server.base}, and ${HEALTH_PATHS.join(" and ")} both answer.\n`);
  return server;
}

function run(audit, env) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`RUNNING: ${audit.name}  (${audit.why})`);
  console.log("=".repeat(72));
  const r = spawnSync("npm", ["run", audit.name], {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  results.push({ name: audit.name, code: r.status ?? 1 });
}

let server = null;
let setupError = null;

try {
  if (MANAGED) {
    server = await bringUpServer();
  } else {
    console.log(`Using the server at ${BASE}, because BASE_URL is set.`);
    if (!(await healthy(BASE))) {
      throw new Error(
        `BASE_URL is set to ${BASE} but it is not answering. Nothing was run, because a ` +
          "suite pointed at nothing reports failures about content rather than about the server.",
      );
    }
  }

  for (const audit of PHASE_ZERO) {
    run(audit, { ...process.env });
  }

  /*
   * Checked before EVERY phase one audit, not once before the phase.
   *
   * The first version checked once, between phase zero and phase one, and that
   * was not enough: a run lost its server partway through phase one and the
   * suite reported mobile-overflow-audit and perf-audit as failed. The pages
   * "did not load" and the preflight said "fetch failed", which is the true
   * story told in a way that reads as two broken audits.
   *
   * Phase one is the long half, twenty minutes of browsers and Lighthouse. A
   * check at the top of it says nothing about minute nineteen. Two fetches
   * before each audit costs nothing against what they cost, and it is the
   * difference between a red suite that means "the app is broken" and one that
   * means "there was no app".
   */
  for (const audit of PHASE_ONE) {
    if (!(await healthy(BASE))) {
      throw new Error(
        `The server stopped answering before ${audit.name}. Everything from here would have ` +
          "measured nothing, so the suite stops rather than reporting absent pages as content " +
          "failures. The server's own log is where to look: it ends cleanly when something " +
          "killed the process, and carries the error when it fell over by itself.",
      );
    }
    run(audit, { ...process.env, BASE_URL: BASE });
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log("PHASE TWO: these audits start their own servers.");
  console.log(`The server on ${BASE} is stopped first, because next dev writes .next`);
  console.log("and tearing it underneath a running server is the failure the build");
  console.log("guard exists to prevent.");
  console.log("=".repeat(72));

  if (server) {
    await server.stop();
    server = null;
  }

  for (const audit of PHASE_TWO) {
    // BASE_URL is deliberately removed. With it set these harnesses point at the
    // shared server instead of spawning their own, and the launch audit in
    // particular would then measure one mode twice while reporting on two.
    const env = { ...process.env, AUDIT_KILL_STALE: "1" };
    delete env.BASE_URL;
    run(audit, env);
  }
} catch (err) {
  setupError = err;
} finally {
  if (server) await server.stop();
}

console.log(`\n${"=".repeat(72)}`);
console.log("SUITE SUMMARY");
console.log("=".repeat(72));

if (setupError) {
  /*
   * Loud, and distinct from a failing audit. "The suite could not run" and
   * "the suite ran and found problems" are different states, and a summary that
   * renders them identically is how an absent server gets read as a regression.
   */
  console.log("\n  THE SUITE DID NOT RUN TO COMPLETION\n");
  console.log(`  ${setupError.message}\n`);
  if (results.length) {
    console.log("  What did run before it stopped:");
    for (const r of results) console.log(`    ${r.code === 0 ? "PASS" : "FAIL"}  ${r.name}`);
    /*
     * The health check runs BEFORE each audit, so one already in flight when the
     * server went away still fails, and it fails looking like a content problem.
     * Saying so is the difference between a reader chasing a defect that does
     * not exist and a reader re-running the suite.
     */
    const last = results[results.length - 1];
    if (last.code !== 0) {
      console.log("");
      console.log(`  ${last.name} is the last thing that ran and it failed. Treat that as unknown`);
      console.log("  rather than as a defect: an audit already running when the server went away");
      console.log("  fails the way a broken page would. Re-run before believing it.");
    }
  }
  console.log("");
  process.exitCode = 1;
} else {
  for (const r of results) {
    console.log(`  ${r.code === 0 ? "PASS" : "FAIL"}  ${r.name}`);
  }
  const failed = results.filter((r) => r.code !== 0);
  console.log(
    failed.length === 0
      ? `\nAll ${results.length} audits pass.`
      : `\n${failed.length} of ${results.length} audits failed: ${failed.map((r) => r.name).join(", ")}`,
  );
  process.exitCode = failed.length ? 1 : 0;
}

// link-map is a measurement, not a gate. It has no failure condition, because
// "too few contextual links" is a judgment about a content plan rather than a
// defect, so running it inside the suite would either be noise or an arbitrary
// threshold. Named here so it is not forgotten rather than left out silently.
console.log(
  "\nNot in the suite: `npm run link-map` measures contextual versus template inbound",
);
console.log("links and has no pass or fail. Run it before and after any linking pass.");
