/*
 * ===========================================================================
 * 0054  A WINDSTORM BRIEF IS ITS OWN RECORD, AND ITS RULE IS A DATE OF WORK.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-20 and 2026-09-21.
 *
 * WHY THIS IS NOT eng_design_inquiries WITH MORE COLUMNS. The two tables
 * overlap and THE QUESTIONS ARE NOT THE SAME QUESTIONS. A design brief asks
 * what is being built, what the deliverable is, whether drawings exist and
 * whether there is a soil report. A windstorm brief on an existing building
 * asks when the work was done, what is covered up, whether the doors and
 * windows are rated, and whether the owner will open things up to verify.
 * Half of these have no column over there.
 *
 * Forcing them in would mean either windstorm columns null on every design row,
 * or a column answering a question it was not named for. Both are the shape
 * this schema spends its time removing.
 *
 * EVERY QUESTION HERE IS THE ENGINEER OF RECORD'S, from his reply of
 * 2026-09-20. They are not a guess at what scoping needs.
 *
 * ---------------------------------------------------------------------------
 * THE DATE OF THE WORK IS THE RULE. THE YEAR BUILT IS CONTEXT.
 * ---------------------------------------------------------------------------
 *
 * Tex. Ins. Code 2210.251, as the firm's own published page at
 * /insights/twia-coverage-homes-built-before-1988 reads it, turns on the date
 * of the WORK: "a structure constructed, altered, remodeled, enlarged, or
 * repaired, or to which additions are made, on or after January 1, 1988". The
 * list of verbs is the point, and a structure can have more than one date.
 *
 * The first encoding asked for the CONSTRUCTION YEAR and compared that to 1988,
 * which told the owner of a 1975 house with a 2021 reroof that the building
 * could not be certified. The statute reaches that reroof. That is the
 * commonest legitimate enquiry this form exists to receive, and it was being
 * turned away.
 *
 * So `year_built` is nullable context the engineer may want, and
 * `most_recent_work_year` is what the rule reads. The most recent piece of work
 * is sufficient and that is exact rather than a simplification: if it reaches
 * the line the structure is in scope, and if it predates the line everything
 * earlier does too.
 *
 * THE AUTHORITY IS SECOND HAND AND IS NAMED AS SUCH. That page was written by a
 * session and has not been checked against the statute by a person. 2210.251 is
 * in the bundle for the engineer of record to confirm after orientation.
 *
 * ---------------------------------------------------------------------------
 * NO PRICE AND NO ORDER, WHICH IS WHY THIS IS A BRIEF.
 * ---------------------------------------------------------------------------
 *
 * Only buildings whose work reaches the line can be certified at all, the work
 * is already covered so parts of it must be opened to verify, and the openings
 * may need replacing first. None of that is knowable from a form, so this
 * table records a conversation to be had and never a job to be done.
 */

create table if not exists eng_windstorm_inquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  /* Who is asking, and in what capacity. */
  name          text not null,
  email         text not null,
  phone         text,
  asking_as     text not null,

  /* Which property. County matters: the catastrophe area is fourteen counties
     plus part of Harris, and twiaStatus() answers "check" for Harris because a
     county name cannot express where a property sits relative to a highway. */
  property_address text not null,
  county        text,

  /*
   * CONTEXT, NOT THE TEST. Nullable on purpose: a person who does not know when
   * their house went up is the ordinary case, and the rule does not read this.
   */
  year_built    integer,

  /*
   * THE TEST. Null means nobody has dated the work, which is a third state and
   * not a no: it routes to the same conversation as in-scope work rather than
   * to a refusal, and the date is established from the permit or the appraisal
   * record rather than from memory.
   */
  most_recent_work_year integer,

  /* What was done, what is already covered, in the person's own words. */
  work_done     text not null,
  what_is_covered text not null,

  /* The engineer's two remaining questions, both constrained below. */
  openings_rated text not null,
  will_open_up  text not null,

  /* The deadline the customer is working to, as they stated it. */
  deadline      text,

  /*
   * THE THREE FLAGS. Not null and with no default, exactly as 0050 has them,
   * because "nobody answered" and "they said no" are different and the form
   * makes all three required. A null here would be the absent-versus-zero
   * defect on the questions that decide whether the firm declines.
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
 * Who is asking, constrained. The five the form offers and nothing else: a
 * sixth arriving means somebody changed the form without changing the record of
 * what the form may say.
 */
alter table eng_windstorm_inquiries
  drop constraint if exists eng_windstorm_inquiries_asking_as_ck;
