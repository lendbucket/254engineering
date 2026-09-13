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

/**
 * THE CREDENTIAL INVENTORY MOVED TO src/config/credential-inventory.ts.
 *
 * Phase 13. The launch gate had to read it, the gate is in src/, and src cannot
 * import from scripts. Re-exported here so every audit that imports CREDENTIALS
 * from this module keeps working and there is still exactly one declaration.
 */
export { CREDENTIALS } from "../../src/config/credential-inventory.ts";


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
