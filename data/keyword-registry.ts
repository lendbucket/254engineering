/**
 * THE CROSS BRAND KEYWORD REGISTRY
 *
 * SYNCHRONIZED FILE. This is the single source of truth for which of the three
 * brands owns which search term, and it is copied verbatim into
 * sealedengineering and stampmyplans. If you edit it here, you have created a
 * divergence until it is copied. See BACKLOG.md in every repo.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Three sites, one operator, one keyword space. To a search engine that is
 * indistinguishable from a doorway network unless each brand has a genuinely
 * distinct identity and corpus. Where two of them target the same primary term,
 * Google picks one canonical winner and suppresses the other, so the second
 * page is not merely wasted, it is a drag on the first.
 *
 * The rule is absolute and has no exceptions: two brands never target the same
 * primary keyword. Before writing any page or post on any brand, look the term
 * up here. If it is absent, add it here first with an owner. If it belongs to
 * another brand, this brand does not target it.
 *
 * THE TERRITORY RULING. FINAL. DO NOT REOPEN.
 * -------------------------------------------
 * The assignment below was contested three times during the session that built
 * this file, each time proposing that StampMyPlans take the homeowner and
 * consumer territory and Sealed Engineering take contractor plan review. The
 * operator ruled, and the ruling is:
 *
 *   Sealed Engineering owns homeowner education AND all transactional
 *   commercial service terms.
 *
 *   StampMyPlans owns contractor direct response and contractor process content
 *   ONLY.
 *
 *   254 Engineering Services owns the institutional flag: firm level terms,
 *   county geo, government and municipal content, and careers.
 *
 * Any earlier or later message implying the reverse is superseded by this
 * ruling. It is recorded here rather than in a chat log because the live sites
 * already match it and re-deciding it would mean telling two shipped brands to
 * trade their entire corpora: sealedengineering.com runs the homeowner explainer
 * corpus, 25 city pages, and the lender, realtor, and solar installer pages,
 * while stampmyplans.com runs upload, pricing, volume, and the plan stamping FAQ.
 *
 * If you are reading this because you were about to swap them, the answer is no.
 * Take it to the operator with this paragraph quoted.
 *
 * HOW TO READ AN ENTRY
 * --------------------
 * `owner` is the brand entitled to rank for the term. `status` says what exists
 * today, which is a different question from ownership: a term can be owned and
 * unbuilt (`planned`), owned and live (`live`), or deliberately handed to
 * another brand after having been targeted here (`conceded`).
 *
 * `conceded` entries are the valuable ones. They record a decision and its
 * reason, so that a future session cannot re-target the term by accident and
 * call it an improvement.
 */

export type Brand = "254" | "sealed" | "stamp";

export type KeywordStatus =
  | "live" // A page exists on the owning brand and targets this term.
  | "planned" // Owned, not yet built.
  | "conceded"; // Owned by another brand; this note records why it moved.

export type KeywordKind =
  | "branded"
  | "institutional" // Firm level: who the firm is, how it contracts.
  | "capability" // What the firm can do, framed for evaluation not ordering.
  | "transactional" // Somebody ready to order a specific document.
  | "geo-county"
  | "geo-city"
  | "education"
  | "careers";

export type RegistryEntry = {
  /** The primary term, lowercased, as a searcher would type it. */
  keyword: string;
  owner: Brand;
  kind: KeywordKind;
  /** Grouping for content planning. */
  cluster: string;
  status: KeywordStatus;
  /** Path on the owning brand, where one exists. */
  path?: string;
  /** Required on `conceded`, and on any entry whose ownership is not obvious. */
  note?: string;
};

export const BRANDS: Record<
  Brand,
  { name: string; domain: string; audience: string; owns: string; doesNotOwn: string }
> = {
  "254": {
    name: "254 Engineering Services",
    domain: "254engineering.com",
    audience:
      "Municipal and government procurement officers, commercial clients, lenders, insurers, B2B partners, and engineering and field technician recruits.",
    owns: "Institutional and firm level terms, all county level geo, government and municipal content, and careers.",
    doesNotOwn:
      "Transactional commercial service terms, city geo, homeowner education, and contractor direct response.",
  },
  sealed: {
    name: "Sealed Engineering",
    domain: "sealedengineering.com",
    audience: "Homeowners, solar installers, lenders, realtors, and title companies ordering a specific document.",
    owns: "Transactional service terms, city level geo, homeowner and ordering-party education.",
    doesNotOwn: "Firm level institutional terms, county geo, government procurement content, careers.",
  },
  stamp: {
    name: "StampMyPlans",
    domain: "stampmyplans.com",
    audience: "Contractors, builders, installers, and dealers submitting plan sets.",
    owns: "Plan stamping and plan review process, speed, pricing, and volume terms.",
    doesNotOwn: "Firm level terms, geo of any kind, homeowner education, careers.",
  },
};

