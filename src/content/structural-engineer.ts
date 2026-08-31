/**
 * The proximity cluster: the unqualified head term and the two questions behind
 * it.
 *
 * THE EVIDENCE
 * ------------
 * Ahrefs, 2026-08-30: "structural engineer near me" 6,700/mo, KD 0, traffic
 * potential 2,100, CPC $4.00. The highest volume term measured across all three
 * brands, at zero difficulty, and nothing on this site currently answers it.
 *
 * WHY THERE IS NO PAGE WITH "NEAR ME" OR A CITY IN IT
 * ---------------------------------------------------
 * A page built to match the string is the doorway pattern, and it is also a
 * worse page. Nobody types "structural engineer near me" wanting to read the
 * phrase back. They type it because something in a building is wrong, or a
 * lender has asked for something they do not have, and they do not know what
 * kind of professional solves it.
 *
 * So the cluster answers the question behind the search: what this profession
 * does, when you actually need it, and how to tell a good one from a bad one.
 * Proximity is converted by the entity being genuinely local and genuinely
 * verifiable, which is what /corpus-christi and the coverage regions are for,
 * not by repeating a city name in a heading.
 *
 * THE REGULATORY GATE APPLIES WITH FULL FORCE HERE
 * ------------------------------------------------
 * "Structural engineer" is a regulated title in Texas and this is the page most
 * likely to be read as a solicitation. Every sentence describes the profession
 * or the reader's situation. None describes a service this firm performs, uses
 * "our engineers", or invites anyone to order anything. The one place the firm
 * describes itself, on the choosing page, states the registration is pending.
 *
 * WHY THERE IS NO /roof-certification PAGE IN THIS PHASE
 * ------------------------------------------------------
 * "roof certification" measured 500/mo at KD 0 and is the other unqualified head
 * term worth having. It is already served: /services/roof-inspections opens by
 * defining a roof certification and states what the inspection covers and who
 * orders one. A second page on the same term would have had to say the same
 * things in different words, which is the one prohibition that survived the
 * registry ruling. The term is not unserved, so nothing was built.
 *
 * SOURCING
 * --------
 * Nothing here cites a statistic. The claims are about how the profession works
 * and are either matters of Texas law already covered in the insights corpus
 * (licensure, firm registration, engineer of record) or are general professional
 * description. No fee figures anywhere: engineering fees vary by scope and a
 * number on this page would be invented.
 */

export type ProximitySection = {
  eyebrow: string;
  title: string;
  lede?: string;
  body: string[];
};

export type ProximityPage = {
  slug: string;
  name: string;
  question: string;
  h1: string;
  title: string;
  description: string;
  summary: string;
  sections: ProximitySection[];
  faqs?: { q: string; a: string }[];
};

