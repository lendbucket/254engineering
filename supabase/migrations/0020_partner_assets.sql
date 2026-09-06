-- ===========================================================================
-- 0020: the partner asset library, and material sent for approval
--
-- Phase 9 Section 5. Two tables pointing in opposite directions:
--
--   eng_partner_assets      what the FIRM published for partners to use
--   eng_partner_submissions what a PARTNER sent the firm to look at
--
-- They are not one table with a direction column. The first is approved
-- material with a version history that partners read; the second is a request
-- with a decision on it that one partner reads. Merging them would mean every
-- read asking which sort this is, and the missing branch would show one
-- partner's draft to another as though the firm had approved it.
--
-- WHAT THIS SECTION IS ACTUALLY FOR
-- ---------------------------------
-- Non negotiable 2 of the programme: no partner surface may render a service
-- claim the public site could not. The asset library is how that becomes
-- enforceable rather than hoped for. Copy is written once, checked by the same
-- patterns the site's own voice audit uses, and published; a partner sees the
-- current version.
--
-- THE LIMIT, WHICH BELONGS IN THE SCHEMA COMMENT AS WELL AS THE SCREEN
-- --------------------------------------------------------------------
-- None of this stops a partner writing whatever they like on their own website.
-- The platform makes the approved path easy and keeps the record complete. The
-- control is the agreement, the right to withdraw approval, and somebody
-- looking at what partners publish.
-- ===========================================================================

create table if not exists eng_partner_assets (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  /*
   * A stable name for the thing, across versions. The version history hangs off
   * it, so "the one pager" is one asset with four versions rather than four
   * assets nobody can tell apart.
   */
  slug            text not null unique,
  title           text not null,

  kind            text not null check (kind in (
                    'copy_block',     -- a paragraph a partner may put on their own site
                    'one_pager',      -- a file to hand to a client
                    'logo',           -- the firm's mark, for co branded material
                    'email_snippet',  -- wording for an introduction
                    'link_card'       -- a described link, with its tracked url
                  )),

  status          text not null default 'draft'
                    check (status in ('draft', 'published', 'withdrawn')),

  /*
   * The version a partner currently sees. Null until something is published,
   * which is what makes "draft" a real state rather than a label.
   */
  current_version integer,

  notes           text
);

create index if not exists eng_partner_assets_status_idx
  on eng_partner_assets (status, kind);

drop trigger if exists eng_partner_assets_touch on eng_partner_assets;
create trigger eng_partner_assets_touch before update on eng_partner_assets
  for each row execute function eng_touch_updated_at();

alter table eng_partner_assets enable row level security;

-- ---------------------------------------------------------------- versions
--
-- A VERSION IS NEVER EDITED, WHICH IS THE SAME RULE THE AGREEMENT CARRIES.
--
-- A partner who put a paragraph on their website in March is entitled to know
-- exactly what they were given in March. If a version could be edited, the
-- firm's record of what it approved would change under a partner who is still
-- displaying the old wording, and the only person who could prove what it said
-- would be the partner.
--
-- A correction is version four.
create table if not exists eng_partner_asset_versions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  asset_id        uuid not null references eng_partner_assets (id) on delete cascade,
  version         integer not null,

  -- Copy lives here. A file lives in storage and this names it.
  body            text,
  bucket          text,
  storage_key     text,
  content_type    text,
  byte_size       bigint,

  summary         text,

  /*
   * THE COMPLIANCE VERDICT AT THE MOMENT OF PUBLICATION, STORED.
   *
   * Not recomputed on read, deliberately. The patterns change: two were added
   * on 2026-09-05 and one of them found a claim that had been live for a month.
   * What the firm needs to be able to say later is "this was checked, on this
   * date, against these rules, and it passed", which is a different statement
   * from "it passes today".
   *
   * A version that fails is never written at all, so this is always a record of
   * a pass. It is kept because the interesting question in two years is which
   * rules it passed.
   */
  checked_at      timestamptz not null default now(),
  check_note      text not null,

  published_at    timestamptz,
  published_by    uuid references eng_profiles (id) on delete set null,

  unique (asset_id, version)
);

