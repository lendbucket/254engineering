/**
 * A DESIGN BRIEF BECOMES A QUOTE REQUEST. Robert's answer 2 of 2026-10-27,
 * 11:48 Central (issue #1 comment 6447951314): a brief sent through
 * /design-inquiry is written to eng_design_inquiries, a separate table from
 * eng_quote_requests, so it never reached /portal/quotes. The inquiries screen
 * gains "start a quote from this brief", which opens a quote request carrying
 * the brief. The tables are not merged, on his answer.
 *
 * Pure, so scripts/proofs/a-brief-starts-one-quote-carrying-its-words.mjs can
 * read it without a database. The act itself is startQuoteFromBrief in
 * ops-inquiries.ts.
 */

/** The design line every brief is quoted on (data/catalog.ts). */
export const DESIGN_SERVICE = "residential-light-commercial-design";

/**
 * The quote request's idempotency key. requestQuote returns the existing
 * request for a key it has seen, so one brief opens one quote however many
 * times the button is pressed, and the quote names the brief it came from
 * without a column joining the two tables.
 */
export const briefQuoteRequestId = (inquiryId: string) => `design-inquiry:${inquiryId}`;

/* The brief's own words for its coded answers. The inquiries screen renders these too. */
export const ASKING_AS: Record<string, string> = {
  owner: "Owner",
  builder: "Builder",
  architect: "Architect",
  engineer: "Engineer",
};

export const WORK_KIND: Record<string, string> = {
  new_construction: "New construction",
  addition: "Addition",
  repair: "Repair",
  remediation: "Remediation",
};

export const DELIVERABLE: Record<string, string> = {
  sealed_plans: "Sealed plans",
  sealed_letter: "Sealed letter",
  repair_specification: "Repair specification",
  design_review: "Design review",
};

export type BriefForQuote = {
  asking_as: string;
  work_kind: string;
  deliverable: string;
  jurisdiction: string | null;
  square_feet: number | null;
  storeys: number | null;
  drawings: string | null;
  soil_report: boolean | null;
  permit_status: string | null;
  deadline: string | null;
  open_insurance_claim: boolean;
  active_litigation: boolean;
  prior_adverse_report: boolean;
};

/**
 * The quote request's brief, written from the design brief's answers.
 *
 * EVERY ANSWER IS CARRIED, AND AN UNANSWERED ONE SAYS SO. A line left out reads
 * the same as a question nobody asked, and the person scoping the quote would
 * then ask the customer again or, worse, assume. So a missing square footage
 * reads "not given", and a soil report nobody mentioned reads "not said", which
 * is a different fact from "no".
 *
 * THE THREE FLAGS ARE CARRIED BY NAME, yes or no, because they are the answers
 * that decide whether the firm takes the work at all, and a quote started from
 * a brief that carried an open claim must not lose it on the way across.
 */
export function composeQuoteBrief(b: BriefForQuote): string {
  const given = (v: string | number | null | undefined) =>
    v === null || v === undefined || String(v).trim() === "" ? "not given" : String(v).trim();
  const yesNo = (v: boolean | null) => (v === null ? "not said" : v ? "yes" : "no");
  return [
    "Started from a design brief sent through the site.",
    `Asking as: ${ASKING_AS[b.asking_as] ?? b.asking_as}`,
    `Work: ${WORK_KIND[b.work_kind] ?? b.work_kind}`,
    `Asked for: ${DELIVERABLE[b.deliverable] ?? b.deliverable}`,
    `Jurisdiction: ${given(b.jurisdiction)}`,
    `Square feet: ${given(b.square_feet)}`,
    `Stories: ${given(b.storeys)}`,
    `What they have: ${given(b.drawings)}`,
    `Soil report: ${yesNo(b.soil_report)}`,
    `Permit status: ${given(b.permit_status)}`,
    `Their date: ${given(b.deadline)}`,
    `Open insurance claim: ${yesNo(b.open_insurance_claim)}`,
    `Active or threatened litigation: ${yesNo(b.active_litigation)}`,
    `Prior adverse report: ${yesNo(b.prior_adverse_report)}`,
  ].join("\n");
}