export const proximityHub: {
  h1: string;
  title: string;
  description: string;
  summary: string;
  sections: ProximitySection[];
  faqs: { q: string; a: string }[];
} = {
  h1: "What a Structural Engineer Does, and When You Need One",
  title: "What a Structural Engineer Actually Does | 254 Engineering",
  description:
    "What structural engineers do, how they differ from inspectors and contractors, and what a sealed report will and will not tell you. See the coverage map.",
  summary:
    "Most people who go looking for a structural engineer are not sure that is what they need. This is what the work actually is, and how it differs from the people who are easier to find.",

  sections: [
    {
      eyebrow: "The work",
      title: "Structural engineering is about load paths",
      lede: "The question is always the same one: what is holding this up, and is it enough.",
      body: [
        "A structural engineer is concerned with how a building carries load to the ground. Every roof, floor, wall, beam, and footing is part of a path, and the path either has the capacity for what is being asked of it or it does not. That is the whole discipline, applied to problems that range from a cracked slab to a bridge.",
        "In residential and light commercial work this usually arrives as one of a small number of situations. Something has moved or cracked and nobody knows whether it matters. Something is about to be changed, such as a wall removed or a load added, and somebody needs to know what that does. Or a third party, usually a lender, an insurer, or a building department, has asked for a professional opinion in writing before they will proceed.",
        "The engineer's product is almost never the repair. It is the analysis, and the document that records it.",
      ],
    },
    {
      eyebrow: "The distinction that matters most",
      title: "Engineer, inspector, and contractor are three different jobs",
      lede: "These get used interchangeably, and the differences decide what you can do with the result.",
      body: [
        "A home inspector reports observed condition across an entire property to a general standard, usually within a transaction. It is broad, it is fast, and it is not an engineering opinion. A good inspector who finds something structural will tell you to get an engineer, which is the correct answer rather than a deflection.",
        "A contractor diagnoses in order to sell a remedy, and there is nothing improper about that as long as everyone understands it. The person who tells you the foundation needs piers and the person who would install the piers being the same person is not fraud, but it is not independence either, and a lender or a court will treat it accordingly.",
        "A licensed Professional Engineer offers an opinion in an area of practice, in writing, under a seal, with professional liability attached and a state board that can act on a complaint. That is what the seal buys, and it is the reason the document is accepted where the other two are not.",
      ],
    },
    {
      eyebrow: "Expectations",
      title: "What a report will and will not tell you",
      lede: "The most common disappointment is a report that answers a different question than the one the reader had.",
      body: [
        "A structural report will tell you what was observed, what the engineer concludes it means, and what the engineer recommends. Where a remedy is needed it may specify the performance [the repair has to achieve](/services/repair-specifications), and it may specify the repair itself.",
        "It will not usually tell you what the work will cost. Pricing is a contractor's function, and an engineer quoting one is either guessing or has stopped being independent. It is not a warranty and it is not a guarantee that nothing will move again. It is a professional opinion at a date, based on what could be observed on that date.",
        "It will also not exceed its own scope, and this is where expectations go wrong most often. An engineer engaged to look at a specific crack has looked at that crack. If a whole building assessment is what is needed, that has to be the engagement.",
      ],
    },
    {
      eyebrow: "Proximity",
      title: "Distance matters, but not for the reason people assume",
      lede: "A Texas licence works statewide. What does not scale is standing in the building.",
      body: [
        "Structural work turns on observation. Someone competent has to be physically present, look at the thing, and record what they saw in a way that supports the opinion later. That is the part distance actually affects, and it is why a firm's coverage is a real question rather than a marketing claim.",
        "What distance does not affect is authority. A Professional Engineer licensed in Texas is licensed for Texas, not for a county, so an engineer two hundred miles away is not less qualified to hold the opinion. The relevant questions are whether they will actually travel, whether they know the conditions where the building stands, and whether the field work will be done to a standard that does not change with the mileage.",
        "Regional knowledge is not interchangeable in Texas. Expansive clay behaviour in the Blackland Prairie, coastal wind requirements inside the designated catastrophe area, and caliche and rock nearer the Hill Country are genuinely different problems, and an engineer who has only worked one of them will say so.",
      ],
    },
    {
      eyebrow: "Verification",
      title: "Everything about an engineer is checkable",
      body: [
        "Texas licensure is public. So is [engineering firm registration](/insights/texas-engineering-firm-registration), which is separate from an individual licence and is what permits a firm rather than a person to offer engineering services. Both can be confirmed before anyone is engaged, and neither requires the engineer's cooperation to check.",
        "That is unusual and worth using. In most trades a customer is relying on reputation. Here there is a register.",
      ],
    },
  ],

  faqs: [
    {
      q: "Do I need a structural engineer or a home inspector?",
      a: "An inspector surveys a whole property to a general standard and is the right first step in most transactions. An engineer answers a specific structural question in writing under a seal. If an inspector has flagged something structural, or a lender or insurer has asked for an engineer's opinion, an inspection report will not satisfy it.",
    },
    {
      q: "Can a contractor's assessment substitute for an engineer's report?",
      a: "Sometimes for the contractor's own purposes, rarely for anyone else's. Where a lender, an insurer, a building department, or an attorney is the audience, the document they are asking for is a sealed opinion from a licensed engineer, partly because of the liability attached to it and partly because the author is not selling the remedy.",
    },
    {
      q: "Does a structural engineer have to be local to the property?",
      a: "A Texas licence is valid statewide, so proximity is not a question of authority. It is a question of whether the field observation will actually happen properly and whether the engineer knows the soil and wind conditions where the building stands, which vary considerably across Texas.",
    },
  ],
};

