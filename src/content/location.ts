/**
 * Corpus Christi, as a highlighted market.
 *
 * WHAT THIS PAGE IS NOW. Robert's ruling, 13:11 and 22:12 Central 2026-10-29.
 * --------------------------------------------------------------------------
 * The firm's office moved to San Antonio. This page is NOT replaced or
 * redirected: it stays live, in the sitemap, and linked from the main
 * navigation, the home page and /coverage, presented as the firm serving
 * Corpus Christi and the Coastal Bend. Until Robert gives a Corpus Christi
 * street address it prints none, claims no office here, and carries no
 * Corpus Christi location in any schema. The firm's address is on /contact,
 * /press, the footer and the Organization node, from src/config/contact.ts.
 *
 * "Serves" is a present tense claim, so the verb follows the gate through
 * `servesVerb()` below rather than being typed: "serves" once the gate reads
 * trading, "is built to serve" in prelaunch. launch-audit renders both.
 *
 * The find-and-replace test still applies. This page keeps only what is false
 * of Victoria or Kingsville, so it is a market page and not a doorway.
 *
 * THE RULE THIS REPLACES, KEPT FOR ITS REASONING
 * ----------------------------------------------
 * It read: "WHY A CITY PAGE EXISTS ON A SITE WITH NO CITY PAGES. The standing
 * rule is that geo on this brand is regional, not municipal, and that rule
 * holds. This is not a geo page. It is the entity's location page: the one
 * place the firm actually sits, which is a different kind of object from a page
 * minted for a city the firm merely covers. The distinction is testable rather
 * than rhetorical. A geo page answers 'do you work here'. This one answers
 * 'where are you', which is the question a Google Business Profile, a
 * LocalBusiness node, and a procurement officer checking a bidder's principal
 * place of business all ask. There is exactly one of these pages and there
 * will only ever be one, because the firm has one address. The day it is
 * written twice for two cities is the day it has become the doorway pattern it
 * is currently not." The office moved on 2026-10-29, and the operator ruled
 * that Corpus Christi stays highlighted as a market rather than redirected.
 *
 * IT MUST NOT REPEAT THE COASTAL BEND REGION PAGE
 * -----------------------------------------------
 * /coverage/coastal-bend already covers wind, soils, and permitting across
 * eighteen counties, and the find-and-replace test applies inside this site as
 * hard as it does across the three brands. So this page is deliberately narrow:
 * what is true of this city specifically and would be false of Victoria or
 * Kingsville. The barrier island city limits, the bluff, the port, and Celia
 * rather than Harvey as the local reference event are all facts that do not
 * survive being moved to another Coastal Bend city, which is the test.
 *
 * SOURCING
 * --------
 * Every specific below is either a matter of public record that a reader can
 * confirm without a subscription, or it is stated generally. Marked inline:
 *
 *   [statute]  Nueces County is one of the fourteen seacoast counties in the TDI
 *              designated catastrophe area. Texas Insurance Code chapter 2210.
 *              The same list is already cited on /services/windstorm-wpi-8.
 *   [record]   Corpus Christi is the seat of Nueces County, and its city limits
 *              extend onto Mustang and Padre Islands. City and county records.
 *   [record]   Hurricane Celia struck Corpus Christi directly in August 1970.
 *   [record]   The Port of Corpus Christi is among the largest United States
 *              ports by tonnage and is a major crude export gateway.
 *   [general]  Adopted code editions are described generally and never named.
 *              The city amends and readopts on its own schedule, and a page that
 *              names an edition is wrong on a timetable it does not control.
 *   [general]  Design wind speeds are described comparatively, never as numbers.
 *              The number that governs a specific structure comes from the
 *              current standard and the site's exposure category, not from here.
 *
 * NO PRESENT TENSE SERVICE CLAIMS IN PRELAUNCH. Everything the firm is built
 * to do is written as what it is built to do, and the one present tense verb
 * reads the gate. scripts/voice-audit.mjs enforces that mechanically.
 */

import { firmName, isTrading } from "@/lib/launch";
import { contact } from "@/config/contact";

/**
 * THE VERB FOR "THE FIRM SERVES THIS MARKET", READ OFF THE GATE. Robert,
 * 22:12 Central 2026-10-29: "serves" only once the gate reads trading, "is
 * built to serve" in prelaunch. A function rather than a constant, because a
 * module level value is read once (CLAUDE.md section 6). /windstorm reads it
 * too, so the two pages cannot disagree.
 */
