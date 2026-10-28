/*
 * ===========================================================================
 * 0102: THE API ROLES HOLD NOTHING ON ANY eng_ TABLE OR SEQUENCE.
 * The chat's read of production, 2026-10-28 (issue #1 comments 6462860460
 * and 6462870632), and its five points for this bundle.
 * ===========================================================================
 *
 * WHAT WAS FOUND. This project's default privileges grant every new table
 * and every new sequence to anon and authenticated, and nothing in the chain
 * before 0098 revoked them. Every eng_ table has row level security on and no
 * policy, so neither role can read or write a row, and the sequence functions
 * are not exposed through the API. Nothing is reachable today. The protection
 * is row level security alone, with the grants left open behind it, so one
 * mistaken policy, or one public function that touches a sequence, would open
 * a table that should never have been granted.
 *
 * WHY NOTHING NEEDS THESE GRANTS. The platform reaches the database with the
 * service role and nothing else: there is no publishable or anon key anywhere
 * in src (src/lib/supabase.ts and src/lib/ops-session.ts say so in their own
 * comments, and a search of src finds no other client). The service role's own
 * grants are not touched by a revoke from public, anon and authenticated.
 *
 * EVERY OBJECT IS NAMED, AND THE NAMES COME FROM THE CHAIN. The 104 tables and
 * 13 sequences below are the eng_ relations a replay of 0000 to 0101 creates,
 * listed one by one. A dynamic loop over every eng_ name at apply time was
 * refused: the production project is shared with Wattsmith, and a statement
 * that decides its own subject at run time could reach an object nobody here
 * listed. The project's default privileges are NOT altered, for the same
 * reason: they are shared. migration-audit's revoke rule (from 0100) keeps
 * every new eng_ table and serial sequence revoked in its own file instead.
 *
 * NO DROP AND NO DELETE. Revokes only, and a read-back that refuses unless the
 * API roles hold nothing on any of these, and the service role still holds
 * what it held wherever it held anything.
 */

