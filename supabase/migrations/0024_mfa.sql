-- ===========================================================================
-- 0024: a second factor, and what a role requires of it.
--
-- Phase 12 Section 1. The design and both operator rulings are in
-- docs/mfa-design.md; what is argued here is only what the SHAPE decides.
--
-- WHY A PENDING SECRET AND AN ACTIVE ONE ARE TWO COLUMNS
-- ------------------------------------------------------
-- The brief requires that an enrolment is verified by a code BEFORE it is
-- stored, so an unverified secret can never lock somebody out. The obvious
-- implementation is one secret column and a verified_at timestamp, and it is
-- wrong in a way that only shows up on the second enrolment: a person who
-- already has a working authenticator and starts setting up a new phone would
-- overwrite the secret that currently works, and if they never finish, they are
-- locked out by the act of beginning.
--
-- So the active secret and the one being set up are different columns. A
-- pending secret becomes the active one at the moment a code verifies it, and
-- until then the old one keeps working. Starting an enrolment is not a
-- destructive act, which is the property that makes it safe to offer.
--
-- WHY THE SECRET IS ENCRYPTED AND THE RECOVERY CODES ARE HASHED
-- -------------------------------------------------------------
-- They are different kinds of secret and need different treatment.
--
-- A TOTP secret has to be READ to check a code, so it can only be encrypted,
-- reversibly, with a key that lives outside the database. A recovery code is
-- only ever compared, so it is hashed like a password and nothing can recover
-- it, which is strictly stronger.
--
-- The encryption is not theatre and it is not a defence against a live service
-- role key either, since anybody holding one can already create an
-- administrator. It defends the case that actually happens: a database copy
-- separated from the environment that produced it. A backup, an export, a
-- snapshot handed to somebody for debugging. The key is in Vercel and the rows
-- are in Postgres, so a copy of one without the other is inert.
--
-- The cost is a new way to be locked out, and it is not hidden: a missing or
-- changed MFA_ENCRYPTION_KEY means no code verifies. The application fails
-- closed and says so, in the same shape OPS_SESSION_SECRET already uses.
--
-- WHY last_step IS HERE AND WHAT IT REFUSES
-- ------------------------------------------
-- A TOTP code is valid for a window, so the same six digits work more than
-- once inside it. Somebody who reads a code over a shoulder, or off a screen
-- share, can use it again while it is still live.
--
-- last_step records the counter of the last step accepted for this person, and
-- a code from that step or earlier is refused. It costs one column and closes
-- the replay this scheme otherwise has by construction.
--
-- WHY THE REQUIREMENT IS A COLUMN ON eng_roles AND NOT A SETTINGS TABLE
-- ---------------------------------------------------------------------
-- Because it is a property of a role, and 0018 already made roles rows so the
-- owner can create them. A role created on the permission screen tomorrow gets
-- a requirement in the same insert as its landing path, rather than inheriting
-- whatever a separate table happened to say about a key nobody had added to it.
--
-- DEFAULT 'optional' AND THE TWO THAT ARE NOT
-- --------------------------------------------
-- The brief settles the administrator: that role moves money and changes
-- permissions. The operator ruled on the engineer on 2026-09-07, and the reason
-- is that the role carries the licence. A compromised engineer account is not a
-- data breach, it is somebody else acting inside the account of a named
-- Professional Engineer on the firm's regulatory record.
--
-- The cost is stated rather than minimised: a PE cannot review anything until
-- they have an authenticator app and their recovery codes. That falls on the
-- one person the firm most needs to be able to work, and the operator weighed
-- it and chose required.
--
-- Seeding those two as required means the existing administrator must enrol
-- before doing anything the moment this applies. That is the intended
-- behaviour and it is only safe because the enrolment path is reachable with a
-- half authenticated session; see the pending session in src/lib/ops-session.ts
-- and the routes mfa-audit asserts are open to one.
-- ===========================================================================

create table if not exists eng_mfa_enrolments (
  user_id            uuid primary key references eng_profiles (id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  /*
   * The active secret, AES-256-GCM, base64 as iv.tag.ciphertext. Null until a
   * code has verified it, which is the whole point: a row can exist without the
   * person being enrolled.
   */
  secret_cipher      text,
  verified_at        timestamptz,

  /* The one being set up. Never consulted when checking a sign in code. */
  pending_cipher     text,
  pending_started_at timestamptz,

  last_used_at       timestamptz,

  /* The highest TOTP step already accepted. A code at or below it is a replay. */
  last_step          bigint,

  constraint eng_mfa_enrolments_verified_iff_secret
    check ((secret_cipher is null) = (verified_at is null))
);

create index if not exists eng_mfa_enrolments_verified_idx
  on eng_mfa_enrolments (verified_at) where verified_at is not null;

drop trigger if exists eng_mfa_enrolments_touch on eng_mfa_enrolments;
create trigger eng_mfa_enrolments_touch before update on eng_mfa_enrolments
  for each row execute function eng_touch_updated_at();

alter table eng_mfa_enrolments enable row level security;

comment on table eng_mfa_enrolments is
  'One row per person with a second factor, active or being set up. The pending secret is separate from the active one so beginning an enrolment cannot lock somebody out of the one that works.';
comment on column eng_mfa_enrolments.secret_cipher is
  'AES-256-GCM under MFA_ENCRYPTION_KEY, as iv.tag.ciphertext in base64. Encrypted rather than hashed because verifying a code requires reading it back.';
comment on column eng_mfa_enrolments.last_step is
  'The highest TOTP step accepted. A code from that step or earlier is refused, which closes the replay a time window otherwise leaves open.';

create table if not exists eng_mfa_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references eng_profiles (id) on delete cascade,

  /* Hashed, because a recovery code is a credential and a table of them in the
   * clear is a table of passwords. */
  code_hash  text not null,

  /*
   * Marked rather than deleted, so the trail can say WHICH code was used and
   * when. A deleted row is a fact nobody can produce afterwards.
   */
  used_at    timestamptz,

  unique (user_id, code_hash)
);

create index if not exists eng_mfa_recovery_codes_live_idx
  on eng_mfa_recovery_codes (user_id) where used_at is null;

alter table eng_mfa_recovery_codes enable row level security;

comment on table eng_mfa_recovery_codes is
  'Single use recovery codes, hashed. Used codes are marked rather than removed so the audit trail can name the one that was spent.';

alter table eng_roles add column if not exists mfa_requirement text not null default 'optional'
  check (mfa_requirement in ('required', 'optional', 'off'));

comment on column eng_roles.mfa_requirement is
  'Whether this role must carry a second factor. A property of the role, so a role created on the permission screen gets one in the same insert as its landing path.';

/*
 * The two that are required. Written as an update rather than a default so the
 * other five keep 'optional' and the choice is visible in this file.
 */
update eng_roles set mfa_requirement = 'required' where key in ('admin', 'engineer');
