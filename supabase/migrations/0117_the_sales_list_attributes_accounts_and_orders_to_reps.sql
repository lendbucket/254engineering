/*
 * ===========================================================================
 * 0117: THE SALES LIST ATTRIBUTES EACH ACCOUNT AND EACH ORDER TO A REP.
 * Robert's sales CRM ruling of 2026-11-02, item R8 (manager dashboard and
 * attribution).
 * ===========================================================================
 *
 * R8, verbatim: "Manager dashboard and attribution. /portal/crm/reports:
 * dials, connects, interested, accounts opened, orders and revenue
 * attributed, per rep per day, week and month; conversion by source and
 * vertical; a leaderboard; CSV export on the admin export gate. Attribution
 * chain prospect to account to order written on conversion and on each
 * order."
 *
 * ONE TABLE, eng_crm_attributions, two kinds of row:
 *   account_opened  written when a prospect is converted into an account:
 *                   the prospect, the account, and the rep it is credited to.
 *                   One per prospect.
 *   order           written when an order is placed for an account that came
 *                   from a prospect: the prospect, the account, the order, and
 *                   the rep. One per order.
 *
 * WHICH REP. The prospect's owner when the row is written, or, for a prospect
 * nobody owned, the person who converted it. The rep is frozen on the row:
 * reassigning the company later does not move credit already earned, which is
 * what a leaderboard and a commission conversation need.
 *
 * A FINANCIAL FACT, SO APPEND ONLY. The same reasoning as the partner touches
 * of 0014: credit decided once is evidence, and evidence that can be edited is
 * not evidence. Updates and deletes are refused, except the delete that
 * follows an order's own removal (cascade), the shape 0106 uses for academy
 * attempts.
 *
 * rep_id carries no foreign key, deliberately, as 0106's approved_by does not:
 * a probe account removed in teardown must not be held in place by credit it
 * was given, and the row records who was credited at the time, which stays
 * true after the account goes.
 *
 * ADDITIVE ONLY: no drop, no change to an existing constraint. KEPT, PENDING
 * COUNSEL, as eng_prospects is: declared in retention-policy.ts. RLS on, no
 * policies, every grant revoked: the service role reads and writes.
 *
 * Development first, on stage/0117-crm-attribution; production at the chat
 * counterpart's sitting after R8's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_crm_email_sends') is null then
    raise exception 'eng: 0117 follows 0116, which adds eng_crm_email_sends. It does not exist here.';
  end if;
  if to_regclass('public.eng_crm_attributions') is not null then
    raise exception 'eng: 0117 expects no eng_crm_attributions before it runs.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_prospects' and column_name = 'converted_account_id'
  ) then
    raise exception 'eng: 0117 reads eng_prospects.converted_account_id (0079), and it does not exist here.';
  end if;
end;
$$;

/* ------------------------------------------------------------------------ table */

create table if not exists eng_crm_attributions (
  id             uuid primary key default gen_random_uuid(),
  attributed_at  timestamptz not null default now(),
  kind           text not null
                   constraint eng_crm_attributions_kind_known
                   check (kind in ('account_opened', 'order')),
  prospect_id    uuid not null references eng_prospects (id) on delete restrict,
  account_id     uuid not null references eng_customer_accounts (id) on delete restrict,
  order_id       uuid references eng_service_orders (id) on delete cascade,
  rep_id         uuid,
  constraint eng_crm_attributions_order_matches_kind check (
    (kind = 'account_opened' and order_id is null)
    or (kind = 'order' and order_id is not null)
  )
);
alter table eng_crm_attributions enable row level security;
revoke all on eng_crm_attributions from public, anon, authenticated;

create unique index if not exists eng_crm_attributions_order_once
  on eng_crm_attributions (order_id) where kind = 'order';
create unique index if not exists eng_crm_attributions_opened_once
  on eng_crm_attributions (prospect_id) where kind = 'account_opened';
create index if not exists eng_crm_attributions_rep_idx
  on eng_crm_attributions (rep_id, attributed_at);
create index if not exists eng_crm_attributions_account_idx
  on eng_crm_attributions (account_id);

comment on table eng_crm_attributions is
  'The sales attribution chain, prospect to account to order: one row when a prospect becomes an account, one row per order placed for that account, each crediting the rep who owned the company then. Append only; an order row goes only with its order. 0117, Robert''s sales CRM ruling R8 of 2026-11-02.';

create trigger eng_crm_attributions_append_only
  before update or delete on eng_crm_attributions
  for each row execute function eng_forbid_mutation_allow_cascade();

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_crm_attributions') is null then
    raise exception 'eng: 0117 expects eng_crm_attributions after it runs.';
  end if;
  if exists (select 1 from pg_class c where c.relname = 'eng_crm_attributions' and not c.relrowsecurity) then
    raise exception 'eng: 0117 expects row level security on eng_crm_attributions.';
  end if;
  if to_regclass('public.eng_crm_attributions_order_once') is null
     or to_regclass('public.eng_crm_attributions_opened_once') is null then
    raise exception 'eng: 0117 expects one row per order and one opening per prospect.';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgname = 'eng_crm_attributions_append_only' and tgrelid = 'public.eng_crm_attributions'::regclass
  ) then
    raise exception 'eng: 0117 expects eng_crm_attributions to be append only.';
  end if;
end;
$$;
