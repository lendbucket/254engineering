/**
 * EVERY ENVIRONMENT VALUE THIS PLATFORM READS, DECLARED. NEVER A VALUE.
 *
 * Phase 12 Section 6. An auditor asks two things about secrets: what are they,
 * and who can use them. This answers the first honestly and the second as far as
 * a single operator firm can, which is not very far and is stated rather than
 * dressed up.
 *
 * THE RULE THAT MAKES THIS WORTH KEEPING
 * --------------------------------------
 * `scripts/soc2-audit.mjs` scans `src/` and `scripts/` for every environment
 * value the platform actually reads and fails when one is not declared here. So
 * this cannot quietly fall behind the code: adding a secret means declaring it,
 * which means deciding what it grants and where it lives, which is the decision
 * that should be hard to skip.
 *
 * IT SCANS TWO SHAPES, AND THE SECOND ONE IS WHY THIS PARAGRAPH EXISTS. The
 * first version looked only for a direct environment read and missed
 * `src/lib/db-guard.ts`, which takes an env object as a parameter so its guard
 * can be tested against a preview, a production and a local environment without
 * setting real variables. The most carefully written module in the repository
 * was the one the scanner could not see.
 *
 * AND THE FOURTH SHAPE IS THE ONE NO SCAN COULD EVER HAVE FOUND: A SECRET
 * NOTHING READS.
 *
 * Operator ruling, 2026-09-12. ADMIN_PASSPHRASE sat in .env.local holding a
 * short human passphrase for a surface retired months ago. Every scan here
 * asks what the CODE READS, so a credential nobody reads is invisible to all of
 * them, and it can sit in an environment forever.
 *
 * So the scan runs in reverse as well: every name SET in an environment file
 * must be declared here or listed in RETIRED below. A dead credential is named
 * rather than invisible.
 *
 * A THIRD SHAPE IS STILL INVISIBLE AND IS HANDLED BY NAME. Two of the secrets
 * below are named as STRINGS in a lookup table rather than read as properties,
 * and no pattern could find them without matching every string in the
 * repository. They were found by widening the scan, noticing the count move,
 * and reading what appeared. A scanner cannot be the only thing looking.
 *
 * NO VALUE EVER APPEARS IN THIS FILE, and the same audit proves it by scanning
 * for the SHAPES of secrets rather than for their names. A variable called
 * SUPABASE_SERVICE_ROLE_KEY is fine here; the token it holds is not.
 *
 * `rotated` SAYS "Never." FOR ALL BUT TWO, AND THAT IS THE FINDING.
 *
 * Operator ruling, 2026-09-12: state when each key was last rotated, and if the
 * answer is never, say never. It used to say null, which reads as unknown and
 * is softer than the truth.
 *
 * Nothing in this platform RECORDS a rotation, so these are the operator's
 * statement rather than a platform fact, and that distinction is why the column
 * is prose rather than a date type. The two intake keys were rotated on
 * development on 2026-09-12 and say so, including that production has not been.
 */

/**
 * @typedef {object} Credential
 * @property {string} name          The variable, exactly as the code reads it.
 * @property {"secret"|"config"|"test-only"} kind
 * @property {string} livesIn       Where the real value is held.
 * @property {string} grants        What somebody holding it could do.
 * @property {string} rotated      When it was last rotated. "Never." is an answer.
 * @property {"identity"|"database"|null} [decides]
 *   What a holder of this could decide. "identity" mints or reads a session or a
 *   second factor; "database" opens a database. Both are asserted never shared
 *   between Preview and Production, because a preview URL is reachable by
 *   anybody with the link.
 * @property {{production: Env, preview: Env, development: Env, previewValueDistinct: boolean|null, readOn: string}} [environments]
 *   Where it is actually set, as the operator read it from the dashboard.
 *   Nothing here can see Vercel, so this is their answer and the board asserts
 *   what the answer SAYS, which makes a future sharing a deliberate edit.
 *
 * @typedef {"set"|"absent"|"unknown"} Env
 */

/**
 * CREDENTIALS THAT ONCE EXISTED AND MUST NOT COME BACK.
 *
 * The answer to the fourth shape. A name in an environment file that matches
 * nothing in CREDENTIALS is a finding unless it is here, and a name here is a
 * thing somebody deliberately retired rather than a thing nobody noticed.
 */
