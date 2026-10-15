/**
 * ===========================================================================
 * WHAT THE ENGINEER OF RECORD HAS DIRECTED, IN WRITING, WITH THE WRITING.
 * ===========================================================================
 *
 * WHY THIS IS ITS OWN DECLARATION RATHER THAN PROSE IN A BACKLOG ENTRY.
 * A direction from the engineer of record is the authority behind a decision
 * this platform then enforces: which discipline governs a service line, whether
 * a named person meets a protocol's qualification requirement, what conditions
 * attach to a deliverable. Those are not operator preferences. They are the
 * judgement of the licensee who answers for the seal, and the platform acts on
 * them.
 *
 * SO EACH ONE CARRIES ITS EVIDENCE, DIGESTED. The same rule the credential
 * register runs on: a record saying "the engineer said" without saying WHERE he
 * said it reads as evidence and is a statement somebody typed. The digest binds
 * the record to one file, so a replaced or edited artifact is detectable rather
 * than invisible.
 *
 * AND EACH ONE SEPARATES WHAT IT ESTABLISHES FROM WHAT IT DOES NOT. An engineer
 * saying he is AVAILABLE to conduct training has not conducted it. That
 * distinction is where a compliance record quietly becomes false, so every
 * entry states what remains owed, and an empty `stillOwed` is a claim in itself.
 *
 * WHAT THIS IS NOT. It is not a protocol, it does not carry sealed work, and
 * nothing here may be read as the engineer approving anything in the platform.
 * Approval is an act in his own session through `eng_approve_protocol`, and no
 * declaration substitutes for it.
 */

export type EngineerDirection = {
  /** Short key, used in prose and by checks. */
  key: string;
  /** The engineer, as the register names him. */
  from: string;
  /** ISO date the direction was given. */
  on: string;
  /**
   * How it arrived, so nobody reads an email as a signed instrument. "email,
   * attested by the operator" is weaker again than "email": the evidence is the
   * operator's written statement of the engineer's words, not the email.
   */
  medium: "email" | "email, attested by the operator" | "signed document" | "portal";
  /** The artifact, digested. Never null: a direction with no evidence is not recorded. */
  evidence: { file: string; sha256: string; bytes: number };
  /** His words, verbatim, punctuation included. Never paraphrased. */
  quote: string;
  /** What the platform may act on because of this. */
  establishes: string;
  /** What this does NOT establish, and what is still owed. Empty is a claim. */
  stillOwed: string[];
};

/**
 * THE EVIDENCE IS A SCREENSHOT OF AN EMAIL, AND THAT IS SAID PLAINLY.
 *
 * Operator ruling, 2026-09-21: "An email is writing." It is, and it is weaker
 * evidence than a signed document in one specific way worth naming rather than
 * glossing: a screenshot shows what was rendered in one mail client at one
 * moment. It carries no cryptographic signature and cannot be re-derived from
 * the mail server later without going back to the mailbox.
 *
 * That is recorded here rather than argued about, on the same principle as
 * `RC001_SIGNATURE_EVIDENCE`: state what the artifact can and cannot support,
 * so nobody later reads "the engineer accepted in writing" as more than it is.
 */
