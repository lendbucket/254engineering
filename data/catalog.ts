/**
 * THE ORDER CATALOG
 *
 * SYNCHRONIZED FILE. One catalog, read by all three sites and by the platform,
 * copied verbatim into sealedengineering and stampmyplans. If you edit it here,
 * you have created a divergence until it is copied. `order-audit` compares the
 * three live sites and fails on a price that disagrees.
 *
 * WHY ONE FILE
 * ------------
 * A price that lives in three places is three prices. The first time one of them
 * is updated and the others are not, a customer is quoted one number on a service
 * page and charged another at checkout, and the firm finds out from a complaint.
 *
 * The catalog holds everything an order needs to exist: what kind of order it is,
 * what it costs, what has to be true for the firm to take it, what the customer
 * must provide, which evidence protocol governs the field work, and what they
 * receive at the end.
 *
 * ----------------------------------------------------------------------------
 * THE PRICES ARE THE OPERATOR'S, SET ON 2026-09-03
 * ----------------------------------------------------------------------------
 * Every price here was given by the operator. None was derived, estimated, or
 * carried over from another firm's published rates. That distinction is the
 * whole reason this file shipped with every price null until today: a price is
 * a commercial decision and inventing one would have put a fabricated figure on
 * three public websites and into a checkout.
 *
 * The ruling, verbatim in dollars:
 *
 *   solar structural letter                        450
 *   roof certification letter                      600
 *   foundation certification                       650
 *   manufactured home foundation certification     650
 *   structural letter for permit                   550
 *   WPI-8E windstorm evaluation                    850
 *   repair specification                           900
 *   forensic and custom                            quote only
 *   coastal surcharge, first tier counties          75
 *   inspection fee retained on decline after a visit 175
 *
 * TWO PRICES IN THAT RULING HAVE NOWHERE TO GO YET
 * ------------------------------------------------
 * "beam and header sizing 750" and "carport and patio cover plan set 1500" are
 * not in this catalog and not in src/content/services.ts. They are products
 * rather than restatements of the nine service lines the sites publish, and
 * adding a catalog entry for a service page that does not exist would fail
 * order-audit's rule that every entry names a real service.
 *
 * They are deliberately absent rather than guessed at. See BACKLOG.
 *
 * WHAT IS STILL NULL, AND WHY
 * ---------------------------
 * priceCents is still Cents, and the two quote services still carry null,
 * because nothing is owed on a quote request until somebody scopes it. The
 * arithmetic that treats null as unknown rather than zero is unchanged and is
 * still what stops an unpriced service reaching a checkout.
 *
 * THE INSPECTION FEE IS ON FIELD SERVICES ONLY
 * --------------------------------------------
 * A desk review has no site visit, so there is no visit to retain a fee for,
 * and its refund is always full. Setting one on a desk service would create a
 * deduction the middle row of the refund rule can never justify.
 */

import type { Cents } from "@/lib/ops-money";

/**
 * The three shapes an order can take.
 *
 * The distinction is not cosmetic. It decides where the file lands the moment
 * payment succeeds: a field order goes to dispatch and a technician drives out,
 * a desk order goes straight into the engineer's review queue, and a quote never
 * becomes an order at all until a person has scoped it.
 */
export type OrderType = "field" | "desk" | "quote";

/**
 * A question asked before the firm will take money.
 *
 * `disqualifyOn` names the answers that end the flow. Ending it honestly, with
 * where to go instead, is the whole point: a customer who cannot be served is
 * better served by being told so in thirty seconds than by a refund three weeks
 * later, and the firm is better off not holding work it should not have taken.
 */
export type Qualifier = {
  id: string;
  prompt: string;
  help?: string;
  options: string[];
  /** Indexes into `options`. Any of these ends the flow. */
  disqualifyOn: number[];
  /** Said to the customer when disqualified. Names what to do instead. */
  disqualifiedMessage: string;
};

/** Something the customer has to provide before the order can be worked. */
export type RequiredInput = {
  id: string;
  label: string;
  help: string;
  kind: "file" | "text" | "date" | "choice";
  required: boolean;
  /** For kind "choice". */
  options?: string[];
  /** For kind "file". Stated to the customer rather than enforced silently. */
  accepts?: string;
};

