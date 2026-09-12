/**
 * WHAT THE FIRM STILL OWES BEFORE IT MAY TRADE, AS DATA.
 *
 * Operator ruling, 2026-09-11. The compliance gate stopped being one variable on
 * 2026-09-10, when TBPELS issued F-29811 and the gate did not open. This file is
 * the rest of that ruling: the conditions that are not about a single
 * registration, each stated in configuration so the flip is impossible until
 * somebody edits a file on purpose.
 *
 * WHY CONFIGURATION AND NOT A DATABASE READ
 * -----------------------------------------
 * Almost every page on this site is statically prerendered, so the gate runs
 * during `next build`. A condition read from a table would be answered at build
 * time by whatever that table happened to say, with no record of what it said,
 * and could differ between a build and the deployment serving it. A file
 * disagreeing with reality is caught by a human reading it; a table disagreeing
 * with reality is caught by nobody.
 *
 * That is the same argument `supabase/applied.mjs` makes about merged versus
 * applied, and `scripts/lib/surfaces.mjs` makes about which surfaces exist. A
 * declaration somebody has to edit is the mechanism.
 *
 * EVERY VALUE HERE IS AN ASSERTION SOMEBODY MADE
 * ----------------------------------------------
 * Setting one of these to true says a person checked the thing against the
 * outside world: a filing acknowledged, a charge refunded, a protocol approved,
 * a recovery window switched on. `scripts/compliance-audit.mjs` asserts the
 * shape and asserts that the gate reads it, and it deliberately cannot verify
 * the outside world. That is what the prose beside each value is for.
 */

/**
 * A LIVE STRIPE ACCOUNT BELONGING TO 254, AND PROOF THAT MONEY MOVES BOTH WAYS.
 *
 * WHY THE ACCOUNT'S OWNER IS PART OF THE CONDITION
 * ------------------------------------------------
 * The platform's Stripe integration has been exercised against an account that
 * is not this firm's. Taking a customer's money into an account belonging to a
 * different entity is not a configuration detail: it is the wrong company being
 * paid for engineering work, on a receipt the customer keeps, and it is the sort
 * of thing that is discovered during a dispute rather than before one.
 *
 * WHY A CHARGE AND A REFUND, AND WHY BOTH RECORDED
 * ------------------------------------------------
 * A charge proves the account can take money. Only a refund proves the firm can
 * give it back, and this platform's whole refund grammar, the disclosed
 * inspection fee, the full refund where nobody attended, is worth nothing if the
 * refund path has never once been run. The identifiers are recorded so the claim
 * is checkable in the Stripe dashboard by somebody who does not trust this file.
 */
export const stripeAccount: {
  /** Connected, live, and owned by this firm. */
  connected: boolean;
  /** The account holder exactly as Stripe shows it. Not the brand. */
  accountName: string | null;
  /** One real charge and its refund. Null until both have happened. */
  proof: {
    chargeId: string;
    refundId: string;
    /** ISO date both were done and checked. */
    on: string;
    /** What was charged, in cents, so the record is specific. */
    amountCents: number;
  } | null;
  /** What is true today, in words, for whoever reads the launch screen. */
  because: string;
} = {
  connected: false,
  accountName: null,
  proof: null,
  because:
    "No Stripe account belonging to 254 is connected. The integration has been exercised against Reyna Pay, " +
    "which is a different entity, so a live charge today would pay the wrong company for engineering work. " +
    "This becomes true when the firm's own live account is connected and one real charge and its refund have " +
    "both been made and recorded above.",
};

