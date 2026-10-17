/**
 * TAKING A JOB OVER THE TELEPHONE, AS A SET OF RULES.
 *
 * Pure. No database, no environment, no network, so every rule below is
 * exercisable exactly rather than approximately, and the audit asserts the RULE
 * rather than the implementation. Same reasoning as attribution-rules.ts, and
 * for the same reason: an intake that quietly does the wrong thing produces a
 * file that looks right and is not.
 *
 * WHAT THIS EXISTS TO FIX
 * -----------------------
 * docs/phase-10-gate-0.md, measured by walking the portal: an administrator
 * could open an UNPRICED file and nothing more. There was no path from a
 * telephone call to a priced, paid, dispatched technician, and the firm's
 * primary intake is a telephone call.
 */

import type { CatalogEntry } from "@data/catalog";
import type { Cents } from "./ops-money";

/** How a job reached the firm. Matches the check constraint in 0015. */
export const INTAKE_CHANNELS = ["web", "phone", "email", "walk_in", "partner", "other"] as const;
export type IntakeChannel = (typeof INTAKE_CHANNELS)[number];

/** What the firm has decided about getting paid. Matches 0015. */
export const PAYMENT_INTENTS = ["unset", "link_sent", "invoiced", "released_unpaid", "paid"] as const;
export type PaymentIntent = (typeof PAYMENT_INTENTS)[number];

/**
 * WHERE A JOB LANDS WHEN THE OPERATOR FINISHES ENTERING IT.
 *
 * The same answer the customer path reaches, deliberately, because Section 1.5
 * requires a telephoned job and a web job to produce identical files. Both call
 * landingStatusFor; this function exists to say what happens for a QUOTE, which
 * the customer path never has to answer at this point because a quote is not an
 * order yet.
 *
 * A quote stays at intake. There is nothing to dispatch and nothing to review
 * until somebody has scoped it and the customer has accepted a number, and
 * moving it further would put work in a queue that cannot be done.
 */
export function landsAt(orderType: CatalogEntry["orderType"]): "needs_dispatch" | "evidence_submitted" | "intake" {
  if (orderType === "field") return "needs_dispatch";
  if (orderType === "desk") return "evidence_submitted";
  return "intake";
}

/**
 * WHAT THE FIRM MAY DO ABOUT MONEY, GIVEN THE COMPLIANCE GATE.
 *
 * The gate is not a nicety here. `orderBlockedReason` refuses every order while
 * registration is pending, in those words: "No order can be placed and no
 * payment can be taken until it is active." That applies to a job the operator
 * typed in exactly as it applies to one a customer placed, because it is about
 * what the FIRM may sell and not about which door the work came through.
 *
 * So during prelaunch the only honest option is to open the job unpaid and say
 * so. That is not a degraded mode; it is the correct behaviour, and the intake
 * says why rather than hiding the buttons or failing silently.
 */
export type PaymentOption = {
  intent: PaymentIntent;
  label: string;
  available: boolean;
  /** Present when unavailable. Always a reason a person can act on. */
  because?: string;
};

export function paymentOptions(input: {
  prelaunch: boolean;
  /** The client has an account with invoicing terms and available credit. */
  accountCanInvoice: boolean;
  /** The catalog published a price for this deliverable. */
  priced: boolean;
}): PaymentOption[] {
  const gate =
    /* A literal, because a client component imports this module and launch.ts
     * does not belong in a browser bundle. It states launch mode, never
     * registration, in the same words notYetAcceptingEngagements() uses. */
    "The firm is not yet accepting engagements. No payment can be taken until it opens for work.";

  return [
    {
      intent: "link_sent",
      label: "Send a payment link",
      available: !input.prelaunch && input.priced,
      because: input.prelaunch
        ? gate
        : input.priced
          ? undefined
          : "There is no published price for this deliverable, so there is nothing to charge.",
    },
    {
      intent: "invoiced",
      label: "Invoice the account",
      available: !input.prelaunch && input.accountCanInvoice,
      because: input.prelaunch
        ? gate
        : input.accountCanInvoice
          ? undefined
          : "This client has no account with invoicing terms and available credit.",
    },
    {
      /*
       * ALWAYS AVAILABLE, INCLUDING UNDER THE GATE.
       *
       * Releasing work before payment is a commercial decision the firm should
       * make deliberately rather than discover, so it is a button somebody
       * presses rather than a state a job falls into. During prelaunch it is
       * the ONLY option, which is exactly why it must not be hidden: an intake
       * with every option greyed out is an intake that cannot be completed.
       */
      intent: "released_unpaid",
      label: "Open it unpaid",
      available: true,
    },
  ];
}

/**
 * Is the price the operator entered the catalog's, or an override?
 *
 * Returns null when they agree, which is the ordinary case and must not write
 * an override record. An override with no reason is refused: "a price that
 * changed with no record of who changed it or why is a dispute the firm loses",
 * and the cheapest moment to insist on the reason is while the operator is
 * still looking at the screen.
 */
export type PriceDecision =
  | { overridden: false; cents: Cents }
  | { overridden: true; cents: number; reason: string }
  | { ok: false; error: string };

