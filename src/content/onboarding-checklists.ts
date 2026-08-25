/**
 * The onboarding checklists, one per role.
 *
 * THE ABSOLUTE RULE, WHICH THIS FILE IS THE FIRST LINE OF
 * -------------------------------------------------------
 * No item in this file asks for a Social Security number, and none ever may.
 * The W-4 and the I-9 both involve an SSN inherently. Those forms arrive as
 * DOCUMENT UPLOADS into the private eng-onboarding bucket and are never read,
 * parsed, extracted, indexed, or displayed. There is no SSN column in the
 * database, no SSN field in any form, and no OCR anywhere in this system.
 *
 * The distinction matters and is easy to lose: the firm needs the completed
 * form, it does not need the number off the form. Storing the document and
 * storing the number are different obligations, and only one of them is
 * necessary.
 *
 * scripts/forms-audit.mjs asserts mechanically that no input on any onboarding
 * surface is named or labelled anything SSN like.
 *
 * WHY THE CHECKLIST IS DATA AND NOT MARKUP
 * ----------------------------------------
 * These entries are copied into eng_onboarding_items when an onboarding is
 * created, and the flow then renders the ROWS rather than this file. That
 * indirection is the point: the operator can add an item for one hire without a
 * deploy, an item can be marked accepted or rejected per person, and a checklist
 * that changes later does not retroactively rewrite what an earlier hire was
 * asked for.
 *
 * WHO COMPLETES WHAT
 * ------------------
 * `actor: "person"` items are uploaded by the person being onboarded.
 * `actor: "admin"` items are verified by the operator and never appear in the
 * invite flow. Two of them exist because federal and practical procedure require
 * a human in the room: I-9 document examination has to be done live, and
 * identity is confirmed on the scheduled video call rather than by asking
 * somebody to photograph themselves holding their licence.
 */

export type OnboardingRole = "engineer" | "field_tech";

export type ChecklistItem = {
  /** Stable key. Written to eng_onboarding_items.item_key; never renamed. */
  key: string;
  label: string;
  /** One or two sentences shown under the label in the flow. */
  help: string;
  actor: "person" | "admin";
  /** An external form the person needs in order to complete the item. */
  reference?: { label: string; url: string };
  /**
   * A short free text field collected alongside the upload.
   *
   * Used sparingly and never for anything sensitive. Bank name and account type
   * are here; account and routing numbers are NOT, and live only inside the
   * uploaded document.
   */
  fields?: { name: string; label: string; placeholder?: string }[];
  /** No upload expected. The person reads something and acknowledges it. */
  acknowledgeOnly?: boolean;
};

const ENGINEER: ChecklistItem[] = [
  {
    key: "photo_id_front",
    label: "Government issued photo ID, front",
    help: "A driver licence or passport. A clear photograph taken on a phone is fine as long as every corner is in frame and the text is readable.",
    actor: "person",
  },
  {
    key: "photo_id_back",
    label: "Government issued photo ID, back",
    help: "The reverse of the same document. Passports have no reverse; upload the photo page again and note it in the message to the operator.",
    actor: "person",
  },
  {
    key: "pe_license_card",
    label: "Texas PE licence verification",
    help: "A wallet card, a certificate, or a printout of the TBPELS roster entry. The licence number is already on file and is shown below for you to check.",
    actor: "person",
  },
  {
    key: "w4",
    label: "Form W-4, completed and signed",
    help: "Download the current form from the IRS, complete it, and upload the signed copy. Nothing from this form is entered into this site as data.",
    actor: "person",
    reference: {
      label: "IRS Form W-4",
      url: "https://www.irs.gov/pub/irs-pdf/fw4.pdf",
    },
  },
  {
    key: "i9_section1",
    label: "Form I-9, Section 1",
    help: "Complete Section 1 only and upload it. Section 2 requires the operator to examine your original documents in person or on a live video call, which is arranged separately.",
    actor: "person",
    reference: {
      label: "USCIS Form I-9",
      url: "https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf",
    },
  },
  {
    key: "direct_deposit",
    label: "Direct deposit authorization",
    help: "A voided check or a letter from the bank. The account and routing numbers stay inside the document. This site never asks you to type them.",
    actor: "person",
    fields: [
      { name: "bank_name", label: "Bank name", placeholder: "First National" },
      { name: "account_type", label: "Account type", placeholder: "Checking or savings" },
    ],
  },
  {
    key: "employment_agreement",
    label: "Signed employment agreement",
    help: "The countersigned agreement. If it was executed elsewhere, the operator marks this complete from their side and you can skip it.",
    actor: "person",
  },
  {
    key: "eo_acknowledgment",
    label: "Errors and omissions coverage",
    help: "Read the declarations page the operator has posted and acknowledge that you have seen it. Nothing to upload.",
    actor: "person",
    acknowledgeOnly: true,
  },

  // Operator verified. Never rendered in the invite flow.
  {
    key: "identity_verified_video",
    label: "Identity confirmed on video call",
    help: "The operator confirms the person on the call matches the ID on file. Recorded here rather than asking for a selfie holding the document.",
    actor: "admin",
  },
  {
    key: "i9_documents_examined",
    label: "I-9 Section 2 documents examined",
    help: "Federal procedure requires the employer to examine original documents. Tracked here as its own step because it happens live and not through this site.",
    actor: "admin",
  },
];

