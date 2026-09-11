/*
 * 0041: A FILED DOCUMENT SAYS WHICH FIRM REGISTRATION IT WAS FILED UNDER.
 *
 * Operator ruling, 2026-09-10, the day TBPELS issued F-29811. The compliance
 * gate requires the registration number present in the public footer of all
 * three sites, in every email footer, and ON THE SEALED DOCUMENT UPLOAD RECORD,
 * before launch mode can flip.
 *
 * WHY THE RECORD AND NOT A RENDERED PAGE
 * --------------------------------------
 * The other two places are things a reader sees today and can be corrected
 * tomorrow. This one is different: a sealed deliverable is the firm's
 * regulatory output, it is uploaded rather than generated, and the question
 * somebody asks about it years later is "under whose registration was this
 * filed". A footer answers that for the site as it is NOW. Only the row answers
 * it for the document as it was THEN.
 *
 * A registration expires. F-29811 expires 2027-07-31. A document filed under it
 * is still a document filed under it after that date, and a system that
 * reconstructs the answer from today's configuration would quietly start giving
 * the wrong one.
 *
 * WHY IT IS NULLABLE, AND WHAT ENFORCES IT INSTEAD
 * ------------------------------------------------
 * Every document already in this table was filed before any registration
 * existed, and backfilling them with F-29811 would be inventing a fact: those
 * documents were NOT filed under it. Null means "filed before the firm was
 * registered", which is true and is the only honest value for them.
 *
 * A not null constraint would therefore be a lie about history. What holds the
 * rule going forward is the application, which writes the active registration
 * on every insert, and compliance-audit, which asserts it does and asserts the
 * gate cannot open while it does not.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a seal, and it does not make one. Nothing in this repository
 * composes a sealed document, and this column does not begin to: it records
 * which registration was in force when a row was filed, which is a fact about
 * the firm rather than an assurance about the work. The standing ruling that a
 * sealed document is uploaded and never generated is untouched.
 */

alter table eng_documents
  add column if not exists firm_registration text;

comment on column eng_documents.firm_registration is
  'The TBPELS firm registration in force when this row was filed, exactly as issued. Null means filed before the firm was registered, which is true of every row predating 2026-09-10 and is not a gap. Written by recordDocument from src/config/credentials.ts; never backfilled, because a document filed before a registration existed was not filed under it.';
