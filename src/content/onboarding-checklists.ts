import { DEFAULT_ROLES } from "@/lib/ops-authz";
import { roleKeyLabel } from "@/lib/portal-labels";

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
  /**
   * COMPLETED IN GUSTO, RECORDED HERE, NEVER UPLOADED.
   *
   * Operator ruling, 2026-10-02: Gusto holds SSN, EIN, bank details, W-9, W-4,
   * I-9 and all tax filings, and the platform holds none of them.
   *
   * An item with this flag accepts NO FILE. The owner marks it once Gusto shows
   * the work is done, and what this platform keeps is that it was marked and
   * when. It is a separate flag from `acknowledgeOnly` because the two mean
   * different things: an acknowledgement is the PERSON saying they read
   * something, and this is the OWNER saying a thing exists somewhere else.
   *
   * It is a flag rather than a convention so that the upload path can refuse on
   * it, which is what stops the capability coming back one careless edit later.
   */
  gustoHeld?: boolean;
  /**
   * Which step of the flow this item appears in.
   *
   * Grouping lives here rather than in the component so that the stepper is
   * derived from the same data the checklist is. Admin items carry a step too
   * and are simply never rendered in the flow.
   */
  step: string;
};

const ENGINEER: ChecklistItem[] = [
  /*
   * ======================================================================
   * IDENTITY IS CONFIRMED AND RECORDED. NO DOCUMENT IS STORED.
   * ======================================================================
   *
   * Operator ruling, 2026-10-02. `photo_id_front` and `photo_id_back` used to
   * upload both sides of a government issued photo ID into the private
   * eng-onboarding bucket. Gusto holds identity documents; this platform holds
   * none of them.
   *
   * The confirmation itself was never the problem and is not removed. The
   * operator still confirms the person on a video call, and
   * `identity_verified_video` below records that, with `eng_onboardings`
   * carrying `identity_verified_at` as a DATE and no file. That pairing already
   * existed beside the uploads and is the shape the ruling asks for.
   *
   * SO THE TWO UPLOADS ARE GONE AND NOTHING REPLACES THEM AT THIS STEP. There
   * is no owner marked Gusto record for photo ID, because identity is not
   * something Gusto completes on a date: it is something the operator confirms,
   * which the operator item already does. Adding a second record of the same act
   * would be the "two acceptance steps for one document" this file already warns
   * about.
   */
  {
    key: "pe_license_card",
    step: "licensure",
    label: "Texas PE license verification",
    help: "A wallet card, a certificate, or a printout of the TBPELS roster entry. The license number is already on file and is shown below for you to check.",
    actor: "person",
  },
  /*
   * ======================================================================
   * THE TAX AND PAY PAPERWORK IS COMPLETED IN GUSTO AND MARKED HERE.
   * ======================================================================
   *
   * Operator ruling, 2026-10-02: Gusto holds SSN, EIN, bank details, W-9, W-4,
   * I-9 and all tax filings. The platform holds none of them.
   *
   * WHAT THESE USED TO BE. `w4` uploaded a signed Form W-4, `i9_section1`
   * uploaded Section 1 of a Form I-9, and `direct_deposit` uploaded a voided
   * check or a bank letter and typed a bank name beside it. All three went into
   * the private eng-onboarding bucket. A W-4 and an I-9 Section 1 each carry a
   * social security number, an I-9 carries a date of birth, and the voided check
   * carries the account and routing numbers.
   *
   * AND THE HELP TEXT ON EACH WAS TRUE, WHICH IS WHAT MADE THEM EASY TO KEEP.
   * The W-4 said "nothing from this form is entered into this site as data", and
   * the direct deposit said "the account and routing numbers stay inside the
   * document. This site never asks you to type them." Both sentences were
   * accurate about the FORM FIELDS and silent about the file, which is the shape
   * of every false assurance this repository has recorded: a correct statement
   * standing in for the one nobody made.
   *
   * WHAT THEY ARE NOW. One owner marked record each. The person does the work in
   * Gusto, where it belongs, and the owner marks the item here with the date,
   * which is `eng_onboarding_items.updated_at`. No upload field, no reference
   * link to a federal form this platform should not be collecting, and no bank
   * name.
   *
   * WHY ONE RECORD PER FORM RATHER THAN ONE "GUSTO DONE" ITEM. Because the three
   * are completed at different times and by different people: a W-4 is the
   * employee's, the I-9 needs the employer's examination too, and pay setup is
   * the owner's. Collapsing them would lose which of the three is outstanding,
   * which is the only question this checklist exists to answer.
   *
   * AND EVERY KEY IS UNCHANGED, WHICH IS NOT COSMETIC. `item_key` is written to
   * `eng_onboarding_items` and the top of this file says it is never renamed.
   * It is also the JOIN: `CREDENTIAL_OF_ITEM` maps `direct_deposit` to a
   * credential kind, so renaming that key to something tidier would silently
   * stop the credential being created. The first version of this change did
   * rename all three, and `drivers_license` and `w9` are REQUIRED_FOR_DISPATCH,
   * so the same instinct one item over would have broken dispatch for every
   * technician. Only the behaviour moves: actor, help, no upload.
   */
  {
    key: "w4",
    step: "paperwork",
    label: "Form W-4 completed in Gusto",
    help: "You complete this in Gusto, not here. Gusto holds the form and your social security number; this site records only that it is done and when. The owner marks it once Gusto shows it complete.",
    actor: "admin",
    gustoHeld: true,
  },
  {
    key: "i9_section1",
    step: "paperwork",
    label: "Form I-9 completed in Gusto",
    help: "Section 1 is yours and Section 2 needs the owner to examine your original documents in person, which is tracked separately below. Gusto holds the form itself. This site records the dates and nothing else.",
    actor: "admin",
    gustoHeld: true,
  },
  {
    key: "direct_deposit",
    step: "pay",
    label: "Pay details set up in Gusto",
    help: "Bank details go to Gusto and never to this site. The owner marks this once Gusto shows you are set up to be paid.",
    actor: "admin",
    gustoHeld: true,
  },
  {
    key: "employment_agreement",
    step: "agreements",
    label: "Signed employment agreement",
    help: "The countersigned agreement. If it was executed elsewhere, the operator marks this complete from their side and you can skip it.",
    actor: "person",
  },
  {
    key: "eo_acknowledgment",
    step: "agreements",
    label: "Errors and omissions coverage",
    help: "Read the declarations page the operator has posted and acknowledge that you have seen it. Nothing to upload.",
    actor: "person",
    acknowledgeOnly: true,
  },

  // Operator verified. Never rendered in the invite flow.
  {
    key: "identity_verified_video",
    step: "operator",
    label: "Identity confirmed on video call",
    help: "The operator confirms the person on the call matches the ID on file. Recorded here rather than asking for a selfie holding the document.",
    actor: "admin",
  },
  {
    key: "i9_documents_examined",
    step: "operator",
    label: "I-9 Section 2 documents examined",
    help: "Federal procedure requires the employer to examine original documents. Tracked here as its own step because it happens live and not through this site.",
    actor: "admin",
  },
];

