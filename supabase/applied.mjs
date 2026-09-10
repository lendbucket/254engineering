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
 * @property {string} [behaviour] THE SECOND FINGERPRINT, from a replay, and
 *   required from 0038 onwards. Operator ruling, 2026-09-09: the first
 *   fingerprint's four blind spots close at the start of Phase 12 Section 4,
 *   and from then on the second is recorded beside the first in every entry.
 *
 *   The first is md5 over columns and answers "do these databases have the same
 *   SHAPE". The second is md5 over the catalogue facts it cannot reach: what a
 *   foreign key does on delete, what fires and which function it calls, what
 *   those functions are, what is indexed and uniquely, whether row level
 *   security is on, and the rows of the tables whose CONTENT is part of the
 *   schema. The query is scripts/lib/fingerprints.mjs and nothing else may
 *   spell it, because two spellings of one question are two questions.
 *
 *   Earlier entries deliberately have none. The first fingerprint is kept for
 *   the history it already describes, and backfilling a number nobody read at
 *   the time would be a record invented after the fact.
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

  /*
   * The two things retention cannot be built without: a foreign key that would
   * let a retention run undo Section 2's demo scoping, and the permission that
   * turns a dry run into a deletion.
   */
  {
    file: "0030_retention_foundations.sql", appliedBy: "apply_migration",
    fingerprint: "9bbcca2c9cd3c65503c923d7c32ea769",
    proves: { table: "eng_role_grants", match: { role_key: "admin", action: "retention.execute" } },
    production: "2026-09-09",
    because:
      "Phase 12 Section 3 is open and this is the ruled sequence: pending until the branch merges, then applied through apply_migration, read back, and declared. Applied to development 2026-09-09 and read back rather than assumed: fingerprint unchanged at 9bbcca2c9cd3c65503c923d7c32ea769 across 970 columns and 72 eng_ tables, which is what an ALTER of a foreign key's delete action and one seeded row should do, with 119 role grants in total and retention.execute held by admin alone.",
    note:
      "TWO PARTS, AND THE FIRST IS THE ONE THE FINGERPRINT CANNOT SEE. Both ledgers' file_id carried ON DELETE SET NULL and both now carry RESTRICT, which pg_constraint reports as confdeltype 'r' and information_schema.columns reports as nothing at all: the column's name, type and nullability are identical either way, so this is the second migration in this chain after 0018 whose correctness is invisible to the figure above. It is verified by reading confdeltype directly and, since a constraint that merely EXISTS is not a constraint that FIRES, by a live proof on development: a demonstration file with a $600.00 production ledger entry against it, deleted, refused by name with 'violates foreign key constraint eng_production_ledger_file_id_fkey', the file still present and the entry's file_id still set. The reason is in the migration at length and is one sentence here: Section 2 scopes a person's pay THROUGH the file, so a retention run deleting a demonstration file would have nulled the link and started that money counting in a real person's figures, silently undoing scoping built three days earlier. The trade is accepted: a demonstration file with earnings is kept forever and is_demo keeps it out of every figure. Safe to apply now precisely because neither ledger holds a row on either database and production holds no files at all, so nothing existing can violate it; the same change after the firm is trading would have to reconcile live rows first. The second part seeds retention.execute to admin alone, which is the only permission in this platform that destroys a record.",
  },

  /*
   * The manifest. What a retention run intended, written down before it takes
   * a row, and the first table in this schema whose purpose is to make a
   * DELETION accountable.
   */
  {
    file: "0031_retention_manifest.sql", appliedBy: "apply_migration",
    fingerprint: "d4f266b0d595c9c2922b68971b9cec2a",
    proves: { table: "eng_retention_runs" },
    production: "2026-09-09",
    because:
      "Phase 12 Section 3 is open and this follows 0030's ruled sequence: pending until the branch merges, then applied through apply_migration, read back, and declared. Applied to development 2026-09-09 and read back rather than assumed: fingerprint d4f266b0d595c9c2922b68971b9cec2a across 994 columns and 73 eng_ tables, with row level security on all 73, 48 triggers, 10 eng_ functions and none of them with an unpinned search_path.",
    note:
      "THE ORDER IS THE WHOLE DESIGN: the manifest is written first and the rows go second, so a run that dies halfway leaves a record naming exactly what it was about to take rather than an absence nobody can describe. It carries the policy as it stood (table, rule, floor, age column, cutoff), the SET by id range and by sha256 over the ids, the rollups that had to reconcile per day before planning would finish, the mode, the actor, and both timestamps: planned_at in UTC and planned_at_ct written by the DATABASE from the same now(), so a stamp formatted in the application cannot disagree with the instant beside it. A count alone would not have done for the set, because two different thousand row sets have the same count. IT REFUSES DELETE AND ALLOWS UPDATE, and both halves are proved rather than asserted: with the service role, the most privileged credential this platform has, deleting a manifest row returns 'eng_retention_runs rows cannot be deleted. A retention run that can erase its own record is a retention run with no record.' and loses no rows, while an update to its status succeeds, which is what a run's own progress and reconciliation need. Append only would have made the table unusable; a manifest disappearing is the failure it exists to prevent. It is declared kept_forever in retention-policy.ts with the same reasoning, so the schema and the declaration cannot drift. The proof left one row on development that cannot be removed, which is the property it proves; its note says so and it is mode dry_run with intended_count 0.",
  },

  /*
   * The seven tables the declaration called kept forever and nothing enforced.
   */
  {
    file: "0032_kept_forever_is_enforced.sql", appliedBy: "apply_migration",
    fingerprint: "d4f266b0d595c9c2922b68971b9cec2a",
    proves: { table: "eng_production_ledger" },
    production: "2026-09-09",
    because:
      "Phase 12 Section 3 is open and this follows the ruled sequence set by 0029: pending until the branch merges, then applied through apply_migration, read back, and declared. Applied to development 2026-09-09. THE FINGERPRINT IS UNCHANGED FROM 0031 AND THAT IS THE POINT OF IT: this migration adds seven triggers and two functions and not one column, so the figure the fingerprint measures cannot see any of it. What it adds is read back directly instead, from pg_trigger and pg_proc: 55 triggers where there were 48, 12 eng_ functions where there were 10, none with an unpinned search_path. That makes it the third migration in this chain after 0018 and 0030 whose correctness the fingerprint is blind to, and migration-audit checks it by asking the replayed catalogue which trigger is attached to what.",
    note:
      "A MIGRATION WRITTEN BECAUSE A DECLARATION WAS FOUND MAKING A PROMISE NOTHING KEPT. retention-policy.ts declared 22 tables kept forever; 15 were held by a delete refusing trigger or an inbound ON DELETE RESTRICT and SEVEN were held by nothing but the file itself, THREE of which said in writing that a foreign key kept them. That sentence was true and about the wrong table: an outbound reference with ON DELETE RESTRICT protects the table it POINTS AT, so the ledgers' key on eng_profiles keeps profiles and did nothing to stop a ledger row being deleted. Found by reading the declaration against pg_constraint, not by any check. FIVE TABLES GET AN UNCONDITIONAL REFUSAL through eng_forbid_record_delete: both ledgers, the time log, the suppression list and eng_metrics_daily. Money, consent, and the rollup that outlives its sources, which is the one table here retention itself makes irreplaceable. TWO GET A CONDITIONAL ONE through eng_forbid_sealed_work_delete: a sealed deliverable and everything belonging to a file that has one, cascade included, while evidence on an unsealed file stays deletable because that question is still with counsel. THOSE TWO REFUSE NOTHING TODAY and it is said out loud in the migration: registration is pending, no PE is on staff, nothing is sealed or can be. They are proved inside migration-audit's replayed database, which is thrown away, because proving them live would mean writing a fabricated sealing record; that is the same treatment eng_partner_entries has had since 0019. Both directions are checked and the unsealed half EARNED ITS PLACE IMMEDIATELY: it caught the first version of the trigger raising 'record old has no field sealed_at' on evidence rows, because plpgsql resolves the field reference whatever the guard beside it says. It reads the column through to_jsonb now. THE COST IS REAL AND IS RECORDED RATHER THAN DISCOVERED: three scripts could no longer tear their fixtures down, and two of them WENT ON PASSING because the client returns a delete error rather than throwing and their cleanup never looked at it. Development gained two orphaned ledger rows, one of them with no file at all, before anybody counted. dashboards-audit and demo-audit now share one standing fixture that is created once and reused, and each asserts its own row count did not grow.",
  },

  /*
   * The manifest explains itself, and a plan nobody ran says so.
   */
  {
    file: "0033_manifest_reads_and_abandons.sql", appliedBy: "apply_migration",
    fingerprint: "2aee07d8809c3db282e4eb282bb9bbd5",
    proves: { table: "eng_retention_runs" },
    production: "2026-09-09",
    because:
      "Same branch and the same ruled sequence as 0030, 0031 and 0032: pending until merge. Applied to development 2026-09-09 and read back rather than assumed: fingerprint 2aee07d8809c3db282e4eb282bb9bbd5 across 995 columns and 73 eng_ tables, with row level security on all 73, 55 triggers and 12 eng_ functions, none with an unpinned search_path. plan_reading is the one column that moves the count from 994 to 995, because 0032 before it adds none.",
    note:
      "TWO GATE 2 RULINGS, BOTH SAYING THE SAME THING: the manifest is the artefact a person reads, so what a person needs in order to read it correctly belongs on the manifest. plan_reading carries the sentences a reader would otherwise get wrong about THAT plan: that an empty set bounds nothing and shares its hash with every other empty set, that a rollup with no day lines ran and had nothing to check, that an intended count of zero usually means the oldest candidate is younger than the floor and here is how old it actually is, and that two plans made in one pass carry cutoffs seconds apart. Written at planning time and never overwritten by the run, because note is the outcome. The status check constraint gains 'abandoned', a fourth terminal state meaning nothing was attempted and nothing will be. It is set by UPDATE, which this table has always allowed; DELETE is what it refuses, and a plan nobody will act on is exactly the row that would otherwise tempt somebody into removing one. Every script that plans without running now abandons what it planned before exiting, retention-audit reads the database back and fails if it finds one of its own left standing, and the twelve that development was already carrying were abandoned with a reason.",
  },

  /*
   * A repair, and it repairs something 0032 broke the same day.
   */
  {
    file: "0034_a_mistyped_suppression_is_marked.sql", appliedBy: "apply_migration",
    fingerprint: "a818bfb40dd9423d0b0b76472c35519c",
    proves: { table: "eng_marketing_suppressions", column: "voided_at" },
    production: "2026-09-09",
    because:
      "Same branch and the same ruled sequence as 0030 through 0033: pending until merge. Applied to development 2026-09-09 and read back rather than assumed: fingerprint a818bfb40dd9423d0b0b76472c35519c across 998 columns and 73 eng_ tables, the three new columns being the whole of the change from 995.",
    note:
      "0032 RULED A CONSENT RECORD UNDELETABLE AND BROKE A SHIPPED SCREEN IN THE SAME BREATH. /portal/suppressions has a Remove action for exactly one case, an operator taking a request on the telephone and typing the address wrong, and removeOperatorEntry implemented it as a DELETE. Verified rather than reasoned about: with the service role on development, removing an operator entered suppression answered 'eng_marketing_suppressions rows cannot be deleted. It is a money or consent record, and a correction is a new row rather than a removed one.' The person who took the call would have read that and had no way forward, and the customer they mistyped would have gone on hearing nothing. THE ANSWER IS NOT TO PUT THE DELETE BACK, and what replaces it is better than what was there: a deleted typo left NO TRACE that anybody had mistyped, so the address vanished and the mistake with it. The row now stays and gains voided_at, voided_because and voided_by; isSuppressed ignores a voided row, which is the single place anything asks the question, so the customer hears from the firm again. TWO CHECK CONSTRAINTS RATHER THAN TWO FILTERS. A row carrying a token_hash came from a person clicking the link in their own email, and voiding it would be the platform asserting a consent nobody gave: it is now UNREPRESENTABLE rather than refused, so a screen that forgot the filter cannot produce one. Proved both ways on development: the application refuses it with a sentence, and the same update sent straight at the database is refused by eng_marketing_suppressions_clicked_stays. A void with no reason is refused by the second constraint, because a row marked as a mistake with no reason cannot be told from one marked to move a number.",
  },

  /*
   * The other half of the correction: what the caller actually asked for.
   */
  {
    file: "0035_a_void_carries_the_address_that_was_meant.sql", appliedBy: "apply_migration",
    fingerprint: "7346d6b60e5a54d204d95ec51c217c3a",
    proves: { table: "eng_marketing_suppressions", column: "replaced_by_email" },
    production: "2026-09-09",
    because:
      "Same branch and the same ruled sequence as 0030 through 0034: pending until merge, then applied in order with each read back before the next. Applied to development 2026-09-09 and read back rather than assumed: fingerprint 7346d6b60e5a54d204d95ec51c217c3a across 1,000 columns and 73 eng_ tables, the two new columns being the whole of the change from 998.",
    note:
      "0034 WAS ONLY HALF THE JOB AND THE MISSING HALF LOST A REQUEST. Operator ruling at gate 2. Somebody rang the firm and asked not to be contacted, and the address was written down wrong. Voiding the wrong row un-suppresses an address that never asked for anything, which is right, and on its own it leaves the ORIGINAL REQUEST UNRECORDED: the person who rang goes on hearing from the firm and nothing anywhere says they asked not to. The void made the list accurate about a mistake and lost the fact the mistake was about, which is worse than the typo because the typo was visible. Every voided row now carries exactly one of replaced_by_email or no_replacement_because, enforced by a check constraint rather than by the screen, and the replacement is suppressed BEFORE the void so a failure leaves the list saying something wrong rather than saying nothing. Two more constraints: a replacement is lowercased like the address column itself, and a replacement cannot be the same address, because correcting a row to itself would un-suppress somebody and record that it meant to. IT ALSO BACKFILLS, AND THE BACKFILL IS THE HONEST PART. Rows voided between 0034 and this migration carry neither, and the constraint refused every one of them: applying it without a backfill fails outright, which was found by running it. It marks them as voided before there was anywhere to record what was meant, and it does NOT invent a replacement, because this platform cannot know which address was intended and a guess written into a consent record is worse than recording that the answer was never captured.",
  },

  /*
   * The customer side: somebody asked to be forgotten, and this is where that
   * is written down. It produces a task and never a deletion.
   */
  {
    file: "0036_a_deletion_request_is_a_record.sql", appliedBy: "apply_migration",
    fingerprint: "3acd988c07905602e0e091c5b8d329ad",
    proves: { table: "eng_deletion_requests" },
    production: "2026-09-09",
    because:
      "Same branch and the same ruled sequence as 0030 through 0035: pending until merge, then applied in order with each read back before the next. Applied to development 2026-09-09 and read back rather than assumed: fingerprint 3acd988c07905602e0e091c5b8d329ad across 1,015 columns and 74 eng_ tables, with 56 triggers and row level security on all 74.",
    note:
      "OPERATOR RULING: A DELETION REQUEST PRODUCES A TASK, NOT A DELETION. Nothing in this migration, in src/lib/deletion-requests.ts or on the screen connects a row here to a retention run; a person holding retention.execute plans a run against a table the declaration allows, and that is the only path a row is ever removed by. WHY A TABLE AND NOT JUST A TASK: a task is a thing somebody has to do and it has two states, open and done, while a deletion request is a thing somebody SAID, and what matters a year later is what they asked, when, through which door, who took it and what the firm answered. Closing a task records that somebody ticked it. THE OUTCOME IS DELIBERATELY NOT AN ENUM. Refused, actioned and partly actioned are each a decision about what the firm may do with an engineering record, and none of those decisions has been made: 41 tables in retention-policy.ts are waiting on counsel for exactly this question, and the published privacy policy already tells the public that engineering records are kept for the periods Texas requires. An enum shipped now would be this platform inventing the answer and then offering it on a screen, which is how a placeholder becomes a policy. So the answer is a sentence somebody wrote, with their name and the date on it. The one thing the firm can do immediately and without a ruling is stop writing to them, and recording a request suppresses the address in the same motion; the screen names all three outcomes including the one that has not happened, because a confirmation reading Request recorded would let the person who took the call believe the thing was done. The table refuses DELETE through the same function 0032 attached to the money and consent records, and it belongs with them: a platform that could quietly remove the record of a request is one where we never received that is unfalsifiable, which is worse for the person who asked than for the firm.",
  },

  /*
   * One address, one partner user, whatever the casing. Found by the
   * maybeSingle survey the operator ordered at gate 3.
   */
  {
    file: "0037_a_partner_address_is_one_address.sql", appliedBy: "apply_migration",
    fingerprint: "3acd988c07905602e0e091c5b8d329ad",
    proves: { table: "eng_partner_users" },
    production: "2026-09-09",
    because:
      "Same branch and the same ruled sequence as 0030 through 0036: pending until merge, then applied in order with each read back before the next. Applied to development 2026-09-09. THE FINGERPRINT IS UNCHANGED FROM 0036 and that is what an index-only migration should do: it adds no column, no table and no row, so the figure the fingerprint measures cannot see it. What it adds is read back directly instead, from pg_indexes: eng_partner_users_email_lower_key exists on lower(email). That makes it the fourth migration in this chain, after 0018, 0030 and 0032, whose correctness the fingerprint is blind to.",
    note:
      "A SCHEMA GAP RATHER THAN A CALL SITE. eng_partner_users.email was declared text not null unique, which in Postgres is CASE SENSITIVE, while every lookup against it is ilike, which is not. Two rows differing only in case were therefore permitted by the schema and were one address to every piece of code that read them. Two things followed and both were live: signing in matched two rows, PostgREST answered PGRST116, the error was discarded and the result read as no such address, so the person was refused with the deliberately generic message and had no way to discover why; and the one address, one partner guard in ops-partners-admin is a lookup and a refusal with nothing underneath it, so the same PGRST116 read as no existing user and the guard attached the address to a second partner. THE STATE IT EXISTS TO PREVENT WAS THE STATE THAT DEFEATED IT. The call sites are fixed in this branch and they are not the fix: ordering and limiting picks one of two rows that should never both have existed. eng_customer_users has carried exactly this since 0009 and the partner table simply never got it. IT REFUSES BY NAME rather than failing on a duplicate key error naming an index, because whoever read that would then have to write the query themselves to find out whose account it was about, and it does NOT merge: which sign in is the person is a decision about who somebody is, and a migration is not where that gets made. Both databases were read before it was written. Development holds 8 partner users and no such pair; production holds none at all.",
  },

  /*
   * THE FIRST ENTRY CARRYING BOTH FINGERPRINTS, which is the whole of debt two
   * arriving in the place it was always meant to land.
   */
  {
    file: "0038_a_job_says_what_it_was_allowed_to_do.sql", appliedBy: "apply_migration",
    fingerprint: "cac6f69d91b7e73441b307ea692a3f7b",
    behaviour: "b555b089052d225725c3d2ead29f3564",
    proves: { table: "eng_jobs", column: "effect_mode" },
    production: null,
    because:
      "Phase 12 Section 4 is open. Pending until the branch merges, then applied with the rest of the " +
      "section in order and each read back before the next, which is the ruled sequence. Applied to " +
      "development 2026-09-09 and read back: shape cac6f69d91b7e73441b307ea692a3f7b across 1,016 columns, and " +
      "behaviour b555b089052d225725c3d2ead29f3564 across 808 facts, both recomputed from a replay by " +
      "schema-ledger-audit rather than typed in from a live database.",
    note:
      "A JOB RECORDS WHETHER IT WAS ALLOWED TO REACH OUTSIDE THIS PLATFORM. Operator ruling: handlers that " +
      "send or charge run in a mode producing no external effect that says so in the trail row, and a handler " +
      "with no such mode gets one. WHY A COLUMN AND NOT A FLAG: an environment variable makes 'did this send " +
      "an email' a property of the process that ran the job, and processes leave no record. It is also the " +
      "shape that has now cost this project twice. On 2026-09-09 a retention dry run on development claimed " +
      "the oldest jobs of any kind and sent twenty real emails; later the same day the first version of " +
      "queue-audit did the same thing and sent thirty five, to the operator's own address and the firm's. " +
      "Both times a worker ran jobs nobody intended it to run, and nothing on those rows said what they were " +
      "permitted to do. WHY THE DEFAULT IS live: defaulting to suppression would make every job written by " +
      "every future caller silently do nothing outside, and a customer waiting for a link that a green board " +
      "says was sent is a worse failure than one email too many. Suppressing is the thing that has to be " +
      "asked for. eng_claim_jobs is `returns setof eng_jobs` so it carries the column with no change to the " +
      "function, which is stated in the migration because the next reader will look for that change and " +
      "there is not one. NOT A DRY RUN: retention.sweep already has a mode, plan versus execute, and that one " +
      "decides whether rows are deleted while this one decides whether a person hears anything. A sweep can " +
      "be executing and suppressed at once and both are true.",
  },

  /*
   * The four foreign keys the second fingerprint found on its first run, three
   * days after the fingerprint that could not see them said the databases
   * agreed.
   */
  {
    file: "0039_the_four_keys_that_were_never_there.sql", appliedBy: "apply_migration",
    fingerprint: "cac6f69d91b7e73441b307ea692a3f7b",
    behaviour: "b555b089052d225725c3d2ead29f3564",
    proves: { table: "eng_responsible_charge_log" },
    production: null,
    because:
      "Phase 12 Section 4 is open. Pending until the branch merges, then applied with the rest of the " +
      "section in order and each read back before the next. Applied to development 2026-09-09. BOTH " +
      "FINGERPRINTS ARE IDENTICAL TO 0038 ON THE REPLAY, and that is what this migration should do there: " +
      "the replay applies 0001, which already declares all four keys, so against an empty database 0039 " +
      "re-adds constraints that were never missing and validates all four because there are no rows to " +
      "check. The figure it moves is on the LIVE databases, which is where the keys were absent, and those " +
      "numbers are in BEHAVIOUR_BASELINE: development went from 802 facts to 808.",
    note:
      "NOT VALID IS THE POINT OF THIS MIGRATION RATHER THAN A DETAIL OF IT. Operator ruling: no regulatory " +
      "row is edited to make a constraint fit. Development holds 28 eng_responsible_charge_log rows whose " +
      "file_id all point at files that no longer exist, and they are the missing constraint's own residue: " +
      "audits delete their fixture files, ON DELETE SET NULL was never there to blank the link, and the rows " +
      "kept a uuid to nothing. The obvious repair is to null those 28 and validate, and it is refused, " +
      "because blanking a column on a responsible charge entry to suit a migration is editing the firm's " +
      "regulatory record, and that these particular rows happen to be audit residue is not something a " +
      "migration can know. So all four go on NOT VALID, which enforces them for every new row and never " +
      "re-examines the old ones, and each is validated only where validation passes. WHAT THAT BUYS: the " +
      "future completely, including ON DELETE RESTRICT refusing to remove an engineer named by any entry, " +
      "old rows included, because that check runs against the REFERENCED side and does not care whether the " +
      "constraint was validated. WHAT IT DOES NOT BUY: the past, so the 28 keep their dangling file_id until " +
      "somebody decides, which is why they are named here rather than discovered later. READ BACK ON " +
      "DEVELOPMENT: 3 of 4 convalidated, eng_responsible_charge_log_file_id_fkey false. Production holds 0 " +
      "rows in both tables and will validate all four.",
  },

  /*
   * The repository catching up to production, and a door being closed.
   */
  {
    file: "0040_the_repository_catches_up_to_production.sql", appliedBy: "apply_migration",
    fingerprint: "cac6f69d91b7e73441b307ea692a3f7b",
    behaviour: "7acbb5b22f11220b4a36f535fab9e09c",
    proves: { table: "eng_role_grants" },
    production: null,
    because:
      "Phase 12 Section 4 is open. Pending until the branch merges, then applied in order with each read " +
      "back before the next. Applied to development 2026-09-09. THE SHAPE IS UNCHANGED and that is what both " +
      "halves should do: eight indexes and one delete add no column and no table. The behaviour fingerprint " +
      "moves from 808 facts to 814, which is eight indexes in and two grant rows out.",
    note:
      "TWO GATE 1 RULINGS, AND BOTH CAME OUT OF THE SECOND FINGERPRINT'S FIRST RUN. (1) THE EIGHT INDEXES. " +
      "0000_eng_legacy_intake.sql is a RECONSTRUCTION of five tables that were created directly against the " +
      "shared project before this repository kept migrations, and it copied the columns, copied the " +
      "constraints and copied ZERO indexes. So production has carried eight since before this repository " +
      "existed and the migrations have never produced one. The divergence first read as production carrying " +
      "something mysterious; it is the repository missing what production has always had, which points the " +
      "other way entirely. Operator ruling: the repository catches up, because dropping an index on " +
      "production to make a number match is editing the thing being described to suit the description. They " +
      "are reproduced exactly as pg_indexes reports them and every one is `if not exists`, so this is a no-op " +
      "against production and a repair everywhere else. (2) files.assign IS REMOVED. Declared in " +
      "ops-authz.ts, seeded to admin and dispatcher by 0018, and never read by one call site. Found while " +
      "reconciling the prototype's bulk Assign button against the code. Refused outright because of where it " +
      "leads: nothing here assigns a file to an engineer, an engineer ACCEPTS one, and that acceptance IS the " +
      "responsible charge entry. A declared capability nothing uses is a door waiting for somebody to build " +
      "on, and the room behind this one is where an administrator's click puts a Professional Engineer in " +
      "responsible charge of work they have never seen. 0018 IS NOT EDITED; the removal is a new statement, " +
      "and roles-audit had to learn that the chain's NET effect is what a database holds rather than its " +
      "inserts alone.",
  },
  /*
   * 0041, THE DAY THE REGISTRATION ISSUED.
   *
   * TBPELS issued F-29811 to 254 Services LLC on 2026-09-10, active, expiring
   * 2027-07-31. The operator's ruling that day made the number a condition of
   * the compliance gate in three places: the public footer of all three sites,
   * every email footer, and the sealed document upload record. The first two
   * are rendered from configuration and needed no schema. This is the third.
   *
   * ONE COLUMN, NULLABLE, AND THE NULL IS THE POINT. Every document already
   * filed was filed before any registration existed, so null is true of them
   * and a backfill would invent a fact. What holds the rule going forward is
   * recordDocument, which writes the active registration on every insert, and
   * compliance-audit, which asserts it does.
   */
  {
    file: "0041_a_filed_document_says_which_registration.sql", appliedBy: "apply_migration",
    fingerprint: "1a11138f01f9be2f66251640cfb55b70",
    behaviour: "7acbb5b22f11220b4a36f535fab9e09c",
    proves: { column: { table: "eng_documents", name: "firm_registration" } },
    production: null,
    because:
      "Phase 12 Section 4 is open and the cutover to the new project is being planned ahead of Section 6, " +
      "so this is pending on BOTH counts. Applied to development 2026-09-10 through apply_migration and read " +
      "back. One column added, so the shape moves from 1016 columns to 1017 and the fingerprint from " +
      "cac6f69d91b7e73441b307ea692a3f7b to 1a11138f01f9be2f66251640cfb55b70. THE BEHAVIOUR FINGERPRINT DOES " +
      "NOT MOVE, and that is the check working rather than a copied value: 814 facts before and 814 after. A " +
      "nullable column with a comment adds no constraint, no trigger, no function, no index, no policy and no " +
      "seeded row, so a behaviour figure that HAD moved would mean this migration did something it does not say.",
    note:
      "THE CUTOVER HAS TO CARRY THIS ONE. The new project qmvcqvkywmkogxbyzsaz holds the schema at 0023, so " +
      "0024 through 0041 all replay into it, and 0041 is simply the last of them rather than a special case. " +
      "It is called out here because it was written the same day the cutover reopened, and a migration " +
      "written during a cutover is the one most likely to be applied to the old target out of habit. " +
      "docs/production-cutover-plan.md names it in the replay step.",
  },
];

