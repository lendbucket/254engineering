import type { Block, Insight } from "./insights";
import { registrationStatement, windstormAppointmentStatement } from "@/lib/launch";
import { priceFor, priceSentence } from "@/config/prices";
import { coastalLine, lineOffer } from "@/lib/ordering";
import { refundDisclosure } from "@/lib/ops-orders";
import { CATALOG } from "@data/catalog";

/*
 * ===========================================================================
 * THE ROOFS SECTION. Written 2026-10-18.
 * ===========================================================================
 *
 * Seven posts for homeowners, buyers and sellers, agents and roofing
 * contractors. The plan, the cannibalization check, the topics written
 * narrowly and the claims dropped for want of a primary source are in
 * docs/blog/roofs-section-plan.md. Keyword figures for posts 1 and 2 are the
 * operator's, supplied with the brief; the other five primary keywords are
 * unmeasured, and no Ahrefs call was made in the writing session.
 *
 * SOURCES, ALL READ 2026-10-18
 * ----------------------------
 *   22 Tex. Admin. Code 535.227 and 535.228 (Justia copy, current through
 *     June 27, 2025) and TREC's notice of the August 10, 2026 amendment
 *   TREC form 20-18 page; the resale contract text on Justia Forms (7A and the
 *     termination option only, the paragraphs the buyers posts already cite)
 *   Tex. Prop. Code 5.008 (Justia, 2025), notice form item 1 and item 4
 *   Tex. Occ. Code 1001.003, 1001.301, 1001.401; 22 Tex. Admin. Code 137.33
 *     and 137.35 (electronic seals)
 *   Tex. Ins. Code 4101.001, 4101.002, 4101.051 (adjuster licensing)
 *   Tex. Ins. Code 2210.2515, as the coastal posts cite it
 *   TDI: roofing and insurance, know the law; hail damage, what to do next;
 *     insurance and your roof; replacement cost or actual cash value; how to
 *     get a CLUE about your claims history
 *   City of Arlington, Technical Bulletin: Re-Roof Permits, Inspections and
 *     Common Q and A, September 13, 2023
 *   GAF, Technical Bulletin TAB-R-129, Shingle Color Code Explained
 *
 * NO PRICE IS TYPED. The roof price and its coastal line are read through
 * priceSentence() and coastalLine(), the same pair /process and the cost page
 * use, and what moves the price is the price book's own whatChangesIt. The
 * refund terms in post 7 are refundDisclosure() itself, the lines the order
 * form shows before payment, so this file holds no second account of them.
 *
 * NO CALL TO ACTION IS TYPED EITHER. Each one reads lineOffer(), so the link
 * goes to the order flow only while the roof line is orderable and to the
 * quote path otherwise, and no sentence here invites an order in a mode where
 * none can be taken.
 *
 * THE PROTOCOL IS PARAPHRASED, NEVER QUOTED. 254-RC-001 v1.1 describes what
 * the technician and the engineer do; these posts describe the same method in
 * their own words and print none of its thresholds.
 *
 * THE FIRM'S STANDING IS DERIVED. registrationStatement() and
 * windstormAppointmentStatement() render the credentials. No engineer is named
 * and no licence, registration or appointment number is typed.
 */

const ROOFS_SECTION_DATE = "2026-10-18";

const ROOF_SRC = {
  trec227: {
    label: "22 Tex. Admin. Code § 535.227, Standards of Practice: General Provisions",
    url: "https://regulations.justia.com/states/texas/title-22/part-23/chapter-535/subchapter-r/section-535-227/",
  },
  trec228: {
    label: "22 Tex. Admin. Code § 535.228, Standards of Practice: Minimum Inspection Requirements for Structural Systems",
    url: "https://regulations.justia.com/states/texas/title-22/part-23/chapter-535/subchapter-r/section-535-228/",
  },
  trec228Notice: {
    label: "TREC, rule notice for 22 TAC § 535.228, adopted August 10, 2026",
    url: "https://www.trec.texas.gov/node/3065",
  },
  trec2018: {
    label: "TREC, One to Four Family Residential Contract (Resale), form 20-18",
    url: "https://trec.texas.gov/node/2755",
  },
  trec2018Text: {
    label: "One to Four Family Residential Contract (Resale), published text (Justia Forms)",
    url: "https://forms.justia.com/texas/statewide/texas-real-estate-commission/contracts/one-to-four-family-residential-contract-resale-43316.html",
  },
  prop5008: {
    label: "Tex. Prop. Code § 5.008, Seller's Disclosure of Property Condition (2025 text)",
    url: "https://law.justia.com/codes/texas/property-code/title-2/chapter-5/subchapter-a/section-5-008",
  },
  occ1001_003: {
    label: "Tex. Occ. Code § 1001.003, Practice of Engineering",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.003",
  },
  occ1001_301: {
    label: "Tex. Occ. Code § 1001.301, License Required",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.301",
  },
  occ1001_401: {
    label: "Tex. Occ. Code § 1001.401, Use of Seal",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.401",
  },
  rule137_33: {
    label: "22 Tex. Admin. Code § 137.33, Sealing Procedures",
    url: "http://txrules.elaws.us/rule/title22_chapter137_sec.137.33",
  },
  rule137_35: {
    label: "22 Tex. Admin. Code § 137.35, Electronic Seals and Electronic Signatures",
    url: "https://regulations.justia.com/states/texas/title-22/part-6/chapter-137/subchapter-b/section-137-35",
  },
  ins4101: {
    label: "Tex. Ins. Code ch. 4101, Insurance Adjusters, official text including §§ 4101.001, 4101.002 and 4101.051",
    url: "https://tcss.legis.texas.gov/resources/IN/htm/IN.4101.htm",
  },
  ins2210_2515: {
    label: "Tex. Ins. Code § 2210.2515, Issuance of Certificates of Compliance",
    url: "https://texas.public.law/statutes/tex._ins._code_section_2210.2515",
  },
  tdiRoofLaw: {
    label: "Texas Department of Insurance, Roofing and insurance: know the law",
    url: "https://www.tdi.texas.gov/Consumer/storms/roofing-and-insurance-know-the-law.html",
  },
  tdiHail: {
    label: "Texas Department of Insurance, Hail damage to your home or car? What to do next",
    url: "https://tdi.texas.gov/tips/after-hail-or-windstorms.html",
  },
  tdiRoof: {
    label: "Texas Department of Insurance, Insurance and your roof: what to know when buying a policy or filing a claim",
    url: "https://www.tdi.texas.gov/tips/replacing-your-roof.html",
  },
  tdiAcv: {
    label: "Texas Department of Insurance, Home policies: replacement cost or actual cash value?",
    url: "https://www.tdi.texas.gov/tips/home-insurance-policies-replacement-cost-or-actual-cash-value.html",
  },
  tdiClue: {
    label: "Texas Department of Insurance, How to get a CLUE about your claims history",
    url: "https://tdi.texas.gov/tips/check-your-propertys-insurance-claim-history.html",
  },
  arlingtonReroof: {
    label: "City of Arlington, Technical Bulletin: Re-Roof Permits, Inspections and Common Q&A (September 13, 2023)",
    url: "https://www.arlingtontx.gov/files/assets/city/v/2/planning-and-development-services/documents/permitting-amp-inspections/roofing-replacement-permits-inspections.pdf",
  },
  gafTab129: {
    label: "GAF, Technical Bulletin TAB-R-129, Shingle Color Code Explained",
    url: "https://www.gaf.com/en-us/document-library/documents/technical-bulletins-&-notes/r-129-shingle-color-code-explained.pdf",
  },
} as const;

