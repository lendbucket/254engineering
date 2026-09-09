import "server-only";

/**
 * WHAT THE FIRM KEEPS, FOR HOW LONG, AND WHO SAID SO.
 *
 * Phase 12 Section 3. One declaration for all 74 `eng_` tables. A table missing
 * from it fails the board; a table declared here that is not in the schema fails
 * the board. Same idiom as `scripts/lib/surfaces.mjs` and `supabase/applied.mjs`
 * and for the same reason: a list nothing reads is a list that stops being true
 * without telling anybody.
 *
 * THE REPOSITORY STATES NO RETENTION PERIOD FOR ANY RECORD, AND THAT IS THE
 * MOST IMPORTANT LINE IN THIS FILE
 * ------------------------------------------------------------------------
 * Searched and reported at gate 0, 2026-09-09. Not the customer terms, not the
 * partner agreement, not the employment agreement, not one of the five TBPELS
 * and Occupations Code citations in `src/content/insights.ts`. The privacy
 * policy is the only place retention is addressed at all, and what it publishes
 * is a POINTER rather than a period:
 *
 *   "Records relating to engineering work, once the firm is performing it, are
 *    retained for the periods required of a registered engineering firm in
 *    Texas. Those obligations sit above a deletion request, and this policy
 *    does not promise otherwise."
 *
 * The firm has therefore already told the public that engineering records are
 * kept as long as Texas requires, and this repository cannot say how long that
 * is. **A floor set below it would make a published privacy policy false.**
 *
 * The one "ten years" anywhere in the repository is a design rationale in
 * BACKLOG.md about the responsible charge log outliving an engineer's
 * employment. It cites no rule. **It is not evidence of a period and must not
 * be used as one.**
 *
 * SO THE DELETION SCOPE OF THIS SECTION IS TELEMETRY ONLY
 * -------------------------------------------------------
 * Operator ruling, 2026-09-09. Every table holding a business record is
 * `kept_pending_counsel`, which retention treats exactly as kept forever until
 * the operator replaces the line. The question is with counsel and TBPELS.
 *
 * Exactly two tables have a real floor, and both are machine telemetry that
 * grows from the clock rather than from the firm.
 *
 * THE COUNT, AND WHAT MOVED
 * -------------------------
 * 74 tables: 41 kept pending counsel, 23 kept forever, 8 not a record, 2
 * deletable. Three entries changed after gate 0 and all three are recorded
 * rather than silently different. `eng_deletion_requests` is new, added by 0036
 * as the customer side of this section: somebody asking to be forgotten is
 * recorded, and the record of the asking is one of the things that can never be
 * removed. `eng_retention_runs` is new, added by 0031 as the manifest
 * retention writes before it takes anything, and it is kept forever because a
 * run that could age out its own manifests has a floor on its own history.
 * `eng_evidence_items` moved from kept_pending_counsel to kept_forever when
 * retention-audit compared this declaration against the operator ruling it pins
 * as a literal: the evidence of a SEALED file is kept forever, this table holds
 * the evidence of every file, and nothing in its shape tells the two apart. The
 * stricter rule takes the whole table.
 */

/**
 * How a table is treated. Three states and no fourth, which is the same
 * discipline the reports module applies to a figure.
 */
export type RetentionRule =
  /**
   * Never deleted by anything, ever. Either the database already refuses, or a
   * ruling says so. `because` says which.
   */
  | { kind: "kept_forever"; because: string; ruledBy: string }
  /**
   * Kept, and the period is a business ruling nobody has made yet. Retention
   * treats this identically to kept_forever. It is a separate state so that the
   * declaration says out loud which lines are waiting on an answer rather than
   * settled, and so a check can count them.
   */
  | { kind: "kept_pending_counsel"; because: string }
  /**
   * Deleted after `floorDays` of age, measured on `ageColumn`.
   *
   * `rollupRequired` names the metric that must exist and reconcile for a day
   * before any row of that day may be deleted. A source is never deleted before
   * the thing that replaces it exists.
   */
  | {
      kind: "delete_after";
      floorDays: number;
      ageColumn: string;
      because: string;
      ruledBy: string;
      rollupRequired: string | null;
      /** Rows matching this are never aged out whatever their age. */
      neverDelete?: { column: string; values: string[]; because: string };
    }
  /**
   * Not retention's business at all: configuration, catalogue, or a table whose
   * rows are the platform's own definition of itself rather than a record of
   * anything that happened.
   */
  | { kind: "not_a_record"; because: string };