/**
 * WHAT THE SECOND FINGERPRINT FOUND ON ITS FIRST RUN.
 *
 * Phase 12 Section 4, Section 0, debt two, 2026-09-09. Three databases were
 * read at 0037 with both fingerprints. The first says they are the same
 * database. The second says they are three different databases.
 *
 *   replay        shape 3acd988c07905602e0e091c5b8d329ad / 1,015 columns
 *                 behaviour ea9d415b52c7693917fcf3a61b7aa690 / 806 facts
 *   development   shape 3acd988c07905602e0e091c5b8d329ad / 1,015 columns
 *                 behaviour ba3d0d8e016e59215e94090e73628981 / 802 facts
 *   production    shape 3acd988c07905602e0e091c5b8d329ad / 1,015 columns
 *                 behaviour 0006d52251d7b3207ea76a5d6ac5d2ba / 810 facts
 *
 * Identical shape, three behaviours. That is the whole argument for the second
 * fingerprint, made by the second fingerprint, on the day it was written.
 *
 * The divergences are declared below rather than described in prose, because a
 * record is not a check and schema-ledger-audit reads this.
 */
export const BEHAVIOUR_BASELINE = {
  at: "0037_a_partner_address_is_one_address.sql",
  read: "2026-09-10",
  shape: "3acd988c07905602e0e091c5b8d329ad",
  shapeColumns: 1015,
  /*
   * The replay's number is the only one this repository can recompute without a
   * credential, so it is the only one schema-ledger-audit asserts. It is pinned
   * at 0037 and stays there: it is a statement about a MOMENT in the chain, and
   * a number re-read after every migration would be a number nobody could use
   * to say anything happened.
   *
   * THE LIVE NUMBERS SAY WHICH MIGRATION EACH DATABASE WAS AT.
   *
   * They have to, because the two are no longer at the same place: development
   * has 0038 and 0039 and production has neither while the branch is open. A
   * recorded number with no position in the chain beside it is a number nobody
   * can reproduce, which is the failure this whole file exists to prevent.
   *
   * ALL THREE MOVED ON 2026-09-10 and none of the databases changed to make
   * them move. The fingerprint gained `convalidated`, because 0039 adds
   * constraints NOT VALID and enforced-but-unvalidated is a real state the
   * previous query could not see. Sharpening a fingerprint invalidates every
   * number taken with the blunt one, which is the cost, and it is paid once
   * rather than left as a figure that quietly means less than it says.
   */
  replay: { behaviour: "764ff4339fed2db9e74317ee19278950", facts: 806 },
  development: { at: "0039", behaviour: "5f280ac447c28562407ed1969071c403", facts: 808 },
  production: { at: "0037", behaviour: "05f058a1c8f4c9f4e19546179482adfb", facts: 810 },
};