-- The 104 eng_ tables.
revoke all on eng_account_api_keys from public, anon, authenticated;
revoke all on eng_account_api_requests from public, anon, authenticated;
revoke all on eng_account_properties from public, anon, authenticated;
revoke all on eng_account_trade_prices from public, anon, authenticated;
revoke all on eng_alert_recipients from public, anon, authenticated;
revoke all on eng_alert_state from public, anon, authenticated;
revoke all on eng_applications from public, anon, authenticated;
revoke all on eng_assignments from public, anon, authenticated;
revoke all on eng_audit_events from public, anon, authenticated;
revoke all on eng_auth_tokens from public, anon, authenticated;
revoke all on eng_certification_attempts from public, anon, authenticated;
revoke all on eng_certifications from public, anon, authenticated;
revoke all on eng_checklist_exceptions from public, anon, authenticated;
revoke all on eng_clients from public, anon, authenticated;
revoke all on eng_contact_log from public, anon, authenticated;
revoke all on eng_contacts from public, anon, authenticated;
revoke all on eng_credentials from public, anon, authenticated;
revoke all on eng_cron_runs from public, anon, authenticated;
revoke all on eng_customer_access from public, anon, authenticated;
revoke all on eng_customer_accounts from public, anon, authenticated;
revoke all on eng_customer_auth_tokens from public, anon, authenticated;
revoke all on eng_customer_users from public, anon, authenticated;
revoke all on eng_deletion_requests from public, anon, authenticated;
revoke all on eng_design_inquiries from public, anon, authenticated;
revoke all on eng_determinations from public, anon, authenticated;
revoke all on eng_documents from public, anon, authenticated;
revoke all on eng_error_events from public, anon, authenticated;
revoke all on eng_error_types from public, anon, authenticated;
revoke all on eng_evidence_items from public, anon, authenticated;
revoke all on eng_fee_schedule from public, anon, authenticated;
revoke all on eng_file_events from public, anon, authenticated;
revoke all on eng_file_inputs from public, anon, authenticated;
revoke all on eng_files from public, anon, authenticated;
revoke all on eng_incidents from public, anon, authenticated;
revoke all on eng_insurance_alerts from public, anon, authenticated;
revoke all on eng_insurance_policies from public, anon, authenticated;
revoke all on eng_job_capture_additions from public, anon, authenticated;
revoke all on eng_job_triage from public, anon, authenticated;
revoke all on eng_jobs from public, anon, authenticated;
revoke all on eng_leads from public, anon, authenticated;
revoke all on eng_letter_facts from public, anon, authenticated;
revoke all on eng_marketing_suppressions from public, anon, authenticated;
revoke all on eng_messages from public, anon, authenticated;
revoke all on eng_metrics_daily from public, anon, authenticated;
revoke all on eng_mfa_enrolments from public, anon, authenticated;
revoke all on eng_mfa_recovery_codes from public, anon, authenticated;
revoke all on eng_notification_prefs from public, anon, authenticated;
revoke all on eng_notifications from public, anon, authenticated;
revoke all on eng_onboarding_items from public, anon, authenticated;
revoke all on eng_onboardings from public, anon, authenticated;
revoke all on eng_order_batches from public, anon, authenticated;
revoke all on eng_order_events from public, anon, authenticated;
revoke all on eng_order_inputs from public, anon, authenticated;
revoke all on eng_order_payments from public, anon, authenticated;
revoke all on eng_orders from public, anon, authenticated;
revoke all on eng_partner_acceptances from public, anon, authenticated;
revoke all on eng_partner_agreements from public, anon, authenticated;
revoke all on eng_partner_asset_versions from public, anon, authenticated;
revoke all on eng_partner_assets from public, anon, authenticated;
revoke all on eng_partner_billing from public, anon, authenticated;
revoke all on eng_partner_billing_events from public, anon, authenticated;
revoke all on eng_partner_entries from public, anon, authenticated;
revoke all on eng_partner_statements from public, anon, authenticated;
revoke all on eng_partner_submissions from public, anon, authenticated;
revoke all on eng_partner_terms from public, anon, authenticated;
revoke all on eng_partner_tokens from public, anon, authenticated;
revoke all on eng_partner_touches from public, anon, authenticated;
revoke all on eng_partner_users from public, anon, authenticated;
revoke all on eng_partners from public, anon, authenticated;
revoke all on eng_payment_events from public, anon, authenticated;
revoke all on eng_production_ledger from public, anon, authenticated;
revoke all on eng_profiles from public, anon, authenticated;
revoke all on eng_prospects from public, anon, authenticated;
revoke all on eng_protocol_items from public, anon, authenticated;
revoke all on eng_protocol_questions from public, anon, authenticated;
revoke all on eng_protocol_templates from public, anon, authenticated;
revoke all on eng_quote_files from public, anon, authenticated;
revoke all on eng_quote_requests from public, anon, authenticated;
revoke all on eng_refund_approval_limits from public, anon, authenticated;
revoke all on eng_refund_decisions from public, anon, authenticated;
revoke all on eng_refund_requests from public, anon, authenticated;
revoke all on eng_repair_items from public, anon, authenticated;
revoke all on eng_responsible_charge_log from public, anon, authenticated;
revoke all on eng_retention_runs from public, anon, authenticated;
revoke all on eng_review_sessions from public, anon, authenticated;
revoke all on eng_role_grants from public, anon, authenticated;
revoke all on eng_roles from public, anon, authenticated;
revoke all on eng_scope_addenda from public, anon, authenticated;
revoke all on eng_seal_acts from public, anon, authenticated;
revoke all on eng_seal_images from public, anon, authenticated;
revoke all on eng_service_orders from public, anon, authenticated;
revoke all on eng_sign_in_attempts from public, anon, authenticated;
revoke all on eng_site_order_requests from public, anon, authenticated;
revoke all on eng_statement_lines from public, anon, authenticated;
revoke all on eng_statements from public, anon, authenticated;
revoke all on eng_tasks from public, anon, authenticated;
revoke all on eng_tech_pay_ledger from public, anon, authenticated;
revoke all on eng_thread_participants from public, anon, authenticated;
revoke all on eng_threads from public, anon, authenticated;
revoke all on eng_time_log from public, anon, authenticated;
revoke all on eng_training_confirmations from public, anon, authenticated;
revoke all on eng_training_decisions from public, anon, authenticated;
revoke all on eng_training_records from public, anon, authenticated;
revoke all on eng_windstorm_inquiries from public, anon, authenticated;

-- The 13 eng_ sequences.
revoke all on sequence eng_account_api_requests_id_seq from public, anon, authenticated;
revoke all on sequence eng_audit_events_id_seq from public, anon, authenticated;
revoke all on sequence eng_cron_runs_id_seq from public, anon, authenticated;
revoke all on sequence eng_error_events_id_seq from public, anon, authenticated;
revoke all on sequence eng_file_events_id_seq from public, anon, authenticated;
revoke all on sequence eng_jobs_id_seq from public, anon, authenticated;
revoke all on sequence eng_messages_id_seq from public, anon, authenticated;
revoke all on sequence eng_notifications_id_seq from public, anon, authenticated;
revoke all on sequence eng_order_events_id_seq from public, anon, authenticated;
revoke all on sequence eng_partner_touches_id_seq from public, anon, authenticated;
revoke all on sequence eng_responsible_charge_log_id_seq from public, anon, authenticated;
revoke all on sequence eng_sign_in_attempts_id_seq from public, anon, authenticated;
revoke all on sequence eng_site_order_requests_id_seq from public, anon, authenticated;

