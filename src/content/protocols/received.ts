import { DS001, DS001_COUNTS, DS001_OTHER_RULES, DS001_BLANK_JOB_LIST_ITEMS } from "./ds-001";
import { MH001, MH001_COUNTS, MH001_OTHER_RULES, MH001_BLANK_JOB_LIST_ITEMS } from "./mh-001";
import { PL001, PL001_COUNTS, PL001_OTHER_RULES, PL001_BLANK_JOB_LIST_ITEMS } from "./pl-001";
import { RS001, RS001_COUNTS, RS001_OTHER_RULES, RS001_BLANK_JOB_LIST_ITEMS } from "./rs-001";
import { SL001, SL001_COUNTS, SL001_OTHER_RULES, SL001_BLANK_JOB_LIST_ITEMS } from "./sl-001";
import { WP001, WP001_COUNTS, WP001_OTHER_RULES, WP001_BLANK_JOB_LIST_ITEMS } from "./wp-001";
import { WS001, WS001_COUNTS, WS001_OTHER_RULES, WS001_BLANK_JOB_LIST_ITEMS } from "./ws-001";

/**
 * ===========================================================================
 * PROTOCOLS RECEIVED AND NOT SIGNED. They are transcribed, and they drive nothing.
 * ===========================================================================
 *
 * The engineer of record issued seven protocols as v1.1 on 2026-10-06, as PDFs
 * with his typed name on the approval line and no signature. Under ruling 2a of
 * that day he signs each one in the portal, from his own session, and that
 * mechanism is not built yet. Until it is, each of them is a document the firm
 * HOLDS, not a protocol it RUNS.
 *
 * SO THEY ARE NOT IN `PROTOCOL_ENTRIES`, ON PURPOSE. That list is read by the
 * line gate, by the intake bridge (every entry adds intake fields to the order
 * forms), by the review screen's determinations and by the seed script.
 * Registering an unsigned protocol there would put its questions in front of a
 * customer and its rules in front of the engineer before he has signed a word
 * of it, which is the dormant-register defect CLAUDE.md section 7 records twice:
 * a register that is empty today decides what becomes true the day somebody
 * fills it. A protocol moves from this list to that one in the same change that
 * records his signature, and not before.
 *
 * WHAT IS PROVED, by protocol-registry-audit section 8, against the PDF on disk
 * rather than against this file:
 *   - each PDF's SHA-256 is the figure recorded when it was committed unedited,
 *     pinned as a literal in the audit;
 *   - each `text` is the whole document, compared with whitespace removed, in
 *     BOTH directions: nothing in the PDF is missing here and nothing here is
 *     absent from the PDF;
 *   - every structured string (question, upload, checklist line, criterion,
 *     photo step, capture field, heading) appears in the PDF word for word, and
 *     the counts of each equal counts taken from the PDF by marker alone;
 *   - none of the seven is reachable from the line gate or the intake forms.
 *
 * WHAT IS NOT PROVED, and is said so. Where a WP-001 table cell ends and the
 * next begins is a reading of the table's layout, not a string the document
 * contains; the words and their order are proved, the boundaries are not.
 *
 * WP-001 AND WS-001 BOTH DESCRIBE `windstorm-wpi-8`, as ongoing construction
 * (WPI-8) and completed construction (WPI-8E). The line has no tier today, so
 * `serviceTier` records which document covers which, and choosing between them
 * at order time is a question for the day they are signed.
 */
export type ReceivedProtocol = {
  declaration:
    | typeof DS001
    | typeof MH001
    | typeof PL001
    | typeof RS001
    | typeof SL001
    | typeof WP001
    | typeof WS001;
  /** Capture fields printed on the checklist, verbatim. */
  counts: readonly { key: string; prompt: string; at: string }[];
  /** Decision rules that are not the five determinations. DS-001 decides by acceptance and an issue check. */
  otherRules: readonly { key: string; heading: string; effect: string | null; criteria: string[]; at: string }[];
  /** Checklist lines the document leaves blank for the engineer to write per job. */
  blankJobListItems: number;
  /** Always "unsigned" in this list. A signed protocol is registered in `PROTOCOL_ENTRIES` instead. */
  status: "unsigned";
};

export const RECEIVED_PROTOCOLS: readonly ReceivedProtocol[] = [
  { declaration: WP001, counts: WP001_COUNTS, otherRules: WP001_OTHER_RULES, blankJobListItems: WP001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
  { declaration: WS001, counts: WS001_COUNTS, otherRules: WS001_OTHER_RULES, blankJobListItems: WS001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
  { declaration: MH001, counts: MH001_COUNTS, otherRules: MH001_OTHER_RULES, blankJobListItems: MH001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
  { declaration: SL001, counts: SL001_COUNTS, otherRules: SL001_OTHER_RULES, blankJobListItems: SL001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
  { declaration: PL001, counts: PL001_COUNTS, otherRules: PL001_OTHER_RULES, blankJobListItems: PL001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
  { declaration: RS001, counts: RS001_COUNTS, otherRules: RS001_OTHER_RULES, blankJobListItems: RS001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
  { declaration: DS001, counts: DS001_COUNTS, otherRules: DS001_OTHER_RULES, blankJobListItems: DS001_BLANK_JOB_LIST_ITEMS, status: "unsigned" },
];
