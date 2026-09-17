/*
 * A SIGNED PROTOCOL AWAITING PLATFORM APPROVAL IS NOT A DRAFT.
 * Operator ruling, 2026-09-16.
 *
 * WHY THIS IS A MIGRATION AND NOT A CONVENTION
 * --------------------------------------------
 * eng_protocol_templates has carried status in ('draft', 'published',
 * 'retired') since 0001. 254-RC-001 v1.0 is SIGNED by the engineer of record,
 * dated 09/14/2026, and in force as a document. It has not been approved in the
 * platform, because only Aman can do that and only through his own account.
 *
 * None of the three existing words is true of it. "published" would claim an
 * approval nobody has given. "retired" is absurd. "draft" is the one somebody
 * would reach for, and it is a LIE about the thing this whole system rests on:
 * draft means the engineer has not signed.
 *
 * So there are two facts and there are now two states:
 *
 *   draft              the engineer has not signed the document
 *   awaiting_engineer  he has signed it, and has not yet approved it here
 *
 * THE GENERAL FORM, AND IT IS THE REASON THIS COMMENT IS LONG. A status
 * vocabulary that lacks a word for the situation you are in makes somebody
 * choose the nearest lie. It is the same defect as a null meaning two things,
 * which cost this platform a real correction in bulk-order.ts when "no total
 * can be stated" and "nothing was accepted" were made indistinguishable. The
 * answer both times is to add the word rather than to overload the one nearby.
 *
 * WHAT THE CONSTRAINTS ENFORCE, so it is not a convention anybody can forget:
 *
 *   1. A record whose document carries a signature cannot sit in draft.
 *      document_signed_at is the date on the paper. If it is set, the engineer
 *      HAS signed, and draft is then false on its face.
 *
 *   2. A record in awaiting_engineer is not in force, and cannot be dispatched
 *      against. In force means published WITH an approval recorded, so
 *      awaiting_engineer carries neither published_at nor an approver, and the
 *      database refuses a row that claims otherwise.
 *
 *   3. A published record must name who approved it and when. A protocol in
 *      force with no approver is the state this migration exists to make
 *      impossible.
 *
 * NOTHING IS APPROVED BY THIS MIGRATION. It adds the shape. The approval is an
 * act by a named engineer in his own session, and a seeder that performed it
 * would be the forgery this platform refuses to build.
 */

alter table eng_protocol_templates
  add column if not exists document_number   text,
  add column if not exists version_label     text,
  add column if not exists issue_date        date,
  add column if not exists document_sha256   text,
  add column if not exists firm_name_on_document text,
  add column if not exists requires_discipline   text,
  /* The date on the paper the engineer signed. Null means unsigned. */
  add column if not exists document_signed_at    date,
  /* The platform approval. All three move together or none of them do. */
  add column if not exists approved_by       uuid references eng_profiles(id) on delete restrict,
  add column if not exists approved_at       timestamptz,
  add column if not exists approved_by_license text;

/*
 * The new state. Dropped and recreated rather than altered, because a check
 * constraint cannot be widened in place.
 */
alter table eng_protocol_templates
  drop constraint if exists eng_protocol_templates_status_check;

alter table eng_protocol_templates
  add constraint eng_protocol_templates_status_check
  check (status in ('draft', 'awaiting_engineer', 'published', 'retired'));

/*
 * 1. A signed document cannot sit in draft.
 */
alter table eng_protocol_templates
  drop constraint if exists eng_protocol_templates_signed_is_not_draft_ck;

alter table eng_protocol_templates
  add constraint eng_protocol_templates_signed_is_not_draft_ck
  check (document_signed_at is null or status <> 'draft');

/*
 * 2. awaiting_engineer is not in force: no approval, no publication date. A
 *    dispatch reads an in-force protocol, so a row in this state cannot be
 *    dispatched against because it cannot claim to be in force.
 */
alter table eng_protocol_templates
  drop constraint if exists eng_protocol_templates_awaiting_is_not_in_force_ck;

alter table eng_protocol_templates
  add constraint eng_protocol_templates_awaiting_is_not_in_force_ck
  check (
    status <> 'awaiting_engineer'
    or (approved_by is null and approved_at is null and published_at is null)
  );

/*
 * 3. In force means somebody approved it, named, with a date. A published row
 *    missing either is the state this migration exists to prevent.
 */
alter table eng_protocol_templates
  drop constraint if exists eng_protocol_templates_published_is_approved_ck;

alter table eng_protocol_templates
  add constraint eng_protocol_templates_published_is_approved_ck
  check (
    status <> 'published'
    or (approved_by is not null and approved_at is not null and published_at is not null)
  );

comment on column eng_protocol_templates.document_signed_at is
  'The date on the signed document. Null means the engineer has not signed it. A row with this set may not be draft.';

comment on column eng_protocol_templates.approved_by is
  'The engineer who approved this protocol IN THE PLATFORM, through his own account. Never a seeder, never the operator on his behalf. Restrict on delete: a protocol in force must keep naming its approver.';

comment on column eng_protocol_templates.requires_discipline is
  'The discipline an engineer must declare competence in before this protocol may be offered. Declared by the engineer, never inferred from the service line name.';

comment on constraint eng_protocol_templates_signed_is_not_draft_ck on eng_protocol_templates is
  'Draft means the engineer has not signed. awaiting_engineer means he has signed and has not yet approved it here. A status vocabulary missing a word for the situation makes somebody choose the nearest lie.';