create index if not exists eng_partner_asset_versions_asset_idx
  on eng_partner_asset_versions (asset_id, version desc);

alter table eng_partner_asset_versions enable row level security;

/*
 * Append only, by the existing trigger. Both directions: an edited version is
 * the firm changing what it approved, and a deleted one is the firm being
 * unable to say what it approved.
 */
drop trigger if exists eng_partner_asset_versions_immutable on eng_partner_asset_versions;
create trigger eng_partner_asset_versions_immutable
  before update or delete on eng_partner_asset_versions
  for each row execute function eng_forbid_mutation();

comment on table eng_partner_asset_versions is
  'Approved partner material, versioned and append only. A correction is a new version, because a partner displaying last month wording is entitled to know exactly what they were given.';

-- ------------------------------------------------------------- submissions
--
-- Material a partner sends the firm to look at, and the decision on it.
--
-- WHY THE DECISION IS A COLUMN AND NOT A SECOND TABLE
-- ---------------------------------------------------
-- Because a submission with no decision is the entire point of the queue, and a
-- decision with no submission cannot exist. One row that starts undecided and
-- acquires a decision is the shape of the thing. The row is frozen once decided
-- so a decision cannot be quietly revised: a partner who was told no and then
-- finds the record saying yes has been told two different things by the firm.
create table if not exists eng_partner_submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  partner_id    uuid not null references eng_partners (id) on delete cascade,
  submitted_by  uuid references eng_partner_users (id) on delete set null,

  kind          text not null check (kind in ('copy', 'artwork', 'page', 'other')),
  title         text not null,
  body          text,
  link          text,
  bucket        text,
  storage_key   text,

  status        text not null default 'submitted'
                  check (status in ('submitted', 'approved', 'changes_requested', 'withdrawn')),

  /*
   * The firm's answer, in the firm's words, addressed to the partner. Not a
   * status code with a lookup table: "approved" tells a partner nothing about
   * which sentence was the problem.
   */
  decision_note text,
  decided_by    uuid references eng_profiles (id) on delete set null,
  decided_at    timestamptz
);

create index if not exists eng_partner_submissions_partner_idx
  on eng_partner_submissions (partner_id, created_at desc);
create index if not exists eng_partner_submissions_queue_idx
  on eng_partner_submissions (status, created_at) where status = 'submitted';

drop trigger if exists eng_partner_submissions_touch on eng_partner_submissions;
create trigger eng_partner_submissions_touch before update on eng_partner_submissions
  for each row execute function eng_touch_updated_at();

alter table eng_partner_submissions enable row level security;

-- ============================================================================
-- A DECIDED SUBMISSION IS FROZEN
--
-- The same narrow shape 0014 and 0019 use: name the columns that must not move
-- rather than forbidding UPDATE, because a withdrawn submission is a legitimate
-- later change and so is nothing else.
--
-- Reopening a decision is a new submission. That is not friction for its own
-- sake: the firm telling a partner "no, because this sentence" and later
-- telling them "yes" without the first answer surviving is how a partner ends
-- up publishing something the firm refused, holding an email that says it was
-- approved.
-- ============================================================================

create or replace function eng_freeze_partner_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.decided_at is not null and (
       new.status        is distinct from old.status
    or new.decision_note is distinct from old.decision_note
    or new.decided_by    is distinct from old.decided_by
    or new.decided_at    is distinct from old.decided_at
    or new.body          is distinct from old.body
    or new.link          is distinct from old.link
    or new.storage_key   is distinct from old.storage_key
  ) then
    raise exception
      'Submission % has already been decided. Send a new one rather than changing the answer, so both answers survive.',
      old.id
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

comment on function eng_freeze_partner_submission is
  'Refuses a change to a submission that has been decided. Reopening is a new submission, so the firm cannot appear to have given one answer when it gave another.';

drop trigger if exists eng_partner_submissions_frozen on eng_partner_submissions;
create trigger eng_partner_submissions_frozen
  before update on eng_partner_submissions
  for each row execute function eng_freeze_partner_submission();

comment on table eng_partner_submissions is
  'Material a partner sent the firm, and the decision on it. Frozen once decided.';
