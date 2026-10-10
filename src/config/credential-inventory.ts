/**
 * EVERY ENVIRONMENT VALUE THIS PLATFORM READS, DECLARED. NEVER A VALUE.
 *
 * Moved here from scripts/lib/soc2-credentials.mjs in Phase 13, and the move is
 * the point rather than tidying.
 *
 * WHY IT LIVES IN src/config NOW
 * -------------------------------
 * Phase 13 made "is any identity secret shared with Preview" a condition of the
 * LAUNCH GATE, because self service sign up means anybody can mint a customer
 * session and a shared preview secret turns that into anybody minting a
 * production one. The gate is src/lib/launch.ts, which cannot import from
 * scripts/, and the alternative was a second copy of the sharing facts inside
 * src/ next to the first copy in scripts/.
 *
 * Two accounts of one fact are two accounts that will disagree, which this
 * repository has written down about the ledger, the compliance sentence and the
 * registration line. So there is one account, and it is here, where both the
 * application and the audits can read it.
 *
 * NO VALUE EVER APPEARS IN THIS FILE. It holds NAMES, what each grants, where
 * the real one is held, and what the operator read in the dashboard.
 * scripts/soc2-audit.mjs proves the absence by scanning for the SHAPES of
 * secrets rather than for their names, and it scans this file.
 *
 * It carries no `server-only`, deliberately. It holds no secret to protect and
 * the launch gate reaches it from a server component; adding the marker would
 * be the bundler constraint that has already broken one build here, bought for
 * nothing.
 */

export type Env = "set" | "absent" | "unknown";

export type CredentialEnvironments = {
  production: Env;
  preview: Env;
  development: Env;
  /**
   * For a secret that decides identity or opens a database: is the Preview
   * value DISTINCT from the Production one? null where the question does not
   * apply or nobody has read it.
   */
  previewValueDistinct: boolean | null;
  /** What is being done about it, when the answer is not yet settled. */
  pendingFix?: string;
  /**
   * WHEN SHARING A VALUE WITH PREVIEW IS A DECISION RATHER THAN A GAP.
   *
   * Operator ruling, 2026-09-13. The board used to assert that no identity or
   * database secret was shared, which made a deliberate decision look
   * identical to an oversight and left a red the operator had decided not to
   * act on.
   *
   * So a sharing is allowed to be RULED. An undeclared one still fails the
   * board, which is the property worth keeping: a future sharing nobody
   * decided is caught, and the board goes green on a true statement rather
   * than on a red somebody has stopped reading.
   *
   * The consequence is stated in full beside the ruling and in
   * docs/soc2-exceptions.md. It is not softened, because a risk accepted
   * without its consequence written down is a risk nobody accepted.
   */
  sharingRuling?: {
    /** Who decided. A ruling with no author is a preference. */
    by: string;
    /** ISO date. */
    on: string;
    /** What follows from it, stated rather than softened. */
    consequence: string;
  };
  /** When it was read and by whom. An answer with no provenance is a claim. */
  readOn: string;
};

export type Credential = {
  /** The variable, exactly as the code reads it. */
  name: string;
  kind: "secret" | "config" | "test-only";
  /** Where the real value is held. */
  livesIn: string;
  /** What somebody holding it could do. */
  grants: string;
  /** When it was last rotated. "Never." is an answer. */
  rotated: string;
  /**
   * What a holder could decide. "identity" mints or reads a session or a second
   * factor; "database" opens a database. Both are asserted never shared between
   * Preview and Production, because a preview URL is reachable by anybody with
   * the link.
   */
  decides?: "identity" | "database" | null;
  environments?: CredentialEnvironments;
};

/** Where the dashboard answers came from, so every entry says it once. */
const READ_ON = "2026-09-12, by the operator, from the Vercel dashboard. Nothing here can see it.";

/**
 * WHICH DEPLOYMENTS RUN THE SCHEDULED JOBS. A DOCUMENTED PLATFORM FACT.
 *
 * Operator ruling, 2026-09-30: "Vercel documents that cron jobs run on
 * production deployments only (vercel.com/docs/cron-jobs, and 'vercel crons
 * run' triggers only jobs deployed to production)."
 *
 * IT IS RECORDED AS A DIFFERENT KIND OF FACT FROM EVERYTHING ELSE IN THIS FILE,
 * AND THE DISTINCTION IS THE POINT. `READ_ON` above attributes values somebody
 * looked at in a dashboard on a date, and those go stale silently when somebody
 * changes a setting. This is not that. It is how the platform behaves, stated in
 * its own documentation, so it does not decay when a project's settings change
 * and it cannot be confirmed or refuted by opening this project's console.
 *
 * Collapsing the two would be the worse error in the safer-looking direction: a
 * platform fact filed as a console read invites a future session to "re-read"
 * it, find nothing to read, and record `unknown` for something that was never
 * a setting.
 *
 * WHY IT MATTERED. `vercel.json` schedules `/api/cron/jobs` every minute, and
 * that route is the only thing in `src/app/api` that drains the job queue.
 * `SUPABASE_URL` on Preview names the DEVELOPMENT project, recorded below from
 * a console read, so a Preview deployment reads the same database every audit
 * writes to. If crons ran on Preview, anything an audit queued would be
 * delivered by a deployment, which is the failure mode that blocked creating a
 * probe customer at all.
 *
 * They do not. The deployed drainer touches production's queue and never
 * development's.
 *
 * WHAT IT DOES NOT COVER, said plainly rather than left implied: somebody
 * running the drain route by hand against a Preview URL, or a second scheduler
 * outside Vercel. Neither is configuration this file can see, and neither is
 * what the ruling was about.
 */
