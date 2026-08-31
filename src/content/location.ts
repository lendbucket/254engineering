/**
 * The firm's own place, as a page.
 *
 * WHY A CITY PAGE EXISTS ON A SITE WITH NO CITY PAGES
 * ---------------------------------------------------
 * The standing rule is that geo on this brand is regional, not municipal, and
 * that rule holds. This is not a geo page. It is the entity's location page: the
 * one place the firm actually sits, which is a different kind of object from a
 * page minted for a city the firm merely covers.
 *
 * The distinction is testable rather than rhetorical. A geo page answers "do you
 * work here". This one answers "where are you", which is the question a Google
 * Business Profile, a LocalBusiness node, and a procurement officer checking a
 * bidder's principal place of business all ask. There is exactly one of these
 * pages and there will only ever be one, because the firm has one address. The
 * day it is written twice for two cities is the day it has become the doorway
 * pattern it is currently not.
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
 * NO PRESENT TENSE SERVICE CLAIMS ANYWHERE IN THIS FILE. The registration is
 * pending. Everything the firm is built to do is written as what it is built to
 * do. scripts/voice-audit.mjs enforces that mechanically.
 */

export const location = {
  slug: "corpus-christi",
  city: "Corpus Christi",
  county: "Nueces County",

  h1: "A Texas Engineering Firm Based in Corpus Christi",
  title: "Corpus Christi Texas Engineering Firm | 254 Engineering",
  description:
    "Where 254 Engineering Services is based, and what building on the Corpus Christi coast asks of a structure. See the coverage map and join the waitlist.",
  summary:
    "The firm is based in Corpus Christi, inside the windstorm catastrophe area, in a city whose limits reach from a limestone bluff to the open Gulf side of two barrier islands.",

  /** Why the firm's own position is a fact worth stating rather than filler. */
  position: [
    "254 Engineering Services is named for the 254 counties of Texas and is built to cover all of them. It is based in Corpus Christi, and that is not an incidental detail about where the mail goes. The Coastal Bend is where the most demanding version of the work sits, and a firm headquartered inside the catastrophe area is answering to the same rules as the structures it is built to certify.",
    "Corpus Christi is the seat of Nueces County, which is one of the fourteen Texas seacoast counties inside the catastrophe area designated by the Texas Department of Insurance. Inside that line, new construction and reroofing require windstorm inspection and a WPI-8 certificate of compliance before windstorm coverage can be written through the Texas Windstorm Insurance Association. That requirement is the organizing fact of construction here, and it applies to the firm's own city.",
  ],

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
    "The firm is built around the documents that coastal transactions actually turn on: windstorm certification for construction inside the catastrophe area, roof condition and certification work for lenders and carriers, foundation evaluation where the soils argue with the slab, forensic investigation after a named storm, and repair specifications written so that damage can be scoped, bid, and permitted rather than argued about.",
    "All of it is designed to be delivered under a licensed Texas Professional Engineer in responsible charge. Until the firm's registration with the Texas Board of Professional Engineers and Land Surveyors is issued and a Professional Engineer is in responsible charge, none of it is offered or performed, and no page on this site says otherwise.",
  ],
} as const;
