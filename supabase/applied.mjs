/**
 * WHICH MIGRATIONS PRODUCTION HAS ACTUALLY RECEIVED.
 *
 * MERGED AND APPLIED ARE DIFFERENT FACTS, AND THIS FILE IS THE SECOND ONE
 * ----------------------------------------------------------------------
 * CLAUDE.md section 6b carries the fingerprint chain, and it is a RECORD: prose
 * that says what was true when somebody wrote it down. Nothing reads it, so
 * nothing can notice when it stops being true.
 *
 * It stopped being true twice. The second time is why this file exists: 0023
 * merged to main on 2026-09-06 and was never applied to production, and it was
 * found on 2026-09-07 only because an unrelated MFA migration made somebody
 * compare the two fingerprints by hand. In between, `eng_alert_state` did not
 * exist on production, so the queue depth alerting built in that same closeout
 * could not work, and the way it would have failed was the exact failure the
 * migration was written to prevent: an alert every five minutes, because the
 * cooldown it reads had nowhere to live.
 *
 * WHAT THIS FILE IS FOR
 * ---------------------
 * One entry per migration, declaring whether production has it. A migration
 * with no entry fails `schema-ledger-audit`, so adding a migration forces
 * somebody to state the answer rather than never being asked the question.
 * That is the whole mechanism: the failure in September was not a wrong answer,
 * it was a question nobody was made to answer.
 *
 * WHY THE FINGERPRINTS ARE HERE AND WHY THEY ARE NOT DECORATION
 * -------------------------------------------------------------
 * Each entry carries the schema fingerprint as it stands AFTER that migration,
 * and `schema-ledger-audit` compares every one against a real replay into an in
 * process Postgres. So this file cannot claim an application that would produce
 * a schema the migrations do not produce. A fabricated entry has to invent a
 * number that a replay agrees with, which is not a thing anybody can do by
 * being careless.
 *
 * It does NOT prove production received it. Nothing in the repository can: that
 * needs production's service role key, which standing law keeps out of the
 * working tree. `scripts/production-schema-check.mjs` closes that last gap and
 * is the one command to run after any merge carrying a migration.
 *
 * TWO FINGERPRINTS REPEAT, AND THAT IS CORRECT
 * ---------------------------------------------
 * 0008 pins the trigger functions' search_path and 0021 seeds one grant row.
 * Both change behaviour without changing shape, so each fingerprints identical
 * to the migration before it. The audit expects that rather than treating it as
 * a copied line, and CLAUDE.md says the same thing in prose.
 */

/**
 * @typedef {object} AppliedEntry
 * @property {string} file        The migration filename, exactly.
 * @property {string} fingerprint The schema fingerprint after it, from a replay.
 * @property {string|null} production  The date production received it, or null.
 * @property {string} [because]   Required when production is null: why not yet.
 * @property {string} [note]      Anything a reader would otherwise get wrong.
 * @property {{table: string, column?: string, match?: Record<string,string>}|null} proves
 *   What this migration uniquely puts in the schema, so a live database can be
 *   asked whether it has it WITHOUT needing information_schema, which PostgREST
 *   does not expose. A table, a column on a table, or a row that must exist.
 *   Null when nothing it does is visible that way, which is true of exactly one
 *   migration and is stated in provesNote rather than passed over.
 * @property {string} [provesNote] Why proves is null.
 */