export const CRON_RUNS_ON =
  "Production deployments only. Documented platform behavior per vercel.com/docs/cron-jobs, " +
  "recorded 2026-09-30 on the operator's ruling. NOT a console read: it is how Vercel works " +
  "rather than how this project is configured, so it does not go stale when a setting changes.";

export const CREDENTIALS: Credential[] = [
  // ---------------------------------------------------------------- secrets
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    kind: "secret",
    livesIn:
      "Vercel for production; .env.local for development, where it is the DEVELOPMENT project's key and every audit reads through it. Never in the working tree for production. Read 2026-09-12: SPLIT into two entries, one covering Production and Development and one covering Preview, with SUPABASE_URL split the same way. Whether the Preview URL names the development project ref is the one thing still unconfirmed, and it is the whole question, because a distinct Preview key pointing at production would be split in form and shared in effect.",
    grants:
      "Everything. It bypasses row level security on every table, and since there are zero policies it is the ONLY way in. Holding it is equivalent to holding the database.",
    decides: "database",
    environments: {
      production: "set",
      preview: "set",
      development: "set",
      /*
       * SPLIT, which is the correct pattern: two entries, one covering
       * Production and Development and one covering Preview, with SUPABASE_URL
       * split the same way. Whether the Preview URL names the DEVELOPMENT
       * project ref is the one thing still unconfirmed, and it is the whole
       * question: a Preview holding a distinct key that points at production
       * would be split in form and shared in effect.
       */
      previewValueDistinct: true,
      readOn:
        READ_ON +
        " SETTLED 2026-09-12: the Preview SUPABASE_URL reads https://ythzaiqeoijlrdibnieo.supabase.co, which is the DEVELOPMENT project, so the Preview key and the Preview URL point at the same non production database. Split in form and in effect, which is the distinction that mattered: a distinct Preview key pointing at production would have been split in form and shared in effect.",
    },
    rotated: "Never.",
  },
  {
    name: "MFA_ENCRYPTION_KEY",
    kind: "secret",
    livesIn: "Vercel. Not database state, which is why a database cutover does not move it.",
    grants:
      "Decryption of every stored TOTP secret. Holding it plus the database would let somebody generate valid second factor codes for any enrolled account.",
    rotated: "Never.",
    decides: "identity",
    /*
     * THE PRODUCTION VALUE IS NEVER CHANGED. encryptionKey() is
     * sha256("eng-mfa-v1:" + this), and every enrolment's ciphertext is under
     * the current one, so changing it makes every second factor undecryptable
     * and the failure presents exactly like a wrong code.
     *
     * The safety margin, confirmed in the code before the operator touched
     * anything: recovery codes do NOT depend on this key. They are scrypt
     * hashed against a salt of the user id, so they still work even if a TOTP
     * secret cannot be read.
     */
    environments: {
      production: "set",
      preview: "absent",
      development: "absent",
      previewValueDistinct: true,
      /*
       * =====================================================================
       * PREVIEW NO LONGER CARRIES IT. Corrected 2026-09-24.
       * =====================================================================
       *
       * The 2026-09-13 sharing ruling is superseded by the operator's own
       * action, and the ruling block is removed rather than left standing with
       * a correction under it: a `sharingRuling` on a variable that is no
       * longer shared would be the board reporting an accepted risk that no
       * longer exists, which is the same defect as a park nobody retires.
       *
       * The consequence it recorded is kept here as HISTORY, because a risk
       * that was real for eleven days is a thing somebody may need to reason
       * about later: from 2026-09-13 to 2026-09-24 a preview deployment could
       * decrypt production second factor secrets, since the key that decrypts
       * them was the same value and preview URLs are publicly reachable.
       *
       * What has NOT changed, and is the reason the production value is never
       * rotated casually: encryptionKey() is sha256 over this, every
       * enrolment's ciphertext is under the current one, and changing it makes
       * every second factor undecryptable in a way that presents exactly like
       * a wrong code. Recovery codes are scrypt hashed against the user id and
       * do not depend on it, which is the way back in.
       */
      readOn:
        READ_ON +
        " Re-read 2026-09-12: a single entry covering Production and Preview. RULED 2026-09-13: it stays that way." +
        " READ AGAIN 2026-09-24 by the operator, names and targets only, no values: a SINGLE entry targeting Production only. Preview and development carry none of it, which supersedes the 2026-09-13 ruling.",
    },
  },
  {
    name: "OPS_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid staff session cookie for any account, without a password and without a second factor.",
    rotated: "Never.",
    decides: "identity",
    /*
     * =========================================================================
     * "THE ONE THAT WAS ALREADY RIGHT" WAS NEVER RIGHT. Operator finding,
     * 2026-09-24, read from Vercel's own environment list.
     * =========================================================================
     *
     * THE SENTENCE THAT USED TO SIT HERE read: "THE ONE THAT WAS ALREADY
     * RIGHT, and the reason the finding was findable: the correct pattern
     * existed and had been applied to one principal of three." That claim is
     * false and has been false since it was written on 2026-09-12.
     *
     * The list shows ONE entry for this variable targeting BOTH Preview and
     * Production. It is not split. It is the same sharing the other three had,
     * on the principal with the most authority of the four.
     *
     * HOW IT SURVIVED TWELVE DAYS, AND IT IS WORTH MORE THAN THE FINDING. The
     * 2026-09-12 read found this variable ABSENT from the list, recorded
     * "unknown" honestly, and reasoned about what an absence would mean. Then
     * a SECOND sentence, in the same entry, asserted it was correctly split,
     * and that sentence was not a reading at all: it was the premise of the
     * argument being made about the other three. A record that says "unknown"
     * in its data and "already right" in its prose is two accounts of one fact,
     * and every later reader took the prose.
     *
     * CLAUDE.md repeated it. `docs/soc2-readiness.md` is written from this
     * file. The claim propagated exactly as the "Reyna Pay" sentence did on
     * 2026-09-11, and for the same reason: nobody re-derived it.
     *
     * WHAT A PREVIEW MINTED OPS SESSION DOES ON PRODUCTION, read from the code
     * rather than assumed:
     *
     *   The payload is `sub.role.factor.exp` and `factor` is minted "full", so
     *   a cookie signed with this secret is a FULLY authenticated staff
     *   session. It is produced without a password and without a second
     *   factor, because the cookie IS the proof that both were satisfied.
     *
     *   `currentActor()` then re-reads eng_profiles by `claims.sub` against
     *   THAT deployment's own database and takes the role and the grants from
     *   the row, not from the cookie. So the forger needs a `sub` that exists
     *   in PRODUCTION, and cannot invent a role. That bounds it and does not
     *   close it: minting for a real production profile id yields whatever
     *   that person holds, and for the operator's own id that is everything.
     *
     * THE SECOND HALF IS OPS_UNLOCK_TOKEN, shared the same way, which clears
     * the sign in rate limiter. Sharing both means the environment that can
     * forge a staff session can also remove the control that would slow down
     * guessing one the ordinary way.
     */
    /*
     * CLOSED THE SAME DAY IT WAS FOUND, 2026-09-24 at 10:20 Central, by the
     * operator: Preview removed, and a NEW production value set. Production
     * redeployed.
     *
     * ROTATED, WHICH IS THE HALF THAT MATTERS AND IS EASY TO SKIP. Removing
     * Preview stops a future preview from holding it; it does nothing about
     * the twelve days in which every preview did. Anything that read it in
     * that window still holds a key that would otherwise have gone on working.
     * Rotating is cheap here and that is why there was no reason not to:
     * nothing is encrypted under this value, so the whole cost is that every
     * staff session is signed out at once. MFA_ENCRYPTION_KEY is the opposite
     * and is why it is never rotated casually.
     */
    environments: {
      production: "set",
      preview: "absent",
      development: "set",
      previewValueDistinct: true,
      readOn:
        READ_ON +
        " Re-read 2026-09-12: ABSENT FROM THE LIST, recorded unknown." +
        " READ AGAIN 2026-09-24 by the operator, names and targets only, no values: ONE entry targeting Preview AND Production. It was shared, and this file's earlier claim that it was split was never a reading." +
        " CORRECTED 2026-09-24 at 10:20 Central by Robert Reyna: Preview removed and the production value ROTATED, production redeployed.",
    },
  },
  {
    name: "CUSTOMER_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid customer session for any customer account.",
    rotated: "Never.",
    decides: "identity",
    /*
     * THE SHARPEST OF THE THREE. It was All Environments, so a customer cookie
     * minted on ANY preview deployment was valid on production.
     */
    environments: {
      production: "set",
      /*
       * =====================================================================
       * UNTICKED FROM PREVIEW ON 2026-09-24. THE SHARING IS OVER, AND THE
       * CORROBORATION IS NOT. Operator ruling and operator action.
       * =====================================================================
       *
       * The operator changed his ruling of 2026-09-13 and removed Preview from
       * this variable in the Vercel dashboard. No new Preview value was
       * created: Preview now carries NOTHING, so a preview deployment cannot
       * mint a customer session at all, which is stronger than a distinct one.
       *
       * RECORDED AS THE OPERATOR'S ATTESTATION, NOT AS A VERIFIED FACT, and
       * the difference is the whole point of this file. Nothing in this
       * repository can read the Vercel dashboard. What a check CAN do is ask a
       * preview deployment whether it still mints, and
       * `scripts/preview-cannot-mint.mjs` was written to do exactly that.
       *
       * IT COULD NOT TELL, and the reason is recorded rather than smoothed
       * over. Run 2026-09-24 against the preview the operator supplied, built
       * from 24b778c: every dynamic route answers Vercel's own platform 404,
       * including /api/portal/health, while /account/login answers 200 from the
       * CDN. That deployment serves static pages and no functions, so there is
       * nothing on it to ask, and its 404s are NOT evidence the secret is gone.
       *
       * AND THE CUSTOMER DOOR CANNOT ANSWER THIS QUESTION EVEN ON A HEALTHY
       * DEPLOYMENT, which is a finding in its own right. At 24b778c
       * `api/account/session` calls `signInCustomer` BEFORE
       * `issueCustomerSession`, so a deployment with no secret and one with a
       * working secret answer a bogus login identically with 401. The 503
       * "Accounts are not available on this deployment." is reachable only with
       * a valid customer password. A configuration state observable only by
       * signing somebody in is one nobody can verify after changing it. The
       * partner door has the checks the other way round and IS observable.
       */
      preview: "absent",
      development: "set",
      /*
       * Vacuously true and said plainly: there is no Preview value to be
       * distinct from Production, which is why this is not `true` with a
       * comfortable sentence beside it.
       */
      previewValueDistinct: true,
      pendingFix:
        "Corroborate the untick against a preview that actually serves functions, or have the operator read the Preview variable list for this project. The 2026-09-24 run could not tell.",
      readOn:
        READ_ON +
        " Re-read 2026-09-12: a single entry covering Production and Preview. RULED 2026-09-13: it stays that way." +
        " UNTICKED FROM PREVIEW 2026-09-24 by Robert Reyna, superseding that ruling. The after-check ran the same day and COULD NOT TELL, because the preview supplied serves no functions.",
    },
  },
  {
    name: "PARTNER_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid partner session for any partner account.",
    rotated: "Never.",
    decides: "identity",
    environments: {
      production: "set",
      /*
       * UNTICKED FROM PREVIEW ON 2026-09-24, alongside
       * CUSTOMER_SESSION_SECRET, superseding the ruling of 2026-09-13. Preview
       * carries nothing, so a preview cannot mint a partner session at all.
       *
       * THE SAME ATTESTATION AND THE SAME UNFINISHED CORROBORATION as the
       * customer secret above, and the reasoning is not repeated here because
       * one decision with two accounts is two accounts that will disagree.
       *
       * WHAT IS DIFFERENT, AND IT IS WORTH KNOWING: this door IS observable.
       * At 24b778c `api/partner/session` calls `partnerSessionConfigured()`
       * BEFORE `signInPartner`, so a bogus credential is refused by the
       * configuration check and the answer distinguishes "no secret" from
       * "secret present" with no valid credential and no write. The customer
       * door has those the other way round and cannot. So when a preview that
       * serves functions is available, THIS is the door that settles it, and
       * `scripts/preview-cannot-mint.mjs` asks it.
       */
      preview: "absent",
      development: "set",
      previewValueDistinct: true,
      pendingFix:
        "Corroborate against a preview that serves functions. The partner door can answer this without a credential; the customer door cannot.",
      readOn:
        READ_ON +
        " Re-read 2026-09-12: a single entry covering Production and Preview. RULED 2026-09-13: it stays that way." +
        " UNTICKED FROM PREVIEW 2026-09-24 by Robert Reyna, superseding that ruling. The after-check ran the same day and COULD NOT TELL, because the preview supplied serves no functions.",
    },
  },
  /*
   * =========================================================================
   * PREVIEW HELD LIVE REYNA PAY KEYS, AND THEY WERE REMOVED 2026-09-21.
   * Operator statement, recorded the same evening.
   * =========================================================================
   *
   * WHAT IT WAS. Vercel's Preview environment carried LIVE Stripe keys for
   * REYNA PAY, which is a different legal entity from this firm. The operator
   * found it and removed them; Preview now holds no Stripe key at all.
   *
   * THIS IS ABOUT PREVIEW AND ONLY PREVIEW. Corrected 2026-09-22. An earlier
   * version of the entry below said PRODUCTION's key belongs to Reyna Pay,
   * repeating a sentence written on 2026-09-11 that nothing re-checked. It is
   * wrong: Production's account is acct_1UFmIjA2kbTZN5C3, which is this firm's
   * and which the operator has renamed to the registrant. See
   * src/config/launch-readiness.ts for the evidence and how one unverified
   * sentence reached six records.
   *
   * WHY THIS IS WORSE THAN THE 2026-09-12 FINDING RATHER THAN ANOTHER OF THEM.
   * That one was one firm's secret shared across environments: a customer
   * cookie minted on a preview was valid on production. Bad, and bounded by the
   * firm's own blast radius. This is a LIVE key for ANOTHER COMPANY on an
   * environment whose URLs are reachable by anyone holding the link. A charge
   * taken ON A PREVIEW would have moved real money into Reyna Pay for
   * engineering work this firm is not yet permitted to perform.
   * Cross environment is a blast radius question; cross entity is a
   * whose-money question.
   *
   * FOURTH CONSOLE FINDING, AND ALL FOUR CAME FROM THE OPERATOR OPENING A
   * DASHBOARD. Vercel twice on 2026-09-12, Stripe on 2026-09-16, Vercel again
   * on 2026-09-21. No check in this repository can see any of them, which is
   * why this file exists as a dated, attributed declaration rather than as a
   * check.
   *
   * AND THE REMOVAL IS RECORDED AS A CLAIM, NOT AS A VERIFIED FACT. Standing
   * law after `production-cutover-plan.md` said a project had been deleted and
   * it was alive eleven days later: a document recording a destructive action
   * as done is a claim nothing supports unless something checked. Nothing here
   * checked. This says the operator removed them, on that date, and says
   * plainly that no check in this repository can confirm it. The verification
   * that would settle it is a preview deployment refusing to construct a Stripe
   * client, which is not built.
   *
   * THE LIVE CHARGE AND REFUND TEST STAYS ON PRODUCTION, as the first act after
   * the gate opens. Operator ruling, 2026-09-21. It is not run on a preview and
   * it is not run against Reyna Pay; launch condition `stripe` requires a real
   * charge and its refund on this firm's own account, recorded.
   */
  {
    name: "STRIPE_SECRET_KEY",
    kind: "secret",
    livesIn:
      "Vercel, PRODUCTION ONLY since 2026-09-21. The production account is acct_1UFmIjA2kbTZN5C3, " +
      "which IS this firm's: the operator read Production's publishable key on 2026-09-22 and it " +
      "begins pk_live_51UFmIjA2kbTZN5C3, embedding that account id. He states he has renamed the " +
      "account to the registrant; that NAME is recorded and deliberately still UNVERIFIED in " +
      "src/config/stripe-console.ts, so it is not asserted here. " +
      "CORRECTED 2026-09-22: this field said the production account belongs to Reyna Pay, repeating a " +
      "sentence written 2026-09-11 that nothing re-checked for eleven days. " +
      "PREVIEW CARRIED LIVE REYNA PAY KEYS AND THE OPERATOR REMOVED THEM on 2026-09-21; Preview now " +
      "holds no Stripe key. That is a separate and real finding. Recorded as his statement: nothing " +
      "in this repository can read Vercel, so nothing here has confirmed the removal.",
    grants:
      "Charging and refunding against that Stripe account, and reading every charge on it. While " +
      "Preview held Reyna Pay's live keys that meant charging a DIFFERENT COMPANY from a URL anybody " +
      "with the link can reach.",
    rotated: "Never. Reyna Pay's keys removed from Preview 2026-09-21, which is not a rotation.",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    kind: "secret",
    livesIn:
      "Vercel, production only since 2026-09-21, alongside STRIPE_SECRET_KEY. Preview holds no Stripe " +
      "credential of either kind.",
    grants: "Forging a payment webhook this platform would believe, which is how an order gets marked paid without money moving.",
    rotated: "Never.",
  },
  /*
   * OUT OF .env.local BY OPERATOR RULING, 2026-09-12.
   *
   * Nothing local needs it, and its presence is what turned two bugs into
   * fifty five real sends in one day. Migration 0038's header records both: a
   * retention dry run claimed the oldest jobs of any kind and sent twenty real
   * emails, and the first version of queue-audit sent thirty five, to the
   * operator's own address and the firm's.
   *
   * effect_mode was the answer for the JOBS. This is the answer for the
   * MACHINE: notify.ts returns null when the key is absent and logs "skipped,
   * RESEND_API_KEY is not set", so with no key a mistake writes a row instead
   * of reaching somebody's inbox. THAT REFUSAL IS CORRECT DEVELOPMENT
   * BEHAVIOUR AND IS NOT A DEFECT TO WORK AROUND.
   *
   * A session that genuinely needs to send sets ALLOW_REAL_EMAIL_SENDS for that
   * session and supplies the key by hand. Neither is ever committed, and
   * soc2-audit asserts the key is absent from every env file unless that
   * variable is set.
   */
  {
    name: "RESEND_API_KEY",
    kind: "secret",
    livesIn:
      "Vercel for production. REMOVED from .env.local 2026-09-12: nothing local needs it and its presence made two bugs send 55 real emails. Read 2026-09-12: it was All Environments, INCLUDING PREVIEW, which meant a preview deployment could send real mail as the firm. Scoped to Production only by the operator the same day.",
    grants: "Sending mail as this firm's domain, and reading the delivery log.",
    rotated: "Never.",
    /*
     * NOT an identity or database secret, so it is not covered by the never
     * shared rule. It is here because it was All Environments, which meant a
     * PREVIEW DEPLOYMENT COULD SEND REAL MAIL as the firm, and preview URLs are
     * reachable by anybody holding the link.
     *
     * Being scoped to Production only by the operator. Preview holds nothing,
     * which is the fix rather than a gap: notify.ts returns null and logs
     * "skipped" without a key.
     */
    environments: {
      production: "set",
      preview: "absent",
      development: "absent",
      previewValueDistinct: null,
      readOn:
        READ_ON +
        " SETTLED 2026-09-12: was All Environments including Preview, which meant a preview deployment could send real mail as the firm. Now Production only. Preview holds nothing, which is the fix rather than a gap: notify.ts returns null and logs skipped without a key.",
    },
  },
  {
    name: "CRON_SECRET",
    kind: "secret",
    livesIn: "Vercel.",
    grants: "Triggering any scheduled job on demand, including the retention sweep.",
    rotated: "Never.",
  },
  {
    name: "OPS_UNLOCK_TOKEN",
    kind: "secret",
    livesIn:
      "Vercel. REMOVED from .env.local 2026-09-12 by the same ruling as the mail key: it serves one route handler that nothing local calls, so it was a credential sitting in a development environment for no current purpose.",
    grants: "Clearing a lockout on a staff account.",
    rotated: "Never.",
    /*
     * IT HAD NO ENVIRONMENT MAP AT ALL UNTIL 2026-09-24, WHICH IS WHY NOTHING
     * EVER ASKED WHETHER IT WAS SHARED.
     *
     * `decides` was unset and `environments` was absent, so soc2-audit's rule
     * that no identity or database secret may be shared did not reach it: the
     * rule is asserted over secrets that declare one of those two words, and a
     * secret that declares neither is outside every question the board asks.
     *
     * That is the declared inventory failing in the way this repository keeps
     * finding: not a wrong answer, a question nobody was made to answer.
     *
     * It is NOT tagged `identity`, deliberately and with the reason written
     * down, because it does not mint or read a session: the route's own header
     * is emphatic that it clears a counter and "does not sign anybody in, does
     * not touch a password, does not read a profile". Tagging it identity to
     * force the board to look would make the board's own vocabulary wrong,
     * which is the nearest-lie defect. The environment map below is what makes
     * it visible instead.
     */
    environments: {
      production: "set",
      preview: "absent",
      development: "absent",
      previewValueDistinct: true,
      readOn:
        "2026-09-24, by the operator, from Vercel's environment list, names and targets only, no values read. ONE entry targeting Preview AND Production." +
        " CORRECTED the same day at 10:20 Central by Robert Reyna: Preview removed and the production value ROTATED, production redeployed. Removed from .env.local 2026-09-12, which is why development is absent.",
    },
  },
  {
    name: "ORDER_INTAKE_KEYS",
    kind: "secret",
    livesIn: "Vercel. The keys the two sister sites present to the intake API.",
    grants: "Submitting leads and orders into this platform as a sister site.",
    rotated: "Never.",
  },
  /*
   * THESE TWO WERE INVISIBLE TO THE FIRST SCAN AND ARE REAL SECRETS.
   *
   * src/lib/sister-intake.ts names them as STRINGS in SISTER_KEY_ENV and reads
   * them through that map, so neither `process.env.X` nor `env.X` appears
   * anywhere for them. The original scanner saw nothing and the inventory was
   * silently short by two credentials, each of which lets a caller write into
   * this firm's database.
   *
   * They are declared per site deliberately, which is the reasoning already in
   * that file: one key per sister means a compromised key names its own site
   * rather than belonging to nobody.
   */
  {
    name: "INTAKE_KEY_SEALED",
    kind: "secret",
    livesIn: "Vercel. Held by the sealedengineering deployment, which presents it to this platform's intake API.",
    grants: "Submitting leads and orders into this firm's database as Sealed Engineering.",
    rotated: "2026-09-12 on development. NEVER on production.",
  },
  {
    name: "INTAKE_KEY_STAMP",
    kind: "secret",
    livesIn: "Vercel. Held by the stampmyplans deployment.",
    grants: "Submitting leads and orders into this firm's database as Stamp My Plans.",
    rotated: "2026-09-12 on development. NEVER on production.",
  },
  /*
   * FOUND BY THE STRING LOOKUP SCAN ON 2026-09-12, the check the operator
   * ruled for after the two intake keys hid. scripts/copy-project.mjs reads
   * all four through a required() helper that takes the NAME as a string, so
   * the two property scans were blind to them.
   *
   * TWO OF THEM ARE SERVICE ROLE KEYS. This is the cutover copy script, the one
   * script that deliberately holds two projects at once, so between them these
   * grant everything on a source database and everything on a destination.
   */
  {
    name: "COPY_FROM_KEY",
    kind: "secret",
    livesIn:
      "NOT SET IN ANY ENVIRONMENT, and it must not be until the day the cutover runs. Supplied by hand for one command and never stored. Operator ruling 2026-09-12: a full access key sitting in an environment for a script nobody is running is the largest single credential exposure this firm could have, and it would exist for no current purpose. Confirmed absent from every env file on this machine, and the operator read Vercel on 2026-09-12: NOT PRESENT IN ANY ENVIRONMENT there either. Settled.",
    grants: "Everything on the SOURCE project of a copy, including production if that is what it names.",
    rotated: "Never.",
  },
  {
    name: "COPY_TO_KEY",
    kind: "secret",
    livesIn:
      "NOT SET IN ANY ENVIRONMENT, and it must not be until the day the cutover runs. Supplied by hand for one command. Same ruling as COPY_FROM_KEY. Confirmed absent from every env file on this machine, and the operator read Vercel on 2026-09-12: NOT PRESENT IN ANY ENVIRONMENT there either. Settled.",
    grants: "Everything on the DESTINATION project of a copy, including the ability to overwrite it.",
    rotated: "Never.",
  },
  { name: "COPY_FROM_URL", kind: "config", livesIn: "Typed by hand for one command.", grants: "Names the source project of a copy. pairClient applies the same production check to it as everything else.", rotated: "Never." },
  { name: "COPY_TO_URL", kind: "config", livesIn: "Typed by hand for one command.", grants: "Names the destination project of a copy.", rotated: "Never." },
  /*
   * The address family, read through src/config/contact.ts's env() helper,
   * which also takes the name as a string. Not secret, and publishing any of
   * them is a commitment: an address here is an address published permanently.
   */
  { name: "FIRM_STREET", kind: "config", livesIn: "Not set.", grants: "Publishes the street address of the firm's place of business.", rotated: "Never." },
  { name: "FIRM_STREET_2", kind: "config", livesIn: "Not set.", grants: "The second address line.", rotated: "Never." },
  { name: "FIRM_CITY", kind: "config", livesIn: "Not set.", grants: "Publishes the city.", rotated: "Never." },
  { name: "FIRM_POSTAL_CODE", kind: "config", livesIn: "Not set.", grants: "Publishes the postal code.", rotated: "Never." },
  { name: "FIRM_LATITUDE", kind: "config", livesIn: "Not set.", grants: "The geo point for LocalBusiness markup. Omitted rather than approximated: a map pin is trusted absolutely.", rotated: "Never." },
  { name: "FIRM_LONGITUDE", kind: "config", livesIn: "Not set.", grants: "The other half of the geo point.", rotated: "Never." },
  { name: "FIRM_HOURS", kind: "config", livesIn: "Not set.", grants: "Publishes opening hours, which is a commitment to answer during them.", rotated: "Never." },
  {
    name: "SENTRY_DSN",
    kind: "secret",
    livesIn: "Not set. The fault store is this platform's own table.",
    grants: "Writing fault reports into a Sentry project. Listed because the code reads it, not because it is in use.",
    rotated: "Never.",
  },
  {
    name: "NEXT_PUBLIC_SENTRY_DSN",
    kind: "config",
    livesIn: "Not set. Public by construction if it ever is.",
    grants: "Nothing secret. A DSN is write only and is inlined into the browser bundle.",
    rotated: "Never.",
  },

  // ----------------------------------------------------------------- config
  { name: "SUPABASE_URL", kind: "config", livesIn: "Vercel and .env.local.", grants: "Names which database. Not a secret, and the single most important value to get right: db-guard exists because of it.", rotated: "Never." },
  { name: "LAUNCH_MODE", kind: "config", livesIn: "Vercel.", grants: "One of seven launch gate conditions. Alone it opens nothing.", rotated: "Never." },
  { name: "TBPELS_FIRM_NUMBER", kind: "config", livesIn: "Nothing in src/ reads it any more. The registration moved into src/config/credentials.ts on 2026-09-10.", grants: "Nothing. Retained only where audits clear it.", rotated: "Never." },
  { name: "FIRM_PHONE", kind: "config", livesIn: "Vercel, ALL environments, set 2026-09-14. NOT A SECRET: a published telephone number is a value the firm wants read, and it is in this inventory because every name set in an environment must be declared, not because it needs protecting.", grants: "Publishes the firm telephone number. Clears one of the launch gate conditions. Stored in E.164 as +12819404490; every display form is DERIVED from it by src/config/contact.ts and nothing may read the raw value outside that file and launch.ts, which seo-audit asserts.", rotated: "Never. It changes when the number changes." },
  { name: "MAIL_FROM_ADDRESS_LINE", kind: "config", livesIn: "RETIRED 2026-09-18. Nothing in src/ reads it any more. It held the firm's postal address as a sentence while src/config/contact.ts held the same address as fields for the schema node, which is one fact with two homes. Both were empty, so they could not disagree, and the day the operator supplied the address is the day exactly one of them would have been filled in. The address is now declared once in contact.ts and mailingAddressLine() derives from it. Remove it from Vercel.", grants: "Nothing.", rotated: "Never." },
  { name: "NEXT_PUBLIC_SITE_URL", kind: "config", livesIn: "Vercel.", grants: "Nothing. The canonical host.", rotated: "Never." },
  { name: "ALLOW_PRODUCTION_DB", kind: "config", livesIn: "Never set in any deployment. Typed by hand for one command.", grants: "Permission for a script to talk to production. Compared exactly against the string 1, so 0, false and true are all refusals.", rotated: "Never." },
  { name: "ALLOW_PRODUCTION_PREVIEW", kind: "config", livesIn: "Never set.", grants: "Permission for a preview deployment to point at production. Almost never the right answer.", rotated: "Never." },
  { name: "MFA_BREAK_GLASS", kind: "config", livesIn: "Never set in a deployment.", grants: "Bypassing the second factor requirement. The most dangerous config value here, which is why it is named rather than left to be discovered.", rotated: "Never." },
  { name: "ORDER_PAYMENTS_FAKE", kind: "config", livesIn: "Development only.", grants: "Taking an order without calling Stripe.", rotated: "Never." },
  /* The order flow capture's three ways to reproduce an upload failure on purpose, added 2026-10-07 (ruling 3). */
  { name: "WALK_DELAY_PUT_MS", kind: "config", livesIn: "Typed by hand for one capture run.", grants: "Holds every storage upload in the capture's browser for that many milliseconds.", rotated: "Never." },
  { name: "WALK_PRESS_DURING_UPLOAD", kind: "config", livesIn: "Typed by hand for one capture run.", grants: "Presses Continue while an upload is in flight and prints what the form says.", rotated: "Never." },
  { name: "WALK_ABORT_PUT", kind: "config", livesIn: "Typed by hand for one capture run.", grants: "Drops the capture browser's storage uploads, to read the form's failure message.", rotated: "Never." },
  { name: "V10_ONLY", kind: "config", livesIn: "Typed by hand when running v10-layout-audit on one route.", grants: "Measures one route against V10's layout rules, ignoring the dated list.", rotated: "Never." },
  { name: "V10_REPORT", kind: "config", livesIn: "Typed by hand when deriving v10-layout-audit's list.", grants: "Measures every route and prints which fail, as a report that never passes or fails a board.", rotated: "Never." },
  /*
   * THE OPT IN FOR DELIBERATELY SENDING, AND IT IS NAMED FOR WHAT IT DOES.
   *
   * Operator ruling, 2026-09-12. RESEND_API_KEY is absent from .env.local, and
   * the board asserts it stays absent UNLESS this is set for a session where
   * somebody is deliberately sending. Neither is ever committed.
   *
   * Named the way ALLOW_PRODUCTION_DB is, for the same reason: somebody reading
   * a shell history sees what they turned on. A variable called DEBUG or MAIL
   * would not have told them.
   */
  {
    name: "ALLOW_REAL_EMAIL_SENDS",
    kind: "config",
    livesIn: "Never set, and never committed. Typed for one session by somebody who means to send.",
    grants:
      "Permission for this machine to hold a live mail key at all. It does not itself send anything; it is what the board checks before it will tolerate RESEND_API_KEY being present in an env file.",
    rotated: "Never.",
  },
  /*
   * The other two escape hatches in src/lib/db-guard.ts, found by the same
   * widened scan. They are config rather than secrets, and they are the most
   * dangerous config in the repository, so they are named here rather than left
   * for somebody to meet in a stack trace.
   */
  {
    name: "ALLOW_PRODUCTION_ON_OTHER_DB",
    kind: "config",
    livesIn: "Never set in any deployment.",
    grants: "Permission for a production deployment to point at a database that is not the production project. Compared exactly against the string 1.",
    rotated: "Never.",
  },
  {
    name: "ALLOW_LIVE_KEY_OFF_PRODUCTION",
    kind: "config",
    livesIn: "Never set in any deployment.",
    grants: "Permission for a non production deployment to hold a live payment key, which is how a test order charges a real card.",
    rotated: "Never.",
  },
];