export const RETIRED = [
  /*
   * FOUND BY THE REVERSE SCAN ON ITS FIRST RUN, which is the check existing for
   * the reason it was written. Both were set in .env.local and read by no code
   * anywhere, so every forward scan was blind to them exactly as it was to
   * ADMIN_PASSPHRASE.
   */
  {
    name: "LEAD_FROM_EMAIL",
    retired: "2026-09-12",
    why:
      "An address the lead notification was once sent FROM. Nothing reads it: the email identity moved into src/config/email-identity.ts, which is a declaration rather than an environment variable, so that one place decides who the firm writes as. Left behind in .env.local by the move and found by the reverse scan.",
  },
  {
    name: "LEAD_TO_EMAIL",
    retired: "2026-09-12",
    why:
      "An address lead notifications were once sent TO. Nothing reads it: business.notificationEmail in src/config/business.ts is where that now lives. Same move, same leftover, same scan.",
  },
  {
    name: "ADMIN_PASSPHRASE",
    retired: "2026-09-12",
    why:
      "The shared passphrase for the /admin surface, which was deleted and replaced by the portal's role based access. BACKLOG.md recorded that nothing reads it and that it could come out of Vercel; nothing acted on that, and it went on sitting in .env.local holding a short human passphrase. Removed from .env.local and from all three Vercel environments on 2026-09-12 and treated as exposed, because a passphrase of that shape is one somebody reuses.",
  },
];

/** Where the dashboard answers came from, so every entry says it once. */
const READ_ON = "2026-09-12, by the operator, from the Vercel dashboard. Nothing here can see it.";

