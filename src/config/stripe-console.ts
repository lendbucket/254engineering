/**
 * WHAT THE STRIPE CONSOLE HOLDS, DECLARED. READ BY A PERSON, NEVER BY A CHECK.
 *
 * Operator ruling, 2026-09-16, and it is the THIRD instance of one pattern.
 *
 * THE PATTERN. The sharpest findings of the last three days were all in a
 * console no audit in this repository can read, and all three were found by the
 * operator opening it:
 *
 *   Vercel, 2026-09-12: CUSTOMER_SESSION_SECRET set for All Environments, so a
 *   cookie minted on any preview was valid on production.
 *
 *   Vercel, same day: PARTNER_SESSION_SECRET and MFA_ENCRYPTION_KEY sharing one
 *   value across Production and Preview, while OPS_SESSION_SECRET was already
 *   split, which is what made it legible as a defect rather than a choice.
 *
 *   Stripe, 2026-09-16: this file. The account's public business name and
 *   statement descriptor are customer facing, render on the hosted checkout page
 *   and on a card statement, and nothing here could see either.
 *
 * THE ANSWER IS THE SAME EACH TIME, and it is why this file exists rather than a
 * note: a declaration of what the console holds, DATED and ATTRIBUTED, so the
 * next person has something to compare against rather than nothing. A check
 * cannot read Stripe. A person can, and what they read becomes a fact this
 * repository can hold, disagree with, and go stale against visibly.
 *
 * `src/config/credential-inventory.ts` is the same idiom for Vercel and says
 * outright that it cannot read it. This says the same about Stripe.
 *
 * NO SECRET EVER APPEARS HERE. Account identifiers and public business details
 * only. The keys live in Vercel and are declared, by name, in the credential
 * inventory.
 */
export const stripeConsole: {
  /** The account these values were read from. Asserted against the live account. */
  accountId: string;
  /**
   * THE FIELD THAT MATTERS, and the only one with a rule attached.
   *
   * Stripe's legal business name is the entity Stripe believes it is paying,
   * and it is matched against the EIN. It must equal the registrant on the
   * board's record, and `stripe-webhook-audit` asserts that equality rather
   * than trusting it.
   */
  legalBusinessName: string;
  /**
   * CUSTOMER FACING, AND RULED TO STAY AS THE BRAND. Operator ruling,
   * 2026-09-16. Renders on the hosted checkout page. It has the same standing
   * as the wordmark and the page titles: a checkout page is not a page holding
   * the firm out as performing engineering.
   */
  publicBusinessName: string;
  /**
   * CUSTOMER FACING, AND RULED TO STAY AS THE BRAND. Same ruling, same day. It
   * is what a customer recognises on a card statement, which is the whole job
   * of the field, and a descriptor nobody recognises causes the chargeback it
   * exists to prevent.
   */
  statementDescriptor: string;
  supportAddress: string;
  /** E.164. Asserted to equal the number this platform derives from FIRM_PHONE. */
  supportPhone: string;
  /** Who read these, from where, and when. Never left empty. */
  readBy: string;
  /** ISO date the console was read. */
  readOn: string;
  /** What must change in the console, and what triggers it. */
  whatMustChange: string;
} = {
  accountId: "acct_1UFmIjA2kbTZN5C3",

  legalBusinessName: "254 Services LLC",
  publicBusinessName: "254 Engineering",
  statementDescriptor: "254 ENGINEERING",
  supportAddress: "5601 South Padre Island Drive, Suite E, Corpus Christi, TX 78412",
  supportPhone: "+12819404490",

  readBy: "The operator, from the Stripe dashboard's public details page.",
  readOn: "2026-09-16",

  /*
   * AND THIS SENTENCE IS ENFORCED RATHER THAN REMEMBERED, which is the point of
   * putting it beside the value instead of in a document.
   *
   * `stripe-webhook-audit` asserts legalBusinessName equals the registrant on
   * the board's record. So the moment `issuedTo` becomes 254 Engineering LLC at
   * reissuance, the board goes RED naming this field as stale, and stays red
   * until somebody changes it in Stripe and updates this file. "In the same
   * sitting" stops depending on anybody remembering it.
   */
  whatMustChange:
    "The legal business name becomes 254 Engineering LLC when TBPELS reissues F-29811 in that name, " +
    "in the same sitting as issuedTo in src/config/credentials.ts. The two customer facing fields, the " +
    "public business name and the statement descriptor, stay as the brand by operator ruling and do not " +
    "change with the rename. The Secretary of State amendment alone changes nothing here, because the " +
    "compliance gate follows the board's record rather than the state's.",
};
