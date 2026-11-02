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
 * COURSE 2 IS NOW DRAFTED, and still awaits Robert. His answer of 2026-11-02
 * replaced the placeholder with a draft from OSHA 29 CFR 1926 Subparts X and M
 * (see OSHA_SOURCES below). Written is not approved: it reads "Awaiting Robert"
 * until he approves exactly this content.
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

/*
 * COURSE 2'S SOURCES. Robert, 2026-11-02: "Draft course 2 (ladder use and roof
 * fall protection) from OSHA 29 CFR 1926 Subpart X and Subpart M, cited, marked
 * 'Awaiting Robert' for my approval." Each reading line is the regulation's own
 * text, prefixed with its section and paragraph, read from the eCFR versioner
 * API for title 29 as up to date on 2026-10-29. A course 2 lesson names the
 * subpart in place of a protocol, and this date in place of a version, so an
 * amended regulation is a reason to draft a new course version the same way a
 * new protocol version is. The owner approves it; until he does it reads
 * "Awaiting Robert" and graduates nobody (src/lib/academy.ts).
 */
export const OSHA_SUBPART_X = "29 CFR 1926 Subpart X";
export const OSHA_SUBPART_M = "29 CFR 1926 Subpart M";
export const OSHA_SOURCES: Readonly<Record<string, string>> = {
  [OSHA_SUBPART_X]: "eCFR 2026-10-29",
  [OSHA_SUBPART_M]: "eCFR 2026-10-29",
};

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
    placeholder: null,
    lessons: [
      {
        key: "osha-ladder-inspection",
        title: "Choosing and inspecting a ladder",
        teaches: { documentNumber: OSHA_SUBPART_X, version: OSHA_SOURCES[OSHA_SUBPART_X] },
        lines: [
          "1926.1053(b)(15) Ladders shall be inspected by a competent person for visible defects on a periodic basis and after any occurrence that could affect their safe use.",
          "1926.1053(b)(16) Portable ladders with structural defects, such as, but not limited to, broken or missing rungs, cleats, or steps, broken or split rails, corroded components, or other faulty or defective components, shall either be immediately marked in a manner that readily identifies them as defective, or be tagged with “Do Not Use” or similar language, and shall be withdrawn from service until repaired.",
          "1926.1053(b)(18) Ladder repairs shall restore the ladder to a condition meeting its original design criteria, before the ladder is returned to use.",
          "1926.1053(b)(2) Ladders shall be maintained free of oil, grease, and other slipping hazards.",
          "1926.1053(b)(3) Ladders shall not be loaded beyond the maximum intended load for which they were built, nor beyond their manufacturer's rated capacity.",
          "1926.1053(b)(4) Ladders shall be used only for the purpose for which they were designed.",
          "1926.1053(b)(12) Ladders shall have nonconductive siderails if they are used where the employee or the ladder could contact exposed energized electrical equipment, except as provided in § 1926.955(b) and (c) of this part.",
          "1926.1053(b)(19) Single-rail ladders shall not be used.",
          "1926.1053(a)(8) A metal spreader or locking device shall be provided on each stepladder to hold the front and back sections in an open position when the ladder is being used.",
        ],
        quiz: [
          {
            prompt: "You find a portable ladder with a split rail. What happens to it?",
            choices: ["It is used carefully until the end of the day", "It is marked as defective or tagged \"Do Not Use\", and withdrawn from service until repaired", "It is used only as a stepladder"],
            answer: 1,
            source: "shall either be immediately marked in a manner that readily identifies them as defective, or be tagged with “Do Not Use” or similar language, and shall be withdrawn from service until repaired.",
          },
          {
            prompt: "When is a ladder inspected for visible defects?",
            choices: ["Only when it is new", "On a periodic basis and after any occurrence that could affect its safe use", "Once a year by the manufacturer"],
            answer: 1,
            source: "Ladders shall be inspected by a competent person for visible defects on a periodic basis and after any occurrence that could affect their safe use.",
          },
          {
            prompt: "The work is near an overhead service drop that could be energized. What kind of ladder side rails are required?",
            choices: ["Nonconductive siderails", "Aluminum siderails", "Any siderails, if the ladder is new"],
            answer: 0,
            source: "Ladders shall have nonconductive siderails if they are used where the employee or the ladder could contact exposed energized electrical equipment",
          },
        ],
      },
      {
        key: "osha-ladder-use",
        title: "Setting up and climbing a ladder",
        teaches: { documentNumber: OSHA_SUBPART_X, version: OSHA_SOURCES[OSHA_SUBPART_X] },
        lines: [
          "1926.1053(b)(1) When portable ladders are used for access to an upper landing surface, the ladder side rails shall extend at least 3 feet (.9 m) above the upper landing surface to which the ladder is used to gain access; or, when such an extension is not possible because of the ladder's length, then the ladder shall be secured at its top to a rigid support that will not deflect, and a grasping device, such as a grabrail, shall be provided to assist employees in mounting and dismounting the ladder.",
          "1926.1053(b)(5)(i) Non-self-supporting ladders shall be used at an angle such that the horizontal distance from the top support to the foot of the ladder is approximately one-quarter of the working length of the ladder (the distance along the ladder between the foot and the top support).",
          "1926.1053(b)(6) Ladders shall be used only on stable and level surfaces unless secured to prevent accidental displacement.",
          "1926.1053(b)(7) Ladders shall not be used on slippery surfaces unless secured or provided with slip-resistant feet to prevent accidental displacement.",
          "1926.1053(b)(8) Ladders placed in any location where they can be displaced by workplace activities or traffic, such as in passageways, doorways, or driveways, shall be secured to prevent accidental displacement, or a barricade shall be used to keep the activities or traffic away from the ladder.",
          "1926.1053(b)(9) The area around the top and bottom of ladders shall be kept clear.",
          "1926.1053(b)(10) The top of a non-self-supporting ladder shall be placed with the two rails supported equally unless it is equipped with a single support attachment.",
          "1926.1053(b)(11) Ladders shall not be moved, shifted, or extended while occupied.",
          "1926.1053(b)(13) The top or top step of a stepladder shall not be used as a step.",
          "1926.1053(b)(20) When ascending or descending a ladder, the user shall face the ladder.",
          "1926.1053(b)(21) Each employee shall use at least one hand to grasp the ladder when progressing up and/or down the ladder.",
          "1926.1053(b)(22) An employee shall not carry any object or load that could cause the employee to lose balance and fall.",
        ],
        quiz: [
          {
            prompt: "An extension ladder gives access to a roof edge. How far must its side rails extend above the roof edge?",
            choices: ["At least 1 foot", "At least 3 feet", "It does not matter if someone holds the base"],
            answer: 1,
            source: "the ladder side rails shall extend at least 3 feet (.9 m) above the upper landing surface to which the ladder is used to gain access",
          },
          {
            prompt: "The ladder's working length to the gutter is 16 feet. About how far from the wall does its foot go?",
            choices: ["About 1 foot", "About 4 feet, one quarter of the working length", "About 8 feet, half the working length"],
            answer: 1,
            source: "the horizontal distance from the top support to the foot of the ladder is approximately one-quarter of the working length of the ladder",
          },
          {
            prompt: "The ladder stands in the client's driveway. What is required?",
            choices: ["Nothing, if the job is short", "Secure it to prevent accidental displacement, or barricade the traffic away from it", "Leave the hazard lights on in the truck"],
            answer: 1,
            source: "shall be secured to prevent accidental displacement, or a barricade shall be used to keep the activities or traffic away from the ladder.",
          },
          {
            prompt: "How do you climb with a camera and a clipboard?",
            choices: ["Face the ladder, keep at least one hand on it, and carry nothing that could cost your balance", "Carry both in your hands and climb slowly", "Climb facing away from the ladder to see the roof"],
            answer: 0,
            source: "An employee shall not carry any object or load that could cause the employee to lose balance and fall.",
          },
        ],
      },
      {
        key: "osha-roof-fall-protection",
        title: "Fall protection on low-slope and steep roofs",
        teaches: { documentNumber: OSHA_SUBPART_M, version: OSHA_SOURCES[OSHA_SUBPART_M] },
        lines: [
          "1926.500(b) Low-slope roof means a roof having a slope less than or equal to 4 in 12 (vertical to horizontal).",
          "1926.500(b) Steep roof means a roof having a slope greater than 4 in 12 (vertical to horizontal).",
          "1926.500(b) Unprotected sides and edges means any side or edge (except at entrances to points of access) of a walking/working surface, e.g., floor, roof, ramp, or runway where there is no wall or guardrail system at least 39 inches (1.0 m) high.",
          "1926.501(a)(2) The employer shall determine if the walking/working surfaces on which its employees are to work have the strength and structural integrity to support employees safely. Employees shall be allowed to work on those surfaces only when the surfaces have the requisite strength and structural integrity.",
          "1926.501(b)(1) Each employee on a walking/working surface (horizontal and vertical surface) with an unprotected side or edge which is 6 feet (1.8 m) or more above a lower level shall be protected from falling by the use of guardrail systems, safety net systems, or personal fall arrest systems.",
          "1926.501(b)(4)(i) Each employee on walking/working surfaces shall be protected from falling through holes (including skylights) more than 6 feet (1.8 m) above lower levels, by personal fall arrest systems, covers, or guardrail systems erected around such holes.",
          "1926.501(b)(10) Except as otherwise provided in paragraph (b) of this section, each employee engaged in roofing activities on low-slope roofs, with unprotected sides and edges 6 feet (1.8 m) or more above lower levels shall be protected from falling by guardrail systems, safety net systems, personal fall arrest systems, or a combination of warning line system and guardrail system, warning line system and safety net system, or warning line system and personal fall arrest system, or warning line system and safety monitoring system. Or, on roofs 50-feet (15.25 m) or less in width (see appendix A to subpart M of this part), the use of a safety monitoring system alone [i.e. without the warning line system] is permitted.",
          "1926.501(b)(11) Each employee on a steep roof with unprotected sides and edges 6 feet (1.8 m) or more above lower levels shall be protected from falling by guardrail systems with toeboards, safety net systems, or personal fall arrest systems.",
          "1926.500(b) Personal fall arrest system means a system used to arrest an employee in a fall from a working level. It consists of an anchorage, connectors, a body belt or body harness and may include a lanyard, deceleration device, lifeline, or suitable combinations of these. As of January 1, 1998, the use of a body belt for fall arrest is prohibited.",
        ],
        quiz: [
          {
            prompt: "A roof rises 6 inches for every 12 inches of run. Which kind of roof is it?",
            choices: ["Low-slope, because it is under 45 degrees", "Steep, because its slope is greater than 4 in 12", "Flat"],
            answer: 1,
            source: "Steep roof means a roof having a slope greater than 4 in 12 (vertical to horizontal).",
          },
          {
            prompt: "At what height above a lower level does an unprotected roof edge require fall protection?",
            choices: ["6 feet or more", "10 feet or more", "Only above the second story"],
            answer: 0,
            source: "with an unprotected side or edge which is 6 feet (1.8 m) or more above a lower level shall be protected from falling",
          },
          {
            prompt: "On a steep roof, which protection does 1926.501(b)(11) name?",
            choices: ["A warning line alone", "Guardrail systems with toeboards, safety net systems, or personal fall arrest systems", "A safety monitor alone"],
            answer: 1,
            source: "shall be protected from falling by guardrail systems with toeboards, safety net systems, or personal fall arrest systems.",
          },
          {
            prompt: "Can a body belt be used for fall arrest?",
            choices: ["Yes, if it is new", "No, its use for fall arrest has been prohibited since January 1, 1998", "Yes, on low-slope roofs only"],
            answer: 1,
            source: "As of January 1, 1998, the use of a body belt for fall arrest is prohibited.",
          },
        ],
      },
      {
        key: "osha-training-duties",
        title: "Training, certification of training and retraining",
        teaches: { documentNumber: OSHA_SUBPART_M, version: OSHA_SOURCES[OSHA_SUBPART_M] },
        lines: [
          "1926.1060(a) The employer shall provide a training program for each employee using ladders and stairways, as necessary. The program shall enable each employee to recognize hazards related to ladders and stairways, and shall train each employee in the procedures to be followed to minimize these hazards.",
          "1926.1060(b) Retraining shall be provided for each employee as necessary so that the employee maintains the understanding and knowledge acquired through compliance with this section.",
          "1926.503(a)(1) The employer shall provide a training program for each employee who might be exposed to fall hazards. The program shall enable each employee to recognize the hazards of falling and shall train each employee in the procedures to be followed in order to minimize these hazards.",
          "1926.503(b)(1) The employer shall verify compliance with paragraph (a) of this section by preparing a written certification record. The written certification record shall contain the name or other identity of the employee trained, the date(s) of the training, and the signature of the person who conducted the training or the signature of the employer.",
          "1926.503(c) When the employer has reason to believe that any affected employee who has already been trained does not have the understanding and skill required by paragraph (a) of this section, the employer shall retrain each such employee.",
          "1926.503(c)(2) Changes in the types of fall protection systems or equipment to be used render previous training obsolete; or",
        ],
        quiz: [
          {
            prompt: "What must the fall hazard training enable each employee to do?",
            choices: ["Recognize the hazards of falling, and follow the procedures that minimize them", "Inspect a roof faster", "Sign the job's safety form"],
            answer: 0,
            source: "The program shall enable each employee to recognize the hazards of falling and shall train each employee in the procedures to be followed in order to minimize these hazards.",
          },
          {
            prompt: "What does the written certification record of fall protection training contain?",
            choices: ["Only the course title", "The name or other identity of the employee, the date of the training, and the trainer's or employer's signature", "The employee's test score"],
            answer: 1,
            source: "The written certification record shall contain the name or other identity of the employee trained, the date(s) of the training, and the signature of the person who conducted the training or the signature of the employer.",
          },
          {
            prompt: "The firm changes the fall arrest equipment it issues. What follows?",
            choices: ["Nothing, training is done once", "Retraining, because a change in the equipment can render previous training obsolete", "A new ladder"],
            answer: 1,
            source: "Changes in the types of fall protection systems or equipment to be used render previous training obsolete",
          },
        ],
      },
    ],
  },
];

/** Both courses are required before a field technician is enrolled (Robert, P3). */
export const REQUIRED_COURSES: readonly string[] = ["duties-and-protocols", "ladder-and-roof-fall-safety"];

/** The version of each protocol's transcription today, so a lesson naming an older one reads out of date. */
export function currentProtocolVersion(documentNumber: string): string | null {
  if (documentNumber === RC001.documentNumber) return RC001.version;
  if (documentNumber in OSHA_SOURCES) return OSHA_SOURCES[documentNumber];
  return SIGNABLE_PROTOCOLS.find((p) => p.documentNumber === documentNumber)?.version ?? null;
}
