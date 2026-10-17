/*
 * ===========================================================================
 * 0068: A DECIDED REVIEW AND ITS CREDIT ARE ONE WRITE. Operator ruling,
 * 2026-10-10.
 * ===========================================================================
 *
 * decideReview wrote a decided review as a dozen separate requests: the
 * determination, the repair list, the status move, its file event and audit
 * row, the refusal fields or the revision count, the technician released, the
 * review session closed, the responsible charge log row, the production ledger
 * credit, and the decision's audit row. Each was its own transaction. A
 * failure between any two left a state the record should not be able to hold,
 * and the ruling names the worst of them: a decided review with no pay.
 *
 * THIS FUNCTION WRITES ALL OF IT IN ONE TRANSACTION OR NONE OF IT.
 *
 * WHAT IT DOES NOT DO, by the ruling's own boundary: nothing that leaves the
 * database. No Stripe call, no email, no SMS, no storage write. The work that
 * reaches outside (the notifications a decision raises, and on a refusal the
 * order's settlement, which can refund a card) is ENQUEUED in eng_jobs in the
 * same transaction, with an idempotency key, and the job runner does it after
 * commit. A rolled back decision therefore leaves no queued job, which the
 * proof asserts.
 *
 * EVERY RULE STAYS IN TYPESCRIPT. canReview, canTransition, the determination
 * checks and the pay tier (src/config/engineer-pay.ts) are pure functions with
 * their own audits; this function is handed their answers and records them.
 * The one thing it re-checks is the one thing only the database can know: that
 * the file is still in the status those rules were judged against. It locks the
 * row and refuses if another request moved it first.
 *
 * AND A DEFECT FOUND WRITING IT. 'repairs' became a review action with 0053
 * (a repairs-required determination), and three check constraints written in
 * 0004 still allow only seal, revisions, site_visit and refuse: the review
 * session's decision, the production ledger's and the responsible charge
 * log's. So on main a repairs decision moved the file and then failed on the
 * charge log and the credit, which is a decided review with no pay and a
 * regulatory record short a row. In one transaction it would refuse the whole
 * decision instead, so the three checks are widened here, each to the five
 * actions. No row is rewritten; every existing value is one of the four.
 *
 * NOT PURELY ADDITIVE: each widening drops and re-adds a check constraint, the
 * shape the Supabase MCP cancels (CLAUDE.md section 6b). The sitting document
 * says so; the function itself is additive.
 */
alter table public.eng_review_sessions drop constraint if exists eng_review_sessions_decision_check;
alter table public.eng_review_sessions add constraint eng_review_sessions_decision_check
  check (decision in ('seal', 'revisions', 'site_visit', 'repairs', 'refuse'));

alter table public.eng_production_ledger drop constraint if exists eng_production_ledger_decision_check;
alter table public.eng_production_ledger add constraint eng_production_ledger_decision_check
  check (decision in ('seal', 'revisions', 'site_visit', 'repairs', 'refuse'));

alter table public.eng_responsible_charge_log drop constraint if exists eng_responsible_charge_log_decision_check;
alter table public.eng_responsible_charge_log add constraint eng_responsible_charge_log_decision_check
  check (decision in ('seal', 'revisions', 'site_visit', 'repairs', 'refuse'));

