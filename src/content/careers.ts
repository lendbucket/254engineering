import { peInResponsibleCharge } from "@/lib/launch";

/**
 * The careers hub copy, as content rather than as markup.
 *
 * WHY THIS IS A MODULE AND NOT JSX IN THE PAGE
 * --------------------------------------------
 * Two reasons, both practical. The FAQ has to feed both the visible block and
 * the FAQPage schema from one array, because markup describing answers that are
 * not on the page is a manual action waiting to happen. And several paragraphs
 * here are gate aware: they say something different once a licensed engineer is
 * in responsible charge, and a sentence that has to change on a compliance flip
 * should not be buried in a component.
 *
 * EVERY CLAIM IS TRUE OF THE FIRM AS IT EXISTS TODAY
 * ---------------------------------------------------
 * There is no team, no office, no headcount, and no testimonial anywhere in this
 * file, because there are no employees to photograph, count, or quote. A careers
 * page that implied otherwise would be discovered in the first interview, and
 * the candidate this firm wants is exactly the one who would notice.
 *
 * The honest stage IS the pitch. Somebody who wants to inherit a system will
 * read this and leave, which is the correct outcome for both parties.
 */

/* ----------------------------------------------------------------- the model */

/** How the operating model reads from the worker's side rather than the buyer's. */
export function workingModel(): { heading: string; body: string }[] {
  return [
    {
      heading: "The work runs to written protocols",
      body: "Every service line has a documented inspection procedure that says what is measured, what is photographed, in what order, and what is recorded when a condition cannot be observed. Technicians are certified on a protocol before a first assignment on it. That is not bureaucracy for its own sake: a record collected the same way every time is the only kind a reviewing engineer can rely on without having been there.",
    },
    {
      heading: "A licensed engineer sits at the centre",
      body: peInResponsibleCharge()
        ? "Field work gathers evidence and does not reach conclusions. A Texas licensed Professional Engineer reads the record, forms the opinion, and takes responsible charge of the sealed document. The separation is what lets one standard hold across a state this size."
        : "Field work gathers evidence and does not reach conclusions. A Texas licensed Professional Engineer will read the record, form the opinion, and take responsible charge of the sealed document. The separation is what will let one standard hold across a state this size. No engineer of record is in place yet, which is why the engineering seat is open.",
    },
    {
      heading: "The operations are the product",
      body: "Dispatch, protocol capture, review queues, and delivery run on systems the firm builds rather than on a phone tree and a shared drive. For a technician that means an assignment arrives with the protocol attached and the evidence uploads from the property. For an engineer it means a file arrives complete or it does not arrive at all.",
    },
    {
      heading: "The whole state, genuinely",
      body: "Coverage is all 254 counties, grouped into eight regions on the lines that already organize permitting and emergency management. For a technician that means work in places most firms never dispatch to. For an engineer it means volume from every part of Texas rather than from one metro.",
    },
  ];
}

/* ------------------------------------------------------------- how we engage */

export const engagementModels = [
  {
    title: "Professional roles",
    kind: "Retainer or salaried, as the seat requires",
    body: "The engineering seat is a professional engagement with the firm, structured as a retainer against a defined review commitment while the volume is being built, and written to grow with what it reviews. What that growth looks like is written into the agreement rather than described in an interview.",
    points: [
      "Engaged directly by the firm rather than through an agency.",
      "Remote, from anywhere in Texas.",
      "Responsible charge is not shared and not delegated.",
    ],
  },
  {
    title: "Field technician engagements",
    kind: "Independent contractor, per completed inspection",
    body: "Field inspection work is independent contractor work, stated up front rather than discovered at the offer. Jobs are dispatched and you accept or decline each one, with no obligation either way and no penalty for declining.",
    points: [
      "Flat rate per completed inspection, agreed per service line before you take an assignment on it.",
      "No minimum volume and no exclusivity.",
      "You control the manner and means of the work within the written protocol, supply your own vehicle and equipment, and are responsible for your own taxes, insurance, and business expenses.",
    ],
  },
] as const;

/* ---------------------------------------------------------- the hiring process */

/**
 * The hiring process.
 *
 * Moved here from data/positions.ts and expanded from five steps to six. Two
 * things were missing and both are things a candidate is entitled to know
 * before applying: that a licence is checked against the public roster, and
 * that onboarding runs through a portal rather than over email.
 *
 * One source, because a process described in two files is a process that gets
 * corrected in one of them.
 */
export const hiringProcess = [
  {
    step: "01",
    title: "Application review",
    body: "You complete the application for the role. It takes about ten minutes and it asks for the things that decide the answer: your licence or your background, the counties you can reach, and your documents. Nothing is asked twice. A person reads every one, not a filter.",
  },
  {
    step: "02",
    title: "Credential verification",
    body: "For licensed roles the licence is checked against the public roster the Texas Board of Professional Engineers and Land Surveyors publishes, and any windstorm appointment against the Texas Department of Insurance. Public records only. Nothing is requested from you that a public source already answers.",
  },
  {
    step: "03",
    title: "Phone interview",
    body: "A short call about the work itself. For engineers, what you will seal and what you will not. For technicians, the counties you would genuinely drive to and what you have inspected before.",
  },
  {
    step: "04",
    title: "Video interview and identity",
    body: "A longer conversation covering the engagement, the protocols, and how review works. This is where you should ask the awkward questions about volume and pay, because the answers are better heard now. Identity is confirmed on this call, which for a remote firm dispatching people to private property is a floor rather than a formality.",
  },
  {
    step: "05",
    title: "Offer and written agreement",
    body: "A written agreement stating the engagement, the rate or retainer, and the obligations on both sides. Nothing about the arrangement is left to be understood.",
  },
  {
    step: "06",
    title: "Onboarding",
    body: "Document collection and protocol certification run through the firm's secure portal rather than over email. Background verification, where a role requires it, happens after an offer is accepted and is handled directly with you.",
  },
] as const;

