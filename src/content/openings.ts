/**
 * The genuinely open roles.
 *
 * WHY THIS IS A DATA FILE WITH DATES IN IT
 * ----------------------------------------
 * JobPosting markup is the one schema type on this site that makes a claim with
 * an expiry. Google shows these in a jobs surface, and a posting whose
 * `validThrough` has passed, or which describes a role nobody is hiring for any
 * more, is a stale claim in a place people act on. The playbook allows the markup
 * only for real openings with real dates, so both are stated here rather than
 * computed, and both are somebody's decision rather than a default.
 *
 * OWNER VERIFICATION: `validThrough` needs refreshing before it lapses, or the
 * role removing from this array. Nothing automatic will do it, deliberately. An
 * auto extending job posting is a posting that outlives the job.
 *
 * WHAT IS ABSENT AND WHY
 * ----------------------
 * No `baseSalary`. Compensation for the engineer track has not been set, and the
 * technician track is per completed inspection at a rate agreed per service line,
 * which is not a salary and would be misrepresented by that field. Inventing a
 * range to make a listing richer is exactly the fabrication class this repo
 * audits for.
 *
 * No `experienceRequirements` beyond what the page actually says. The licence is
 * the requirement for the engineer seat; the technician seat wants reliability
 * and thoroughness, which is not a years number.
 */

export type Opening = {
  /** Anchor on /careers, so the posting deep links to its own section. */
  anchor: string;
  title: string;
  /** Plain text. Schema descriptions are not a place for markup. */
  description: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR";
  /** ISO date the role was first posted. */
  datePosted: string;
  /** ISO date the posting stops being true unless renewed. */
  validThrough: string;
  /**
   * True where the work is performed remotely. The review engineer seat is
   * genuinely remote; the technician seat is genuinely not, because it is
   * standing on a property.
   */
  remote: boolean;
};

export const openings: Opening[] = [
  {
    anchor: "professional-engineers",
    title: "Texas Licensed Professional Engineer, Review and Engineer of Record",
    description:
      "Review engineer and engineer of record work for a Texas engineering firm serving all 254 counties. Read field records produced to a written protocol, form the opinion, and take responsible charge of the sealed deliverable. The review model is remote. An active Texas PE licence in good standing is required. A windstorm inspection appointment from the Texas Department of Insurance is not required and is a considerable plus. Nobody in this firm is authorized to ask an engineer to seal past what a record supports.",
    employmentType: "FULL_TIME",
    datePosted: "2026-08-16",
    validThrough: "2026-11-30",
    remote: true,
  },
  {
    anchor: "field-technicians",
    title: "Field Inspection Technician, Independent Contractor",
    description:
      "Independent contractor field inspection work across Texas. Attend properties and collect the evidence a reviewing engineer needs: measurements, photographs keyed to locations, and the specific observations the written protocol for that service calls for. Jobs are dispatched and you accept or decline each one, with no obligation either way and no penalty for declining. Pay is a flat rate per completed inspection, agreed per service line before an assignment is taken. Protocol certification is required before a first assignment. A reliable vehicle is required. Backgrounds that transfer well include roofing, construction, home inspection, insurance adjusting, the trades, and the military.",
    employmentType: "CONTRACTOR",
    datePosted: "2026-08-16",
    validThrough: "2026-11-30",
    remote: false,
  },
];
