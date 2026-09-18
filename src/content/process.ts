/**
 * THE PROCESS PAGE, AS CONTENT RATHER THAN MARKUP.
 *
 * Operator ruling, 2026-09-17: a separate process page is confirmed, not
 * optional, and the process is five steps rather than three, each with what the
 * customer does and what the firm does.
 *
 * WHY IT IS THE MOST IMPORTANT NEW PAGE ON THE SITE. The structure it describes
 * already exists in the platform, in migrations and in code, and nobody has ever
 * described it to a customer. A protocol is written and signed by the engineer
 * of record before a line opens; intake asks his questions; a technician works
 * his checklist and cannot submit it incomplete; he records one of five
 * determinations against criteria he wrote in advance. That is a genuine
 * difference from how this work is normally bought, and the site has been
 * selling on adjectives instead.
 *
 * THE FIVE STEPS ARE THE OPERATOR'S, EXPANDED RATHER THAN INVENTED. The approved
 * copy in docs/254-site-copy.md carries them in short form on the home page and
 * marks the expansion on this page as owed. The expansion is the only writing
 * here that is not close to verbatim, and the split into what you do and what we
 * do is the operator's instruction.
 *
 * WHAT IS DELIBERATELY ABSENT. The engineer's name, his licence number, and the
 * protocol document itself. The page describes the METHOD, which is the thing
 * that protects the buyer, and naming the person would put an individual's
 * credential on a marketing surface where the register cannot govern it.
 */

export type ProcessStep = {
  /** "1" through "5". A string because it renders as one. */
  n: string;
  title: string;
  /** The one line a reader takes away if they read nothing else. */
  lede: string;
  /** What the customer does at this step. Never empty. */
  youDo: string;
  /** What the firm does at this step. Never empty. */
  weDo: string;
};

export const processSteps: ProcessStep[] = [
  {
    n: "1",
    title: "You tell us what the letter is for",
    lede: "Not what you think we need to hear. The actual purpose, and who it is going to, because that decides what the letter must say.",
    youDo:
      "Tell us the address, what the document is for, and who is going to read it. A carrier, a lender, a title company and a building official all want different things, and a letter written for the wrong one of them is a letter you pay for twice. If there is a prior engineer's report, an insurer's letter, or a plan reviewer's rejection behind the request, send it. Five minutes, on the phone or online.",
    weDo:
      "We ask the set of questions the engineer of record wrote for that service line, and collect what he requires before anybody drives anywhere. Those questions are not a form somebody in marketing designed. They are part of the protocol he signed, and they are the same every time.",
  },
  {
    n: "2",
    title: "We tell you yes or no, before you pay",
    lede: "Some jobs this firm cannot take, and you find that out in the first conversation rather than after you have paid and waited.",
    youDo:
      "Answer three questions honestly: whether there is an open insurance claim, whether there is active litigation, and whether another engineer has already looked and reached a conclusion you did not want. None of them is disqualifying on its own. All of them change what the work is, and hiding one wastes your time rather than ours.",
    weDo:
      "We decline the work we should not take, and we say why. An open claim turns a certification into leverage in somebody else's dispute, which is a different service with different rules. A covering type outside the engineer's competence is a no whatever the fee is. If we take it, you get a fixed price and a date before anything is scheduled.",
  },
  {
    n: "3",
    title: "A certified technician works the engineer's checklist",
    lede: "Not a general inspection. A specific list of items, each one photographed, with a ruler in frame where a measurement governs.",
    youDo:
      "Give us access, and tell us anything that will make the visit shorter: where the attic hatch is, which slope is the one you are worried about, whether a dog lives there. If somebody needs to be present, say so when we schedule rather than on the day.",
    weDo:
      "The technician is certified on that protocol before a first assignment on that line, and works the engineer's checklist rather than his own judgement. The app will not let him submit the job incomplete: an item he could not observe is recorded as not observed, with the reason, rather than left blank. Photographs carry their own timestamp and location.",
  },
  {
    n: "4",
    title: "The engineer reviews the evidence against his own written criteria",
    lede: "He records one of five determinations, and he records which items and which photographs he relied on.",
    youDo:
      "Nothing, and that is the point of this step. If the package is not good enough it comes back to us rather than to you, and you are not charged for our re-inspection.",
    weDo:
      "The engineer of record reads the file against the criteria he wrote before your job existed. It passes, the package needs more, repairs are required, a return visit is needed, or we decline. Every determination is written to a log that cannot be altered afterwards, which is your protection as much as ours.",
  },
  {
    n: "5",
    title: "You get the sealed document",
    lede: "Signed and sealed by the engineer in responsible charge, addressed to the recipient you named, for the purpose you named.",
    youDo:
      "Send it on. If repairs were required, have your contractor do them and tell us when they are finished. We come back, verify each item individually, and issue the letter. You pay for the return visit rather than for a second full inspection.",
    weDo:
      "We issue the document and keep the whole file: the answers, the photographs, the checklist, the determination and who made it. Years later, somebody asking what was observed on that date has an answer rather than a memory.",
  },
];

/** The three things that fall out of the protocol, for the "why it matters" block. */
export const whyItMatters: { heading: string; body: string }[] = [
  {
    heading: "Your job is judged against criteria written in advance",
    body: "Not against how the engineer felt that afternoon. The thresholds existed before your file did, and they are the same for the job before yours and the one after it.",
  },
  {
    heading: "The evidence is complete or the job does not move",
    body: "The technician cannot submit a partial package. If something could not be observed, he records what and why, rather than leaving it blank and letting the reader assume it was fine.",
  },
  {
    heading: "Somebody is accountable, by name, in a record that cannot be altered",
    body: "A licensed professional engineer is in responsible charge of your job, and every determination he makes is written to a log that is append only. That is your protection as much as ours.",
  },
];

/** What the letter says, and what it deliberately does not. */
export const whatTheLetterSays = {
  says:
    "A certification letter states the property, the date of inspection, the covering type or the structural element in question, how the evidence was collected and reviewed, and the observed condition on that date.",
  doesNot: [
    "It does not estimate how many years are left.",
    "It does not forecast future performance.",
    "It does not guarantee the roof will not leak, or the slab will not move.",
  ],
  closing:
    "It is a professional opinion about observed condition, and an engineer who tells you otherwise is telling you something he cannot stand behind. If your carrier requires a remaining life figure, call before you order and you will get an honest answer on whether we can help.",
};