/**
 * ONE PROTOCOL, APPROVED BY THE ENGINEER OF RECORD, PER SERVICE LINE OFFERED.
 *
 * Operator ruling: a line with no approved protocol is not offered, it is a
 * waitlist, and the catalogue reads this registry to decide which is which so
 * nobody can list a line that cannot be dispatched.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a copy of `eng_protocol_templates`. That table is where an engineer
 * AUTHORS protocols and versions them, and it is the operational record. This is
 * the DECLARATION that a named engineer of record has approved a specific
 * version for a specific service line, and it is what the gate and the catalogue
 * read. Two reasons they are separate:
 *
 * First, the gate runs at build time and must not depend on a table.
 *
 * Second, and this is the regulatory half: publishing a protocol row is an act
 * inside the platform, and approving a service line for sale is an act by a
 * licensed Professional Engineer who is answerable for it. Those deserve to be
 * two different records, and collapsing them would mean anybody holding
 * `protocols.author` could put a service line on sale.
 *
 * EMPTY TODAY, AND THAT IS THE HONEST ANSWER
 * ------------------------------------------
 * No PE is in responsible charge, so no protocol has been approved by an
 * engineer of record, so every service line is a waitlist. That is not a gap in
 * this file. It is the firm's actual position, and it is the reason
 * `peInResponsibleCharge()` exists as a second gate.
 */
export type ApprovedProtocol = {
  /** Matches a slug in src/content/services.ts. Asserted by compliance-audit. */
  serviceSlug: string;
  /** The protocol as named in eng_protocol_templates. */
  protocolName: string;
  /** The version approved. A later version is a new approval, not an edit. */
  version: number;
  /** The Professional Engineer who approved it, as their licence reads. */
  approvedBy: string;
  /** Their Texas PE licence number. Must also be in verifiedEngineers. */
  approvedByLicense: string;
  /** ISO date of the approval. */
  approvedOn: string;
};

export const approvedProtocols: ApprovedProtocol[] = [];

/**
 * POINT IN TIME RECOVERY ON THE PRODUCTION PROJECT.
 *
 * Operator ruling: stated true by the operator, with the date, because nothing
 * in this repository can see a provider dashboard setting and a check that
 * cannot see a thing must not pretend to.
 *
 * ITS LIMIT IS PART OF THE RECORD, NOT A FOOTNOTE. `fsaryeciduszuahgjbly` is
 * shared with four unrelated applications, so a rewind restores all five or
 * none, and the decision to use it is never this firm's alone. The full
 * reasoning is in docs/disaster-recovery.md section 2a. It is not repeated here,
 * because two accounts of one limit are two accounts that will disagree.
 *
 * ENABLED IS NOT REHEARSED. An untested restore is a belief. The cutover plan's
 * step 15 is where a restore is proven and read back, and that plan is deferred,
 * so this condition asks only what it can honestly ask: is there a moment to go
 * back to.
 */
export const pointInTimeRecovery: {
  enabled: boolean;
  /** Who stated it, so the assertion has an author. */
  statedBy: string;
  /** ISO date it was stated. */
  on: string | null;
  because: string;
} = {
  enabled: true,
  statedBy: "The operator, from the Supabase dashboard for fsaryeciduszuahgjbly.",
  on: "2026-09-10",
  because:
    "Enabled on the shared production project the day TBPELS issued F-29811. It restores all five " +
    "applications on that project or none, which is why it is recorded as a stopgap rather than a restore " +
    "path this firm controls. See docs/disaster-recovery.md section 2a.",
};

/**
 * A PLACEHOLDER PHONE NUMBER, FOR THE ONE CONDITION THAT CAN BE FAKED BY TYPING.
 *
 * FIRM_PHONE is an environment variable rather than a value in this file,
 * because it is also read by schema, by tel: links and by the capability
 * statement, and those have always come from the environment. What this list
 * adds is that the gate refuses the numbers somebody reaches for when they need
 * the field to be non empty.
 *
 * 555 is the famous one and is not the only one. A number that is all the same
 * digit, or the sequence, is the same mistake wearing different digits.
 */
export const placeholderPhonePatterns: { pattern: RegExp; why: string }[] = [
  { pattern: /^\+?1?\d{3}555\d{4}$/, why: "A 555 exchange is the reserved fictional range." },
  { pattern: /^\+?1?(\d)\1{9}$/, why: "Every digit the same is a field somebody filled to make it non empty." },
  { pattern: /^\+?1?123456789\d$/, why: "The keypad in order is not a telephone number." },
  { pattern: /^\+?1?\d{3}000\d{4}$/, why: "A zero exchange does not route." },
];
