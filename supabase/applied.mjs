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
 * @property {"apply_migration"|"execute_sql"|"pre_ledger"} appliedBy
 *   HOW production received it, which decides whether the provider's own
 *   migration history shows it. apply_migration writes a row into
 *   supabase_migrations.schema_migrations; execute_sql changes the database and
 *   writes nothing, so the migration is invisible to that history while being
 *   plainly present in the schema. pre_ledger covers 0000 to 0005, which
 *   production received under the names they were applied with, before the
 *   numbered convention existed.
 *
 *   Operator ruling, 2026-09-09: every production migration from here goes
 *   through apply_migration, so the two records agree. execute_sql therefore
 *   requires a handApplied sentence, and schema-ledger-audit names every entry
 *   carrying one, because the failure mode is somebody reading the provider's
 *   list, not finding a migration, and concluding production is missing it.
 * @property {string} [handApplied] Required when appliedBy is "execute_sql":
 *   what the provider's history will NOT show, and how the schema was confirmed
 *   to hold it anyway.
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
  { file: "0000_eng_legacy_intake.sql", appliedBy: "pre_ledger", fingerprint: "6b3c866b9fd2d2a6cb2610406579bec7", proves: { table: "eng_leads" }, production: "2026-09-02", note: "Predates the ledger. Date is the split, not the application." },
  { file: "0001_ops_foundation.sql", appliedBy: "pre_ledger", fingerprint: "295e928584cea806d90c5a2f2dede886", proves: { table: "eng_profiles" }, production: "2026-09-02", note: "The fingerprint both projects returned at the split." },
  { file: "0002_field_dispatch.sql", appliedBy: "pre_ledger", fingerprint: "b4b422e1b761ae633b7729dff63f7669", proves: { table: "eng_profiles", column: "base_lat" }, production: "2026-09-02" },
  { file: "0003_tech_onboarding.sql", appliedBy: "pre_ledger", fingerprint: "ad2663f8e0e6cd2508c9b5bd43c7b7f4", proves: { table: "eng_protocol_questions" }, production: "2026-09-02" },
  { file: "0004_engineer_review.sql", appliedBy: "pre_ledger", fingerprint: "7249bb177ad22e5bab4da2ab0cae44f9", proves: { table: "eng_review_sessions" }, production: "2026-09-02" },
  { file: "0005_comms.sql", appliedBy: "pre_ledger", fingerprint: "1187b16a91c10ff758ce8953e4efb1ca", proves: { table: "eng_tasks", column: "source_key" }, production: "2026-09-02" },
  { file: "0006_order_engine.sql", appliedBy: "apply_migration", fingerprint: "f27078a89edc555283d50476b2be252e", proves: { table: "eng_service_orders" }, production: "2026-09-03" },
  { file: "0007_order_tiers.sql", appliedBy: "apply_migration", fingerprint: "eac11d782d44bd11cb893637f67d2ee1", proves: { table: "eng_service_orders", column: "tier" }, production: "2026-09-03" },
  { file: "0008_pin_function_search_path.sql", appliedBy: "apply_migration", fingerprint: "eac11d782d44bd11cb893637f67d2ee1", proves: null, production: "2026-09-03", provesNote: "Nothing in it is visible through PostgREST: it pins search_path on four functions and creates no table, column or row. The production check says so rather than passing over it.", note: "Same fingerprint as 0007 on purpose: it pins search_path, which changes behaviour and not shape." },

  { file: "0009_b2b_accounts.sql", appliedBy: "apply_migration", fingerprint: "2f92026fb0d75e4cc9d0942be067999f", proves: { table: "eng_customer_accounts" }, production: "2026-09-04" },
  { file: "0010_api_requests.sql", appliedBy: "apply_migration", fingerprint: "9b32a7cced94549f7aeea93cc3ee3d6e", proves: { table: "eng_account_api_requests" }, production: "2026-09-04" },
  { file: "0011_job_queue.sql", appliedBy: "apply_migration", fingerprint: "8b1dee7c095418d7e91bcc3434a00796", proves: { table: "eng_jobs" }, production: "2026-09-04" },
  { file: "0012_observability.sql", appliedBy: "apply_migration", fingerprint: "7bf0d1553cf0169d366389eeae4b7497", proves: { table: "eng_cron_runs" }, production: "2026-09-04" },
  { file: "0013_partner_program.sql", appliedBy: "apply_migration", fingerprint: "e5637c603ce0d20535478427bfa28508", proves: { table: "eng_partners" }, production: "2026-09-04" },
  { file: "0014_partner_attribution.sql", appliedBy: "apply_migration", fingerprint: "b1ad321300010129b5dbd0afc42a156b", proves: { table: "eng_partner_touches" }, production: "2026-09-04" },
  { file: "0015_operator_intake.sql", appliedBy: "apply_migration", fingerprint: "44bf672bdd0b4afa29d46965b54c7eb7", proves: { table: "eng_files", column: "intake_channel" }, production: "2026-09-04" },
  { file: "0016_file_inputs.sql", appliedBy: "apply_migration", fingerprint: "b73977baf49b6e1ad84840ea042186a1", proves: { table: "eng_file_inputs" }, production: "2026-09-04" },
  { file: "0017_account_defaults.sql", appliedBy: "apply_migration", fingerprint: "aca946e3c49d149d73685c4eb30d092e", proves: { table: "eng_customer_accounts", column: "default_answers" }, production: "2026-09-04" },
  { file: "0018_roles_as_data.sql", appliedBy: "apply_migration", fingerprint: "eb4f97be87ef35c21b1cc8b3b4d6af23", proves: { table: "eng_roles" }, production: "2026-09-05" },
  { file: "0019_partner_compensation.sql", appliedBy: "apply_migration", fingerprint: "d8fa49515f2666bd7543c21aff831407", proves: { table: "eng_partner_entries" }, production: "2026-09-06" },
  { file: "0020_partner_assets.sql", appliedBy: "apply_migration", fingerprint: "0b269ca7f86b3c3efa06c8c43e0084b0", proves: { table: "eng_partner_assets" }, production: "2026-09-06" },
  { file: "0021_partners_manage_grant.sql", appliedBy: "apply_migration", fingerprint: "0b269ca7f86b3c3efa06c8c43e0084b0", proves: { table: "eng_role_grants", match: { role_key: "admin", action: "partners.manage" } }, production: "2026-09-06", note: "Same fingerprint as 0020 on purpose: it seeds one grant ROW, which the fingerprint cannot see. The grant count is checked separately." },
  { file: "0022_order_visitor_key.sql", appliedBy: "apply_migration", fingerprint: "330536b4b13cfc2f51ed1cb3b0c6edf1", proves: { table: "eng_service_orders", column: "visitor_key" }, production: "2026-09-06" },

  /*
   * THE ONE THIS FILE EXISTS BECAUSE OF.
   *
   * Merged 2026-09-06 with the closeout and applied 2026-09-07, a day late,
   * found by hand rather than by anything. The gap is recorded rather than
   * smoothed over: an entry that reads as if it went out with its merge would
   * remove the only evidence that this failure mode is real.
   */
  { file: "0023_alert_state.sql", appliedBy: "apply_migration", fingerprint: "b2c841480f983ec50e36e72a11e9072a", proves: { table: "eng_alert_state" }, production: "2026-09-07", note: "Merged 2026-09-06 and applied 2026-09-07. The gap is why this ledger exists." },

  {
    file: "0024_mfa.sql", appliedBy: "apply_migration",
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
    file: "0025_mfa_optional_default.sql", appliedBy: "execute_sql",
    fingerprint: "0e8ff33c7106ce05ec2cf81a1c66cd35",
    proves: { table: "eng_roles", match: { key: "admin", mfa_requirement: "optional" } },
    production: "2026-09-07",
    handApplied:
      "APPLIED BY HAND, SO PRODUCTION'S OWN MIGRATION HISTORY DOES NOT SHOW IT. Read back 2026-09-09: production's list_migrations names 0024 and 0026 and 0027 and not this one, while production unmistakably HAS it, because eng_roles reads optional for admin and engineer and that is the only thing this migration does. It went through execute_sql, which changes the database without writing a row into supabase_migrations.schema_migrations. Operator ruling 2026-09-09: every production migration from here goes through apply_migration so the two records agree, and this entry is the one that has to be named rather than quietly left to be rediscovered.",
    note:
      "Same fingerprint as 0024 on purpose, for the reason 0021 carries: it changes two ROWS and the schema is unchanged. What it changes is checked by the row match above rather than by the fingerprint.",
  },

  /*
   * The marketing suppression list. Its own table rather than a column on a
   * profile, because the people it is about have no profile: a waitlist signup
   * is an address and a name, and keying consent to an account would mean the
   * only people who can unsubscribe are staff.
   */
  {
    file: "0026_marketing_suppressions.sql", appliedBy: "apply_migration",
    fingerprint: "2f76de7be0fb4ed93459db4d72d80237",
    proves: { table: "eng_marketing_suppressions" },
    production: "2026-09-08",
    note:
      "Applied to production on merge and read back rather than assumed: fingerprint 2f76de7be0fb4ed93459db4d72d80237 across 964 columns and 72 eng_ tables, identical to development and to the replay. PRODUCTION IS STILL THE SHARED PROJECT fsaryeciduszuahgjbly: the same query counts 125 tables in public, so 53 belong to unrelated apps and this table sits beside them. That is why every table this firm owns is eng_ prefixed, and it is what the cutover has to carry across.",
  },

  /*
   * Reporting foundations. Three rules that all had to exist before a single
   * figure was rendered, because each decides what a figure MEANS.
   */
  {
    file: "0027_reporting_foundations.sql", appliedBy: "apply_migration",
    fingerprint: "9bbcca2c9cd3c65503c923d7c32ea769",
    proves: { table: "eng_role_grants", match: { role_key: "engineer", action: "reports.production" } },
    production: "2026-09-08",
    note:
      "Applied and read back rather than assumed: fingerprint 9bbcca2c9cd3c65503c923d7c32ea769 across 970 columns and 72 eng_ tables, identical to development and the replay, with 5 report grants and 116 grants in total. Production holds ZERO demo records, so the backfill marked nothing there and the two directional check was added over clean data. Production is still the shared project fsaryeciduszuahgjbly.",
  },

  /*
   * The records 0027's backfill could not name. Data only: no DDL, so the
   * fingerprint is unchanged from 0027.
   */
  {
    file: "0028_probe_records_are_demonstrations.sql", appliedBy: "apply_migration",
    fingerprint: "9bbcca2c9cd3c65503c923d7c32ea769",
    proves: { table: "eng_partners", match: { organisation: "ZZ probe, safe to ignore", is_demo: true } },
    production: "2026-09-08",
    note:
      "Applied to development and to production on 2026-09-08 through the Supabase MCP, the same mechanism 0027 went through, and read back rather than assumed. Fingerprint unchanged at 9bbcca2c9cd3c65503c923d7c32ea769 across 970 columns and 72 eng_ tables, which is what a backfill with no DDL in it should do. ON PRODUCTION IT MARKED NOTHING, AND THAT IS THE MEASURED ANSWER RATHER THAN AN ASSUMPTION: production holds 2 profiles, 1 application, and zero partners, clients, orders and files, none of them on an unroutable address, and the same sweep re-run afterwards found nothing left unmarked. On development it marked twelve: eight probe partners, three Stripe probe clients and one client written by a script that is not in the tree. It retires the BACKLOG entry 'Eight probe partners on development cannot be deleted, and should not be'; they still cannot be deleted, and they no longer need to be, because a record that cannot be removed can still be told apart. A FIRST DRAFT OF THIS ENTRY DECLARED IT PENDING AND SAID PRODUCTION WAS UNREADABLE FROM HERE. That was wrong and is recorded rather than quietly fixed: one execute_sql call had been refused, and the session generalised a single refusal into a closed door without trying apply_migration, which is the tool 0027 went through and which worked first time.",
  },

  /*
   * Taking somebody off the marketing list becomes a grant. Two rows, no DDL,
   * so the fingerprint is unchanged for the same reason 0021 and 0025 are.
   */
  {
    file: "0029_suppressions_manage_grant.sql", appliedBy: "apply_migration",
    fingerprint: "9bbcca2c9cd3c65503c923d7c32ea769",
    proves: { table: "eng_role_grants", match: { role_key: "customer_service", action: "suppressions.manage" } },
    production: "2026-09-09",
    note:
      "Applied to development 2026-09-09 and to production on merge the same day, through apply_migration, and read back rather than assumed: fingerprint unchanged at 9bbcca2c9cd3c65503c923d7c32ea769 across 970 columns and 72 eng_ tables, which is what two seeded rows and no DDL should do, with 118 role grants in total and suppressions.manage held by exactly admin and customer_service. Sales holds nothing here on purpose: somebody paid to grow a list should not be the one who can quietly shorten it, and the request does not arrive there anyway. IT WAS DELIBERATELY PENDING UNTIL THE MERGE, which is the lesson 0027 taught: applying early leaves the board red on 'nothing is applied to production that is not on main' for the whole life of the branch, and one red check that is always there trains everybody to read red as normal.",
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
