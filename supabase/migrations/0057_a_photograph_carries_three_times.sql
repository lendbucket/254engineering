/*
 * ===========================================================================
 * 0057  A PHOTOGRAPH CARRIES THREE TIME VALUES, AND SAYS WHEN THEY DISAGREE.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-22, from the section 9 walk of 254-RC-001 v1.1.
 *
 * WHAT THE SIGNED PROTOCOL REQUIRES, quoted:
 *
 *   "Photographs carry location and three time values from the field
 *    application: the time reported by the device, the server time at sync,
 *    and the difference between them. A device clock that disagrees with the
 *    server is recorded as disagreeing rather than presented as certain."
 *
 * WHAT THE PLATFORM HAD. Two of the three. `captured_at` is the device clock,
 * written by the capture screen at the moment of capture. `created_at` is the
 * server clock at insert. The DIFFERENCE was neither stored nor shown, and
 * nothing anywhere marked a clock as disagreeing.
 *
 * WHY THE DIFFERENCE IS STORED RATHER THAN COMPUTED ON READ, which was the
 * operator's ruling and is the whole point of this migration. Computing
 * `created_at - captured_at` at read time gives the same number today and a
 * DIFFERENT one after any backfill, restore, or row rewrite that moves
 * `created_at`. The protocol asks what was true AT SYNC. A derived column
 * would answer what is true at the moment somebody looks, which is a different
 * question and is exactly the kind of substitution that reads as equivalent
 * until the day it matters.
 *
 * AND IT IS THE EVIDENTIAL POINT. This row is part of a package a Professional
 * Engineer reaches a determination from, and a photograph's time is how
 * anybody later establishes what was observed and when. A number that can
 * change after the fact is not evidence of anything.
 *
 * THE FLAG IS A SEPARATE COLUMN FROM THE NUMBER, and that is deliberate. The
 * number is a measurement; the flag is a JUDGEMENT about the measurement
 * against a threshold, and folding the judgement into the number would mean
 * every reader re-deriving the threshold and some of them getting it wrong.
 * `clock_disagrees` is written by the same code that writes the skew, under
 * one rule, in one place.
 *
 * NOTHING IS BACKFILLED. Rows captured before this migration have no skew and
 * no flag, and both read NULL, which is "nobody measured it" rather than
 * "there was no disagreement". Inventing a zero for them would put a
 * measurement on the regulatory record that nobody took. `clock_disagrees`
 * being null is therefore a third state and the screens say so.
 */

alter table eng_evidence_items
  /*
   * Signed, and it can be negative: a device clock AHEAD of the server is just
   * as much a disagreement as one behind, and is the commoner direction on a
   * phone somebody has set manually. An unsigned column would have to throw
   * away the direction or lie about it.
   */
  add column if not exists clock_skew_seconds integer,
  /*
   * NULL means nobody measured. TRUE and FALSE both mean somebody did.
   * Three states on purpose, for the rows that predate this migration.
   */
  add column if not exists clock_disagrees boolean;

comment on column eng_evidence_items.clock_skew_seconds is
  'Device clock minus server clock at sync, in seconds, signed. Written once at insert, never derived on read: 254-RC-001 section 9 asks what was true AT SYNC, and a value computed later answers a different question. Null means nobody measured it.';

comment on column eng_evidence_items.clock_disagrees is
  'Whether the device clock disagreed with the server beyond the ruled tolerance at sync. A judgement about the measurement, kept separate from the measurement. Null means nobody measured it, which is not the same as no disagreement.';

/*
 * AND THE TWO MOVE TOGETHER OR NEITHER IS TRUSTWORTHY.
 *
 * A row carrying a skew with no verdict, or a verdict with no skew, is a row
 * whose two halves were written by different code paths, which is how a
 * measurement and its judgement start to disagree. The constraint makes that
 * unrepresentable rather than a thing a reader has to check for.
 *
 * Both null is allowed, and is the pre-migration state.
 */
alter table eng_evidence_items
  drop constraint if exists eng_evidence_items_clock_pair_ck;

alter table eng_evidence_items
  add constraint eng_evidence_items_clock_pair_ck
  check (
    (clock_skew_seconds is null and clock_disagrees is null)
    or (clock_skew_seconds is not null and clock_disagrees is not null)
  );

comment on constraint eng_evidence_items_clock_pair_ck on eng_evidence_items is
  'The skew and its verdict are written together or not at all. One without the other is two code paths disagreeing about one fact.';
