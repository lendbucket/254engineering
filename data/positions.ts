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
  /**
   * What the person actually does, concretely.
   *
   * Kept separate from `about`, which is the argument for the seat. A candidate
   * deciding whether to apply reads the argument; a candidate deciding whether
   * they can do the job reads this. Conflating them produces a page that sounds
   * appealing and never says what the work is.
   */
  responsibilities: string[];
  /** Hard requirements. Not preferences. */
  requirements: string[];
  /** Genuine pluses, described as pluses rather than as hidden requirements. */
  pluses: string[];
  /** The engagement model stated plainly, because people find this out late. */
  engagementDetail: string[];
  /**
   * How pay is structured, with no figures.
   *
   * Structure is publishable and honest: a retainer against a defined commitment,
   * a flat rate per completed inspection. A number is not, because the number is
   * agreed with the person at the same time as the commitment it attaches to, and
   * publishing one before that conversation would be inventing it.
   */
  compensationStructure: string[];
  /**
   * What the seat becomes as the firm scales, stated as intent.
   *
   * The wording matters more here than anywhere else on the site. A firm with no
   * revenue promising a career path is making a claim it cannot keep, so every
   * line is written as what the firm intends and what the agreement will say,
   * never as what will happen.
   */
  growth: string[];

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
    responsibilities: [
      "Read field records produced to a written protocol, form the engineering opinion, and take responsible charge of the sealed deliverable.",
      "Author and own the review protocols themselves, so the procedure that produces your evidence is one you set rather than one handed to you.",
      "Decide what the record does and does not support, and send work back to the field when it does not.",
      "Take responsible charge of design work where the service line calls for it: foundations, framing, and the drawing sets that get a project permitted.",
      "Be named as the engineer in responsible charge on the firm's registration application with the Texas Board of Professional Engineers and Land Surveyors.",
      "Set the standard that field certification is written against, so that a technician in Dalhart and a technician in Harlingen produce a record you can read the same way.",
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
      "The work is remote and asynchronous. Review happens against a queue rather than a calendar, so the hours are yours to arrange within the commitment you agree to.",
    ],
    compensationStructure: [
      "A retainer against a defined review commitment, agreed with the selected engineer and written into the agreement rather than set by a band.",
      "A per document component as review volume builds, so that the compensation follows the work rather than staying flat while the queue grows.",
      "The firm supports and pays for a Texas Department of Insurance windstorm appointment for an engineer willing to pursue one, because it is what makes coastal WPI-8 volume possible at all.",
      "Specific figures are settled in the offer conversation rather than published here. The review commitment they attach to is agreed at the same time, and a number published without it would describe nothing.",
    ],
    growth: [
      "The intent is that this seat becomes the firm's engineering leadership rather than one of many review seats. The engineer named on the firm registration is the engineer who sets how review works here.",
      "As volume supports it, the intent is to add review capacity under standards this seat authored, which makes the role progressively more about the standard and less about the queue.",
      "None of that is a promise, and it is written here as intent for that reason. What is contractual is the retainer, the commitment it attaches to, and the refusal right. Everything beyond that is what the firm is trying to build and would rather state honestly than dress up.",
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
    responsibilities: [
      "Travel to properties in the counties you have chosen to serve and carry out the documented inspection procedure for that service line.",
      "Capture measurements and photographs keyed to locations, in the order the protocol specifies, so the reviewing engineer can see what you saw.",
      "Record what could not be observed, plainly, rather than leaving a gap or filling it with an assumption.",
      "Upload the evidence from the property rather than reconstructing it later.",
      "Complete protocol certification before a first assignment on any service line, and re-certify when a protocol changes.",
      "Accept or decline each dispatched job. There is no obligation either way and no penalty for declining.",
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
    compensationStructure: [
      "A flat rate per completed inspection, agreed per service line before you take an assignment on it. What you earn on a job is known when you accept it rather than worked out afterward.",
      "Rates differ by service line, because the work differs. A windstorm sequence on the coast is not a roof condition report in a suburb, and paying the same for both would be paying the wrong amount for one of them.",
      "There is no minimum volume, no exclusivity, and no penalty for declining a job.",
      "As an independent contractor you supply your own vehicle and equipment and are responsible for your own taxes, insurance, and business expenses. That is stated here rather than at the offer.",
    ],
    growth: [
      "The intent is that technicians who certify on more protocols see more of the dispatch, because more of it is work they are qualified to take.",
      "Rural county groups are where technician density is thinnest, so a technician covering one is worth more to the firm than a technician in a metro, and the intent is for the rate structure to reflect that as volume allows.",
      "The firm intends to support Part 107 certification for technicians who want it, because aerial imagery is how a steep or brittle roof gets inspected without damaging it. That support is an intent rather than a current programme.",
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

/**
 * The JobPosting description, from one place.
 *
 * Both the hub and the position page emit JobPosting for the same role, and they
 * were building the description differently once the page gained the deepened
 * sections. Two structured data blocks describing the same job in different
 * words is the kind of drift nobody sees, because nobody reads their own JSON-LD
 * twice.
 */
export const positionDescription = (p: Position): string =>
  [...p.about, ...p.responsibilities].join(" ");

export const positionByTrack = (track: ApplicationTrack): Position | undefined =>
  positions.find((p) => p.track === track);

/*
 * The hiring process moved to src/content/careers.ts.
 *
 * It was described in five steps here and needed six, and a process described in
 * two files is a process that gets corrected in one of them. It sits beside the
 * rest of the careers hub copy now, which is also where the FAQ that references
 * it lives.
 */
