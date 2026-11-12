/*
 * 0125: A FRANCHISEE HOLDS TERRITORIES AND ITS PEOPLE.
 *
 * Robert's overnight orders of 2026-11-10 into 2026-11-11, item 3, platform
 * item X1 of the franchise standing list: "Franchisee tenant: a franchise record
 * owning one or more territories, its own technicians and sales reps, its own
 * office NAP. Builds on R5 territories."
 *
 * STAFF AND ADMIN ONLY. Nothing here is public, nothing here offers a
 * franchise, and FR13 stands: no franchise promises to anyone before the FDD
 * issues. A franchisee row is the firm's own record of an agreement, entered by
 * an administrator.
 *
 * Three tables, all additive, and one grant:
 *
 *   eng_franchisees              the franchisee: its legal name, its office
 *                                name address and phone, and where it stands.
 *   eng_franchisee_territories   which sales territories (0116) it holds. A
 *                                territory is held by one franchisee at a time.
 *   eng_franchisee_members       its people, by portal profile. A person
 *                                belongs to one franchisee at a time.
 *   franchise.manage             admin only, seeded here, matching DEFAULT_ROLES.
 *
 * Holdings and memberships are never deleted. They are ended, with who ended
 * them and when, the shape 0116 gave territory counties and reps, so the record
 * of who held what survives the change.
 *
 * THE STATUS VOCABULARY HAS THREE WORDS, AND EACH IS TRUE OF A REAL STATE:
 *   onboarding  the agreement is in place and the franchisee is not yet
 *               working (platform item X4 fills this state in);
 *   operating   it works its territories;
 *   ended       the relationship is over, with when and why.
 * A check refuses an ended row with no reason and a live row with one.
 *
 * Numbered 0125 from main. The staged phone keystore branch also carries a
 * 0125, so whichever merges second is renumbered on a new stage branch, as the
 * sales list migrations were.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if to_regclass('public.eng_push_subscriptions') is null then
    raise exception 'eng: 0125 follows 0124, which adds eng_push_subscriptions. It does not exist here.';
  end if;
  if to_regclass('public.eng_crm_territories') is null then
    raise exception 'eng: 0125 gives territories (0116) to franchisees, and eng_crm_territories does not exist here.';
  end if;
  if to_regclass('public.eng_franchisees') is not null then
    raise exception 'eng: 0125 expects no eng_franchisees before it runs.';
  end if;
end;
$$;

/* ------------------------------------------------------- 1. the franchisee */
create table eng_franchisees (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  created_by          uuid references eng_profiles (id) on delete set null,
  /* The entity on the agreement, exactly as it is registered. */
  legal_name          text not null
                        constraint eng_franchisees_legal_name_shape
                        check (length(btrim(legal_name)) between 2 and 120),
  status              text not null default 'onboarding'
                        constraint eng_franchisees_status_known
                        check (status in ('onboarding', 'operating', 'ended')),
  /*
   * The office NAP. Held whole or not at all: a street with no city or postal
   * code is an address nobody can use. The phone is E.164, the shape
   * src/config/contact.ts holds the firm's own in.
   */
  office_street       text,
  office_city         text,
  office_postal_code  text,
  office_phone        text
                        constraint eng_franchisees_phone_e164
                        check (office_phone is null or office_phone ~ '^[+]1[0-9]{10}$'),
  /*
   * The not-null tests are load bearing. Without them a street with no city
   * passes: length(btrim(null)) is null, the second branch is null rather than
   * false, and a check constraint accepts null. The proof caught exactly that
   * on the first draft of this file.
   */
  constraint eng_franchisees_address_whole check (
    (office_street is null and office_city is null and office_postal_code is null)
    or (office_street is not null and office_city is not null and office_postal_code is not null
        and length(btrim(office_street)) between 3 and 120
        and length(btrim(office_city)) between 2 and 60
        and office_postal_code ~ '^[0-9]{5}$')
  ),
  updated_at          timestamptz not null default now(),
  ended_at            timestamptz,
  ended_reason        text,
  constraint eng_franchisees_end_says_why check (
    (status = 'ended') = (ended_at is not null)
    and (ended_at is null) = (ended_reason is null)
    and (ended_reason is null or length(btrim(ended_reason)) between 3 and 500)
  )
);

