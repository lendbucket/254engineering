/*
 * 0133: A COPY CONTACT GETS THE SEALED LETTER, AND NOTHING ELSE OF THE ORDER.
 *
 * The Killeen call, item 7, with Robert's answer 3 of 2026-11-14 (6878458673):
 * "copies get a link to the sealed letter alone, through the same check as the
 * customer's download, nothing else of the order". The customer's own status
 * link opens the whole order page (what was paid, refunds, the timeline, an
 * upload), so a lender or agent named on the job gets a link of its own.
 *
 * One table, eng_letter_links: one row per contact per letter sent.
 *
 *   order_id      the order the letter belongs to; the download asks
 *                 customerLetterFor(order, document), the customer's own check,
 *                 so a voided seal or a changed document refuses here too.
 *   document_id   the one sealed letter this link opens.
 *   contact_id    who it was sent to (0132).
 *   token_hash    sha256 of the token in the email, never the token.
 *   expires_at    long lived, as the customer's link is: revocation is the
 *                 control, not a short expiry that sends somebody back to ask.
 *   revoked_at    set to stop a link.
 *   last_seen_at  moved on every open, so the file can say a copy was opened.
 *
 * Row level security on and no policy, as every eng_ table. Kept pending
 * counsel: who was given a sealed letter is a fact about the past. Additive.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if to_regclass('public.eng_file_contacts') is null then
    raise exception 'eng: 0133 follows 0132, which adds eng_file_contacts. It does not exist here.';
  end if;
end;
$$;

/* ------------------------------------------------------------- 1. the table */
create table if not exists eng_letter_links (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  order_id      uuid not null references eng_service_orders(id) on delete cascade,
  document_id   uuid not null references eng_documents(id) on delete cascade,
  contact_id    uuid not null references eng_file_contacts(id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  last_seen_at  timestamptz
);

comment on table eng_letter_links is
  'A link to one sealed letter for one copy contact, opening that letter and nothing else of the order (0133).';

create index if not exists eng_letter_links_contact_idx on eng_letter_links (contact_id);

alter table eng_letter_links enable row level security;

/* Closed to every API role, as every eng_ table since 0100: read and written through the service role only. */
revoke all on eng_letter_links from public, anon, authenticated;
