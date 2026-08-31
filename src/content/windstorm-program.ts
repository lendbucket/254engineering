/**
 * The windstorm cluster: one hub and eight pages on the Texas windstorm
 * inspection program.
 *
 * WHY THIS EXISTS SEPARATELY FROM /services/windstorm-wpi-8
 * ---------------------------------------------------------
 * The service page answers "what is this firm built to deliver". These pages
 * answer "how does this program actually work", which is a different question
 * asked by a different reader at a different moment. A contractor who has just
 * been told his re-roof needs a certificate is not evaluating a firm yet. He is
 * trying to find out what happened to him.
 *
 * The two must not converge. The service page keeps the capability framing and
 * its shipped title. These pages never describe what the firm will do for you;
 * they describe what the program requires of anyone. Where a reader needs the
 * firm, they are linked to it once, in prose, at the point the question arises.
 *
 * THE EVIDENCE THAT JUSTIFIED BUILDING A CLUSTER RATHER THAN A PAGE
 * -----------------------------------------------------------------
 * Ahrefs, 2026-08-30: "wpi-8 certificate" 200/mo at KD 4 with traffic potential
 * 1,200. Traffic potential six times the head term is the signature of a subject
 * where the value sits in the surrounding questions rather than in the term
 * itself. One page cannot capture it and should not try.
 *
 * SOURCES, ALL FETCHED FROM TDI ON 2026-08-31
 * -------------------------------------------
 *   https://www.tdi.texas.gov/wind/index.html
 *   https://www.tdi.texas.gov/wind/inspectionproc.html
 *   https://www.tdi.texas.gov/wind/completed-construction-certificates.html
 *
 * Established from those pages and used below:
 *   - Form WPI-1 is submitted to TDI before work begins, whoever inspects.
 *   - Inspections happen during the work. TDI's own wording: inspectors must
 *     inspect "during - not before or after - the construction or repair".
 *   - TDI issues the WPI-8 once all inspections are approved, and the WPI-8 is
 *     what makes a building eligible for wind and hail coverage through TWIA.
 *   - Completed construction goes a different route: a signed WPI-2E plus a
 *     sealed post-construction inspection report, and TDI issues a WPI-8E.
 *   - The WPI-8-C was issued by TWIA, not TDI, for construction completed
 *     between January 1, 2017 and May 31, 2020. The process changed June 1,
 *     2020. This matters at closing, because a coastal file can still contain
 *     one and it is not a TDI document.
 *   - TDI inspectors handle non-structural work including most repairs,
 *     alterations, and re-roofs.
 *   - TDI states a target of inspecting within 48 hours of the requested date,
 *     excluding weekends and holidays.
 *
 * A CONFLICT IN THE SOURCES, RECORDED RATHER THAN RESOLVED
 * --------------------------------------------------------
 * On who may inspect ALREADY COMPLETED construction, TDI's own pages do not
 * agree with each other. The inspection process page says post-construction
 * inspections are performed by appointed engineers. The completed construction
 * certificates page says an engineer licensed by TBPELS may perform them and
 * refers to engineers not appointed by TDI.
 *
 * The copy below therefore states the mechanics that both sources agree on, the
 * WPI-2E and the sealed report, and does not assert the appointment rule for
 * that path in either direction. This note exists so a later session does not
 * read the omission as an oversight and "fix" it by picking one. Confirm with
 * TDI directly before writing a sentence that resolves it.
 *
 * WHAT IS DELIBERATELY NOT STATED ANYWHERE BELOW
 * ----------------------------------------------
 * No fee figures, no processing times beyond the 48 hour target TDI publishes
 * itself, no adopted code edition or design wind speed number, and no claim that
 * this firm holds a TDI appointment. It does not. The registration is pending
 * and no Professional Engineer is in responsible charge yet, so every sentence
 * here describes the program rather than a service being performed.
 */

import { FIRST_TIER_COASTAL, FIRST_TIER_COUNT } from "./windstorm";

/*
 * The county sentence is BUILT from the list rather than typed out.
 *
 * src/content/windstorm.ts exists precisely to stop this regulatory claim being
 * written down in a second place, and it fails the build if any county in it
 * stops appearing in the compliance reviewed region prose it indexes. Typing the
 * fourteen names into a paragraph here would have created exactly the second
 * source that file was built to prevent, and the two would have disagreed about
 * a county line eventually with nothing to catch it.
 *
 * The first draft of this page did type them out. That is why this comment is
 * here rather than the list.
 */
const countyList = `${FIRST_TIER_COASTAL.slice(0, -1).join(", ")}, and ${
  FIRST_TIER_COASTAL[FIRST_TIER_COASTAL.length - 1]
}`;

