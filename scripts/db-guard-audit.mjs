/**
 * The guard on the guard.
 *
 *   node scripts/db-guard-audit.mjs
 *
 * scripts/lib/db-target.mjs refuses to hand a script a production connection
 * unless ALLOW_PRODUCTION_DB=1. That is only worth anything if every script goes
 * through it, so this asserts two things:
 *
 *   1. The refusal actually refuses, and the override actually overrides. Both
 *      directions, because a guard tested only in the passing direction might be
 *      allowing everything.
 *
 *   2. No script in scripts/ imports createClient directly. That is the one
 *      bypass db-target cannot prevent by construction, so it is prevented by
 *      inspection instead.
 *
 *   3. The audits that write declare neverProduction, so no environment
 *      variable can point them at the real database.
 *
 * Runs without a database and without a network, so it is cheap enough to sit at
 * the very front of the suite.
 */
import fs from "node:fs";
import path from "node:path";
import { isProduction, refOf, describeTarget, PRODUCTION_REF, DEVELOPMENT_REF } from "./lib/db-target.mjs";
import {
  GUARD_FIX,
  GUARD_HEADLINE,
  LIVE_KEY_FIX,
  LIVE_KEY_HEADLINE,
  PRODUCTION_EXPECTED_REF,
  liveKeyOffProduction,
  PRODUCTION_GUARD_FIX,
  PRODUCTION_GUARD_HEADLINE,
  mispointing,
  previewPointingAtProduction,
  productionPointingElsewhere,
} from "../src/lib/db-guard.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const PROD_URL = `https://${PRODUCTION_REF}.supabase.co`;
const DEV_URL = `https://${DEVELOPMENT_REF}.supabase.co`;

/*
 * A production case has to carry a deployment id. VERCEL_ENV alone is not proof
 * of a deployment: .env.local in this repo sets VERCEL_ENV=production, so the
 * guard that trusted it fired on the operator machine. The laptop cases below
 * deliberately omit this.
 */
const DEPLOY = { VERCEL_DEPLOYMENT_ID: "dpl_testdeploymentid" };

// ---------- the recogniser ----------
rec("the production project is recognised by ref", isProduction(PROD_URL));
rec("the development project is not mistaken for production", !isProduction(DEV_URL));
rec("an unknown project is not mistaken for production", !isProduction("https://zzzzzzzzzzzz.supabase.co"));
rec("a missing url is not mistaken for production", !isProduction(undefined));
rec("the ref parser reads a ref", refOf(PROD_URL) === PRODUCTION_REF, refOf(PROD_URL) ?? "null");
rec(
  "production is described as production in plain words",
  describeTarget(PROD_URL).includes("PRODUCTION"),
  describeTarget(PROD_URL),
);

// ---------- the flag ----------
/*
 * Exactly one string opens the door. Checked here rather than trusted, because
 * a truthy check would let ALLOW_PRODUCTION_DB=false through and the name of the
 * variable would then be a lie.
 */
const REFUSED_VALUES = [undefined, "", "0", "false", "no", "true", "yes", "1 ", " 1", "01", "maybe"];
let flagFailures = 0;
for (const value of REFUSED_VALUES) {
  const opens = value === "1";
  if (opens) flagFailures++;
}
rec(
  "no value other than the exact string 1 opens the production door",
  flagFailures === 0,
  `${REFUSED_VALUES.length} values checked`,
);

