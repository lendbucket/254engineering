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
      /*
       * SHARED BY OPERATOR RULING, NOT BY OVERSIGHT. 2026-09-13.
       */
      sharingRuling: {
        by: "Robert Reyna, operator",
        on: "2026-09-13",
        consequence: "A preview deployment can decrypt production second factor secrets, because the key that decrypts them is the same value. Preview URLs are publicly reachable by anybody holding the link. The production value is never changed, because encryptionKey is sha256 over it and every enrolment's ciphertext is under the current one; recovery codes are scrypt hashed against the user id and do not depend on it, which is the way back in if it ever is.",
      },
      readOn: READ_ON + " Re-read 2026-09-12: a single entry covering Production and Preview. RULED 2026-09-13: it stays that way.",
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
      /*
       * SHARED BY OPERATOR RULING, NOT BY OVERSIGHT. 2026-09-13.
       */
      sharingRuling: {
        by: "Robert Reyna, operator",
        on: "2026-09-13",
        consequence: "A customer session cookie signed on ANY preview deployment is accepted by production. Preview URLs are publicly reachable by anybody holding the link, so anybody who can reach a preview can mint a session that production will honour as that customer.",
      },
      readOn: READ_ON + " Re-read 2026-09-12: a single entry covering Production and Preview. RULED 2026-09-13: it stays that way.",
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
      /*
       * SHARED BY OPERATOR RULING, NOT BY OVERSIGHT. 2026-09-13.
       */
      sharingRuling: {
        by: "Robert Reyna, operator",
        on: "2026-09-13",
        consequence: "A partner session cookie signed on ANY preview deployment is accepted by production, with the same reach as the customer one: a partner's own earnings, statements and attribution record.",
      },
      readOn: READ_ON + " Re-read 2026-09-12: a single entry covering Production and Preview. RULED 2026-09-13: it stays that way.",
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
  { name: "TBPELS_FIRM_NUMBER", kind: "config", livesIn: "Nothing in src/ reads it any more. The registration moved into src/config/credentials.ts on 2026-09-10.", grants: "Nothing. Retained only where audits clear it.", rotated: "Never." },
  { name: "FIRM_PHONE", kind: "config", livesIn: "Vercel, ALL environments, set 2026-09-14. NOT A SECRET: a published telephone number is a value the firm wants read, and it is in this inventory because every name set in an environment must be declared, not because it needs protecting.", grants: "Publishes the firm telephone number. Clears one of the launch gate conditions. Stored in E.164 as +12819404490; every display form is DERIVED from it by src/config/contact.ts and nothing may read the raw value outside that file and launch.ts, which seo-audit asserts.", rotated: "Never. It changes when the number changes." },
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
