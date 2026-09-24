/**
 * =============================================================================
 * AFTER-CHECK: CAN A PREVIEW DEPLOYMENT STILL MINT A SESSION?
 * =============================================================================
 *
 * Operator ruling, 2026-09-24. `CUSTOMER_SESSION_SECRET` and
 * `PARTNER_SESSION_SECRET` were unticked from Preview in Vercel. This asks the
 * preview itself whether that took effect, rather than trusting a dashboard
 * screenshot or this session's memory of one.
 *
 * It is the second half of the pair CLAUDE.md describes: the operator reads a
 * console no check here can see, and a check compares that record against
 * something the repository can actually reach. This is the reaching half.
 *
 * =============================================================================
 * IT ASSERTS THE CODE AT THE DEPLOYED COMMIT, NOT THE CODE ON MAIN
 * =============================================================================
 *
 * Operator instruction, and it is the thing that makes this check honest. The
 * preview under test was built from 24b778c on feat/site-copy, a 2026-09-18
 * commit. Main has moved since. A check asserting sentences that exist on main
 * would be asserting sentences that may not be in the artefact it is probing,
 * which is this repository's recurring defect wearing a deployment: looking at
 * the right subject in the wrong place.
 *
 * So every sentence below is read out of the tree at DEPLOYED_COMMIT with
 * `git show`, and the run refuses if the file at that commit does not contain
 * it. If the sentence changed between then and now, this check fails loudly
 * rather than probing for a string the deployment never had.
 *
 * =============================================================================
 * WHY THE PARTNER DOOR AND NOT THE CUSTOMER DOOR
 * =============================================================================
 *
 * Read at 24b778c, the two routes order their checks differently and only one
 * of them is observable from outside:
 *
 *   api/partner/session   partnerSessionConfigured() at line 90, BEFORE
 *                         signInPartner at line 99. A bogus credential is
 *                         refused by the CONFIGURATION check, so the answer
 *                         distinguishes "no secret" from "secret present"
 *                         without any valid credential and without a write.
 *
 *   api/account/session   signInCustomer FIRST, and issueCustomerSession only
 *                         after it succeeds. A bogus credential gets 401, which
 *                         is exactly what a healthy deployment returns. The
 *                         503 "Accounts are not available on this deployment."
 *                         is reachable ONLY with a valid customer password.
 *
 * So the customer half is reported COULD NOT TELL with that reason, and it is
 * a finding rather than a gap in this script: a configuration state that can
 * only be observed by signing somebody in is a configuration state nobody can
 * verify after changing it. `unreachable is not failed`.
 *
 * =============================================================================
 * WHAT IT REFUSES TO DO
 * =============================================================================
 *
 * It never runs against production or localhost, asserted below rather than
 * intended. It signs nobody in, creates nothing, and sends exactly ONE request
 * to the partner door, because that route carries a rate limiter whose own
 * sentence would otherwise become a third outcome this check cannot read.
 *
 * A BROWSER, NOT curl. CLAUDE.md: a Vercel deployment answers curl with 403 and
 * a JavaScript challenge. Chromium executes it, so the fetch is issued from
 * inside the page's origin after the challenge has been satisfied.
 *
 *   BASE_URL=https://<preview>.vercel.app npx tsx scripts/preview-cannot-mint.mjs
 */

import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "";
const DEPLOYED_COMMIT = process.env.DEPLOYED_COMMIT ?? "24b778c";

/** A self identifying address, so anything a deployment records names itself. */
const PROBE_EMAIL = "preview-cannot-mint@audit-probe.invalid";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const unmeasured = [];

console.log("");
console.log("============ CAN A PREVIEW STILL MINT A SESSION ============");
console.log("");

// ------------------------------------------------- refuse the wrong targets

