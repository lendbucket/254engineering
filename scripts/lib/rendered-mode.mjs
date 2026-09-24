/**
 * =============================================================================
 * WHAT MODE WAS THE BUILD UNDER TEST MADE IN? ASKED, NEVER ASSUMED.
 * =============================================================================
 *
 * Operator ruling, 2026-09-24, after a board went red for the wrong reason and
 * a proof went green for the wrong reason, on the same property, in one hour.
 *
 * THE INCIDENT. `voice-audit` scans a running site and judges its copy against
 * the compliance gate. It read the gate from ITS OWN process, which does not
 * load `.env.local`, so `FIRM_PHONE` was unset, the `phone` trading condition
 * was unmet, and `launchMode()` answered `prelaunch`. The site it was scanning
 * had been built by `next build`, which DOES load `.env.local`, so that build
 * was made in `trading`.
 *
 * The audit then applied prelaunch rules to a trading site and reported six
 * present tense service claims as failures. Every sentence it named was
 * correct: trading is exactly the state in which the firm may use the present
 * tense. Measured, both directions, on 2026-09-24:
 *
 *     without .env.local   prelaunch   ["FIRM_PHONE is not set..."]
 *     with    .env.local   trading     []
 *
 * WHY IT WAS INVISIBLE FOR AS LONG AS IT WAS. While `approvedProtocols` was
 * empty, the sealing copy was future tense in BOTH modes, so the two worlds
 * agreed and nothing disagreed with anything. The register gaining its first
 * entry did not create this defect, it made it observable. That is the dormant
 * register pattern recorded in CLAUDE.md, one process further out.
 *
 * =============================================================================
 * THE RULE THIS FILE ENFORCES
 * =============================================================================
 *
 * A check that judges RENDERED COPY judges it by the mode the BUILD UNDER TEST
 * was made in. Not by its own process, and not by a default.
 *
 * **THE DEFECT WAS NOT THAT IT COULD NOT READ THE MODE. IT WAS THAT IT GUESSED
 * ONE.** `launchMode()` returns `prelaunch` for a process that simply lacks the
 * firm's configuration, which is indistinguishable from a deployment that is
 * genuinely prelaunch. A missing answer wearing a real answer's clothes is this
 * repository's recurring defect, and the fix is the one it always is: make the
 * unknown a THIRD value that says so.
 *
 * So this returns `mode: null` rather than a guess, and a caller that gets null
 * REFUSES TO JUDGE and says why. `unreachable is not failed`, applied to a
 * compliance ruleset rather than to a server.
 *
 * =============================================================================
 * WHY IT IS NOT DERIVED FROM THE SERVED SITE
 * =============================================================================
 *
 * The ruling says to derive it from the served build if the site exposes it.
 * It does not, and it should not be made to:
 *
 *   - `/api/portal/health` is unauthenticated and its own comment is emphatic
 *     about the one bit it reveals: "It never says which project it reached,
 *     how many rows are in anything, what the error was, WHAT VERSION IS
 *     DEPLOYED". Widening it for the convenience of an audit would trade a
 *     stated security contract for a testing shortcut.
 *
 *   - The rendered copy itself announces the mode, and reading it would be an
 *     audit importing its expectation from the thing it audits, which CLAUDE.md
 *     forbids outright. The copy is the subject; it cannot also be the ruler.
 *
 * So the mode is derived from the ENVIRONMENT THE BUILD LOADED, which is the
 * same file `next build` reads, and the source is printed every time.
 *
 * `BUILD_ENV_FILE` names that file and defaults to `.env.local`. It is a real
 * parameter rather than a test hook: a deployment built from a different env
 * file is a deployment whose mode comes from that file. It is also what makes
 * the refusal injectable without moving a credentials file around.
 */

import { existsSync } from "node:fs";

const DEFAULT_ENV_FILE = ".env.local";

/**
 * The mode the build under test was made in, or null with a reason.
 *
 * `base` decides whether the answer is knowable at all. A localhost target was
 * built here, from the env file named below, so the answer is derivable. A
 * REMOTE target was built by Vercel from environment variables this machine
 * cannot read, and the honest answer there is that we do not know.
 */
export async function modeUnderTest(base) {
  const envFile = process.env.BUILD_ENV_FILE ?? DEFAULT_ENV_FILE;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(base ?? "");

  if (!local) {
    return {
      mode: null,
      source: null,
      why:
        `${base} was not built on this machine, so the environment it was built from cannot be read here. ` +
        `A compliance ruleset chosen from this process would be a guess about somebody else's deployment.`,
    };
  }

  if (!existsSync(envFile)) {
    return {
      mode: null,
      source: null,
      why:
        `${envFile} is not on disk, so the environment the build loaded cannot be reproduced. ` +
        `Without it this process reads prelaunch for want of FIRM_PHONE, which is a missing answer that looks exactly like a real one.`,
    };
  }

  /*
   * Loaded into THIS process, deliberately, so every gate function called after
   * this point answers as the build's did. A helper that returned the mode and
   * left the process reading a different one would be two accounts of one fact.
   */
  process.loadEnvFile?.(envFile);

  const launch = await import("../../src/lib/launch.ts");
  return {
    mode: launch.launchMode(),
    source: `${envFile}, the same file next build loads`,
    why: null,
  };
}

/**
 * Print what was read, always, whichever way it went.
 *
 * CLAUDE.md's rule for a check that depends on ambient state: read the state
 * and say out loud which world you saw. A run whose verdict depends on a mode
 * nobody can see in the output is a run nobody can argue with afterwards.
 */
export function announceMode(result) {
  if (result.mode === null) {
    console.log(`MODE UNDER TEST: COULD NOT TELL. ${result.why}`);
    return;
  }
  console.log(`MODE UNDER TEST: ${result.mode}, read from ${result.source}.`);
}
