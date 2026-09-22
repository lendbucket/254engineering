/**
 * The single source of truth for who this firm is.
 *
 * Everything a page, a schema block, an email, or an audit needs to state about
 * the entity lives here and nowhere else. The rule that makes that worth doing:
 * scripts/placeholder-audit.mjs crawls rendered output and fails on any email
 * that is not on the domain below and on any phone number at all, so a value
 * invented in a component cannot reach production quietly.
 *
 * Nothing in this file is aspirational. If a fact is not yet true, it is either
 * absent or gated behind the launch mode in src/lib/launch.ts.
 */

export const business = {
  /** The public brand. Used in titles, og:site_name, and WebSite schema. */
  name: "254 Engineering Services",
  /** The registered entity. Used in the footer, contracts language, schema. */
  /**
   * THE ENTITY, AND IT WAS WRONG UNTIL 2026-09-13.
   *
   * This read "254 Engineering Services LLC" from the day it was written, and
   * no such entity exists. TBPELS issued F-29811 to **254 Services LLC**, which
   * is the firm, and the discrepancy sat recorded and unanswered in
   * src/config/credentials.ts because only the operator holds the formation
   * documents.
   *
   * Operator ruling, 2026-09-13: the entity is 254 Services LLC, this constant
   * was wrong, and the firm trades under its registered name. No assumed name
   * filing is needed, because the board already holds the name the firm
   * operates under.
   *
   * IT IS RENDERED AS THE LEGAL ENTITY to procurement officers on /government,
   * in the privacy policy, in the terms, in the site footer copyright, in
   * llms.txt and in the document metadata. Every one of those was naming an
   * entity that does not exist.
   *
   * THE BRAND IS A DIFFERENT FIELD AND A DIFFERENT THING. See `name` above:
   * 254 Engineering Services survives as the wordmark and the logo, and never
   * as the legal or firm name in a sentence. Operator ruling, same day.
   */
  /*
   * 2026-09-21: THE STATE AND THE BOARD NOW AGREE, SO THIS STOPS BEING STALE
   * ON PURPOSE. Operator ruling.
   *
   * This was deliberately left at the old registrant name while the Secretary
   * of State held 254 Engineering LLC and TBPELS still held 254 Services LLC:
   * stale against the state, true against the board, because the gate's
   * condition is the BOARD's record. TBPELS reissued F-29811 on 2026-09-21, so
   * both records say 254 Engineering LLC and the reason for the divergence is
   * gone.
   *
   * THESE ARE TWO FACTS THAT COINCIDE, NOT ONE FACT WITH TWO HOMES, which is
   * why this is not derived from the register. The Secretary of State's entity
   * name and the Board's registrant name are separate records kept by separate
   * agencies, and they have already differed once, for five days. Deriving one
   * from the other would make a future divergence unrepresentable rather than
   * visible. `compliance-audit` asserts they AGREE instead, so a divergence is
   * a red board naming both values rather than a state nobody can express.
   */
  legalName: "254 Engineering LLC",
  /** Short form for tight spaces. Never used as the schema name. */
  shortName: "254 Engineering",

  url: "https://254engineering.com",
  domain: "254engineering.com",

  /**
   * The one public address. Every other address in rendered output is a finding.
   *
   * OWNER VERIFICATION: this mailbox has to exist before launch. It is the point
   * of contact printed on the government capability statement, so a bounce there
   * is a lost solicitation rather than a lost enquiry.
   */
  email: "info@254engineering.com",

  /**
   * Where form notifications go. Server side only, never rendered.
   */
  notificationEmail: "ceo@36west.org",

  /**
   * No phone number is published yet, deliberately.
   *
   * OWNER VERIFICATION: a published number is a commitment to answer it, and the
   * number itself has not been chosen. Inventing one is the exact failure the
   * placeholder audit exists to catch, and a 555 number on a capability
   * statement is worse than no number at all. Contact runs through the form and
   * the address above until Robert picks one.
   */
  phone: null as string | null,

  /**
   * Founding and operating geography. Texas is the whole service area by design,
   * which is the fact the brand is named after.
   */
  state: "Texas",
  stateCode: "TX",
  foundingLocation: "Texas",
  countyCount: 254,

  /** Veteran ownership, stated at entity level only. */
  veteranOwned: true,

  /**
   * NAICS codes for the engineering services this firm performs. Used on the
   * government page and nowhere else.
   */
  naics: [
    { code: "541330", label: "Engineering Services" },
    { code: "541350", label: "Building Inspection Services" },
    { code: "541990", label: "All Other Professional, Scientific, and Technical Services" },
  ],

  /**
   * The brand family this organization is the master record for. Rendered into
   * Organization schema as `brands`, which is how the sister sites inherit
   * entity trust from this one.
   */
  brands: [
    { name: "Sealed Engineering", url: "https://sealedengineering.com" },
    { name: "StampMyPlans", url: "https://stampmyplans.com" },
  ],
} as const;

/*
 * ============================================================================
 * RETIRED 2026-09-17: `samRegistration`.
 * ============================================================================
 *
 * It declared `registered: true` and was read by six render sites. The firm has
 * never been registered in SAM and registration has not been started, so the
 * site carried a false federal credential, including on `/government`, the one
 * page written for readers who can check it in fifteen seconds.
 *
 * IT IS RETIRED RATHER THAN SET TO FALSE, and that is the whole lesson. Its
 * false branch was not silence: it rendered "SAM.gov registration is in
 * progress", which asserts a registration has been started. A boolean whose
 * both branches are claims cannot express "we say nothing about this", so the
 * shape was wrong rather than the value.
 *
 * ITS REPLACEMENT is `verifiedCredentials` in src/config/credentials.ts, where
 * a credential is held or absent, and a held one carries an identifier, a date
 * somebody checked it, and a reference a reader could check it against.
 * `compliance-audit` refuses any source under src that names this symbol again.
 */