export const proximityPages: ProximityPage[] = [
  {
    slug: "when-you-need-one",
    name: "When you actually need an engineer",
    question: "Is this a problem that needs an engineer, or not?",
    h1: "When a Building Problem Needs a Structural Engineer",
    title: "When You Need a Structural Engineer | 254 Engineering",
    description:
      "The situations that genuinely call for a structural engineer, the ones that do not, and what to do first. See the coverage map for all 254 counties.",
    summary:
      "Some cracks matter and most do not. The useful question is not how bad it looks, but whether anything is moving and whether somebody is going to ask you for a document.",
    sections: [
      {
        eyebrow: "The two real triggers",
        title: "Movement, or a document somebody wants",
        lede: "Almost every legitimate reason to engage an engineer is one of these.",
        body: [
          "The first is evidence that [something is moving](/services/foundation-inspections) or carrying more than it was built to carry. Movement is the concern rather than appearance, and the two are only loosely related. A dramatic looking crack in a finish can be nothing, and a barely visible pattern of movement in the right place can be significant.",
          "The second is that a third party has asked for a sealed opinion. A lender before closing, an insurer before binding or when settling a claim, a building department before permitting an alteration, or an attorney in a dispute. In that case the question is not whether you need an engineer but which document is being asked for.",
          "If neither applies, monitoring and time are often the correct answer, and an honest engineer will tell you so.",
        ],
      },
      {
        eyebrow: "Signals",
        title: "What is usually worth looking at",
        lede: "Not a diagnostic list. These are the observations that make a structural question reasonable.",
        body: [
          "Cracks that are widening over time, that run diagonally from the corners of openings, or that pass through masonry units rather than around them through the mortar. Cracks that appear on both sides of a wall in the same place. Separation at the junctions where a structure meets an addition.",
          "Floors that slope enough to be felt rather than measured, that bounce noticeably under normal walking, or that have changed. Doors and windows across a whole elevation that begin to bind at the same time, which is different from one sticking door in humid weather.",
          "Anything visibly deflecting that is meant to be straight, particularly a beam, a header over a wide opening, or a roof ridge. Rot or insect damage at a bearing point. Exposed reinforcement or spalling in coastal concrete, where the corrosion is doing structural work long before it looks serious.",
        ],
      },
      {
        eyebrow: "Changes",
        title: "Before you change what carries load",
        lede: "The cheapest structural engineering happens before the work, not after it.",
        body: [
          "Removing or opening a wall, cutting a new opening, adding a storey, [converting an attic or a garage to habitable space](/services/residential-light-commercial-design), or hanging significant new load such as heavy equipment all change the load path. Whether a wall is load bearing is frequently not obvious from inside the room, and the confident answer from somebody who has not looked at the framing is worth nothing.",
          "Adding rooftop equipment or [a solar array](/services/solar-structural-letters) is the same question in a form people rarely recognise as structural, because the array is light and the wind uplift on it is not.",
          "In each of these the analysis is cheap relative to the work, and it is very cheap relative to discovering the answer afterwards.",
        ],
      },
      {
        eyebrow: "Restraint",
        title: "When you probably do not need one",
        lede: "This is worth saying plainly, because the incentive runs the other way.",
        body: [
          "Fine hairline cracking in drywall or in a stucco finish, without displacement and without a pattern, is usually a finish issue. Small stable cracks in a slab that have not changed are common. Seasonal door binding that comes and goes with humidity is usually humidity.",
          "A single crack that is not moving, in a building where nothing else has changed, generally warrants a photograph with a date and a look again in six months rather than an engagement.",
          "The reason to say this on a page like this one is that the reader is already worried, and a page that answers every worry with yes, engage somebody, is selling rather than advising.",
        ],
      },
      {
        eyebrow: "First steps",
        title: "What to have ready before you call anyone",
        body: [
          "Dated photographs, ideally showing whether anything has changed, are the single most useful thing a property owner can bring. Something in frame for scale helps. So does knowing roughly when the building was built, whether there have been additions, and whether anyone has done structural work before.",
          "If a third party asked for this, get their requirement in writing. Lenders, insurers, and building departments ask for specific documents, and the difference between what someone assumed was wanted and what was actually asked for is a common cause of paying for the wrong thing twice.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I know whether a crack is serious?",
        a: "Change over time is the useful signal rather than size. A crack that is widening, that runs diagonally from the corner of an opening, or that passes through masonry units rather than the mortar joints is worth a professional opinion. A stable hairline crack in a finish usually is not.",
      },
      {
        q: "The buyer's lender is asking for a structural engineer's letter. What is that?",
        a: "It is a sealed written opinion from a licensed Professional Engineer addressing whatever the lender has raised. Get the requirement in writing from the lender before engaging anyone, because what is actually being asked for varies and the wrong document does not satisfy it.",
      },
    ],
  },

  {
    slug: "how-to-choose",
    name: "How to choose one",
    question: "How do I tell a good engineer from a bad one before I pay?",
    h1: "How to Choose a Structural Engineer in Texas",
    title: "How to Choose a Structural Engineer | 254 Engineering",
    description:
      "How to verify a Texas engineer's licence and firm registration, what a scope should say, and the red flags worth walking away from. See the coverage map.",
    summary:
      "Two of the most important checks are public records that take a few minutes. The rest is about scope and independence, which are settled before the engagement or not at all.",
    sections: [
      {
        eyebrow: "Check one",
        title: "The individual licence",
        lede: "Texas licensure is a public register, and looking someone up costs nothing.",
        body: [
          "Engineering is a licensed profession in Texas, and both the licence and its status are public. Confirming that the person who will seal the document holds a current licence is the baseline check, and it is the one most people skip because it feels like an accusation. It is not. It is the check the register exists for.",
          "The roster does have [limits worth understanding before relying on it](/insights/texas-pe-license-lookup).",
        ],
      },
      {
        eyebrow: "Check two",
        title: "The firm registration, which is a separate thing",
        lede: "A licensed individual and a registered firm are two different permissions, and most people have never heard of the second.",
        body: [
          "In Texas a firm that offers or performs engineering services registers with the board in its own right, separately from the licences its engineers hold. A business can employ a licensed engineer and still not be registered, and that is a real distinction rather than a technicality.",
          "It is checkable in the same way as an individual licence. Anyone commissioning engineering from a company rather than from a named individual should confirm both.",
        ],
      },
      {
        eyebrow: "Scope",
        title: "Get the question in writing before the visit",
        lede: "Most unhappy engineering engagements are scope disagreements rather than competence disputes.",
        body: [
          "A proposal should say what will be observed, what will not, what document will be produced, and who it is addressed to. That last item matters more than it looks: a report addressed to you is not automatically usable by a lender, and some recipients require being named.",
          "If a third party triggered the engagement, their written requirement should be in the engineer's hands before the site visit rather than described down the phone. The commonest expensive mistake is a competent report that answers a question nobody was asking.",
          "Ask what happens if the finding is inconclusive, because sometimes it is, and an engagement that has no answer for that ends badly.",
        ],
      },
      {
        eyebrow: "Independence",
        title: "The engineer should not be selling the remedy",
        body: [
          "An opinion is worth more when its author has nothing to gain from the conclusion. Where an engineer is connected to the company that would perform the repair, the report can still be technically sound and will still carry less weight with a lender, an insurer, or a court.",
          "This is not an accusation against anyone in particular. It is a structural fact about incentives, and it is why independence is worth asking about directly rather than assuming.",
        ],
      },
      {
        eyebrow: "Red flags",
        title: "Reasons to keep looking",
        lede: "None of these are certain proof of anything. All of them are worth a second question.",
        body: [
          "A diagnosis offered before anyone has seen the building. A refusal to put scope in writing. Reluctance to name the engineer who will actually seal the document, which matters because the seal is personal. A fee that is contingent on the finding, which puts the opinion and the payment on the same side of the table.",
          "Pressure to decide immediately is worth noticing too. Structural problems that have been developing for years rarely require a decision this afternoon, and urgency is more often a sales technique than a finding.",
        ],
      },
      {
        eyebrow: "This firm",
        title: "Where 254 Engineering Services currently stands",
        lede: "A page about verifying credentials should be checkable about its own.",
        body: [
          "254 Engineering Services is a veteran owned Texas firm, based in Corpus Christi and named for the 254 counties of Texas. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending, and no Professional Engineer is yet in responsible charge.",
          "That means the firm does not currently offer or perform engineering services, and nothing on this site should be read as an offer to. Apply the checks on this page to it exactly as you would to anyone else, and the honest current answer is that the registration is not yet issued.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a licensed engineer the same as a registered engineering firm?",
        a: "No. An individual licence permits a person to practise. A firm registration permits a company to offer or perform engineering services in its own name. A business can employ licensed engineers without holding one, and both are public records worth checking.",
      },
      {
        q: "Should the engineer who visits be the one who seals the report?",
        a: "Not necessarily, and a firm that separates field observation from engineering review can be more consistent rather than less. What matters is that a licensed engineer is in responsible charge of the work and that you know who that is before you engage.",
      },
    ],
  },
];

export const proximityBySlug = (slug: string): ProximityPage | undefined =>
  proximityPages.find((p) => p.slug === slug);
