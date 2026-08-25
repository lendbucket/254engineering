/**
 * The open positions.
 *
 * WHY THIS IS A DATA FILE AND NOT TWO PAGES
 * -----------------------------------------
 * Roles open and close. When they do, the change has to reach the hub listing,
 * the position page, the JobPosting markup, the sitemap, and the application
 * router, and any of those five that gets missed becomes a lie with a different
 * blast radius: a hub that lists a closed role wastes somebody's afternoon, and
 * JobPosting markup on a closed role puts it in a Google jobs surface where
 * people apply to nothing.
 *
 * So `open` is the single switch, everything derives from it, and closing a role
 * is one boolean rather than five edits.
 *
 * THE DATES ARE DECISIONS, NOT DEFAULTS
 * -------------------------------------
 * JobPosting is the one schema type on this site that expires. `validThrough` is
 * stated here and confirmed by the operator; nothing renews it automatically,
 * deliberately, because an auto extending posting is a posting that outlives the
 * job. OWNER VERIFICATION: refresh or close before it lapses.
 *
 * WHAT IS ABSENT
 * --------------
 * No `baseSalary` anywhere. Compensation for the engineer seat is not set, and
 * the technician seat is a flat rate per completed inspection agreed per service
 * line, which is not a salary and would be misrepresented by that field.
 * Inventing a range to make a listing look richer is the fabrication class this
 * repo audits for.
 *
 * No team size, no headcount, no "join our growing team of N engineers". There
 * is no team yet. See src/config/credentials.ts.
 */

export type PositionSlug = "professional-engineer" | "field-inspection-technician";

/** Which application flow a position routes to. */
export type ApplicationTrack = "engineer" | "technician";

export type Position = {
  slug: PositionSlug;
  track: ApplicationTrack;
  /** The value written to eng_applications.role. */
  roleKey: "professional_engineer" | "field_technician";
  /** Listing and page heading. */
  title: string;
  /** Short label for cards and breadcrumbs. */
  shortTitle: string;
  /** 50 to 60 characters including the brand suffix. */
  metaTitle: string;
  /** 140 to 160 characters, ending in a call to action. */
  metaDescription: string;
  /** One sentence on the hub card. */
  teaser: string;

  /** Facts a candidate scans before reading: shown as a spec row. */
  engagement: string;
  location: string;
  compensation: string;

  /** The role in the firm's voice. Paragraphs. */
  about: string[];
  /** Hard requirements. Not preferences. */
  requirements: string[];
  /** Genuine pluses, described as pluses rather than as hidden requirements. */
  pluses: string[];
  /** The engagement model stated plainly, because people find this out late. */
  engagementDetail: string[];

  open: boolean;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR";
  datePosted: string;
  validThrough: string;
  /** True where the work is performed remotely. */
  remote: boolean;
};

