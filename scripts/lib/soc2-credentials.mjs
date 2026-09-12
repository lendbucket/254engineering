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
 * `rotated` IS ALMOST ALWAYS null AND THAT IS THE FINDING. Nothing in this
 * platform records when a secret was last changed, because nothing has ever
 * rotated one. Writing a plausible date would be the fabrication this whole
 * repository exists to prevent, so the column says null and the readiness
 * report counts them.
 */

/**
 * @typedef {object} Credential
 * @property {string} name          The variable, exactly as the code reads it.
 * @property {"secret"|"config"|"test-only"} kind
 * @property {string} livesIn       Where the real value is held.
 * @property {string} grants        What somebody holding it could do.
 * @property {string|null} rotated  ISO date last rotated, or null if unknown.
 */

/** @type {Credential[]} */
export const CREDENTIALS = [
  // ---------------------------------------------------------------- secrets
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    kind: "secret",
    livesIn: "Vercel for production; .env.local for development. Never in the working tree for production.",
    grants:
      "Everything. It bypasses row level security on every table, and since there are zero policies it is the ONLY way in. Holding it is equivalent to holding the database.",
    rotated: null,
  },
  {
    name: "MFA_ENCRYPTION_KEY",
    kind: "secret",
    livesIn: "Vercel. Not database state, which is why a database cutover does not move it.",
    grants:
      "Decryption of every stored TOTP secret. Holding it plus the database would let somebody generate valid second factor codes for any enrolled account.",
    rotated: null,
  },
  {
    name: "OPS_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid staff session cookie for any account, without a password and without a second factor.",
    rotated: null,
  },
  {
    name: "CUSTOMER_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid customer session for any customer account.",
    rotated: null,
  },
  {
    name: "PARTNER_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid partner session for any partner account.",
    rotated: null,
  },
  {
    name: "STRIPE_SECRET_KEY",
    kind: "secret",
    livesIn: "Vercel. The account it belongs to is Reyna Pay, not this firm, which is launch condition `stripe`.",
    grants: "Charging and refunding against that Stripe account, and reading every charge on it.",
    rotated: null,
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    kind: "secret",
    livesIn: "Vercel.",
    grants: "Forging a payment webhook this platform would believe, which is how an order gets marked paid without money moving.",
    rotated: null,
  },
  {
    name: "RESEND_API_KEY",
    kind: "secret",
    livesIn: "Vercel.",
    grants: "Sending mail as this firm's domain, and reading the delivery log.",
    rotated: null,
  },
  {
    name: "CRON_SECRET",
    kind: "secret",
    livesIn: "Vercel.",
    grants: "Triggering any scheduled job on demand, including the retention sweep.",
    rotated: null,
  },
  {
    name: "OPS_UNLOCK_TOKEN",
    kind: "secret",
    livesIn: "Vercel.",
    grants: "Clearing a lockout on a staff account.",
    rotated: null,
  },
  {
    name: "ORDER_INTAKE_KEYS",
    kind: "secret",
    livesIn: "Vercel. The keys the two sister sites present to the intake API.",
    grants: "Submitting leads and orders into this platform as a sister site.",
    rotated: null,
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
    rotated: null,
  },
  {
    name: "INTAKE_KEY_STAMP",
    kind: "secret",
    livesIn: "Vercel. Held by the stampmyplans deployment.",
    grants: "Submitting leads and orders into this firm's database as StampMyPlans.",
    rotated: null,
  },
  {
    name: "SENTRY_DSN",
    kind: "secret",
    livesIn: "Not set. The fault store is this platform's own table.",
    grants: "Writing fault reports into a Sentry project. Listed because the code reads it, not because it is in use.",
    rotated: null,
  },
  {
    name: "NEXT_PUBLIC_SENTRY_DSN",
    kind: "config",
    livesIn: "Not set. Public by construction if it ever is.",
    grants: "Nothing secret. A DSN is write only and is inlined into the browser bundle.",
    rotated: null,
  },

  // ----------------------------------------------------------------- config
  { name: "SUPABASE_URL", kind: "config", livesIn: "Vercel and .env.local.", grants: "Names which database. Not a secret, and the single most important value to get right: db-guard exists because of it.", rotated: null },
  { name: "LAUNCH_MODE", kind: "config", livesIn: "Vercel.", grants: "One of seven launch gate conditions. Alone it opens nothing.", rotated: null },
  { name: "TBPELS_PE_LICENSE", kind: "config", livesIn: "Not set. No PE is in responsible charge.", grants: "Asserts an engineer of record exists. Gated on the licence number being supplied so the gate cannot be opened by optimism.", rotated: null },
  { name: "TBPELS_FIRM_NUMBER", kind: "config", livesIn: "Nothing in src/ reads it any more. The registration moved into src/config/credentials.ts on 2026-09-10.", grants: "Nothing. Retained only where audits clear it.", rotated: null },
  { name: "FIRM_PHONE", kind: "config", livesIn: "Not set. A launch gate condition.", grants: "Publishes a telephone number.", rotated: null },
  { name: "MAIL_FROM_ADDRESS_LINE", kind: "config", livesIn: "Vercel.", grants: "The postal address in an email footer.", rotated: null },
  { name: "NEXT_PUBLIC_SITE_URL", kind: "config", livesIn: "Vercel.", grants: "Nothing. The canonical host.", rotated: null },
  { name: "ALLOW_PRODUCTION_DB", kind: "config", livesIn: "Never set in any deployment. Typed by hand for one command.", grants: "Permission for a script to talk to production. Compared exactly against the string 1, so 0, false and true are all refusals.", rotated: null },
  { name: "ALLOW_PRODUCTION_PREVIEW", kind: "config", livesIn: "Never set.", grants: "Permission for a preview deployment to point at production. Almost never the right answer.", rotated: null },
  { name: "MFA_BREAK_GLASS", kind: "config", livesIn: "Never set in a deployment.", grants: "Bypassing the second factor requirement. The most dangerous config value here, which is why it is named rather than left to be discovered.", rotated: null },
  { name: "ORDER_PAYMENTS_FAKE", kind: "config", livesIn: "Development only.", grants: "Taking an order without calling Stripe.", rotated: null },
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
    rotated: null,
  },
  {
    name: "ALLOW_LIVE_KEY_OFF_PRODUCTION",
    kind: "config",
    livesIn: "Never set in any deployment.",
    grants: "Permission for a non production deployment to hold a live payment key, which is how a test order charges a real card.",
    rotated: null,
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
