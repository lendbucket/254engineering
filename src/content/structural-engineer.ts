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
import { firmName, notYetTakingOrders, registrationStatement, responsibleChargeStatement } from "@/lib/launch";
import { contact } from "@/config/contact";


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
  /*
   * ==========================================================================
   * RETARGETED 2026-09-18, AND THE CANNIBALISATION WAS ALREADY LIVE.
   * ==========================================================================
   *
   * This page is the pillar of the largest cluster on the site: "structural
   * engineer" at 18,000 a month, difficulty 0, commercial intent. Its H1 read
   * "What a Structural Engineer Does, and When You Need One" and its title read
   * "What a Structural Engineer Actually Does", which are the INFORMATIONAL
   * terms, and the SEO revision asks for those on a separate page.
   *
   * So the pillar was handing an 18,000 a month commercial term to a page that
   * opened by defining the job, and it was competing with its own child,
   * /structural-engineer/when-you-need-one, whose slug is the second half of
   * the old H1. Two pages on one query before a third was built.
   *
   * The H1 now leads with the commercial term as a sentence rather than a
   * keyword string, and the informational angle moves to its own page. The
   * child keeps "when you need one", which is the narrowest of the three and
   * the only one that should carry that phrasing.
   *
   * The full mapping, with the two rulings it still owes the operator, is in
   * docs/keyword-mapping.md.
   */
  h1: "Structural Engineers in Texas, and What a Sealed Report Tells You",
  /*
   * 59 characters and 151, counted rather than eyeballed. The first draft of
   * this title was 46, which is under the 50 character floor seo-audit
   * enforces, and the first description was 175, over the 160 ceiling. Both
   * were measured before they shipped rather than found by the board.
   */
  title: "Texas Structural Engineer, Sealed Reports | 254 Engineering",
  description:
    "A registered Texas engineering firm for structural inspections and sealed reports. What the work covers, what a report will not say, and see the prices.",
  summary:
    "A structural engineer answers one question: what is holding this up, and is it enough. This is what the work covers at this firm, what a sealed report will and will not tell you, and what it costs.",

  sections: [
    {
      eyebrow: "The work",
      title: "Structural engineering is about load paths",
      lede: "The question is always the same one: what is holding this up, and is it enough.",
      body: [
        "A structural engineer is concerned with how a building carries load to the ground. Every roof, floor, wall, beam, and footing is part of a path, and the path either has the capacity for what is being asked of it or it does not. That is [the whole discipline](/what-is-a-structural-engineer), applied to problems that range from a cracked slab to a bridge.",
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
      lede: "A Texas license works statewide. What does not scale is standing in the building.",
      body: [
        "Structural work turns on observation. Someone competent has to be physically present, look at the thing, and record what they saw in a way that supports the opinion later. That is the part distance actually affects, and it is why a firm's coverage is a real question rather than a marketing claim.",
        "What distance does not affect is authority. A Professional Engineer licensed in Texas is licensed for Texas, not for a county, so an engineer two hundred miles away is not less qualified to hold the opinion. The relevant questions are whether they will actually travel, whether they know the conditions where the building stands, and whether the field work will be done to a standard that does not change with the mileage.",
        "Regional knowledge is not interchangeable in Texas. Expansive clay behavior in the Blackland Prairie, coastal wind requirements inside the designated catastrophe area, and caliche and rock nearer the Hill Country are genuinely different problems, and an engineer who has only worked one of them will say so.",
      ],
    },
    {
      eyebrow: "Verification",
      title: "Everything about an engineer is checkable",
      body: [
        "Texas licensure is public. So is [engineering firm registration](/insights/texas-engineering-firm-registration), which is separate from an individual license and is what permits a firm rather than a person to offer engineering services. Both can be confirmed before anyone is engaged, and neither requires the engineer's cooperation to check.",
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
      a: "A Texas license is valid statewide, so proximity is not a question of authority. It is a question of whether the field observation will actually happen properly and whether the engineer knows the soil and wind conditions where the building stands, which vary considerably across Texas.",
    },
  ],
};

export const proximityPages: ProximityPage[] = [
  /*
   * ADDED 2026-09-18 for target 2 of the SEO revision: "structural engineer
   * inspection", with "structural engineer home inspection" and "structural
   * inspection" supporting it, roughly 1,900 a month at difficulty 0.
   *
   * It is a child rather than a competitor to the pillar. The pillar answers
   * what a structural engineer is and what the firm does; this answers what
   * actually happens when one inspects a house, which is the question behind
   * that search. Neither carries the other's H1.
   *
   * REBUILT IN PLACE 2026-11-14, page 5 of the 2026-11-14 SEO report, on
   * Robert's yes to the proposal on issue #1 (6886644919): same address, no
   * redirect. "structural inspection" measured 1,000 a month at difficulty 2
   * and this page did not rank for it. A new page would have competed with this
   * one, so the title, description, H1 and opening now answer that search, and
   * one section is added: who may do one in Texas. The three sections below it
   * and the FAQs are kept as they were.
   *
   * Sources, each read before it was written down: Occupations Code 1001.003,
   * 1001.301 and 1001.401 (already cited across the insights corpus); 22 TAC
   * 535.227 and 535.228 (the Justia copies cited in insights.ts); and chapter
   * 1102, new here, read on 2026-11-14 from texas.public.law: 1102.001 defines
   * the commission as the Texas Real Estate Commission and an inspector as a
   * person who holds a license under the chapter, and 1102.002(b) reads "This
   * chapter does not prevent a person from performing an act the person is
   * authorized to perform under a license or registration issued by this state
   * or a governmental subdivision of this state under a law other than this
   * chapter."
   */
  {
    slug: "inspection",
    name: "What a structural inspection involves",
    question: "What actually happens when a structural engineer inspects a house?",
    h1: "Structural Inspection: What It Is and Who May Do One in Texas",
    title: "Structural Inspection in Texas: What It Is | 254 Engineering",
    description:
      "A structural inspection is an engineer evaluating whether a building carries its loads. See who may do one in Texas, how it differs, and what you receive.",
    summary:
      "A structural inspection is an evaluation of whether a building's structure, meaning its foundation, framing and the path its loads take to the ground, is doing its job, made to answer a specific question and reported in writing. In Texas, an inspection that reaches an opinion of that kind is engineering, and it is done by a licensed professional engineer: the Occupations Code counts evaluation and analysis among the practice of engineering (section 1001.003) and reserves that practice to license holders (section 1001.301).",
    sections: [
      {
        eyebrow: "Licensing",
        title: "Who may do one in Texas",
        lede: "Two licenses, issued by two boards under two chapters of the same code.",
        body: [
          "A home inspection is a different job done by a different license. A home inspector licensed by the Texas Real Estate Commission surveys the whole house and gives a written opinion on how the foundation is performing (22 TAC 535.228), but the commission's own rules describe that work as a limited visual survey and excuse the inspector from elevation measurement, calculations and engineering services (535.227). When a home inspection report recommends an engineer's evaluation, a structural inspection is the step it points to.",
          "The inspector's license is issued under chapter 1102 of the Occupations Code, which defines an inspector as a person holding a license under that chapter (section 1102.001). The engineer's is issued under chapter 1001 by the Texas Board of Professional Engineers and Land Surveyors. Chapter 1102 says it does not prevent anyone from doing what a license issued under another Texas law authorizes (section 1102.002(b)), so it does not stand between an engineer and an evaluation done under the engineering license.",
          "A seal belongs to the engineer alone. Section 1001.401 ties it to the license holder, so a sealed report names the person who answers to the board for it. An inspection report carries no seal and claims none, which is why a lender or insurer that has asked for an engineer's opinion will not take an inspection report in its place.",
          "Either license can be checked without asking its holder. The commission publishes a search of the people it licenses, and the engineering board publishes its roster. The steps on the engineer's side, and how to read what the roster returns, are in [how to look up a Texas PE license](/insights/texas-pe-license-lookup).",
        ],
      },
      {
        eyebrow: "The difference that matters",
        title: "A home inspection is broad, a structural inspection is deep",
        lede: "They are different trades answering different questions, and confusing them wastes a visit.",
        body: [
          "A home inspector walks the whole property and reports on everything visible: the roof covering, the water heater, the outlets, the grading. The report is wide, shallow by design, and written for a buyer deciding whether to proceed. It is not sealed, and it does not reach an engineering conclusion.",
          "A structural inspection starts from a question. Is this crack evidence of movement. Can this wall come out. Will this slab carry what is about to be put on it. The engineer looks at the load path that answers the question and largely ignores the rest of the house, because the rest of the house is not what was asked about.",
          "The output is different too. A home inspection report lists observations. An engineer's letter states an opinion, carries a seal, and names the person responsible for it.",
        ],
      },
      {
        eyebrow: "On the day",
        title: "What the visit actually covers",
        lede: "Specific, and shorter than most people expect.",
        body: [
          "The technician works the checklist the engineer wrote for that service line, in order, photographing each item wide and close, with a ruler in frame wherever a measurement governs. Crack widths are measured rather than described. Floors are checked for slope against a reference rather than by feel.",
          "Where something cannot be observed, it is recorded as not observed with the reason, rather than left blank. A blank in an evidence package reads as fine to everybody who opens it later, and it is the one thing an incomplete inspection must not be allowed to say.",
          "Access decides the length more than the size of the house does. A crawl space that can be entered, an attic hatch that is not behind stored boxes, and a roof that can be safely walked are the three things that turn a long visit into a short one.",
        ],
      },
      {
        eyebrow: "Afterwards",
        title: "The engineer reviews the evidence, not the house",
        lede: "This is the part that distinguishes a protocol driven firm from a single engineer with a clipboard.",
        body: [
          "The engineer of record reads the completed package against criteria he wrote before your job existed, and records one of five determinations: it passes, the package needs more, repairs are required, a return visit is needed, or the firm declines.",
          "If the package is not good enough, it comes back to the firm rather than to you, and you are not charged for the re-inspection. That is only possible because the criteria are written down. An engineer judging his own visit from memory has nothing to send anything back against.",
          "What you receive is a sealed letter stating the property, the date, what was examined, how the evidence was collected, and the observed condition on that date. It does not forecast, and it does not estimate remaining life.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a structural inspection the same as a structural engineer letter?",
        a: "The inspection is the visit and the letter is the deliverable. Most people asking for one want both, and the price published for each service line covers the inspection and the sealed letter together unless the page says otherwise.",
      },
      {
        q: "Can you inspect from photographs I already have?",
        a: "No. The engineer's protocol requires evidence collected by the firm's own technician, timestamped and located by the firm's app. Photographs from other devices are not accepted, and that is what makes the letter defensible when somebody challenges it. The one exception is a solar letter, where the engineer may decide at intake to rely on the installer's site survey photographs, and only where they cover every item the protocol requires.",
      },
      {
        q: "My home inspector said to get a structural engineer. What do I tell you?",
        a: "Send the inspector's report and tell us which item prompted it. That is usually enough to say in the first conversation whether it is a question an engineer should be asked, and occasionally the honest answer is that it is not.",
      },
    ],
  },
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
          "Removing or opening a wall, cutting a new opening, adding a story, [converting an attic or a garage to habitable space](/services/residential-light-commercial-design), or hanging significant new load such as heavy equipment all change the load path. Whether a wall is load bearing is frequently not obvious from inside the room, and the confident answer from somebody who has not looked at the framing is worth nothing.",
          "Adding rooftop equipment or [a solar array](/services/solar-structural-letters) is the same question in a form people rarely recognize as structural, because the array is light and the load it puts on each attachment point is not.",
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
      "How to verify a Texas engineer's license and firm registration, what a scope should say, and the red flags worth walking away from. See the coverage map.",
    summary:
      "Two of the most important checks are public records that take a few minutes. The rest is about scope and independence, which are settled before the engagement or not at all.",
    sections: [
      {
        eyebrow: "Check one",
        title: "The individual license",
        lede: "Texas licensure is a public register, and looking someone up costs nothing.",
        body: [
          "Engineering is a licensed profession in Texas, and both the license and its status are public. Confirming that the person who will seal the document holds a current license is the baseline check, and it is the one most people skip because it feels like an accusation. It is not. It is the check the register exists for.",
          "The roster does have [limits worth understanding before relying on it](/insights/texas-pe-license-lookup).",
        ],
      },
      {
        eyebrow: "Check two",
        title: "The firm registration, which is a separate thing",
        lede: "A licensed individual and a registered firm are two different permissions, and most people have never heard of the second.",
        body: [
          "In Texas a firm that offers or performs engineering services registers with the board in its own right, separately from the licenses its engineers hold. A business can employ a licensed engineer and still not be registered, and that is a real distinction rather than a technicality.",
          "It is checkable in the same way as an individual license. Anyone commissioning engineering from a company rather than from a named individual should confirm both.",
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
        title: "Where 254 Engineering currently stands",
        lede: "A page about verifying credentials should be checkable about its own.",
        body: [
          /*
           * ===================================================================
           * A WIDENING, RECORDED AS ONE. Operator ruling, 2026-09-21:
           * "the widening stands, recorded as widened under item 3's intent."
           * ===================================================================
           *
           * WHAT WAS RULED AND WHAT WAS DONE ARE DIFFERENT SIZES, WHICH IS WHY
           * THIS COMMENT EXISTS. Item 3 named `windstorm-program.ts` and said
           * to replace its false responsible charge sentence with a derivation.
           * Item 4, in the same decision, was REPORT ONLY: sweep for every
           * other compliance sentence typed as a literal. This file was an item
           * 4 finding, and it was fixed rather than reported.
           *
           * THE REASON, AND IT IS THE INTENT RATHER THAN THE WORDING. The
           * sentence here was character for character the sentence item 3
           * ordered removed, in the same `.filter(Boolean).join(" ")` idiom,
           * and it was FALSE in the same way: `peInResponsibleCharge()` has
           * answered true since a licence expiring 2028-01-31 was recorded.
           * Reporting a known false compliance sentence and leaving it public
           * for a sitting would have been obeying the letter of "report only"
           * against the whole point of the gate.
           *
           * AND THE PAGE MATTERS. This is the page that tells a reader how to
           * check an engineer's credentials. A page that is wrong about its own
           * while teaching that has answered the reader's question anyway,
           * which is the argument the block's own lede makes two lines up.
           *
           * THE OPERATOR UPHELD IT AFTER THE FACT. It was disclosed as a
           * widening in the report, not buried in a diff, and the ruling above
           * is his answer. The alternative was available and was offered:
           * revert it to a report.
           */
          [
            `${firmName()} is a veteran owned Texas firm, based in ${contact.city} and named for the 254 counties of Texas.`,
            registrationStatement(),
            responsibleChargeStatement(),
          ]
            .filter(Boolean)
            .join(" "),
          /*
           * THE SECOND HOME OF THE SAME FALSE CLAUSE. Operator ruling,
           * 2026-09-21: it predates F-29811 and is now false, because the firm
           * is registered, has an engineer in responsible charge, and
           * publishes prices.
           *
           * The sentence it opened with, "That means the firm does not
           * currently offer or perform engineering services, and nothing on
           * this site should be read as an offer to", also asserted that the
           * whole site is not an offer, which is a claim this page is in no
           * position to make about pages it does not control. What survives is
           * the instruction to the reader, which is the useful half and the
           * one the block's lede promises.
           */
          [
            notYetTakingOrders(),
            "Apply the checks on this page to this firm exactly as you would to anyone else, starting with the registration number above.",
          ]
            .filter(Boolean)
            .join(" "),
        ],
      },
    ],
    faqs: [
      {
        q: "Is a licensed engineer the same as a registered engineering firm?",
        a: "No. An individual license permits a person to practice. A firm registration permits a company to offer or perform engineering services in its own name. A business can employ licensed engineers without holding one, and both are public records worth checking.",
      },
      {
        q: "Should the engineer who visits be the one who seals the report?",
        a: "Not necessarily, and a firm that separates field observation from engineering review can be more consistent rather than less. What matters is that a licensed engineer is in responsible charge of the work and that you know who that is before you engage.",
      },
    ],
  },
  /*
   * ADDED 2026-11-15 FOR ROBERT'S ANSWERS 32 AND 33 (issue #1, proposal
   * 6889408888, "yes, as proposed"): pier and beam (traffic potential 21,000)
   * and helical piers (4,200 a month, KD 0), from the Ahrefs pull he approved.
   *
   * SOURCES, EACH READ IN FULL BEFORE A SENTENCE CITES IT:
   * - Texas Section ASCE, Guidelines for the Evaluation and Repair of
   *   Residential Foundations, Version 3, adopted April 2022: 5.4 and 5.5 on
   *   elevation surveys, 7.4.1 on remediation documents, 7.4.3.1 on
   *   underpinning, 7.5 on pier and beam repair, 7.6 to 7.8 after the work.
   * - TBPELS Engineering Advisory Opinion Request 43, February 2018.
   * - TBPELS formal response to the Drebelbis request, January 23, 2018.
   * - USDA NRCS Official Series Description, Houston Black.
   *
   * NOT READ, SO NOT QUOTED: the IRC and IBC text (codes.iccsafe.org answered
   * 403) and ICC-ES AC358 (behind a login). So neither page states a code
   * clearance, a vent ratio, a torque factor or a capacity, and the helical
   * page does not explain torque-based capacity at all until that text has
   * been read, as the proposal said.
   */
  {
    slug: "pier-and-beam",
    name: "Pier and beam foundations",
    question: "What does an engineer check under a pier and beam house?",
    h1: "Pier and Beam Foundation Problems on Texas Clay: What an Engineer Checks",
    title: "Pier and Beam Problems on Texas Clay | 254 Engineering",
    description:
      "What an engineer checks under a Texas pier and beam house: piers, shims, framing, crawlspace moisture and clearance. Read this before paying for leveling.",
    summary:
      "A pier and beam floor moves for reasons that can be seen from the crawlspace, and the repair that fits it is decided down there rather than at the front door.",
    sections: [
      {
        eyebrow: "The system",
        title: "How a pier and beam floor carries the house",
        body: [
          "A pier and beam house rests on its floor framing, and the framing rests on piers, posts or footings. The Texas Section of the American Society of Civil Engineers lists four kinds of repair for that system in its 2022 guidelines: shimming the framing on the existing supports, repairing or strengthening the framing, adding or replacing supports, and restoring any designed void space. Which of the four a house needs is decided in the crawlspace, so an evaluation starts there, at the pier caps, the shims and the beams, before anyone talks about lifting.",
          "The ground under much of the Blackland Prairie is why these floors move. The USDA describes Houston Black clay as cracking 0.5 to 4 inches wide when dry, to a depth of 12 inches or more, and soil that shrinks and swells like that moves the piers standing in it unevenly. Under Texas law, explaining why a floor moved and what should be done about it is engineering: the state board wrote in 2018 that analyzing the cause of a foundation condition or recommending repairs is the practice of engineering under section 1001.003(c)(1) of the Occupations Code.",
        ],
      },
      {
        eyebrow: "In the crawlspace",
        title: "What gets looked at, support by support",
        lede: "The four repairs in the guidelines line up with four things a person can see under the floor.",
        body: [
          "Pier caps and shims come first. The guidelines allow floor framing to be adjusted by adding shims on top of the pier caps, in hardwood or steel, so a gap between a beam and its support is often the smallest repair on the list. A stack of loose or crushed shims, or a cap that has tilted, says more about what has been happening than any reading taken in the living room.",
          "The framing comes next: beams, girders and joists, checked for rot, insect damage, cuts made by later trades, and sag between supports. The guidelines say damaged or distressed members should be replaced or reinforced, and recommend treated lumber for framing repairs.",
          "Then the spacing. Where a beam or the floor framing spans too far for the load it actually carries, the guidelines provide for additional supports, and require any support added to be compatible with the original system. A new pier of a different kind, bearing on different ground from the piers beside it, can move differently from its neighbors.",
        ],
      },
      {
        eyebrow: "Moisture",
        title: "The crawlspace decides how long a repair lasts",
        lede: "Wood that stays wet and soil that keeps changing will undo a leveling job.",
        body: [
          "The guidelines name four ways of controlling moisture under the floor: cross ventilation of the crawlspace, drainage under the floor, ground clearance for the beams and joists, and treated lumber. Each can be judged from the access hatch, and each bears on whether the framing rots and whether the soil under the piers keeps swinging between wet and dry.",
          "The minimum clearance between framing and soil is set by the building code, and this page does not quote a figure it could not check against the code's own text. Framing in contact with soil, or close enough to stay damp, is a finding an engineer records whatever the number is.",
          "Where the house was built with void space under any element, the guidelines say that space should be reestablished as necessary. A void that has filled in lets swelling clay push directly on what it was meant to clear.",
        ],
      },
      {
        eyebrow: "Before leveling",
        title: "Why lifting is the last question, not the first",
        lede: "Leveling is the visible part of the work, which is why it is usually the first thing offered.",
        body: [
          "A floor shimmed back to level over piers that are still moving, or over framing that is still deteriorating, goes back out of level. Whether to adjust elevations is a decision made after the supports and the framing have been judged sound, or after they have been repaired.",
          "The guidelines also treat a floor elevation survey as one piece of evidence rather than the whole answer. A single survey shows the floor's shape at one moment, and some unevenness was built in on the day the house was framed. Repeated surveys over months, or the original construction elevations where they exist, show change, which is what an engineer is actually trying to measure.",
          "If lifting is part of the repair, the guidelines call for the water supply and drain lines to be tested for leaks afterwards, and note that gas lines may need adjusting. A leak under a house that has just been leveled is a fresh supply of the moisture that moved it.",
        ],
      },
      {
        eyebrow: "The document",
        title: "What a repair plan should state",
        body: [
          "When an engineer specifies the repair, the guidelines list what the documents should carry, among them the purpose and limitations of the repair, a plan locating the relevant structural components, details and specifications for building it, any observation or testing required during construction, and a floor elevation survey once the work is done. A repair quote that cannot be read against a list like that is a price for a job nobody has described.",
          "After the work, an engineer retained to do so may issue a letter stating that the repair generally conforms to the documents, with any deviations noted. That letter is what a later buyer, lender or insurer usually asks to see.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is shimming a real repair or a temporary fix?",
        a: "It is one of the four repairs the Texas Section ASCE guidelines list for pier and beam foundations, and it is the right one when the supports and the framing are sound and the gap is the problem. It is the wrong one when the pier under the shim is still moving, because the shim then only records the movement.",
      },
      {
        q: "Can a home inspector tell me why my floor is uneven?",
        a: "An inspector reports the visible condition. The Texas engineering board wrote in 2018 that analyzing the cause of a foundation condition or recommending repairs is the practice of engineering, and that an inspector working to the Texas Real Estate Commission's standards is not required to determine the cause of a deficiency.",
      },
    ],
  },
  {
    slug: "helical-piers",
    name: "Helical piers",
    question: "When is a helical pier the right foundation repair?",
    h1: "Helical Piers Explained: When They Are the Right Foundation Repair",
    title: "Helical Piers Explained by an Engineer | 254 Engineering",
    description:
      /* Robert's Q40, "all yes" of 17:41 Central 2026-11-15 (6903338587), word for word. */
      "Helical piers are steel shafts turned into the ground like screws. See when they suit Texas clay, how capacity is shown, and what a repair plan states.",
    summary:
      "A helical pier is a support, not a diagnosis. Whether it is the right one depends on what it has to carry, and on whether anybody checked that the slab above it can be carried that way.",
    sections: [
      {
        eyebrow: "The pier",
        title: "What a helical pier is, and what is asked of it",
        body: [
          "A helical pier is a steel shaft with one or more screw-shaped plates near its tip, turned into the ground rather than driven or poured. In a repair it is one kind of underpinning, and the Texas Section of the American Society of Civil Engineers asks the same things of every kind: plans that show each element's location, size, depth and material, a design based on calculations, and a plain statement that underpinning will not improve the foundation where nothing was installed. The same guidelines warn that lifting a house on new supports is unlikely to leave it level.",
        ],
      },
      {
        eyebrow: "The slab",
        title: "The harder question is what sits on the piers",
        body: [
          "The harder question is the slab, not the pier. A slab built to rest on the ground becomes a member spanning between supports once piers carry it, and in 2018 a Texas engineer asked the state board to act on sealed repair plans that never checked whether the slab could do that. The board declined to set technical standards, because the Engineering Practice Act sets practice requirements rather than methods. It said it will investigate any design \"done incorrectly or without proper analysis.\" A helical pier is the right repair when that analysis has been done and supports it, and only then.",
          "The guidelines make the same point in their own terms. Underpinning part of a structure may be specified where calculations, tests or experience show that the part left unsupported can carry its design loads, and the performance of underpinning can be compromised by the condition of the existing slab, by changes in soil moisture and by other factors.",
        ],
      },
      {
        eyebrow: "Capacity",
        title: "How a pier's capacity is shown",
        lede: "This page gives no capacity figure, on purpose.",
        body: [
          "The guidelines require underpinning to be designed from generally accepted engineering practice and appropriate calculations, and the plans to state each element's location, size, depth, material type and, where it applies, the minimum material strength. A plan that cannot say what each pier is meant to carry has not shown that it can carry it.",
          "The published criteria for evaluating helical systems sit behind an evaluation service's own login, and the building code text that refers to them could not be read for this page. So no factor and no capacity appears here. A number quoted without its source is the kind of number this site does not repeat.",
          "The guidelines also call for the documents to state what observation or testing is required during construction. That record is how anyone later knows that what went into the ground matches what was designed.",
        ],
      },
      {
        eyebrow: "Expectations",
        title: "What a pier repair will not do",
        body: [
          "The guidelines ask the construction documents to say plainly that underpinning will not improve the foundation where nothing was installed. A partial repair supports the part it supports, and the rest of the slab goes on behaving as it did before.",
          "Lifting on new piers is not a promise of a level floor either. The guidelines treat elevation adjustment as a matter of field judgment, limited to avoid damaging the foundation and the finishes, and say it is unlikely to produce a level foundation. Plumbing should be tested for leaks after any lift.",
          "After the work, a floor elevation survey belongs in the record, and an engineer retained to do so may issue a letter that the repair generally conforms to the documents, noting any deviation.",
        ],
      },
      {
        eyebrow: "Independence",
        title: "Who designs the pier, and who sells it",
        body: [
          "The 2018 request to the state board described engineers who repeatedly sealed pier plans while working on behalf of, or on the recommendation of, the repair company that benefits from the repair. Whatever the merits of any one plan, that is the arrangement in which nobody is paid to ask whether the slab can be carried on piers at all.",
          "An engineer engaged by the owner, with no interest in which repair is chosen, is paid to ask exactly that question, and to say so in writing when the answer is that piers are not the repair.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are helical piers better than concrete piers?",
        a: "Neither is better in general. The Texas Section ASCE guidelines ask the same of every kind of underpinning: a design based on calculations, plans that state where each element goes and how deep, and a plain statement of what the repair will not improve. The right pier is the one that design supports for that house and that soil.",
      },
      {
        q: "Will helical piers make my floor level?",
        a: "Probably not exactly. The guidelines say it is unlikely that lifting will result in a level foundation, and that lifting should be limited by judgment to avoid damage to the foundation and the finishes.",
      },
    ],
  },
];

export const proximityBySlug = (slug: string): ProximityPage | undefined =>
  proximityPages.find((p) => p.slug === slug);
