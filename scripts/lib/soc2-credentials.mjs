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
 * @property {string|null} rotated  ISO date last rotated, or null if unknown.
 */

/** @type {Credential[]} */
export const CREDENTIALS = [
  // ---------------------------------------------------------------- secrets
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    kind: "secret",
    livesIn:
      "Vercel for production; .env.local for development, where it is the DEVELOPMENT project's key and every audit reads through it. Never in the working tree for production. WHETHER THE PRODUCTION KEY IS SCOPED TO THE PRODUCTION ENVIRONMENT ALONE IS UNKNOWN, pending the operator reading Vercel: a Preview inheriting it is the exact hazard previewPointingAtProduction() exists for, and it has happened once already, on 2026-09-03.",
    grants:
      "Everything. It bypasses row level security on every table, and since there are zero policies it is the ONLY way in. Holding it is equivalent to holding the database.",
    rotated: "Never.",
  },
  {
    name: "MFA_ENCRYPTION_KEY",
    kind: "secret",
    livesIn: "Vercel. Not database state, which is why a database cutover does not move it.",
    grants:
      "Decryption of every stored TOTP secret. Holding it plus the database would let somebody generate valid second factor codes for any enrolled account.",
    rotated: "Never.",
  },
  {
    name: "OPS_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid staff session cookie for any account, without a password and without a second factor.",
    rotated: "Never.",
  },
  {
    name: "CUSTOMER_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid customer session for any customer account.",
    rotated: "Never.",
  },
  {
    name: "PARTNER_SESSION_SECRET",
    kind: "secret",
    livesIn: "Vercel and .env.local.",
    grants: "Minting a valid partner session for any partner account.",
    rotated: "Never.",
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
      "Vercel for production. REMOVED from .env.local 2026-09-12: nothing local needs it and its presence made two bugs send 55 real emails. Whether it is set on Preview is UNKNOWN, pending the operator reading Vercel.",
    grants: "Sending mail as this firm's domain, and reading the delivery log.",
    rotated: "Never.",
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
      "NOT SET IN ANY ENVIRONMENT, and it must not be until the day the cutover runs. Supplied by hand for one command and never stored. Operator ruling 2026-09-12: a full access key sitting in an environment for a script nobody is running is the largest single credential exposure this firm could have, and it would exist for no current purpose. Confirmed absent from every env file on this machine; whether it exists in Vercel is UNKNOWN, pending the operator reading it there.",
    grants: "Everything on the SOURCE project of a copy, including production if that is what it names.",
    rotated: "Never.",
  },
  {
    name: "COPY_TO_KEY",
    kind: "secret",
    livesIn:
      "NOT SET IN ANY ENVIRONMENT, and it must not be until the day the cutover runs. Supplied by hand for one command. Same ruling as COPY_FROM_KEY. Confirmed absent from every env file on this machine; whether it exists in Vercel is UNKNOWN, pending the operator reading it there.",
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