export function decidePrice(input: {
  catalogCents: Cents;
  /** What the operator typed, or null if they did not touch it. */
  enteredCents: number | null;
  reason: string | null;
}): PriceDecision {
  if (input.enteredCents === null || input.enteredCents === input.catalogCents) {
    return { overridden: false, cents: input.catalogCents };
  }

  if (input.enteredCents < 0) {
    return { ok: false, error: "A price cannot be negative." };
  }

  const reason = (input.reason ?? "").trim();
  if (reason.length < MIN_OVERRIDE_REASON) {
    return {
      ok: false,
      error:
        `A price that differs from the catalog needs a reason of at least ${MIN_OVERRIDE_REASON} characters. ` +
        "The original stays on the file either way, and the reason is what makes the difference defensible.",
    };
  }

  return { overridden: true, cents: input.enteredCents, reason };
}

/**
 * Long enough to be a sentence rather than a keystroke. "ok" and "-" are not
 * reasons, and a field that accepts them is a field that will be full of them.
 */
export const MIN_OVERRIDE_REASON = 10;

/**
 * A FILE FIELD IS ANSWERED BY A FILE, AND BY NOTHING ELSE. 0078, 2026-10-16.
 *
 * Text posted against a file field is dropped first, so a sentence can never
 * satisfy a document the signed protocol requires. Each upload must answer a
 * file field this deliverable asks, sit in the intake bucket, and have a key
 * under this intake's own draft and that field. Only then does the field count
 * as answered, with the fixed sentence the outstanding list reads.
 */
export function applyIntakeUploads(input: {
  fileFieldIds: string[];
  uploads: { fieldId: string; bucket: string; storageKey: string }[];
  draftId: string | null;
  answers: Record<string, string>;
  bucket: string;
  attachedText: string;
}): { ok: true; answers: Record<string, string> } | { ok: false; error: string; field: string } {
  const fileFields = new Set(input.fileFieldIds);
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.answers)) if (!fileFields.has(k)) answers[k] = v;
  const draft = (input.draftId ?? "").trim();
  for (const u of input.uploads) {
    if (!fileFields.has(u.fieldId)) {
      return { ok: false, error: "That document does not answer anything this job asks.", field: u.fieldId };
    }
    if (u.bucket !== input.bucket || !draft || !u.storageKey.startsWith(`intake/${draft}/${u.fieldId}/`)) {
      return { ok: false, error: "That document was not uploaded for this job. Attach it again.", field: u.fieldId };
    }
    answers[u.fieldId] = input.attachedText;
  }
  return { ok: true, answers };
}

/**
 * ===========================================================================
 * A JOB AT NO CHARGE. Operator ruling, 2026-10-16.
 * ===========================================================================
 *
 * "Open it unpaid" stays what it is: bill later, under files.create, and the
 * only intake route while the gate is shut. What this governs is a client
 * price of ZERO, which until now any files.create holder could enter with a ten
 * character reason, Sales included.
 *
 * A zero price needs the administrator role, a fresh code from the
 * administrator's own authenticator (verifyFreshCode, checked in ops-job-intake
 * because it reads the database), a typed reason, and an audit row written
 * BEFORE the file exists, so a no-charge job without its record cannot be
 * made. It is opened unpaid: there is nothing to send a link for.
 *
 * The rule below is everything that can be decided without the database, in
 * one place, so the screen and the server cannot disagree about it.
 */
export function isNoCharge(clientCents: number | null): boolean {
  return clientCents === 0;
}

export function noChargeRefusal(input: {
  actorId: string | null;
  actorRole: string;
  reason: string | null;
  paymentIntent: PaymentIntent;
  code: string | null;
}): string | null {
  if (!input.actorId || input.actorRole !== "admin") {
    return "Only an administrator can open a job at no charge.";
  }
  if ((input.reason ?? "").trim().length < MIN_OVERRIDE_REASON) {
    return `A job at no charge needs a reason of at least ${MIN_OVERRIDE_REASON} characters.`;
  }
  if (input.paymentIntent !== "released_unpaid") {
    return "A job at no charge is opened unpaid. There is nothing to send a link or an invoice for.";
  }
  if (!(input.code ?? "").replace(/\s+/g, "")) {
    return "A job at no charge needs a fresh code from your authenticator app.";
  }
  return null;
}

/**
 * WHAT THE INTAKE STILL NEEDS BEFORE IT CAN BE SUBMITTED.
 *
 * Returned as a list of sentences naming the field, never as a boolean, for the
 * same reason blockersOn does it in the customer flow: a form that will not say
 * which box is wrong is a form people abandon. Here the person is on the
 * telephone with a customer, which makes it worse.
 */
export function blockers(input: {
  clientId: string | null;
  serviceSlug: string | null;
  tier: string | null;
  propertyAddress: string;
  city: string;
  county: string;
  channel: IntakeChannel | null;
}): string[] {
  const missing: string[] = [];
  if (!input.clientId) missing.push("Choose or create the client.");
  if (!input.serviceSlug) missing.push("Choose the service line.");
  if (!input.tier) missing.push("Choose which deliverable they need.");
  if (!input.propertyAddress.trim()) missing.push("Enter the property address.");
  /*
   * One of city or county, not both. resolveCounty derives the county from a
   * city it knows, and dispatch matches on county, so a file without one is
   * invisible to every technician. Asking for both when either will do is how a
   * form gets abandoned on the telephone.
   */
  if (!input.city.trim() && !input.county.trim()) {
    missing.push("Enter the city, or choose the county directly.");
  }
  if (!input.channel) missing.push("Record how this job arrived.");
  return missing;
}