export type WindstormSection = {
  eyebrow: string;
  title: string;
  lede?: string;
  body: string[];
};

export type WindstormPage = {
  slug: string;
  name: string;
  h1: string;
  title: string;
  description: string;
  summary: string;
  /** The question this page exists to answer. Used on the hub. */
  question: string;
  sections: WindstormSection[];
  faqs?: { q: string; a: string }[];
};

export const windstormHub = {
  h1: "The Texas Windstorm Inspection Program",
  title: "Texas Windstorm Inspection Program | 254 Engineering",
  description:
    "How the Texas windstorm inspection program works: the catastrophe area, WPI-1, WPI-8, and TWIA eligibility. Join the waitlist for coastal engineering.",
  summary:
    "Along the Texas coast, a building becomes insurable through a paper trail that starts before the first nail. This is how that system fits together, and where each part of it is decided.",

  intro: [
    "Fourteen Texas counties and part of a fifteenth sit inside an area the state has designated for windstorm purposes. Inside it, whether a structure can be insured against wind and hail through the Texas Windstorm Insurance Association depends on a certificate, and whether that certificate can be issued depends on decisions made long before anyone applies for it.",
    "The program is not complicated, but it is sequential, and almost everything that goes wrong with it goes wrong because a step was taken out of order. Work that was built correctly and inspected by nobody is in a materially worse position than work that was inspected while it was open to view. That single asymmetry explains most of what follows.",
  ],

  /** The actors, because most confusion here is about who decides what. */
  actors: [
    {
      name: "Texas Department of Insurance",
      role: "Runs the windstorm inspection program, employs its own inspectors, appoints engineers to inspect on its behalf, and issues the certificate of compliance itself. The certificate is a TDI document, not an engineer's document.",
    },
    {
      name: "Texas Windstorm Insurance Association",
      role: "Writes wind and hail coverage inside the designated area for property that cannot obtain it in the ordinary market. TWIA is the reason the certificate matters commercially: TDI issues it, and TWIA eligibility depends on it.",
    },
    {
      name: "The appointed engineer",
      role: "A Texas licensed Professional Engineer appointed by TDI for windstorm inspections. The appointment is what permits an engineer to inspect for the program rather than merely to hold an opinion about a building.",
    },
    {
      name: "The TDI inspector",
      role: "A departmental inspector who handles non-structural work, which TDI describes as including most repairs, alterations, and re-roofs. A great deal of coastal work never needs an engineer at all.",
    },
    {
      name: "The city building department",
      role: "Enforces the adopted building code through the permit. It runs alongside the windstorm inspection rather than replacing it, and satisfying one does not satisfy the other.",
    },
  ],
} as const;

