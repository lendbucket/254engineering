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
 * THIS FILE NO LONGER HOLDS PRICES. `src/config/prices.ts` DOES.
 * Operator ruling, 2026-09-20.
 * ----------------------------------------------------------------------------
 * Every price is read from there when `CATALOG` is built, so the number a card
 * is charged is the number the site publishes. The long note that used to sit
 * here recited the operator's 2026-09-03 ruling verbatim in dollars, and by
 * 2026-09-20 **every figure in it was wrong**: 600, 650, 650, 550, 850, 900 and
 * 450 against a price book that had moved to 549, 495, 645, 395, 795, 395 and
 * 445. It is not reproduced, because a second account of a price is the exact
 * thing this change removes, and a superseded one written out as a quotation is
 * worse than none: it reads as authority.
 *
 * What survives from that ruling and still matters: the coastal surcharge of
 * $75 on first tier counties, and the $175 inspection fee retained on a decline
 * after a visit. Both are still held here as fields on the entries, because
 * neither is a price for a deliverable and neither lives in the price book.
 *
 * The principle underneath it is unchanged and is why the file shipped with
 * every price null for a month: **a price is a commercial decision, and
 * inventing one would put a fabricated figure on three public websites and into
 * a checkout.** Deriving one from the price book is not inventing it. Deriving
 * one from cost, or from a sibling, still would be.
 *
 * WHAT IS NULL, AND WHY
 * ---------------------
 * priceCents is still Cents and a quoted deliverable still resolves to null,
 * because nothing is owed on a quote request until somebody scopes it. What has
 * changed is that null is now an ANSWER the rule gives rather than a value
 * somebody typed: an hourly line quotes everything it sells. The arithmetic
 * that treats null as unknown rather than zero is untouched and is still what
 * stops an unpriced service reaching a checkout.
 *
 * THE INSPECTION FEE IS ON FIELD SERVICES ONLY
 * --------------------------------------------
 * A desk review has no site visit, so there is no visit to retain a fee for,
 * and its refund is always full. Setting one on a desk service would create a
 * deduction the middle row of the refund rule can never justify.
 */

import type { Cents } from "@/lib/ops-money";
import { deliverablePriceCents } from "@/config/prices";

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
  /**
   * The deliverable within that service line.
   *
   * WHY A SERVICE LINE HAS MORE THAN ONE OF THESE
   * ---------------------------------------------
   * Operator ruling, 2026-09-03. Residential and light commercial design sells
   * beam and header sizing at a fixed price, a carport and patio cover plan set
   * at a fixed price, and custom foundation and framing packages by quote. One
   * service page, three deliverables, two of them priced and one not.
   *
   * The catalog was one entry per service before that, which made a service
   * either wholly fixed price or wholly quoted. It is now a list of
   * DELIVERABLES, and `serviceSlug` is which page each belongs to.
   *
   * THE NAME MATCHES eng_fee_schedule, NOT A NEW IDEA
   * -------------------------------------------------
   * That table already keys on (kind, service_slug, tier, county_band,
   * urgency), so a tier is the unit the firm already prices at, for the client
   * price, the technician's pay and the engineer's production alike. Using the
   * same word means one tier has one client price and one engineer production
   * figure, and the two cannot drift into describing different things.
   *
   * Unique with serviceSlug. order-audit enforces it.
   */
  tier: string;
  /** What the customer chooses, in their words. */
  name: string;
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
   * WHICH COUNTIES, AND WHY HARRIS CARRIES NOTHING
   * ----------------------------------------------
   * First tier is the fourteen TWIA designated seaward counties, which is what
   * twiaStatus() returns "designated" for.
   *
   * HARRIS COUNTY CARRIES NO SURCHARGE. Operator ruling, 2026-09-03, and the
   * reasoning is recorded here at their instruction because it is the one
   * county where a name is not an answer.
   *
   * The windstorm designated area in Harris is not the county. It is the part
   * of it east of State Highway 146, which is a line through a county of four
   * and a half million people: Baytown, Seabrook and La Porte are inside it and
   * Houston is not. twiaStatus() therefore returns "check" for Harris rather
   * than a boolean, because a county name genuinely cannot express where a
   * property sits relative to a highway.
   *
   * A "check" county gets no surcharge. The alternative is charging every
   * Houston customer 75 dollars for a coastal designation that does not apply to
   * them, and the firm would be collecting it on the strength of a county name
   * it knows to be the wrong unit. When the platform can place a property
   * against that line, from a geocode or from the customer's own answer, Harris
   * becomes answerable and this changes. Until then not charging is the only
   * defensible direction.
   *
   * APPLIED TO DESK DELIVERABLES TOO
   * --------------------------------
   * Operator ruling, 2026-09-03, confirming the reading: a coastal letter
   * carries windstorm criteria an inland one does not, so the engineer does
   * more work whether or not anybody drives out. The surcharge is a property of
   * the property, not of whether there is a site visit.
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
  prompt: "Do you own the property, or are you authorized by the owner to arrange this?",
  help: "A technician has to enter the property, and the engineer's document names it.",
  options: ["I own it", "I am authorized by the owner", "Neither"],
  disqualifyOn: [2],
  disqualifiedMessage:
    "The firm needs the owner's authority before anyone attends a property or issues a document about it. Ask the owner to place the order, or to send written authority naming you.",
};

