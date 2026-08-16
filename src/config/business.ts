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
  legalName: "254 Engineering Services LLC",
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

/**
 * SAM.gov registration identifiers.
 *
 * OWNER VERIFICATION: both values are withheld from rendered output until Robert
 * confirms the registration is active and the identifiers are correct. A UEI on
 * a public page is checked by procurement officers against SAM, and a wrong one
 * reads as a firm that does not know its own registration.
 *
 * Set them here and they render on /government automatically.
 */
export const samRegistration = {
  /**
   * Whether the site may state that the firm is registered in SAM.gov.
   *
   * OWNER VERIFICATION: this is asserted on Robert's instruction and has not been
   * checked against SAM by this build. A procurement officer can confirm or
   * refute it in about fifteen seconds, so it is either true or it is worse than
   * saying nothing. Set to false and the claim disappears from every page.
   */
  registered: true,
  uei: null as string | null,
  cage: null as string | null,
} as const;