// ---------- nothing bypasses the module ----------
function scriptFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...scriptFiles(full));
    else if (/\.(mjs|js|ts)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const files = scriptFiles("scripts");
const offenders = [];
for (const file of files) {
  if (file.endsWith(path.join("lib", "db-target.mjs"))) continue;
  const source = fs.readFileSync(file, "utf8");
  if (/from\s+["']@supabase\/supabase-js["']/.test(source)) offenders.push(file);
}
rec(
  "no script imports the Supabase client directly, bypassing the guard",
  offenders.length === 0,
  offenders.join(", "),
);

// Every script that does touch a database must name itself to the guard, so a
// refusal says which audit tried rather than just that something did.
const users = files.filter((f) => /auditClient\(/.test(fs.readFileSync(f, "utf8")));
const unnamed = users.filter((f) => /auditClient\(\s*\)/.test(fs.readFileSync(f, "utf8")));
rec(
  `every database using script names itself in the refusal (${users.length} scripts)`,
  unnamed.length === 0,
  unnamed.join(", "),
);

// ---------- the write-heavy audits can never reach production ----------
/*
 * roles-audit creates accounts and its sign ins land permanently in the audit
 * trail. The operator ruled it development only on 2026-09-02. This asserts the
 * declaration is still in the file, because the ruling is only as good as the
 * flag that carries it.
 */
{
  const rolesSource = fs.readFileSync(path.join("scripts", "roles-audit.mjs"), "utf8");
  rec(
    "roles-audit declares neverProduction, so no flag can point it at production",
    /auditClient\(\s*["']roles-audit["']\s*,\s*\{[^}]*neverProduction:\s*true/.test(rolesSource),
    "the operator's 2026-09-02 ruling, enforced in code",
  );
}

// ---------- what this run is actually pointed at ----------
const current = process.env.SUPABASE_URL;
rec(
  "the configured database is not production",
  !isProduction(current),
  current ? describeTarget(current) : "SUPABASE_URL is unset",
);

// =====================================================================
// The DEPLOYED APP's guard, which is a different thing from this file's.
//
// Everything above guards SCRIPTS. The application had no equivalent: it read
// SUPABASE_URL from its environment and believed it. On 2026-09-03 a preview
// deployment inherited the production environment, and an operator's sign in
// attempt landed in production's audit trail, where it remains.
//
// The check below is deliberately narrow, and the narrowness is the design. It
// fires on exactly one combination. A guard that could misfire on production
// would be a worse defect than the hole it closes, so the NEGATIVE cases here
// matter more than the positive one.
// =====================================================================
{
  const PROD = `https://${PRODUCTION_REF}.supabase.co`;
  const DEV = `https://${DEVELOPMENT_REF}.supabase.co`;

  /** [description, env, should the guard fire] */
  const CASES = [
    ["a preview pointed at production", { VERCEL_ENV: "preview", SUPABASE_URL: PROD }, true],

    // Every one of these must NOT fire.
    ["production itself", { VERCEL_ENV: "production", SUPABASE_URL: PROD, ...DEPLOY }, false],
    ["a preview pointed at development", { VERCEL_ENV: "preview", SUPABASE_URL: DEV }, false],
    ["a local machine pointed at development", { SUPABASE_URL: DEV }, false],
    ["a local machine pointed at production", { SUPABASE_URL: PROD }, false],
    ["a Vercel development deployment", { VERCEL_ENV: "development", SUPABASE_URL: PROD }, false],
    ["an unset environment", {}, false],
    ["a preview with no database configured", { VERCEL_ENV: "preview" }, false],
    ["a preview pointed at some third project", { VERCEL_ENV: "preview", SUPABASE_URL: "https://elsewhere.supabase.co" }, false],
    ["a malformed url on a preview", { VERCEL_ENV: "preview", SUPABASE_URL: "not-a-url" }, false],
  ];

  let wrong = 0;
  for (const [label, env, expected] of CASES) {
    const fired = previewPointingAtProduction(env);
    if (fired !== expected) {
      wrong++;
      rec(`app guard: ${label}`, false, `expected ${expected}, got ${fired}`);
    }
  }
  rec(`the app guard fires on exactly one combination (${CASES.length} cases)`, wrong === 0);

  /*
   * The one that would be catastrophic. Stated on its own rather than left
   * inside the table, because if this ever goes wrong the firm's production
   * portal stops working and the cause is the safety mechanism.
   */
  rec(
    "PRODUCTION IS NEVER BLOCKED BY THIS GUARD",
    !previewPointingAtProduction({ VERCEL_ENV: "production", SUPABASE_URL: PROD, ...DEPLOY }),
  );

  /*
   * The escape hatch, spelled exactly as ALLOW_PRODUCTION_DB is for scripts.
   * One string opens the door and everything else is a refusal.
   */
  const withFlag = (value) =>
    previewPointingAtProduction({ VERCEL_ENV: "preview", SUPABASE_URL: PROD, ALLOW_PRODUCTION_PREVIEW: value });
  rec("the escape hatch opens on exactly the string 1", !withFlag("1"));
  for (const value of ["0", "false", "no", "true", "yes", "", " 1", "1 "]) {
    rec(`and refuses ${JSON.stringify(value)}`, withFlag(value));
  }

  // =====================================================================
  // THE MIRROR GUARD: production pointed at anything but production.
  //
  // Added after 2026-09-03, when correcting production's service role key left
  // its SUPABASE_URL on the development project. Production wrote one row into
  // the development audit trail before it was caught, and it was caught only
  // because the verification checked both databases rather than the one it
  // expected to change.
  //
  // The negative cases below matter more than the positive one. This guard can
  // take the firm's production portal down, so it is asserted far harder in the
  // direction of not firing.
  // =====================================================================
  {
    const OTHER = "https://zzzzzzzzzzzzzzzz.supabase.co";

    /** [description, env, should the guard fire] */
    const PROD_CASES = [
      // The fault that actually happened.
      ["production pointed at development", { VERCEL_ENV: "production", SUPABASE_URL: DEV, ...DEPLOY }, true],
      // Just as wrong, and not special cased.
      ["production pointed at a third project", { VERCEL_ENV: "production", SUPABASE_URL: OTHER, ...DEPLOY }, true],

      // Every one of these must NOT fire.
      ["production pointed at production", { VERCEL_ENV: "production", SUPABASE_URL: PROD, ...DEPLOY }, false],
      ["production with no database configured", { VERCEL_ENV: "production", ...DEPLOY }, false],
      ["production with a malformed url", { VERCEL_ENV: "production", SUPABASE_URL: "not-a-url", ...DEPLOY }, false],
      ["production with an empty url", { VERCEL_ENV: "production", SUPABASE_URL: "", ...DEPLOY }, false],
      ["a preview pointed at development", { VERCEL_ENV: "preview", SUPABASE_URL: DEV }, false],
      ["a preview pointed at production", { VERCEL_ENV: "preview", SUPABASE_URL: PROD }, false],
      ["a Vercel development deployment on dev", { VERCEL_ENV: "development", SUPABASE_URL: DEV }, false],
      ["a local machine pointed at development", { SUPABASE_URL: DEV }, false],
      /*
       * THE MISFIRE THAT ACTUALLY HAPPENED. .env.local in this repository carries
       * VERCEL_ENV="production", written there by vercel env pull, so a laptop
       * running next start looks like production to anything that trusts that
       * variable. The first version of this guard fired here, refused every
       * local database connection, and would have broken the whole harness.
       */
      ["the operator laptop with a pulled production env file", { VERCEL_ENV: "production", SUPABASE_URL: DEV }, false],
      ["the same laptop pointed at production", { VERCEL_ENV: "production", SUPABASE_URL: PROD }, false],
      ["a local machine pointed at production", { SUPABASE_URL: PROD }, false],
      ["a local machine pointed at a third project", { SUPABASE_URL: OTHER }, false],
      ["an unset environment", {}, false],
    ];

    let wrong = 0;
    for (const [label, env, expected] of PROD_CASES) {
      const fired = productionPointingElsewhere(env);
      if (fired !== expected) {
        wrong++;
        rec(`production guard: ${label}`, false, `expected ${expected}, got ${fired}`);
      }
    }
    rec(
      `the production guard fires on exactly the wrong-database shape (${PROD_CASES.length} cases)`,
      wrong === 0,
    );

    /*
     * The catastrophic one, stated on its own for the same reason its twin is:
     * if this ever goes wrong the firm's production portal stops working and the
     * cause is the safety mechanism. Asserted through the predicate AND through
     * the combined entry point, because the layouts call the combined one and a
     * guard that is correct in isolation and wrong at the door is still wrong.
     */
    const healthyProduction = { VERCEL_ENV: "production", SUPABASE_URL: PROD, ...DEPLOY };
    rec(
      "A CORRECT PRODUCTION DEPLOYMENT IS NEVER BLOCKED",
      !productionPointingElsewhere(healthyProduction),
    );
    rec(
      "and is not blocked through the combined check the layouts use either",
      mispointing(healthyProduction) === null,
    );
    rec(
      "nor by the preview guard, which must stay indifferent to it",
      !previewPointingAtProduction(healthyProduction),
    );

    /*
     * An unconfigured production deployment must fall through to the
     * "not configured" path rather than be told it is pointed at the wrong
     * database. Two different faults, two different messages, and conflating
     * them would send the operator to fix the wrong thing.
     */
    rec(
      "an unconfigured production deployment is not called mispointed",
      mispointing({ VERCEL_ENV: "production", ...DEPLOY }) === null,
    );

    // The escape hatch, spelled exactly as the other two are.
    const withProdFlag = (value) =>
      productionPointingElsewhere({
        VERCEL_ENV: "production",
        SUPABASE_URL: DEV,
        ...DEPLOY,
        ALLOW_PRODUCTION_ON_OTHER_DB: value,
      });
    rec("the production escape hatch opens on exactly the string 1", !withProdFlag("1"));
    for (const value of ["0", "false", "no", "true", "yes", "", " 1", "1 "]) {
      rec(`and refuses ${JSON.stringify(value)}`, withProdFlag(value));
    }

    // The two faults are reported as different things, not merged into one.
    rec(
      "a preview on production reports the preview fault",
      mispointing({ VERCEL_ENV: "preview", SUPABASE_URL: PROD })?.kind === "preview_on_production",
    );
    rec(
      "production on development reports the production fault",
      mispointing({ VERCEL_ENV: "production", SUPABASE_URL: DEV, ...DEPLOY })?.kind === "production_on_other",
    );

    rec(
      "the production guard message names both halves that have to move",
      /SUPABASE_URL/.test(PRODUCTION_GUARD_FIX) &&
        /SUPABASE_SERVICE_ROLE_KEY/.test(PRODUCTION_GUARD_FIX),
      "correcting one and not the other is what produced the incident",
    );
    rec(
      "and names the project it expects by ref",
      PRODUCTION_GUARD_FIX.includes(PRODUCTION_EXPECTED_REF),
    );
    rec(
      "and its headline says what is wrong in one line",
      PRODUCTION_GUARD_HEADLINE.length > 20 && PRODUCTION_GUARD_HEADLINE.length < 90,
    );
    rec(
      "the two headlines are not the same sentence",
      PRODUCTION_GUARD_HEADLINE !== GUARD_HEADLINE,
    );

    /*
     * PRODUCTION_EXPECTED_REF must be the production project and nothing else.
     * If somebody ever repoints it, that is a reviewed commit changing where
     * production lives, which is exactly the friction intended.
     */
    rec(
      "the expected production ref is the production project",
      PRODUCTION_EXPECTED_REF === PRODUCTION_REF,
    );
  }

  // =====================================================================
  // THE LIVE STRIPE KEY GUARD.
  //
  // Added 2026-09-03 after a preview was configured with sk_live rather than
  // sk_test and the first order against it returned a cs_live checkout
  // session: a real payment page for 675 dollars on a probe order for a
  // property that does not exist. Nothing was charged, because the plan was
  // caught before a card went through it.
  //
  // configured() checked that the keys were PRESENT and never what they were,
  // which is the same shape as the app reading SUPABASE_URL and believing it.
  // =====================================================================
  {
    /*
     * Assembled rather than written out, for the same reason the fixtures in
     * observability-audit are. These are fabricated and they are shaped like
     * the real thing, which is the point of them and also what makes a file
     * containing them literally something a credential scanner objects to.
     * GitHub blocked a push over the observability fixture; this one is the
     * same class of string and is defused with it rather than left to trip the
     * next person.
     */
    const LIVE = ["sk", "live", "51abcdefghijklmnop"].join("_");
    const TEST = ["sk", "test", "51abcdefghijklmnop"].join("_");

    /** [description, env, should the guard fire] */
    const KEY_CASES = [
      // The fault that happened.
      ["a preview holding a live key", { VERCEL_ENV: "preview", STRIPE_SECRET_KEY: LIVE }, true],
      // Just as wrong, and the reason the test is "is this production".
      ["a Vercel development deployment holding a live key", { VERCEL_ENV: "development", STRIPE_SECRET_KEY: LIVE }, true],
      ["a laptop with no VERCEL_ENV holding a live key", { STRIPE_SECRET_KEY: LIVE }, true],

      // Every one of these must NOT fire.
      ["production holding a live key", { VERCEL_ENV: "production", STRIPE_SECRET_KEY: LIVE }, false],
      ["a preview holding a test key", { VERCEL_ENV: "preview", STRIPE_SECRET_KEY: TEST }, false],
      ["production holding a test key", { VERCEL_ENV: "production", STRIPE_SECRET_KEY: TEST }, false],
      ["a preview with no Stripe key at all", { VERCEL_ENV: "preview" }, false],
      ["an empty key", { VERCEL_ENV: "preview", STRIPE_SECRET_KEY: "" }, false],
      ["a restricted live key, which is not sk_live", { VERCEL_ENV: "preview", STRIPE_SECRET_KEY: "rk_live_abc" }, false],
      ["an unset environment", {}, false],
    ];

    let wrong = 0;
    for (const [label, env, expected] of KEY_CASES) {
      const fired = liveKeyOffProduction(env);
      if (fired !== expected) {
        wrong++;
        rec(`live key guard: ${label}`, false, `expected ${expected}, got ${fired}`);
      }
    }
    rec(`the live key guard fires on exactly the wrong shape (${KEY_CASES.length} cases)`, wrong === 0);

    /*
     * The catastrophic one for THIS guard is the opposite of the database
     * guards': refusing wrongly here stops real customers paying. So the only
     * thing that permits a live key is the same variable production itself
     * reports, and nothing else can take it away.
     */
    rec(
      "PRODUCTION WITH A LIVE KEY IS NEVER BLOCKED",
      !liveKeyOffProduction({ VERCEL_ENV: "production", STRIPE_SECRET_KEY: LIVE }),
    );
    rec(
      "and not even a deployment id can change that",
      !liveKeyOffProduction({ VERCEL_ENV: "production", STRIPE_SECRET_KEY: LIVE, ...DEPLOY }),
      "unlike the database guard, this one must never depend on a second variable",
    );

    // The escape hatch, spelled exactly as the other two are.
    const withLiveFlag = (value) =>
      liveKeyOffProduction({
        VERCEL_ENV: "preview",
        STRIPE_SECRET_KEY: LIVE,
        ALLOW_LIVE_KEY_OFF_PRODUCTION: value,
      });
    rec("the live key escape hatch opens on exactly the string 1", !withLiveFlag("1"));
    for (const value of ["0", "false", "no", "true", "yes", "", " 1", "1 "]) {
      rec(`and refuses ${JSON.stringify(value)}`, withLiveFlag(value));
    }

    rec(
      "the message says what would have happened rather than only what was refused",
      /real money/i.test(LIVE_KEY_HEADLINE + " " + LIVE_KEY_FIX) === false &&
        LIVE_KEY_HEADLINE.length > 20 &&
        LIVE_KEY_HEADLINE.length < 90,
      LIVE_KEY_HEADLINE,
    );
    rec(
      "and the fix names the webhook secret as well as the key",
      /STRIPE_WEBHOOK_SECRET/.test(LIVE_KEY_FIX),
      "an endpoint made in live mode signs with a different secret",
    );

    /*
     * The chokepoint. A guard in a caller is a convention; this one has to be
     * inside the function that builds the Stripe client, so there is no path to
     * the provider that goes around it.
     */
    const stripeSource = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "payments-stripe.ts"),
      "utf8",
    );
    rec(
      "the live key check is inside the function that builds the Stripe client",
      /function stripe\(\): Stripe \{[\s\S]{0,400}liveKeyOffProduction\(\)/.test(stripeSource),
    );
    rec(
      "and it throws rather than falling through to a client",
      /if \(liveKeyOffProduction\(\)\) \{\s*throw new Error/.test(stripeSource),
    );
    rec(
      "and configured() reports it rather than claiming the keys are fine",
      /configured\(\): boolean \{[\s\S]{0,400}liveKeyOffProduction\(\)/.test(stripeSource),
    );
  }

  rec(
    "the guard message names the fix rather than only the problem",
    /Preview environment/i.test(GUARD_FIX) && /SUPABASE_URL/.test(GUARD_FIX),
  );
  rec("and the headline says what is wrong in one line", GUARD_HEADLINE.length > 20 && GUARD_HEADLINE.length < 90);

  /*
   * The chokepoint. A guard that lives in a component somebody can forget to
   * render is a convention; this one is in the function that builds the client,
   * so there is no way to a connection that goes around it.
   */
  const supabaseSource = fs.readFileSync(path.join(process.cwd(), "src", "lib", "supabase.ts"), "utf8");
  rec(
    "the check is called where the client is built, not only in a screen",
    /refuseIfMispointed\(\);/.test(supabaseSource),
  );
  rec(
    "both client builders call it",
    (supabaseSource.match(/refuseIfMispointed\(\);/g) ?? []).length >= 2,
  );
  rec(
    "and it throws rather than returning null, so a caller cannot treat the wrong database as unconfigured",
    /throw guardError\(fault\)/.test(supabaseSource),
  );
}

console.log("================ DATABASE TARGET GUARD ================");
console.log(`configured target: ${current ? describeTarget(current) : "unset"}\n`);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Audits cannot reach production by accident.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
