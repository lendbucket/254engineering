/**
 * The firm's office, as a page. Operator ruling, 2026-10-29.
 *
 * WHY THIS PAGE EXISTS BESIDE /corpus-christi
 * -------------------------------------------
 * A location page answers "where are you", which is the question a Google
 * Business Profile, a LocalBusiness node, and a procurement officer checking a
 * bidder's principal place of business all ask. The firm's office moved to San
 * Antonio on 2026-10-29, and Robert ruled (22:12 Central) that this page is
 * added alongside /corpus-christi rather than in place of it: Corpus Christi
 * stays live as a highlighted market until its address is set. The rule is in
 * CLAUDE.md section 2. The full reasoning for location pages, and for why they
 * are not city geo pages, is at the top of src/content/location.ts.
 *
 * IT MUST NOT REPEAT THE SAN ANTONIO REGION PAGE
 * ----------------------------------------------
 * /coverage/san-antonio already covers the Balcones Escarpment, the soils on
 * either side of it, the flood hazard, and the recharge zone across thirteen
 * counties. The find-and-replace test applies inside this site as hard as it
 * does across the three brands, so this page carries only what is true of the
 * city's own building department and would be false of New Braunfels or
 * Boerne, and it links to the region page for the rest.
 *
 * SOURCING. Every specific below was read in full on 2026-10-29. A claim whose
 * source could not be read was left out, on Robert's rule of 22:12: "anything
 * not read is not cited."
 *
 *   [record]   City of San Antonio, City Code Chapter 10, Building-Related
 *              Codes, effective May 1, 2025, Ord. No. 2025-01-30-0075, adopted
 *              January 30, 2025, which adopts the 2024 International Building
 *              Code and International Residential Code, among others, "and
 *              their respective local amendments".
 *              https://docsonline.sanantonio.gov/DSDUploads/2024Ch10Building-RelatedCodesFinal.pdf
 *              The edition is named here in a source note only. On the page it
 *              is described generally, under the rule at the top of location.ts:
 *              the city readopts on its own schedule, and a page that names an
 *              edition is wrong on a timetable it does not control.
 *   [record]   City of San Antonio Development Services, Information Bulletin
 *              224, "Foundation Utility Trench Cuts", July 1, 2016, revised
 *              November 12, 2024. Its standard form letter asks for the
 *              property's legal description "from Bexar Appraisal District".
 *              https://docsonline.sanantonio.gov/FileUploads/DSD/IB224.pdf
 *              It is a trench cut bulletin, not a foundation repair bulletin,
 *              and is described as what it is. No San Antonio foundation repair
 *              permit rule was found, so none is stated.
 *   [rule]     TCEQ, Edwards Aquifer Protection Program workflow: "All
 *              regulated activities on the recharge zone must have an approved
 *              plan and associated documents prior to construction", and a site
 *              partly on the recharge zone is treated as if the entire site
 *              were on it.
 *              https://www.tceq.texas.gov/permitting/eapp/eapp-workflow.html
 *   [rule]     30 Texas Administrative Code chapter 213, subchapter A, "Edwards
 *              Aquifer in Medina, Bexar, Comal, Kinney, Uvalde, Hays, Travis,
 *              and Williamson Counties".
 *              https://www.law.cornell.edu/regulations/texas/30-Tex-Admin-Code-SS-213-1
 *
 * NOT CITED, BECAUSE NOT READ: the Bexar County soil survey (it timed out), the
 * county courthouse pages, the Edwards Aquifer map viewer, and TCEQ's regional
 * filings. Nothing on this page places a particular soil series under the city
 * or names the county seat.
 *
 * NO PRESENT TENSE SERVICE CLAIMS ANYWHERE IN THIS FILE. What the firm is built
 * to do is written as what it is built to do, and the page reads the gate for
 * anything about taking work. scripts/voice-audit.mjs enforces that.
 */

import { business } from "@/config/business";

export const sanAntonio = {
  slug: "san-antonio",
  city: "San Antonio",
  county: "Bexar County",

  h1: "San Antonio Engineering Firm: 254 Engineering's Office",
  title: "San Antonio Texas Engineering Firm Office | 254 Engineering",
  description:
    `Where ${business.name} keeps its office in San Antonio, its hours, and what the city's code, trench cut letter and recharge zone rule ask. Call or write.`,
  summary:
    `${business.name} keeps its office in San Antonio, in Bexar County, and is built to cover all 254 Texas counties from there.`,

  /** Why the office is a fact worth stating rather than filler. */
  position: [
    `${business.name} is named for the 254 counties of Texas and is built to cover all of them. San Antonio is where the firm keeps its one open office, so it is the address on the firm's record and the place its published hours are kept.`,
    "An office is a fact a reader can check, which is why it is stated plainly. The street, the hours, and the telephone below are read from one source on this site, the same one the footer and the contact page print, so the three cannot disagree with each other.",
  ],

  /** The city's own building department, which is not the region's. */
  code: [
    "The City of San Antonio adopts the International Code Council's building and residential codes through Chapter 10 of its City Code, together with its own local amendments, and readopts them on its own cycle. Work inside the city limits is permitted and inspected by the city's Development Services Department against that chapter.",
    "That is why this page does not name an edition. The edition that governs a project is the one the city has adopted on the day the permit is issued, and the place to confirm it is the city's own chapter, not a page that may be a cycle behind.",
  ],

  /** IB224, described as what it is. */
  trenchCuts: [
    "Development Services publishes a bulletin for one of the most common interior jobs in an older slab home: cutting and replacing sections of a concrete floor so that plumbing or electrical lines can run beneath it. Information Bulletin 224 says that after the plumbing or electrical inspection, the trenched area is inspected before the floor is poured back, covering the soil placed in the trench, the vapor barrier, and the reinforcing steel.",
    "The bulletin offers an alternative to scheduling the city's building inspector. The customer may hire a qualified design professional to observe that work and submit a letter, written on the city's standard form, stating that the construction was performed satisfactorily. The letter is uploaded to the permit's documents, and the form identifies the property by its legal description from the Bexar Appraisal District.",
    "If any primary structural component is damaged while the trench is open, the bulletin requires a design professional's repair recommendation to go to the city before the work continues and before final approval. A trench cut is ordinary work, but a cut through a grade beam is not, and the bulletin draws that line.",
  ],

  /** The recharge zone rule, kept to what the rule itself says. */
  rechargeZone: [
    "Bexar County is one of the eight counties named in the Texas Commission on Environmental Quality's Edwards Aquifer rules, 30 Texas Administrative Code chapter 213. Under the commission's program, regulated activities on the recharge zone need an approved plan before construction begins.",
    "One provision changes how a site is read. A site that lies partly on the recharge zone is treated as if the whole site were on it, so a line on a map crossing the back of a lot governs the front of it too. Where that line falls, and what else the region's geology asks of a foundation, is set out on the region page.",
  ],

  /**
   * What the firm is built to do, in the permitted tense. The page appends the
   * gate's own sentences while it reads prelaunch.
   */
  capability: [
    "The firm is built around the documents a San Antonio permit or closing turns on: foundation evaluation where clay moves a slab, the design professional's observation letter the city accepts for a trench cut, structural letters a permit asks for, and plans prepared for the city's review.",
  ],
} as const;