export type CatalogEntry = {
  /** Matches a slug in src/content/services.ts. Checked by order-audit. */
  serviceSlug: string;
  orderType: OrderType;
  /**
   * The published price, or null when the operator has not set one.
   * Null is not zero and is not a placeholder. See the header.
   */
  priceCents: Cents;
  /**
   * Added for a property in a first tier coastal county. Shown to the customer
   * as its own named line, never folded into a larger total. Operator rulings,
   * 2026-09-02 and 2026-09-03.
   *
   * WHICH COUNTIES, AND THE ONE THAT IS NOT A YES OR A NO
   * -----------------------------------------------------
   * First tier is the fourteen TWIA designated seaward counties, which is what
   * twiaStatus() returns "designated" for. Harris County returns "check"
   * instead, because the designated area there is the part east of State
   * Highway 146 and a county name cannot express that. A "check" county gets no
   * surcharge today, which errs toward not overcharging a customer the firm
   * cannot yet prove is in the designated area.
   *
   * APPLIED TO DESK SERVICES TOO, WHICH IS AN INTERPRETATION
   * --------------------------------------------------------
   * The operator gave the surcharge as a property of the location rather than
   * of the service, so it is set on every orderable entry. A coastal letter
   * carries windstorm design criteria an inland one does not, which supports
   * reading it that way. Flagged in the report rather than assumed silently.
   */
  coastalSurchargeCents: Cents;
  /**
   * What the customer keeps if the engineer declines after a technician has
   * already visited. Disclosed at checkout before payment, in plain language.
   *
   * Null while unset, and while it is null a field order cannot be taken,
   * because the refund rule cannot be stated to the customer and an undisclosed
   * deduction is not a rule, it is a surprise.
   */
  inspectionFeeCents: Cents;
  qualifiers: Qualifier[];
  requiredInputs: RequiredInput[];
  /**
   * The evidence protocol a field order dispatches against. Null for desk and
   * quote orders, which have no site visit.
   */
  protocolServiceSlug: string | null;
  /** Qualitative. The firm has not measured a turnaround across a network yet. */
  turnaround: string;
  /** What arrives at the end, in the customer's words. */
  receives: string[];
};

// ---------------------------------------------------------------------------

const ADDRESS_QUALIFIER: Qualifier = {
  id: "texas",
  prompt: "Is the property in Texas?",
  help: "A Texas Professional Engineer's seal is a Texas licence. The firm cannot seal work outside the state.",
  options: ["Yes", "No"],
  disqualifyOn: [1],
  disqualifiedMessage:
    "This firm is licensed in Texas and can only seal work on Texas property. For a property in another state, look for a Professional Engineer licensed there. The board in that state publishes a roster.",
};

const OWNER_QUALIFIER: Qualifier = {
  id: "authority",
  prompt: "Do you own the property, or are you authorised by the owner to arrange this?",
  help: "A technician has to enter the property, and the engineer's document names it.",
  options: ["I own it", "I am authorised by the owner", "Neither"],
  disqualifyOn: [2],
  disqualifiedMessage:
    "The firm needs the owner's authority before anyone attends a property or issues a document about it. Ask the owner to place the order, or to send written authority naming you.",
};