do $$
declare
  t text;
  s text;
  open_tables text := '';
  open_seqs text := '';
  service_had boolean;
  service_missing text := '';
  tables text[] := array[
    'eng_account_api_keys',
    'eng_account_api_requests',
    'eng_account_properties',
    'eng_account_trade_prices',
    'eng_alert_recipients',
    'eng_alert_state',
    'eng_applications',
    'eng_assignments',
    'eng_audit_events',
    'eng_auth_tokens',
    'eng_certification_attempts',
    'eng_certifications',
    'eng_checklist_exceptions',
    'eng_clients',
    'eng_contact_log',
    'eng_contacts',
    'eng_credentials',
    'eng_cron_runs',
    'eng_customer_access',
    'eng_customer_accounts',
    'eng_customer_auth_tokens',
    'eng_customer_users',
    'eng_deletion_requests',
    'eng_design_inquiries',
    'eng_determinations',
    'eng_documents',
    'eng_error_events',
    'eng_error_types',
    'eng_evidence_items',
    'eng_fee_schedule',
    'eng_file_events',
    'eng_file_inputs',
    'eng_files',
    'eng_incidents',
    'eng_insurance_alerts',
    'eng_insurance_policies',
    'eng_job_capture_additions',
    'eng_job_triage',
    'eng_jobs',
    'eng_leads',
    'eng_letter_facts',
    'eng_marketing_suppressions',
    'eng_messages',
    'eng_metrics_daily',
    'eng_mfa_enrolments',
    'eng_mfa_recovery_codes',
    'eng_notification_prefs',
    'eng_notifications',
    'eng_onboarding_items',
    'eng_onboardings',
    'eng_order_batches',
    'eng_order_events',
    'eng_order_inputs',
    'eng_order_payments',
    'eng_orders',
    'eng_partner_acceptances',
    'eng_partner_agreements',
    'eng_partner_asset_versions',
    'eng_partner_assets',
    'eng_partner_billing',
    'eng_partner_billing_events',
    'eng_partner_entries',
    'eng_partner_statements',
    'eng_partner_submissions',
    'eng_partner_terms',
    'eng_partner_tokens',
    'eng_partner_touches',
    'eng_partner_users',
    'eng_partners',
    'eng_payment_events',
    'eng_production_ledger',
    'eng_profiles',
    'eng_prospects',
    'eng_protocol_items',
    'eng_protocol_questions',
    'eng_protocol_templates',
    'eng_quote_files',
    'eng_quote_requests',
    'eng_refund_approval_limits',
    'eng_refund_decisions',
    'eng_refund_requests',
    'eng_repair_items',
    'eng_responsible_charge_log',
    'eng_retention_runs',
    'eng_review_sessions',
    'eng_role_grants',
    'eng_roles',
    'eng_scope_addenda',
    'eng_seal_acts',
    'eng_seal_images',
    'eng_service_orders',
    'eng_sign_in_attempts',
    'eng_site_order_requests',
    'eng_statement_lines',
    'eng_statements',
    'eng_tasks',
    'eng_tech_pay_ledger',
    'eng_thread_participants',
    'eng_threads',
    'eng_time_log',
    'eng_training_confirmations',
    'eng_training_decisions',
    'eng_training_records',
    'eng_windstorm_inquiries'
  ];
  seqs text[] := array[
    'eng_account_api_requests_id_seq',
    'eng_audit_events_id_seq',
    'eng_cron_runs_id_seq',
    'eng_error_events_id_seq',
    'eng_file_events_id_seq',
    'eng_jobs_id_seq',
    'eng_messages_id_seq',
    'eng_notifications_id_seq',
    'eng_order_events_id_seq',
    'eng_partner_touches_id_seq',
    'eng_responsible_charge_log_id_seq',
    'eng_sign_in_attempts_id_seq',
    'eng_site_order_requests_id_seq'
  ];
begin
  if array_length(tables, 1) <> 104 or array_length(seqs, 1) <> 13 then
    raise exception 'eng: 0102 names 104 tables and 13 sequences, and its lists hold % and %.', array_length(tables, 1), array_length(seqs, 1);
  end if;
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise exception 'eng: 0102 expects % to exist.', t;
    end if;
    if has_table_privilege('anon', t, 'select, insert, update, delete, truncate, references, trigger')
       or has_table_privilege('authenticated', t, 'select, insert, update, delete, truncate, references, trigger') then
      open_tables := open_tables || ' ' || t;
    end if;
  end loop;
  foreach s in array seqs loop
    if has_sequence_privilege('anon', s, 'usage, select, update')
       or has_sequence_privilege('authenticated', s, 'usage, select, update') then
      open_seqs := open_seqs || ' ' || s;
    end if;
  end loop;
  if open_tables <> '' or open_seqs <> '' then
    raise exception 'eng: after 0102 the API roles must hold nothing, and still hold tables:% sequences:%', open_tables, open_seqs;
  end if;
  /*
   * THE SERVICE ROLE, ASKED ONLY WHERE IT HOLDS ANYTHING. On a Supabase project
   * it holds every eng_ table through the default privileges, and every one must
   * still answer select. A replay that never granted it anything has nothing to
   * check, which is why the premise is read first rather than assumed.
   */
  select exists (
    select 1 from unnest(tables) as x(name)
    where has_table_privilege('service_role', x.name, 'select')
  ) into service_had;
  if service_had then
    foreach t in array tables loop
      if not has_table_privilege('service_role', t, 'select, insert, update, delete') then
        service_missing := service_missing || ' ' || t;
      end if;
    end loop;
    if service_missing <> '' then
      raise exception 'eng: after 0102 the service role must still hold every eng_ table, and lacks:%', service_missing;
    end if;
  end if;
end $$;