/**
 * The registry.
 *
 * Seeded from the live sitemaps and rendered titles of all three brands as they
 * stood when this file was created, so the starting state is what is actually
 * indexed rather than what was intended.
 */
export const registry: RegistryEntry[] = [
  // ---------------------------------------------------------------- branded
  { keyword: "254 engineering", owner: "254", kind: "branded", cluster: "brand", status: "live", path: "/" },
  { keyword: "254 engineering services", owner: "254", kind: "branded", cluster: "brand", status: "live", path: "/" },
  { keyword: "sealed engineering", owner: "sealed", kind: "branded", cluster: "brand", status: "live", path: "/" },
  { keyword: "stampmyplans", owner: "stamp", kind: "branded", cluster: "brand", status: "live", path: "/" },

  // ---------------------------------------------------------- institutional
  // The head terms this brand exists to own. Nothing else may target them.
  { keyword: "texas engineering firm", owner: "254", kind: "institutional", cluster: "firm identity", status: "live", path: "/" },
  { keyword: "texas engineering services", owner: "254", kind: "institutional", cluster: "firm identity", status: "live", path: "/" },
  { keyword: "statewide engineering services texas", owner: "254", kind: "institutional", cluster: "firm identity", status: "live", path: "/" },
  { keyword: "veteran owned engineering firm texas", owner: "254", kind: "institutional", cluster: "firm identity", status: "live", path: "/about" },
  { keyword: "engineering firm serving all texas counties", owner: "254", kind: "institutional", cluster: "firm identity", status: "live", path: "/coverage" },
  { keyword: "texas engineering firm registration", owner: "254", kind: "institutional", cluster: "licensing", status: "planned", note: "Editorial. What a TBPELS firm registration is and why it matters to a buyer." },
  { keyword: "engineer in responsible charge texas", owner: "254", kind: "institutional", cluster: "licensing", status: "live", path: "/about" },

  // ------------------------------------------------------- government terms
  { keyword: "government engineering services texas", owner: "254", kind: "institutional", cluster: "government", status: "live", path: "/government" },
  { keyword: "municipal engineering services texas", owner: "254", kind: "institutional", cluster: "government", status: "live", path: "/government" },
  { keyword: "on call engineering services texas", owner: "254", kind: "institutional", cluster: "government", status: "live", path: "/government" },
  { keyword: "qualifications based selection texas engineering", owner: "254", kind: "institutional", cluster: "government", status: "live", path: "/government" },
  { keyword: "sdvosb engineering firm texas", owner: "254", kind: "institutional", cluster: "government", status: "planned", note: "Blocked. Certification is pending and the term may not be targeted until it is issued." },
  { keyword: "how texas cities procure engineering services", owner: "254", kind: "education", cluster: "government", status: "planned" },

  // --------------------------------------------------------------- careers
  // Careers belongs to 254 for the whole family. See the collision note below.
  { keyword: "engineering careers texas", owner: "254", kind: "careers", cluster: "careers", status: "live", path: "/careers" },
  { keyword: "professional engineer jobs texas", owner: "254", kind: "careers", cluster: "careers", status: "live", path: "/careers" },
  { keyword: "review engineer jobs texas", owner: "254", kind: "careers", cluster: "careers", status: "live", path: "/careers" },
  {
    keyword: "field inspection technician jobs texas",
    owner: "254",
    kind: "careers",
    cluster: "careers",
    status: "live",
    path: "/careers",
    note:
      "COLLISION, RESOLVED 2026-08-17 on the sealed side. sealedengineering.com/careers was titled 'Field Technician Jobs in Texas' and targeted this term. It is now a routing stub titled 'Hiring Runs Through 254 Engineering Services', carrying no application form and no job term in its title, linking to 254engineering.com/careers. stampmyplans.com/careers already routed correctly. 254 owns this term outright.",
  },

  // ------------------------------------------------------- county geo (254)
  // Pattern entry rather than 254 rows. The county tier is generated from
  // data/counties.ts and a county page ships only when its record has verified
  // substance. City geo is explicitly NOT owned here.
  {
    keyword: "engineering services {county} county texas",
    owner: "254",
    kind: "geo-county",
    cluster: "county geo",
    status: "planned",
    path: "/counties/{slug}",
    note: "Pattern, not a literal term. One page per county, generated from data/counties.ts, shipped only where the record clears the substance threshold.",
  },
  {
    keyword: "{county} county permit requirements texas",
    owner: "254",
    kind: "geo-county",
    cluster: "county geo",
    status: "planned",
    path: "/counties/{slug}",
    note: "Pattern. The permitting authority question is the single most searched county level engineering query.",
  },
  {
    keyword: "wpi-8 requirements {county} county",
    owner: "254",
    kind: "geo-county",
    cluster: "county geo",
    status: "planned",
    path: "/counties/{slug}",
    note: "Pattern, TWIA designated counties only. Inland county pages must not carry windstorm sections.",
  },

  // -------------------------------------------------- capability variants (254)
  // The ruling: the seven colliding service pages are rewritten as firm
  // capability pages. They keep their depth and lose the transactional framing.
  // These are the terms they may target. The transactional twins below are
  // conceded to Sealed.
  { keyword: "roof certification engineering firm texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/roof-inspections" },
  { keyword: "windstorm engineering firm texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/windstorm-wpi-8" },
  { keyword: "foundation engineering firm texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/foundation-inspections" },
  { keyword: "solar structural engineering firm texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/solar-structural-letters" },
  { keyword: "manufactured housing engineering firm texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/manufactured-home-foundation-certifications" },
  { keyword: "structural engineering firm permits texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/structural-letters" },
  { keyword: "repair specification engineering firm texas", owner: "254", kind: "capability", cluster: "capability", status: "planned", path: "/services/repair-specifications" },
  // These two never collided. Sealed does not offer them.
  { keyword: "residential structural design texas", owner: "254", kind: "capability", cluster: "capability", status: "live", path: "/services/residential-light-commercial-design" },
  { keyword: "light commercial structural design texas", owner: "254", kind: "capability", cluster: "capability", status: "live", path: "/services/residential-light-commercial-design" },
  { keyword: "forensic engineering texas", owner: "254", kind: "capability", cluster: "capability", status: "live", path: "/services/forensic-engineering" },
  { keyword: "insurance engineering texas", owner: "254", kind: "capability", cluster: "capability", status: "live", path: "/services/forensic-engineering" },

  // --------------------------------------- transactional service terms (sealed)
  // The seven conceded terms. 254 targeted every one of these before the split
  // was enforced; the `conceded` status is what stops a future session putting
  // them back.
  {
    keyword: "roof certification letter texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/roof-certification-letters",
    note: "254 previously targeted this as 'Roof Inspections and Certifications in Texas'. Rewritten as a capability page.",
  },
  // PRIMARY TARGET as of 2026-08-18, by operator ruling on measured data.
  // The unqualified national form carries the volume; the Texas-qualified form
  // below measured zero. Texans type the unqualified form and Google localises,
  // so this is accurate targeting rather than a reach. The page is Texas
  // specific throughout and does not change.
  {
    keyword: "wpi-8 windstorm certification",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "live",
    path: "/services/wpi-8-windstorm-certification",
    note: "Primary target. Evidence: sealedengineering/docs/keyword-batch-phase-1.md. Related lookup-intent terms ('wpi-8 windstorm certificate search', 30/mo at KD 2, and 'texas windstorm wpi-8 certificate search', 80/mo at KD 9) are navigational toward the TDI lookup and are served by a dedicated page rather than by this one. County level windstorm geo remains 254's.",
  },
  {
    keyword: "wpi-8 windstorm certification texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/wpi-8-windstorm-certification",
    note: "SECONDARY variant of the entry above as of 2026-08-18; measured zero volume. Retained rather than deleted because it records the concession: 254 previously targeted this as 'Windstorm WPI-8 Certifications in Texas' and rewrote it as a capability page. County level windstorm geo stays with 254.",
  },
  {
    keyword: "foundation inspection report texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/foundation-inspection-reports",
    note: "254 previously targeted this as 'Foundation Inspections and Certifications, Texas'.",
  },
  {
    keyword: "solar structural letter texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/solar-structural-letters",
    note: "Same slug on both brands. 254 previously targeted 'Solar Structural Letters for Texas Installations'.",
  },
  // PRIMARY TARGET as of 2026-08-18, by operator ruling on measured data.
  // Same reasoning as the WPI-8 pair above: 50/mo unqualified against zero for
  // the Texas-qualified form.
  {
    keyword: "manufactured home foundation certification",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "live",
    path: "/services/manufactured-home-foundation-certification",
    note: "Primary target. Evidence: sealedengineering/docs/keyword-batch-phase-1.md, 50/mo at KD 8. The 'hud manufactured home foundation certification' variant (20/mo) is served by the same page, which cites HUD-7584 and HUD-4930.3G directly.",
  },
  {
    keyword: "manufactured home foundation certification texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/manufactured-home-foundation-certification",
    note: "SECONDARY variant of the entry above as of 2026-08-18; measured zero volume. Retained because it records that 254 previously targeted this near-identically.",
  },
  {
    keyword: "engineer letter for permit texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/structural-letters-for-permits",
    note: "254 previously targeted 'Structural Letters for Permits in Texas'.",
  },
  {
    keyword: "repair specification letter texas",
    owner: "sealed",
    kind: "transactional",
    cluster: "service",
    status: "conceded",
    path: "/services/repair-specification-letters",
    note: "254 previously targeted 'Engineered Repair Specifications in Texas'.",
  },
  // Sealed-only services, never contested.
  { keyword: "sealed engineering letters texas", owner: "sealed", kind: "transactional", cluster: "service", status: "live", path: "/" },
  { keyword: "beam and header sizing letter texas", owner: "sealed", kind: "transactional", cluster: "service", status: "live", path: "/services/beam-and-header-sizing-letters" },
  { keyword: "carport and patio cover plans texas", owner: "sealed", kind: "transactional", cluster: "service", status: "live", path: "/services/carport-and-patio-cover-plans" },
  { keyword: "foundation repair plans texas", owner: "sealed", kind: "transactional", cluster: "service", status: "live", path: "/services/foundation-repair-plans" },

  // ---------------------------------------------------------- city geo (sealed)
  {
    keyword: "sealed engineering letters {city} tx",
    owner: "sealed",
    kind: "geo-city",
    cluster: "city geo",
    status: "live",
    path: "/texas/{city}",
    note: "Pattern. 25 city pages live: Houston, San Antonio, Dallas, Fort Worth, Austin, El Paso, Corpus Christi, Laredo, Lubbock, McAllen, Brownsville, Amarillo, Killeen, Waco, Tyler, College Station, Beaumont, Midland, Odessa, Round Rock, Victoria, Harlingen, San Angelo, Abilene, Alice. 254 must not build city pages.",
  },

  // ------------------------------------------------------ education (sealed)
  { keyword: "what is a sealed engineering letter", owner: "sealed", kind: "education", cluster: "homeowner education", status: "live", path: "/insights/what-is-a-sealed-engineering-letter" },
  { keyword: "solar structural letter requirements texas", owner: "sealed", kind: "education", cluster: "homeowner education", status: "live", path: "/insights/solar-structural-letter-requirements-texas" },
  { keyword: "fha va manufactured home foundation certification", owner: "sealed", kind: "education", cluster: "homeowner education", status: "live", path: "/insights/fha-va-manufactured-home-foundation-certifications" },
  { keyword: "what a roof certification letter covers", owner: "sealed", kind: "education", cluster: "homeowner education", status: "live", path: "/insights/what-a-roof-certification-letter-covers" },
  {
    keyword: "wpi-8 windstorm certificates explained",
    owner: "sealed",
    kind: "education",
    cluster: "homeowner education",
    status: "live",
    path: "/insights/wpi-8-windstorm-certificates-explained",
    note: "CAUTION for 254 content planning. The consumer explainer belongs to Sealed. 254 may write the windstorm PROGRAM AUTHORITY angle (how the TDI appointment works, what the program requires of a firm) because that is institutional, but must not write a second 'what is a WPI-8' explainer.",
  },
  { keyword: "when a permit office requires an engineer letter", owner: "sealed", kind: "education", cluster: "homeowner education", status: "live", path: "/insights/when-a-permit-office-requires-an-engineer-letter" },
  // Lookup intent, registered 2026-08-18 before the page was written, per the
  // registry law. These are the highest volume terms found in the whole
  // Sealed keyword space, and their intent is NAVIGATIONAL: somebody trying to
  // find whether a certificate already exists, not somebody hiring. Served by a
  // page that answers the lookup honestly and picks up the commercial intent
  // only at the point the lookup comes back empty. A sales page against this
  // query would deserve to lose to TDI.
  {
    keyword: "texas windstorm wpi-8 certificate search",
    owner: "sealed",
    kind: "education",
    cluster: "windstorm",
    status: "live",
    path: "/insights/how-to-look-up-a-texas-windstorm-certificate",
    note: "80/mo at KD 9. Evidence: sealedengineering/docs/keyword-batch-phase-1.md. 254 may still write the windstorm PROGRAM AUTHORITY angle; it must not write a second lookup guide.",
  },
  {
    keyword: "wpi-8 windstorm certificate search",
    owner: "sealed",
    kind: "education",
    cluster: "windstorm",
    status: "live",
    path: "/insights/how-to-look-up-a-texas-windstorm-certificate",
    note: "30/mo at KD 2. Same page as the entry above.",
  },
  { keyword: "structural letters for solar installers", owner: "sealed", kind: "transactional", cluster: "industries", status: "live", path: "/industries/solar-installers" },
  { keyword: "foundation certifications for lenders", owner: "sealed", kind: "transactional", cluster: "industries", status: "live", path: "/industries/lenders-and-loan-officers" },
  { keyword: "transaction letters for realtors texas", owner: "sealed", kind: "transactional", cluster: "industries", status: "live", path: "/industries/realtors-and-title-companies" },

  // ------------------------------------------------------------- stampmyplans
  { keyword: "plan stamping texas", owner: "stamp", kind: "transactional", cluster: "plan stamping", status: "live", path: "/" },
  { keyword: "get plans stamped by a texas engineer", owner: "stamp", kind: "transactional", cluster: "plan stamping", status: "live", path: "/" },
  { keyword: "texas pe stamp plans", owner: "stamp", kind: "transactional", cluster: "plan stamping", status: "live", path: "/" },
  { keyword: "plan stamping pricing texas", owner: "stamp", kind: "transactional", cluster: "plan stamping", status: "live", path: "/pricing" },
  { keyword: "volume plan stamping texas", owner: "stamp", kind: "transactional", cluster: "plan stamping", status: "live", path: "/volume" },
  { keyword: "plan review turnaround texas", owner: "stamp", kind: "transactional", cluster: "plan stamping", status: "live", path: "/faq" },
  { keyword: "what plan reviewers reject", owner: "stamp", kind: "education", cluster: "contractor education", status: "planned" },
  { keyword: "deferred submittals texas", owner: "stamp", kind: "education", cluster: "contractor education", status: "planned" },
];