if (!/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/i.test(BASE)) {
  console.log(`REFUSED: BASE_URL must be a single preview deployment on vercel.app. Got: ${BASE || "nothing"}`);
  console.log("This check never runs against production and never against localhost.");
  process.exitCode = 1;
} else {
  console.log(`preview      ${BASE}`);
  console.log(`deployed from ${DEPLOYED_COMMIT}, on the operator's statement`);
  console.log("");

  // ------------------------------- the sentences, read at the deployed commit

  const atCommit = (path) => {
    try {
      return execFileSync("git", ["show", `${DEPLOYED_COMMIT}:${path}`], { encoding: "utf8" });
    } catch (e) {
      return null;
    }
  };

  const partnerRoute = atCommit("src/app/api/partner/session/route.ts");
  const customerRoute = atCommit("src/app/api/account/session/route.ts");

  const NOT_CONFIGURED = "The partner programme is not configured on this deployment.";

  rec(
    `the partner route exists at ${DEPLOYED_COMMIT}`,
    partnerRoute !== null,
    partnerRoute === null ? "git show found nothing, so nothing below is about the deployed artefact" : "",
  );

  rec(
    "and the refusal sentence this check looks for is IN that commit",
    (partnerRoute ?? "").includes(NOT_CONFIGURED),
    NOT_CONFIGURED,
  );

  /*
   * THE ORDER IS THE PROPERTY, and it is asserted rather than assumed, because
   * the whole probe depends on it. If a later commit moved the configuration
   * check below the credential check, this check would silently start reading a
   * credential refusal as evidence of configuration.
   */
  const configuredAt = (partnerRoute ?? "").indexOf("partnerSessionConfigured()");
  const signInAt = (partnerRoute ?? "").indexOf("signInPartner(");
  rec(
    "and that commit checks configuration BEFORE credentials",
    configuredAt > 0 && signInAt > 0 && configuredAt < signInAt,
    configuredAt < signInAt
      ? "so a bogus credential is refused by the configuration check, which is what makes this observable"
      : "the order is reversed, so this probe cannot distinguish the two states",
  );

  rec(
    "the CUSTOMER route at that commit checks credentials first, so its configuration is not observable",
    (customerRoute ?? "").indexOf("signInCustomer(") < (customerRoute ?? "").indexOf("issueCustomerSession("),
    "recorded as the reason the customer half below is COULD NOT TELL rather than a pass",
  );

  // ---------------------------------------------------------------- the probe

  const ready = out.every((r) => r.ok);
  if (!ready) {
    unmeasured.push("the source assertions failed, so no request was sent");
  } else {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    let landing = 0;
    try {
      const response = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
      landing = response?.status() ?? 0;
    } catch (e) {
      unmeasured.push(`the preview did not answer: ${String(e).slice(0, 160)}`);
    }

    rec(`the preview answers in a browser (HTTP ${landing})`, landing === 200, "the bot challenge is executed by chromium");

    /*
     * =====================================================================
     * CAN THIS DEPLOYMENT ANSWER AT ALL? ASKED BEFORE ANYTHING IS READ.
     * =====================================================================
     *
     * Added 2026-09-24 after the first run of this check reported a FAIL that
     * was nothing of the kind. The preview answered the partner door with
     *
     *   404 {"error":{"code":"not_found","message":"The requested API
     *        endpoint was not found."}}
     *
     * which is VERCEL's platform error, not this application's. The first
     * version tested "is the body the unconfigured sentence", treated no as
     * yes-it-can-mint, and printed a red saying PARTNER_SESSION_SECRET was
     * still present on Preview. It had not observed that at all.
     *
     * Three outcomes folded into two, and the fold landed on the alarming
     * branch. That is the grep-in-a-conditional defect from CLAUDE.md wearing
     * an HTTP status, and it is worst here for the reason that file gives: a
     * false red on a negative security assertion is the sentence somebody
     * quotes in an incident review.
     *
     * Probed directly: /api/portal/health, /api/partner/session and
     * /api/account/session all answer 404 with the platform error, /partner
     * answers 404 "does not exist or is not publicly accessible", and
     * /account/login answers 200 with real prerendered HTML. This deployment
     * serves static pages from the CDN and NO functions. There is nothing to
     * ask, so the honest answer is that it could not tell.
     *
     * The health route is the right instrument because its whole purpose is to
     * answer one bit about a deployment, and because it needs no credential.
     */
    const health = await page.evaluate(async () => {
      const r = await fetch("/api/portal/health", { method: "GET" });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    });

    const functionsAnswer = /"ok"\s*:\s*(true|false)/.test(health.body);
    console.log(`  health probe answered HTTP ${health.status}: ${health.body.slice(0, 120)}`);

    if (!functionsAnswer) {
      unmeasured.push(
        `this deployment serves no functions. /api/portal/health answered ${health.status} with ${health.body.slice(0, 90)}, ` +
          `which is Vercel's own error rather than this application's. Static pages answer 200 from the CDN. ` +
          `Nothing about a session secret is observable here, and a 404 from the partner door is not evidence the secret is absent.`,
      );
    } else if (landing === 200) {
      /*
       * ONE request. The route rate limits, and a second attempt would answer
       * with the limiter's sentence, which is neither of the two outcomes this
       * check can read.
       */
      const answer = await page.evaluate(async ({ email }) => {
        const r = await fetch("/api/partner/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: "not-a-real-password" }),
        });
        let body = "";
        try {
          body = JSON.stringify(await r.json());
        } catch {
          body = "(not json)";
        }
        return { status: r.status, body };
      }, { email: PROBE_EMAIL });

      console.log(`  partner door answered HTTP ${answer.status}: ${answer.body.slice(0, 200)}`);
      console.log("");

      /*
       * THREE OUTCOMES, NAMED, because two of them are answers and the third
       * is the absence of one. Anything that is not this application speaking
       * is not evidence about a secret.
       */
      const saysUnconfigured = answer.body.includes(NOT_CONFIGURED);
      const saysRateLimited = /Too many attempts/i.test(answer.body);
      const ourApp = /"ok"\s*:\s*false/.test(answer.body);

      if (saysRateLimited) {
        unmeasured.push(
          "the partner door answered with its rate limiter, which is neither outcome. Wait a few minutes and run it once more.",
        );
      } else if (!ourApp) {
        unmeasured.push(
          `the partner door answered ${answer.status} with ${answer.body.slice(0, 120)}, which is not this application's shape. ` +
            `Nothing was observed about PARTNER_SESSION_SECRET, and this is NOT evidence that it is absent.`,
        );
      } else {
        rec(
          "a preview deployment cannot mint a partner session, because it holds no partner secret",
          saysUnconfigured,
          saysUnconfigured
            ? "the untick took effect on this deployment"
            : `the door got past its configuration check, so PARTNER_SESSION_SECRET is still present on Preview: ${answer.body.slice(0, 160)}`,
        );
      }
    }

    await context.close();
    await browser.close();
  }

  unmeasured.push(
    "the CUSTOMER secret. At " +
      DEPLOYED_COMMIT +
      " the account door verifies the password before it tries to mint, so a deployment with no CUSTOMER_SESSION_SECRET and one with a working secret answer a bogus login identically. Proving that half needs either a valid customer password on this preview, which this session will not use, or the operator reading the Preview variable list for this deployment.",
  );
}

// ----------------------------------------------------------------- verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
for (const u of unmeasured) console.log(`  COULD NOT TELL: ${u}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
} else if (out.length > 0) {
  console.log(`PASS: ${out.length} checks, ${unmeasured.length} could not tell.`);
  process.exitCode = 0;
}
