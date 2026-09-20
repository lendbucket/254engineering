/*
 * A DESIGN INQUIRY IS NOT AN ORDER, AND IT IS NOT A LEAD EITHER.
 * Operator specification, 2026-09-17, built 2026-09-18.
 *
 * WHY THIS IS ITS OWN TABLE RATHER THAN eng_leads
 * -----------------------------------------------
 * eng_leads carries name, email, phone, city, service and a free text message.
 * That is the right shape for "somebody asked about roof certifications". A
 * design inquiry is eleven defined answers, three of which decide whether the
 * firm takes the work at all, and burying them in a message column or a jsonb
 * blob means nothing can constrain them and nobody can query them.
 *
 * The three that matter are the flags: an open insurance claim, active
 * litigation, and a prior adverse report. Each changes what the work IS, and
 * the operator's specification says the customer is told in the first
 * conversation rather than after paying. A column can be checked; a key inside
 * a blob cannot.
 *
 * This follows 0016's reasoning about eng_file_inputs and eng_order_inputs,
 * which deliberately duplicate shape because one is a working record and the
 * other is checkout evidence. Here the distinction is that a lead is a contact
 * and this is a brief.
 *
 * WHAT IT DOES NOT DO, AND BOTH ARE THE SPECIFICATION
 * ---------------------------------------------------
 * It never produces an order, and it never quotes a price. Design is $225 an
 * hour with a fixed fee quoted from the engineer's estimate and a $2,000
 * minimum engagement, and none of those numbers can be turned into a quote by
 * a form. The row records what was asked and when somebody must respond.
 *
 * THE 24 HOUR PROMISE IS A COLUMN, NOT A CONVENTION
 * --------------------------------------------------
 * `respond_by` is not null and defaults to 24 hours after the row is created.
 * A promise recorded nowhere is a promise nobody is accountable for, and this
 * platform has already met that failure once: `customer_link.issued` recorded a
 * database write and read as evidence somebody had been contacted.
 *
 * `responded_at` is separate and nullable, because "we said we would" and "we
 * did" are two facts and folding them into one is how a queue starts lying.
 *
 * AND THE TASK IS RAISED FROM THIS ROW RATHER THAN BY THE PUBLIC ROUTE.
 * Operator ruling, 2026-09-18: a public route minting a staff task would mean
 * an unauthenticated request acting as a privileged principal, which is a
 * bigger door than this feature is worth. The row carries the promise; an
 * operator raises the task from it.
 */

create table if not exists eng_design_inquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  /* Who is asking, and in what capacity. */
  name          text not null,
  email         text not null,
  phone         text,
  /* owner, builder, architect, engineer. Constrained below. */
  asking_as     text not null,

  /* What is being built or altered. */
  work_kind     text not null,
  deliverable   text not null,
  property_address text not null,
  jurisdiction  text,
  square_feet   integer,
  storeys       integer,

  /* What already exists. */
  drawings      text,
  soil_report   boolean,
  permit_status text,

  /* The deadline the customer is working to, as they stated it. */
  deadline      text,

  /*
   * THE THREE FLAGS. Not null with a default of false, because "nobody
   * answered" and "they said no" are different and the form makes all three
   * required. A null here would be the absent-versus-zero defect on the three
   * questions that decide whether the firm declines.
   */
  open_insurance_claim boolean not null,
  active_litigation    boolean not null,
  prior_adverse_report boolean not null,

  /* The promise, and whether it was kept. Two facts, two columns. */
  respond_by    timestamptz not null default (now() + interval '24 hours'),
  responded_at  timestamptz,
  responded_by  uuid references eng_profiles(id) on delete restrict,

  /* Provenance, the same set every public form records. */
  landing_path  text,
  referrer      text,
  user_agent    text,

  status        text not null default 'new'
);

/*
 * Who is asking, constrained. The four the specification names and nothing
 * else: a fifth arriving means somebody changed the form without changing the
 * record of what the form may say.
 */
alter table eng_design_inquiries
  drop constraint if exists eng_design_inquiries_asking_as_ck;
alter table eng_design_inquiries
  add constraint eng_design_inquiries_asking_as_ck
  check (asking_as in ('owner', 'builder', 'architect', 'engineer'));

/*
 * What is being built, and what the customer wants out of it. Both from the
 * specification.
 */
alter table eng_design_inquiries
  drop constraint if exists eng_design_inquiries_work_kind_ck;
alter table eng_design_inquiries
  add constraint eng_design_inquiries_work_kind_ck
  check (work_kind in ('new_construction', 'addition', 'repair', 'remediation'));

alter table eng_design_inquiries
  drop constraint if exists eng_design_inquiries_deliverable_ck;
alter table eng_design_inquiries
  add constraint eng_design_inquiries_deliverable_ck
  check (deliverable in ('sealed_plans', 'sealed_letter', 'repair_specification', 'design_review'));

/*
 * A RESPONSE IS NAMED OR IT DID NOT HAPPEN. responded_at and responded_by move
 * together, which is the same shape 0049 gave an approval: a record that says
 * somebody was contacted without saying who contacted them is the
 * `customer_link.issued` defect wearing different columns.
 */
alter table eng_design_inquiries
  drop constraint if exists eng_design_inquiries_response_is_named_ck;
alter table eng_design_inquiries
  add constraint eng_design_inquiries_response_is_named_ck
  check (
    (responded_at is null and responded_by is null)
    or (responded_at is not null and responded_by is not null)
  );

alter table eng_design_inquiries enable row level security;

create index if not exists eng_design_inquiries_respond_by_idx
  on eng_design_inquiries (respond_by)
  where responded_at is null;

comment on table eng_design_inquiries is
  'A design brief from the public site. Never an order and never a quote: design is hourly with a minimum engagement, and a form cannot price it.';

comment on column eng_design_inquiries.respond_by is
  'The 24 hour contact promise, as a column rather than a convention. A promise recorded nowhere is one nobody is accountable for.';

comment on constraint eng_design_inquiries_response_is_named_ck on eng_design_inquiries is
  'A response is named or it did not happen. Recording that somebody was contacted without recording who is the customer_link.issued defect in different columns.';
