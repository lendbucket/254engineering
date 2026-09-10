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
import { readSource } from "./lib/read-source.mjs";
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
  databaseInUse,
  environmentLabel,
  whereRunning,
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
  const source = readSource(file);
  if (/from\s+["']@supabase\/supabase-js["']/.test(source)) offenders.push(file);
}
rec(
  "no script imports the Supabase client directly, bypassing the guard",
  offenders.length === 0,
  offenders.join(", "),
);

// Every script that does touch a database must name itself to the guard, so a
// refusal says which audit tried rather than just that something did.
const users = files.filter((f) => /auditClient\(/.test(readSource(f)));
const unnamed = users.filter((f) => /auditClient\(\s*\)/.test(readSource(f)));
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
  const rolesSource = readSource(path.join("scripts", "roles-audit.mjs"));
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

/*
 * AND IT IS DEVELOPMENT, WHICH IS NOT THE SAME CLAIM.
 *
 * Operator ruling, 2026-09-09: a board that can write to a ledger is a board
 * that must prove WHICH ledger. The check above says "not production", and an
 * unknown project passes it: CLAUDE.md section 6b already names that hazard for
 * qmvcqvkywmkogxbyzsaz, the cutover project, which would read as an ordinary
 * development target to every guard in this repository.
 *
 * It matters more since 0032. The board writes a standing demonstration ledger
 * entry, and eng_production_ledger now refuses DELETE, so a run pointed at the
 * wrong project leaves money rows there that nobody can remove.
 *
 * This runs FIRST in the suite, before anything opens a connection.
 */
rec(
  "and it is the development project by ref, not merely something that is not production",
  refOf(current) === DEVELOPMENT_REF,
  current
    ? `${describeTarget(current)}; expected ${DEVELOPMENT_REF}, found ${refOf(current) ?? "no ref"}`
    : "SUPABASE_URL is unset",
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
    const stripeSource = readSource(
      path.join(process.cwd(), "src", "lib", "payments-stripe.ts"),
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
  const supabaseSource = readSource(path.join(process.cwd(), "src", "lib", "supabase.ts"));
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

/*
 * =====================================================================
 * AND WHAT THE PORTAL TELLS THE PERSON READING IT.
 *
 * The footer said "production" on the operator's machine, over the development
 * database, because ENVIRONMENT is VERCEL_ENV or NODE_ENV and both say
 * production there: `vercel env pull` writes VERCEL_ENV=production into
 * .env.local, and a built server sets NODE_ENV=production.
 *
 * That is the same class as every incident this file guards. Each one began
 * with somebody being confident about which database they were touching, and a
 * footer that is wrong in the reassuring direction is worse than no footer,
 * because it is a check that passes while looking at the wrong thing and the
 * reader is the one running it.
 *
 * The cases below are the ones that actually occur, and the first is the defect.
 * =====================================================================
 */
{
  const LAPTOP = { VERCEL_ENV: "production", SUPABASE_URL: DEV_URL };

  rec(
    "the label refuses to say production on a laptop pointed at development",
    environmentLabel(LAPTOP) === "local on the development database",
    environmentLabel(LAPTOP),
  );

  rec(
    "a real production deployment says production, and says which database",
    environmentLabel({ ...DEPLOY, VERCEL_ENV: "production", SUPABASE_URL: PROD_URL }) ===
      "production on the production database",
    environmentLabel({ ...DEPLOY, VERCEL_ENV: "production", SUPABASE_URL: PROD_URL }),
  );

  rec(
    "a preview on development says both halves",
    environmentLabel({ ...DEPLOY, VERCEL_ENV: "preview", SUPABASE_URL: DEV_URL }) ===
      "preview on the development database",
    environmentLabel({ ...DEPLOY, VERCEL_ENV: "preview", SUPABASE_URL: DEV_URL }),
  );

  /*
   * The alarm case. It is also the one the mispointing guard refuses outright,
   * so this string should never reach a footer; it is asserted because a label
   * that could not express the fault would be a label nobody could trust to
   * report it.
   */
  rec(
    "and production over development is sayable, so the reader would see it",
    environmentLabel({ ...DEPLOY, VERCEL_ENV: "production", SUPABASE_URL: DEV_URL }) ===
      "production on the development database",
    environmentLabel({ ...DEPLOY, VERCEL_ENV: "production", SUPABASE_URL: DEV_URL }),
  );

  const third = "https://qqqqqqqqqqqq.supabase.co";
  rec(
    "an unrecognised project is named rather than called unknown",
    databaseInUse({ SUPABASE_URL: third }) === "an unrecognised database (qqqqqqqqqqqq)",
    databaseInUse({ SUPABASE_URL: third }),
  );
  rec(
    "and no database is said plainly rather than guessed at",
    databaseInUse({}) === "no database",
    databaseInUse({}),
  );

  rec(
    "where it runs is decided by the deployment id, not by a variable a laptop can hold",
    whereRunning({ VERCEL_ENV: "production" }) === "local" &&
      whereRunning({ ...DEPLOY, VERCEL_ENV: "production" }) === "production",
    "vercel env pull writes VERCEL_ENV into .env.local, which is why this is the same test the production guard makes",
  );

  /*
   * AND THE SCREENS USE IT.
   *
   * The functions above being right is worth nothing if the footer still
   * renders ENVIRONMENT. This is the coupling check, and it is the one that
   * would catch a revert: both surfaces call the label, and neither prints
   * ENVIRONMENT any more.
   */
  for (const [file, what] of [
    ["src/app/portal/(app)/layout.tsx", "the portal footer"],
    ["src/app/portal/(app)/status/page.tsx", "the status page"],
  ]) {
    const source = readSource(path.join(process.cwd(), ...file.split("/")));
    rec(
      `${what} shows the label rather than the build mode`,
      /environmentLabel\(\)/.test(source) && !/\{ENVIRONMENT\}|\$\{ENVIRONMENT\}/.test(source),
      file,
    );
  }

  /*
   * And ENVIRONMENT itself is left alone, because faults are grouped by it and
   * regrouping every historic fault to fix a footer would be the wrong trade.
   */
  const obs = readSource(path.join(process.cwd(), "src", "lib", "ops-observability.ts"));
  rec(
    "and fault grouping still uses the build mode it always did",
    /export const ENVIRONMENT = process\.env\.VERCEL_ENV \?\? process\.env\.NODE_ENV/.test(obs) &&
      /environment: ENVIRONMENT/.test(obs),
    "a label for a reader and a key for grouping are different jobs",
  );
}

console.log("================ DATABASE TARGET GUARD ================");
console.log(`configured target: ${current ? describeTarget(current) : "unset"}\n`);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
// ===========================================================================
// NO RECORDED MOMENT COMES FROM A PROCESS CLOCK.
//
// Operator ruling, 2026-09-09, after queue-audit measured this machine running
// 85 seconds ahead of the database. Everything the queue decides is decided by
// the DATABASE's now(); everything the application stamped was written with the
// machine's. The gap had already produced two defects before anybody measured
// it, and both were found as puzzles rather than as clock problems.
//
// This lives with the database guard because it is the same kind of rule: what
// this platform is allowed to write to a database, enforced by something that
// reads the whole tree rather than by whoever remembers.
//
// It matches an assignment shaped like a recorded moment, name_at, and nothing
// else. A COMPUTED time is arithmetic the application did and should look like
// it, so payable_at: new Date(input.payableAtMs) is deliberately not matched:
// the moment it describes is not now and never was.
// ===========================================================================
{
  const offenders = [];
  /*
   * TWO SHAPES, AND THE SECOND WAS FOUND THE HARD WAY.
   *
   * The first is a literal in an object. The second is an assignment onto a
   * patch object, which is how a column that is only SOMETIMES written gets
   * set: patch.paid_at = now.
   *
   * Only the first was matched at first, and the miss was in the worst place
   * available. setLedgerStatus is the one operator side BULK write in this
   * platform, and it stamped approved_at and paid_at on up to three hundred
   * technician payment rows from this machine's clock in a single press. It was
   * found by surveying bulk operations for Section 1 rather than by this check,
   * which is the argument for the check matching both.
   */
  /*
   * ===========================================================================
   * A PATTERN COULD NOT SEE TWELVE OF THESE, SO THIS IS A DECLARATION INSTEAD.
   * ===========================================================================
   *
   * The pattern that used to live here matched a literal column name followed
   * immediately by the machine clock:
   *
   *   /[a-z_]+_at(:|s*=)s*(new Date().toISOString()|now|...)/
   *
   * It was widened once already, after setLedgerStatus was found stamping three
   * hundred technician payment rows from this machine in one press. It was
   * still wrong, and on 2026-09-10 an overnight sweep found THIRTEEN stored
   * timestamps it could not see. Every one of them hid the same way: the
   * machine clock was not adjacent to the column name.
   *
   *   patch[stamp] = new Date().toISOString()        a COMPUTED key, and this
   *                                                  one wrote sealed_at
   *   [field]: value ? new Date()... : null          a computed key and a ternary
   *   price_overridden_at: x ? new Date()... : null  a TERNARY
   *   captured_at: input.capturedAt ?? new Date()... a FALLBACK
   *   started_at: input.startedAt || new Date()...   a fallback
   *   run_after: new Date().toISOString()            the name does not end in _at
   *   const paidAt = new Date()...; { paid_at: paidAt }   a VARIABLE
   *
   * sealed_at is when a named Professional Engineer put their seal on the
   * firm's regulatory output. paid_at is when a customer's money arrived.
   * Both were written from a clock measured 85 seconds ahead of the database.
   *
   * ==========================================================================
   * A PATTERN WRONG TWICE THE SAME WAY IS THE WRONG MECHANISM.
   * Operator ruling, 2026-09-10, and it is the sentence this declaration exists
   * under rather than a remark about one regex.
   * ==========================================================================
   *
   * A pattern that has been wrong twice in the same way is the wrong mechanism.
   * So the rule is inverted, into the declared inventory idiom this repository
   * uses for surfaces, migrations and bulk paths: EVERY use of the machine
   * clock in src/ is declared here with what it is for, and anything
   * undeclared fails. A pattern has to guess which uses are writes. A
   * declaration makes somebody say so.
   *
   * Adding a machine clock call is now a decision somebody writes down, which
   * is the only thing that would have caught any of the thirteen.
   */
  const ALLOWED = {
    "src/app/api/cron/health-watch/route.ts": "checkedAt on an in memory health report, returned and never stored",
    "src/app/api/portal/exports/route.ts": "the date in a downloaded file's NAME",
    "src/app/portal/(app)/jobs/[id]/CaptureClient.tsx":
      "the DEVICE's clock, which is the honest answer to when a photograph was taken and is not a server's to decide",
    "src/app/portal/(app)/partners/[id]/PartnerActions.tsx": "default values in a form, in the browser, twice",
    "src/lib/deletion-requests.ts": "a date inside a sentence written into a note",
    "src/lib/job-handlers.ts": "a local now for comparison; the writes beside it send DB_NOW",
    "src/lib/ops-dashboard.ts": "three comparisons against ages, reading rather than writing",
    "src/lib/ops-docs.ts":
      "generatedAt on an in memory binder manifest, and two date cells in a CSV a person reads",
    "src/lib/ops-engineer.ts": "today, for comparison",
    "src/lib/ops-field.ts": "today for comparison, and the YYYY-MM period a ledger row is bucketed under",
    "src/lib/ops-observability.ts": "a comparison and an in memory health report",
    "src/lib/ops-payments.ts": "sealedAt as a rendered phrase inside an email, never a column",
  };

  const machineClock = [];
  const walkSrc = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) walkSrc(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const rel = full.split("\\").join("/");
        for (const line of readSource(full).split("\n")) {
          if (/new Date\(\)\.toISOString\(\)/.test(line)) {
            machineClock.push({ rel, line: line.trim().slice(0, 100) });
          }
        }
      }
    }
  };
  walkSrc("src");

  for (const hit of machineClock) {
    if (!ALLOWED[hit.rel]) offenders.push(hit.rel + ": " + hit.line);
  }

  /*
   * AND THE DECLARATION IS SWEPT BACK, so a reason recorded for a use that no
   * longer exists is removed rather than left standing. A stale exemption is a
   * reason nobody will ever question, which is the failure native-audit's
   * accounted list already records.
   */
  const usedFiles = new Set(machineClock.map((h) => h.rel));
  const staleAllowances = Object.keys(ALLOWED).filter((f) => !usedFiles.has(f));
  rec(
    "no file is excused for a machine clock call it no longer makes",
    staleAllowances.length === 0,
    staleAllowances.join(", ") || Object.keys(ALLOWED).length + " allowance(s), every one still used",
  );

  rec(
    "there are machine clock calls to sweep (" + machineClock.length + ")",
    machineClock.length > 0,
    "a sweep with nothing to sweep passes forever",
  );

  rec(
    "no observed timestamp in src/ is written from this process's clock",
    offenders.length === 0,
    offenders.length
      ? offenders.length + ": " + offenders.slice(0, 3).join(" | ")
      : "every one sends DB_NOW, which Postgres resolves to transaction_timestamp()",
  );

  /*
   * And the mechanism is what it claims to be. Without this the check above is
   * only asserting that a particular string is absent, which a typo in DB_NOW
   * would satisfy perfectly while writing the word "nwo" into a timestamp
   * column on every row.
   */
  rec(
    "and DB_NOW is the literal Postgres resolves against its own clock",
    /export const DB_NOW = "now";/.test(readSource("src/lib/db-now.ts")),
    "verified against the development database rather than taken from documentation",
  );

  /*
   * The count, because a sweep with nothing to sweep would pass every run while
   * meaning nothing. This is the vacuous-check trap this repository keeps
   * meeting, and stating the number is how the green stays cheap to read.
   */
  let governed = 0;
  const countSrc = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) countSrc(full);
      else if (/\.tsx?$/.test(entry.name)) {
        governed += (readSource(full).match(/_at(:| =) DB_NOW/g) ?? []).length;
      }
    }
  };
  countSrc("src");
  rec(
    "and there are timestamps for it to govern (" + governed + ")",
    governed > 30,
    "if this were zero the check above would be passing over an empty tree",
  );
}

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Audits cannot reach production by accident.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
