/**
 * THE CROSS BRAND DIFFERENTIATION RECORD
 *
 * SYNCHRONIZED FILE. This is the single source of truth for how the three
 * brands treat a shared subject, and it is copied verbatim into
 * sealedengineering and stampmyplans. If you edit it here, you have created a
 * divergence until it is copied. See BACKLOG.md in every repo.
 *
 * THIS WAS AN OWNERSHIP MAP UNTIL 2026-08-30. IT IS NOT ONE NOW.
 * ==============================================================
 * The superseded model assigned each keyword to exactly one brand and forbade
 * the other two from touching it. The fear behind it was correct: three sites
 * owned by one operator, covering the same terms in the same words, is a doorway
 * network, and Google resolves a doorway network by picking one page and
 * suppressing the rest.
 *
 * The operator ruled on 2026-08-30 that the model solved the wrong problem.
 * All three businesses offer the same full service menu, and each earns
 * in-depth content on every service. A procurement officer evaluating a firm,
 * a homeowner ordering a document, and a contractor submitting a plan set are
 * three different people who are not competing for one result. Dividing the
 * keywords cost the flagship its most defensible territory and bought nothing.
 *
 * WHAT CREATES THE DOORWAY RISK IS DUPLICATION, NOT OVERLAP
 * ---------------------------------------------------------
 * Two pages on one subject, written independently for different readers, with
 * different structure and different intent, are two legitimate pages. Two pages
 * sharing copy, structure, or intent are a doorway however carefully the
 * keywords were divided. So one prohibition survives, and it is the one that was
 * always doing the work:
 *
 *   NO PAGE MAY SHARE SUBSTANTIAL COPY, STRUCTURE, HEADINGS, OR PARAPHRASE WITH
 *   A SIBLING PAGE ON THE SAME SUBJECT. EACH IS WRITTEN INDEPENDENTLY FROM
 *   PRIMARY SOURCES FOR ITS OWN BUYER.
 *
 *   THE TEST: any page that could be find-and-replaced into a sibling page
 *   FAILS and is rewritten. Not edited. Rewritten, from the sources, for the
 *   other reader.
 *
 * scripts/registry-audit.mjs enforces exactly that now. It no longer flags topic
 * overlap, because topic overlap is the point. It fetches all three sitemaps and
 * reports similarity scores across titles, H1s, descriptions, and heading
 * structures, and fails on near-duplicates.
 *
 * The previous model is recorded rather than deleted, because a rule that has
 * been reversed once gets re-proposed by somebody who reads only the current
 * state and assumes the loosening was an oversight. It was a decision.
 */

export type Brand = "254" | "sealed" | "stamp";

/**
 * The three stances.
 *
 * Every per service angle below is an application of one of these. If a proposed
 * page cannot be written from its brand's stance, it is the wrong brand's page.
 */
export const BRANDS: Record<
  Brand,
  { name: string; domain: string; audience: string; stance: string }
> = {
  "254": {
    name: "254 Engineering Services",
    domain: "254engineering.com",
    audience:
      "Municipal, county, state, and federal procurement officers; commercial clients; lenders and carriers evaluating a provider; and engineering and field technician recruits.",
    stance:
      "The flagship, written for a buyer EVALUATING A FIRM. What the requirement is in law or code, what a defensible deliverable rests on, how the work is produced at volume across a state, and what a firm must be able to demonstrate. Cites statute and rule by number. Never writes an ordering page.",
  },
  sealed: {
    name: "Sealed Engineering",
    domain: "sealedengineering.com",
    audience:
      "Homeowners, realtors, solar installers, lenders, and title companies who need a specific document.",
    stance:
      "Written for a buyer ORDERING A DOCUMENT. Whether you need one, what it will say, what it costs you in time, and how to get it. Plain language, this week's problem.",
  },
  stamp: {
    name: "StampMyPlans",
    domain: "stampmyplans.com",
    audience: "Contractors, builders, installers, and dealers submitting plan sets.",
    stance:
      "Written for a buyer SUBMITTING PLANS. What a reviewer checks, what gets rejected and why, turnaround, volume, and how to prepare a set that clears the first time.",
  },
};

/* ------------------------------------------------------------------ records */

export type TopicStatus = "live" | "planned" | "none";

export type BrandAngle = {
  /** The angle, specific enough that two brands cannot write the same page. */
  angle: string;
  path?: string;
  status: TopicStatus;
};