alter table eng_windstorm_inquiries
  add constraint eng_windstorm_inquiries_asking_as_ck
  check (asking_as in ('owner', 'buyer', 'agent', 'builder', 'contractor'));

/*
 * WHETHER THE OPENINGS ARE RATED HAS FOUR ANSWERS AND TWO OF THEM ARE YES.
 * Rated with paperwork and rated without it are different jobs: the second
 * needs the rating established before anything can rest on it. Folding them
 * into one "yes" would lose the distinction the engineer asked the question
 * for, and "unknown" is a real answer rather than a no.
 */
alter table eng_windstorm_inquiries
  drop constraint if exists eng_windstorm_inquiries_openings_rated_ck;
alter table eng_windstorm_inquiries
  add constraint eng_windstorm_inquiries_openings_rated_ck
  check (openings_rated in ('yes_documented', 'yes_undocumented', 'no', 'unknown'));

/*
 * WILL THE OWNER OPEN THINGS UP. "It needs discussing" is its own answer and
 * not a soft no: an owner who has not been asked yet is the common case, and
 * recording it as "no" would close an enquiry the firm could have taken.
 */
alter table eng_windstorm_inquiries
  drop constraint if exists eng_windstorm_inquiries_will_open_up_ck;
alter table eng_windstorm_inquiries
  add constraint eng_windstorm_inquiries_will_open_up_ck
  check (will_open_up in ('yes', 'no', 'need_to_discuss'));

/*
 * A YEAR THAT IS PRESENT IS A PLAUSIBLE YEAR. Not a range anybody polices by
 * hand: 1800 to 2100 refuses a typo and a zero, and a zero is what an empty
 * form field becomes if anything ever coerces it.
 */
alter table eng_windstorm_inquiries
  drop constraint if exists eng_windstorm_inquiries_years_are_plausible_ck;
alter table eng_windstorm_inquiries
  add constraint eng_windstorm_inquiries_years_are_plausible_ck
  check (
    (year_built is null or (year_built between 1800 and 2100))
    and (most_recent_work_year is null or (most_recent_work_year between 1800 and 2100))
  );

/*
 * AND WORK CANNOT PREDATE THE BUILDING IT WAS DONE TO. Where both are known,
 * the work is on or after the year built. This is the one relationship between
 * the two columns, and it is the one a typo in either would break.
 */
alter table eng_windstorm_inquiries
  drop constraint if exists eng_windstorm_inquiries_work_after_building_ck;
alter table eng_windstorm_inquiries
  add constraint eng_windstorm_inquiries_work_after_building_ck
  check (
    year_built is null
    or most_recent_work_year is null
    or most_recent_work_year >= year_built
  );

/*
 * A RESPONSE IS NAMED OR IT DID NOT HAPPEN. The same shape 0050 gave the design
 * brief and 0049 gave an approval: a record saying somebody was contacted
 * without saying who contacted them is the `customer_link.issued` defect
 * wearing different columns, and that one cost a paying customer a telephone
 * call to find out nothing had been sent.
 */
alter table eng_windstorm_inquiries
  drop constraint if exists eng_windstorm_inquiries_response_is_named_ck;
alter table eng_windstorm_inquiries
  add constraint eng_windstorm_inquiries_response_is_named_ck
  check (
    (responded_at is null and responded_by is null)
    or (responded_at is not null and responded_by is not null)
  );

alter table eng_windstorm_inquiries enable row level security;

create index if not exists eng_windstorm_inquiries_respond_by_idx
  on eng_windstorm_inquiries (respond_by)
  where responded_at is null;

comment on table eng_windstorm_inquiries is
  'A windstorm brief on an existing building, from the public site. Never an order and never a quote: whether the structure can be certified at all turns on what is covered up and what can be opened to verify it, and a form cannot answer that.';

comment on column eng_windstorm_inquiries.year_built is
  'Context for the engineer, NOT the eligibility test. Tex. Ins. Code 2210.251 turns on the date of the work, not the year the structure went up.';

comment on column eng_windstorm_inquiries.most_recent_work_year is
  'The test. Work on or after January 1, 1988 is in scope whatever year the building went up. Null means nobody has dated it, which routes to the same conversation rather than to a refusal.';

comment on column eng_windstorm_inquiries.respond_by is
  'The 24 hour contact promise, as a column rather than a convention. A promise recorded nowhere is one nobody is accountable for.';

comment on constraint eng_windstorm_inquiries_work_after_building_ck on eng_windstorm_inquiries is
  'Work cannot predate the building it was done to. The one relationship between the two year columns, and the one a typo in either would break.';
