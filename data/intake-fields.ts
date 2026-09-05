import { catalogFor, type CatalogEntry, type RequiredInput } from "./catalog";

/**
 * WHAT A JOB NEEDS, DEFINED ONCE.
 *
 * Phase 10 Section 1.5 Section C. Three surfaces take work now, the customer
 * flow on the websites, an operator on the telephone, and a partner referral.
 * If each asks its own set, the firm has three definitions of a complete job,
 * and the operator entered ones stall because a person under time pressure asks
 * fewer questions than a form does.
 *
 * So this is the one definition. `fieldsFor` returns everything a deliverable
 * needs, the universal fields below plus that deliverable's own
 * `requiredInputs` from the catalog, and every intake surface renders what it
 * returns rather than a list of its own.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * Anything an engineer has to decide. Section A of the report found that eight
 * of the nine service lines have no published protocol, so what a PE needs in
 * front of them before sealing is unknown for ten of eleven deliverables, and
 * it is his to write rather than mine to guess.
 *
 * Everything below is knowable without that answer: who the parties are, why
 * the document is needed and by when, who it is addressed to, and what the
 * technician needs to complete the visit. None of it is an engineering
 * judgment, and all of it causes rework when it is missing.
 *
 * Where a field plausibly bears on sealing, it is marked `seal` in `stage` on
 * ADMINISTRATIVE grounds only, meaning the document cannot be issued correctly
 * without it. That is not the same as the engineer requiring it, and when the
 * protocols arrive the engineer may raise the bar. He cannot lower it: a letter
 * addressed to nobody is not a letter whatever the evidence behind it says.
 */

/**
 * WHEN A FIELD HAS TO BE ANSWERED.
 *
 * Not everything can be required at order time. A customer ordering a solar
 * letter may not have the racking specification to hand, and refusing the order
 * is worse than taking it. So a field is one of three:
 *
 *   "order"     the job cannot be taken without it
 *   "dispatch"  the job can be taken, and a technician must not be sent without it
 *   "seal"      the job can be worked, and the document cannot be issued without it
 *
 * The file knows which of these it is missing, which is what lets the same fact
 * appear on the file, on the dispatch screen and in the review queue without
 * three separate lists deciding it.
 */
export type FieldStage = "order" | "dispatch" | "seal";

/**
 * Who can actually answer it.
 *
 * "customer" is answerable by the person buying. "firm" is something the firm
 * gathers, because expecting a homeowner to know their roof framing is how a
 * form gets abandoned or, worse, guessed at.
 *
 * A partner referral renders only the customer answerable subset, because a
 * partner knows who they referred and not what is under their roof.
 */
export type FieldAudience = "customer" | "firm";

export type IntakeField = {
  id: string;
  label: string;
  help?: string;
  kind: "text" | "longtext" | "select" | "date" | "tel" | "email" | "number" | "boolean" | "file";
  options?: string[];
  required: boolean;
  stage: FieldStage;
  audience: FieldAudience;
  /**
   * Which deliverables it applies to.
   *
   * "all" is everything. "field" is the four that send somebody to a property.
   * A list of service slugs is exactly those lines.
   */
  applies: "all" | "field" | string[];
  /** Grouped on the screens so a person is asked related things together. */
  group: "parties" | "document" | "property" | "access";
};

/**
 * THE PARTIES, WHICH ARE USUALLY NOT ONE PERSON.
 *
 * The platform has always known who is paying. It has never known who owns the
 * property, or who is standing at it, and for an occupied rental those are a
 * landlord and a tenant who have never spoken to the firm.
 */
const PARTIES: IntakeField[] = [
  {
    id: "owner_name",
    label: "Who owns the property, if not you",
    help: "Leave blank if you own it. A certification names the property, and the firm should know whose it is.",
    kind: "text",
    required: false,
    stage: "seal",
    audience: "customer",
    applies: "all",
    group: "parties",
  },
  {
    id: "site_contact_name",
    label: "Who will be at the property",
    help: "The person the technician will meet. For a tenanted property this is the tenant, not the buyer.",
    kind: "text",
    required: true,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "parties",
  },
  {
    id: "site_contact_phone",
    label: "Their phone number",
    help: "A technician standing at a locked gate needs somebody to ring, and it is rarely the person who ordered.",
    kind: "tel",
    required: true,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "parties",
  },
];