export type Topic = {
  topic: string;
  cluster: string;
  /** Every brand that has an angle. A service topic normally has all three. */
  angles: Partial<Record<Brand, BrandAngle>>;
  /** Measured demand only. Dated, sourced, never estimated. */
  evidence?: string;
  note?: string;
};

/*
 * MEASURED EVIDENCE, 2026-08-30, Ahrefs overview, US, 330 units.
 *
 * 1. Proximity intent dominates. "structural engineer near me" 6,700/mo at KD 0,
 *    traffic potential 2,100. Proximity is won by local entity signals and
 *    genuinely local pages, not by national content.
 *
 * 2. The Texas qualifier destroys volume, without exception in the terms tested.
 *    Every "texas" suffixed variant collapsed to 20 or below while its
 *    unqualified form carried demand. Target unqualified head terms and carry
 *    geography through entity signals rather than words in a title.
 *
 * 3. WPI-8 is the most defensible territory available. 200/mo at KD 4 with 1,200
 *    traffic potential: the cluster is six times the head term.
 *
 * A prior Sealed pull measured ZERO for every Texas city crossed engineering
 * keyword tested; city expansion was permanently cancelled on that evidence.
 * That finding stands and is not to be re-proposed without new measurement.
 */

export const topics: Topic[] = [
  {
    topic: "windstorm WPI-8 certification",
    cluster: "service",
    evidence:
      "2026-08-30: 'wpi-8 certificate' 200/mo, KD 4, traffic potential 1,200, CPC $1.80. 'windstorm certification texas' 20/mo. 'texas windstorm inspection' 0/mo.",
    angles: {
      "254": {
        angle:
          "The program and the authority inside it: TWIA designation and what it obliges, the TDI appointed engineer role, what the inspection examines, coastal transaction requirements, and what attaches to a re-roof or window replacement. Written from inside the program by a Coastal Bend firm whose engineer of record will hold the appointment.",
        path: "/windstorm",
        status: "planned",
      },
      sealed: {
        angle: "Consumer explainer and order path. What it is, whether this property needs one, how to obtain it. Also the navigational lookup content, because a searcher after the TDI tool wants a tool.",
        path: "/services/wpi-8-windstorm-certification",
        status: "live",
      },
      stamp: {
        angle: "What a coastal submittal must carry for windstorm compliance and what gets a set returned.",
        status: "none",
      },
    },
  },
  {
    topic: "roof inspection and certification",
    cluster: "service",
    evidence: "2026-08-30: 'roof certification' 500/mo, KD 0, traffic potential 1,400, CPC $7.00, parent topic 'roof inspection near me'. 'roof certification letter' 50/mo, KD 0.",
    angles: {
      "254": {
        angle: "What a sealed opinion on remaining service life actually rests on, what lenders and carriers rely on it for, and how a firm produces it consistently across a state.",
        path: "/services/roof-inspections",
        status: "live",
      },
      sealed: { angle: "Getting the letter for a file, and reading it.", status: "live" },
      stamp: { angle: "Roofing scope on a permitted set.", status: "none" },
    },
  },
  {
    topic: "foundation inspection and certification",
    cluster: "service",
    evidence: "2026-08-30: 'engineer foundation inspection' 40/mo, KD 5, traffic potential 150. 'foundation inspection texas' 10/mo.",
    angles: {
      "254": {
        angle: "Floor elevation measurement as evidence, what a foundation opinion can and cannot conclude, and soil behaviour by region.",
        path: "/services/foundation-inspections",
        status: "live",
      },
      sealed: { angle: "Ordering a report and understanding what it says about the house.", status: "live" },
      stamp: { angle: "Foundation design on a submitted set.", status: "none" },
    },
  },
  {
    topic: "manufactured home foundation certification",
    cluster: "service",
    evidence: "2026-08-30: 50/mo, KD 3, traffic potential 80, CPC $2.50. Driven by FHA, VA, and USDA lending.",
    angles: {
      "254": {
        angle: "The lending requirement, the HUD permanent foundations guide it is measured against, and certifying at volume for lenders and dealers.",
        path: "/services/manufactured-home-foundation-certifications",
        status: "live",
      },
      sealed: { angle: "A borrower or dealer who needs it to close.", status: "live" },
      stamp: { angle: "Dealer set preparation.", status: "none" },
    },
  },
  {
    topic: "solar structural letters",
    cluster: "service",
    angles: {
      "254": {
        angle: "Framing capacity, attachment detail, and wind loading as an engineering review, and what a jurisdiction is checking before it issues.",
        path: "/services/solar-structural-letters",
        status: "live",
      },
      sealed: { angle: "Installers and homeowners ordering the letter.", status: "live" },
      stamp: { angle: "Solar plan sets and what reviewers reject.", status: "planned" },
    },
  },
  {
    topic: "structural letters for permits",
    cluster: "service",
    evidence: "2026-08-30: 'engineer letter for permit' 0/mo. No measurable head term; the intent arrives through permitting and alteration questions.",
    angles: {
      "254": {
        angle: "What a plans examiner is checking for and what a sealed letter asserts.",
        path: "/services/structural-letters",
        status: "live",
      },
      sealed: { angle: "A homeowner told to bring an engineer letter.", status: "live" },
      stamp: { angle: "What reviewers reject and how to fix it.", status: "planned" },
    },
  },
  {
    topic: "repair specifications",
    cluster: "service",
    angles: {
      "254": {
        angle: "Why a defined scope makes bids comparable and a permit issuable, written for the party paying for the repair.",
        path: "/services/repair-specifications",
        status: "live",
      },
      sealed: { angle: "A homeowner with a repair to commission.", status: "live" },
      stamp: { angle: "Building to a specification without a rejection.", status: "none" },
    },
  },
  {
    topic: "residential and light commercial design",
    cluster: "service",
    angles: {
      "254": {
        angle: "Design for expansive soil and framing, and what a permitted drawing set has to carry.",
        path: "/services/residential-light-commercial-design",
        status: "live",
      },
      sealed: { angle: "An owner commissioning a design.", status: "live" },
      stamp: { angle: "Getting a design set stamped and submitted.", status: "live" },
    },
  },
  {
    topic: "forensic and insurance engineering",
    cluster: "service",
    angles: {
      "254": {
        angle: "Independent investigation documented to one standard whichever party asked, and why the obligation runs to the facts.",
        path: "/services/forensic-engineering",
        status: "live",
      },
      sealed: { angle: "An owner after a loss who needs an assessment.", status: "live" },
      stamp: { angle: "None.", status: "none" },
    },
  },
  {
    topic: "plan stamping and plan review",
    cluster: "plans",
    angles: {
      stamp: {
        angle: "The whole subject: process, turnaround, pricing, volume, deferred submittals, rejection reasons. StampMyPlans' core.",
        status: "live",
      },
      "254": { angle: "How a firm reviews and seals at volume, for a buyer evaluating capacity.", status: "none" },
    },
  },
  {
    topic: "structural engineer, proximity intent",
    cluster: "proximity",
    evidence: "2026-08-30: 'structural engineer near me' 6,700/mo, KD 0, traffic potential 2,100, CPC $4.00. The highest volume term measured across the three brands.",
    angles: {
      "254": {
        angle: "What a structural engineer does and when you need one, engineer versus inspector, what a report will and will not tell you, how to choose one. Answers the question behind the search. Converted by local entity signals rather than by the word Texas.",
        status: "planned",
      },
      sealed: { angle: "The document pages and the city geo that serve an ordering buyer.", status: "live" },
    },
  },
  /*
   * THE BUYERS, AGENTS AND LENDERS SECTION ON THIS SITE, 2026-10-16.
   *
   * One entry per primary keyword, each recording this brand's angle so that a
   * Sealed Engineering page on the same subject is written as a different
   * document for its ordering buyer. Status is "planned" until the branch
   * content/blog-buyers merges; whoever merges it sets these to "live".
   * Placed here rather than at the end of the array so it does not collide
   * with the windstorm section's entries on content/blog-windstorm.
   *
   * Three briefed posts were folded and have no entry: "structural engineer
   * home inspection" (served by /structural-engineer/inspection), "structural
   * engineer inspection cost" (served by /structural-engineer/cost) and
   * "foundation inspection" (ruled to /services/foundation-inspections in
   * docs/keyword-mapping.md). Plan: docs/blog/buyers-section-plan.md.
   */
  {
    topic: "foundation inspection cost",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'foundation inspection cost' 2,200/mo, KD 2. Supporting: 'how much is a foundation inspection'.",
    angles: {
      "254": {
        angle: "What each of three providers sells under one name (TREC inspector under 22 TAC 535.227 and 535.228, a repair company's free visit, an engineer), the engineer's fee read through the ASCE Texas Section levels A, B and C, costs outside the fee (plumbing test, boring, repair documents, a city permit, post repair letter), who engages inspectors under TREC form 20-18, and the Fannie Mae B4-1.3-06 report standard. Types no price of its own; links /structural-engineer/cost, which owns 'structural engineer cost'.",
        path: "/insights/foundation-inspection-cost",
        status: "planned",
      },
      sealed: {
        angle: "The price of the document a homeowner is ordering this week and how to book it. Not this provider comparison or its ASCE level structure.",
        status: "none",
      },
    },
  },
  {
    topic: "free foundation inspection",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'free foundation inspection' 1,300/mo, KD 0. Supporting: 'foundation repair inspection'.",
    angles: {
      "254": {
        angle: "Who offers a free inspection and why it is free, what it can and cannot be used for (Occupations Code 1001.003, 1001.301, 1001.401; TREC form 20-18 paragraph 7A; Fannie Mae settlement standard), conflict of interest under TBPELS rule 137.57 and ASCE Texas section 2.2, how to use free proposals well, and city permits as a check. Names no company.",
        path: "/insights/free-foundation-inspection",
        status: "planned",
      },
      sealed: {
        angle: "None planned. A free versus paid page on the ordering brand reads as a pitch against competitors.",
        status: "none",
      },
    },
  },
  {
    topic: "pre purchase home inspection",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'pre purchase home inspection' 1,000/mo, KD 1. Supporting: 'pre-purchase inspection', 'structural inspection', 'roof inspection before buying a house' (40/mo, a full section).",
    angles: {
      "254": {
        angle: "The Texas buyer's inspection read from the rules: TREC form 20-18 and the termination option, what 22 TAC 535.227 and 535.228 require and exclude, the REI 7-6 form, when the report points to an engineer, a full roof section (inspector's roof duties versus an engineer's structural roof assessment and when to commission one before closing), and the Property Code 5.008 disclosure. Distinct from /structural-engineer/inspection, which describes the engineer's visit itself.",
        path: "/insights/pre-purchase-home-inspection",
        status: "planned",
      },
      sealed: {
        angle: "A buyer in an option period ordering a foundation or roof letter. Not this rule by rule reading.",
        status: "none",
      },
    },
  },
  {
    topic: "structural engineer report",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'structural engineer report' 150/mo, KD 0. Supporting: 'engineer report', 'structural engineer letter', 'foundation engineer report'.",
    angles: {
      "254": {
        angle: "Written for agents, brokers and lenders: the seal under 1001.401 and rule 137.33, the five documents that share the name, reading scope, addressee, date and level, matching the conclusion to the Fannie Mae B4-1.3-06 wording, a report in hand and the 5.008 disclosure, and what to send the engineer. Separates the permit letter (/services/structural-letters) from transaction reports.",
        path: "/insights/structural-engineer-report",
        status: "planned",
      },
      sealed: {
        angle: "A homeowner told to get an engineer's letter for a closing. Not the agent and lender reading guide.",
        status: "none",
      },
    },
  },
  {
    topic: "crack in foundation",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'crack in foundation' 2,700/mo, KD 0. Supporting: 'crack in foundation of house', 'hairline crack in foundation', 'foundation crack'.",
    angles: {
      "254": {
        angle: "Reading any foundation crack for movement: patterns, the TREC indications of adverse performance, a self monitoring method, the untraceable width rule in a note, seasonal clay movement (USDA Houston Black, the IRC test via TDLR), when to call an engineer, and how a Level B evaluation reads the crack. Slab specifics are left to the slab post; /structural-engineer/when-you-need-one keeps the general triggers.",
        path: "/insights/crack-in-foundation",
        status: "planned",
      },
      sealed: {
        angle: "An owner with a crack who wants it looked at this week. Not this reading guide or its monitoring method.",
        status: "none",
      },
    },
  },
  {
    topic: "crack in concrete slab foundation",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'crack in concrete slab foundation' 1,700/mo, KD 1. Supporting: 'cracks in foundation slab'.",
    angles: {
      "254": {
        angle: "Texas slab on grade on expansive clay: conventional and post tensioned slabs (PTI DC10.5), the IRC as adopted under Local Government Code 214.212, shrinkage cracking per NRMCA CIP 4, slab cracks that point to movement, cracks found under flooring, locating tendons before cutting, and what a Level B survey measures with the ASCE Texas cautions and repair expectations.",
        path: "/insights/crack-in-concrete-slab-foundation",
        status: "planned",
      },
      sealed: {
        angle: "None planned beyond its foundation document page.",
        status: "none",
      },
    },
  },
  {
    topic: "foundation engineer",
    cluster: "buyers",
    evidence: "2026-10-16, operator's Ahrefs pull, US, supplied with the brief: primary 'foundation engineer' 600/mo, KD 0. 'foundation repair inspection' is assigned to the free foundation inspection post, not here.",
    angles: {
      "254": {
        angle: "Roles across a repair, stage by stage: evaluation, sealed remediation documents, city permit (Houston, Denton), construction, plumbing test, post repair elevations and the letter of substantial completion, from the ASCE Texas Section guidelines; competence under rule 137.59; geotechnical versus structural input; where roles merge under rule 137.57; the board's 2018 response; questions for each party. Distinct from /structural-engineer/how-to-choose, which covers verifying an engineer.",
        path: "/insights/foundation-engineer-vs-repair-company",
        status: "planned",
      },
      sealed: {
        angle: "An owner commissioning an independent evaluation before a repair. Not this role by role account.",
        status: "none",
      },
    },
  },
  {
    topic: "Texas engineering firm registration",
    cluster: "institutional",
    angles: {
      "254": {
        angle: "What the Occupations Code and board rules require of a business entity, cited by rule number.",
        path: "/insights/texas-engineering-firm-registration",
        status: "live",
      },
    },
  },
  {
    topic: "engineer of record and responsible charge",
    cluster: "institutional",
    angles: {
      "254": {
        angle: "That engineer of record is not a defined term in Texas law, and what the seal and responsible charge actually govern.",
        path: "/insights/engineer-of-record-texas",
        status: "live",
      },
    },
  },
  {
    topic: "Texas PE licence lookup",
    cluster: "institutional",
    evidence: "'tbpe roster' 600/mo at KD 55, traffic potential 1,400. KD 55 against a domain with no authority does not rank yet; the page exists because the question is real.",
    angles: {
      "254": {
        angle: "The roster versus an official verification, and what the roster stopped publishing.",
        path: "/insights/texas-pe-license-lookup",
        status: "live",
      },
    },
  },
  {
    topic: "public sector procurement of engineering services",
    cluster: "institutional",
    angles: {
      "254": {
        angle: "Government Code Chapter 2254, qualifications based selection, and what a compliant process looks like.",
        path: "/insights/texas-professional-services-procurement-act",
        status: "live",
      },
    },
  },
  {
    topic: "county level geography",
    cluster: "geo",
    evidence:
      "UNMEASURED as of 2026-08-30 and must be measured before anything is built. The city pattern measured ZERO on a prior Sealed pull. Counties are a different search behaviour and may or may not carry demand; assumption is not evidence in either direction.",
    angles: {
      "254": {
        angle: "Permitting authority, whether unincorporated areas require permits, TWIA designation, soil belt and its engineering implication, adopted code edition. Region pages exist; county pages do not.",
        path: "/coverage",
        status: "live",
      },
    },
    note: "The doorway rule is absolute here whatever the differentiation model permits: a geo page ships only with substantial information true of that place specifically, which could not be produced by find and replacing the place name.",
  },
  {
    topic: "city level geography",
    cluster: "geo",
    evidence: "Measured ZERO across every Texas city crossed engineering keyword tested on a prior Sealed pull. City expansion permanently cancelled.",
    angles: {
      sealed: { angle: "The 25 city pages that already exist. Not to be extended without new measurement.", status: "live" },
    },
  },
  {
    topic: "careers and hiring",
    cluster: "careers",
    angles: {
      "254": {
        angle: "The firm's seats, engagement models, and standards. The master entity hires; the sibling brands do not.",
        path: "/careers",
        status: "live",
      },
    },
  },
];

/* ---------------------------------------------------------------- accessors */

export const topicsFor = (brand: Brand): Topic[] =>
  topics.filter((t) => t.angles[brand] !== undefined && t.angles[brand]!.status !== "none");

export const topicByName = (name: string): Topic | undefined =>
  topics.find((t) => t.topic === name);

/** Paths a brand claims, for the audit's live resolution check. */
export function claimedPaths(brand: Brand): { topic: string; path: string; status: TopicStatus }[] {
  return topics
    .filter((t) => t.angles[brand]?.path)
    .map((t) => ({ topic: t.topic, path: t.angles[brand]!.path!, status: t.angles[brand]!.status }));
}
