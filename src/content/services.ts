/**
 * The service lines, and every word of copy that describes them.
 *
 * WHY THE COPY IS DESCRIPTIVE AND NOT PROMISSORY
 * ----------------------------------------------
 * Read the `what`, `deliverable`, and `faqs` fields and notice what is missing:
 * there is no sentence in this file that says the firm is currently performing
 * any of it. That is deliberate and it is a compliance constraint, not a style
 * choice. The firm's registration with the Texas Board of Professional Engineers
 * and Land Surveyors is pending, and until it is active the site may not
 * represent that engineering services are being offered or performed.
 *
 * So the copy describes the service, the standard, and the deliverable. The
 * firm's present-tense relationship to it lives in one component,
 * ServiceOfferBlock, which reads src/lib/launch.ts and renders either a waitlist
 * or an order path. When the registration lands, one environment variable moves
 * every page and not a line of this file needs revisiting.
 *
 * `turnaround` is qualitative everywhere, for the same reason a firm does not
 * print a number it has not yet measured across a statewide technician network.
 */

export type Faq = { q: string; a: string };

export type Service = {
  slug: string;
  /** Full name. Card titles, nav, schema. */
  name: string;
  /** Shorter form for breadcrumbs and tight lists. */
  shortName: string;
  h1: string;
  /** Under 58 characters, keyword leading. */
  title: string;
  /** 140 to 155 characters. */
  description: string;
  /** One or two sentences for the index card. */
  summary: string;
  what: string[];
  whoOrders: string[];
  deliverable: string[];
  turnaround: string;
  faqs: Faq[];
};