export const windstormPages: WindstormPage[] = [
  // -------------------------------------------------------------------------
  {
    slug: "catastrophe-area",
    name: "The designated catastrophe area",
    question: "Does this address fall inside the program at all?",
    h1: "Which Texas Counties Are in the Catastrophe Area",
    title: "Texas Windstorm Catastrophe Area Counties | 254 Engineering",
    description:
      "The fourteen Texas seacoast counties in the designated catastrophe area, the Harris County line, and what changes at the boundary. See the coverage map.",
    summary: `${FIRST_TIER_COUNT} counties, plus the part of Harris County east of State Highway 146. Inside that boundary the windstorm program applies. Outside it, none of this does.`,
    sections: [
      {
        eyebrow: "The boundary",
        title: "Fourteen counties and one highway",
        lede: "The designated area is defined by county, with a single exception drawn along a road.",
        body: [
          `The designated catastrophe area covers ${countyList} counties, together with the part of Harris County east of State Highway 146.`,
          "That Harris County line is the part people get wrong, and it is the only place in the program where the boundary runs through a populated area rather than along a county line. A property on one side of 146 is inside the program. A property on the other side is not. Nothing about the two buildings has to differ for their obligations to differ completely.",
          "Outside the designated area the windstorm inspection program simply does not apply. There is no certificate to obtain, no WPI-1 to file, and no engineer appointment involved. Wind design requirements still exist in the building code everywhere in Texas, but they are enforced through the ordinary permit rather than through this parallel system.",
        ],
      },
      {
        eyebrow: "Why a line exists",
        title: "The boundary is an insurance instrument",
        body: [
          "The designation is not a statement about where hurricanes go. It is the boundary of a residual insurance market. Inside it, wind and hail coverage is frequently unavailable in the ordinary market, and the Texas Windstorm Insurance Association exists to write it for property that cannot get it otherwise.",
          "That is why compliance is documented rather than assumed. An association obliged to insure property it did not choose needs a mechanism to know that the property was built to resist the peril it is being insured against. The certificate is that mechanism, which is why it is an eligibility document rather than a code document.",
        ],
      },
      {
        eyebrow: "Exposure",
        title: "Inside the line, position still governs",
        lede: "Being in the designated area is a binary. What the structure has to resist is not.",
        body: [
          "The boundary decides whether the program applies. It does not decide what the structure must withstand. That comes from the applicable design standard and, critically, from the site's exposure category, which is a property of the ground around the building rather than of the county it sits in.",
          "A house fronting open bay water and a house three miles inland behind mature live oak cover are in different wind environments and can require materially different roof attachment and opening protection, while sitting in the same county, under the same building department, inside the same designated area. Wind design copied from one to the other is a common and expensive error.",
          "This is also why the certificate is not portable between buildings in any sense. It records what was inspected on one structure at one address.",
        ],
      },
      {
        eyebrow: "Coverage",
        title: "Where these counties sit in the state",
        body: [
          "The designated counties fall across three of the coverage regions this firm is built to serve. Aransas, Calhoun, Kenedy, Kleberg, Nueces, Refugio, and San Patricio are in the Coastal Bend. Brazoria, Chambers, Galveston, Matagorda, and the Harris County strip are in the Greater Houston region. Cameron and Willacy are in the Rio Grande Valley, and Jefferson is on the upper coast.",
          "The regional pages carry the wind, soil, and permitting conditions specific to each, which differ enough along the coast that treating the designated area as one place would be misleading.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a property inside the city of Houston in the catastrophe area?",
        a: "Only if it lies east of State Highway 146, which is a small part of Harris County and excludes most of the city. The county is not designated as a whole, unlike the other fourteen.",
      },
      {
        q: "Does being outside the designated area mean wind design does not matter?",
        a: "No. Wind loads are part of the building code everywhere in Texas and are enforced through the ordinary permit and inspection process. What does not exist outside the designated area is the separate windstorm inspection program and its certificate.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "before-work-begins",
    name: "WPI-1 and the inspection sequence",
    question: "What has to happen before the first nail, and in what order?",
    h1: "Filing WPI-1 and Inspecting While Work Is Open",
    title: "WPI-1 and Windstorm Inspection Order | 254 Engineering",
    description:
      "Why the WPI-1 is filed before coastal work starts, what must be inspected before it is covered up, and what it costs to skip it. See the coverage map.",
    summary:
      "The application comes first, the inspections happen while the work is visible, and the certificate comes last. Reversing any part of that is the most expensive mistake available on a coastal project.",
    sections: [
      {
        eyebrow: "First",
        title: "The application precedes the work",
        lede: "Form WPI-1 notifies the department that a project exists, before it exists.",
        body: [
          "Form WPI-1, the application for a certificate of compliance, is submitted to the Texas Department of Insurance before work begins. It is required whoever performs the inspections, whether that is a departmental inspector or an appointed engineer.",
          "It is a small piece of paper with a large consequence. It is what puts the project inside the program on the department's own records, and it establishes the point from which inspections can be requested. A project that has not been entered cannot be inspected as ongoing construction, and work that proceeds unentered has already started down the harder path without anyone deciding to.",
        ],
      },
      {
        eyebrow: "During",
        title: "The inspection has to see the work",
        lede: "TDI's own wording is that inspections happen during, not before or after, the construction or repair.",
        body: [
          "Windstorm inspection is sequenced with construction rather than performed once at the end. Roof deck attachment, sheathing, framing connections, and opening protection are all examined while they are open to view, because once they are covered they cannot be examined at all without uncovering them.",
          "The department publishes a target of conducting inspections within 48 hours of the requested date, excluding weekends and holidays. Planning around that target is the difference between a trade waiting a day and a trade being sent home. On a coastal job with weather pressure and a crew booked elsewhere next week, that is the schedule risk that actually bites.",
          "Nothing about this is a formality. The single most common reason a coastal structure cannot be certified is not that the work was done badly. It is that nobody was there to see it while it could still be seen.",
        ],
      },
      {
        eyebrow: "Who",
        title: "Not every stage needs an engineer",
        body: [
          "The department employs its own inspectors, and TDI describes them as handling non-structural work including most repairs, alterations, and re-roofs. A great deal of coastal work is inspected this way and never involves an engineer.",
          "[An appointed Texas licensed Professional Engineer](/windstorm/appointed-engineers) inspects on the department's behalf where the work calls for it, and is the route for structures and situations a departmental inspector does not cover. Which route a given project takes is a question worth settling before the schedule is built around an assumption.",
        ],
      },
      {
        eyebrow: "Last",
        title: "The department issues the certificate",
        body: [
          "Once all required inspections are approved, TDI issues the WPI-8 certificate of compliance. The certificate is issued by the department itself, on the strength of the inspection record, and it is what makes the building eligible for wind and hail coverage through the Texas Windstorm Insurance Association.",
          "This is the distinction that causes trouble at closing. An engineer's letter, however well written, is not the certificate. The document a carrier or a title company is looking for is the one the department issued.",
        ],
      },
      {
        eyebrow: "The cost of reversing it",
        title: "What skipping the sequence actually buys",
        lede: "Work completed without inspection is not uncertifiable. It is certifiable the hard way.",
        body: [
          "Construction finished without windstorm inspection goes down the completed construction route instead, which requires a sealed post-construction inspection report rather than a series of observations made while the work was open. That is a fundamentally harder evidentiary problem, because the evidence has been covered up by the finished building.",
          "Sometimes the remedy is to expose the work again. On a finished house that means opening ceilings, soffits, or roof covering to look at connections that were photographable for free three months earlier. The full completed construction path is set out separately.",
        ],
      },
    ],
    faqs: [
      {
        q: "Who files the WPI-1?",
        a: "The application is filed with the Texas Department of Insurance before work begins. In practice it is usually handled by the contractor or the engineer, but the obligation attaches to the project rather than to a trade, and an owner who assumes it was filed and finds out otherwise at the end has a problem that is theirs.",
      },
      {
        q: "How long does an inspection take to schedule?",
        a: "TDI publishes a target of conducting inspections within 48 hours of the requested date, excluding weekends and holidays. That is the department's own stated target rather than a guarantee, and coastal weather and volume affect it.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "completed-construction",
    name: "Certificates for completed construction",
    question: "The work is already finished and nobody inspected it. Now what?",
    h1: "Certifying Coastal Work That Is Already Finished",
    title: "WPI-8E Completed Construction Certificate | 254 Engineering",
    description:
      "The WPI-2E and WPI-8E route for coastal work finished without inspection, and what a sealed post-construction report must establish. Join the waitlist.",
    summary:
      "There is a route for work that was never inspected. It runs on a sealed post-construction report rather than on observations, which makes it slower, more involved, and occasionally impossible without opening the building back up.",
    sections: [
      {
        eyebrow: "The route",
        title: "WPI-2E in, WPI-8E out",
        lede: "Completed construction has its own application and its own certificate.",
        body: [
          "Where a structure was finished without windstorm inspection, the path is the completed construction route rather than the ordinary one. It runs on a signed WPI-2E application together with a sealed post-construction inspection report and supporting documentation, submitted to the Texas Department of Insurance.",
          "What the department issues at the end of it is a WPI-8E rather than a WPI-8. The two are different documents recording different things: one records that the work was watched as it happened, the other records an engineer's sealed conclusion about work that was not.",
        ],
      },
      {
        eyebrow: "The difficulty",
        title: "The evidence is inside the finished building",
        lede: "A post-construction report has to establish what a sequence of inspections would simply have recorded.",
        body: [
          "The problem is evidentiary rather than procedural. Roof deck attachment, framing connections, and anchorage are the things that matter and the things a finished building conceals. An engineer sealing a report about them has to have a defensible basis for what is inside the assembly.",
          "Sometimes that basis can be assembled from construction photographs, permit records, product documentation, and targeted observation. Sometimes it cannot, and the honest answer is that parts of the work have to be exposed again before anything can be sealed. An engineer who seals around an element they could not verify is risking an appointment and a license against somebody else's schedule pressure.",
          "This is the whole argument for filing the WPI-1 first, made in retrospect and at considerably greater expense.",
        ],
      },
      {
        eyebrow: "A document you may already have",
        title: "The WPI-8-C, and why it is not a TDI certificate",
        lede: "Coastal files still contain these, and they came from somewhere else.",
        body: [
          "For construction completed between January 1, 2017 and May 31, 2020, certificates were issued by the Texas Windstorm Insurance Association rather than by the Texas Department of Insurance. Those carry the designation WPI-8-C. The process changed on June 1, 2020, after which completed construction certificates come from TDI as WPI-8E.",
          "This matters when a coastal property changes hands. A file can legitimately contain a WPI-8-C, and finding one is not evidence that something irregular happened. It is evidence about when the work was completed. Somebody searching the department's records for a certificate that was never a department document will not find it and may reach the wrong conclusion.",
        ],
      },
      {
        eyebrow: "Practical order",
        title: "What to establish before commissioning anything",
        body: [
          "Establish when the work was completed, because that determines which route and which certificate are even in play. Establish whether a WPI-1 was ever filed, because a project already inside the program is in a different position from one that never entered it. Then establish what documentary record survives from the construction itself, since that is what determines whether a post-construction report is a matter of assembly or a matter of demolition.",
          "Those three answers usually determine the cost of the whole exercise, and all three can be established before anyone is engaged to inspect anything.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a WPI-8E worth less than a WPI-8?",
        a: "They are different certificates for different circumstances rather than a better and a worse version of one thing. What differs is how much work it takes to obtain one after the fact, and whether the evidence to support it still exists inside the finished building.",
      },
      {
        q: "We have a WPI-8-C from 2018. Is it valid?",
        a: "A WPI-8-C was the certificate issued by the Texas Windstorm Insurance Association for construction completed between January 1, 2017 and May 31, 2020. It is a real certificate from that period. It is not a Texas Department of Insurance document, which is why searching TDI records for it does not find it.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "appointed-engineers",
    name: "The TDI appointment",
    question: "What is an appointed engineer, and why can't any engineer do this?",
    h1: "What a TDI Windstorm Appointment Actually Is",
    title: "TDI Appointed Windstorm Engineer Explained | 254 Engineering",
    description:
      "What the Texas Department of Insurance windstorm appointment permits, how it differs from a Texas PE license, and how to verify one. Join the waitlist.",
    summary:
      "A Texas engineering license permits an engineer to practice. The windstorm appointment is a separate thing entirely: permission to inspect on the department's behalf for this specific program.",
    sections: [
      {
        eyebrow: "Two different permissions",
        title: "A license is not an appointment",
        lede: "One comes from the engineering board. The other comes from the insurance regulator.",
        body: [
          "A Professional Engineer license is issued by the Texas Board of Professional Engineers and Land Surveyors and permits the practice of engineering in Texas. It says nothing about the windstorm program.",
          "The windstorm appointment is issued by the Texas Department of Insurance and permits an engineer to inspect for that program on the department's behalf. It is narrower and it is separate. A highly qualified structural engineer with decades of coastal experience and no appointment cannot perform program inspections on ongoing construction, and that is a statement about authority rather than about competence.",
          "This is why asking an engineer whether they are licensed is the wrong question on a coastal job. The question is whether they hold the appointment for the work in front of you.",
        ],
      },
      {
        eyebrow: "What it obliges",
        title: "The appointment is a standing exposure",
        body: [
          "An appointed engineer is inspecting so that a state agency can issue a certificate on the strength of their word, and that certificate is what an association relies on to write coverage. The engineer is therefore standing between a regulator and an insurer, which is a different professional position from writing a report for a client.",
          "The practical consequence is that an appointed engineer has a strong and permanent reason not to certify around a missing element. The pressure to do so is real, arrives at the worst moment on every job, and is usually applied by someone with a closing date. An appointment takes years to obtain and can be withdrawn.",
        ],
      },
      {
        eyebrow: "Verification",
        title: "Appointments are checkable",
        lede: "This is public information and takes a phone call or a lookup.",
        body: [
          "The department publishes a list of appointed engineers and can be reached directly to confirm one. Certificates themselves are also searchable, so a property's certificate history can be checked independently of whatever a file contains.",
          "For anyone commissioning coastal work, the useful habit is to verify the appointment before the work rather than after it. An uncertifiable inspection discovered at the end is not recoverable by argument.",
        ],
      },
      {
        eyebrow: "This firm",
        title: "Where 254 Engineering Services stands",
        lede: "Stated plainly, because a page about credentials that is vague about its own is not worth reading.",
        body: [
          "254 Engineering Services does not currently hold a Texas Department of Insurance windstorm appointment, and does not currently offer or perform engineering services. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending and no Professional Engineer is yet in responsible charge.",
          "The firm is being built in the Coastal Bend, inside the designated area, around this program specifically. When the registration is issued and an appointment is held, this page will say so and will say when. Until then it says this instead, because a firm that is vague about its own credentials on a page explaining why credentials matter has answered the question anyway.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can any Texas licensed engineer perform windstorm inspections?",
        a: "Not for ongoing construction under the program. That requires a Texas Department of Insurance appointment, which is separate from the engineering license. Requirements for inspections of already completed construction are set out on the completed construction page, and TDI is the authority to confirm them against.",
      },
      {
        q: "How do I check whether an engineer is appointed?",
        a: "The Texas Department of Insurance publishes a list of appointed engineers and can confirm an appointment directly. It is public information and worth checking before work starts rather than after.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "re-roofs-and-repairs",
    name: "Re-roofs, repairs, and alterations",
    question: "Is a re-roof really a certifiable improvement?",
    h1: "Why a Coastal Re-Roof Needs a Windstorm Certificate",
    title: "Coastal Re-Roof Windstorm Certification | 254 Engineering",
    description:
      "Why re-roofing inside the Texas catastrophe area is a certifiable improvement, and what an uncertified re-roof does to coverage. Join the waitlist.",
    summary:
      "Replacing a roof inside the designated area is an improvement the program covers. It is also the single most common piece of coastal work that gets done without anyone filing anything.",
    sections: [
      {
        eyebrow: "The surprise",
        title: "A re-roof is not maintenance here",
        lede: "Inside the designated area, replacing a roof covering is work the program reaches.",
        body: [
          "Outside the coast, replacing a roof is ordinary property maintenance and nobody files anything with an insurance regulator about it. Inside the designated catastrophe area it is an improvement that falls within the windstorm inspection program, and it is inspected on the same before-it-is-covered basis as new construction.",
          "This catches people constantly, and it catches them at the worst possible time, which is after a storm when every roofer on the coast is booked and the incentive to just get it done is at its highest.",
        ],
      },
      {
        eyebrow: "Who inspects",
        title: "Most of this work does not need an engineer",
        body: [
          "TDI describes its own inspectors as handling non-structural work including most repairs, alterations, and re-roofs. For a great deal of coastal roofing, the departmental route is the ordinary one and no engineer is involved at all.",
          "That is worth knowing because it changes the cost and the scheduling picture entirely, and because a contractor who tells a homeowner that an engineer is required for a straightforward re-roof may simply be wrong about which route the work takes.",
        ],
      },
      {
        eyebrow: "The timing problem",
        title: "The deck is visible for about a day",
        lede: "Everything the inspection cares about is exposed briefly and then covered for twenty years.",
        body: [
          "On a re-roof, the things that determine wind performance are the deck, its attachment, and how the new covering is fastened. All of it is visible for a short window in the middle of the job and invisible immediately afterwards.",
          "A crew that tears off on a Tuesday and dries in on a Wednesday has given the program a one day window to see the work. When that window is missed, the job is not uncertified because it was bad. It is uncertified because it was fast.",
        ],
      },
      {
        eyebrow: "Consequences",
        title: "What an uncertified re-roof costs later",
        body: [
          "The immediate consequence is on coverage. The certificate is what supports eligibility for wind and hail coverage through the association, and an improvement that was never certified is a gap in the structure's record rather than a gap in its construction.",
          "The delayed consequence arrives at sale. A buyer's side that pulls the certificate history and finds a roof replacement with no corresponding certificate has found a problem that has to be resolved on somebody's dime, usually under time pressure, usually through the completed construction route. What a sequenced inspection would have cost during the job is a fraction of what resolving it at closing costs.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does a repair after storm damage need a certificate?",
        a: "Repairs and alterations inside the designated area fall within the program, and TDI describes its own inspectors as handling most repairs, alterations, and re-roofs. Whether a specific repair requires inspection is a question for the department or an appointed engineer before the work starts rather than after it.",
      },
      {
        q: "Our roofer says he handles all of that. Is that enough?",
        a: "It is enough if it is true, and it is checkable. Certificates are searchable and the application is filed with the department, so an owner can confirm that the project was entered rather than accept that it was. The certificate attaches to the structure, so the person who carries the consequence of an unfiled application is the owner rather than the contractor.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "opening-protection",
    name: "Openings and opening protection",
    question: "Why do windows and doors decide so much of this?",
    h1: "Why Openings Govern Coastal Wind Performance",
    title: "Coastal Opening Protection Requirements | 254 Engineering",
    description:
      "Why windows, doors, and garage doors govern wind performance on the Texas coast, and what a missing element means for certification. Join the waitlist.",
    summary:
      "A roof that stays on a building whose openings have failed is holding down a structure that is already pressurized from the inside. Openings are where coastal wind performance is decided.",
    sections: [
      {
        eyebrow: "The mechanism",
        title: "A breached opening changes the whole load case",
        lede: "The failure is not the window. The failure is what happens to the building afterwards.",
        body: [
          "When an opening is breached during a wind event, the interior of the building becomes pressurized. The load case on the roof and the walls changes from the outside in to the inside out, and elements designed for one condition are now resisting another.",
          "This is why opening protection is treated as structural rather than as a finish item. A garage door is the largest opening in most houses and is frequently the weakest, and a garage door failure is a common first event in a chain that ends at the roof.",
        ],
      },
      {
        eyebrow: "Documentation",
        title: "Products are established on paper",
        body: [
          "Windows, doors, shutters, and garage doors intended to resist wind and impact carry documentation establishing what they were tested to and how they must be installed. That documentation is part of what an inspection is looking at, because a rated assembly installed outside the terms of its own approval is not the assembly that was tested.",
          "Installation detail carries as much weight as product selection here. Anchorage into the surrounding structure, fastener type and spacing, and the condition of the substrate all determine whether the tested performance is actually available to the building.",
        ],
      },
      {
        eyebrow: "Certification",
        title: "A missing element cannot be certified around",
        lede: "The inspection records what is present, and absence is a finding.",
        body: [
          "Where the applicable requirements call for an element and the element is not there, the work does not comply, and the certificate does not issue until it does. This is not a discretionary judgment and it is not a negotiation.",
          "The practical version: opening protection decisions made for budget reasons early in a project become certification blockers late in it, at a point when the cost of adding the element is far higher than it would have been. Settling what the openings require before the order is placed is the cheapest moment to settle it.",
        ],
      },
      {
        eyebrow: "Retrofit",
        title: "Openings are the one part that is genuinely improvable later",
        body: [
          "Unlike roof deck attachment or framing connections, which are buried by the finished building, openings remain accessible for the life of the structure. That makes them the one area where a coastal building's wind performance can be meaningfully improved after the fact without demolition.",
          "For an owner of an older coastal structure who cannot economically address concealed connections, opening protection is usually where the available improvement is.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are shutters an acceptable alternative to impact rated glazing?",
        a: "Both approaches appear in coastal construction and each is established by its own product documentation and installation requirements. Which is acceptable for a given structure depends on the requirements applicable where it stands, which is a question to settle before purchase rather than after installation.",
      },
      {
        q: "Does replacing windows on a coastal house trigger the program?",
        a: "Window replacement inside the designated area is an alteration, and alterations fall within the program. As with a re-roof, the time to establish what the work requires is before it begins, because the installation detail an inspection would examine is concealed as soon as the trim goes on.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "buying-and-selling",
    name: "Coastal transactions",
    question: "What does a closing actually need, and who finds out too late?",
    h1: "Windstorm Certificates in a Coastal Closing",
    title: "Windstorm Certificates at Coastal Closing | 254 Engineering",
    description:
      "What a coastal closing needs from the windstorm record, and how to check certificate history before the option period ends. Join the waitlist.",
    summary:
      "Certificates attach to the structure and stay on file, which means a coastal property carries its windstorm history into every transaction whether or not anyone looks at it before the closing date.",
    sections: [
      {
        eyebrow: "What transfers",
        title: "The certificate follows the building",
        lede: "It records an improvement to a structure, not a relationship with an owner.",
        body: [
          "A certificate attaches to the structure and to the improvement it certified rather than to whoever owned the property at the time, and it remains on file. A buyer inherits the windstorm record along with the building, in whatever condition that record is in.",
          "That is favorable when the record is complete. It is the entire problem when it is not, because the gap in the record is now the buyer's gap and the seller has moved on.",
        ],
      },
      {
        eyebrow: "The check",
        title: "Certificate history is searchable before anyone is committed",
        lede: "This costs nothing and is the single highest value fifteen minutes in a coastal transaction.",
        body: [
          "Certificates issued for a property can be searched, so the windstorm record can be examined during the option period rather than discovered during underwriting. What is being looked for is not simply whether a certificate exists but whether the certificates present account for the improvements visible on the building.",
          "A roof that is obviously newer than the house, with no corresponding certificate, is the classic finding. So is an enclosed patio, a replaced garage door, or a window package that postdates the original construction.",
          "For work completed between January 1, 2017 and May 31, 2020, the certificate came from the Texas Windstorm Insurance Association as a WPI-8-C rather than from the department. A search of departmental records alone will not surface it, and its absence there is not proof that the work was uncertified.",
        ],
      },
      {
        eyebrow: "The consequence",
        title: "An uncertified improvement is an insurability question",
        body: [
          "The certificate supports eligibility for wind and hail coverage through the association. Where a coastal buyer's financing requires that coverage, an uncertified improvement stops being a paperwork question and becomes a question about whether the transaction can close on schedule.",
          "The remedy is the completed construction route, which runs on a sealed post-construction report and takes as long as it takes. Discovering the need for it two weeks before closing is how coastal deals slip, and the discovery is entirely avoidable earlier.",
        ],
      },
      {
        eyebrow: "Sellers",
        title: "The record is worth assembling before listing",
        lede: "A clean windstorm record is a marketing asset on the coast and a discount on a disclosure otherwise.",
        body: [
          "A seller who assembles the certificate history before listing controls the timing of any problem it reveals. A seller who does not will meet the same problem later, with less leverage and a contract in place.",
          "Where an improvement was made without certification, addressing it before listing converts an unquantified risk that a buyer will price defensively into a known cost the seller chose when to incur.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does the seller have to provide a windstorm certificate?",
        a: "The certificate attaches to the structure and remains on file rather than being a document a seller issues. What matters in practice is whether the record accounts for the improvements on the building, which either side can check before the contract rather than after.",
      },
      {
        q: "We found a roof with no certificate two weeks before closing. What are the options?",
        a: "The route for work already completed is the completed construction path, which requires a sealed post-construction inspection report and runs on the department's timeline rather than the transaction's. That is why the check belongs in the option period.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "twia-coverage",
    name: "TWIA coverage and eligibility",
    question: "How does a certificate turn into insurance?",
    h1: "How a Windstorm Certificate Reaches TWIA Coverage",
    title: "TWIA Coverage and the WPI-8 Certificate | 254 Engineering",
    description:
      "What the Texas Windstorm Insurance Association is, why the WPI-8 governs eligibility for wind and hail coverage, and what it does not cover. Join the waitlist.",
    summary:
      "The association exists because ordinary carriers frequently will not write wind and hail on the coast. The certificate exists because an insurer of last resort still needs to know what it is insuring.",
    sections: [
      {
        eyebrow: "The association",
        title: "A market of last resort, by design",
        lede: "TWIA is not a carrier competing for coastal business. It is the mechanism for property that cannot get coverage otherwise.",
        body: [
          "Inside the designated catastrophe area, wind and hail coverage is frequently unavailable in the ordinary insurance market. The Texas Windstorm Insurance Association exists to write that coverage for property that cannot obtain it elsewhere.",
          "Understanding that shape explains the paperwork. An insurer that chooses its risks can decline a building it does not like. An association obliged to serve property the market declined cannot, so it relies instead on documented evidence that the structure was built to resist the peril.",
        ],
      },
      {
        eyebrow: "The link",
        title: "The certificate is the eligibility document",
        body: [
          "TDI issues the WPI-8 once all required inspections are approved, and that certificate is what makes the building eligible for wind and hail coverage through the association. The chain runs from the application, through the inspections, to the department's certificate, and only then to coverage.",
          "Each link is held by a different party, which is why the process resists being hurried by any one of them. A contractor cannot accelerate the department, and the department does not answer to a closing date.",
        ],
      },
      {
        eyebrow: "Scope",
        title: "What the certificate is not",
        lede: "It is an eligibility document about specific work, and it is easy to over-read.",
        body: [
          "A certificate records that particular work was inspected and found compliant. It is not a warranty of the structure's condition, not a statement about the parts of the building it did not cover, and not a substitute for the building department's own permit and inspection process, which runs alongside it.",
          "It also says nothing about flood. Wind and water are separate perils with separate coverage and separate documentation, and coastal property routinely needs to satisfy both. A structure fully certified for windstorm can sit in a mapped flood zone with an elevation problem nobody has looked at.",
        ],
      },
      {
        eyebrow: "Where the engineering sits",
        title: "The documents this firm is built around",
        body: [
          "Everything in this cluster describes a program rather than a service. 254 Engineering Services is built around the documents coastal transactions turn on, including windstorm certification inside the designated area, and is designed to deliver them under a licensed Texas Professional Engineer in responsible charge.",
          "None of that is offered or performed today. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending, no Professional Engineer is yet in responsible charge, and the firm holds no departmental windstorm appointment. The capability page sets out what the firm is built to deliver once it can.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does a WPI-8 guarantee coverage will be written?",
        a: "It is an eligibility document rather than a binding decision. The certificate is what makes a building eligible for wind and hail coverage through the association, and the coverage itself is then written through the ordinary application process.",
      },
      {
        q: "Does a windstorm certificate cover flood damage?",
        a: "No. Wind and flood are separate perils with separate coverage and separate documentation. Coastal property frequently has to satisfy both, and a building can be fully certified for windstorm while carrying an unresolved flood elevation question.",
      },
    ],
  },
];

export const windstormBySlug = (slug: string): WindstormPage | undefined =>
  windstormPages.find((p) => p.slug === slug);
