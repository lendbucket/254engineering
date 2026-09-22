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
 * Taking a customer's money into an account belonging to a different entity is
 * not a configuration detail: it is the wrong company being paid for
 * engineering work, on a receipt the customer keeps, and it is the sort of
 * thing that is discovered during a dispute rather than before one.
 *
 * THIS PARAGRAPH USED TO SAY THE INTEGRATION HAD BEEN EXERCISED AGAINST AN
 * ACCOUNT THAT IS NOT THIS FIRM'S. Corrected 2026-09-22: it has not. The
 * reasoning for having the owner in the condition survives the correction
 * unchanged, which is why the paragraph stays. What changed is that it is now
 * a statement of WHY the rule exists rather than a claim about today.
 *
 * AND THE CONDITION EARNED ITSELF ANYWAY, from the other direction. Preview
 * carried live Reyna Pay keys until 2026-09-21. A charge on a preview URL,
 * which anybody with the link can reach, would have done exactly what the
 * paragraph above describes. The rule was right; the sentence naming where the
 * risk sat was wrong.
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
  /*
   * =========================================================================
   * CORRECTED 2026-09-22. THE "REYNA PAY" SENTENCE WAS WRONG, AND IT WAS THE
   * SOURCE FIVE OTHER RECORDS COPIED.
   * =========================================================================
   *
   * IT READ, from 2026-09-11 until today: "No Stripe account belonging to 254
   * is connected. The integration has been exercised against Reyna Pay, which
   * is a different entity, so a live charge today would pay the wrong company
   * for engineering work."
   *
   * WHAT THE EVIDENCE ACTUALLY SAYS. `stripeConsole.accountId` has recorded
   * `acct_1UFmIjA2kbTZN5C3` since 2026-09-16, read off the dashboard. The
   * operator read Production's publishable key on 2026-09-22 and it begins
   * `pk_live_51UFmIjA2kbTZN5C3`. A Stripe publishable key embeds its own
   * account id: strip `pk_live_5` and what remains is `1UFmIjA2kbTZN5C3`,
   * which is the tail of that account. **They are the same account**, and it
   * is the account the operator states he renamed to the registrant.
   *
   * HOW ONE WRONG SENTENCE BECAME SIX. Nothing re-derived it for eleven days.
   * `credential-inventory.ts` repeated it, `docs/launch-readiness.md` and
   * `docs/soc2-readiness.md` are written from those two, `BACKLOG.md` pointed
   * at it, and on 2026-09-21 a session wrote three more lines repeating it
   * while recording a genuine and separate finding about Preview. The later,
   * evidenced record, the account id read on the 16th, was never compared
   * against the earlier, unevidenced one. That is the rule in CLAUDE.md
   * section 6b: a recorded explanation is a hypothesis until something
   * re-checks it, and a wrong one is worse than none because it stops the next
   * reader looking.
   *
   * WHAT REMAINS UNMET, AND IT IS NOT THE ACCOUNT'S IDENTITY. Two things. The
   * account's LEGAL BUSINESS NAME is unverified: the operator changed it in
   * the dashboard on 2026-09-21 and the screenshot proving it was deleted
   * because it carried his personal details, so `stripeConsole` still holds
   * the last evidenced value and `stripe-webhook-audit` is correctly red. And
   * no charge and refund have been made. This condition needs BOTH.
   *
   * THE PREVIEW FINDING IS SEPARATE AND STANDS. Preview carried live Reyna Pay
   * keys until the operator removed them on 2026-09-21. That was real, it is
   * recorded in `credential-inventory.ts`, and it is not evidence about which
   * account Production uses.
   */
  because:
    "The live account IS this firm's: acct_1UFmIjA2kbTZN5C3, recorded in src/config/stripe-console.ts " +
    "since 2026-09-16 and confirmed 2026-09-22 by the operator reading Production's publishable key, " +
    "which begins pk_live_51UFmIjA2kbTZN5C3 and embeds that same account id. He states he has renamed " +
    "it in the dashboard to the registrant the board holds; that NAME is recorded and deliberately " +
    "still UNVERIFIED in src/config/stripe-console.ts, so it is not asserted here. " +
    "TWO THINGS STILL HOLD THIS SHUT. The legal business name on that account is UNVERIFIED: the " +
    "screenshot proving the rename was deleted because it carried personal details, so the console " +
    "record still holds the value read on 2026-09-16 and stripe-webhook-audit is red until a cropped " +
    "capture or a key-run audit. And no real charge and refund have been made and recorded above. " +
    "This becomes true when both are done, and the live test runs on PRODUCTION as the first act " +
    "after the gate opens, never on a preview. " +
    "CORRECTED 2026-09-22: this field previously said the integration had been exercised against " +
    "Reyna Pay, a different entity. That was written 2026-09-11, nothing re-checked it for eleven " +
    "days, and five other records copied it. Preview DID carry live Reyna Pay keys until 2026-09-21, " +
    "which is a separate and real finding recorded in credential-inventory.ts.",
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
