/**
 * APPENDIX C OF 254-RC-001 v1.0, AS DATA. THE ENGINEER'S DECISION RULES.
 *
 * Source: docs/254-RC-001-roof-certification-protocol-v1.0.pdf, signed
 * 09/14/2026. "Applied by the engineer to each evidence package. One
 * determination is recorded per review."
 *
 * THE CRITERIA GO IN FRONT OF THE ENGINEER AS HE REVIEWS. They are not
 * reference material behind a link: the document makes them the rule he applies,
 * and a rule nobody is shown is a rule somebody reconstructs from memory.
 *
 * THRESHOLDS ARE TRANSCRIBED, NEVER COMPUTED. Where the document states a
 * number it is carried here as the document states it, including where that
 * leaves a question. Nothing in this file decides anything the engineer did not
 * decide; three of these thresholds need a rule from him and they are marked.
 * See AMBIGUITIES in rc-001.ts.
 */

export type Determination = "pass" | "revise" | "repairs-required" | "site-revisit" | "decline";

export type DeterminationRule = {
  key: Determination;
  /** The document's own heading, including its parenthetical. */
  heading: string;
  /** What the document says the determination does, where it says it. */
  effect: string | null;
  /** Each bullet, verbatim. */
  criteria: string[];
  at: string;
};

export const RC001_DETERMINATIONS: DeterminationRule[] = [
  {
    key: "pass",
    heading: "PASS",
    effect: null,
    criteria: [
      "Package complete: every checklist item present or properly excepted",
      "No active leak evidence (no daylight, no active moisture at stains)",
      "Covering condition consistent with reported age; worst-area photos show serviceable covering per the letter's stated criteria",
      "Seal-bond, fastening, flashings, and penetrations show no condition requiring repair before certification",
    ],
    at: "Appendix C, PASS",
  },
  {
    key: "revise",
    heading: "REVISE",
    effect: null,
    criteria: [
      "Any required photo missing, blurry, or missing its ruler/context pair",
      "Worst-area coverage doubtful (all photos look selectively good)",
      "Exception used where the condition plainly applied",
      "Counts inconsistent with photos",
    ],
    at: "Appendix C, REVISE",
  },
  {
    key: "repairs-required",
    heading: "REPAIRS REQUIRED (certification withheld, repair list issued)",
    effect: "Certification withheld and a repair list issued. Certification proceeds only after repairs are verified on revisit.",
    criteria: [
      "Active leak: daylight through deck or active moisture at any stain",
      "Deck delamination or sag confirmed by measurement",
      "Failed flashing, boots, or sealant at any penetration",
      "Unsealed tabs at more than 25% of tested locations",
      "Covering damage beyond 10 units on any plane",
      "8 or more hail hits in a 10 by 10 test square, where a test square was taken on a site revisit",
      "Certification proceeds only after repairs are verified on revisit",
    ],
    at: "Appendix C, REPAIRS REQUIRED",
  },
  {
    key: "site-revisit",
    heading: "SITE REVISIT (technician returns with an engineer-specified capture list)",
    /*
     * THE CAPTURE LIST IS THE ENGINEER'S, NOT THE STANDARD ONE. The heading
     * says so, and each criterion below names what the return trip is FOR. A
     * revisit dispatched with Appendix B unchanged would send the technician
     * back for the same evidence that was already insufficient.
     */
    effect: "The technician returns with a capture list the engineer specifies, which is not the standard Appendix B list.",
    criteria: [
      "Attic coverage incomplete: hatch photo only, no plane-by-plane daylight and stain check",
      "Stain present without a moisture reading -- return with meter and wet-test each stain",
      "Sag or delamination suspected in sightline photos -- return for straightedge/string-line measurement and framing spacing",
      "Storm damage reported within 12 months -- return for test-square count on each plane (hail hits / creased tabs)",
      "Conflicting evidence (owner story vs photos vs uploads) -- return for the specific items that settle it: product label, permit sticker, invoice match to covering",
      "Prior adverse report exists -- return and photograph every condition the report cites at the same locations before contradicting it",
      "Repairs required -- return after repairs to verify each item on the repair list",
    ],
    at: "Appendix C, SITE REVISIT",
  },
  {
    key: "decline",
    heading: "DECLINE",
    effect: "Declined at this service tier or routed to another service line under its own engagement terms. The coordinator records the routing in the job file and informs the customer in writing.",
    criteria: [
      "Open insurance claim where the certification would function as claim leverage -- route to forensic line under its own engagement terms, or decline",
      "Active or threatened litigation -- decline at this service tier",
      "Covering type outside engineer competency.",
      "Unsafe access that prevents minimum capture and customer refuses lift/equipment pricing",
      "Customer requests a predetermined conclusion -- automatic decline, log verbatim request",
    ],
    at: "Appendix C, DECLINE; section 12",
  },
];

/**
 * The numeric thresholds the document states, carried as values so a screen can
 * show them beside the evidence rather than asking the engineer to hold them in
 * his head.
 *
 * `settled` is false where the document states a number whose UNITS or whose
 * interaction with Appendix B the document does not settle. A false here is not
 * a defect in the platform and must never be resolved by choosing a reading: it
 * is a question for the engineer, raised in the report.
 */
export const RC001_THRESHOLDS: {
  key: string;
  states: string;
  value: number;
  settled: boolean;
  question: string | null;
  at: string;
}[] = [
  {
    key: "unsealed-tab-fraction",
    states: "Unsealed tabs at more than 25% of tested locations",
    value: 0.25,
    settled: false,
    /*
     * Appendix B sets the seal-bond test at "3-4 spots". One unsealed tab of
     * four is exactly 25% and does NOT exceed it; one of three is 33% and does.
     * So the determination turns on how many spots the technician chose to
     * test, which is the technician's discretion deciding an engineering
     * threshold.
     */
    question:
      "Appendix B tests seal-bond at 3-4 spots. One unsealed tab of four is exactly 25% and does not trigger; one of three is 33% and does. The determination therefore depends on how many spots the technician chose. Does the engineer want a count rather than a percentage, or a fixed number of test spots?",
    at: "Appendix C, REPAIRS REQUIRED; Appendix B, COVERING CONDITION",
  },
  {
    key: "covering-damage-units",
    states: "Covering damage beyond 10 units on any plane",
    value: 10,
    settled: false,
    question:
      "Units of what? Appendix B counts 'damaged shingles/tiles visible', which is the likely reading, but the word 'units' does not appear in Appendix B and the rule does not say.",
    at: "Appendix C, REPAIRS REQUIRED",
  },
  {
    key: "hail-hits-per-test-square",
    states: "8 or more hail hits in a 10 by 10 test square, where a test square was taken on a site revisit",
    value: 8,
    settled: false,
    question:
      "A 10 by 10 test square in what units? Feet is the trade convention and is not stated in the document.",
    at: "Appendix C, REPAIRS REQUIRED",
  },
];
