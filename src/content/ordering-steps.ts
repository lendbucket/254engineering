/**
 * ===========================================================================
 * HOW ORDERING WORKS, FROM WHAT THE CODE AND THE SIGNED PROTOCOL DO.
 * Operator ruling 7 of 2026-10-18, built under Q8 of 2026-10-19.
 * ===========================================================================
 *
 * His words: a section on every service page and the homepage "that walks a
 * buyer through the real process for that line... Every step and every
 * timeframe must come from what the code and the signed protocol actually do;
 * if a turnaround isn't enforced in the app, don't print a number. Lines that
 * aren't orderable yet describe the quote path instead."
 *
 * So every step below carries, in a comment, the code or the protocol clause
 * it rests on, so a reviewer can check each sentence against its source. No
 * step carries a number of hours, days or weeks: RC-001 section 7 states two
 * business days for scheduling and the price book states a ten day roof
 * figure, and nothing in the platform enforces either.
 * scripts/proofs/every-line-shows-the-steps-its-state-names.mjs refuses a
 * number beside a unit of time anywhere in this file's step text.
 *
 * WHICH VERSION A PAGE SHOWS IS NOT DECIDED HERE. lineOffer's state decides,
 * the same answer that picks the page's action, so the two cannot disagree.
 */

import { lineOffer, type LineState } from "@/lib/ordering";

export type OrderingStep = {
  /** The anchor on the service page, so the homepage row can link to one step. */
  id: string;
  name: string;
  text: string;
};

/**
 * THE ROOF CERTIFICATION, THE ONE LINE ORDERABLE ONLINE. RC-001.
 *
 * A line that opens later needs ITS OWN steps written from its own protocol
 * before its page shows any: RC-001's steps are not another protocol's. Until
 * then an orderable line with no entry here renders no walk-through, and the
 * audit names it.
 */
export const ORDERABLE_STEPS: Readonly<Record<string, readonly OrderingStep[]>> = {
  "roof-inspections": [
    {
      id: "order",
      name: "Order and pay online",
      /* catalog.ts qualifying questions; order-flow.ts; ops-payments.ts createCheckout, which shows the price, the fee and the refund terms before Stripe. */
      text: "Three questions come first: is the property in Texas, are you the owner or authorized by the owner, and can the roof be reached safely on the day. Then the address, your contact details and what the engineer needs. The price, the inspection fee and what happens if the engineer declines are all shown before you pay on Stripe's page.",
    },
    {
      id: "link",
      name: "A link to follow the order",
      /* releaseForFulfilment and sendOrderConfirmation; sendOrderReceived for an order whose account needs a person (ruling Q2). */
      text: "When the order is released for work, the firm emails a confirmation carrying a link to the order's own page. If the order has to wait for a person to attach it to an account, a receipt comes first and the link follows.",
    },
    {
      id: "engineer-first",
      name: "The engineer looks first, where your answers call for it",
      /* RC-001 intake questions 8 to 12; dispatch-hold.ts; ruling 1 of 2026-10-07; refundFor, full refund where nobody attended. */
      text: "A yes to an open insurance claim, litigation, an active leak, an earlier adverse report or recent storm damage holds the job for the engineer before anybody is sent. If the engineer declines it then, the full amount is refunded.",
    },
    {
      id: "technician",
      name: "A certified technician takes the job",
      /* ops-dispatch.ts offers to technicians certified on RC-001 who cover the county; acceptOffer then notifyTechnicianAccepted (ruling Q1); RC-001 section 7, "The coordinator schedules an accepted job." */
      text: "The job is offered to technicians certified on the roof protocol who cover your county. When one accepts, you are emailed, and the firm's coordinator schedules the visit.",
    },
    {
      id: "visit",
      name: "The site visit",
      /* rc-001-checklist.ts; RC-001 section 8 on photographs; ops-field.ts refuses an incomplete package. */
      text: "The technician works through the engineer's checklist for the roof covering, its edges, flashings and penetrations, and the attic. The photographs come only from the firm's field application, which records where and when each was taken, and the package cannot be submitted incomplete.",
    },
    {
      id: "decision",
      name: "The engineer decides",
      /* rc-001-decisions.ts, five determinations; RC-001 section 10; notifyRepairsRequired (ruling Q3); refundFor after a visit. */
      text: "A Texas licensed Professional Engineer reviews the evidence and records one of five determinations: pass, revise, repairs required, site revisit or decline. If repairs are required you are emailed, and no certification letter is issued with an open repair item. A decline after a visit refunds everything except the inspection fee shown before you paid.",
    },
    {
      id: "letter",
      name: "The sealed letter arrives",
      /* letter-seal.ts; sendOrderSealed; the order page lists the sealed letter; RC-001 section 11. */
      text: "On a pass the engineer seals the letter, and an email links to your order page, where it downloads as a PDF. The letter states observed condition only, with no estimate of remaining service life.",
    },
    {
      id: "after",
      name: "After it arrives",
      /* RC-001 on recipient, purpose and date; the letter template's own line that the recipient decides how to use it. */
      text: "Give it to whoever asked for it. It is written for the recipient, purpose and date named on the order, and a different recipient, purpose or date takes a new inspection.",
    },
  ],
};

