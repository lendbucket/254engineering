import type { CatalogEntry } from "@data/catalog";
import type { QualifierAnswer } from "./ops-orders";

/**
 * The customer's path through an order, as a pure state machine.
 *
 * WHY THE STEPS ARE COMPUTED AND NOT HARD CODED
 * ---------------------------------------------
 * The program describes six steps. A customer never sees six.
 *
 * Somebody arriving from a service page has already chosen the service, so the
 * choice step is skipped unless that line sells more than one deliverable. A
 * deliverable with no qualifying questions skips qualification. A quote request
 * has no price step and no payment. Rendering all six and greying four out
 * would be a flow that looks longer than it is, and the abandonment on a form
 * is roughly the length of the form.
 *
 * So the steps are derived from the catalog entry and the flow renders what is
 * actually left to do.
 *
 * WHY THIS IS PURE
 * ----------------
 * The step a customer is on decides what they are asked for, and being asked
 * for the wrong thing, or being let past a question the firm needs answered, is
 * the failure mode. order-audit can put every catalog entry through every step
 * here without a browser, which is not true of anything that touches React.
 */

export type StepId = "deliverable" | "qualify" | "property" | "requirements" | "review" | "pay";

export type Step = {
  id: StepId;
  /** What the customer sees at the top of the step. */
  title: string;
  /** One line saying why this step exists. Never a slogan. */
  blurb: string;
};

const STEP: Record<StepId, Step> = {
  deliverable: {
    id: "deliverable",
    title: "What you need",
    blurb: "This service line covers more than one deliverable. They are priced separately.",
  },
  qualify: {
    id: "qualify",
    title: "A few questions first",
    blurb:
      "These decide whether this is work the firm can take. A no here saves you paying for something that would come back declined.",
  },
  property: {
    id: "property",
    title: "The property",
    blurb: "The county decides who can be dispatched and what the work involves, so the address matters.",
  },
  requirements: {
    id: "requirements",
    title: "What the engineer needs",
    blurb: "The documents and details the review is carried out against.",
  },
  review: {
    id: "review",
    title: "Price and terms",
    blurb: "What it costs, what happens if the engineer declines, and what you receive.",
  },
  pay: { id: "pay", title: "Payment", blurb: "Card details are entered on Stripe's page, never on this site." },
};

/**
 * The steps this customer actually walks.
 *
 * `entry` is null before a deliverable is chosen, which is the only state in
 * which the first step can be shown.
 */
export function stepsFor(entry: CatalogEntry | null, deliverableCount: number): Step[] {
  const steps: Step[] = [];

  if (deliverableCount > 1) steps.push(STEP.deliverable);
  if (!entry) return steps;

  if (entry.qualifiers.length > 0) steps.push(STEP.qualify);
  steps.push(STEP.property);
  if (entry.requiredInputs.length > 0) steps.push(STEP.requirements);
  steps.push(STEP.review);

  /*
   * A quote request has no price and takes no payment, so it has no payment
   * step. Its review step is the last thing before it is sent, and the copy
   * there says nothing is owed.
   */
  if (entry.orderType !== "quote") steps.push(STEP.pay);

  return steps;
}

// --------------------------------------------------------------- what is done

export type FlowState = {
  tier: string | null;
  answers: QualifierAnswer[];
  property: { propertyAddress: string; city: string; county: string; postalCode: string };
  customer: { name: string; email: string; phone: string; company: string };
  inputs: Record<string, string>;
  files: Record<string, { name: string; storageKey: string; bucket: string }[]>;
  acceptedTerms: boolean;
  /*
   * A partner code, typed by hand, when somebody was told one out loud.
   *
   * Optional, and it is not in blockersOn: an order must never be held up by a
   * referral field. Somebody who cannot remember the code buys anyway, and the
   * partner's tracked link is the path that does not depend on memory.
   */
  partnerCode: string;
};

export function emptyState(tier: string | null = null): FlowState {
  return {
    tier,
    answers: [],
    property: { propertyAddress: "", city: "", county: "", postalCode: "" },
    customer: { name: "", email: "", phone: "", company: "" },
    inputs: {},
    files: {},
    acceptedTerms: false,
    partnerCode: "",
  };
}

/**
 * What is missing on a step, in the customer's words.
 *
 * Returns an empty list when the step is complete. Every message names the
 * field rather than saying "please complete all fields", because a form that
 * will not say which box is wrong is a form people abandon.
 */
export function blockersOn(step: StepId, entry: CatalogEntry | null, state: FlowState): string[] {
  const missing: string[] = [];

  if (step === "deliverable") {
    if (!state.tier) missing.push("Choose which deliverable you need.");
    return missing;
  }

  if (!entry) return ["Choose which deliverable you need."];

  if (step === "qualify") {
    for (const q of entry.qualifiers) {
      const answer = state.answers.find((a) => a.qualifierId === q.id);
      if (answer === undefined) missing.push(q.prompt);
    }
    return missing;
  }

  if (step === "property") {
    if (!state.property.propertyAddress.trim()) missing.push("The property address.");
    if (!state.property.city.trim() && !state.property.county.trim()) {
      missing.push("The city or the county, so the firm can work out which county it is.");
    }
    if (!state.customer.name.trim()) missing.push("Your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.customer.email.trim())) {
      missing.push("An email address the firm can reach you at.");
    }
    return missing;
  }

  if (step === "requirements") {
    for (const input of entry.requiredInputs) {
      if (!input.required) continue;
      if (input.kind === "file") {
        if (!(state.files[input.id]?.length > 0)) missing.push(input.label);
      } else if (!state.inputs[input.id]?.trim()) {
        missing.push(input.label);
      }
    }
    return missing;
  }

  if (step === "review") {
    /*
     * The refund rule has to be read before it can be agreed to, and this is
     * the only step where it is on screen. A checkout that could be reached
     * without passing here would be a customer charged under terms they were
     * never shown, which is the thing the disclosure ruling exists to prevent.
     */
    if (!state.acceptedTerms) missing.push("Confirm you have read what happens if the engineer declines.");
    return missing;
  }

  return missing;
}

/** Can the customer move on from this step? */
export const canAdvance = (step: StepId, entry: CatalogEntry | null, state: FlowState): boolean =>
  blockersOn(step, entry, state).length === 0;

/**
 * The first step that is not complete, which is where a returning customer
 * belongs and where a submit attempt should send somebody back to.
 */
export function firstIncomplete(steps: Step[], entry: CatalogEntry | null, state: FlowState): StepId | null {
  for (const step of steps) {
    if (step.id === "pay") continue;
    if (!canAdvance(step.id, entry, state)) return step.id;
  }
  return null;
}