const FIELD_TECH: ChecklistItem[] = [
  /*
   * `photo_id_front` is gone for the reason given on the engineer checklist:
   * Gusto holds identity documents, and the operator's video confirmation below
   * already records that identity was checked, as a date and no file.
   */
  {
    /*
     * THE LICENCE IS STILL REQUIRED AND IS NO LONGER UPLOADED.
     *
     * This is the item the ruling is most easily got wrong on. A driver licence
     * is an identity document, so the IMAGE must not be stored. But
     * `drivers_license` is also a credential kind in REQUIRED_FOR_DISPATCH, and
     * `CREDENTIAL_OF_ITEM` creates that credential FROM THIS ITEM KEY when it is
     * accepted. Delete the item and no technician can ever be dispatched; rename
     * the key and the same thing happens silently.
     *
     * So the item stays, with its key, and becomes an owner marked record that
     * still carries an EXPIRY, because a lapsed licence is a real exposure and
     * the expiry is the whole reason this credential blocks dispatch. What the
     * owner confirms is that they have seen a current licence, which is the same
     * act they already perform on the video call, and what the platform keeps is
     * the date it expires rather than a photograph of it.
     */
    key: "drivers_license",
    step: "identity",
    label: "Driver license confirmed, with its expiry",
    help: "Field work is dispatched by county and involves driving to the property, so a current license is required. The owner checks yours on the video call and records only the expiry date. No copy is kept.",
    actor: "admin",
    gustoHeld: false,
  },
  {
    key: "vehicle_insurance",
    step: "coverage",
    label: "Vehicle insurance card",
    help: "Current declarations page or insurance card for the vehicle you would drive on assignments.",
    actor: "person",
  },
  {
    key: "general_liability",
    step: "coverage",
    label: "General liability insurance",
    help: "A certificate of insurance if you carry general liability. If you do not, acknowledge the waiver text instead and the operator will discuss coverage with you.",
    actor: "person",
  },
  {
    /*
     * THE W-9 STAYS A DISPATCH BLOCKER AND BECOMES A RECORD THAT GUSTO HOLDS IT.
     * Operator ruling, 2026-10-02, in those terms.
     *
     * The reasoning in ops-credentials.ts, "a contractor cannot be paid without
     * one", is still exactly right. What changed is whose job the form is: Gusto
     * holds the W-9 and the taxpayer identification number on it, and this
     * platform records that Gusto has it, verified, by whom and when. The
     * blocker is unaffected, because the blocker reads the credential and not
     * the file.
     */
    key: "w9",
    step: "paperwork",
    label: "Form W-9 completed in Gusto",
    help: "Field technicians are engaged as contractors, so this is a W-9 rather than a W-4. You complete it in Gusto, which holds it along with your taxpayer identification number. The owner marks this once Gusto shows it is done.",
    actor: "admin",
    gustoHeld: true,
  },
  {
    key: "ica_signed",
    step: "agreements",
    label: "Signed independent contractor agreement",
    help: "The countersigned agreement. If it was executed elsewhere, the operator marks this complete.",
    actor: "person",
  },
  {
    key: "protocol_certification",
    step: "agreements",
    label: "Protocol certification acknowledgment",
    help: "Confirm you have read the written inspection protocol for the service lines you would work. Certification on the protocol happens before a first assignment.",
    actor: "person",
    acknowledgeOnly: true,
  },

  {
    key: "identity_verified_video",
    step: "operator",
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

/**
 * ===========================================================================
 * ONE DECLARATION, AND IT IS `DEFAULT_ROLES`. Operator ruling, 2026-09-22.
 * ===========================================================================
 *
 * THIS MAP SAID "Field Inspection Technician" AND THE ROLE RECORD SAYS "Field
 * Technician". One key, two labels, and they had already diverged: whichever
 * surface a person happened to be on decided what the role was called.
 *
 * The operator ruled "Field Technician", on two grounds. It is the name on the
 * role record the permission screen already renders, and it is the term
 * section 5 of 254-RC-001 uses, which is the signed document this firm's field
 * work is performed under. A label that disagrees with the protocol is a label
 * that will be read out in an audit and not match the paper.
 *
 * SO THIS MAP DERIVES RATHER THAN DECLARES. `DEFAULT_ROLES` in
 * src/lib/ops-authz.ts carries a `name` for every system role. It is the one
 * home, and this reads it. The onboarding vocabulary and the portal vocabulary
 * use the same keys, `engineer` and `field_tech`, so there is nothing to
 * translate between them.
 *
 * WHAT HAPPENS IF A ROLE LOSES ITS NAME. `roleKeyLabel` in
 * src/lib/portal-labels.ts turns the key back into English as a fallback, so
 * an onboarding page renders "Field tech" rather than crashing or printing a
 * raw key. That is deliberately worse looking than the real name: a fallback
 * that reads as well as the thing it replaces is a fallback nobody notices has
 * fired.
 */
export const ROLE_LABELS: Record<OnboardingRole, string> = {
  engineer: DEFAULT_ROLES.find((r) => r.key === "engineer")?.name ?? roleKeyLabel("engineer"),
  field_tech: DEFAULT_ROLES.find((r) => r.key === "field_tech")?.name ?? roleKeyLabel("field_tech"),
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

/**
 * The steps of the flow, per role.
 *
 * Rendered in this order. An item whose `step` is not in this list, which is
 * what happens when the operator adds a bespoke item to one person's checklist,
 * falls into the final catch all rather than disappearing from the flow.
 */
export type StepDef = { id: string; title: string; blurb: string };

export const ONBOARDING_STEPS: Record<OnboardingRole, StepDef[]> = {
  engineer: [
    {
      id: "identity",
      title: "Identity",
      blurb: "A government issued photo ID. A phone photograph is fine if it is readable.",
    },
    {
      id: "licensure",
      title: "Licensure",
      blurb: "Verification of the Texas PE license already on file.",
    },
    {
      id: "paperwork",
      title: "Employment paperwork",
      blurb: "The W-4 and I-9 Section 1, completed and uploaded as documents.",
    },
    {
      id: "pay",
      title: "Direct deposit",
      blurb: "A voided check or bank letter. The numbers stay inside the document.",
    },
    {
      id: "agreements",
      title: "Agreements",
      blurb: "The signed employment agreement and the insurance acknowledgment.",
    },
  ],
  field_tech: [
    {
      id: "identity",
      title: "Identity and license",
      blurb: "A government issued photo ID and a current driver license.",
    },
    {
      id: "coverage",
      title: "Insurance",
      blurb: "Vehicle insurance, and general liability if you carry it.",
    },
    {
      id: "paperwork",
      title: "Tax paperwork",
      blurb: "A completed W-9, uploaded as a document.",
    },
    {
      id: "agreements",
      title: "Agreements",
      blurb: "The signed contractor agreement and the protocol acknowledgment.",
    },
  ],
};

/** The step an unrecognised item falls into, so nothing is ever unreachable. */
export const CATCH_ALL_STEP: StepDef = {
  id: "additional",
  title: "Additional items",
  blurb: "Items added to your checklist specifically.",
};

/** Items the person completes. Operator verified items never appear in the flow. */
export function personItemKeys(role: OnboardingRole): string[] {
  return checklists[role].filter((i) => i.actor === "person").map((i) => i.key);
}

export function itemByKey(role: OnboardingRole, key: string): ChecklistItem | undefined {
  return checklists[role].find((i) => i.key === key);
}
