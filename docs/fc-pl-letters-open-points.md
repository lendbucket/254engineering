# Foundation and permit letters: what is built, and what waits on a ruling

Written 2026-10-23 on `feat/fc-pl-letters`, against the engineer's answered
letter templates file (`254_Letter_Templates.docx`, the 2026-10-06 file:
template 4 is foundation certification, template 7 the structural letter for
permit). His answers are the `[ENGINEER: ...]` notes in that file, and only his
words go on a letter.

## Built on this branch

**Determination recording.** A review of a file worked to 254-FC-001 or
254-PL-001 records one of the five Appendix C determinations with the items and
evidence it rested on, exactly as a roof review does, while the file's protocol
row is published (in force by his portal signature since 0081). The rules come
from the structured declaration he signed. For PL, a pass records option A
(no conditions) or B (at least one condition in the schedule), and repairs
required records option C, held by 0083 at the database. Proved by
`scripts/proofs/fc-and-pl-reviews-record-a-determination.mjs`.

Nothing opens: both lines stay unoffered, and letter sealing is still roof only.

## FC letter (template 4): four points for a ruling

1. **Which determination produces option C.** His option C reads "this firm
   declines to certify the foundation. The reason is stated above." FC-001's
   own DECLINE determination is declining the job (open claim, litigation,
   ongoing construction, a predetermined conclusion), and the firm's standing
   decision is that a declined job gets an email with the reason and a refund,
   never a sealed letter. Robert's FC ruling makes B and C sealed findings
   letters. So either C belongs to a determination Appendix C does not name, or
   to DECLINE with the standing decision changed for FC. Pass maps to A and
   repairs required to B without a question.
2. **Recipient and purpose.** The letter is "addressed to {{recipient_name}}
   for the purpose recorded at intake: {{purpose_verbatim}}". FC-001's intake
   asks neither, and the template itself lists "Recipient and purpose, verbatim:
   no structured field". Adding the questions is a firm intake field outside his
   protocol, which needs a ruling; the roof line asks them in RC-001's own intake.
3. **Foundation type.** The letter states it, and the template says it "must be
   recorded on the file rather than typed by whoever drafts it". Intake holds it
   only inside one combined free text answer ("Year built; foundation type
   (slab-on-grade / pier-and-beam / crawlspace); year of any prior foundation
   repair"), so reading it out would be parsing a customer's sentence.
4. **Method for a crawlspace foundation.** His closed set is two values:
   "Visual inspection with relative elevation survey." and, for pier and beam,
   "Visual inspection with relative elevation survey and crawlspace
   inspection." Intake offers crawlspace as a third foundation type, and his
   answer does not say which method it takes.

The observed condition is his to write at sealing ("The platform will not
write this"), typed in his own session, as the roof letter's recipient address
is.

## PL letter (template 7): five points for a ruling

1. **Permit number and authority, separately.** The letter prints
   {{authority_name}} and {{permit_number}} apart; PL-001's intake asks for both
   in one answer ("Which city or county is the permit with, and what is the
   permit or application number?").
2. **The authority's address and salutation.** Not asked anywhere. The roof
   letter's equivalent is typed by the engineer at sealing; a ruling decides
   whether this one is too.
3. **The element described.** The letter names {{element_described}}; intake
   asks a category ("beam / wall removal / deck / ..."), not a description.
4. **Visit or desk.** His answer: "I triage every job within one business day
   of the order, as a site job or a desk job." Nothing records that triage
   decision, and the letter's two basis sentences ("was inspected on..." and "No
   site visit was made") must not be inferred from whether evidence exists.
5. **The schedules.** A desk job's letter rests on "the documents listed in the
   attached schedule", and option B on "the conditions in the attached
   schedule". The conditions are recorded (0083); the documents schedule has no
   record. And "I write the capture list for each job": a per job capture list
   composed by him does not exist in the portal.
