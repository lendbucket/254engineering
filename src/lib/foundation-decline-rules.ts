/**
 * A REFUSAL IS ANSWERED BY A LETTER ONLY WHEN THE ENGINEER RECORDED A 254-FC-001
 * DECLINE. Robert's ruling Q4 of 2026-11-02, from audit field F12: "decide
 * letters-instead from the FC-001 determination, refund otherwise."
 *
 * review.after_decision skipped the refund for every foundation-inspections
 * file, by service slug, while the letter that replaces the refund exists only
 * when a 254-FC-001 decline was recorded. A foundation file refused with no
 * governing determination (taken before the protocol row was published, or run
 * under another template) was then neither refunded nor given a letter, and no
 * screen said which was owed.
 *
 * WHY "THE FILE CARRIES ONE" IS THE SAME QUESTION AS "THIS DECISION RECORDED
 * ONE". A decline determination moves the file to refused, and a refused file
 * never returns to review (TRANSITIONS.refused in ops-files.ts), so a file can
 * carry a 254-FC-001 decline only from the decision that refused it. The job
 * runs after that decision's transaction commits, so the row is there to read.
 */
export type DeterminationFact = { protocol_document: string | null; determination: string | null };

export function lettersInsteadOfRefund(determinations: readonly DeterminationFact[]): boolean {
  return determinations.some((d) => d.protocol_document === "254-FC-001" && d.determination === "decline");
}