const rcite = (key: keyof typeof ROOF_SRC, supports: string) => ({ ...ROOF_SRC[key], supports });

/* ------------------------------------------------------------------------
 * The roof line's facts, each read from its one home.
 * ---------------------------------------------------------------------- */

const ROOF = "roof-inspections";

/** "$549, plus $75 in first tier coastal counties", or null if no price is ruled. */
const ROOF_PRICE: string | null = (() => {
  const price = priceSentence(ROOF);
  if (!price) return null;
  const coastal = coastalLine(ROOF);
  return coastal ? `${price}, ${coastal}` : price;
})();

/** The price book's own sentence on what moves the price, first letter lowered for use mid sentence. */
const ROOF_PRICE_MOVES: string | null = (() => {
  const price = priceFor(ROOF);
  const text = price?.whatChangesIt ?? null;
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : null;
})();

const ROOF_ENTRY = CATALOG.find((e) => e.serviceSlug === ROOF) ?? null;

/** The refund lines the order form shows before payment, verbatim. */
const ROOF_REFUND_TERMS: string[] = ROOF_ENTRY ? refundDisclosure(ROOF_ENTRY) : [];

const ROOF_OFFER = lineOffer(ROOF);

/** One sentence on the published price, or a pointer to the price list when none is ruled. */
function roofPriceSentence(): string {
  return ROOF_PRICE
    ? `The published price for 254 Engineering's roof certification is ${ROOF_PRICE}.`
    : "The fee for 254 Engineering's roof certification is on [the published price list](/structural-engineer/cost).";
}

/**
 * The call to action, read from lineOffer(). While the roof line can be
 * bought online it links the order flow; otherwise it links the quote path
 * lineOffer() returns. Neither wording matches an OPEN_GATED pattern.
 */
function roofCta(lead: string): Block {
  const action = ROOF_OFFER.orderable
    ? `[Start the roof certification online](${ROOF_OFFER.href})`
    : `[Request a quote for a roof certification](${ROOF_OFFER.href})`;
  return {
    kind: "p",
    text: `${lead} ${action}, or read [what the sealed letter covers](/services/roof-inspections) first.`,
  };
}