/* --------------------------------------------------- standards and integrity */

/**
 * The recruiting asset.
 *
 * This is the section that decides whether a good engineer applies. It is also
 * the section most exposed to the regulatory gate, because every sentence is
 * about what a licensed engineer does here, and the firm has none yet. The
 * gate aware branches are written so the prelaunch version is a description of
 * how the firm is built rather than a claim about work being performed.
 */
export function standardsAndIntegrity(): { heading: string; body: string }[] {
  const pe = peInResponsibleCharge();
  return [
    {
      heading: "The engineer writes the standard",
      body: "Protocols are authored and owned by the licensed engineer whose seal depends on them, not handed down by operations and not written by whoever built the software. An engineer who cannot change the procedure that produces their evidence is an engineer being asked to rely on somebody else's judgment.",
    },
    {
      heading: "Refusal is a contractual right, not a favour",
      body: pe
        ? "If the record does not support an opinion, the answer is that it does not, and the job goes back to the field. Nobody in this firm is authorized to ask an engineer to seal past that, and the engagement says so in writing."
        : "If the record does not support an opinion, the answer will be that it does not, and the job goes back to the field. Nobody in this firm will be authorized to ask an engineer to seal past that, and the engagement says so in writing rather than leaving it to culture.",
    },
    {
      heading: "Responsible charge means what the rule says",
      body: "Texas defines responsible charge as control over the work and detailed professional knowledge of it. Neither is satisfied by receiving a finished document and forming a general impression that it looked reasonable. The separation between field capture and engineering review exists so that the licensee genuinely has both.",
    },
    {
      heading: "Volume never sets the standard",
      body: "The commercial pressure in a review model is always toward faster sign off. The structural answer is that the review commitment is defined in the agreement and the refusal right sits above it, so a busy week changes the queue rather than the threshold.",
    },
  ];
}

/* ------------------------------------------------------- equal opportunity */

export const equalOpportunity = [
  "Applications are read by a person and considered on the qualifications the role actually requires. 254 Engineering Services LLC does not discriminate on race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, genetic information, veteran status, or any other basis protected by federal or Texas law.",
  "The firm is veteran owned, which is a statement about who owns it and not a preference applied to hiring.",
  "If you need an accommodation at any point in the process, say so in the application or in reply to any message from the firm, and it will be arranged.",
  "The application asks for nothing sensitive. No social security number, no date of birth, no identity documents, and no bank details are collected by this website. A background check may be requested later in the process, and if it is, it is handled directly with you rather than through a form.",
];

/* ------------------------------------------------------------------- the FAQ */

/**
 * One array, two consumers: the visible block and the FAQPage schema.
 *
 * Structured data describing answers that are not on the page is the defect this
 * shape prevents. The same rule already governs the service page FAQs.
 */
export function careersFaqs(): { q: string; a: string }[] {
  const pe = peInResponsibleCharge();
  return [
    {
      q: "What kinds of engagement does the firm offer?",
      a: "Two. Professional roles, currently the engineering seat, are engaged directly by the firm as a retainer against a defined review commitment. Field inspection work is independent contractor work, dispatched job by job at a flat rate per completed inspection, with no minimum volume and no exclusivity.",
    },
    {
      q: "Is the engineering role remote?",
      a: "Yes, from anywhere in Texas. The review model is built around reading a standardized record rather than visiting properties, so the seat does not require proximity to any metro. Field technician work is the opposite: it happens at the property.",
    },
    {
      q: "Which parts of Texas does the firm dispatch to?",
      a: "All 254 counties, grouped into eight regions. Technicians choose the counties they are willing to serve and are dispatched only within them. Rural county groups are where technician density is thinnest and where coverage is worth the most to the firm.",
    },
    {
      q: "What licence does each role require?",
      a: "The engineering seat requires an active Texas Professional Engineer licence in good standing. The field inspection role requires no licence at all: it requires a reliable vehicle, comfort working safely around a roof, thorough documentation, and certification on the written protocol for each service line before a first assignment on it.",
    },
    {
      q: "How does field dispatch actually work?",
      a: "An assignment arrives with the protocol for that service line attached. You accept or decline it, with no obligation either way and no penalty for declining. Evidence is captured to the protocol and uploaded from the property. What you earn on a job is known when you accept it rather than worked out afterward.",
    },
    {
      q: "How is the engineering seat compensated?",
      a: "As a retainer against a defined review commitment, with a per document component as volume builds. The structure is agreed with the selected engineer and written into the agreement. Specific figures are settled in the offer conversation rather than published, because the review commitment they attach to is agreed at the same time.",
    },
    {
      q: "Does the firm support a TDI windstorm appointment?",
      a: "Yes. A windstorm inspection appointment from the Texas Department of Insurance is not required for the engineering seat and is a considerable plus. For an engineer willing to pursue one, the firm supports the application, covers the cost, and provides the coastal volume that makes it worth holding.",
    },
    {
      q: "How long does a reply take?",
      a: "Every application receives a response. The firm is small and reads applications in batches rather than daily, so a reply is a matter of days rather than hours, and a slow reply is not a silent rejection.",
    },
    {
      q: "Is the firm registered and practising today?",
      a: pe
        ? "Yes. The firm is registered with the Texas Board of Professional Engineers and Land Surveyors and a licensed engineer is in responsible charge."
        : "Not yet, and this is stated plainly because it affects your decision. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending, and a Texas firm registration requires an engineer in responsible charge to be named. The selected engineer is named on that application, so you would be joining at the point the firm becomes able to practise rather than after it. No work is being sealed today.",
    },
  ];
}