// ---------------------------------------------------------------- helpers

const normalize = (keyword: string) => keyword.trim().toLowerCase();

/** The brand entitled to a term, or null when the term is not yet registered. */
export function ownerOf(keyword: string): Brand | null {
  return registry.find((e) => normalize(e.keyword) === normalize(keyword))?.owner ?? null;
}

/**
 * The cannibalization check to run before writing anything.
 *
 * Returns the reason a brand may not target a term, or null when it may. An
 * unregistered term returns a reason too: "not in the registry" is a blocker,
 * not a pass, because the whole point is that ownership is decided before the
 * page is written rather than inferred from the page afterward.
 */
export function blockedReason(keyword: string, brand: Brand): string | null {
  const entry = registry.find((e) => normalize(e.keyword) === normalize(keyword));
  if (!entry) {
    return `"${keyword}" is not in the registry. Add it with an owner before writing.`;
  }
  if (entry.owner !== brand) {
    return `"${keyword}" is owned by ${BRANDS[entry.owner].name} (${BRANDS[entry.owner].domain})${entry.path ? ` at ${entry.path}` : ""}.${entry.note ? ` ${entry.note}` : ""}`;
  }
  return null;
}

/** Every term a brand owns, for planning a content phase. */
export function keywordsFor(brand: Brand): RegistryEntry[] {
  return registry.filter((e) => e.owner === brand);
}

/**
 * Terms this brand gave up, and why.
 *
 * Read this before proposing any service page change. Every entry here was
 * targeted by 254 once, and the note says what replaced it.
 */
export function concededBy(brand: Brand): RegistryEntry[] {
  return registry.filter((e) => e.status === "conceded" && e.note?.includes("254") && e.owner !== brand);
}

/**
 * Integrity check: no term may appear twice with different owners.
 *
 * A registry that contradicts itself is worse than no registry, because it is
 * consulted and trusted. Run this whenever the file is edited.
 */
export function duplicateOwners(): { keyword: string; owners: Brand[] }[] {
  const byKeyword = new Map<string, Set<Brand>>();
  for (const entry of registry) {
    const key = normalize(entry.keyword);
    if (!byKeyword.has(key)) byKeyword.set(key, new Set());
    byKeyword.get(key)!.add(entry.owner);
  }
  return [...byKeyword.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([keyword, owners]) => ({ keyword, owners: [...owners] }));
}