const FIELD_TECH: ChecklistItem[] = [
  {
    key: "photo_id_front",
    label: "Government issued photo ID, front",
    help: "A driver licence or passport, with every corner in frame and the text readable.",
    actor: "person",
  },
  {
    key: "drivers_license",
    label: "Driver licence",
    help: "Field work is dispatched by county and involves driving to the property. A current licence is required.",
    actor: "person",
  },
  {
    key: "vehicle_insurance",
    label: "Vehicle insurance card",
    help: "Current declarations page or insurance card for the vehicle you would drive on assignments.",
    actor: "person",
  },
  {
    key: "general_liability",
    label: "General liability insurance",
    help: "A certificate of insurance if you carry general liability. If you do not, acknowledge the waiver text instead and the operator will discuss coverage with you.",
    actor: "person",
  },
  {
    key: "w9",
    label: "Form W-9",
    help: "Field technicians are engaged as contractors, so this is a W-9 rather than a W-4. Nothing from it is entered into this site as data.",
    actor: "person",
    reference: {
      label: "IRS Form W-9",
      url: "https://www.irs.gov/pub/irs-pdf/fw9.pdf",
    },
  },
  {
    key: "ica_signed",
    label: "Signed independent contractor agreement",
    help: "The countersigned agreement. If it was executed elsewhere, the operator marks this complete.",
    actor: "person",
  },
  {
    key: "protocol_certification",
    label: "Protocol certification acknowledgment",
    help: "Confirm you have read the written inspection protocol for the service lines you would work. Certification on the protocol happens before a first assignment.",
    actor: "person",
    acknowledgeOnly: true,
  },

  {
    key: "identity_verified_video",
    label: "Identity confirmed on video call",
    help: "The operator confirms the person on the call matches the ID on file.",
    actor: "admin",
  },
];

export const checklists: Record<OnboardingRole, ChecklistItem[]> = {
  engineer: ENGINEER,
  field_tech: FIELD_TECH,
};

export function checklistFor(role: OnboardingRole): ChecklistItem[] {
  return checklists[role];
}

export const ROLE_LABELS: Record<OnboardingRole, string> = {
  engineer: "Professional Engineer",
  field_tech: "Field Inspection Technician",
};

/**
 * Patterns that must never appear as a FIELD NAME OR LABEL on any onboarding
 * surface. Exported so scripts/forms-audit.mjs enforces the rule rather than
 * trusting that nobody adds one.
 *
 * SCOPE, AND WHY IT IS NARROWER THAN IT LOOKS
 * -------------------------------------------
 * These apply to what a form ASKS FOR: an item key, an item label, and the name,
 * label, and placeholder of any text field. They must NOT be run over help prose.
 *
 * The first version of the check ran over everything and failed on the direct
 * deposit item, whose help text reads "The account and routing numbers stay
 * inside the document. This site never asks you to type them." That sentence is
 * the rule being explained to the person, and a check that fails on its own
 * denial teaches whoever runs it next to delete the honest sentence to get a
 * green board. The identical lesson is already recorded at the top of
 * scripts/lib/regulatory.mjs, where a negation guard exists for the same reason.
 *
 * So: forbid the ask, never the explanation.
 */
export const FORBIDDEN_FIELD_PATTERNS = [
  /\bssn\b/i,
  /social[\s_-]*security/i,
  /\bsin\b/i,
  /tax[\s_-]*(id|identification)[\s_-]*number/i,
  /\bitin\b/i,
  /routing[\s_-]*number/i,
  /account[\s_-]*number/i,
  /\bdate[\s_-]*of[\s_-]*birth\b/i,
  /\bdob\b/i,
];