export const CATALOG: CatalogEntry[] = [
  // ------------------------------------------------------------- field orders
  {
    serviceSlug: "roof-inspections",
    orderType: "field",
    priceCents: 60000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: 17500,
    protocolServiceSlug: "roof-inspections",
    qualifiers: [
      ADDRESS_QUALIFIER,
      OWNER_QUALIFIER,
      {
        id: "access",
        prompt: "Can the roof be reached safely on the day?",
        help: "A technician will not walk a roof that is unsafe, and an inspection that cannot see the covering is not an inspection.",
        options: ["Yes", "No", "I am not sure"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "A roof the technician cannot reach safely cannot be documented to the standard the engineer reviews against. Tell the firm what is in the way and the scope can be looked at by a person.",
      },
    ],
    requiredInputs: [
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Gate codes, dogs, who will be there, and anything about the property that would waste a trip.",
        kind: "text",
        required: true,
      },
      {
        id: "prior_reports",
        label: "Any prior roof report or repair invoice",
        help: "Optional. If somebody has been on this roof before, the engineer would rather see it than rediscover it.",
        kind: "file",
        required: false,
        accepts: "PDF or photographs",
      },
    ],
    turnaround:
      "The visit is scheduled once a technician accepts. The engineer's review begins when the evidence is complete.",
    receives: [
      "A sealed engineering opinion on the condition of the roof and the service life it can reasonably be expected to have left",
      "The photographic record the opinion rests on, keyed to where each photograph was taken",
    ],
  },
  {
    serviceSlug: "windstorm-wpi-8",
    orderType: "field",
    priceCents: 85000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: 17500,
    protocolServiceSlug: "windstorm-wpi-8",
    qualifiers: [
      ADDRESS_QUALIFIER,
      OWNER_QUALIFIER,
      {
        id: "stage",
        prompt: "What stage is the work at?",
        help: "Windstorm evidence has to be gathered while the construction it certifies can still be seen.",
        options: [
          "Not started, or in progress and still open",
          "Complete and covered up",
          "Existing building, no recent work",
        ],
        disqualifyOn: [],
        disqualifiedMessage: "",
      },
    ],
    requiredInputs: [
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Gate codes, dogs, who will be there, and anything about the property that would waste a trip.",
        kind: "text",
        required: true,
      },
      {
        id: "permit",
        label: "Building permit or plans, if there are any",
        help: "Optional, and it helps. What was permitted tells the engineer what the construction was meant to be.",
        kind: "file",
        required: false,
        accepts: "PDF",
      },
    ],
    turnaround:
      "The visit is scheduled once a technician accepts. Completed construction that has been covered up takes longer, because what can still be evidenced has to be established first.",
    receives: [
      "The windstorm certification the engineer's review supports, sealed",
      "The photographic and measurement record it rests on",
    ],
  },
  {
    serviceSlug: "foundation-inspections",
    orderType: "field",
    priceCents: 65000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: 17500,
    protocolServiceSlug: "foundation-inspections",
    qualifiers: [
      ADDRESS_QUALIFIER,
      OWNER_QUALIFIER,
      {
        id: "access",
        prompt: "Is the perimeter of the structure clear enough to walk and measure?",
        help: "Elevation readings are taken around and inside the structure. Storage against the walls stops that.",
        options: ["Yes", "No", "I am not sure"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "Elevations that cannot be taken are readings the engineer will not have. Clear what can be cleared and order again, or tell the firm what is fixed in place and a person will look at the scope.",
      },
    ],
    requiredInputs: [
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Gate codes, dogs, who will be there, and anything about the property that would waste a trip.",
        kind: "text",
        required: true,
      },
      {
        id: "symptoms",
        label: "What made you order this",
        help: "Cracking, doors that stick, a lender asking, a sale. The engineer reads the evidence either way, and knowing what prompted it is worth having.",
        kind: "text",
        required: false,
      },
    ],
    turnaround:
      "The visit is scheduled once a technician accepts. The engineer's review begins when the evidence is complete.",
    receives: [
      "A sealed engineering opinion on the condition and performance of the foundation",
      "The elevation survey and photographic record the opinion rests on",
    ],
  },
  {
    serviceSlug: "manufactured-home-foundation-certifications",
    orderType: "field",
    priceCents: 65000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: 17500,
    protocolServiceSlug: "manufactured-home-foundation-certifications",
    qualifiers: [
      ADDRESS_QUALIFIER,
      OWNER_QUALIFIER,
      {
        id: "underside",
        prompt: "Can the underside of the home be accessed?",
        help: "The certification is about anchorage and piers, and those are under the home.",
        options: ["Yes", "No", "I am not sure"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "Anchorage and piers that cannot be seen cannot be certified. Skirting can usually be opened; if it cannot, tell the firm and a person will look at it.",
      },
    ],
    requiredInputs: [
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Gate codes, dogs, who will be there, and anything about the property that would waste a trip.",
        kind: "text",
        required: true,
      },
      {
        id: "hud_label",
        label: "The HUD label or data plate, if you have it",
        help: "Optional. It identifies the home, and finding it in the field costs time.",
        kind: "file",
        required: false,
        accepts: "A photograph or PDF",
      },
    ],
    turnaround:
      "The visit is scheduled once a technician accepts. Lenders commonly set their own deadline, so say if you have one.",
    receives: [
      "The foundation certification the engineer's review supports, sealed",
      "The record of anchorage and pier conditions it rests on",
    ],
  },

  // -------------------------------------------------------------- desk orders
  {
    serviceSlug: "solar-structural-letters",
    orderType: "desk",
    priceCents: 45000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [
      ADDRESS_QUALIFIER,
      {
        id: "documents",
        prompt: "Do you have the array layout and the mounting details?",
        help: "A desk review is a review of documents. Without them there is nothing to review.",
        options: ["Yes", "No"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "A structural letter is written from the layout and the attachment details. Your installer or the racking manufacturer will have them. Come back when you do.",
      },
    ],
    requiredInputs: [
      {
        id: "layout",
        label: "The array layout",
        help: "Panel positions on the roof, with the module make and model.",
        kind: "file",
        required: true,
        accepts: "PDF or a drawing",
      },
      {
        id: "mounting",
        label: "The mounting and attachment details",
        help: "The racking system, the attachment type, and the spacing.",
        kind: "file",
        required: true,
        accepts: "PDF or manufacturer literature",
      },
      {
        id: "structure",
        label: "What the roof is framed with, if you know",
        help: "Truss or rafter, the spacing, and the span. If you do not know, say so rather than guessing.",
        kind: "text",
        required: false,
      },
    ],
    turnaround: "No site visit. The engineer's review begins when the documents are complete.",
    receives: ["The structural letter the engineer's review supports, sealed"],
  },
  {
    serviceSlug: "structural-letters",
    orderType: "desk",
    priceCents: 55000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [
      ADDRESS_QUALIFIER,
      {
        id: "question",
        prompt: "Is there a specific question the letter has to answer?",
        help: "A letter answers something. A letter that answers nothing in particular is not useful to whoever asked for it.",
        options: ["Yes", "No, I was just told to get a letter"],
        disqualifyOn: [],
        disqualifiedMessage: "",
      },
    ],
    requiredInputs: [
      {
        id: "question_text",
        label: "What does the letter need to say, and who asked for it",
        help: "A city, a lender, an insurer, a buyer. Their words if you have them.",
        kind: "text",
        required: true,
      },
      {
        id: "documents",
        label: "Everything you have about the structure",
        help: "Plans, prior reports, photographs, permits. The engineer works from what is here.",
        kind: "file",
        required: true,
        accepts: "PDF or photographs",
      },
    ],
    turnaround: "No site visit. The engineer's review begins when the documents are complete.",
    receives: ["The letter the engineer's review supports, sealed"],
  },
  {
    /*
     * A judgment call, recorded because it is one.
     *
     * A repair specification describes work on damage somebody has already
     * documented, so it is treated as a desk order and the customer supplies the
     * documentation. That is right when a report already exists and wrong when
     * the damage has never been looked at by anybody.
     *
     * The qualifier below is what separates the two, and a customer with no
     * documentation is routed to an inspection rather than sold a specification
     * the engineer would have nothing to write from.
     */
    serviceSlug: "repair-specifications",
    orderType: "desk",
    priceCents: 90000,
    coastalSurchargeCents: 7500,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [
      ADDRESS_QUALIFIER,
      {
        id: "assessment",
        prompt: "Has the damage already been documented by an inspection or a report?",
        help: "A specification describes the repair for damage somebody has established. It does not establish it.",
        options: ["Yes, I have a report", "No, nobody has looked at it yet"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "A repair specification is written from an assessment of the damage. Order the inspection for this structure first; its findings are what the specification is then written from.",
      },
    ],
    requiredInputs: [
      {
        id: "assessment_report",
        label: "The report or assessment of the damage",
        help: "Whatever established what is wrong. An engineer's report, an inspection, an adjuster's scope.",
        kind: "file",
        required: true,
        accepts: "PDF",
      },
      {
        id: "photographs",
        label: "Photographs of the damage",
        help: "Wide enough to place it, close enough to see it.",
        kind: "file",
        required: true,
        accepts: "Photographs",
      },
    ],
    turnaround: "No site visit. The engineer's review begins when the documents are complete.",
    receives: [
      "A sealed repair specification defining the scope of work",
      "A document three contractors can price against identically",
    ],
  },

  // ------------------------------------------------------------- quote orders
  {
    serviceSlug: "residential-light-commercial-design",
    orderType: "quote",
    priceCents: null,
    coastalSurchargeCents: null,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [ADDRESS_QUALIFIER],
    requiredInputs: [
      {
        id: "project",
        label: "What are you building",
        help: "What it is, roughly how big, and where it is in the process.",
        kind: "text",
        required: true,
      },
      {
        id: "drawings",
        label: "Anything drawn so far",
        help: "Architectural drawings, a survey, a sketch on paper. Whatever exists.",
        kind: "file",
        required: false,
        accepts: "PDF or images",
      },
      {
        id: "deadline",
        label: "Is there a date this has to be done by",
        help: "A permit hearing, a closing, a start on site.",
        kind: "date",
        required: false,
      },
    ],
    turnaround: "A person scopes this and comes back with a quote. Nothing is charged until you accept one.",
    receives: ["A written quote with a defined scope", "No charge until you accept it"],
  },
  {
    serviceSlug: "forensic-engineering",
    orderType: "quote",
    priceCents: null,
    coastalSurchargeCents: null,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [
      ADDRESS_QUALIFIER,
      {
        id: "litigation",
        prompt: "Is this connected to a claim, a dispute, or litigation?",
        help: "It changes how the work is scoped and what the engineer's obligations are. It does not change whether the firm will do it.",
        options: ["Yes", "No", "Not yet, but it might be"],
        disqualifyOn: [],
        disqualifiedMessage: "",
      },
    ],
    requiredInputs: [
      {
        id: "matter",
        label: "What happened, and what is in dispute",
        help: "In your own words. Dates matter.",
        kind: "text",
        required: true,
      },
      {
        id: "documents",
        label: "Anything already produced about it",
        help: "Reports, claim correspondence, photographs, pleadings.",
        kind: "file",
        required: false,
        accepts: "PDF or images",
      },
    ],
    turnaround: "A person scopes this and comes back with a quote. Nothing is charged until you accept one.",
    receives: ["A written quote with a defined scope", "No charge until you accept it"],
  },
];

// ---------------------------------------------------------------- accessors

export const catalogFor = (serviceSlug: string): CatalogEntry | undefined =>
  CATALOG.find((entry) => entry.serviceSlug === serviceSlug);

export const catalogByType = (type: OrderType): CatalogEntry[] =>
  CATALOG.filter((entry) => entry.orderType === type);

/**
 * Why this service cannot be ordered right now, or null if it can.
 *
 * ONE FUNCTION, TWO REASONS, DELIBERATELY THE SAME ANSWER
 * ------------------------------------------------------
 * The compliance gate and a missing price are different facts inside the firm
 * and the same fact to a customer: this order is not being taken today. Making
 * them one answer means there is exactly one place that can be wrong, and no
 * path where a page renders a checkout because it consulted only one of them.
 *
 * `prelaunch` is passed in rather than read here, because this file is copied
 * into three repositories and each has its own launch module. A cross repo
 * import would be the first thing to break on the copy.
 */
export function orderBlockedReason(
  entry: CatalogEntry | undefined,
  prelaunch: boolean,
): string | null {
  if (!entry) return "This service is not in the order catalog.";
  if (prelaunch) {
    return "The firm's registration with the Texas Board of Professional Engineers and Land Surveyors is pending. No order can be placed and no payment can be taken until it is active.";
  }
  if (entry.orderType === "quote") return null;
  if (entry.priceCents === null) {
    return "A price has not been published for this service yet, so it cannot be ordered online.";
  }
  if (entry.orderType === "field" && entry.inspectionFeeCents === null) {
    return "The inspection fee for this service has not been set, and the refund rule cannot be stated without it, so it cannot be ordered online.";
  }
  return null;
}

export const orderable = (entry: CatalogEntry | undefined, prelaunch: boolean): boolean =>
  orderBlockedReason(entry, prelaunch) === null;