/** @type {Credential[]} */
export const CREDENTIALS = [
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
      preview: "set",
      development: "set",
      /*
       * NOT YET SPLIT. The dashboard shows ONE entry covering Production and
       * Preview, which is the same sharing wearing a new row. The operator is
       * splitting each into two entries with different values, Production
       * untouched.
       *
       * RECORDED AS SHARED RATHER THAN AS FIXED, and the board is RED on it
       * until it is confirmed. An earlier version of this file said distinct,
       * because it recorded the intent to split rather than the split, and a
       * declaration that asserts a fix which has not happened is the exact
       * thing this pack exists to prevent.
       */
      previewValueDistinct: false,
      pendingFix: "Being split, Production value NEVER changed: encryptionKey is sha256 over it, so changing it makes every enrolment undecryptable and the failure looks exactly like a wrong code. Recovery codes are scrypt hashed against the user id and do not depend on it, which is the way back in.",
      readOn: READ_ON + " Re-read 2026-09-12: still a single entry covering Production and Preview.",
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
     * THE ONE THAT WAS ALREADY RIGHT, and the reason the finding was findable:
     * the correct pattern existed and had been applied to one principal of
     * three.
     */
    environments: {
      /*
       * NO LONGER IN THE DASHBOARD LIST, read 2026-09-12, and the operator is
       * confirming whether it was deleted.
       *
       * IF IT WAS, THE SYMPTOM IS AN OUTAGE RATHER THAN A WEAKNESS, which was
       * checked in the code before saying so: signingKey() returns null below
       * 24 characters or when absent, with no fallback and no default, so no
       * session can be forged because none can be signed. opsSessionStatus()
       * says "Nobody can sign into the portal until it is" and the sign in
       * screen shows it. Announcements stop too: ops-announce refuses to send
       * rather than send an unsigned unsubscribe link.
       *
       * It was the ONE identity secret already split correctly, which is what
       * made the other three legible as a defect rather than as a
       * configuration.
       */
      production: "unknown",
      preview: "unknown",
      development: "set",
      previewValueDistinct: null,
      pendingFix:
        "Confirming whether it was deleted; restoring it as two split entries before the next deploy, because staff sign in reads it.",
      readOn: READ_ON + " Re-read 2026-09-12: ABSENT FROM THE LIST.",
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
      preview: "set",
      development: "set",
      /*
       * NOT YET SPLIT. The dashboard shows ONE entry covering Production and
       * Preview, which is the same sharing wearing a new row. The operator is
       * splitting each into two entries with different values, Production
       * untouched.
       *
       * RECORDED AS SHARED RATHER THAN AS FIXED, and the board is RED on it
       * until it is confirmed. An earlier version of this file said distinct,
       * because it recorded the intent to split rather than the split, and a
       * declaration that asserts a fix which has not happened is the exact
       * thing this pack exists to prevent.
       */
      previewValueDistinct: false,
      pendingFix: "Being split into two entries with different values, Production untouched. Until then a customer cookie minted on any preview deployment is valid on production.",
      readOn: READ_ON + " Re-read 2026-09-12: still a single entry covering Production and Preview.",
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
      preview: "set",
      development: "set",
      /*
       * NOT YET SPLIT. The dashboard shows ONE entry covering Production and
       * Preview, which is the same sharing wearing a new row. The operator is
       * splitting each into two entries with different values, Production
       * untouched.
       *
       * RECORDED AS SHARED RATHER THAN AS FIXED, and the board is RED on it
       * until it is confirmed. An earlier version of this file said distinct,
       * because it recorded the intent to split rather than the split, and a
       * declaration that asserts a fix which has not happened is the exact
       * thing this pack exists to prevent.
       */
      previewValueDistinct: false,
      pendingFix: "Being split into two entries with different values, Production untouched. Until then a partner cookie minted on any preview deployment is valid on production.",
      readOn: READ_ON + " Re-read 2026-09-12: still a single entry covering Production and Preview.",
    },
  },
  {
    name: "STRIPE_SECRET_KEY",
    kind: "secret",
    livesIn: "Vercel. The account it belongs to is Reyna Pay, not this firm, which is launch condition `stripe`.",
    grants: "Charging and refunding against that Stripe account, and reading every charge on it.",
    rotated: "Never.",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    kind: "secret",
    livesIn: "Vercel.",
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
    grants: "Submitting leads and orders into this firm's database as StampMyPlans.",
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
  { name: "TBPELS_PE_LICENSE", kind: "config", livesIn: "Not set. No PE is in responsible charge.", grants: "Asserts an engineer of record exists. Gated on the licence number being supplied so the gate cannot be opened by optimism.", rotated: "Never." },
  { name: "TBPELS_FIRM_NUMBER", kind: "config", livesIn: "Nothing in src/ reads it any more. The registration moved into src/config/credentials.ts on 2026-09-10.", grants: "Nothing. Retained only where audits clear it.", rotated: "Never." },
  { name: "FIRM_PHONE", kind: "config", livesIn: "Not set. A launch gate condition.", grants: "Publishes a telephone number.", rotated: "Never." },
  { name: "MAIL_FROM_ADDRESS_LINE", kind: "config", livesIn: "Vercel.", grants: "The postal address in an email footer.", rotated: "Never." },
  { name: "NEXT_PUBLIC_SITE_URL", kind: "config", livesIn: "Vercel.", grants: "Nothing. The canonical host.", rotated: "Never." },
  { name: "ALLOW_PRODUCTION_DB", kind: "config", livesIn: "Never set in any deployment. Typed by hand for one command.", grants: "Permission for a script to talk to production. Compared exactly against the string 1, so 0, false and true are all refusals.", rotated: "Never." },
  { name: "ALLOW_PRODUCTION_PREVIEW", kind: "config", livesIn: "Never set.", grants: "Permission for a preview deployment to point at production. Almost never the right answer.", rotated: "Never." },
  { name: "MFA_BREAK_GLASS", kind: "config", livesIn: "Never set in a deployment.", grants: "Bypassing the second factor requirement. The most dangerous config value here, which is why it is named rather than left to be discovered.", rotated: "Never." },
  { name: "ORDER_PAYMENTS_FAKE", kind: "config", livesIn: "Development only.", grants: "Taking an order without calling Stripe.", rotated: "Never." },
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

/**
 * Variables that are not credentials at all, so the audit does not demand a
 * declaration for them.
 *
 * Named rather than pattern matched, because a pattern that excused anything
 * ending in _PORT would excuse a variable somebody named badly.
 */
export const NOT_CREDENTIALS = new Set([
  /* Test and audit plumbing. */
  "AUDIT_KILL_STALE", "AUDIT_LOG_DIR", "AUDIT_PORT", "BASE_URL", "CONTRAST_PORT",
  "LAUNCH_AUDIT_LIVE_PORT", "LAUNCH_AUDIT_PORT", "MOBILE_PORT", "OVERFLOW_SHOW_ALL",
  "PERF_RUNS", "PERF_SAMPLES", "ROUND3_PORT", "SHOTS_PORT", "KEEP_EXISTING", "LOAD_JOBS",
  /* Where soc2-audit points the generator so that proving it runs does not
   * rewrite four tracked artefacts and leave the working tree dirty. */
  "SOC2_OUT_DIR", "SOC2_DOCS_DIR",
  /*
   * Written into .env.local by `vercel env pull`, not set by this firm. They
   * describe the commit and the build, and the reverse scan sees them because
   * it reads the FILE rather than the source.
   *
   * VERCEL_OIDC_TOKEN is the one genuine credential in this group and it is
   * still not this firm's: Vercel issues it, it is short lived, and nothing
   * here can rotate it. Named rather than silently skipped so a reader knows it
   * was considered.
   */
  "VERCEL_OIDC_TOKEN", "VERCEL_TARGET_ENV",
  "VERCEL_GIT_COMMIT_AUTHOR_LOGIN", "VERCEL_GIT_COMMIT_AUTHOR_NAME", "VERCEL_GIT_COMMIT_MESSAGE",
  "VERCEL_GIT_COMMIT_REF", "VERCEL_GIT_PREVIOUS_SHA", "VERCEL_GIT_PROVIDER",
  "VERCEL_GIT_PULL_REQUEST_ID", "VERCEL_GIT_REPO_ID", "VERCEL_GIT_REPO_OWNER", "VERCEL_GIT_REPO_SLUG",
  /* Build tool switches, written by the same pull. */
  "NX_DAEMON", "TURBO_CACHE", "TURBO_DOWNLOAD_LOCAL_ENABLED", "TURBO_REMOTE_ONLY", "TURBO_RUN_SUMMARY",
  /* Provided by the runtime or the platform, never by this firm. */
  "CI", "GITHUB_ACTIONS", "NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_DEPLOYMENT_ID",
  "VERCEL_GIT_COMMIT_SHA", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_SENTRY_RELEASE", "SENTRY_RELEASE",
  /* Fragments produced by the env scanner reading a dynamic lookup. */
  "NEXT_PUBLIC_", "NEXT_PUBLIC_X",
  /* Vercel supplies these to the deployment; this firm never sets them. */
  "VERCEL_URL", "VERCEL_BRANCH_URL",
]);

/**
 * OFFBOARDING, KEYED TO WHAT THIS PLATFORM CAN ACTUALLY DO.
 *
 * Written as a sequence rather than a policy, because a policy is a sentence
 * about intent and a sequence is a list somebody can follow at eleven at night
 * having never done it before.
 *
 * `can` is the load bearing field. Where the platform cannot perform a step,
 * this says so rather than implying somebody will remember, and the readiness
 * report counts those separately.
 */
export const OFFBOARDING = [
  {
    step: 1,
    what: "Suspend the account.",
    how: "Set status to suspended on eng_profiles, from /portal/people. currentActor re-reads the profile on every request, so a suspended account is refused on its next request rather than when a twelve hour cookie expires.",
    can: true,
  },
  {
    step: 2,
    what: "End the sessions that already exist.",
    how: "Suspension does this by consequence rather than by revocation, because the layout checks status on every request. There is no session table to clear.",
    can: true,
  },
  {
    step: 3,
    what: "Remove the grants.",
    how: "Grants are held by the ROLE, not the person, so there is nothing to remove from an individual. Changing what they can do means changing their role, which is what suspension supersedes.",
    can: true,
  },
  {
    step: 4,
    what: "Transfer responsible charge.",
    how: "NOT POSSIBLE, and it must not become possible. A responsible charge entry names the Professional Engineer who WAS in responsible charge, and that is a regulatory fact about the past. 0039 added ON DELETE RESTRICT so the engineer cannot be deleted while entries name them. Work in flight is re-accepted by another engineer, which creates a NEW entry; the old one stands.",
    can: false,
  },
  {
    step: 5,
    what: "Preserve the audit trail.",
    how: "Nothing to do. eng_audit_events refuses UPDATE and DELETE at the database, so the departing person's history cannot be removed even deliberately.",
    can: true,
  },
  {
    step: 6,
    what: "Remove their second factor enrolment.",
    how: "Delete the eng_mfa_enrolments row. The account is already suspended, so this is hygiene rather than access control.",
    can: true,
  },
  {
    step: 7,
    what: "Rotate any shared secret they held.",
    how: "NOT POSSIBLE TO VERIFY. Nothing records who has seen which secret, and nothing records when a secret was last rotated. With one operator this is vacuous; with a second person it becomes the most important step on this list and the platform cannot help with it.",
    can: false,
  },
  {
    step: 8,
    what: "Record that it happened.",
    how: "The suspension writes an audit event. There is no offboarding record with a checklist and a date, so the evidence is an audit row rather than an attestation.",
    can: false,
  },
];

/**
 * ALL CAPITALS UNDERSCORED STRING LITERALS THAT ARE NOT ENVIRONMENT NAMES.
 *
 * The string lookup scan treats every such literal as a candidate secret,
 * because that convention is the only thing that distinguishes an environment
 * name from any other string, and two real secrets hid behind exactly that
 * shape.
 *
 * Excusing one costs a line here with a reason beside it, which is the cheap
 * direction. A false negative is a secret nobody declared.
 */
export const STRING_LOOKUP_NOT_SECRETS = new Set([
  /* A code symbol name, used as a search needle by accounts-audit to prove the
   * authorisation module has no notion of the customer principal. Not a
   * variable and never read from an environment. */
  "CUSTOMER_COOKIE",
]);