create or replace function eng_record_review_decision(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_file_id      uuid := (p->>'file_id')::uuid;
  v_actor_id     uuid := (p->>'actor_id')::uuid;
  v_action       text := p->>'action';
  v_expected     text := p->>'expected_status';
  v_target       text := p->>'target_status';
  v_stamp        text := p->>'stamp_column';
  v_note         text := nullif(p->>'note', '');
  v_status       text;
  v_det_id       uuid := null;
  v_det          jsonb := p->'determination';
  v_session      jsonb := p->'session';
  v_credit       jsonb := p->'credit';
  v_log          jsonb := p->'charge_log';
  v_job          jsonb := p->'job';
  v_job_id       bigint := null;
  v_i            integer := 0;
  v_req          text;
begin
  if v_action not in ('seal', 'revisions', 'site_visit', 'repairs', 'refuse') then
    raise exception 'Not a review action: %', v_action;
  end if;

  -- The one check only the database can make: the file has not moved since the
  -- rules were judged. The lock holds it for the rest of this transaction.
  select status into v_status from public.eng_files where id = v_file_id for update;
  if v_status is null then
    raise exception 'That file does not exist.';
  end if;
  if v_status is distinct from v_expected then
    raise exception 'The file moved while this decision was being recorded (it is now %). Nothing was written; decide again.', v_status;
  end if;

  -- The determination and its repair list.
  if v_det is not null and v_det <> 'null'::jsonb then
    insert into public.eng_determinations
      (file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, note, engineer_id)
    values
      (v_file_id, v_det->>'protocol_document', v_det->>'determination',
       coalesce(array(select jsonb_array_elements_text(v_det->'relied_on_item_keys')), '{}'),
       coalesce(array(select (jsonb_array_elements_text(v_det->'relied_on_evidence_ids'))::uuid), '{}'),
       nullif(v_det->>'note', ''), v_actor_id)
    returning id into v_det_id;

    for v_req in select jsonb_array_elements_text(coalesce(p->'repairs', '[]'::jsonb)) loop
      insert into public.eng_repair_items (file_id, determination_id, sort_order, requirement, raised_by)
      values (v_file_id, v_det_id, v_i, v_req, v_actor_id);
      v_i := v_i + 1;
    end loop;
  end if;

  -- The status move, its stamp, its file event and its audit row. A passing
  -- decision does not move the file: the seal act does (letter-seal.ts).
  if v_target is not null then
    if v_stamp is not null and v_stamp not in
        ('dispatched_at', 'refused_at', 'repairs_required_at', 'evidence_submitted_at', 'sealed_at', 'delivered_at', 'closed_at') then
      raise exception 'Not a status stamp column: %', v_stamp;
    end if;
    update public.eng_files set status = v_target where id = v_file_id;
    if v_stamp is not null then
      execute format('update public.eng_files set %I = now() where id = $1', v_stamp) using v_file_id;
    end if;
    insert into public.eng_file_events (file_id, actor_id, kind, from_status, to_status, body)
    values (v_file_id, v_actor_id, 'status', v_status, v_target, v_note);
    insert into public.eng_audit_events
      (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary, diff, ip, user_agent)
    values
      (v_actor_id, p->>'actor_email', p->>'actor_role', 'file.transition', 'file', v_file_id::text,
       p->>'transition_summary', jsonb_build_object('status', jsonb_build_object('from', v_status, 'to', v_target)),
       p->>'ip', p->>'user_agent');
  end if;

  if v_action = 'refuse' then
    update public.eng_files
       set refused_at = now(), refusal_reason = v_note, refused_by = v_actor_id
     where id = v_file_id;
  end if;
  if v_action in ('revisions', 'site_visit') then
    update public.eng_files set revision_count = revision_count + 1 where id = v_file_id;
  end if;
  if v_action in ('site_visit', 'repairs') then
    update public.eng_files set assigned_tech_id = null where id = v_file_id;
    update public.eng_assignments
       set state = 'withdrawn', responded_at = now()
     where file_id = v_file_id and state = 'accepted';
  end if;

  -- The review clock.
  if v_session is not null and v_session <> 'null'::jsonb then
    update public.eng_review_sessions
       set ended_at = now(), decision = v_action, minutes = (v_session->>'minutes')::integer
     where id = (v_session->>'id')::uuid;
  end if;

  -- The responsible charge log, built by chargeLogRow in TypeScript.
  insert into public.eng_responsible_charge_log
    (engineer_id, decision, file_id, document_id, document_type, property_address, county,
     reviewed_at, review_minutes, revision_count, site_visit, refused, refusal_reason, period, review_session_id)
  values
    (v_actor_id, v_action, v_file_id, nullif(v_log->>'document_id', '')::uuid, v_log->>'document_type',
     v_log->>'property_address', v_log->>'county', now(), nullif(v_log->>'review_minutes', '')::integer,
     coalesce((v_log->>'revision_count')::integer, 0), coalesce((v_log->>'site_visit')::boolean, false),
     v_action = 'refuse', v_log->>'refusal_reason', v_log->>'period',
     nullif(v_session->>'id', '')::uuid);

  -- The credit, the figure productionCreditFor computed from engineer-pay.ts.
  if v_credit is not null and v_credit <> 'null'::jsonb then
    insert into public.eng_production_ledger
      (engineer_id, file_id, review_session_id, decision, amount_cents, period, status, note)
    values
      (v_actor_id, v_file_id, (v_session->>'id')::uuid, v_action, (v_credit->>'amount_cents')::integer,
       v_credit->>'period', 'pending', v_credit->>'note');
  end if;

  -- The decision's own audit row.
  insert into public.eng_audit_events
    (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary, ip, user_agent)
  values
    (v_actor_id, p->>'actor_email', p->>'actor_role', 'review.' || v_action, 'file', v_file_id::text,
     p->>'decision_summary', p->>'ip', p->>'user_agent');

  -- What reaches outside, queued for after commit.
  if v_job is not null and v_job <> 'null'::jsonb then
    insert into public.eng_jobs (kind, payload, idempotency_key, effect_mode)
    values (v_job->>'kind', v_job->'payload', v_job->>'idempotency_key',
            coalesce(v_job->>'effect_mode', 'live'))
    returning id into v_job_id;
  end if;

  return jsonb_build_object('determination_id', v_det_id, 'job_id', v_job_id);
end;
$fn$;

comment on function eng_record_review_decision(jsonb) is
  'One decided review in one transaction: determination and repair list, status move with its stamp, file event and audit row, refusal or revision fields, technician released, review session closed, responsible charge log row, production ledger credit, the decision audit row, and the outside work enqueued in eng_jobs. Re-checks under a row lock that the file has not moved. Reaches nothing outside the database. 0068, operator ruling 2026-10-10.';