export const roofInsights: Insight[] = [
  // ------------------------------------------------------------ roofs, post 1
  {
    slug: "roof-inspection-cost",
    title: "Roof Inspection Cost: What Each Fee Buys | 254 Engineering",
    h1: "Roof inspection cost, and what each kind of inspection buys",
    description:
      "What a roof inspection costs depends on who makes it and what document you get. Compare a home inspector, a roofer and an engineer, and see the fixed price.",
    summary:
      "Three different people inspect roofs in Texas, and each fee buys a different document. Compare what arrives at the end and who will rely on it, not the number on the quote.",
    eyebrow: "Roofs",
    primaryKeyword: "roof inspection cost",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A roof inspection costs what its document is worth to the person who has to rely on it. In Texas the roof gets looked at by a home inspector licensed by the Texas Real Estate Commission, by roofing contractors, and by engineers, and the three produce three different things. Price them against each other only after deciding which document the situation needs.",
      },
      {
        kind: "p",
        text: [roofPriceSentence(), "What that letter covers, and what it does not, is set out on [the roof certification page](/services/roof-inspections)."].join(" "),
      },
      { kind: "h2", text: "The home inspector's roof check is one line of a larger fee" },
      {
        kind: "p",
        text: "Rule 535.228(c) requires a TREC inspector to inspect the roof covering from the surface of the roof and to report the covering type, the vantage point, evidence of water penetration and evidence of previous repairs. The same subsection says the inspector is not required to determine the covering's remaining life expectancy or its number of layers, or to identify latent hail damage.",
      },
      {
        kind: "p",
        text: "Rule 535.227 describes the whole inspection as a limited visual survey, and says the inspector is not required to determine insurability or to recommend or provide engineering services. The roof section is therefore priced inside the general inspection, and it is written to tell a buyer whether to look further. How it fits the rest of a buyer's inspection is in [the pre purchase home inspection guide](/insights/pre-purchase-home-inspection).",
      },
      { kind: "h2", text: "A contractor's inspection ends in an estimate" },
      {
        kind: "p",
        text: "When a roofing contractor inspects a roof without charge, what arrives is an estimate for work that contractor would do. That is the right document for pricing a repair or a replacement. It is not an independent opinion, and the Texas Department of Insurance's advice after a hailstorm is to get more than one bid or repair estimate.",
      },
      {
        kind: "p",
        text: "The department also sets out two limits worth knowing before anybody signs. A contractor may not waive, rebate or absorb a policyholder's deductible, and a contractor who provides or may provide work on a property may not act as a public adjuster on its claim. What that means on a job is covered in [the guide for roofing contractors](/insights/engineer-letter-for-roofers).",
      },
      { kind: "h2", text: "An engineer's fee buys a sealed opinion" },
      {
        kind: "p",
        text: "Section 1001.003 of the Occupations Code includes evaluation in the practice of engineering, and section 1001.301 restricts that practice to license holders. Section 1001.401 requires a report issued by a license holder for a Texas project to carry the seal, and rule 137.33 says that on sealing the engineer takes full professional responsibility for the work.",
      },
      {
        kind: "p",
        text: "That responsibility is what the fee pays for. On 254 Engineering's roof line a trained technician gathers the evidence to the engineer's written checklist, and the engineer reviews it and decides. The steps from payment to the sealed letter are in [the roof inspection process](/insights/roof-inspection-process).",
      },
      { kind: "h2", text: "What moves the engineer's price" },
      {
        kind: "p",
        text: ROOF_PRICE_MOVES
          ? `The price list names what changes the figure: ${ROOF_PRICE_MOVES} Any repair the engineer requires is done by others and paid to them, and what happens to the fee if the engineer declines is stated on the order form before anything is charged.`
          : "Any repair the engineer requires is done by others and paid to them, and what happens to the fee if the engineer declines is stated on the order form before anything is charged.",
      },
      {
        kind: "p",
        text: "On the coast, a roof certification and a windstorm certificate are separate documents with separate fees. Which one a file needs is worked through in [roof certification versus WPI-8](/insights/roof-certification-vs-wpi-8).",
      },
      {
        kind: "note",
        title: "Published price ranges this post could not trace",
        body: [
          "Cost guides publish national average ranges for roof inspections and roof certifications. The ones read for this post came from contractor quote platforms and gave no survey method, sample or date range that could be checked.",
          "None is repeated here. The figure that can be checked is the one a firm publishes for its own work.",
        ],
      },
      roofCta("If a lender, a carrier or a buyer has asked for an engineer's opinion on the roof in writing, that request decides the document."),
    ],
    sources: [
      rcite("trec228", "The roof covering items a TREC inspector must report, and that remaining life, number of layers and latent hail damage are not required."),
      rcite("trec227", "That a TREC inspection is a limited visual survey, and that insurability and engineering services are outside it."),
      rcite("tdiHail", "The advice to get more than one bid or repair estimate."),
      rcite("tdiRoofLaw", "That a contractor may not waive or rebate a deductible or act as a public adjuster on a property it works on, under Ins. Code § 4102.163 and Bus. & Com. Code § 27.02."),
      rcite("occ1001_003", "That evaluation is part of the practice of engineering."),
      rcite("occ1001_301", "That the practice of engineering is restricted to license holders."),
      rcite("occ1001_401", "That a report issued by a license holder for a Texas project carries the seal."),
      rcite("rule137_33", "That on sealing, the engineer takes full professional responsibility for the work."),
    ],
    faqs: [
      {
        q: "How much does a roof inspection cost in Texas?",
        a: ROOF_PRICE
          ? `It depends on who makes it. A TREC inspector's roof check is part of the home inspection fee, a contractor's inspection leads to an estimate for the contractor's own work, and an engineer's sealed roof certification is its own fee. This firm's is ${ROOF_PRICE}.`
          : "It depends on who makes it. A TREC inspector's roof check is part of the home inspection fee, a contractor's inspection leads to an estimate for the contractor's own work, and an engineer's sealed roof certification is its own fee, published on this firm's price list.",
      },
      {
        q: "Does a home inspection check for hail damage?",
        a: "The inspector reports the roof covering and evidence of water penetration and previous repairs, but rule 535.228(c) says the inspector is not required to identify latent hail damage.",
      },
      {
        q: "What does the engineer's fee include?",
        a: "The technician's visit to the engineer's checklist, the engineer's review of that evidence, and, on a pass, a sealed letter on the roof's observed condition. Repairs the engineer requires are done by others.",
      },
    ],
  },

  // ------------------------------------------------------------ roofs, post 2
  {
    slug: "how-old-is-my-roof",
    title: "How Old Is My Roof? Five Records to Check | 254 Engineering",
    h1: "How old is my roof? Five records that can answer it, and what each proves",
    description:
      "How old is my roof? Check the invoice, a permit, a bundle date code, claim history and the seller's notice. See what each proves and when to ask an engineer.",
    summary:
      "A roof's age is rarely written on the roof. It is pieced together from records, and each record proves something narrower than it first appears to.",
    eyebrow: "Roofs",
    primaryKeyword: "how old is my roof",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "The age of a roof is usually established from paper, not from the roof. Five records can answer it, and each one dates something slightly different: a contract, a permit, a product, a claim, or a seller's memory.",
      },
      {
        kind: "p",
        text: "The question matters because insurers ask it. The Texas Department of Insurance says a company will inspect the roof when you apply, that as roofs age some companies switch to actual cash value, and that under an actual cash value policy the amount paid for roof damage depends on how old the roof is.",
      },
      { kind: "h2", text: "1. The contract, invoice or warranty" },
      {
        kind: "p",
        text: "The best record is the paperwork from the last full replacement: the roofing contract, the final invoice, or a warranty document. It carries a date, usually names the product, and ties both to this address. It is also one of the documents the engineer's intake on this firm's roof line asks for.",
      },
      { kind: "h2", text: "2. A re-roof permit" },
      {
        kind: "p",
        text: "Some Texas cities require a permit to re-roof. The City of Arlington's building inspection bulletin, for example, says a building permit is required to replace roof covering materials, except for replacements covering 10 percent or less of the roof area. Where a permit was pulled, the building department that issued it holds a dated record.",
      },
      {
        kind: "p",
        text: "A permit dates the work that was permitted. It does not prove that the roof on the house today is that roof, and work done without a permit leaves nothing to find.",
      },
      { kind: "h2", text: "3. A date code on the bundles" },
      {
        kind: "p",
        text: "Leftover bundles in a garage or attic can help. GAF's technical bulletin TAB-R-129 says one end of each of its shingle bundles is printed with the color name and code, a date code, a time and the packaging line. That is one manufacturer's convention, and it dates manufacture rather than installation, so it sets the earliest the roof could have gone on.",
      },
      { kind: "h2", text: "4. The insurance claim history" },
      {
        kind: "p",
        text: "TDI explains that a CLUE report shows the claims filed for a house over the past seven years, including claims made before the current owner bought it, and that a buyer can ask the owner to show one. A roof claim on that report gives a date to check against an invoice. It does not prove the roof was replaced.",
      },
      { kind: "h2", text: "5. The seller's disclosure notice" },
      {
        kind: "p",
        text: "In a sale, item 1 of the notice form in section 5.008 of the Property Code asks for the roof type and its approximate age, and item 4 asks about previous structural or roof repair. The notice is completed to the best of the seller's belief and knowledge as of the date it is completed, so the age on it is the seller's estimate. How a buyer uses the notice is in [the pre purchase home inspection guide](/insights/pre-purchase-home-inspection).",
      },
      {
        kind: "p",
        text: "On the coast there can be a sixth record. A re-roof is an improvement under section 2210.2515 of the Insurance Code, and the certificate issued for one is dated; [the windstorm certificate lookup](/insights/texas-windstorm-certificate-lookup) explains how to search for it.",
      },
      { kind: "h2", text: "What an inspection can and cannot say about age" },
      {
        kind: "p",
        text: "Rule 535.228(c) says a TREC inspector is not required to determine a roof covering's remaining life expectancy or its number of layers. An estimate of age from wear alone is an opinion, and two people can reach two answers.",
      },
      {
        kind: "p",
        text: "On this firm's roof line the engineer does not certify an age. The owner's stated age is recorded word for word, the technician photographs any product label, wrapper or stamp found on site, and the engineer judges whether the covering's condition is consistent with what was reported. Where the story, the photographs and the paperwork disagree, the engineer can send the technician back for the items that settle it, such as a label, a permit sticker or an invoice matched to the covering. The sealed letter states observed condition and does not estimate remaining service life.",
      },
      roofCta("When a carrier, a lender or a buyer needs a sealed opinion on the roof's condition rather than a guess at its age, that is the engineer's document."),
    ],
    sources: [
      rcite("tdiRoof", "That the insurer inspects the roof on application, and that as roofs age some companies switch to actual cash value."),
      rcite("tdiAcv", "That under an actual cash value policy the payment for roof damage depends on how old the roof is."),
      rcite("arlingtonReroof", "Arlington's re-roof permit requirement and its 10 percent exception."),
      rcite("gafTab129", "What GAF prints on one end of each shingle bundle, including a date code."),
      rcite("tdiClue", "That a CLUE report shows seven years of claims on a house, including earlier owners' claims, and that a buyer can ask the owner for one."),
      rcite("prop5008", "Notice form item 1 (roof type and approximate age), item 4 (previous structural or roof repair), and the best of belief and knowledge standard."),
      rcite("ins2210_2515", "That an improvement includes repair and alteration of a structure, which brings a coastal re-roof under the certificate section."),
      rcite("trec228", "That a TREC inspector is not required to determine remaining life expectancy or the number of layers."),
    ],
    faqs: [
      {
        q: "Can an inspector tell how old my roof is by looking at it?",
        a: "An estimate from wear is an opinion rather than a record. Rule 535.228(c) does not require a home inspector to determine a covering's remaining life expectancy, and the dated records in this post are what settle the question.",
      },
      {
        q: "Does a permit prove when the roof was replaced?",
        a: "It proves when work was permitted at the address. It does not prove the roof on the house today is that roof, and unpermitted work leaves no permit record.",
      },
      {
        q: "Will an engineer's roof letter state the roof's age?",
        a: "Not on this firm's roof line. The letter states the observed condition on the inspection date and does not estimate remaining service life. The reported age is recorded, and the engineer judges whether the condition is consistent with it.",
      },
    ],
  },

  // ------------------------------------------------------------ roofs, post 3
  {
    slug: "roof-certification-for-home-sale",
    title: "Roof Certification for a Texas Home Sale | 254 Engineering",
    h1: "Roof certification for a home sale: what it is, and who in Texas can sign one",
    description:
      "A roof certification for a home sale is an opinion the contract does not require. See who in Texas can sign one, what a sealed letter says, and when to get it.",
    summary:
      "Buyers, sellers and agents ask for a roof certification as if it were a standard form. It is not one. The questions that matter are who signs it, what it states, and who it is addressed to.",
    eyebrow: "Buying and selling",
    primaryKeyword: "roof certification for a home sale",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A roof certification for a home sale is a written opinion on the roof's condition that somebody in the transaction has asked for. The Texas resale contract does not name one. Paragraph 7A of TREC form 20-18 lets the buyer have the property inspected by inspectors the buyer selects who are licensed by TREC or otherwise permitted by law, and a roof certification is something a lender, a carrier or a buyer asks for on top of that.",
      },
      {
        kind: "p",
        text: "Because it has no standard form, the request has to be read for three things: who must sign it, what it must say, and who it must be addressed to. [The roof certification page](/services/roof-inspections) describes the sealed letter this firm issues.",
      },
      { kind: "h2", text: "Who can sign one in Texas" },
      {
        kind: "p",
        text: "A home inspector reports on the roof but does not certify it. Rule 535.228(c) does not require the inspector to determine remaining life or the number of layers, or to identify latent hail damage, and rule 535.227 does not require the inspector to determine insurability or to recommend or provide engineering services. The inspection report is not written to be a certification.",
      },
      {
        kind: "p",
        text: "A roofing contractor can write a letter about a roof, and for some readers it is enough. It is a contractor's statement, it carries no engineer's seal, and it often comes from the business that would be paid for the repair.",
      },
      {
        kind: "p",
        text: [
          "An engineer's letter is the sealed version. Section 1001.003 of the Occupations Code includes evaluation in the practice of engineering, section 1001.301 restricts that practice to license holders, and section 1001.401 requires a license holder's report on a Texas project to carry the seal. Under rule 137.33 the engineer who seals it takes full professional responsibility for what it says.",
          registrationStatement(),
        ]
          .filter(Boolean)
          .join(" "),
      },
      { kind: "h2", text: "What a sealed roof letter states" },
      {
        kind: "p",
        text: "On this firm's roof line, a letter issues only on a pass. It is addressed to the recipient recorded when the job was opened, for the purpose recorded then, and it identifies the property, the inspection date, the covering type, how the evidence was gathered and reviewed, and the condition observed. It says the inspection was visual and non destructive and makes no representation about concealed conditions.",
      },
      { kind: "h2", text: "What it is not" },
      {
        kind: "ul",
        items: [
          "A warranty. It is an opinion on condition as of one date.",
          "A remaining life figure. This firm's letter does not estimate one, and a lender who requires years should say so before anything is started.",
          "A promise that the roof will not leak.",
          "Transferable. It is not reissued to another recipient, purpose or date; a new inspection is needed.",
          "A windstorm certificate. On the coast that is a different document from a different issuer, set out in [roof certification versus WPI-8](/insights/roof-certification-vs-wpi-8).",
        ],
      },
      { kind: "h2", text: "Timing inside the contract" },
      {
        kind: "p",
        text: "The resale contract's termination option gives the buyer an unrestricted right to terminate by notice within the time the contract sets, and the option fee is not refunded. A certification the buyer needs has to land inside that window, which means it is started as soon as the request is in writing.",
      },
      {
        kind: "p",
        text: "A roof that needs repair gets a written repair list rather than a letter, and the letter waits until every repair has been checked on a return visit. Who pays for those repairs therefore becomes part of the negotiation.",
      },
      { kind: "h2", text: "For the seller" },
      {
        kind: "p",
        text: "The seller's notice under section 5.008 of the Property Code asks for the roof type and approximate age, and about previous structural or roof repair, completed to the best of the seller's belief and knowledge. A letter a seller commissions before listing becomes part of what the seller knows. How an agent or lender reads any engineer's report is in [the structural engineer report guide](/insights/structural-engineer-report).",
      },
      roofCta("Name every party the letter must be addressed to at the start, because that cannot be changed afterwards."),
    ],
    sources: [
      rcite("trec2018", "The current edition of form 20-18 and its effective date of January 3, 2025."),
      rcite("trec2018Text", "The paragraph 7A text on inspectors, and the termination option and its non refundable fee."),
      rcite("trec228", "That a TREC inspector is not required to determine remaining life or the number of layers or to identify latent hail damage."),
      rcite("trec227", "That a TREC inspector is not required to determine insurability or to recommend or provide engineering services."),
      rcite("occ1001_003", "That evaluation is part of the practice of engineering."),
      rcite("occ1001_301", "That the practice of engineering is restricted to license holders."),
      rcite("occ1001_401", "That a license holder's report on a Texas project carries the seal."),
      rcite("rule137_33", "That on sealing, the engineer takes full professional responsibility."),
      rcite("prop5008", "The notice form's roof type and age item, the previous roof repair item, and the best of belief and knowledge standard."),
    ],
    faqs: [
      {
        q: "Is a roof certification required to sell a house in Texas?",
        a: "The resale contract does not require one. Paragraph 7A of TREC form 20-18 lets the buyer have the property inspected; a lender, an insurer or a buyer may ask for a roof certification on top of that.",
      },
      {
        q: "Can a home inspector certify a roof?",
        a: "A TREC inspector reports on the roof covering and the roof structure. The standards of practice do not require the inspector to determine remaining life or insurability, or to recommend or provide engineering services, so the report is not a certification.",
      },
      {
        q: "Does a roof certification transfer to the buyer?",
        a: "Not on this firm's roof line. The letter is addressed to the recipient and purpose named at the start and is not reissued to someone else; a new inspection would be needed.",
      },
    ],
  },

  // ------------------------------------------------------------ roofs, post 4
  {
    slug: "option-period-inspection",
    title: "Option Period Inspections for Agents | 254 Engineering",
    h1: "Option period inspection: when an agent should bring in a roof or structural engineer",
    description:
      "In the Texas option period an engineer's roof or structural opinion has to land in time. See when to suggest one, how it is started online, and what arrives.",
    summary:
      "An agent has a few days to turn an inspection report into a decision. This is when an engineer's opinion helps that decision, how one is started online, and what the agent and the client receive.",
    eyebrow: "For agents",
    primaryKeyword: "option period inspection",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "The option period is the clock every inspection in a Texas resale runs against. The termination option in TREC form 20-18 gives the buyer an unrestricted right to terminate by notice within the time the contract sets, and the option fee is not refunded. Paragraph 7A lets the buyer choose inspectors licensed by TREC or otherwise permitted by law, so an engineer can be one of them, provided the opinion lands inside the window.",
      },
      { kind: "h2", text: "When to suggest an engineer" },
      {
        kind: "ul",
        items: [
          "The home inspector reports deflections or depressions in the roof surface related to the framing or decking, which rule 535.228(d) requires the inspector to report as deficient.",
          "The attic was not entered, or was inspected only from the hatch.",
          "The foundation section reports adverse performance. That is a foundation evaluation, covered in [foundation inspection cost](/insights/foundation-inspection-cost).",
          "A lender or a carrier has asked in writing for an engineer's opinion on the roof. TDI notes that an insurer inspects the roof when a policy is applied for and may charge more or refuse to insure on what it sees.",
          "The seller's notice marks previous structural or roof repair and nothing documents it.",
        ],
      },
      {
        kind: "p",
        text: "It is not worth suggesting when the roof is plainly worn out, nobody needs a sealed statement, and the decision is about price. A contractor's estimate answers that negotiation faster. The full picture of what the home inspection covers is in [the pre purchase home inspection guide](/insights/pre-purchase-home-inspection).",
      },
      { kind: "h2", text: "Starting a roof certification online" },
      {
        kind: "p",
        text: "The online path asks what the engineer needs before anybody is paid or sent out. It opens with one question, whether the roof can be reached safely on the day, and a no ends the online path and routes the job to a person. Then the address, because the county decides who can be sent and whether the coastal surcharge applies.",
      },
      {
        kind: "p",
        text: "Next are the engineer's own questions: what the letter is for, who it is addressed to, any date it is needed by, the building, the roof's age and covering, and whether there is an open insurance claim, a lawsuit, an active leak, an earlier adverse report or storm damage in the last year. A photograph of the front of the property is required, and the roofing invoice, permits and any earlier report are asked for where they exist. The price and the refund terms are shown before payment, and payment is taken on Stripe's page.",
      },
      {
        kind: "p",
        text: "A yes to any of the claim, lawsuit, leak, report or storm questions holds the job for the engineer to accept or decline before anybody is sent. A decline at that point is refunded in full, because nobody has attended.",
      },
      { kind: "h2", text: "Name the addressee at the start" },
      {
        kind: "p",
        text: "The letter is written for the purpose and the recipient entered at the start, and it is not reissued to a different recipient, purpose or date. If the buyer's lender must be named, name the lender. A second recipient later means a second inspection.",
      },
      { kind: "h2", text: "What the agent and the client receive" },
      {
        kind: "p",
        text: "Whoever completes the order receives the emails, so an agent who starts it for a client should decide first whose address goes on it. After payment an email confirms the order and carries a link to follow it. When the engineer seals the letter, a second email links to the order page, where the sealed letter downloads as a PDF. If the engineer requires repairs, the client receives a written repair list instead, and [the roof inspection process](/insights/roof-inspection-process) sets out each outcome.",
      },
      {
        kind: "p",
        text: [
          "How a lender or another agent will read the letter is in [the structural engineer report guide](/insights/structural-engineer-report), and what a roof certification can and cannot say in a sale is in [roof certification for a home sale](/insights/roof-certification-for-home-sale).",
          registrationStatement(),
        ]
          .filter(Boolean)
          .join(" "),
      },
      roofCta("With the addressee and the closing date in hand, the roof letter can be started in a few minutes."),
    ],
    sources: [
      rcite("trec2018", "The current edition of form 20-18 and its effective date of January 3, 2025."),
      rcite("trec2018Text", "The termination option and its non refundable fee, and the paragraph 7A text on inspectors."),
      rcite("trec228", "That a TREC inspector reports as deficient roof surface deflections related to the framing and decking, and reports the attic vantage point."),
      rcite("tdiRoof", "That an insurer inspects the roof on application and may charge more or refuse to insure based on what it sees."),
      rcite("prop5008", "The notice form's item on previous structural or roof repair."),
    ],
    faqs: [
      {
        q: "Can an engineer's roof letter be finished inside a short option period?",
        a: "No turnaround is promised. The visit is scheduled once a technician accepts the job, and the engineer's review begins when the evidence is complete, so the useful step is starting it the day the question arises.",
      },
      {
        q: "Who should the roof letter be addressed to?",
        a: "To whoever has to rely on it: the buyer, the lender or the carrier, exactly as it should appear. It is not reissued to another recipient afterwards.",
      },
      {
        q: "Can the agent start the order for the client?",
        a: "Yes. The emails go to the address entered on the order, so decide first whether the agent or the client should receive them.",
      },
    ],
  },

  // ------------------------------------------------------------ roofs, post 5
  {
    slug: "engineer-letter-for-roofers",
    title: "Engineer Letter for Roofers, Explained | 254 Engineering",
    h1: "Engineer letter for roofers: when a roofing job needs one, and what it costs",
    description:
      "When a roofer needs an engineer letter: an insurer request, a re-roof over an old layer, deck questions. See how a roofer starts one, the cost, and who gets it.",
    summary:
      "Most roofing jobs never need an engineer. The few that do share one feature: somebody other than the roofer and the owner has to rely on a written statement about the roof.",
    eyebrow: "For roofers",
    primaryKeyword: "engineer letter for roofers",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A roofer needs an engineer's letter when a third party will rely on a statement about the roof and wants a seal behind it. Under section 1001.301 of the Occupations Code the practice of engineering is restricted to license holders, and section 1001.401 requires a license holder's report on a Texas project to carry the seal. A contractor's own letter can be accurate and still not be the document that third party asked for.",
      },
      { kind: "h2", text: "When the insurer asks" },
      {
        kind: "p",
        text: "TDI tells homeowners that an insurer will inspect the roof when they apply and may charge more or refuse to insure on what it sees, and that as roofs age some companies switch to actual cash value. When a carrier asks for a condition letter on a roof a crew has just finished or repaired, the request is for an opinion on the roof as it stands, and that is the engineer's document.",
      },
      {
        kind: "p",
        text: "One request it does not cover. The roof certification protocol this firm works to declines a roof with an open insurance claim where the letter would become a tool in that claim, with a referral to an independent firm, and it declines any request for a conclusion decided in advance.",
      },
      { kind: "h2", text: "A re-roof over an existing layer" },
      {
        kind: "p",
        text: "Whether a new covering may go over an old one is a code question for the building official. The City of Arlington, which has adopted the 2021 codes, says in its re-roof bulletin that all existing layers must be removed down to the sheathing unless an exception applies, that a recover is not allowed where the roof already has two or more applications of any covering, and that a permit is required to re-roof.",
      },
      {
        kind: "p",
        text: "Where the open question is what is actually there, a layer count or the state of the deck, an engineer's documented observation can answer the factual half. It does not change what the adopted code allows.",
      },
      { kind: "h2", text: "When the deck is the question" },
      {
        kind: "p",
        text: "Rule 535.228(d) requires a home inspector to report deflections in the roof surface related to the framing and decking, and a sag found that way often reaches the roofer first. A roof certification records the deck material and thickness at the attic hatch and treats confirmed sag or delamination as a repair item. Whether the framing itself is adequate is a different question, answered by a sealed letter on a described structural element, set out on [the structural letters page](/services/structural-letters).",
      },
      { kind: "h2", text: "How a roofer starts one, and what it costs" },
      {
        kind: "p",
        text: [
          roofPriceSentence(),
          "A roofer can complete the online order with the homeowner's address and the recipient the carrier or lender expects. The emails, including the one carrying the sealed letter, go to the address on the order, and a reply to that email can redirect the letter if it should go elsewhere.",
        ].join(" "),
      },
      {
        kind: "p",
        text: "If the engineer requires repairs, the result is a written repair list that names each item and what closes it. The firm does not perform, supervise or recommend anyone for the repair, so the roofer's crew can do it, and a return visit verifies each item before the letter issues.",
      },
      { kind: "h2", text: "Rules a roofer cannot work around" },
      {
        kind: "p",
        text: "TDI sets out what a contractor may not do on an insured job. A contractor who provides or may provide work on a property may not act as a public adjuster on its claim or advertise that it will. A contractor may not waive, rebate or absorb the deductible, and a contract of $1,000 or more involving an insurance settlement must carry a notice that the policyholder pays it. What an engineer and an adjuster each decide after a storm is in [hail damage roof inspection](/insights/hail-damage-roof-inspection).",
      },
      { kind: "h2", text: "On the coast" },
      {
        kind: "p",
        text: [
          "Inside the catastrophe area a re-roof also needs the windstorm paperwork, which is covered step by step in [windstorm inspector rules for roofers](/insights/windstorm-inspection-for-roofers). A roof certification does not replace that certificate, as [roof certification versus WPI-8](/insights/roof-certification-vs-wpi-8) explains.",
          windstormAppointmentStatement(),
        ].join(" "),
      },
      roofCta("When a carrier or a lender has put the request in writing, send it with the order so the letter answers it."),
    ],
    sources: [
      rcite("occ1001_301", "That the practice of engineering is restricted to license holders."),
      rcite("occ1001_401", "That a license holder's report on a Texas project carries the seal."),
      rcite("tdiRoof", "That an insurer inspects the roof on application and may charge more or refuse to insure, and that some companies switch to actual cash value as roofs age."),
      rcite("arlingtonReroof", "Arlington's adoption of the 2021 codes, removal down to the sheathing, the bar on recovering two or more applications, and the re-roof permit."),
      rcite("trec228", "That a TREC inspector reports roof surface deflections related to the framing and decking as deficient."),
      rcite("tdiRoofLaw", "The public adjusting prohibition under Ins. Code § 4102.163, and the deductible rules and contract notice under Bus. & Com. Code § 27.02."),
    ],
    faqs: [
      {
        q: "Will the engineer write a letter supporting a hail claim?",
        a: "Not on this firm's roof line. It does no cause of loss work, and its protocol declines a roof with an open insurance claim where the letter would become a tool in that claim, with a referral to an independent firm.",
      },
      {
        q: "Does the engineer recommend a roofer for the repairs?",
        a: "No. The repair list names what must be closed, the repairs are done by others, and a return visit verifies each item.",
      },
      {
        q: "Who receives the sealed letter?",
        a: "The person whose email is on the order, by a link to the order page where the PDF downloads. The letter itself is addressed to the recipient named when the order was placed.",
      },
    ],
  },

  // ------------------------------------------------------------ roofs, post 6
  {
    slug: "hail-damage-roof-inspection",
    title: "Hail Damage Roof Inspection, Explained | 254 Engineering",
    h1: "Hail damage roof inspection: what an engineer records and what an adjuster decides",
    description:
      "After hail, an adjuster, an engineer, a roofer and an inspector may all look at one roof. See what each records and decides, and what none of them can promise.",
    summary:
      "Several people climb the same roof after a hailstorm, and only one of them works for the claim. Knowing who decides what keeps the record straight.",
    eyebrow: "Roofs",
    primaryKeyword: "hail damage roof inspection",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "After a hailstorm the same roof can be looked at by an adjuster, an engineer, a roofer and, if the house is for sale, a home inspector. Each records something different, and only the insurer decides what the policy pays. Nothing in this post is advice on a claim, and no inspection described here can promise its outcome.",
      },
      { kind: "h2", text: "The adjuster works the claim" },
      {
        kind: "p",
        text: "Section 4101.001 of the Insurance Code defines an adjuster as a person who investigates or adjusts losses on behalf of an insurer, and section 4101.051 says a person may not act as an adjuster in Texas without a license. The adjuster's visit is part of the insurer's handling of the claim.",
      },
      {
        kind: "p",
        text: "TDI's advice is to file the claim as soon as you can, be available for the adjuster's visit so the adjuster sees everything, take pictures and video of the damage, and keep a list of everyone you speak to at the insurance company. It also notes that a policy may pay for temporary repairs, and to save the receipts.",
      },
      { kind: "h2", text: "The engineer records conditions" },
      {
        kind: "p",
        text: "Section 4101.002 excludes from adjuster licensing a person employed only to furnish technical assistance to a licensed adjuster, and it names an engineer among them. An engineer an insurer brings in is technical help to the adjuster, and the decision on the claim stays with the insurer.",
      },
      {
        kind: "p",
        text: "What an engineer contributes is a record. Section 1001.003 of the Occupations Code includes evaluation in the practice of engineering, and section 1001.401 requires a license holder's report on a Texas project to carry the seal. A sound record shows each condition with its location, says what could not be observed and why, and states what the evidence supports and no more.",
      },
      { kind: "h2", text: "Where this firm's roof line stands" },
      {
        kind: "p",
        text: "254 Engineering's roof line does no forensic or cause of loss work. Its protocol declines a roof with an open insurance claim where the letter would become a tool in that claim, and refers the owner to an independent firm. The difference between an inspection and a forensic report on cause is set out in [inspection versus forensic report](/insights/inspection-vs-forensic-report).",
      },
      {
        kind: "p",
        text: "Storm damage reported in the last year, with no open claim, is a different case, for example after repairs and before a sale or a renewal. The engineer can then send the technician back to count hail impacts on a measured test square on each plane before deciding.",
      },
      { kind: "h2", text: "The roofer prices the work" },
      {
        kind: "p",
        text: "TDI's rules for contractors are plain. A contractor who provides or may provide work on the property may not act as a public adjuster on its claim, may not offer to waive or rebate the deductible, and must include a deductible notice in a contract of $1,000 or more involving an insurance settlement. The department adds that an insurer may ask for proof the deductible was paid, and advises getting more than one bid or estimate. A roofer's side of this is in [the guide for roofing contractors](/insights/engineer-letter-for-roofers).",
      },
      { kind: "h2", text: "The home inspector reports, with a stated limit" },
      {
        kind: "p",
        text: "In a sale, rule 535.228(c) requires the TREC inspector to report the roof covering, evidence of water penetration and previous repairs, and says the inspector is not required to identify latent hail damage. A clean roof section after a storm is not a finding that there was no hail damage.",
      },
      { kind: "h2", text: "Two things the policy decides, not the roof" },
      {
        kind: "p",
        text: "TDI notes that a wind and hail deductible may differ from the deductible for other damage, and that an insurer will not pay for a new roof just because it is old or worn. How the peril and the policy interact on the coast is in [hurricane damage and your insurance claim](/insights/hurricane-damage-insurance-claim).",
      },
      roofCta("If the claim is closed and a buyer, a lender or a carrier now needs a sealed opinion on the roof's present condition, that is the engineer's letter."),
    ],
    sources: [
      rcite("ins4101", "The definition of adjuster in § 4101.001, the license requirement in § 4101.051, and the technical assistance exclusion naming an engineer in § 4101.002(a)(3)."),
      rcite("tdiHail", "Filing as soon as you can, the adjuster's visit, pictures and a contact list, temporary repairs and receipts, deductible waivers, and getting more than one bid."),
      rcite("tdiRoofLaw", "The public adjusting prohibition under Ins. Code § 4102.163, the deductible rules under Bus. & Com. Code § 27.02, and proof of payment under Ins. Code ch. 707."),
      rcite("tdiRoof", "That a wind and hail deductible may differ, and that an insurer will not pay for a new roof just because it is old or worn."),
      rcite("occ1001_003", "That evaluation is part of the practice of engineering."),
      rcite("occ1001_401", "That a license holder's report on a Texas project carries the seal."),
      rcite("trec228", "The roof covering items a TREC inspector reports, and that latent hail damage is not required."),
    ],
    faqs: [
      {
        q: "Should I hire an engineer before the adjuster comes?",
        a: "TDI's advice is to file the claim as soon as you can and be available for the adjuster's visit. This firm's roof line is not part of a claim and declines a roof with an open claim where its letter would become a tool in that claim.",
      },
      {
        q: "Can my roofer handle the insurance claim for me?",
        a: "TDI states that a contractor who provides or may provide work on the property may not act as a public adjuster on its claim, under Insurance Code section 4102.163.",
      },
      {
        q: "Does an engineer's report decide whether insurance pays?",
        a: "No. The insurer decides under the policy. An engineer furnishing technical assistance to a licensed adjuster is excluded from adjuster licensing by section 4101.002, which is a sign of where the decision sits.",
      },
    ],
  },

  // ------------------------------------------------------------ roofs, post 7
  {
    slug: "roof-inspection-process",
    title: "Roof Inspection Process, Step by Step | 254 Engineering",
    h1: "Roof inspection process, from the online order to the sealed letter",
    description:
      "What happens after a roof certification is started online: questions, payment, the technician's visit, the engineer's review and the sealed PDF. Read each step.",
    summary:
      "Every step between paying for a roof certification and downloading the sealed letter, as the platform actually runs it, with nothing promised that the platform does not do.",
    eyebrow: "Roofs",
    primaryKeyword: "roof inspection process",
    datePublished: ROOFS_SECTION_DATE,
    dateModified: ROOFS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "This is the roof certification as the platform runs it, step by step. No step carries a promised time, because none is published; the visit is scheduled once a technician accepts the job, and the engineer's review begins when the evidence is complete. How the same method applies across every line is on [the process page](/process).",
      },
      { kind: "h2", text: "Before payment: whether the job can be taken" },
      {
        kind: "p",
        text: "The first question is whether the roof can be reached safely on the day. A no ends the online path and passes the job to a person. The address comes next, because the county decides who can be sent and whether the coastal surcharge applies.",
      },
      {
        kind: "p",
        text: "Then the engineer's own questions: the purpose of the letter and who it is addressed to, any date it is needed by, the building and its stories, the roof's age and covering, attic access, steepness, and whether anyone lives there. A photograph of the front of the property is required. An earlier adverse report must be uploaded if one exists, and the roofing invoice, permits, photographs of problems and any earlier inspection report are asked for where they exist.",
      },
      {
        kind: "p",
        text: "Five questions are flags: an open insurance claim, a lawsuit, an active leak, an earlier adverse report, and storm damage in the last year. A yes to any of them holds the job for the engineer to accept or decline before anybody is sent out.",
      },
      { kind: "h2", text: "Price and terms, then payment" },
      {
        kind: "p",
        text: ROOF_PRICE
          ? `The price is ${ROOF_PRICE}, and the coastal surcharge appears as its own line on the payment page when the address is in one of those counties. The terms shown before payment are these, word for word:`
          : "The price and any coastal surcharge are shown before payment, and the terms shown are these, word for word:",
      },
      ...(ROOF_REFUND_TERMS.length > 0 ? [{ kind: "ul", items: ROOF_REFUND_TERMS } as Block] : []),
      {
        kind: "p",
        text: "Payment is taken on Stripe's hosted page, so card details never reach this site. An email then confirms the order and carries a link to follow it.",
      },
      { kind: "h2", text: "The technician's visit" },
      {
        kind: "p",
        text: "The technician is trained on the engineer's protocol and works its checklist in the field application, which will not accept an incomplete submission. Each item is photographed at least twice, once wide to place it on the structure and once close to show its condition, with a ruler in frame where a dimension matters. On every roof plane the worst condition is the one photographed, not a flattering sample, and an item the technician cannot see is marked not observed with the reason written down. Each photograph carries its location, the device's time, the server's time at sync, and the difference between them.",
      },
      {
        kind: "p",
        text: "A roof that cannot be walked safely is not walked. The engineer then decides from what was gathered whether a determination is possible or the job needs lift or other access equipment, which is one of the things the price list says can change the price.",
      },
      { kind: "h2", text: "The engineer's review" },
      {
        kind: "p",
        text: "The engineer reviews the evidence package and records one of five determinations: pass, revise, repairs required, site revisit, or decline, along with the checklist items and photographs relied on. A package that does not let the engineer verify an item goes back for revision or a return visit, and a re-inspection made necessary by an incomplete package is not charged to the customer.",
      },
      {
        kind: "p",
        text: "Repairs required produces a written repair list naming each item and what closes it. Repairs are done by others, a return visit verifies each item, and no letter issues while any item is open.",
      },
      { kind: "h2", text: "The sealed letter" },
      {
        kind: "p",
        text: "On a pass the engineer seals the letter electronically from his own account, with a fresh second factor each time. Rule 137.35 permits an engineer to use an electronic seal and signature and requires the engineer to keep them secure, and under rule 137.33 the engineer who seals takes full professional responsibility. The sealed file is hashed and locked when it is sealed, and it is checked against that hash every time it is downloaded.",
      },
      {
        kind: "p",
        text: [
          "An email then says the letter is sealed and links to the order page, where it downloads as a PDF; replying to that email redirects it if it should go elsewhere. What the letter states and what it leaves out are compared with the coastal certificate in [roof certification versus WPI-8](/insights/roof-certification-vs-wpi-8), and how a lender reads it is in [the structural engineer report guide](/insights/structural-engineer-report).",
          registrationStatement(),
        ]
          .filter(Boolean)
          .join(" "),
      },
      roofCta("The fee and what moves it are compared with the alternatives in [roof inspection cost](/insights/roof-inspection-cost)."),
    ],
    sources: [
      rcite("rule137_35", "That an engineer may create an electronic seal and signature for electronically formatted work and must keep them secure."),
      rcite("rule137_33", "That on sealing, the engineer takes full professional responsibility for the work."),
      rcite("occ1001_401", "That a license holder's report on a Texas project carries the seal."),
    ],
    faqs: [
      {
        q: "How long does a roof certification take?",
        a: "No turnaround is published. The visit is scheduled once a technician accepts the job, and the engineer's review begins when the evidence is complete.",
      },
      {
        q: "What happens if the roof cannot be walked?",
        a: "The technician does not walk it. The engineer decides from what was gathered whether a determination is possible, or whether the job needs lift or other access equipment, which can change the price.",
      },
      {
        q: "Where does the sealed letter arrive?",
        a: "On the order page, as a PDF, linked from an email to the address on the order. Replying to that email redirects it if it should go elsewhere.",
      },
    ],
  },
];