/** A line that takes a quote on the contact form (api/lead; inquiryAcknowledged, addition d). */
export const QUOTE_STEPS: readonly OrderingStep[] = [
  {
    id: "ask",
    name: "Tell the firm what you need",
    text: "Use the contact form, which arrives with this service already chosen.",
  },
  {
    id: "reply",
    name: "A person replies",
    text: "The firm is emailed your message, you receive a confirmation that it arrived, and a person replies to the address you gave.",
  },
  {
    id: "price",
    name: "The price",
    /* Gap 8's ruling of 2026-10-10: the published price is the quote. */
    text: "Where this line has a published price, that is the price you are quoted.",
  },
];

/** The design and windstorm briefs (api/design-inquiry, api/windstorm-inquiry; ruling Q6). */
export const QUOTE_FORM_STEPS: Readonly<Record<string, readonly OrderingStep[]>> = {
  "residential-light-commercial-design": [
    {
      id: "brief",
      name: "Describe the project",
      /* forms.ts designInquirySchema. */
      text: "The design brief asks your role, the kind of work, the deliverable, the address and jurisdiction, size and storeys, whether drawings or a soil report exist, permit status, any deadline, and three questions about claims, litigation and earlier adverse reports.",
    },
    {
      id: "reply",
      name: "A person replies",
      text: "The firm is emailed the brief, you receive a confirmation that it arrived, and a person replies to the address you gave.",
    },
    {
      id: "price",
      name: "The price",
      /* prices.ts, the hourly line. */
      text: "Design is charged at the published hourly rate with a minimum engagement, and the fee is quoted from the engineer's estimate before work starts.",
    },
  ],
  "windstorm-wpi-8": [
    {
      id: "brief",
      name: "Describe the property",
      /* forms.ts windstormInquirySchema. */
      text: "The windstorm brief asks the address and county, the year built, the most recent work and when it was done, what is now covered up, whether openings are rated, whether you will open up finishes, any deadline, and the same three questions about claims, litigation and earlier reports.",
    },
    {
      id: "reply",
      name: "A person replies",
      text: "The firm is emailed the brief, you receive a confirmation that it arrived, and a person replies to the address you gave.",
    },
    {
      id: "price",
      name: "The price",
      text: "Both WPI-8 deliverables have published prices, and until the line can be ordered online that is the price you are quoted.",
    },
  ],
};

/** Before the firm opens: the waitlist, in the future tense the gate requires (ruling Q5). */
export const WAITLIST_STEPS: readonly OrderingStep[] = [
  {
    id: "join",
    name: "Join the waitlist",
    text: "The firm is not yet accepting engagements. Leave your details and the service you need.",
  },
  {
    id: "reply",
    name: "A person replies",
    text: "You receive a confirmation that your request arrived, and a person at the firm replies to the address you gave.",
  },
];

/**
 * WHICH STEPS A LINE SHOWS, FROM THE SAME STATE THAT PICKS ITS ACTION.
 *
 * An orderable line with no steps of its own gets none rather than another
 * protocol's, and the proof names it. A line with a brief form of its own and
 * no steps written for it falls back to the contact path's steps.
 */
export function orderingStepsFor(slug: string): { state: LineState; steps: readonly OrderingStep[] } {
  const state = lineOffer(slug).state;
  const steps =
    state === "orderable"
      ? (ORDERABLE_STEPS[slug] ?? [])
      : state === "quote-form"
        ? (QUOTE_FORM_STEPS[slug] ?? QUOTE_STEPS)
        : state === "waitlist"
          ? WAITLIST_STEPS
          : QUOTE_STEPS;
  return { state, steps };
}

/**
 * A NUMBER BESIDE A UNIT OF TIME. The owner's rule is that no turnaround the
 * app does not enforce is printed, so this matches a digit or a number word
 * followed by hours, days, weeks or months. Exported so the proof exercises
 * the same matcher it relies on.
 */
export const TIMEFRAME = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|several)\s+(business\s+)?(hour|day|week|month)s?\b/i;

/** Every step this file holds, for the proof. */
export function allOrderingSteps(): readonly OrderingStep[] {
  return [
    ...Object.values(ORDERABLE_STEPS).flat(),
    ...QUOTE_STEPS,
    ...Object.values(QUOTE_FORM_STEPS).flat(),
    ...WAITLIST_STEPS,
  ];
}
