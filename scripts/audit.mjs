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

const BASE = process.env.BASE_URL || "http://localhost:3225";

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

for (const audit of PHASE_ZERO) {
  run(audit, { ...process.env });
}

for (const audit of PHASE_ONE) {
  run(audit, { ...process.env, BASE_URL: BASE });
}

console.log(`\n${"=".repeat(72)}`);
console.log("PHASE TWO: these audits start their own server.");
console.log(`The server on ${BASE} will be stopped, because next dev writes .next`);
console.log("and tearing it underneath a running server is the failure the build");
console.log("guard exists to prevent. Restart it afterward with:");
console.log("  npm run build && npx next start -p 3225");
console.log("=".repeat(72));

for (const audit of PHASE_TWO) {
  // BASE_URL is deliberately removed. With it set these harnesses point at the
  // shared server instead of spawning their own, and the launch audit in
  // particular would then measure one mode twice while reporting on two.
  const env = { ...process.env, AUDIT_KILL_STALE: "1" };
  delete env.BASE_URL;
  run(audit, env);
}

console.log(`\n${"=".repeat(72)}`);
console.log("SUITE SUMMARY");
console.log("=".repeat(72));
for (const r of results) {
  console.log(`  ${r.code === 0 ? "PASS" : "FAIL"}  ${r.name}`);
}
const failed = results.filter((r) => r.code !== 0);
console.log(
  failed.length === 0
    ? `\nAll ${results.length} audits pass.`
    : `\n${failed.length} of ${results.length} audits failed: ${failed.map((r) => r.name).join(", ")}`,
);

// link-map is a measurement, not a gate. It has no failure condition, because
// "too few contextual links" is a judgment about a content plan rather than a
// defect, so running it inside the suite would either be noise or an arbitrary
// threshold. Named here so it is not forgotten rather than left out silently.
console.log(
  "\nNot in the suite: `npm run link-map` measures contextual versus template inbound",
);
console.log("links and has no pass or fail. Run it before and after any linking pass.");

process.exitCode = failed.length ? 1 : 0;