export type RetentionEntry = { table: string; rule: RetentionRule };

const COUNSEL =
  "Holds a business record. The repository states no Texas retention period and the privacy policy " +
  "has already promised the public that engineering records are kept for as long as Texas requires, " +
  "so any floor set here could make a published policy false. Operator ruling 2026-09-09: kept until " +
  "counsel and TBPELS answer.";

const REFUSES_DELETE = (fn: string) =>
  `The database refuses DELETE on this table through ${fn}. Proved rather than read: attempting one ` +
  `with the service role, the most privileged credential this platform has, returns "append only. ` +
  `DELETE is not permitted on it." and loses no rows. Retention cannot touch it whatever this file says.`;

/**
 * A REFERENCE POINTS ONE WAY, AND SO DOES THE PROTECTION IT GIVES.
 *
 * ON DELETE RESTRICT on an OUTBOUND foreign key keeps the table it points AT.
 * It gives the table holding the column nothing. Three entries in this file
 * cited an outbound key as the reason they were kept forever, which read as a
 * database guarantee and was a sentence about a different table.
 *
 * Kept as its own helper rather than folded into prose so the mistake has a
 * name, and so a search for it finds every instance.
 */
const OUTBOUND_ONLY = (what: string) =>
  `KEPT BY THIS RULING, NOT BY THE DATABASE, AND THE FIRST VERSION OF THIS LINE SAID OTHERWISE. It ` +
  `claimed to be kept forever by the foreign keys, citing that ${what}. That sentence is true and it ` +
  `is about the WRONG TABLE: an outbound reference with ON DELETE RESTRICT protects the table it ` +
  `POINTS AT, so it keeps eng_profiles and does nothing to stop a row HERE being deleted. Read ` +
  `against pg_constraint on 2026-09-09, this table has no delete trigger and nothing references it ` +
  `with RESTRICT: the database would allow every row to go. It is kept because it records money, or ` +
  `time somebody is paid for, and this ruling is the only thing keeping it. migration-audit checks ` +
  `the claim against the replayed catalogue now, in the direction the claim is actually made.`;

/**
 * WHAT 0032 PUT UNDERNEATH THE PROMISE.
 *
 * Five tables were declared kept forever and held by nothing but this file.
 * Three of them said in writing that a foreign key kept them, citing a key
 * that protects a different table. 0032 attached a real refusal, so the
 * sentence and the schema now say the same thing, and migration-audit
 * compares the function named here against the trigger actually attached.
 */
const REFUSES_RECORD_DELETE =
  'The database refuses DELETE on this table through eng_forbid_record_delete, added by 0032. ' +
  'Proved rather than read: attempting one with the service role, the most privileged credential ' +
  'this platform has, is refused and loses no rows. A correction here is a new row rather than a ' +
  'removed one, which is the rule eng_order_payments has carried since 0006.';

/**
 * AND THE NARROWER ONE, FOR ROWS THAT ARE NOT ALL IN THE SAME POSITION.
 *
 * eng_forbid_sealed_work_delete refuses a sealed deliverable, and anything
 * belonging to a file that has one, including a delete cascading from
 * eng_files. Evidence on an UNSEALED file is untouched, because that
 * question is still with counsel and a blanket refusal would have answered
 * it by accident.
 *
 * IT REFUSES NOTHING TODAY. Registration is pending, no licensed PE is on
 * staff, and nothing in this platform is sealed or can be, so every row in
 * both tables is deletable right now and stops being deletable the moment a
 * sealed deliverable is uploaded against its file. It is proved inside
 * migration-audit's replayed database, which is thrown away, because proving
 * it live would mean writing a fabricated sealing record.
 */
