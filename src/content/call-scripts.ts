/**
 * ===========================================================================
 * THE PRINTABLE CALL SCRIPTS (C7). Robert's rulings of 2026-11-14 on issue #1:
 * the roof script approved with one correction (answer 6 to 6878458673: "line 9
 * is always said; the not taking payment line is only for a gate that is
 * shut"), and the other four call types approved as drafted (6879119977).
 * ===========================================================================
 *
 * The rep's lines are his approved words, carried exactly. What a line marks
 * as the service's questions is NOT written here: the page renders
 * fieldsFor(service, deliverable), the one definition New job asks from, so the
 * script and the form cannot disagree, and a protocol's questions arrive in the
 * engineer's own words.
 *
 * A segment is something the rep SAYS (quoted on the page) or DOES (an
 * instruction, never read aloud). A line can carry:
 *   questions: the service's questions go here (the document, the people and
 *              the property, as New job groups them)
 *   access:    the "Getting in" questions go here, so nothing is asked twice
 *   payment:   the payment link line, said only where this deliverable can be
 *              ordered now; otherwise the shut gate sentence is printed in
 *              its place (src/app/portal/(app)/intake/script/page.tsx decides)
 *   continues: the rest of another script, from one of its lines
 */

export type ScriptSegment = { say: string } | { do: string };

export type ScriptLine = {
  segments: ScriptSegment[];
  questions?: true;
  access?: true;
  payment?: true;
  continues?: { script: CallType; fromLine: number };
};

export type CallType = "roof" | "returning" | "agent" | "partner" | "wpi8";

export type CallScript = {
  type: CallType;
  title: string;
  /** Fixed for the roof and WPI-8 scripts; chosen on the page for the other three. */
  deliverable: { serviceSlug: string; tier: string } | null;
  lines: ScriptLine[];
};

/** The approved sentence for a gate that is shut (answer 6 to 6878458673). */
export const SHUT_GATE_LINE = "We are not taking payment for this yet. We will call you as soon as we can.";

const GREETING = "Thank you for calling 254 Engineering. Can I take your name and the best number to reach you?";
const ADDRESS = "What is the address of the property, and which city and county is it in?";
const ACCESS = "Who will be at the property, and what number should the technician call? Is there a gate code, a dog or an alarm?";
const COPY = "Should anybody else receive a copy of the letter, an agent, a lender or a title company?";
const WHO_PAYS = "Who is paying for this?";
const PRICE = "The price for this is [read from the screen].";
const LINK = "I am sending you a secure payment link by email now.";

export const CALL_SCRIPTS: Record<CallType, CallScript> = {
  roof: {
    type: "roof",
    title: "A new caller who needs a roof certification",
    deliverable: { serviceSlug: "roof-inspections", tier: "standard" },
    lines: [
      { segments: [{ say: GREETING }] },
      { segments: [{ say: ADDRESS }] },
      { segments: [{ say: "Is this for a roof certification, or something else?" }] },
      {
        segments: [
          { say: "I have a few questions the engineer needs answered before anything is booked." },
          { do: "The protocol's questions follow, word for word." },
        ],
        questions: true,
      },
      { segments: [{ say: ACCESS }], access: true },
      { segments: [{ say: COPY }] },
      { segments: [{ say: WHO_PAYS }] },
      { segments: [{ say: PRICE }, { do: "Then the refund terms, read exactly as New job shows them, never paraphrased." }] },
      { segments: [{ say: LINK }], payment: true },
    ],
  },
  returning: {
    type: "returning",
    title: "A returning customer",
    deliverable: null,
    lines: [
      { segments: [{ say: GREETING }] },
      {
        segments: [
          { do: "The rep searches by name, phone or email and confirms:" },
          { say: "I have you as [name] at [email]. Is that still the best email for the letter and the payment link?" },
        ],
      },
      {
        segments: [
          { say: "Is this for the same property as before, or a new one?" },
          { do: "If it is new:" },
          { say: "What is the address, and which city and county is it in?" },
        ],
      },
      { segments: [{ say: "What do you need this time?" }, { do: "Then the service's questions, word for word." }], questions: true },
      { segments: [{ say: ACCESS }], access: true },
      { segments: [{ say: COPY }] },
      { segments: [{ say: WHO_PAYS }] },
      { segments: [{ say: PRICE }, { do: "Then the refund terms as New job shows them." }] },
      { segments: [{ say: LINK }], payment: true },
    ],
  },
  agent: {
    type: "agent",
    title: "An agent, lender or title company calling for a client",
    deliverable: null,
    lines: [
      { segments: [{ say: "Thank you for calling 254 Engineering. Can I take your name, your company, and the best number to reach you?" }] },
      {
        segments: [
          { say: "Who is the property owner or buyer, and how do we reach them?" },
          { do: "The rep records the owner as the client and the caller as a copy contact, with their role." },
        ],
      },
      { segments: [{ say: ADDRESS }] },
      {
        segments: [
          { say: "What does the letter need to say, and who should it be addressed to?" },
          { do: "Then the service's questions, word for word." },
        ],
        questions: true,
      },
      { segments: [{ say: "Is there a date it is needed by, such as a closing?" }, { do: "That becomes the due date." }] },
      {
        segments: [
          { say: "Who will let the technician in, and what number should the technician call?" },
          { do: "Then gate, pets and alarm." },
        ],
        access: true,
      },
      { segments: [{ say: "Who is paying for this, you or your client?" }, { do: "The payment link goes to whoever pays." }] },
      { segments: [{ say: PRICE }, { do: "Then the refund terms as New job shows them." }] },
      { segments: [{ say: "I am sending the secure payment link by email now to [the payer]." }], payment: true },
    ],
  },
  partner: {
    type: "partner",
    title: "A partner sending a homeowner",
    deliverable: null,
    lines: [
      { segments: [{ say: GREETING }] },
      {
        segments: [
          { say: "Did somebody send you to us? If they gave you a code, can you read it to me?" },
          { do: "The rep types it in Partner code. If it is not recognized, New job says so:" },
          { say: "Can you check that code with them?" },
        ],
      },
      {
        segments: [{ do: "The rest is the roof script from line 2, or the returning customer's lines if New job finds them." }],
        continues: { script: "roof", fromLine: 2 },
      },
    ],
  },
  wpi8: {
    type: "wpi8",
    title: "WPI-8, completed construction",
    deliverable: { serviceSlug: "windstorm-wpi-8", tier: "completed" },
    lines: [
      { segments: [{ say: GREETING }] },
      {
        segments: [
          { say: ADDRESS },
          { do: "New job says whether the county is inside the designated catastrophe area. If it is not:" },
          { say: "That address is outside the area where a WPI-8 applies, so this is not a job we can take for it." },
        ],
      },
      { segments: [{ say: "When was the work finished, and what was done?" }] },
      { segments: [{ say: "Is any of the work covered up now, so it cannot be seen?" }] },
      {
        segments: [{ do: "Then the service's own questions, word for word. These are the signed protocol's questions where one is in force." }],
        questions: true,
      },
      { segments: [{ say: ACCESS }], access: true },
      { segments: [{ say: "Should anybody else receive a copy, for example your insurance agent?" }] },
      { segments: [{ say: WHO_PAYS }] },
      { segments: [{ say: PRICE }, { do: "Then the refund terms as New job shows them." }] },
      { segments: [{ say: LINK }], payment: true },
    ],
  },
};

export const CALL_TYPES: CallType[] = ["roof", "returning", "agent", "partner", "wpi8"];