export const services: Service[] = [
  {
    slug: "roof-inspections",
    name: "Roof Inspections and Certifications",
    shortName: "Roof Certifications",
    h1: "Roof Inspections and Certifications in Texas",
    title: "Roof Inspections and Certifications in Texas",
    description:
      "A roof certification is a sealed engineering opinion on condition and remaining service life. What the inspection covers and who orders one in Texas.",
    summary:
      "A sealed engineering opinion on the condition of a roof and the service life it can reasonably be expected to have left, issued after a documented field inspection.",
    what: [
      "A roof certification is a written opinion, signed and sealed by a licensed Texas Professional Engineer, on the present condition of a roof covering and the structure beneath it. It follows a field inspection carried out to a written protocol, and it states what was observed, what those observations mean, and how much service life the roof can reasonably be expected to have left.",
      "The inspection is non destructive. A technician documents the covering type and how it was installed, flashing and penetrations, drainage and ponding, the condition of the decking where it can be observed, and any evidence of prior repair or storm damage. Photographs are keyed to locations, so the reviewing engineer can see what the technician saw rather than take a conclusion on trust.",
      "The engineer is the author of the opinion. Field work gathers evidence. The licensed engineer in responsible charge reviews that evidence, forms the opinion, and applies the seal. Keeping those two roles distinct is what allows one consistent standard to hold across a state with 254 counties in it.",
    ],
    whoOrders: [
      "Lenders and loan officers who need remaining service life stated before a file can close",
      "Insurance carriers and agents underwriting or renewing a property policy",
      "Buyers and sellers resolving a roof question raised by a general home inspection",
      "Property managers and commercial owners documenting the condition of a portfolio",
      "Roofing contractors whose customer has been asked for an engineer's opinion",
    ],
    deliverable: [
      "A signed and sealed letter on firm letterhead, addressed to the party who needs it, stating the scope of the inspection, the conditions observed, the opinion of remaining service life, and the limitations that opinion carries.",
      "A photographic record keyed to the observations, so an underwriter or a loan officer can read the letter without arranging a second visit.",
      "A PDF suitable for upload to a loan file, a carrier portal, or a closing package.",
    ],
    turnaround:
      "Roof certifications are ordinarily reviewed and sealed within a few business days of the field inspection. Where a closing date requires it, expedited review is available and is agreed before the inspection is scheduled rather than after.",
    faqs: [
      {
        q: "What is the difference between a roof inspection and a roof certification?",
        a: "The inspection is the field work. The certification is the sealed engineering opinion that follows it. A roofing contractor can inspect a roof and give you a quote. Only a licensed Professional Engineer can issue a sealed opinion on condition and expected remaining service life, and that seal is usually what a lender or a carrier is actually asking for.",
      },
      {
        q: "How long is a roof certification good for?",
        a: "It states a condition observed on a particular date, so it does not expire on its own. Most lenders and carriers treat one as current for six to twelve months. A significant storm between the inspection and the closing will normally prompt a fresh look regardless of the date on the letter.",
      },
      {
        q: "Does a certification guarantee the roof will last that long?",
        a: "No. It is a professional opinion of remaining service life based on what was observed, stated together with its limitations. An engineer cannot warrant a roof, and a document that claims to warrant one is not an engineering opinion.",
      },
      {
        q: "Does the inspection include the attic?",
        a: "Where the underside of the deck can be reached safely it is examined, because it carries the clearest evidence of active leakage. Where it cannot be reached, the letter says so and states the opinion from what could be observed. What the inspection could not see belongs in the letter, not out of it.",
      },
      {
        q: "Is the roof walked?",
        a: "Where slope, covering type, and conditions allow it to be walked safely. Where they do not, the inspection is made from ladder level and with aerial imagery, and the letter states the method used. Walking a brittle tile roof to satisfy a convention damages the thing being inspected.",
      },
    ],
  },

  {
    slug: "windstorm-wpi-8",
    name: "Windstorm WPI-8 Certifications",
    shortName: "Windstorm WPI-8",
    h1: "Windstorm WPI-8 Certifications in Texas",
    title: "Windstorm WPI-8 Certifications in Texas",
    description:
      "How WPI-8 windstorm certification works on the Texas coast, which counties require one, and what a TDI appointed engineer inspects before submission.",
    summary:
      "The windstorm certificate of compliance required in the Texas coastal catastrophe area, inspected and submitted by an engineer appointed by the Texas Department of Insurance.",
    what: [
      "The WPI-8 is the certificate of compliance issued by the Texas Department of Insurance for construction inside the designated catastrophe area along the Texas coast. It records that the work was inspected and found to comply with the windstorm building code applicable where the structure stands, and it is the document an insurer looks for before windstorm coverage is written through the Texas Windstorm Insurance Association.",
      "There are two routes to one. The Department may inspect the work itself. The alternative, and in practice the common one, is inspection and certification by a Texas licensed Professional Engineer appointed by the Department for windstorm inspections, who documents compliance on form WPI-2 so that the Department can issue the WPI-8.",
      "The inspection is sequenced with construction rather than performed once at the end. Roof deck attachment, sheathing, framing connections, and opening protection all have to be observed before they are covered up. That is the single most common reason a coastal project cannot be certified later: not that the work was done badly, but that nobody was there to see it while it could still be seen.",
    ],
    whoOrders: [
      "Builders and general contractors working inside the catastrophe area",
      "Roofing contractors reroofing a coastal structure, which is itself a certifiable improvement",
      "Owners who need windstorm coverage through the Texas Windstorm Insurance Association",
      "Buyers and sellers who have found that a prior improvement was never certified",
      "Insurance agents assembling what a carrier needs before binding coverage",
    ],
    deliverable: [
      "Field inspections at the stages the code requires, documented with photographs and measurements taken while the work is open to view.",
      "Form WPI-2 prepared and submitted to the Texas Department of Insurance by the appointed engineer, with the supporting record attached.",
      "The WPI-8 certificate of compliance, which is issued by the Department itself on the strength of that submission.",
    ],
    turnaround:
      "Field inspections are scheduled around the construction sequence rather than around a queue, and the WPI-2 is ordinarily submitted within a few business days of the final inspection. The WPI-8 itself is issued by the Texas Department of Insurance on the Department's own timeline.",
    faqs: [
      {
        q: "Which Texas counties require a WPI-8?",
        a: "The designated catastrophe area covers the fourteen Texas seacoast counties, Aransas, Brazoria, Calhoun, Cameron, Chambers, Galveston, Jefferson, Kenedy, Kleberg, Matagorda, Nueces, Refugio, San Patricio, and Willacy, together with the part of Harris County east of State Highway 146. Structures outside that area do not need one.",
      },
      {
        q: "Is the WPI-8 the same thing as the engineer's letter?",
        a: "No, and the difference matters at closing. The appointed engineer submits form WPI-2. The Texas Department of Insurance issues the WPI-8 on the strength of it. The two are spoken about interchangeably in the field, but the document a title company or a carrier needs is the one issued by the Department.",
      },
      {
        q: "Can a WPI-8 be obtained after the work is already finished?",
        a: "Not straightforwardly. The certificate rests on inspections made while the work was open to view. Where a structure was completed without inspection, an appointed engineer may be able to evaluate it after the fact through a separate and more involved process, and in some cases the only remedy is to expose the work again.",
      },
      {
        q: "Does a WPI-8 transfer to a new owner?",
        a: "Yes. It attaches to the structure and to the improvement it certified rather than to the person who owned it at the time, and it remains on file with the Department. A buyer can ask for the certificate history on a coastal property before closing.",
      },
      {
        q: "What happens if required opening protection was never installed?",
        a: "The inspection records what is present. Where an element the applicable code requires is absent, it cannot be certified, and the certificate does not issue until the work complies. An engineer who certifies around a missing element is risking an appointment that took years to obtain.",
      },
    ],
  },

  {
    slug: "foundation-inspections",
    name: "Foundation Inspections and Certifications",
    shortName: "Foundation Certifications",
    h1: "Foundation Inspections and Certifications in Texas",
    title: "Foundation Inspections and Certifications, Texas",
    description:
      "A sealed engineering opinion on how a foundation is performing, based on floor elevation measurement and a documented inspection of the structure and site.",
    summary:
      "A sealed engineering opinion on how a foundation is performing, supported by floor elevation measurement and a documented inspection of the structure, the drainage, and the site.",
    what: [
      "A foundation certification is an engineer's opinion on how a foundation is performing, not a pass or fail stamp. It rests on measurement: relative floor elevations taken on a grid across the slab or the framed floor, so that movement can be described in tenths of an inch rather than in adjectives.",
      "Much of Texas sits on expansive clay. Soils across the Blackland Prairie, the Houston and Beaumont clays of the upper coast, and the Taylor and Del Rio formations behind the Balcones Escarpment change volume with moisture, and a slab that moves seasonally on those soils is behaving the way the ground it sits on behaves. Reading that correctly is the difference between a report that causes a sale to fall through and one that explains what is actually happening.",
      "The inspection records the elevation survey, the distress evident in the structure and where it sits relative to the measured movement, the condition of drainage and grading around the perimeter, tree proximity, plumbing leak indicators where they are visible, and any prior repair. The engineer reviews all of it before an opinion is written.",
    ],
    whoOrders: [
      "Lenders and underwriters who need a foundation question resolved before a file closes",
      "Buyers and sellers who have received a general inspection report flagging movement",
      "Homeowners deciding whether a crack is cosmetic or structural",
      "Foundation repair contractors whose customer has been asked for an independent opinion",
      "Attorneys and owners documenting the condition of a structure at a point in time",
    ],
    deliverable: [
      "A signed and sealed report stating the scope, the elevation data as measured, the observed distress, the engineer's opinion of foundation performance, and the limitations of that opinion.",
      "A floor elevation diagram showing the measurement grid and the relative elevations recorded on it.",
      "Where repair is indicated, a plain statement of what the evidence supports, written so that a contractor can price the same scope and an owner can compare bids against a fixed document.",
    ],
    turnaround:
      "Foundation reports are ordinarily reviewed and sealed within a few business days of the field visit. Elevation data is reduced before review, so a report is never sealed ahead of the measurements it rests on.",
    faqs: [
      {
        q: "What does a foundation certification actually say?",
        a: "It states how the foundation is performing, supported by measured floor elevations, and it states the limits of that opinion. It is not a warranty and it is not a prediction. An engineer describes what a structure has done and what the evidence supports; nobody can certify what the ground will do next season.",
      },
      {
        q: "Is a floor elevation survey the same as a foundation inspection?",
        a: "The survey is one input to the inspection. Elevations tell you the shape the floor is in now. They do not tell you whether that shape is original construction tolerance, seasonal movement, or a failure in progress. That reading is the engineering, and it also takes the distress pattern, the drainage, and the site into account.",
      },
      {
        q: "How much slab movement is a problem?",
        a: "There is no single number, which is why an opinion is worth more than a threshold. Deflection is judged against the span it occurs over and against how the structure above has responded to it. A half inch across sixty feet of a stiff slab and a half inch across twelve feet under a cracked masonry wall are not the same finding.",
      },
      {
        q: "Will an engineer recommend a specific repair contractor?",
        a: "No. An engineer who writes the scope and also stands to sell the repair has an interest in the size of the scope. The report describes what the evidence supports and stays independent of who performs the work, which is also what makes it useful for comparing bids.",
      },
      {
        q: "Does an engineer's report help with a lender or a buyer?",
        a: "It usually does, because it replaces an open question with a documented professional opinion. What it cannot do is guarantee an outcome. A lender decides on its own criteria, and any firm that promises a particular result before the inspection has happened is not doing engineering.",
      },
    ],
  },

  {
    slug: "solar-structural-letters",
    name: "Solar Structural Letters",
    shortName: "Solar Letters",
    h1: "Solar Structural Letters for Texas Installations",
    title: "Solar Structural Letters for Texas Installations",
    description:
      "The sealed structural review a Texas jurisdiction requires before a rooftop solar permit is issued, covering framing capacity, attachment, and wind loading.",
    summary:
      "The sealed structural review most Texas jurisdictions require before a rooftop solar permit is issued: framing capacity, attachment detail, and wind loading for the site.",
    what: [
      "A solar structural letter is the sealed engineering review a building official asks for before permitting a rooftop photovoltaic array. It answers one question in writing: can this roof structure carry this array, attached this way, under the loads that apply at this address.",
      "The review takes the existing framing as it is. Rafter or truss size, spacing, span, and species, along with the condition of the members, are recorded from the field, together with the array layout, the racking system, the attachment type, and the spacing of the standoffs. Dead load from the array is combined with the wind loading derived for the site under ASCE 7 and the applicable edition of the International Residential Code or International Building Code.",
      "Texas wind speeds are not uniform, and neither are the exposure categories. A design wind speed near the coast, on the Panhandle plains, and in a sheltered suburban infill lot inside Loop 410 produce three different answers for the same array, which is why the letter is written for an address rather than for a product.",
    ],
    whoOrders: [
      "Solar installers and EPCs assembling a permit package",
      "Homeowners whose jurisdiction has returned a permit application asking for an engineer's letter",
      "Commercial owners adding a ballasted or attached array to an existing roof",
      "Racking and equipment suppliers supporting a dealer network across multiple jurisdictions",
    ],
    deliverable: [
      "A signed and sealed letter stating the framing as found, the array and attachment reviewed, the loads applied, the code edition used, and the structural conclusion.",
      "Where reinforcement is required, the detail that makes the installation work, rather than a refusal with no path forward.",
      "A PDF formatted for submission to the authority having jurisdiction, with the address, the scope, and the seal where a plans examiner expects to find them.",
    ],
    turnaround:
      "Solar letters are ordinarily the fastest deliverable on this list, because the field data is compact and the calculation is well defined. Review and sealing typically follow within a few business days of receiving a complete site package.",
    faqs: [
      {
        q: "Does every Texas jurisdiction require a structural letter for solar?",
        a: "No, and it is worth checking before ordering one. Requirements vary by authority having jurisdiction and by the size and attachment method of the array. Many cities require a sealed letter for any rooftop array, some require one only above a threshold, and some accept a manufacturer's certification for a listed racking system.",
      },
      {
        q: "What information does an engineer need from the installer?",
        a: "The address, the array layout and module count, the module weight, the racking system and attachment hardware, the standoff spacing, and framing measurements taken on site: member size, spacing, span, and species where it can be determined. Photographs of the attic framing are worth more than a description of it.",
      },
      {
        q: "What happens if the existing framing will not carry the array?",
        a: "The letter says so, and where it can be solved it states what would solve it. Sistered members, blocking, or a revised standoff layout resolve most residential cases. A letter that simply declines and stops is a letter the installer cannot use.",
      },
      {
        q: "Is a ground mount treated the same way?",
        a: "No. A ground mount is a foundation and a frame rather than a review of existing roof framing, so it is a design task with its own soil and wind considerations. It is a different scope with a different deliverable.",
      },
    ],
  },

  {
    slug: "manufactured-home-foundation-certifications",
    name: "Manufactured Home Foundation Certifications",
    shortName: "Manufactured Home Certifications",
    h1: "Manufactured Home Foundation Certifications in Texas",
    title: "Manufactured Home Foundation Certifications, Texas",
    description:
      "The engineer's foundation certification an FHA, VA, or USDA loan requires on a manufactured home in Texas, and what the inspection has to confirm.",
    summary:
      "The engineer's foundation certification required before an FHA, VA, or USDA loan will close on a manufactured home, measured against the HUD permanent foundations guide.",
    what: [
      "Federally backed lending on a manufactured home turns on one document that a general home inspection cannot supply: a certification, signed and sealed by a licensed Professional Engineer, that the foundation system meets the standard in the HUD Permanent Foundations Guide for Manufactured Housing. FHA, VA, and USDA programs all require it, and a file will sit unclosed without it.",
      "The inspection looks at the whole support system rather than at the home. Pier type, spacing, and bearing, footing size and depth below grade, anchoring and tie down where the design relies on it, perimeter enclosure, crawl space ventilation and vapor retarder, and site drainage away from the structure are all recorded and compared against the guide.",
      "Texas adds a second layer worth knowing about before an inspection is ordered. The Texas Department of Housing and Community Affairs administers manufactured housing statements of ownership and installation records separately from any lender requirement, and a home that was installed correctly may still have a record problem that the engineer's certification neither creates nor cures.",
    ],
    whoOrders: [
      "Lenders, loan officers, and mortgage brokers closing FHA, VA, or USDA files",
      "Title companies that have found the certification missing from a file",
      "Buyers and sellers of a manufactured home on owned land",
      "Homeowners refinancing a manufactured home into a federally backed program",
      "Retailers and installers who want the foundation right before a buyer finds out it is not",
    ],
    deliverable: [
      "A signed and sealed certification addressed to the lender, stating the standard applied, what was observed, and whether the foundation system complies with it.",
      "A photographic record of the piers, footings, anchorage, enclosure, and drainage, which is what an underwriter reviews when a file is questioned.",
      "Where the system does not comply, a plain statement of what would bring it into compliance, so the deficiency can be corrected and reinspected rather than simply reported.",
    ],
    turnaround:
      "These are usually scheduled against a closing date, so the certification is ordinarily reviewed and sealed within a few business days of the site visit. Where a reinspection is needed after corrective work, it is scheduled as its own visit.",
    faqs: [
      {
        q: "Why does a manufactured home need an engineer when a site built home does not?",
        a: "Because the loan programs say so. FHA, VA, and USDA all require a licensed engineer's certification that the foundation meets the HUD permanent foundations standard, and no other inspection satisfies that requirement. It is a lending condition rather than a judgment about the home.",
      },
      {
        q: "What is the HUD Permanent Foundations Guide for Manufactured Housing?",
        a: "It is the federal standard, commonly referred to by its publication number, that defines what makes a manufactured home foundation permanent: how it supports the home, how it resists wind and settlement, and how the site is drained and enclosed. The certification is an opinion measured against that document.",
      },
      {
        q: "What is the most common reason a certification cannot be issued?",
        a: "Missing or inadequate anchorage, piers that were never founded below the frost or active zone depth, and an incomplete perimeter enclosure are the recurring three. All of them are correctable, and all of them are cheaper to correct before a buyer is under contract.",
      },
      {
        q: "Does the certification cover the condition of the home itself?",
        a: "No. It addresses the foundation system and the site. The condition of the home, its roof, and its systems is a separate scope, and a certification that quietly implies otherwise would be misread by everyone who relies on it.",
      },
      {
        q: "Does the home have to be on land the borrower owns?",
        a: "For the federally backed programs that require this certification, generally yes, and the home usually has to be permanently affixed with the title surrendered or converted to real property under state law. Those are lending and title questions rather than engineering ones, and they are worth settling with the lender first.",
      },
    ],
  },

  {
    slug: "structural-letters",
    name: "Structural Letters for Permits",
    shortName: "Structural Letters",
    h1: "Structural Letters for Permits in Texas",
    title: "Structural Letters for Permits in Texas",
    description:
      "The sealed structural letter a Texas building department requires for wall removal, beam sizing, and alterations that a full plan set would over serve.",
    summary:
      "The sealed letter a building department asks for when an alteration affects structure: wall removal, a new opening, a header or beam, or a change a plans examiner has questioned.",
    what: [
      "A structural letter is the short form of a sealed engineering deliverable. It exists because a great many projects change something structural without justifying a full set of drawings: a load bearing wall comes out, an opening is widened, a beam has to be sized, a plans examiner has asked a single question and will not issue the permit until an engineer answers it.",
      "What makes it a letter rather than a plan set is scope, not rigor. The loads are still traced, the member is still sized, the bearing and the load path down to the foundation are still checked, and the engineer still seals the result. What is omitted is everything the permit does not turn on.",
      "The most common version in Texas residential work is wall removal. A wall carries a roof or a floor above it, or it does not, and the difference is settled in the attic rather than by looking at the wall. Once the load path is established the letter states the beam, the bearing at each end, and what has to happen at the posts below.",
    ],
    whoOrders: [
      "Homeowners and remodelers who have been told the permit needs an engineer's letter",
      "General contractors opening up a plan in an existing house",
      "Architects and designers who need one member or one condition sealed",
      "Property owners answering a plan review comment from a building department",
      "Contractors correcting work that was done without a permit and is now being inspected",
    ],
    deliverable: [
      "A signed and sealed letter stating the condition reviewed, the loads applied, the member or detail specified, and the code edition it was checked against.",
      "A sketch or detail where the words alone would leave a framer guessing, drawn to be built from rather than to be admired.",
      "A PDF formatted for the permit file, addressed to the authority having jurisdiction where that is what the reviewer expects.",
    ],
    turnaround:
      "Structural letters are ordinarily reviewed and sealed within a few business days once the field measurements are in hand. The field visit is usually the schedule, not the engineering.",
    faqs: [
      {
        q: "When does a Texas building department require a sealed letter?",
        a: "It varies by jurisdiction and by scope. Removing or altering a load bearing element, adding an opening in a shear wall or a masonry wall, and changing the load path in any way are the usual triggers. Many departments will tell you plainly at plan review, and it is worth asking before the wall comes out.",
      },
      {
        q: "Can a letter be issued without anyone visiting the site?",
        a: "Rarely, and it is usually a mistake to try. The letter turns on what is actually there: span, member size, bearing, what is above. An engineer who seals a member based on a homeowner's description of the attic is sealing a description, not a structure.",
      },
      {
        q: "What if the wall is already out?",
        a: "It is still solvable, and it is a common enough situation. The engineer evaluates what is in place now, states what is required, and specifies the remediation. Work performed before review is more expensive to resolve, not impossible to resolve.",
      },
      {
        q: "Is a letter cheaper than a full plan set?",
        a: "Usually, because it is a smaller scope. The judgment worth making is not which is cheaper but which the permit needs. A letter covering a project that genuinely needs drawings will be rejected at review, and the project pays for both.",
      },
    ],
  },

  {
    slug: "repair-specifications",
    name: "Repair Specifications",
    shortName: "Repair Specifications",
    h1: "Engineered Repair Specifications in Texas",
    title: "Engineered Repair Specifications in Texas",
    description:
      "A sealed repair specification defines what is repaired and how, so contractors bid the same scope and a building department can permit the work.",
    summary:
      "A sealed document that defines exactly what is repaired and how it is repaired, so every contractor bids the same scope and a building department can permit the work.",
    what: [
      "A repair specification is the engineering that sits between a finding and a contract. Something is damaged or distressed, an opinion exists about why, and somebody now has to build the fix. The specification states what is repaired, in what sequence, to what standard, and with what materials and connections.",
      "Its practical value is that it makes bids comparable. Three contractors reading three different assumptions about the same damage produce three prices that cannot be set beside each other. Three contractors reading one sealed specification produce three prices for identical work, and the owner is choosing a builder rather than guessing at a scope.",
      "It is also what a building department can permit. A repair described as making good the damaged area is not a scope a plans examiner can review. A specification that names the members, the connections, the fasteners, and the inspections is.",
    ],
    whoOrders: [
      "Owners and property managers repairing storm, water, fire, or impact damage",
      "General contractors who need a defined scope before they will price the work",
      "Adjusters and carriers who need the scope of repair established by an engineer",
      "Condominium and homeowner associations putting repair work out to bid",
      "Owners correcting distress identified in a prior engineering report",
    ],
    deliverable: [
      "A signed and sealed specification stating the scope, the sequence, the materials and connections, and the standard the repair is measured against.",
      "Details and sketches where a written description alone would leave the connection to the builder's judgment.",
      "Where inspection during construction is required by the specification, a plain statement of which stages have to be observed before they are covered.",
    ],
    turnaround:
      "Repair specifications follow the assessment they rest on, and the schedule depends on the size of the damage rather than on a queue. A scope is agreed before work begins so that the document arrives when the bidding does.",
    faqs: [
      {
        q: "How is a repair specification different from a contractor's estimate?",
        a: "An estimate is a price for work the contractor has defined. A specification is the definition itself, written by an engineer with no interest in the size of the job. That independence is exactly what makes competing estimates comparable.",
      },
      {
        q: "Does a specification say what the damage cost?",
        a: "No. It states what has to be repaired and how. Pricing is the contractor's role and valuation is the adjuster's role. An engineer who wanders into either has stopped being useful to both.",
      },
      {
        q: "Can a specification be written from photographs?",
        a: "Sometimes, for narrow and clearly documented damage. More often it needs a site visit, because the repair depends on what the damaged element connects to and photographs rarely show that. Where a specification is written from photographs alone, it says so.",
      },
      {
        q: "Who inspects the repair once it is built?",
        a: "Where the specification calls for observation at particular stages, an engineer or a technician working to the same protocol carries it out and the record goes back to the engineer of record. Repairs closed up before a required observation usually have to be opened again.",
      },
    ],
  },

  {
    slug: "residential-light-commercial-design",
    name: "Residential and Light Commercial Design",
    shortName: "Design",
    h1: "Residential and Light Commercial Design in Texas",
    title: "Residential and Light Commercial Design in Texas",
    description:
      "Sealed structural design for Texas homes, additions, and light commercial buildings: foundations for expansive soil, framing plans, and permit ready drawings.",
    summary:
      "Sealed structural design for homes, additions, and light commercial buildings: foundation design for the soil on site, framing plans, and drawings a permit office can review.",
    what: [
      "Design is the work of deciding what to build rather than reporting on what was built. For residential and light commercial structures in Texas that most often means the foundation, the framing, and the lateral system, drawn and sealed so the project can be permitted and constructed.",
      "Foundation design in this state is a soil problem before it is a concrete problem. On the expansive clays that run through the Blackland Prairie, the upper coast, and much of Central Texas, a slab is designed for the soil's plasticity and its expected moisture variation, commonly as a post tensioned or stiffened slab on ground proportioned to the geotechnical report. On the sands and stable formations of parts of West Texas and the Panhandle, the same house takes a different and often simpler foundation.",
      "Framing design covers gravity load paths and the lateral system that resists wind. Design wind speed and exposure vary widely across Texas, and a plan drawn for one region is not automatically valid in another. Additions carry their own problem, which is that they have to connect to an existing structure whose framing has to be discovered rather than assumed.",
    ],
    whoOrders: [
      "Builders and general contractors who need sealed structural drawings for permit",
      "Architects and designers who need a structural engineer of record on a project",
      "Homeowners adding a second story, a room, or a garage conversion",
      "Developers of small commercial shells, retail buildings, and light industrial structures",
      "Owner builders in jurisdictions that require sealed plans for a residential permit",
    ],
    deliverable: [
      "A sealed structural drawing set covering the foundation, framing, and connection details required to build and to permit the project.",
      "Design criteria stated on the drawings: code edition, design wind speed and exposure, live and dead loads, soil parameters, and the geotechnical report relied on.",
      "Response to plan review comments from the authority having jurisdiction, which is part of getting a permit issued rather than a separate engagement.",
    ],
    turnaround:
      "Design schedules are set per project, because a garage conversion and a small retail shell are not the same undertaking. A schedule is agreed in writing before the work starts, and it is tied to the receipt of the survey and the geotechnical report.",
    faqs: [
      {
        q: "Does a residential project in Texas need a licensed engineer?",
        a: "It depends on the jurisdiction and the scope. Many Texas cities require sealed structural drawings for a residential permit, and most require them for anything beyond conventional light frame construction. Some rural counties require very little. The building department is the authority on its own requirement.",
      },
      {
        q: "Is a geotechnical report needed before foundation design?",
        a: "For a slab on expansive soil, effectively yes. The design depends on the plasticity index and the expected moisture variation, and those come from borings, not from the neighborhood. Designing without them means assuming a worse soil than may exist and paying for it in concrete and steel.",
      },
      {
        q: "Can an existing house be added to without opening up the structure?",
        a: "Partly. Some of the existing framing can be established from the attic and the crawl space, and some cannot be known without exposure. A design that depends on an unverified assumption states the assumption on the drawings so it is checked during construction rather than discovered afterward.",
      },
      {
        q: "What does engineer of record mean on a project?",
        a: "It is the licensed engineer who takes responsible charge of the design, seals it, and answers for it. It is a professional obligation attached to a person, not a company logo, and it is the reason the seal on a drawing set carries the weight it does.",
      },
    ],
  },

  {
    slug: "forensic-engineering",
    name: "Forensic and Insurance Engineering",
    shortName: "Forensic Engineering",
    h1: "Forensic and Insurance Engineering in Texas",
    title: "Forensic and Insurance Engineering in Texas",
    description:
      "Independent engineering investigation into the cause and extent of damage to a structure, documented for owners, carriers, and counsel on the same standard.",
    summary:
      "Independent investigation into the cause and extent of damage to a structure, documented to one standard whichever party asked the question.",
    what: [
      "Forensic engineering answers a question about something that already happened. A structure is damaged or has performed poorly, and somebody needs to know why, how far the damage extends, and what the evidence actually supports. The output is a factual determination, reasoned from observation and measurement.",
      "The obligation runs to the facts rather than to the party who ordered the report. An owner, a carrier, a contractor, and an attorney can all ask the same question about the same building, and a competent investigation returns the same answer to each of them. A firm whose conclusions correlate with who is paying is not performing engineering, and the report will not survive the first serious challenge to it.",
      "Typical questions include the cause and extent of storm, wind, hail, and water damage, whether observed distress is construction related or the result of foundation movement, whether a failure originated in design, in workmanship, or in maintenance, and how far a damaged assembly has to be repaired to be sound. The investigation records what was observed, the methods used, the evidence relied on, and where the evidence stops.",
    ],
    whoOrders: [
      "Property owners and managers who need the cause of damage established",
      "Insurance carriers, adjusters, and independent adjusting firms",
      "Attorneys in construction defect and property damage matters",
      "Contractors and builders responding to an allegation about their work",
      "Condominium and homeowner associations investigating building performance",
    ],
    deliverable: [
      "A signed and sealed report stating the scope of the investigation, the observations, the methods and measurements used, the conclusions, and the limits of what the evidence supports.",
      "A photographic and measurement record adequate for another engineer to follow the reasoning and reach their own view.",
      "Where the matter proceeds, deposition and testimony by the engineer who performed the work and signed the report.",
    ],
    turnaround:
      "Investigations are scoped individually, because the field work can range from a single visit to repeated observation during destructive exposure. A schedule and a scope are agreed in writing before the investigation begins.",
    faqs: [
      {
        q: "Can an engineer investigate for either the owner or the carrier?",
        a: "Yes, and the report should read the same either way. The engineer's duty is to the facts and to the public, and the party who commissioned the work does not change what the structure did. Where an engineer cannot be impartial about a matter, the correct response is to decline it.",
      },
      {
        q: "Will a report determine what an insurance claim is worth?",
        a: "No. Valuation and coverage are the adjuster's and the carrier's determinations under the policy. The engineering question is what happened, how far it extends, and what the repair requires. Those are separate questions and mixing them serves nobody.",
      },
      {
        q: "How soon after damage should an investigation happen?",
        a: "Generally as soon as the site is safe and before repairs alter the evidence. Emergency mitigation should not be delayed for an engineer, but the condition should be photographed thoroughly before anything is removed, because a repaired assembly cannot be investigated afterward.",
      },
      {
        q: "Is destructive testing part of an investigation?",
        a: "Sometimes it is the only way to answer the question, and it is always agreed with the owner in advance, planned, documented, and limited to what the question requires. Opening a wall is evidence gathering, not demolition, and it is treated that way.",
      },
      {
        q: "Can the engineer testify about the report?",
        a: "The engineer who performed the investigation and signed the report is the one who can speak to it. That is one reason field work and review are documented to a written protocol: a report that cannot be explained under examination was not worth issuing.",
      },
    ],
  },
];

export const serviceBySlug = (slug: string): Service | undefined =>
  services.find((s) => s.slug === slug);