const REFUSES_SEALED_DELETE =
  'The database refuses DELETE on this table through eng_forbid_sealed_work_delete, added by 0032, ' +
  'for a sealed deliverable and for every row belonging to a file that has one, cascade included. ' +
  'Rows on an unsealed file are not refused, because that question is with counsel.';

const RESTRICTED = (what: string) =>
  `Kept forever by the FOREIGN KEYS rather than by a ruling: ${what}. The schema already decided this, ` +
  `and the declaration says the same thing so the two cannot drift apart.`;

/**
 * THE DECLARATION. Every table in the schema, in alphabetical order.
 *
 * Alphabetical rather than grouped, because a group is a judgement and this list
 * has to be diffable against `information_schema` without anybody deciding
 * where a new table belongs.
 */
export const RETENTION_POLICY: RetentionEntry[] = [
  { table: "eng_account_api_keys", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_account_api_requests",
    rule: {
      kind: "kept_pending_counsel",
      because:
        "Telemetry in shape, but it is the evidence behind a rate limit dispute with a paying account, " +
        "which makes it a business record. " + COUNSEL,
    },
  },
  { table: "eng_account_properties", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_alert_state",
    rule: {
      kind: "not_a_record",
      because:
        "One row per thing that can alert and the last time it did. It is a cooldown, not a history: " +
        "deleting a row makes the next alert fire early and nothing else. 0023 argues this at length.",
    },
  },
  { table: "eng_applications", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_assignments", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_audit_events",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_DELETE("eng_forbid_mutation") +
        " Operator ruling 2026-09-09: kept forever because that is what an audit trail IS. Its growth " +
        "is bounded by paging its readers, which was Section 1's work, and NOBODY SHOULD EXPECT " +
        "RETENTION TO BOUND IT. On production it grows at about 2,309 rows a month with the firm not " +
        "yet trading.",
      ruledBy: "operator, 2026-09-09",
    },
  },
  {
    table: "eng_auth_tokens",
    rule: {
      kind: "kept_pending_counsel",
      because:
        "Expired sign in tokens look like pure telemetry and are the evidence of who was invited and " +
        "when. " + COUNSEL,
    },
  },
  {
    table: "eng_certification_attempts",
    rule: {
      kind: "kept_forever",
      because: REFUSES_DELETE("eng_forbid_mutation_allow_cascade") + " It goes only when the person does.",
      ruledBy: "0003, and the trigger",
    },
  },
  { table: "eng_certifications", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_clients",
    rule: {
      kind: "kept_forever",
      because: RESTRICTED("eng_files references a client with ON DELETE RESTRICT, so a client with any file cannot be removed"),
      ruledBy: "the schema, confirmed by the operator 2026-09-09",
    },
  },
  { table: "eng_contacts", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_credentials", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_cron_runs",
    rule: {
      kind: "delete_after",
      floorDays: 30,
      ageColumn: "started_at",
      because:
        "THE ONE TABLE IN THIS SCHEMA WITH A REAL FLOOR, AND THE ONLY ONE WHOSE GROWTH DOES NOT DEPEND " +
        "ON THE FIRM. Measured on production over 4.46 days with no trading at all: 51,878 rows a " +
        "month, from empty to a thousand in about fourteen hours. A firm doing one file a month and a " +
        "firm doing a thousand produce the same cron history. It is read in exactly one place, as the " +
        "most recent 500 runs, and nothing aggregates it, which is why the rollup below had to be " +
        "built before a floor could exist.",
      ruledBy: "operator, 2026-09-09",
      rollupRequired: "cron.runs",
    },
  },
  { table: "eng_customer_access", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_customer_accounts", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_customer_auth_tokens", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_customer_users", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_deletion_requests",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_RECORD_DELETE +
        " AND THE IRONY IS THE POINT. This is the record of somebody asking to be forgotten, and it " +
        "is one of the tables that can never be removed. Deleting it would mean the firm could not " +
        "show what it was asked or what it answered, so 'we never received that' would be " +
        "unfalsifiable, which is worse for the person who asked than for the firm. The request " +
        "outlives whatever is decided about the records it concerns, and it says so on the screen " +
        "that takes it rather than only here.",
      ruledBy: "operator, 2026-09-09, and 0036",
    },
  },
  {
    table: "eng_documents",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_SEALED_DELETE +
        " A sealed deliverable and the evidence binder of a sealed file are kept with the file." +
        " Operator ruling: a sealed file is retained forever by default, and if a floor is ever set" +
        " for one it is set on the advice of counsel with that advice recorded as its reason.",
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
  { table: "eng_error_events", rule: { kind: "kept_pending_counsel", because: "Telemetry in shape. A floor is defensible and none has been ruled, and this section's scope is the two tables below. " + COUNSEL } },
  { table: "eng_error_types", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_evidence_items",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_SEALED_DELETE +
        " THE RULING IS ABOUT ROWS AND THIS DECLARATION IS ABOUT TABLES, SO THE STRICTER RULE TAKES " +
        "THE " +
        "WHOLE TABLE. The operator ruled that sealed documents and the evidence binders of sealed files " +
        "are kept forever with no configuration able to shorten them. This table holds the evidence for " +
        "every file, sealed and unsealed alike, and nothing in its shape tells the two apart without " +
        "joining to the file and asking what happened to it. A rule that said kept_pending_counsel here " +
        "would be a table whose eventual floor silently included evidence the operator ruled untouchable, " +
        "and the join that was supposed to protect it would be one query somebody wrote wrong.\n\n" +
        "It was declared kept_pending_counsel until retention-audit compared the declaration against the " +
        "ruling pinned in the audit as a literal and disagreed. Nothing could have been deleted either " +
        "way, because retention treats the two states identically, so this is a record made accurate " +
        "rather than a deletion prevented. That is exactly the value of pinning a ruling somewhere the " +
        "file under test cannot reach. 0032 then put a trigger underneath the sealed half of it, so " +
        "the declaration and the schema say the same thing about the rows the ruling is actually " +
        "about.",
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
  {
    table: "eng_fee_schedule",
    rule: { kind: "not_a_record", because: "The price list. Configuration the firm sets, not a record of anything that happened." },
  },
  {
    table: "eng_file_events",
    rule: {
      kind: "kept_forever",
      because: REFUSES_DELETE("eng_forbid_mutation_allow_cascade") + " It goes only when its file does.",
      ruledBy: "0001, and the trigger",
    },
  },
  { table: "eng_file_inputs", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_files", rule: { kind: "kept_pending_counsel", because: "The central record of the firm's work. " + COUNSEL } },
  {
    table: "eng_jobs",
    rule: {
      kind: "delete_after",
      floorDays: 30,
      ageColumn: "finished_at",
      because:
        "Completed queue rows only. Measured on production: 8,675 rows a month, and 1,290 of the 1,290 " +
        "rows there are done. A done job older than a month is a log line.",
      ruledBy: "operator, 2026-09-09",
      rollupRequired: "jobs.completed",
      neverDelete: {
        column: "status",
        values: ["pending", "running", "dead"],
        because:
          "Operator ruling: failed and pending rows are NEVER aged out by a timer. A pending job older " +
          "than the floor is a defect somebody has to see, and a dead one is the evidence of what " +
          "failed. Deleting either on a schedule destroys the thing the queue exists to make visible.",
      },
    },
  },
  { table: "eng_leads", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_marketing_suppressions",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_RECORD_DELETE +
        " NEVER EXPIRES. Operator ruling: a person who asked not to be contacted stays asked. A floor" +
        " here would mean the firm resumes writing to somebody because time passed, which is the one" +
        " thing this list exists to prevent, and the one outcome nobody can take back once an email" +
        " has gone.",
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
  { table: "eng_messages", rule: { kind: "kept_pending_counsel", because: "A file's thread is part of what the firm would produce about that file, and the binder now carries it. " + COUNSEL } },
  {
    table: "eng_metrics_daily",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_RECORD_DELETE +
        " THE ROLLUP THAT OUTLIVES ITS SOURCES. Deleting a rollup row would destroy the only" +
        " remaining record of a day whose source rows retention had already removed, which is the" +
        " exact inversion of the rule that a source may go only once its rollup exists. It is the one" +
        " table here that retention itself makes irreplaceable.",
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
  { table: "eng_mfa_enrolments", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_mfa_recovery_codes", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_notification_prefs",
    rule: { kind: "not_a_record", because: "One row per person saying how they want to be told things. Configuration." },
  },
  { table: "eng_notifications", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_onboarding_items", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_onboardings", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_order_batches", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_order_events",
    rule: {
      kind: "kept_forever",
      because: REFUSES_DELETE("eng_forbid_mutation_allow_cascade") + " It goes only when its order does.",
      ruledBy: "0006, and the trigger",
    },
  },
  { table: "eng_order_inputs", rule: { kind: "kept_pending_counsel", because: "Checkout evidence, written once. 0016 argues why it is not the same table as eng_file_inputs. " + COUNSEL } },
  {
    table: "eng_order_payments",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_DELETE("eng_forbid_payment_delete") +
        " Its own message is \"Record a refund instead\": money that moved is not a row somebody gets " +
        "to remove. Retention respects that rather than restating it.",
      ruledBy: "0006, and the trigger",
    },
  },
  { table: "eng_orders", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_partner_acceptances",
    rule: {
      kind: "kept_forever",
      because: REFUSES_DELETE("eng_forbid_mutation") + " It is the proof of which agreement version somebody accepted.",
      ruledBy: "0013, and the trigger",
    },
  },
  { table: "eng_partner_agreements", rule: { kind: "kept_forever", because: "An agreement whose text changed after acceptance is an agreement nobody can prove the terms of. 0013 says so and the acceptances above reference it.", ruledBy: "0013" } },
  {
    table: "eng_partner_asset_versions",
    rule: { kind: "kept_forever", because: REFUSES_DELETE("eng_forbid_mutation"), ruledBy: "0020, and the trigger" },
  },
  { table: "eng_partner_assets", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_partner_entries",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_DELETE("eng_forbid_partner_entry_delete") +
        " 0019 forbids removal outright: a partner ledger entry is what a payment is justified by.",
      ruledBy: "0019, and the trigger",
    },
  },
  { table: "eng_partner_statements", rule: { kind: "kept_pending_counsel", because: "What a partner was told they are owed. " + COUNSEL } },
  { table: "eng_partner_submissions", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_partner_terms", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_partner_tokens", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_partner_touches",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_DELETE("eng_forbid_mutation") +
        " 0014 keeps every touch INCLUDING the ones that lost, so a dispute can be settled by showing " +
        "a partner the touch that beat theirs. Evidence that can be deleted after the decision is not " +
        "evidence.",
      ruledBy: "0014, and the trigger",
    },
  },
  { table: "eng_partner_users", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_partners",
    rule: {
      kind: "kept_forever",
      because: RESTRICTED("eng_partner_touches, eng_partner_entries and eng_partner_statements all reference a partner with ON DELETE RESTRICT, so a partner who was ever touched cannot be removed"),
      ruledBy: "the schema, confirmed by the operator 2026-09-09",
    },
  },
  {
    table: "eng_production_ledger",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_RECORD_DELETE +
        " This is what an engineer is paid on. " +
        OUTBOUND_ONLY("it references eng_profiles with ON DELETE RESTRICT, so a person with earnings cannot be removed"),
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
  {
    table: "eng_profiles",
    rule: {
      kind: "kept_forever",
      because: RESTRICTED("eng_production_ledger, eng_tech_pay_ledger and eng_time_log all reference a profile with ON DELETE RESTRICT, so a person with earnings or logged time cannot be removed"),
      ruledBy: "the schema, confirmed by the operator 2026-09-09",
    },
  },
  { table: "eng_protocol_items", rule: { kind: "not_a_record", because: "Part of a protocol template. Configuration an engineer authors." } },
  { table: "eng_protocol_questions", rule: { kind: "not_a_record", because: "Part of a protocol template. Configuration an engineer authors." } },
  { table: "eng_protocol_templates", rule: { kind: "not_a_record", because: "What a service requires captured. Configuration an engineer authors, referenced by files with ON DELETE RESTRICT." } },
  { table: "eng_quote_requests", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_responsible_charge_log",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_DELETE("eng_forbid_mutation") +
        " THE KEPT FOREVER LIST NAMES THIS FIRST AND NO CONFIGURATION CAN SHORTEN IT. It is the record " +
        "an engineer's licence stands on and the artefact an enforcement action reads. Retention never " +
        "touches it, and retention-audit proves no path can, including a retention job run as admin.",
      ruledBy: "operator, standing law",
    },
  },
  {
    table: "eng_retention_runs",
    rule: {
      kind: "kept_forever",
      because:
        "THE RECORD OF WHAT RETENTION ITSELF DID, AND THE ONE TABLE WHERE THAT BEING DELETABLE WOULD " +
        "BE CIRCULAR. A retention run that could age out its own manifests is a retention run whose " +
        "history has a floor on it, and the whole reason the manifest is written before the rows go " +
        "is so that the account of a deletion outlives the deletion. The database refuses DELETE on " +
        "this table through eng_forbid_retention_run_delete, and that is proved rather than read: " +
        "attempting one with the service role, the most privileged credential this platform has, " +
        "returns \"eng_retention_runs rows cannot be deleted. A retention run that can erase its own " +
        "record is a retention run with no record.\" and loses no rows. " +
        "UPDATE is allowed and DELETE is not, because a run's progress, outcome and reconciliation " +
        "are all updates to the row that planned it, while a manifest disappearing is the failure " +
        "this table exists to make impossible.",
      ruledBy: "0031, and the trigger",
    },
  },
  { table: "eng_review_sessions", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_role_grants",
    rule: { kind: "not_a_record", because: "The permission matrix. Configuration, seeded by migrations and edited on the roles screen." },
  },
  { table: "eng_roles", rule: { kind: "not_a_record", because: "The roles themselves. Configuration, seeded by 0018." } },
  { table: "eng_service_orders", rule: { kind: "kept_pending_counsel", because: "An order that ever took money additionally cannot be deleted at all: eng_order_payments references it with ON DELETE RESTRICT and payments are kept forever. " + COUNSEL } },
  { table: "eng_statement_lines", rule: { kind: "kept_pending_counsel", because: "What a customer was billed, line by line. " + COUNSEL } },
  { table: "eng_statements", rule: { kind: "kept_pending_counsel", because: "What a customer was billed. " + COUNSEL } },
  { table: "eng_tasks", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_tech_pay_ledger",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_RECORD_DELETE +
        " This is what a technician is paid on. " +
        OUTBOUND_ONLY("it references eng_profiles with ON DELETE RESTRICT, so a person with earnings cannot be removed"),
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
  { table: "eng_thread_participants", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  { table: "eng_threads", rule: { kind: "kept_pending_counsel", because: COUNSEL } },
  {
    table: "eng_time_log",
    rule: {
      kind: "kept_forever",
      because:
        REFUSES_RECORD_DELETE +
        " These are the hours somebody is paid for. " +
        OUTBOUND_ONLY("it references eng_profiles with ON DELETE RESTRICT, so a person with logged time cannot be removed"),
      ruledBy: "operator, 2026-09-09, and 0032",
    },
  },
];

/** Every table the declaration names, for a check to compare against the schema. */
export const DECLARED_TABLES = RETENTION_POLICY.map((e) => e.table);

/** The entries retention may actually delete from. Exactly two today. */
export function deletableEntries(): RetentionEntry[] {
  return RETENTION_POLICY.filter((e) => e.rule.kind === "delete_after");
}

/**
 * Whether a table may ever be deleted from by retention.
 *
 * Everything that is not explicitly `delete_after` answers false, which is the
 * safe direction: a table added to the schema and forgotten here is refused by
 * the job AND fails the board, rather than being swept because nobody said not
 * to.
 */
export function mayDelete(table: string): boolean {
  const entry = RETENTION_POLICY.find((e) => e.table === table);
  return entry?.rule.kind === "delete_after";
}

/** The rule for a table, or null when the declaration does not name it. */
export function ruleFor(table: string): RetentionRule | null {
  return RETENTION_POLICY.find((e) => e.table === table)?.rule ?? null;
}
