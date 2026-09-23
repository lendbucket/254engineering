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
  /**
   * HOW IT WAS READ, AND IT IS NOT AN API CALL. Operator ruling, 2026-09-21.
   *
   * A record that says a value came from Stripe, without saying by what route,
   * reads as a machine read. This one is a person looking at a page and taking
   * a picture of it. That is weaker evidence than the API in one specific way
   * worth naming: a screenshot shows what was rendered to one browser at one
   * moment, and cannot be re-derived later without going back to the console.
   *
   * It is also the only route available here BY DESIGN. `.env.local` sets no
   * STRIPE_* variable, because production credentials live only in Vercel, so
   * nothing in this working tree can ask Stripe anything. The operator refused
   * to put a secret key into a session to close that gap, which is the correct
   * call: the record gets weaker evidence rather than the tree getting a live
   * key.
   */
  readVia: "api" | "screenshot" | "operator-report";
  /**
   * THE ARTIFACTS BEHIND THE READ, each digested so none can be swapped.
   *
   * A LIST RATHER THAN ONE, and that is a correction rather than a preference.
   * The first version of this field held a single artifact, so a read that took
   * two captures had to record one and describe the other in a comment. A
   * digest in a comment is a digest nothing hashes: the check below walks this
   * array, and anything outside it is prose.
   *
   * `shows` is what that capture actually displays, so a reader can tell which
   * artifact backs which field without opening a PNG. Empty array means no
   * artifact, which is a real and honest state: it is what this field held
   * while the only capture of the business name had been deleted for carrying
   * personal details.
   */
  evidence: { file: string; sha256: string; bytes: number; shows: string }[];
  /** Any verification requirement or restriction the console showed. */
  verificationNotice: string;
  /** What must change in the console, and what triggers it. */
  whatMustChange: string;
} = {
  accountId: "acct_1UFmIjA2kbTZN5C3",

  /*
   * ===================================================================
   * EVIDENCED 2026-09-22, AND THE RED IS CLOSED BY AN ARTIFACT RATHER
   * THAN BY A STATEMENT.
   * ===================================================================
   *
   * WHAT IT WAS, kept because the reasoning is what made the close legitimate.
   * The operator changed this field in the dashboard on 2026-09-21 and said it
   * now read "254 Engineering LLC". A screenshot was taken, read, and then
   * DELETED at his instruction, because it carried his date of birth and his
   * home address and this repository is not where those live. The field
   * therefore STAYED at the 2026-09-16 value and `stripe-webhook-audit` stayed
   * RED, because a console record earns its keep by being a DATED READ of
   * something and "somebody told me" is the thing that rule exists to refuse.
   *
   * WHAT CLOSED IT. Two cropped captures taken 2026-09-22, both on disk and
   * both digested below and in this file's sibling fields. The crop is the
   * whole point: the Public details card carries the business fields and
   * nothing about the account representative, so the artifact can live in the
   * repository where the first one could not.
   *
   * WHAT THE CAPTURE ACTUALLY SHOWS, transcribed rather than summarised:
   *
   *     Public details
   *     Customer-facing information
   *     Legal business name      254 Engineering LLC
   *     Public business name     254 Engineering
   *
   * And the second capture, which is why the account is not in doubt either:
   *
   *     Settings / Business / Account details
   *     Account name             254 Engineering LLC
   *     Account ID               acct_1UFmIjA2kbTZN5C3
   *
   * That account id is the one this file already declared, so the capture
   * confirms the record rather than being compared against nothing.
   *
   * WHAT THESE CAPTURES DO NOT COVER, said plainly because `readOn` below now
   * says 2026-09-22 and a reader could take that to mean the whole record was
   * re-read. It was not. `statementDescriptor`, `supportAddress` and
   * `supportPhone` are NOT in either capture and still rest on the 2026-09-16
   * read. Only `legalBusinessName`, `publicBusinessName` and `accountId` have
   * an artifact dated 2026-09-22 behind them.
   */
  legalBusinessName: "254 Engineering LLC",
  publicBusinessName: "254 Engineering",
  statementDescriptor: "254 ENGINEERING",
  supportAddress: "5601 South Padre Island Drive, Suite E, Corpus Christi, TX 78412",
  supportPhone: "+12819404490",

  readBy:
    "The operator, from the Stripe dashboard: Settings, Business, Account details and the Public " +
    "details card. Captured cropped to the business fields so no representative detail is carried.",
  readOn: "2026-09-22",
  readVia: "screenshot",
  /*
   * BOTH CAPTURES, BOTH HASHED AGAINST DISK BY `stripe-webhook-audit`.
   *
   * BOTH FILES WERE RENAMED BEFORE BEING RECORDED. As downloaded they carried
   * EN DASHES in their names, and a path written into a source file puts those
   * characters into source, where placeholder-audit refuses them. Renaming a
   * file before its path is quoted is cheaper than discovering it on a board.
   */
  evidence: [
    {
      file: "docs/compliance/Business-254-Engineering-LLC-Stripe-09-22-2026_10_53_AM.png",
      sha256: "2f7a953cdd41ac2fdc04971699da04cab4a8ec1f23ea0532ae4541aefdbdb3b2",
      bytes: 54089,
      shows:
        "The Public details card: Legal business name 254 Engineering LLC, Public business name " +
        "254 Engineering. This is the artifact behind the value stripe-webhook-audit compares.",
    },
    {
      file: "docs/compliance/Account-details-254-Engineering-LLC-Stripe-09-22-2026_10_52_AM.png",
      sha256: "ea21120a781da6b119d0edb720d33958ed2f1c94cc825b443702df73e51068fd",
      bytes: 157205,
      shows:
        "Settings, Business, Account details: Account name 254 Engineering LLC and Account ID " +
        "acct_1UFmIjA2kbTZN5C3, which is the account id this file already declared. Its tab strip " +
        "shows that Account status and Verified exist; neither was opened.",
    },
  ],
  /*
   * WHAT THE PAGE SHOWED, INCLUDING THE ABSENCE. The Business details page
   * carried no verification banner, no restriction notice and no "action
   * required" block. A "Setup guide" control sits in the header with a
   * progress ring, which is Stripe's onboarding prompt rather than a
   * restriction on this account, and a Verified tab exists but was not the tab
   * captured. So this records that NOTHING WAS SHOWN ON THIS PAGE rather than
   * that the account is unrestricted, which is a different claim and one a
   * single screenshot cannot support.
   */
  verificationNotice:
    "STILL NOT RECORDED, and the 2026-09-22 captures do not change it. The Account details capture " +
    "shows that the tabs Account status and Verified EXIST, because they are visible in its tab " +
    "strip, and neither was opened or captured. Seeing that a tab exists says nothing whatever " +
    "about what it contains. A screenshot taken 2026-09-21 showed no verification banner on the " +
    "Business details page and was deleted for carrying personal details, so nothing supports that " +
    "observation any more either. This field says NOT RECORDED rather than none, because the " +
    "absence of a notice on one page is not the absence of a requirement on the account, and a " +
    "requirement or restriction on either uncaptured tab would not appear in this record at all. " +
    "It is needed before any charge.",

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
    "OWED, 2026-09-21. THE TRIGGER FIRED: TBPELS reissued F-29811 in the name 254 Engineering LLC on " +
    "2026-09-21, which is the event this instruction always named, so the legal business name in the " +
    "Stripe console had to move in the same sitting as issuedTo. " +
    "THE OPERATOR'S WORDS: 'Stripe legal business name has been changed to 254 Engineering LLC in the " +
    "dashboard.' The change was made today. THE EVIDENCE IS OWED and this record does not carry the " +
    "new value until somebody reads it back. " +
    "WHY THERE IS NO EVIDENCE. A screenshot of the Business details page was saved, read, and deleted " +
    "the same sitting on the operator's instruction, in his words: 'It holds my date of birth and home " +
    "address.' That is the correct call and it is worth stating as a rule rather than an incident: a " +
    "Stripe settings page shows the account representative's personal details beside the business " +
    "ones, so a screenshot of it is a personal data file, and this repository is not where those live. " +
    "The next capture is cropped to the business fields or it is not taken. " +
    "AND NO API READ IS POSSIBLE FROM HERE, BY DESIGN. .env.local sets no STRIPE_* variable, because " +
    "production credentials live only in Vercel, and the operator refused to put a secret key into a " +
    "session to close the gap. That is the right trade: the record carries weaker evidence rather " +
    "than the tree carrying a live key. " +
    "SO THE EQUALITY CHECK IS RED UNTIL ONE OF TWO THINGS HAPPENS. Either a cropped screenshot of the " +
    "legal business name is saved and digested here, or the operator runs " +
    "'STRIPE_SECRET_KEY=sk_... npx tsx scripts/stripe-webhook-audit.mjs' himself so the key never " +
    "enters a session transcript. " +
    "STILL NEVER CAPTURED, AND NEEDED BEFORE ANY CHARGE: the Account status and Verified tabs. A " +
    "requirement or restriction sitting on either would not appear in this record at all. " +
    "The two customer facing fields, the public business name and the statement descriptor, stay as " +
    "the brand by operator ruling and did not move with the rename.",
};