create unique index eng_franchisees_name_once on eng_franchisees (lower(btrim(legal_name)));

/* ------------------------------------------------ 2. the territories it holds */
create table eng_franchisee_territories (
  id              uuid primary key default gen_random_uuid(),
  franchisee_id   uuid not null references eng_franchisees (id) on delete restrict,
  territory_id    uuid not null references eng_crm_territories (id) on delete restrict,
  created_at      timestamptz not null default now(),
  created_by      uuid references eng_profiles (id) on delete set null,
  ended_at        timestamptz,
  ended_by        uuid references eng_profiles (id) on delete set null,
  constraint eng_franchisee_territories_end_whole check (ended_by is null or ended_at is not null)
);

/* A territory is held by one franchisee at a time. */
create unique index eng_franchisee_territories_one_holder
  on eng_franchisee_territories (territory_id) where ended_at is null;
create index eng_franchisee_territories_by_franchisee
  on eng_franchisee_territories (franchisee_id) where ended_at is null;

/* -------------------------------------------------------- 3. its people */
create table eng_franchisee_members (
  id              uuid primary key default gen_random_uuid(),
  franchisee_id   uuid not null references eng_franchisees (id) on delete restrict,
  profile_id      uuid not null references eng_profiles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  created_by      uuid references eng_profiles (id) on delete set null,
  ended_at        timestamptz,
  ended_by        uuid references eng_profiles (id) on delete set null,
  constraint eng_franchisee_members_end_whole check (ended_by is null or ended_at is not null)
);

/* A person belongs to one franchisee at a time. */
create unique index eng_franchisee_members_one_franchisee
  on eng_franchisee_members (profile_id) where ended_at is null;
create index eng_franchisee_members_by_franchisee
  on eng_franchisee_members (franchisee_id) where ended_at is null;

/* ------------------------------------------------------------ 4. access */
alter table eng_franchisees enable row level security;
alter table eng_franchisee_territories enable row level security;
alter table eng_franchisee_members enable row level security;
revoke all on eng_franchisees from public, anon, authenticated;
revoke all on eng_franchisee_territories from public, anon, authenticated;
revoke all on eng_franchisee_members from public, anon, authenticated;

comment on table eng_franchisees is
  'One row per franchisee the firm has an agreement with: legal name, office NAP, and onboarding, operating or ended (Robert''s X1, 2026-11-10). Staff and admin only. 0125.';
comment on table eng_franchisee_territories is
  'Which sales territories (0116) a franchisee holds; one live holder per territory, ended rather than deleted. 0125.';
comment on table eng_franchisee_members is
  'A franchisee''s people by portal profile; one live franchisee per person, ended rather than deleted. 0125.';

/* -------------------------------------------------------------- 5. the grant */
insert into eng_role_grants (role_key, action) values
  ('admin', 'franchise.manage')
on conflict (role_key, action) do nothing;

/* ------------------------------------------------------- 6. what must be true */
do $$
begin
  if to_regclass('public.eng_franchisees') is null
     or to_regclass('public.eng_franchisee_territories') is null
     or to_regclass('public.eng_franchisee_members') is null then
    raise exception 'eng: 0125 expects its three tables after it runs.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eng_franchisees'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.eng_franchisee_territories'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.eng_franchisee_members'::regclass) then
    raise exception 'eng: 0125 expects row level security on all three tables.';
  end if;
  if (select count(*) from public.eng_role_grants where action = 'franchise.manage') <> 1
     or not exists (select 1 from public.eng_role_grants where action = 'franchise.manage' and role_key = 'admin') then
    raise exception 'eng: 0125 expects franchise.manage held by admin and nobody else.';
  end if;
end;
$$;
