/*
 * ===========================================================================
 * 0117: THE SALES LIST SENDS ONE EMAIL A DAY TO AN ADDRESS, AND HEARS REPLIES.
 * Robert's sales CRM ruling of 2026-11-02, item R7 (sequences and email), with
 * the sequence and templates he approved as drafted the same day (issue #1
 * comment 6587551356) and his answers 1 and 6 (6587550325): replies through a
 * reply subdomain on Resend Inbound, the support mailbox until then; a rep
 * presses Send on each email.
 * ===========================================================================
 *
 * R7, verbatim: "A default sequence per vertical (call day 1, email day 2,
 * call day 5, email day 9, call day 14, then dormant) that creates the next
 * task on each outcome; email templates per vertical with the unsubscribe
 * link, From and Reply-To rules, suppression consulted, one send per address
 * per day; a reply to any email lands in the existing inbox linked to the
 * company."
 *
 * TWO TABLES AND ONE COLUMN.
 *   eng_crm_email_sends    one row per sequence email a rep sent, written
 *                          BEFORE the email is queued. Unique on the address
 *                          and the firm's calendar day while it stands, so a
 *                          second send to one address on one day is refused by
 *                          the database whatever the code does. A row whose
 *                          queueing failed is marked failed and stops holding
 *                          the day, so the rep can press Send again.
 *   eng_crm_email_replies  one row per inbound reply the Resend webhook
 *                          delivered, unique on the webhook's event id, so a
 *                          redelivery writes nothing twice. It is what the
 *                          inbox lists, linked to the company it matched.
 *   eng_prospects.sequence_paused_at
 *                          set when a reply arrives: the sequence stops for a
 *                          person. The stage moves to connected when a rep
 *                          reads the reply, because every stage change on the
 *                          sales list is written to the contact log by a
 *                          person (0079: by_id is a staff profile, not null).
 *
 * ADDITIVE ONLY: no drop, no change to an existing constraint. KEPT, PENDING
 * COUNSEL, as eng_prospects is: declared in retention-policy.ts. RLS on, no
 * policies, every grant revoked: the service role reads and writes.
 *
 * Development first, on stage/0117-crm-email; production at the chat
 * counterpart's sitting after R7's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_crm_territories') is null then
    raise exception 'eng: 0117 follows 0116, which adds eng_crm_territories. It does not exist here.';
  end if;
  if to_regclass('public.eng_prospect_contacts') is null then
    raise exception 'eng: 0117 names a contact from eng_prospect_contacts (0112), and that table does not exist here.';
  end if;
  if to_regclass('public.eng_crm_email_sends') is not null or to_regclass('public.eng_crm_email_replies') is not null then
    raise exception 'eng: 0117 expects neither email table before it runs.';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_prospects' and column_name = 'sequence_paused_at'
  ) then
    raise exception 'eng: 0117 expects no sequence_paused_at column on eng_prospects before it runs.';
  end if;
end;
$$;

/* ------------------------------------------------------- the send ledger */

create table if not exists eng_crm_email_sends (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  prospect_id     uuid not null references eng_prospects (id) on delete restrict,
  contact_id      uuid references eng_prospect_contacts (id) on delete set null,
  /* The address as sent, normalized: trimmed and lower case. */
  address         text not null
                    constraint eng_crm_email_sends_address_normalized
                    check (address = lower(btrim(address)) and position('@' in address) > 1),
  /* The firm's calendar day (America/Chicago) the send was made on. */
  firm_day        date not null,
  sequence_step   integer not null
                    constraint eng_crm_email_sends_step_known
                    check (sequence_step between 1 and 5),
  variant         text not null
                    constraint eng_crm_email_sends_variant_known
                    check (variant in ('open', 'prelaunch')),
  vertical        text not null,
  sent_by         uuid not null references eng_profiles (id) on delete restrict,
  status          text not null default 'queued'
                    constraint eng_crm_email_sends_status_known
                    check (status in ('queued', 'failed')),
  failure         text,
  constraint eng_crm_email_sends_failure_says_why
    check ((status = 'failed') = (failure is not null and length(btrim(failure)) > 0))
);

/* One send per address per firm day, while it stands. A failed queueing does not hold the day. */
create unique index if not exists eng_crm_email_sends_once_a_day
  on eng_crm_email_sends (address, firm_day)
  where status = 'queued';

create index if not exists eng_crm_email_sends_prospect_idx on eng_crm_email_sends (prospect_id, created_at desc);

alter table eng_crm_email_sends enable row level security;
revoke all on eng_crm_email_sends from public, anon, authenticated;

comment on table eng_crm_email_sends is
  'One row per sales sequence email a rep sent, written before the email is queued. Unique on (address, firm_day) while queued: one send per address per firm day. 0117.';

/* ------------------------------------------------------------ the replies */

create table if not exists eng_crm_email_replies (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  /* The webhook's own event id (svix-id): a redelivery is refused here. */
  event_id        text not null
                    constraint eng_crm_email_replies_event_named
                    check (length(btrim(event_id)) between 1 and 200),
  /* Resend's id for the received email, used to fetch its body. */
  email_id        text,
  prospect_id     uuid references eng_prospects (id) on delete restrict,
  matched_by      text not null
                    constraint eng_crm_email_replies_matched_known
                    check (matched_by in ('tag', 'sender', 'none')),
  from_address    text,
  subject         text,
  body_text       text,
  received_at     timestamptz,
  read_at         timestamptz,
  read_by         uuid references eng_profiles (id) on delete set null,
  constraint eng_crm_email_replies_match_names_a_company
    check ((matched_by = 'none') = (prospect_id is null)),
  constraint eng_crm_email_replies_read_is_whole
    check ((read_at is null) = (read_by is null))
);

create unique index if not exists eng_crm_email_replies_event_once on eng_crm_email_replies (event_id);
create index if not exists eng_crm_email_replies_unread_idx on eng_crm_email_replies (created_at) where read_at is null;
create index if not exists eng_crm_email_replies_prospect_idx on eng_crm_email_replies (prospect_id, created_at desc);

alter table eng_crm_email_replies enable row level security;
revoke all on eng_crm_email_replies from public, anon, authenticated;

comment on table eng_crm_email_replies is
  'One row per reply to a sales email, delivered by the Resend webhook. Unique on its event id, so a redelivery writes nothing twice. The inbox lists the unread ones, linked to the company they matched. 0117.';

/* ------------------------------------------------- a reply pauses the sequence */

alter table eng_prospects add column if not exists sequence_paused_at timestamptz;

comment on column eng_prospects.sequence_paused_at is
  'Set when a reply to a sales email arrives: the sequence stops for a person. Cleared when a rep reads the reply and the company moves to connected. 0117.';

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_crm_email_sends') is null or to_regclass('public.eng_crm_email_replies') is null then
    raise exception 'eng: 0117 expects both email tables after it runs.';
  end if;
  if exists (
    select 1 from pg_class c
     where c.relname in ('eng_crm_email_sends', 'eng_crm_email_replies')
       and not c.relrowsecurity
  ) then
    raise exception 'eng: 0117 expects row level security on both tables.';
  end if;
  if to_regclass('public.eng_crm_email_sends_once_a_day') is null then
    raise exception 'eng: 0117 expects one send per address per day.';
  end if;
  if to_regclass('public.eng_crm_email_replies_event_once') is null then
    raise exception 'eng: 0117 expects a reply event to be recorded once.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_prospects' and column_name = 'sequence_paused_at'
  ) then
    raise exception 'eng: 0117 expects eng_prospects.sequence_paused_at after it runs.';
  end if;
end;
$$;