export const engineerDirections: EngineerDirection[] = [
  {
    key: "technician-qualification-accepted",
    from: "Aman Dhakal, P.E., Engineer of Record",
    on: "2026-09-21",
    medium: "email",
    evidence: {
      file:
        "docs/compliance/Portal-password-tonight-254-RC-001-v1-1-approval-tomorrow-" +
        "support-254engineering-com-254-Engineering®-Mail-09-21-2026_08_56_PM.png",
      sha256: "d52911eb533574cd43282ec97dbb593917a19bdf43af5f4343524767642a215d",
      bytes: 517132,
    },
    quote:
      "Given your experience in the field, you meet the necessary qualifications. I am available to " +
      "handle the training and conduct supervised inspections when required.",
    establishes:
      "254-RC-001 section 5 permits a technician qualified by 'equivalent experience the engineer " +
      "accepts in writing'. This is that acceptance, for the operator, given by the engineer of " +
      "record and held on disk.",
    stillOwed: [
      "The TRAINING itself. He states he is AVAILABLE to handle it. Available is not delivered, and " +
      "nothing records that any training has occurred.",
      "The SUPERVISED INSPECTION that section 5 requires before independent work. Same distinction: " +
      "he offers to conduct it, and no inspection is recorded.",
      "A record of either, when they happen, with a date and his confirmation. Until then this " +
      "acceptance covers the qualification limb of section 5 and neither of the other two.",
    ],
  },
  {
    key: "roof-certification-discipline",
    from: "Aman Dhakal, P.E., Engineer of Record",
    on: "2026-09-21",
    medium: "email",
    evidence: {
      file:
        "docs/compliance/Portal-password-tonight-254-RC-001-v1-1-approval-tomorrow-" +
        "support-254engineering-com-254-Engineering®-Mail-09-21-2026_08_56_PM.png",
      sha256: "d52911eb533574cd43282ec97dbb593917a19bdf43af5f4343524767642a215d",
      bytes: 517132,
    },
    quote: "Regarding the roof certification, Structural Engineering governs this requirement.",
    establishes:
      "The discipline 254-RC-001 requires, which the registry has carried as null since it was " +
      "transcribed BECAUSE it is the engineer's answer and is never inferred from the words 'roof " +
      "certification'. It is the value migration 0056 writes to requires_discipline.",
    stillOwed: [
      "Nothing for the discipline itself. The value is stated and it is his to state.",
      "His APPROVAL of 254-RC-001 in the platform, which is a separate act in his own session and " +
      "is not implied by naming the discipline.",
    ],
  },
  {
    key: "desktop-and-solar-letter-conditions",
    from: "Aman Dhakal, P.E., Engineer of Record",
    on: "2026-09-21",
    medium: "email",
    evidence: {
      file:
        "docs/compliance/Portal-password-tonight-254-RC-001-v1-1-approval-tomorrow-" +
        "support-254engineering-com-254-Engineering®-Mail-09-21-2026_08_56_PM.png",
      sha256: "d52911eb533574cd43282ec97dbb593917a19bdf43af5f4343524767642a215d",
      bytes: 517132,
    },
    quote:
      "For the desktop and solar letters, I would issue those from documents and photos alone, " +
      "provided we set a required evidence list up front and the letter states the opinion relies on " +
      "the materials submitted with no site visit performed. Before a protocol for either, find out " +
      "whether the AHJs and the solar installers or utilities will actually accept a letter that " +
      "isn't backed by a site visit.",
    establishes:
      "That he WOULD issue desktop and solar structural letters without a site visit, and the three " +
      "conditions attached to that willingness. Recorded as CONDITIONS rather than as a decision to " +
      "build: two of the three are preconditions on the protocol existing at all.",
    stillOwed: [
      "CONDITION ONE, a required evidence list, agreed up front. Nothing exists. It is the engineer's " +
      "to state, because it decides what an opinion may rest on.",
      "CONDITION TWO, a reliance statement on the letter itself, saying the opinion relies on the " +
      "materials submitted and that no site visit was performed. No letter template exists, and " +
      "standing law says this platform never composes a sealed document, so this is language HE puts " +
      "on the instrument he seals rather than anything rendered here.",
      "CONDITION THREE, and it gates the other two: confirmation that the authorities having " +
      "jurisdiction, and the solar installers or utilities, will actually accept a letter not backed " +
      "by a site visit. He puts this BEFORE a protocol. So the next action on these lines is market " +
      "enquiry by a person, not protocol work.",
      "No protocol work has been done or may be done on either line until condition three is answered.",
    ],
  },
  {
    key: "every-service-is-structural",
    from: "Aman Dhakal, P.E., Engineer of Record",
    on: "2026-10-14",
    medium: "email, attested by the operator",
    evidence: {
      file: "docs/compliance/2026-10-14-operator-attestation-aman-required-discipline.txt",
      sha256: "0df5d9af2545913a3971120699a5112874a162b2caad3781946272029ab4d08f",
      bytes: 979,
    },
    quote:
      "Everything we do will be under structural as we will be doing structural observations and " +
      "structural calculations if required. We won’t be covering any architectural or MEP aspects in " +
      "any of the services.",
    establishes:
      "The discipline every protocol on the signable list requires: structural, the value migration " +
      "0077 writes to requires_discipline for the eight rows in DISCIPLINE_BY_PROTOCOL below. It " +
      "answers the question sent to him on 2026-10-14 about MH, SL, PL, RS and DS v1.1 and FC-001 " +
      "v1.0; his words say everything we do, so WP-001 v1.2 and WS-001 v1.1 are covered by the same " +
      "sentence. And the firm's scope: no architectural and no mechanical, electrical or plumbing work " +
      "in any service.",
    stillOwed: [
      "The email itself. The evidence held is the operator's written attestation of its words, saved " +
      "on his instruction of 2026-10-14; the email is not on disk.",
      "His SIGNATURE on WP-001 v1.2, WS-001 v1.1 and FC-001 v1.0, and his APPROVAL of each protocol in " +
      "the platform. Naming the discipline is neither.",
      "Where the scope statement appears to a customer, which waits on the operator's ruling of the " +
      "wording; until then it is recorded here and rendered nowhere.",
    ],
  },
];

/**
 * THE DISCIPLINE EACH PROTOCOL REQUIRES, AND THE DIRECTION IT COMES FROM.
 * One home: migration 0077 writes exactly these rows, each found by its
 * document's SHA-256, and protocol-registry-audit reads the migration back
 * against this list. WP-001 v1.1 is not here, by the operator's ruling of
 * 2026-10-14: v1.2 supersedes it, and it will never be signed or approved.
 * RC-001 is not here because 0056 already records its discipline.
 */
export const DISCIPLINE_BY_PROTOCOL: readonly {
  documentNumber: string;
  version: string;
  documentSha256: string;
  discipline: "structural";
  direction: string;
}[] = [
  { documentNumber: "254-MH-001", version: "1.1", documentSha256: "5c88c73d9815cfae6825ef82d4368dd66a98dce746deed91b3c351cf2df09d4a", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-SL-001", version: "1.1", documentSha256: "7bac29a7021086a7a40906021de5be9c2c2efaba747db33877410dd7b5c4e8f3", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-PL-001", version: "1.1", documentSha256: "f1ff2e5883aac06ac1b468a74ea09535c074a468a31de4c04297bf4c74b11387", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-RS-001", version: "1.1", documentSha256: "c7913d6637f2a08b1cd09a49c1767c682895db864143005a07bba99def8c2dd2", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-DS-001", version: "1.1", documentSha256: "37dd6b2e44155108df1daa681277332ddb64450a0f58813979e538da469ee22b", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-WS-001", version: "1.1", documentSha256: "f4cbe248957298bbae6d968350d3732ef3197b46684959c6ec083f494f3ed6b5", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-WP-001", version: "1.2", documentSha256: "635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4", discipline: "structural", direction: "every-service-is-structural" },
  { documentNumber: "254-FC-001", version: "1.0", documentSha256: "264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d", discipline: "structural", direction: "every-service-is-structural" },
];

/** Every direction that still carries something owed. The list for a sitting. */
export function directionsWithOutstandingWork(): EngineerDirection[] {
  return engineerDirections.filter((d) => d.stillOwed.length > 0);
}
