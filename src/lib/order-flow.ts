import {
  fieldsFor,
  INTAKE_GROUPS,
  INTAKE_GROUP_LABEL,
  type IntakeField,
  type FieldStage,
} from "@data/intake-fields";
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
/**
 * The fields this deliverable asks a CUSTOMER, up to a stage.
 *
 * Exported because the flow renders it and blockersOn validates it, and those
 * two disagreeing is the exact failure this section exists to fix.
 *
 * The stage argument is what lets the same list be rendered generously and
 * validated narrowly: everything up to "seal" is shown, because a customer who
 * has their loan number now should be able to give it now, and only "order"
 * stops them proceeding.
 */
export function customerFieldsFor(entry: CatalogEntry, upTo: FieldStage): IntakeField[] {
  const order: FieldStage[] = ["order", "dispatch", "seal"];
  const limit = order.indexOf(upTo);
  return fieldsFor(entry.serviceSlug, entry.tier).filter(
    (f) => f.audience === "customer" && order.indexOf(f.stage) <= limit,
  );
}

// ------------------------------------------------- step 3, one group at a time

/**
 * STEP 3 IS SPLIT BY THE INTAKE DEFINITION'S OWN GROUPS.
 *
 * Operator ruling, 2026-09-30: split step 3 by the intake definition's own
 * groups, the rail stays at five steps, each sub page says "Part 2 of 4",
 * required fields are checked on their own sub page, and no screen is taller
 * than about three phone heights at 390.
 *
 * WHY IT NEEDED SPLITTING. The break it sweep measured this step at 10,748px at
 * 390, roughly thirteen phone heights. Sixteen questions on one screen is a form
 * people abandon, and length on an app screen is not the same thing as length on
 * a marketing page: one is reading, the other is work somebody has to finish.
 *
 * THE RAIL IS UNTOUCHED. `stepsFor` is not changed by any of this, so the five
 * steps a customer sees across the top are the five they saw before. The parts
 * are inside the third of them, which is what the ruling asks for: payment stays
 * in the rail as the signpost and the rail does not grow to eight.
 *
 * THE COUNT IS DERIVED, NEVER FOUR. There are four groups, and the ruling's
 * example says "Part 2 of 4", but a service with no access questions must not
 * offer an empty fourth part. So empty groups are dropped and the denominator is
 * what is left, which for most lines is fewer than four.
 */
export type IntakePart = {
  group: IntakeField["group"];
  label: string;
  fields: IntakeField[];
};

export function intakePartsFor(entry: CatalogEntry): IntakePart[] {
  /*
   * The SHOWN set, up to seal, exactly as the step rendered before the split.
   * Everything up to sealing is shown and only the order stage is enforced,
   * which is a rule this file already carries and the split does not touch.
   */
  const shown = customerFieldsFor(entry, "seal");
  return INTAKE_GROUPS.map((group) => ({
    group,
    label: INTAKE_GROUP_LABEL[group],
    fields: shown.filter((f) => f.group === group),
  })).filter((part) => part.fields.length > 0);
}

/**
 * What is still missing on ONE part.
 *
 * THE RULE IS THE STEP'S RULE, NARROWED TO A PART, AND THAT IS THE WHOLE POINT.
 * It applies the same test `blockersOn("requirements")` applies, over this
 * part's fields instead of all of them, so nothing about what is required or
 * what it is called changes. The operator's ruling was explicit that every
 * field, its wording and its validation stay as they are; what moves is WHEN
 * the check fires, which is now on the sub page carrying the field rather than
 * at the end of a screen thirteen phone heights long.
 *
 * AND THE UNION OF THE PARTS IS EXACTLY THE STEP. Every order stage customer
 * field is in the shown set, because order is a subset of seal, and every shown
 * field belongs to exactly one group. So passing all parts is the same test as
 * passing the step, and no field can hide between two sub pages. That property
 * is asserted by a proof rather than left as a paragraph, because it is the one
 * thing a split like this can silently get wrong.
 */
export function blockersOnPart(
  entry: CatalogEntry | null,
  state: FlowState,
  part: IntakePart | null,
): string[] {
  if (!entry || !part) return [];
  const enforced = new Set(customerFieldsFor(entry, "order").map((f) => f.id));
  const missing: string[] = [];
  for (const field of part.fields) {
    if (!field.required) continue;
    if (!enforced.has(field.id)) continue;
    if (field.kind === "file") {
      if (!(state.files[field.id]?.length > 0)) missing.push(field.label);
    } else if (!state.inputs[field.id]?.trim()) {
      missing.push(field.label);
    }
  }
  return missing;
}

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
    /*
     * THE SHARED DEFINITION, NOT entry.requiredInputs.
     *
     * Phase 10 Section 1.5 Section C. This used to read the catalog's own
     * inputs, which meant the customer flow and the operator intake asked
     * overlapping but different sets, and the firm had two definitions of a
     * complete job. fieldsFor returns the universal fields AND the catalog's,
     * so both paths ask the same questions and neither carries a list of its
     * own to drift.
     *
     * Only the customer answerable ones, and only the ones needed to ORDER. A
     * customer cannot be asked what the firm gathers, and refusing an order for
     * something needed before dispatch is what the stages exist to prevent.
     */
    for (const field of customerFieldsFor(entry, "order")) {
      if (!field.required) continue;
      if (field.kind === "file") {
        if (!(state.files[field.id]?.length > 0)) missing.push(field.label);
      } else if (!state.inputs[field.id]?.trim()) {
        missing.push(field.label);
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