/** @type {AppliedEntry[]} */
export const APPLIED = [
  /*
   * 0000 through 0008 predate this ledger and predate the development project,
   * which was created on 2026-09-02 by copying production's schema. The exact
   * dates are not recoverable and are not invented here: what is known is that
   * production carried all of them before the split, because the split was made
   * by fingerprinting the two against each other and they matched.
   */
  { file: "0000_eng_legacy_intake.sql", fingerprint: "6b3c866b9fd2d2a6cb2610406579bec7", proves: { table: "eng_leads" }, production: "2026-09-02", note: "Predates the ledger. Date is the split, not the application." },
  { file: "0001_ops_foundation.sql", fingerprint: "295e928584cea806d90c5a2f2dede886", proves: { table: "eng_profiles" }, production: "2026-09-02", note: "The fingerprint both projects returned at the split." },
  { file: "0002_field_dispatch.sql", fingerprint: "b4b422e1b761ae633b7729dff63f7669", proves: { table: "eng_profiles", column: "base_lat" }, production: "2026-09-02" },
  { file: "0003_tech_onboarding.sql", fingerprint: "ad2663f8e0e6cd2508c9b5bd43c7b7f4", proves: { table: "eng_protocol_questions" }, production: "2026-09-02" },
  { file: "0004_engineer_review.sql", fingerprint: "7249bb177ad22e5bab4da2ab0cae44f9", proves: { table: "eng_review_sessions" }, production: "2026-09-02" },
  { file: "0005_comms.sql", fingerprint: "1187b16a91c10ff758ce8953e4efb1ca", proves: { table: "eng_tasks", column: "source_key" }, production: "2026-09-02" },
  { file: "0006_order_engine.sql", fingerprint: "f27078a89edc555283d50476b2be252e", proves: { table: "eng_service_orders" }, production: "2026-09-03" },
  { file: "0007_order_tiers.sql", fingerprint: "eac11d782d44bd11cb893637f67d2ee1", proves: { table: "eng_service_orders", column: "tier" }, production: "2026-09-03" },
  { file: "0008_pin_function_search_path.sql", fingerprint: "eac11d782d44bd11cb893637f67d2ee1", proves: null, production: "2026-09-03", provesNote: "Nothing in it is visible through PostgREST: it pins search_path on four functions and creates no table, column or row. The production check says so rather than passing over it.", note: "Same fingerprint as 0007 on purpose: it pins search_path, which changes behaviour and not shape." },

  { file: "0009_b2b_accounts.sql", fingerprint: "2f92026fb0d75e4cc9d0942be067999f", proves: { table: "eng_customer_accounts" }, production: "2026-09-04" },
  { file: "0010_api_requests.sql", fingerprint: "9b32a7cced94549f7aeea93cc3ee3d6e", proves: { table: "eng_account_api_requests" }, production: "2026-09-04" },
  { file: "0011_job_queue.sql", fingerprint: "8b1dee7c095418d7e91bcc3434a00796", proves: { table: "eng_jobs" }, production: "2026-09-04" },
  { file: "0012_observability.sql", fingerprint: "7bf0d1553cf0169d366389eeae4b7497", proves: { table: "eng_cron_runs" }, production: "2026-09-04" },
  { file: "0013_partner_program.sql", fingerprint: "e5637c603ce0d20535478427bfa28508", proves: { table: "eng_partners" }, production: "2026-09-04" },
  { file: "0014_partner_attribution.sql", fingerprint: "b1ad321300010129b5dbd0afc42a156b", proves: { table: "eng_partner_touches" }, production: "2026-09-04" },
  { file: "0015_operator_intake.sql", fingerprint: "44bf672bdd0b4afa29d46965b54c7eb7", proves: { table: "eng_files", column: "intake_channel" }, production: "2026-09-04" },
  { file: "0016_file_inputs.sql", fingerprint: "b73977baf49b6e1ad84840ea042186a1", proves: { table: "eng_file_inputs" }, production: "2026-09-04" },
  { file: "0017_account_defaults.sql", fingerprint: "aca946e3c49d149d73685c4eb30d092e", proves: { table: "eng_customer_accounts", column: "default_answers" }, production: "2026-09-04" },
  { file: "0018_roles_as_data.sql", fingerprint: "eb4f97be87ef35c21b1cc8b3b4d6af23", proves: { table: "eng_roles" }, production: "2026-09-05" },
  { file: "0019_partner_compensation.sql", fingerprint: "d8fa49515f2666bd7543c21aff831407", proves: { table: "eng_partner_entries" }, production: "2026-09-06" },
  { file: "0020_partner_assets.sql", fingerprint: "0b269ca7f86b3c3efa06c8c43e0084b0", proves: { table: "eng_partner_assets" }, production: "2026-09-06" },
  { file: "0021_partners_manage_grant.sql", fingerprint: "0b269ca7f86b3c3efa06c8c43e0084b0", proves: { table: "eng_role_grants", match: { role_key: "admin", action: "partners.manage" } }, production: "2026-09-06", note: "Same fingerprint as 0020 on purpose: it seeds one grant ROW, which the fingerprint cannot see. The grant count is checked separately." },
  { file: "0022_order_visitor_key.sql", fingerprint: "330536b4b13cfc2f51ed1cb3b0c6edf1", proves: { table: "eng_service_orders", column: "visitor_key" }, production: "2026-09-06" },

  /*
   * THE ONE THIS FILE EXISTS BECAUSE OF.
   *
   * Merged 2026-09-06 with the closeout and applied 2026-09-07, a day late,
   * found by hand rather than by anything. The gap is recorded rather than
   * smoothed over: an entry that reads as if it went out with its merge would
   * remove the only evidence that this failure mode is real.
   */
  { file: "0023_alert_state.sql", fingerprint: "b2c841480f983ec50e36e72a11e9072a", proves: { table: "eng_alert_state" }, production: "2026-09-07", note: "Merged 2026-09-06 and applied 2026-09-07. The gap is why this ledger exists." },

  {
    file: "0024_mfa.sql",
    fingerprint: "0e8ff33c7106ce05ec2cf81a1c66cd35",
    proves: { table: "eng_mfa_enrolments" },
    production: "2026-09-07",
    note:
      "Applied to production BEFORE the merge, deliberately. The code reads eng_mfa_enrolments on every sign in, so shipping it first would have meant nobody could sign in at all, which is the same class of failure 0023 caused and the reason this ledger exists.",
  },

  /*
   * A ROW CHANGE, WHICH IS THE KIND THIS LEDGER IS WORST AT AND MOST NEEDED FOR.
   *
   * The fingerprint cannot see it, exactly as with 0021: admin and engineer
   * move from 'required' to 'optional' and the schema is identical either way.
   * So `proves` asks the database about the ROW, and it is the only thing
   * standing between a merged decision and a production that never heard it.
   *
   * It exists as its own migration rather than as an edit to 0024's seed
   * because 0024 has run. The reasoning is at the top of both files.
   */
  {
    file: "0025_mfa_optional_default.sql",
    fingerprint: "0e8ff33c7106ce05ec2cf81a1c66cd35",
    proves: { table: "eng_roles", match: { key: "admin", mfa_requirement: "optional" } },
    production: "2026-09-07",
    note:
      "Same fingerprint as 0024 on purpose, for the reason 0021 carries: it changes two ROWS and the schema is unchanged. What it changes is checked by the row match above rather than by the fingerprint.",
  },
];

/** The canary. An empty ledger must never read as a ledger with nothing to say. */
export function assertNotEmpty() {
  if (!Array.isArray(APPLIED) || APPLIED.length === 0) {
    throw new Error(
      "supabase/applied.mjs is empty. Every check that reads it would pass over nothing, which is how a ledger becomes decoration.",
    );
  }
  return APPLIED;
}

/** The entries production is declared to have, in order. */
export function appliedToProduction() {
  return assertNotEmpty().filter((e) => e.production !== null);
}

/** The entries production has not received, in order. */
export function pending() {
  return assertNotEmpty().filter((e) => e.production === null);
}

/**
 * What production's fingerprint should be if the ledger is true.
 *
 * The last APPLIED entry's fingerprint, not the last entry's: a pending
 * migration at the end must not change what production is expected to hold.
 */
export function expectedProductionFingerprint() {
  const applied = appliedToProduction();
  return applied.length ? applied[applied.length - 1].fingerprint : null;
}
