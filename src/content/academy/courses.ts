import { SIGNABLE_PROTOCOLS } from "@/content/protocols/signable";
import { RC001 } from "@/content/protocols/rc-001";

/**
 * ===========================================================================
 * THE TECHNICIAN TRAINING ACADEMY: THE TWO REQUIRED COURSES. Robert's ruling
 * P3 of 2026-11-01 (finish the portal).
 * ===========================================================================
 *
 * "Draft course 1 from each signed protocol's own text, marked 'Awaiting
 * engineer approval'; nothing can be graduated against a draft. Course 2
 * (ladder and roof fall safety) is a placeholder marked 'Awaiting Robert', same
 * rule. No video and no generated person."
 *
 * COURSE 1 IS THE PROTOCOLS' OWN WORDS. Each lesson's reading is drawn at load
 * from the transcription of one signed protocol (src/content/protocols), by
 * section heading, so nothing in it is paraphrased and a change to the
 * transcription changes the lesson. Sections 4 to 8 are what a technician does:
 * roles, qualifications, intake as it reaches the technician, scheduling and
 * the field inspection. 254-RC-001 has no full text array in this repository,
 * so its lesson is its photo procedure, which is transcribed verbatim.
 *
 * Two kinds of line are left out of a reading, both in 254-WP-001's role table:
 * the "Holder" cells, which name a person (an engineer's name is never printed
 * on a page a member of the public can reach), and the table's header cells,
 * which mean nothing without it. The proof asserts no reading names a person.
 *
 * THE QUIZZES ARE A DRAFT TOO. Every question names the sentence of the
 * protocol it is drawn from, and scripts/proofs/the-academy-teaches-the-
 * protocols-own-words.mjs asserts that sentence occurs, word for word, in the
 * lesson's reading. The engineer approves the questions with the readings: the
 * approval is of the whole course, hashed (src/lib/academy.ts).
 *
 * EACH LESSON NAMES THE PROTOCOL VERSION IT TEACHES. When a transcription
 * moves to a new version the lesson's declared version no longer matches, the
 * course reads "out of date", and it cannot be approved or graduated until a
 * new course version is drafted and approved.
 */

export type QuizQuestion = {
  prompt: string;
  choices: readonly string[];
  /** The index of the correct choice. */
  answer: number;
  /** The protocol's own sentence the question is drawn from, word for word. */
  source: string;
};

export type Lesson = {
  key: string;
  title: string;
  /** The protocol and version this lesson teaches. */
  teaches: { documentNumber: string; version: string };
  /** The reading, verbatim, in the protocol's own line order. */
  lines: readonly string[];
  quiz: readonly QuizQuestion[];
};

export type Course = {
  slug: string;
  version: number;
  title: string;
  /** Who approves it: the engineer of record for the protocols, the owner for the firm's safety course. */
  approver: "engineer_of_record" | "owner";
  /** The share of a lesson's questions answered correctly that passes it, in percent. */
  passMarkPercent: number;
  /** A placeholder has no lessons yet, says who writes it, and can be neither approved nor taken. */
  placeholder: string | null;
  lessons: readonly Lesson[];
};

/** Lines of a signable protocol from one section heading up to (not including) another, less the lines a rule drops. */
function sectionLines(documentNumber: string, from: RegExp, to: RegExp, drop: (line: string) => boolean = () => false): { version: string; lines: string[] } {
  const p = SIGNABLE_PROTOCOLS.find((x) => x.documentNumber === documentNumber);
  if (!p) return { version: "", lines: [] };
  const start = p.text.findIndex((l) => from.test(l));
  const end = p.text.findIndex((l, i) => i > start && to.test(l));
  if (start < 0 || end < 0) return { version: p.version, lines: [] };
  return { version: p.version, lines: p.text.slice(start, end).filter((l) => !drop(l)) };
}

const ROLES = /^4\. Roles/;
const NINE = /^9\. /;

/*
 * 254-WP-001's role table: its three header cells, its "Holder" cells (the one
 * ending ", P.E." names the engineer, the one ending "or delegate" names the
 * owner), and the cell that only points at section 5. Matched by shape so no
 * person's name is typed here either.
 */
const WP_TABLE_HEADERS = ["Role", "Responsibility", "Holder", "Personnel qualified under Section 5"];
const wpTableCell = (l: string) => WP_TABLE_HEADERS.includes(l) || /, P\.E\.$/.test(l) || / or delegate$/.test(l);

const ws = sectionLines("254-WS-001", ROLES, NINE);
const mh = sectionLines("254-MH-001", ROLES, NINE);
const sl = sectionLines("254-SL-001", ROLES, NINE);
const pl = sectionLines("254-PL-001", ROLES, NINE);
const rs = sectionLines("254-RS-001", ROLES, NINE);
const wp = sectionLines("254-WP-001", ROLES, NINE, wpTableCell);
const fc = sectionLines("254-FC-001", ROLES, NINE);