/**
 * WHY THE DOCUMENT IS NEEDED, WHICH CHANGES WHAT IT MUST SAY.
 *
 * Section A found this is the weakest area and the likeliest cause of a sealed
 * document being reissued. One deliverable of eleven asked who the document was
 * for, as free text. Nothing asked who it is addressed to.
 *
 * A lender wants the letter made out to them by name. An insurer wants their
 * own reference on it. Both produce a reissue when they are discovered after
 * sealing, and reissuing a sealed document is the most expensive rework this
 * firm has.
 */
const DOCUMENT: IntakeField[] = [
  {
    id: "reason",
    label: "Why do you need this",
    help: "It changes what the document has to say, so it is worth a moment now.",
    kind: "select",
    options: [
      "A property sale",
      "A lender requirement",
      "Insurance, binding or renewal",
      "A permit application",
      "An insurance claim",
      "A dispute",
      "Something else",
    ],
    required: true,
    stage: "order",
    audience: "customer",
    applies: "all",
    group: "document",
  },
  {
    id: "addressed_to",
    label: "Who should the document be addressed to",
    help: "The exact name the letter is made out to. A lender or an insurer usually wants their own.",
    kind: "text",
    required: true,
    stage: "seal",
    audience: "customer",
    applies: "all",
    group: "document",
  },
  {
    id: "requiring_party",
    label: "Who is asking for it",
    help: "The lender, insurer, permit office or agent imposing the requirement, if there is one.",
    kind: "text",
    required: false,
    stage: "seal",
    audience: "customer",
    applies: "all",
    group: "document",
  },
  {
    id: "requiring_reference",
    label: "Their reference or file number",
    help: "Loan number, policy number, permit number, claim number. It often has to appear on the document.",
    kind: "text",
    required: false,
    stage: "seal",
    audience: "customer",
    applies: "all",
    group: "document",
  },
  {
    id: "required_format",
    label: "Is a specific form required",
    help: "Some lenders and some jurisdictions accept only their own form. Say so now rather than after it is sealed.",
    kind: "text",
    required: false,
    stage: "seal",
    audience: "customer",
    applies: "all",
    group: "document",
  },
  {
    id: "copy_to",
    label: "Who else should receive a copy",
    help: "Email addresses, separated by commas. Optional.",
    kind: "text",
    required: false,
    stage: "seal",
    audience: "customer",
    applies: "all",
    group: "document",
  },
  {
    /*
     * DISTINCT FROM URGENCY, AND THAT IS THE POINT.
     *
     * Urgency is what the customer would prefer. This is the date somebody else
     * imposed: a closing, a policy date, a permit hearing. The firm can decline
     * a preference and cannot decline a closing date, so they are two facts and
     * the file carries both.
     */
    id: "hard_deadline",
    label: "Is there a date this has to be done by",
    help: "A closing, a policy date, a permit hearing. Different from how quickly you would like it.",
    kind: "date",
    required: false,
    stage: "order",
    audience: "customer",
    applies: "all",
    group: "document",
  },
];

/**
 * THE PROPERTY, IN THE DETAIL THE WORK NEEDS.
 *
 * Kept short on purpose. Year built, storeys, roof pitch and foundation type
 * are all things an engineer may need and may not, and Section A left that
 * open. What is here is what the FIRM needs regardless: what kind of building
 * it is, and whether anybody lives in it.
 */
const PROPERTY: IntakeField[] = [
  {
    id: "property_type",
    label: "What kind of property",
    kind: "select",
    options: ["Single family", "Multi family", "Commercial", "Manufactured home"],
    required: true,
    stage: "order",
    audience: "customer",
    applies: "all",
    group: "property",
  },
  {
    id: "occupancy",
    label: "Is anybody living there",
    help: "It decides who the technician has to arrange the visit with.",
    kind: "select",
    options: ["Owner occupied", "Tenanted", "Vacant", "Under construction"],
    required: true,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "property",
  },
];