export function servesVerb(): "serves" | "is built to serve" {
  return isTrading() ? "serves" : "is built to serve";
}

export const location = {
  slug: "corpus-christi",
  city: "Corpus Christi",
  county: "Nueces County",

  h1: "Corpus Christi Engineering for the Coastal Bend",
  title: "Corpus Christi Engineering, Coastal Bend | 254 Engineering",
  description:
    "Corpus Christi and the Coastal Bend: the barrier islands, the bluff, Celia, and what building on this coast asks of a structure. See the coverage map.",
  get summary(): string {
    return `Corpus Christi sits inside the windstorm catastrophe area, in a city whose limits reach from a limestone bluff to the open Gulf side of two barrier islands, and the firm ${servesVerb()} it from ${contact.city}.`;
  },

  /** Why this market is called out rather than left to the region page. */
  get position(): readonly string[] {
    return [
      `${firmName()} is named for the 254 counties of Texas and is built to cover all of them. Corpus Christi and the Coastal Bend are a market it ${isTrading() ? "serves now" : "is built to serve"}, and that is not an incidental detail. The Coastal Bend is where the most demanding version of the work sits, because every new building and reroof inside the catastrophe area answers to the windstorm rules before it can be insured.`,
      "Corpus Christi is the seat of Nueces County, which is one of the fourteen Texas seacoast counties inside the catastrophe area designated by the Texas Department of Insurance. Inside that line, new construction and reroofing require [windstorm inspection and a WPI-8 certificate of compliance](/windstorm) before windstorm coverage can be written through the Texas Windstorm Insurance Association. That requirement is the organizing fact of construction here.",
    ];
  },

  /**
   * The genuinely city specific part. None of this is true of Victoria, and
   * that is the point.
   */
  jurisdiction: [
    "The city limits are unusual in a way that matters to structural work. Corpus Christi extends across the bay onto Mustang Island and onto Padre Island, so a single municipal jurisdiction contains both a downtown on a limestone bluff well back from the water and residential construction fronting the open Gulf. Those are not the same wind environment, they are not the same flood environment, and they are not the same durability environment, but they are the same building department and the same permit process.",
    "That gap between one jurisdiction and several exposures is where coastal projects go wrong. Exposure category is a property of the site, not of the city, and a roof attachment schedule that is correct three miles inland behind the bluff is not the schedule the same building needs on the island. A wind design that was copied across the bay is the kind of thing that survives inspection and then does not survive a storm.",
    "Flood elevation regulation runs alongside all of it. Much of the developed shoreline sits in mapped flood zones, and portions of the barrier islands fall under the Coastal Barrier Resources Act, which restricts federally backed lending and therefore changes which certifications a loan file needs before it can close.",
  ],

  /** The city's own reference event, which is not the region's. */
  storms: [
    "The Coastal Bend's recent reference storm is Harvey, which came ashore near Rockport in 2017. Corpus Christi's own reference event is older and closer. Hurricane Celia moved directly over the city in August 1970 and remains the storm against which local construction memory is measured.",
    "The practical residue of both is the same lesson from different directions. Wind damage concentrates at the roof edge, at openings, and at the connections nobody can see once the building is finished. A structure that performs is one where the load path from roof deck to foundation was designed as a path rather than assembled as a stack, and that is a documentation problem as much as a construction one.",
  ],

  /** Ground conditions, kept to what is specific rather than regional boilerplate. */
  ground: [
    "The ground under the city changes character over short distances. The bluff and the older inland neighborhoods sit on clays with real shrink swell potential, the Victoria and Orelia soils that move seasonally enough to matter to a slab. Move toward the bays and the problem inverts into sandy and silty deposits with a shallow water table, where bearing capacity and buoyancy replace expansion as the governing question.",
    "Salt is the constant across all of it. Within a few miles of open water, concrete cover, reinforcement corrosion, and connector coatings are specified more conservatively than the same details would be inland, because the failure mode is slow and invisible until it is structural.",
  ],

  /**
   * What the firm is built to do, in the permitted tense. Every verb here is
   * about capability rather than a service being performed today.
   */
  capability: [
    "The firm is built around the documents that coastal transactions actually turn on: windstorm certification for construction inside the catastrophe area, roof condition and certification work for lenders and carriers, foundation evaluation where the soils argue with the slab, and repair specifications written so that damage can be scoped, bid, and permitted rather than argued about.",
    "All of it is designed to be delivered under a licensed Texas Professional Engineer in responsible charge.",
  ],
};