/*
 * Required by Appendix A Part 2 of six of the seven v1.1 protocols: WS-001,
 * MH-001, SL-001, PL-001, RS-001 and DS-001. WP-001 does not ask for it. Ruling
 * 6 of 2026-10-07, docs/conflicts-v1.1.md item 27.
 */
const FRONT_PHOTO_INPUT: RequiredInput = {
  id: "front_photo",
  label: "A photograph of the front of the property",
  help: "It confirms the address and the structure before anybody travels or starts a review.",
  kind: "file",
  required: true,
  accepts: "A photograph",
};

/*
 * =========================================================================
 * `prices.ts` IS THE PRICE. THIS FILE IS BEING CORRECTED TO MATCH IT, AND
 * THEN IT WILL STOP HOLDING PRICES AT ALL. Operator ruling, 2026-09-20.
 * =========================================================================
 *
 * **EVERY PRICED LINE IN THIS FILE DISAGREED WITH `src/config/prices.ts`, AND
 * NOTHING COMPARED THEM.** The site published one number and a card was charged
 * another, on all eight priced lines, the widest being repair specifications
 * advertised at $395 and charged at $900.
 *
 * | Line | The site said | This file charged |
 * | roof-inspections | $549 | $600 |
 * | foundation-inspections | $495 | $650 |
 * | structural-letters | $395 | $550 |
 * | solar-structural-letters | $445 | $450 |
 * | manufactured-home-foundation | $645 | $650 |
 * | windstorm-wpi-8 | $795 | $850 |
 * | repair-specifications | $395 | $900 |
 * | design | hourly, $2,000 minimum | $750 and $1,500 fixed |
 *
 * The gaps follow no rule, $5 to $505, so it is drift rather than a deliberate
 * transform. `prices.ts` is read by the public site and the portal price book;
 * this file is read by `OrderFlow`, the v1 orders API, bulk ordering, intake and
 * `ops-payments`, which is what a card is actually charged.
 *
 * **SIXTH INSTANCE OF ONE FACT WITH TWO HOMES, AND THE FIRST WHERE THE CLAIM AND
 * THE DEFECT SHARED A FILE.** `prices.ts` opens by naming itself the fifth fact
 * given the one-home treatment and says in its own words that "the number a
 * customer is charged and the number the margin is computed against cannot
 * drift". It said so while this file held a second copy of every one of them.
 *
 * **WHY NOTHING CAUGHT IT.** `price-book-audit` imports `prices.ts` and has
 * never read the catalogue. It asserted every ruled figure was correctly stated
 * in the price book, which was true, and could not see the other home. An audit
 * named after the price book never compared the price book to the thing that
 * takes the money.
 *
 * **WHAT IS DONE HERE AND WHAT IS NOT.** The numbers below are corrected to the
 * ruled figures, which is the money fix and cannot wait. They are therefore
 * still a SECOND HOME, deliberately and briefly: the mechanism that removes
 * them, so this file derives its prices rather than restating them, is the next
 * commit and the check goes in with it.
 *
 * **WPI-8 IS CORRECTED TO $795 AND IS STILL WRONG FOR HALF ITS BUYERS.** That
 * line sells two different jobs, completed construction at $795 and ongoing at
 * $995, distinguished by a QUALIFIER ANSWER rather than by a tier, so one entry
 * cannot carry both. $795 is now right for completed construction and
 * undercharges ongoing by $200, where $850 was wrong for both. The split into
 * two deliverables is with the operator and is the thing that closes it.
 */
/**
 * The deliverables, DECLARED WITHOUT A PRICE.
 *
 * `priceCents` is deliberately absent from every entry below and is filled in
 * by `CATALOG`, which reads it from `src/config/prices.ts`. A price typed here
 * would not fail to compile, it would fail to exist: the type omits it.
 */