/**
 * ACCESS, AS FIELDS THAT CAN BE CHECKED.
 *
 * Operator ruling, 2026-09-04. The catalog already asks `access_notes`, whose
 * help text names gate codes, dogs and who will be there, and it is free text.
 * That is enough for a technician to read and useless to a dispatcher: a
 * sentence saying "call Bob" and a sentence saying "no idea" are the same shape,
 * so nothing can tell anybody that a job is missing its access arrangement.
 *
 * Where the answer has a shape, it gets a field. The free text note stays
 * BESIDE them rather than instead of them, because no set of fields anticipates
 * the thing about a particular property that would waste a trip.
 */
const ACCESS: IntakeField[] = [
  {
    id: "gate_code",
    label: "Gate or lockbox code",
    help: "Leave blank if there is nothing to unlock.",
    kind: "text",
    required: false,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "access",
  },
  {
    id: "dog_on_site",
    label: "Is there a dog",
    kind: "boolean",
    required: true,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "access",
  },
  {
    id: "alarm_on_site",
    label: "Is there an alarm the technician needs to know about",
    kind: "boolean",
    required: true,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "access",
  },
  {
    id: "appointment_window",
    label: "Does the visit have to be at a particular time",
    help: "A window somebody has to be there for. Leave blank if the technician can come when it suits.",
    kind: "text",
    required: false,
    stage: "dispatch",
    audience: "customer",
    applies: "field",
    group: "access",
  },
];

/** Every universal field, in the order a person should be asked. */
export const INTAKE_FIELDS: IntakeField[] = [...PARTIES, ...DOCUMENT, ...PROPERTY, ...ACCESS];

function appliesTo(field: IntakeField, entry: CatalogEntry): boolean {
  if (field.applies === "all") return true;
  if (field.applies === "field") return entry.orderType === "field";
  return field.applies.includes(entry.serviceSlug);
}

/**
 * A catalog `requiredInputs` entry, expressed as an IntakeField.
 *
 * The catalog's own inputs are the deliverable specific half of the definition
 * and stay where they are; this is what lets one list carry both without the
 * catalog having to be rewritten.
 *
 * They are all "customer" audience and all "order" stage, which is what they
 * were before this existed: the customer flow asks them at order time. Nothing
 * about their behaviour changes here.
 */
function fromCatalog(input: RequiredInput): IntakeField {
  return {
    id: input.id,
    label: input.label,
    help: input.help,
    kind: input.kind === "file" ? "file" : input.kind === "date" ? "date" : "text",
    required: input.required,
    stage: "order",
    audience: "customer",
    applies: "all",
    group: input.id === "access_notes" ? "access" : "document",
  };
}

/**
 * Everything this deliverable needs, universal and specific, in one list.
 *
 * THE SINGLE DEFINITION. Every intake surface calls this. `intake-audit`
 * asserts that no surface renders a field it does not return, which is the
 * mechanical form of "none of the three defines its own list".
 */
export function fieldsFor(serviceSlug: string, tier: string): IntakeField[] {
  const entry = catalogFor(serviceSlug, tier);
  if (!entry) return [];

  const universal = INTAKE_FIELDS.filter((f) => appliesTo(f, entry));
  const specific = entry.requiredInputs.map(fromCatalog);

  /*
   * The catalog's own input wins on a collision. access_notes is defined there
   * with per deliverable help text, and the structured access fields above sit
   * beside it rather than replacing it.
   */
  const seen = new Set(specific.map((f) => f.id));
  return [...universal.filter((f) => !seen.has(f.id)), ...specific];
}

/**
 * What is still missing, and when it becomes a problem.
 *
 * Returns the fields whose stage has been reached and which have no answer, so
 * the file, the dispatch screen and the review queue all ask the same question
 * of the same definition rather than three lists drifting apart.
 */
export function missingFor(
  serviceSlug: string,
  tier: string,
  answers: Record<string, unknown>,
  upTo: FieldStage,
): IntakeField[] {
  const order: FieldStage[] = ["order", "dispatch", "seal"];
  const limit = order.indexOf(upTo);

  return fieldsFor(serviceSlug, tier).filter((f) => {
    if (!f.required) return false;
    if (order.indexOf(f.stage) > limit) return false;
    const value = answers[f.id];
    return value === undefined || value === null || value === "";
  });
}