export const ACADEMY_COURSES: readonly Course[] = [
  {
    slug: "duties-and-protocols",
    version: 1,
    title: "Duties, responsibilities and the signed protocols",
    approver: "engineer_of_record",
    passMarkPercent: 80,
    placeholder: null,
    lessons: [
      {
        key: "254-RC-001",
        title: "Roof certification: the photo procedure",
        teaches: { documentNumber: "254-RC-001", version: "1.1" },
        lines: RC001.photoProcedure.map((s) => `${s.step}. ${s.text}`),
        quiz: [
          {
            prompt: "What do you do before starting a roof inspection?",
            choices: ["Photograph the street in front of the house", "Make a rough sketch of the roof, mark North, and take a photo of it", "Climb onto the roof and look for damage first"],
            answer: 1,
            source: "Before starting, make a rough sketch of the roof and mark North. Take a photo of it.",
          },
          {
            prompt: "In what order do you work through each checklist item?",
            choices: ["Take every photo first and tick the checklist at the office", "Tick the item, take a photo of the checklist, then take the photos for that item", "Take the photos for the item, then decide which item they belong to"],
            answer: 1,
            source: "Tick the item you are about to photograph, take a photo of the checklist, then take the photos for that item.",
          },
          {
            prompt: "When one item is done, what comes next?",
            choices: ["Move on to the next item the same way", "Submit the package", "Call the engineer for a decision on the item"],
            answer: 0,
            source: "Move on to the next item the same way.",
          },
        ],
      },
      {
        key: "254-WS-001",
        title: "Windstorm certification for completed construction (WPI-8E)",
        teaches: { documentNumber: "254-WS-001", version: "1.1" },
        lines: ws.lines,
        quiz: [
          {
            prompt: "On a completed construction windstorm job, what does the technician give an opinion on?",
            choices: ["Whether the work complies with the code", "The wind speed that applies to the site", "Nothing: the technician records and photographs what is installed"],
            answer: 2,
            source: "The technician records and photographs what is installed. The technician gives no opinion on compliance.",
          },
          {
            prompt: "Who opens a concealed item that is in the scope?",
            choices: ["The owner's contractor, so the technician can photograph it", "The technician, carefully", "The coordinator"],
            answer: 0,
            source: "A concealed item in the scope is opened by the owner's contractor so the technician can photograph it.",
          },
          {
            prompt: "Weather or access stops you capturing an item. What do you record?",
            choices: ["Your best estimate of the item", "Each item that could not be observed and the reason", "Nothing; the item is left blank"],
            answer: 1,
            source: "technician records each item that could not be observed and the reason. No item is estimated, assumed, or left blank.",
          },
        ],
      },
      {
        key: "254-MH-001",
        title: "Manufactured home foundation certification",
        teaches: { documentNumber: "254-MH-001", version: "1.1" },
        lines: mh.lines,
        quiz: [
          {
            prompt: "How often does the technician go under the home?",
            choices: ["Only when the access opening shows a problem", "Only when the owner asks", "On every job"],
            answer: 2,
            source: "The technician goes under the home on every job.",
          },
          {
            prompt: "How are piers, footings, and anchorage recorded?",
            choices: ["Along the full length of each chassis beam, not from the access opening", "From the access opening", "At the four corners of the home"],
            answer: 0,
            source: "recorded along the full length of each chassis beam, not from the access opening.",
          },
          {
            prompt: "The space under the home cannot be safely entered. What does the technician do?",
            choices: ["Enters it anyway, carefully", "Does not enter it", "Asks the owner to go under instead"],
            answer: 1,
            source: "Where the space under the home cannot be safely entered, the technician does not enter it.",
          },
        ],
      },
      {
        key: "254-SL-001",
        title: "Solar structural letter for an existing roof",
        teaches: { documentNumber: "254-SL-001", version: "1.1" },
        lines: sl.lines,
        quiz: [
          {
            prompt: "How is a rafter's size measured?",
            choices: ["With a tape, to the nearest 1/8 inch", "Read from the nominal size on the lumber", "Estimated from the ground"],
            answer: 0,
            source: "Member size, spacing, and span are measured with a tape, to the nearest 1/8 inch for member size",
          },
          {
            prompt: "Does the technician say whether the framing is adequate for the array?",
            choices: ["Yes, on every roof plane", "Yes, when the installer asks", "No, and the checklist does not ask for one"],
            answer: 2,
            source: "The technician gives no opinion on whether the framing is adequate, and the checklist does not ask for one.",
          },
          {
            prompt: "When is a technician sent to a solar letter job?",
            choices: ["On every order, by default", "Only on the engineer's decision, once intake is complete", "Whenever the installer requests a visit"],
            answer: 1,
            source: "A technician is dispatched only on the engineer's decision, and not until intake is complete",
          },
        ],
      },
      {
        key: "254-PL-001",
        title: "Structural letter for a permit",
        teaches: { documentNumber: "254-PL-001", version: "1.1" },
        lines: pl.lines,
        quiz: [
          {
            prompt: "What kind of inspection is a permit letter site job?",
            choices: ["Visual and non-destructive; the technician opens no finish", "The technician opens finishes to see the framing", "Destructive testing where the engineer needs it"],
            answer: 0,
            source: "The inspection is visual and non-destructive. The technician does not remove or open any finish.",
          },
          {
            prompt: "An item is covered up. How is it recorded?",
            choices: ["Estimated from the plans", "As concealed", "Opened and photographed"],
            answer: 1,
            source: "An item that is covered up is recorded as concealed.",
          },
          {
            prompt: "Is a desk job dispatched?",
            choices: ["Yes, like a site job", "Only if the customer asks", "No"],
            answer: 2,
            source: "A desk job is not dispatched.",
          },
        ],
      },
      {
        key: "254-RS-001",
        title: "Repair specification for an existing structure",
        teaches: { documentNumber: "254-RS-001", version: "1.1" },
        lines: rs.lines,
        quiz: [
          {
            prompt: "Does the technician say what caused the damage or how to repair it?",
            choices: ["No, the technician gives no opinion on either", "Yes, the cause only", "Yes, a recommended repair"],
            answer: 0,
            source: "The technician gives no opinion on the cause of the damage or on how it should be repaired.",
          },
          {
            prompt: "What does the technician record about the damage?",
            choices: ["Only the damaged member", "The damage, how far it extends, and the sound construction next to it", "A cost estimate for the repair"],
            answer: 1,
            source: "The technician records the damage, how far it extends, and the sound construction next to it",
          },
          {
            prompt: "What does the sketch made before starting show?",
            choices: ["Only the property line", "Nothing; no sketch is made on a repair job", "North and every damaged location"],
            answer: 2,
            source: "makes a rough sketch of the structure, marks North, marks every damaged location, and photographs the sketch.",
          },
        ],
      },
      {
        key: "254-WP-001",
        title: "Windstorm inspection during construction (WPI-8)",
        teaches: { documentNumber: "254-WP-001", version: "1.2" },
        lines: wp.lines,
        quiz: [
          {
            prompt: "A technician tells the contractor on site that the work looks acceptable. What has happened?",
            choices: ["The technician has done the job well", "The technician has exceeded the protocol, and the coordinator reports it to the engineer the same day", "Nothing, as long as it is written in the package"],
            answer: 1,
            source: "A technician who indicates on site that work is acceptable has exceeded this protocol, and the coordinator reports the occurrence to the engineer the same day.",
          },
          {
            prompt: "Weather stops a stage inspection partway. Is the stage closed?",
            choices: ["Yes, with a note", "Yes, if the contractor agrees", "No; an incomplete stage is not closed"],
            answer: 2,
            source: "An incomplete stage is not closed.",
          },
          {
            prompt: "How much supervised inspection comes before a technician works alone on this protocol?",
            choices: ["At least two stages", "One stage", "None"],
            answer: 0,
            source: "with a supervised inspection on at least two stages before working alone.",
          },
        ],
      },
      {
        key: "254-FC-001",
        title: "Foundation certification for an existing foundation",
        teaches: { documentNumber: "254-FC-001", version: "1.0" },
        lines: fc.lines,
        quiz: [
          {
            prompt: "When is the relative elevation survey performed?",
            choices: ["Only when cracks are visible", "At every job, with the benchmark location and reading method recorded", "Only on pier and beam foundations"],
            answer: 1,
            source: "The relative elevation survey is performed at every job, and the benchmark location and reading method are recorded",
          },
          {
            prompt: "A crawlspace cannot be safely entered. What does the technician do?",
            choices: ["Does not enter it", "Enters it quickly", "Sends the owner in with a camera"],
            answer: 0,
            source: "Where a crawlspace cannot be safely entered, the technician does not enter it.",
          },
          {
            prompt: "How are the counts and measurements on the checklist recorded?",
            choices: ["As short descriptions", "As rounded estimates", "As counts and measurements, not as descriptions"],
            answer: 2,
            source: "recorded as counts and measurements, not as descriptions.",
          },
        ],
      },
    ],
  },
  {
    slug: "ladder-and-roof-fall-safety",
    version: 1,
    title: "Ladder use and fall protection on roofs",
    approver: "owner",
    passMarkPercent: 80,
    placeholder: "Awaiting Robert: this is the firm's own safety course on ladder use and fall protection on roofs, and Robert writes it.",
    lessons: [],
  },
];

/** Both courses are required before a field technician is enrolled (Robert, P3). */
export const REQUIRED_COURSES: readonly string[] = ["duties-and-protocols", "ladder-and-roof-fall-safety"];

/** The version of each protocol's transcription today, so a lesson naming an older one reads out of date. */
export function currentProtocolVersion(documentNumber: string): string | null {
  if (documentNumber === RC001.documentNumber) return RC001.version;
  return SIGNABLE_PROTOCOLS.find((p) => p.documentNumber === documentNumber)?.version ?? null;
}