export const BEHAVIOUR_DIVERGENCE = [
  {
    kind: "missing_on_both_live_databases",
    repairedBy: "0039_the_four_keys_that_were_never_there.sql",
    what: "four foreign keys that 0001_ops_foundation.sql declares",
    facts: [
      "eng_file_events.actor_id -> eng_profiles(id) on delete set null",
      "eng_responsible_charge_log.engineer_id -> eng_profiles(id) on delete restrict",
      "eng_responsible_charge_log.file_id -> eng_files(id) on delete set null",
      "eng_responsible_charge_log.document_id -> eng_documents(id) on delete set null",
    ],
    because:
      "0001 spent a month unable to apply to an empty database while both live projects held the objects it " +
      "failed to create, which is already written down in CLAUDE.md as the reason migration-audit exists. This " +
      "is the residue of that: both live databases carry hand made versions of these two tables, the COLUMNS " +
      "match so the first fingerprint has always said they agree, and the constraints were never there. It has " +
      "been true since before the two projects were split and nothing could see it until now.",
    costs:
      "The sharpest is eng_responsible_charge_log.engineer_id. That table is the firm's record of which " +
      "engineer was in responsible charge of what, it is a regulatory record, and RESTRICT is what stops an " +
      "engineer being removed while entries name them. Neither live database refuses that today: the entry " +
      "would keep a uuid pointing at nothing, and the record would say responsible charge was held by somebody " +
      "the database can no longer name. eng_file_events.actor_id is the same shape and lower stakes: a file's " +
      "history would keep an actor id that resolves to nobody.",
    orphans:
      "Both databases were read before this was written, because adding a foreign key fails outright against a " +
      "row that would violate it. PRODUCTION: eng_responsible_charge_log holds 0 rows and eng_file_events holds " +
      "0 rows, so all four constraints would apply cleanly today and cost nothing. DEVELOPMENT: 28 " +
      "responsible charge rows, every engineer_id and document_id resolving, and ALL 28 file_id values " +
      "pointing at files that no longer exist. Those 28 are the missing constraint's own residue: audits " +
      "delete their fixture files, ON DELETE SET NULL was never there to blank the link, and the rows kept a " +
      "uuid to nothing. Development needs those 28 file_id values set null before the constraint can be added; " +
      "production needs nothing.",
    ruling:
      "RULED AND REPAIRED, 2026-09-09: 0039, now. All four go on NOT VALID, which enforces them for every "  +
      "new row and never re-examines the old ones, and each is then validated only where validation passes. "  +
      "NO REGULATORY ROW IS EDITED TO MAKE A CONSTRAINT FIT. On development 3 of 4 validated and "  +
      "eng_responsible_charge_log_file_id_fkey did not: it is in place, enforced, and unvalidated, and the 28 "  +
      "rows are exactly as they were. Production holds no rows in either table, so all four will validate "  +
      "clean there. APPLIED TO DEVELOPMENT 2026-09-09 AND PENDING ON PRODUCTION while this branch is open, "  +
      "which is the ruled sequence for every migration in this section.",
  },
  {
    kind: "extra_on_production_only",
    /*
     * RESOLVED BY 0040. Kept rather than deleted, because a divergence that
     * vanishes without a trace looks like one nobody ever found, and the next
     * reader meeting eight indexes in 0040 with no explanation would have to
     * work out why they are there.
     */
    resolvedBy: "0040_the_repository_catches_up_to_production.sql",
    what: "eight indexes production had and no migration created, until 0040",
    facts: [
      "eng_applications_site_created_idx",
      "eng_applications_site_role_created_idx",
      "eng_leads_site_created_idx",
      "eng_leads_utm_campaign_idx",
      "eng_onboardings_site_status_idx",
      "eng_onboardings_created_idx",
      "eng_onboarding_items_onboarding_idx",
      "eng_orders_site_created_idx",
    ],
    because:
      "FOUND, AND IT IS NOT ANONYMOUS DRIFT. Operator ruling: an index nobody's migration created is drift "  +
      "with an author, so say who. The author is 0000_eng_legacy_intake.sql, by omission. That file is a "  +
      "RECONSTRUCTION of five tables that were created directly against the shared project before this repo "  +
      "kept migrations, and its own header says so: eng_leads, eng_orders, eng_applications, eng_onboardings "  +
      "and eng_onboarding_items. Every one of the eight indexes is on one of those five. The reconstruction "  +
      "copied the columns and the constraints and copied ZERO indexes: `grep -c 'create index' 0000` "  +
      "returns 0. Six of the eight lead on `site`, which is the multi brand discriminator from that era and "  +
      "is why they were built in the first place. So production is not carrying something mysterious. The "  +
      "REPOSITORY is missing something production has always had, and the divergence points the other way "  +
      "from how it first read.",
    costs:
      "An index changes speed and not answers, so nothing production does is wrong because of these. What is " +
      "wrong is the belief that the cutover project is production's equal: it would be built from the " +
      "migrations and would not have them, and the first slow query after a cutover would be a surprise " +
      "nobody had a record of. That is the cost, and it is a cost of not knowing rather than of the indexes.",
    ruling:
      "Left alone and declared, 2026-09-09: dropping an index on production to make a number match is the "  +
      "wrong direction, because the number is a description and production is the thing being described. "  +
      "What the provenance changes is what the FIX would be if one is wanted: not dropping eight indexes but "  +
      "adding them to the repository, so a project built from the migrations is production's equal rather "  +
      "than production minus whatever nobody wrote down. That is a migration and it is not written here, "  +
      "because the ruling was to declare rather than to converge and converging is a separate decision.",
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