type CatalogDeclaration = Omit<CatalogEntry, "priceCents">;

const DECLARED: CatalogDeclaration[] = [
  // ------------------------------------------------------------- field orders
  {
    serviceSlug: "roof-inspections",
    tier: "standard",
    name: "Roof certification letter",
    orderType: "field",
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
      /*
       * ORDER FLOW V2, 2026-10-07: EACH FACT ASKED ONCE. The access note's help
       * used to ask for gate codes, dogs and who will be there, which the form
       * now asks as their own fields; it asks only for what those cannot. And
       * `prior_reports` ("Any prior roof report or repair invoice") is gone
       * from this line: RC-001 asks for the prior inspection report and the
       * roofing contract or invoice as its own uploads, so it was the same
       * document asked twice, and its label carried "(optional)" while its
       * help began "Optional.". Nothing read the field.
       */
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Anything about getting in, or about the property, that the questions above do not cover and that would waste a trip.",
        kind: "text",
        required: true,
      },
    ],
    turnaround:
      "The visit is scheduled once a technician accepts. The engineer's review begins when the evidence is complete.",
    /*
     * QUOTED FROM 254-RC-001 SECTION 11, operator ruling of 2026-10-08. Until
     * that day this line promised a forecast of how long the roof would last,
     * on the order status page and in the order email, which the signed
     * protocol excludes in so many words. The old text is in the commit that
     * replaced it. The protocol is quoted, not paraphrased, and
     * protocol-registry-audit now reads this file. This comment deliberately
     * does not spell the excluded phrases, so the check reads only copy.
     */
    receives: [
      'A sealed engineering letter. From 254-RC-001, section 11: "The letter states observed condition only. It does not estimate remaining service life, forecast future performance, or represent that the roof will not leak."',
      "The photographic record the opinion rests on, keyed to where each photograph was taken",
    ],
  },
  /*
   * ONE LINE, TWO DELIVERABLES, SPLIT ON 2026-09-20 BY OPERATOR RULING.
   *
   * `windstorm-wpi-8/standard` was one entry at one price covering two
   * genuinely different jobs. Completed construction is one visit to a finished
   * structure; ongoing construction is staged attendance while the work is
   * open, which is more attendance and a different obligation. They are $795
   * and $995, tier 2 and tier 3, floor $650 and floor $925, and NOT ONE OF
   * THOSE SIX FACTS COULD BE STATED while the deliverable was one row.
   *
   * Three files had each invented a private workaround: `WPI8_ONGOING_CENTS` in
   * prices.ts, `WPI8_ONGOING_TIER` in engineer-pay.ts which nothing ever read,
   * and trade-floors.ts was about to need a third. All three retire into these
   * two rows.
   *
   * THE STAGE QUALIFIER IS DELIBERATELY UNCHANGED ON BOTH, and that is an open
   * question rather than a decision. It has three options against two
   * deliverables, and whether a WPI-8 is issuable at all on an existing building
   * with no recent work is an engineering question the operator has referred to
   * the engineer of record rather than answer. Until it comes back the qualifier
   * gathers the fact and disqualifies nobody, exactly as before. What has
   * changed is only that the qualifier no longer silently decides the price: the
   * deliverable does, and the buyer chooses it before they see a number.
   */
  /*
   * THE STAGE QUALIFIER IS RULED, 2026-10-07. Ruling 5: completed and ongoing
   * construction are the two fixed prices and only an existing building with
   * no recent work is quoted per job. Ruling 6 with WS-001 and WP-001 v1.1:
   * construction still in progress is routed to the ongoing line (WS-001
   * section 12), and a structure that has already passed a stage that must be
   * inspected is declined for the ongoing path (WP-001 section 6.2). So each
   * deliverable now turns away the two stages it does not serve, and says
   * where to go instead. docs/conflicts-v1.1.md items 3 and 5.
   */
  {
    serviceSlug: "windstorm-wpi-8",
    tier: "completed",
    name: "WPI-8E windstorm evaluation, completed construction",
    orderType: "field",
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
        disqualifyOn: [0, 2],
        disqualifiedMessage:
          "This deliverable is for construction that is already complete. Work that has not started or is still open is inspected in stages under ongoing construction. An existing building with no recent work is quoted per job through the windstorm inquiry instead.",
      },
    ],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Gate codes, dogs, who will be there, and anything about the property that would waste a trip.",
        kind: "text",
        required: true,
      },
      /*
       * WS-001 v1.1 section 6 records "the dates construction began and was
       * completed", and section 12 declines work that began before
       * January 1, 1988. The catalogue asked for no date. Item 7.
       */
      {
        id: "work_began",
        label: "When the work being certified began",
        help: "The date the work began, not the year the house was built. The permit or the contract usually shows it.",
        kind: "date",
        required: true,
      },
      /* WS-001 Appendix A Part 2, required. Item 9. */
      {
        id: "contract_invoice",
        label: "The contract or invoice for the work",
        help: "Showing the products installed. It is what tells the engineer what the construction was meant to be.",
        kind: "file",
        required: true,
        accepts: "PDF or a photograph",
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
      "The visit is scheduled once a technician accepts. Construction that has been covered up takes longer, because what can still be evidenced has to be established first.",
    /*
     * WS-001 section 3: "TDI issues the certificate. The firm does not issue it
     * and does not promise that TDI will." This read "The windstorm
     * certification the engineer's review supports, sealed". Item 8.
     */
    receives: [
      "A sealed post-construction inspection report, supporting a Form WPI-2E application to the Texas Department of Insurance",
      "The photographic and measurement record it rests on",
      "The certificate itself, Form WPI-8E, is issued by the Department rather than by the firm",
    ],
  },
  {
    serviceSlug: "windstorm-wpi-8",
    tier: "ongoing",
    /* WP-001 section 1: Form WPI-2, then the WPI-8. WPI-8E is the completed route. Item 2. */
    name: "WPI-8 windstorm inspection, ongoing construction",
    orderType: "field",
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
        disqualifyOn: [1, 2],
        disqualifiedMessage:
          "This deliverable is for construction that has not started or is still open to view, inspected in stages. Construction that is already complete is evaluated under completed construction. An existing building with no recent work is quoted per job through the windstorm inquiry instead.",
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
      "Attendance is staged against the construction programme rather than booked as a single visit, because the evidence has to be gathered while each stage is still open.",
    /* WP-001 section 1, and the firm does not issue the certificate. Item 8. */
    receives: [
      "Form WPI-2, prepared and submitted to the Texas Department of Insurance by the appointed engineer",
      "The photographic and measurement record it rests on, stage by stage",
      "The certificate itself, Form WPI-8, is issued by the Department rather than by the firm",
    ],
  },
  {
    serviceSlug: "foundation-inspections",
    tier: "standard",
    name: "Foundation certification",
    orderType: "field",
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
    tier: "standard",
    name: "Manufactured home foundation certification",
    orderType: "field",
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
      FRONT_PHOTO_INPUT,
      {
        id: "access_notes",
        label: "How does the technician get in",
        help: "Gate codes, dogs, who will be there, and anything about the property that would waste a trip.",
        kind: "text",
        required: true,
      },
      /*
       * MH-001 v1.1 Appendix A Part 2, required: "The lender's written request
       * for the certification". Ruling 6 of 2026-10-07; the catalogue never
       * asked for it.
       */
      {
        id: "lender_request",
        label: "The lender's written request for the certification",
        help: "The lender's letter, email or condition naming the certification. The certification follows HUD-7584 unless the lender names another requirement in writing and the engineer approves it before the visit.",
        kind: "file",
        required: true,
        accepts: "PDF or a photograph",
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
    tier: "standard",
    name: "Solar structural letter",
    /*
     * FIELD SINCE 2026-10-07, operator ruling 7 that day: SL-001 sends a
     * technician, so the line carries the visit, per the protocol-wins rule
     * (docs/conflicts-v1.1.md items 16 and 17). Its inspection fee is $175,
     * ruled the same day, like every other field line.
     */
    orderType: "field",
    coastalSurchargeCents: 7500,
    /* $175, operator ruling of 2026-10-07: the same as every other field line. */
    inspectionFeeCents: 17500,
    protocolServiceSlug: "solar-structural-letters",
    qualifiers: [
      ADDRESS_QUALIFIER,
      /*
       * SL-001 v1.1 SECTION 6, ruling 6 of 2026-10-07: "An order is accepted
       * without the array design. No calculation is started and no letter is
       * issued until it is received." This qualifier used to turn the buyer
       * away without it. It now gathers the fact and turns nobody away, and
       * the layout input below is optional for the same reason.
       */
      {
        id: "documents",
        prompt: "Do you have the array layout and the mounting details yet?",
        help: "The order can be placed without them. No calculation starts and no letter issues until they arrive.",
        options: ["Yes", "Not yet"],
        disqualifyOn: [],
        disqualifiedMessage: "",
      },
    ],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
      {
        id: "layout",
        label: "The array layout, if you have it",
        help: "Panel positions on the roof, with the module make and model. If your installer has not produced it yet, it can follow.",
        kind: "file",
        required: false,
        accepts: "PDF or a drawing",
      },
      {
        id: "mounting",
        label: "The mounting and attachment details, if you have them",
        help: "The racking system, the attachment type, and the spacing. They are part of the array design and can follow with it.",
        kind: "file",
        required: false,
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
    /*
     * SL-001 v1.1 section 6: "There is no default. On every job the engineer
     * decides at intake whether a technician visits or the job rests on the
     * installer's site survey photographs." Section 12: "The firm does not
     * issue a solar letter from drawings alone." This said "No site visit."
     */
    turnaround:
      "The engineer decides at intake whether a technician visits or the installer's site survey photographs are enough. No letter is issued from drawings alone, and no calculation starts until the array design arrives.",
    receives: ["The structural letter the engineer's review supports, sealed"],
  },
  {
    serviceSlug: "structural-letters",
    tier: "standard",
    name: "Structural letter for permit",
    /* FIELD SINCE 2026-10-07, ruling 7: PL-001 sends a technician (conflicts item 20). Fee $175, ruled the same day. */
    orderType: "field",
    coastalSurchargeCents: 7500,
    /* $175, operator ruling of 2026-10-07: the same as every other field line. */
    inspectionFeeCents: 17500,
    protocolServiceSlug: "structural-letters",
    qualifiers: [
      ADDRESS_QUALIFIER,
      /*
       * PL-001 v1.1, ruling 6 of 2026-10-07. Section 2: the protocol covers a
       * letter to a permitting authority that "has asked, in writing", and
       * nothing else. Section 12: "No written request from the permitting
       * authority. Not accepted until one is supplied." This qualifier used to
       * accept "No, I was just told to get a letter" and disqualify nobody.
       */
      {
        id: "question",
        prompt: "Has the permitting authority asked for the letter in writing?",
        help: "The letter answers the authority's request exactly as it was written, so the request is where it starts.",
        options: ["Yes", "No, I was just told to get a letter"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "The letter answers a written request from the building department, as it was written. Ask the department for its request, comment or correction notice in writing, and the order can start once you have it.",
      },
    ],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
      {
        id: "question_text",
        label: "What the permitting authority asked for",
        help: "The building department's request in its own words, and the permit number if there is one.",
        kind: "text",
        required: true,
      },
      {
        id: "authority_request",
        label: "The permitting authority's written request",
        help: "The request, plan review comment, or correction notice itself.",
        kind: "file",
        required: true,
        accepts: "PDF or a photograph of the notice",
      },
      {
        id: "documents",
        label: "Plans, earlier letters, or inspection reports, if there are any",
        help: "Plans or specifications for the element, a failed inspection report or stop work order, an earlier engineer's letter. Photographs help the engineer decide, and do not replace a visit where the letter concerns existing construction.",
        kind: "file",
        required: false,
        accepts: "PDF or photographs",
      },
    ],
    /*
     * PL-001 section 6: "A site job is any job where the letter concerns
     * existing construction ... Photographs supplied by the customer do not
     * replace a technician visit." This said "No site visit." orderType stays
     * desk until the operator rules what a site job costs (conflicts item 20).
     */
    turnaround:
      "The engineer triages the order within one business day and records whether it is a site job or a desk job. A letter about existing construction rests on a technician's visit. Review begins when the record is complete.",
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
    tier: "standard",
    name: "Repair specification",
    /* FIELD SINCE 2026-10-07, ruling 7: RS-001 sends a technician (conflicts item 23). Fee $175, ruled the same day. */
    orderType: "field",
    coastalSurchargeCents: 7500,
    /* $175, operator ruling of 2026-10-07: the same as every other field line. */
    inspectionFeeCents: 17500,
    protocolServiceSlug: "repair-specifications",
    qualifiers: [
      ADDRESS_QUALIFIER,
      /*
       * RS-001 v1.1, ruling 6 of 2026-10-07. Appendix A Part 2 makes a report
       * on the damage "Required if it exists", and section 7 has the
       * technician capture the damage on site. This qualifier used to turn
       * away "No, nobody has looked at it yet" and the report was required.
       * Both now follow the protocol.
       */
      {
        id: "assessment",
        prompt: "Has the damage already been documented by an inspection or a report?",
        help: "If there is a report, it helps. If there is not, the technician's visit documents the damage the specification is written for.",
        options: ["Yes, I have a report", "No, nobody has looked at it yet"],
        disqualifyOn: [],
        disqualifiedMessage: "",
      },
    ],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
      {
        id: "assessment_report",
        label: "Any report on the damage, if there is one",
        help: "An engineer's report, an inspection, or an insurer's report.",
        kind: "file",
        required: false,
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
    /*
     * RS-001 section 7: "A specification is not written without a technician
     * visit, except where an earlier job file of this firm already holds the
     * evidence and the engineer finds it is still current." This said "No site
     * visit." orderType stays desk until the operator rules it (conflicts
     * item 23).
     */
    turnaround:
      "A technician visits before the specification is written, unless an earlier job file of this firm already holds the evidence and the engineer finds it still current. Review begins when the record is complete.",
    receives: [
      "A sealed repair specification defining the scope of work",
      "A document three contractors can price against identically",
    ],
  },

  // ------------------------------------------------------------- quote orders
  /*
   * RESIDENTIAL AND LIGHT COMMERCIAL DESIGN SELLS THREE THINGS, AND SINCE
   * 2026-09-20 ALL THREE ARE QUOTED.
   * ----------------------------------------------------------
   * Operator ruling, 2026-09-03, recorded rather than deleted because a
   * superseded decision that leaves no trace looks like one nobody made: this
   * line sold TWO FIXED PRICE deliverables, beam and header sizing at $750 and
   * a carport and patio plan set at $1,500, alongside one quoted. That is the
   * case the tier field exists for, and it remains the reason there are three
   * entries here rather than one.
   *
   * **THE TWO FIXED PRICES WERE BELOW THE FIRM'S OWN MINIMUM ENGAGEMENT.**
   * Operator ruling, 2026-09-20. `src/config/prices.ts` has always said this
   * line is hourly at $225 with a $2,000 minimum, which is the point below
   * which the firm does not take the work. Both fixed prices sat under it, so
   * the catalogue was selling, at checkout, two engagements the price book says
   * the firm declines. Design comes off fixed prices entirely.
   *
   * All three are `orderType: "quote"` with no price, which is the vocabulary
   * `custom-package` already used. It matters that it is "quote" rather than a
   * null price on a desk order: `orderBlockedReason` answers a null price with
   * "a price has not been published for this service yet", and design's price IS
   * published. It is hourly. Reaching for the nearest available word there would
   * have put a false sentence in front of a customer.
   */
  {
    serviceSlug: "residential-light-commercial-design",
    tier: "beam-header-sizing",
    name: "Beam and header sizing",
    orderType: "quote",
    coastalSurchargeCents: null,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [
      ADDRESS_QUALIFIER,
      {
        id: "dimensions",
        prompt: "Do you know the span and what the beam carries?",
        help: "A size comes from a span and a load. Without both there is nothing to calculate.",
        options: ["Yes", "No, I need somebody to work that out"],
        disqualifyOn: [1],
        disqualifiedMessage:
          "Sizing a beam needs the span and what sits above it. If those have to be established on site, that is a custom package rather than a sizing, and the quote path on this page is the right way in.",
      },
    ],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
      {
        id: "spans",
        label: "The span, and what the beam or header carries",
        help: "Clear span in feet, and what bears on it: roof only, one floor above, two, a wall.",
        kind: "text",
        required: true,
      },
      {
        id: "plans",
        label: "A plan, sketch or photograph of the opening",
        help: "Whatever shows the opening and what is above it. A phone photograph and a hand sketch are enough.",
        kind: "file",
        required: true,
        accepts: "PDF or photographs",
      },
      {
        id: "preference",
        label: "Any material preference",
        help: "Optional. Dimensional lumber, engineered lumber, steel. If it does not matter, say so.",
        kind: "text",
        required: false,
      },
    ],
    turnaround:
      "The engineer decides at acceptance whether a technician visits; the engineer does not attend. Review begins when the span and the loads are complete.",
    receives: [
      "A sealed sizing for the beam or header, with the span and loads it was calculated for stated on it",
      "A written quote from the engineer's estimate of the hours, and no charge until you accept it",
    ],
  },
  {
    serviceSlug: "residential-light-commercial-design",
    tier: "carport-patio-plan-set",
    name: "Carport and patio cover plan set",
    orderType: "quote",
    coastalSurchargeCents: null,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [
      ADDRESS_QUALIFIER,
      {
        id: "attachment",
        prompt: "Is the cover free standing, or attached to the house?",
        help: "An attached cover loads the existing structure, which changes what has to be checked.",
        options: ["Free standing", "Attached to the house", "I am not sure"],
        disqualifyOn: [],
        disqualifiedMessage: "",
      },
    ],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
      {
        id: "dimensions",
        label: "The dimensions you want",
        help: "Length, width and height. Approximate is fine at this stage.",
        kind: "text",
        required: true,
      },
      {
        id: "site",
        label: "Photographs of where it goes",
        help: "Wide enough to see the whole area, including the wall it attaches to if it does.",
        kind: "file",
        required: true,
        accepts: "Photographs",
      },
      {
        id: "permit_office",
        label: "Which city or county will review it",
        help: "Optional, and useful. Some offices want particular details called out.",
        kind: "text",
        required: false,
      },
    ],
    turnaround:
      "The engineer decides at acceptance whether a technician visits; the engineer does not attend. Review begins when the dimensions and photographs are complete.",
    receives: [
      "A sealed plan set for the cover, to the wind loads for the property's county",
      "A document a permit office can review without asking for more",
      "A written quote from the engineer's estimate of the hours, and no charge until you accept it",
    ],
  },
  {
    serviceSlug: "residential-light-commercial-design",
    tier: "custom-package",
    name: "Custom foundation and framing package",
    orderType: "quote",
    coastalSurchargeCents: null,
    inspectionFeeCents: null,
    protocolServiceSlug: null,
    qualifiers: [ADDRESS_QUALIFIER],
    requiredInputs: [
      FRONT_PHOTO_INPUT,
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
];

/**
 * =========================================================================
 * THE CATALOGUE, WITH ITS PRICES READ FROM `src/config/prices.ts`.
 * Operator ruling, 2026-09-20.
 * =========================================================================
 *
 * **THIS FILE HELD A SECOND COPY OF EVERY PRICE AND DISAGREED WITH ALL OF
 * THEM.** The site published one number and a card was charged another, on
 * every priced line, the widest being repair specifications advertised at $395
 * and charged at $900. The gaps followed no rule, $5 to $505, so it was drift
 * rather than a transform, and nothing compared the two files.
 *
 * The operator's ruling was that the mechanism matters more than the
 * correction: one of the two files stops holding prices, and it is this one.
 * `priceCents` survives as a FIELD, so the nineteen consumers that read it are
 * untouched, and it is filled here rather than typed above. The number a card
 * is charged is now the number the site publishes by construction.
 *
 * **WHY THIS IS NOT JUST A TIDIER PLACE TO PUT THE SAME NUMBERS.** The rule in
 * `deliverablePriceCents` makes an HOURLY line quote every deliverable it
 * sells. Design is hourly at $225 with a $2,000 minimum, so its three
 * deliverables come out quoted without this file saying so, and a fixed price
 * typed onto a design deliverable could not take effect even if somebody tried.
 * Before this, two design deliverables were published at $750 and $1,500, both
 * BELOW the firm's own minimum engagement, so checkout sold two engagements the
 * price book says the firm declines. The ruling is now mechanical rather than
 * typed, which is the only version of it that stays true.
 */
export const CATALOG: CatalogEntry[] = DECLARED.map((entry) => ({
  ...entry,
  priceCents: deliverablePriceCents(entry.serviceSlug, entry.tier),
}));

// ---------------------------------------------------------------- accessors

/**
 * One deliverable.
 *
 * The tier is optional, and that is a deliberate compatibility affordance
 * rather than laziness: seven of the nine service lines have exactly one
 * deliverable, so asking for the service is unambiguous. Where a line has
 * several, omitting the tier returns undefined rather than the first one,
 * because guessing which of three products somebody meant is how a customer
 * gets charged 1500 for a 750 job.
 */
export function catalogFor(serviceSlug: string, tier?: string): CatalogEntry | undefined {
  const forService = deliverablesFor(serviceSlug);
  if (tier) return forService.find((entry) => entry.tier === tier);
  return forService.length === 1 ? forService[0] : undefined;
}

/** Every deliverable a service line sells, in the order the customer sees. */
export const deliverablesFor = (serviceSlug: string): CatalogEntry[] =>
  CATALOG.filter((entry) => entry.serviceSlug === serviceSlug);

/** Stable identity for one deliverable, used by orders and by the fee schedule. */
export const deliverableKey = (entry: CatalogEntry): string =>
  `${entry.serviceSlug}:${entry.tier}`;

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
 *
 * AND SO IS `hasApprovedProtocol`, FOR THE SAME REASON AND ONE MORE.
 * -----------------------------------------------------------------
 * Operator ruling, 2026-09-11: for every service line the sites offer at launch
 * there is one protocol approved by the engineer of record, and a line with no
 * approved protocol is not offered, it is a waitlist. This function is where
 * that becomes true of the ORDER rather than of the copy, because this is the
 * one place that decides whether money may be taken for a deliverable.
 *
 * The argument is dispatch. A field order with no approved protocol reaches a
 * technician with no checklist to work to and an engineer with no agreed basis
 * to review against, which means the firm has taken payment for work it has no
 * stated way to perform. That is worse than not selling it.
 *
 * IT IS A REQUIRED PARAMETER AND NOT AN OPTIONAL ONE WITH A DEFAULT, and the
 * choice is deliberate. Either default is wrong in a way nobody would see: true
 * lets a sibling repo sell an undispatchable line, false silently refuses every
 * order on a site that has launched. Required means the two sibling
 * repositories fail to COMPILE until somebody decides, which is the loudest and
 * earliest place this can be answered.
 */
/**
 * ===========================================================================
 * THE MODE, NOT A BOOLEAN, AND IT IS A CORRECTION OF A LIVE FALSEHOOD.
 * Operator ruling, 2026-09-23.
 * ===========================================================================
 *
 * WHAT WAS WRONG. The second parameter was called `prelaunch` and every caller
 * passed `!isOpen()`. Those are different facts: `!isOpen()` is true in
 * PRELAUNCH and in TRADING, and the sentence this function returned for it said
 * the firm's TBPELS registration is pending.
 *
 * IN TRADING THAT IS FALSE. The registration is active, and the order page
 * renders this string in its body, so a visitor was told the firm's
 * registration was pending while it was not.
 *
 * It is the inverse of what the compliance gate exists to prevent. The gate
 * stops the firm claiming capability it lacks; this had it disclaiming a
 * registration it holds, on a compliance sentence, where a buyer looks.
 *
 * A BOOLEAN COULD NOT BE FIXED, ONLY RENAMED. Two modes refuse an order and
 * they refuse it for different reasons, so one flag cannot carry a true
 * sentence for both. The mode is the smallest thing that can.
 *
 * STILL PASSED IN RATHER THAN READ HERE, for the reason the paragraph above
 * gives: this file is copied into three repositories and a cross repo import
 * would be the first thing to break. The union is written out rather than
 * imported for the same reason. Widening a parameter makes every call site fail
 * to COMPILE until somebody decides, which is how the third parameter was
 * introduced and is the loudest place to answer it.
 */
export type OrderGateMode = "prelaunch" | "trading" | "open";

export function orderBlockedReason(
  entry: CatalogEntry | undefined,
  mode: OrderGateMode,
  hasApprovedProtocol: boolean,
): string | null {
  if (!entry) return "That deliverable is not in the order catalog.";
  if (mode === "prelaunch") {
    /*
     * IT NO LONGER SAYS WHY, AND THAT IS THE SECOND HALF OF THE 2026-09-23 FIX.
     *
     * It read: "The firm's registration with the Texas Board of Professional
     * Engineers and Land Surveyors is pending. No order can be placed and no
     * payment can be taken until it is active."
     *
     * THAT WAS AN ASSUMPTION ABOUT WHICH CONDITION IS UNMET, not a fact.
     * Prelaunch means SOME trading condition is unmet, and there are three: the
     * registration, the engineer of record, and the telephone number. A firm
     * that is registered but has no engineer of record is in prelaunch, and
     * this sentence would have been false about it too.
     *
     * So it states only what prelaunch guarantees. The registration's actual
     * state is rendered by `registrationStatement()`, which reads the register,
     * and a page that wants to explain uses the deriver rather than a copy.
     *
     * Widening compliance-audit's sweep to cover this directory is what found
     * the trading half; this half was found by the same check refusing the file
     * a second time, which is the check doing its job rather than an exemption
     * being written for it.
     */
    return "The firm is not yet accepting engagements, so no order can be placed and no payment can be taken.";
  }
  if (mode === "trading") {
    /*
     * TRADING SAYS NOTHING ABOUT THE REGISTRATION, because there is nothing to
     * say: it is active, and a sentence about it here would be the defect this
     * change exists to remove. What is true in trading is narrower and duller,
     * which is the point. The firm is registered, it has an engineer of record,
     * and it is not yet taking orders through the site.
     */
    return "The firm is not taking orders through the site yet. Call the office or send a message and somebody will take the details.";
  }
  if (!hasApprovedProtocol) {
    return "No protocol for this service line has been approved by the engineer of record yet, so the firm has no agreed way to perform it. It is a waitlist rather than an order.";
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

export const orderable = (
  entry: CatalogEntry | undefined,
  mode: OrderGateMode,
  hasApprovedProtocol: boolean,
): boolean => orderBlockedReason(entry, mode, hasApprovedProtocol) === null;