export const positions: Position[] = [
  {
    slug: "professional-engineer",
    track: "engineer",
    roleKey: "professional_engineer",
    title: "Texas Licensed Professional Engineer",
    shortTitle: "Professional Engineer",
    metaTitle: "Texas Professional Engineer Role | 254 Engineering",
    metaDescription:
      "A Texas PE seat with a firm serving all 254 counties: review engineer and engineer of record work, remote, on a written standard. Read the role and apply.",
    teaser:
      "Review engineer and engineer of record work for a statewide firm, performed remotely against a written review standard.",

    engagement: "Part time retainer, with scope to grow",
    location: "Remote, anywhere in Texas",
    compensation: "Retainer, agreed with the selected engineer",

    about: [
      "This is the seat the firm is built around. A review engineer reads field records produced to a written protocol, forms the opinion, and takes responsible charge of the sealed deliverable. An engineer of record takes responsible charge of design work: foundations, framing, and the drawing sets that get a project permitted.",
      "The honest description of the review model is that it is remote and it is volume oriented. You are not driving to properties. You are reading a standardized record, applying judgment, and putting your seal on a document that a lender, a carrier, or a building official will rely on. Engineers who find that unappealing should say so early. Engineers who have been looking for exactly that arrangement usually recognize it in the first paragraph.",
      "What does not change is responsible charge. If the record in front of you does not support an opinion, the answer is that it does not, and the job goes back to the field. Nobody in this firm is authorized to ask you to seal past that. A firm that would ask is one that eventually costs an engineer their licence rather than its own.",
      "One thing to be plain about, because it affects your decision. The firm's registration with the Texas Board of Professional Engineers and Land Surveyors is not yet issued. A Texas firm registration requires an engineer in responsible charge to be named, so the selected engineer is named on that application. You would be joining at the point where the firm becomes able to practise, not after it.",
    ],
    requirements: [
      "An active Texas Professional Engineer licence in good standing.",
      "Structural competence in residential and light commercial work, or another discipline you can demonstrate against the service lines.",
      "Willingness to work to a written review standard rather than to personal preference.",
      "A clear line about what you will and will not seal, stated in the interview rather than discovered later.",
    ],
    pluses: [
      "A windstorm inspection appointment from the Texas Department of Insurance. Not required, and a considerable plus: it is what makes coastal WPI-8 work possible at all, and it takes real effort to obtain.",
      "Willingness to pursue a TDI appointment. The firm supports the application, covers the cost, and gives you the coastal volume that makes it worth holding.",
      "Experience as an engineer of record on a firm registration, because the first months involve exactly that.",
      "Forensic or insurance engineering experience, particularly post storm assessment.",
    ],
    engagementDetail: [
      "The engagement starts as a part time retainer rather than a full time salary, because the honest position is that the review volume does not exist yet and inventing a headcount to look established is not something this firm does. The retainer is agreed with the selected engineer against a defined review commitment.",
      "It is structured to grow with the volume it reviews. What that growth looks like is written into the agreement rather than promised in an interview.",
      "Responsible charge is not shared and not delegated. What you seal is yours, and the firm's processes exist to make sure the record supporting it is complete before it reaches you.",
    ],

    open: true,
    employmentType: "PART_TIME",
    datePosted: "2026-08-16",
    validThrough: "2026-11-30",
    remote: true,
  },

  {
    slug: "field-inspection-technician",
    track: "technician",
    roleKey: "field_technician",
    title: "Field Inspection Technician",
    shortTitle: "Field Technician",
    metaTitle: "Field Inspection Technician Jobs | 254 Engineering",
    metaDescription:
      "Independent contractor inspection work across Texas: accept or decline dispatched jobs, flat rate per completed inspection. Read the role and apply here.",
    teaser:
      "Independent contractor inspection work across Texas, dispatched job by job at a flat rate per completed inspection.",

    engagement: "Independent contractor, per completed inspection",
    location: "Field work, across all 254 Texas counties",
    compensation: "Flat rate per completed inspection, agreed per service line",

    about: [
      "Technicians go to properties across Texas and collect the evidence a reviewing engineer needs: measurements, photographs keyed to locations, and the specific observations the written protocol for that service calls for. It is precise work and it is deliberately not decision making. What you record is what the engineer reads, and the quality of the record is the quality of the opinion built on it.",
      "The work is genuinely varied because the state is. A roof in Amarillo, a manufactured home foundation in the valley, a windstorm sequence on the coast where the inspection has to happen before the work is covered up. Each has its own protocol and you are certified on it before you are dispatched on it.",
      "What makes somebody good at this is reliability and thoroughness rather than engineering knowledge. Backgrounds that transfer well include roofing, general construction, home inspection, insurance adjusting, the skilled trades, and the military. What does not transfer is a habit of filling gaps with assumptions: recording that a condition could not be observed is worth more than a guess about it.",
    ],
    requirements: [
      "A reliable vehicle, and a willingness to drive to the far edge of the counties you claim.",
      "Comfort on a ladder and around a roof, worked safely and never past what conditions allow.",
      "Thorough documentation, including recording what could not be observed rather than leaving a gap.",
      "Protocol certification before a first assignment on any service line.",
      "A smartphone capable of capturing and uploading photographs in the field.",
    ],
    pluses: [
      "An FAA Part 107 remote pilot certificate. Aerial imagery is how a steep or brittle roof gets inspected without damaging it.",
      "General liability insurance already in place.",
      "Existing inspection credentials, whether home inspection, roofing, or adjusting.",
      "Coverage of a rural county group where technician density is thin, which is most of the state.",
    ],
    engagementDetail: [
      "This is independent contractor work, stated up front rather than discovered at the offer. Jobs are dispatched and you accept or decline each one, with no obligation either way and no penalty for declining.",
      "Pay is a flat rate per completed inspection, agreed per service line before you take an assignment on it. What you earn on a job is known when you accept it rather than worked out afterward.",
      "You control the manner and means of the work within the requirements of the written protocol, you supply your own vehicle and equipment, and you are responsible for your own taxes, insurance, and business expenses.",
      "Protocol certification comes before the first assignment. It is not a hurdle for its own sake: central review only works if the record is consistent, and an uncertified inspection is a wasted trip for you and an unreviewable file for the engineer.",
    ],

    open: true,
    employmentType: "CONTRACTOR",
    datePosted: "2026-08-16",
    validThrough: "2026-11-30",
    remote: false,
  },
];

export const openPositions = (): Position[] => positions.filter((p) => p.open);

export const positionBySlug = (slug: string): Position | undefined =>
  positions.find((p) => p.slug === slug);

export const positionByTrack = (track: ApplicationTrack): Position | undefined =>
  positions.find((p) => p.track === track);

/**
 * The hiring process, stated once.
 *
 * Five steps, and each says what actually happens rather than what sounds
 * reassuring. A candidate reading this should be able to predict their next two
 * weeks.
 */
export const hiringProcess = [
  {
    step: "01",
    title: "Application",
    body: "You complete the application for the role. It takes about ten minutes and it asks for the things that decide the answer: your licence or your background, the counties you can reach, and your documents. Nothing is asked twice.",
  },
  {
    step: "02",
    title: "Review",
    body: "A person reads it, not a filter. You get a reply either way, including when the reply is that the firm is not in a position to bring you on yet, which is a real outcome and is said plainly rather than left as silence.",
  },
  {
    step: "03",
    title: "Phone interview",
    body: "A short call about the work itself. For engineers, what you seal and what you will not. For technicians, the counties you would genuinely drive to and what you have inspected before.",
  },
  {
    step: "04",
    title: "Video interview",
    body: "A longer conversation, including the specifics of the engagement, the protocols, and how review works. This is where you should ask the awkward questions about volume and pay, because the answers are better heard now.",
  },
  {
    step: "05",
    title: "Offer",
    body: "A written agreement stating the engagement, the rate or retainer, and the obligations on both sides. Onboarding and any background verification happen after an offer is accepted, handled directly rather than through this website.",
  },
];
