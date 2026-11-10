/**
 * RETURNED EVIDENCE: THE ENGINEER'S REQUEST, THE TECHNICIAN'S ANSWER, AND WHEN
 * THE PACKAGE MAY GO BACK. Robert's T5, 2026-11-07, and his answer 3 to the
 * technician app survey (6717223376, "your recs"):
 *
 *   "The engineer's note sits at the top of the job. The technician captures
 *    what was asked and writes a short reply, stored as a file event, then
 *    resubmits. A reply alone resubmits only when the note asked a question."
 *
 * The request is the file event the review decision already writes: kind
 * `status`, to_status `revisions_requested`, body the engineer's note
 * (eng_record_review_decision, 0004 onward). The reply is a file event of kind
 * `revision.reply`, written by the assigned technician. Both are rows in the
 * append only timeline, so neither is ever edited: a second reply is a second
 * row, and the latest one is the answer shown.
 *
 * Pure, so the proof runs every rule with no database:
 * scripts/proofs/returned-evidence-is-answered-from-the-phone.mjs.
 */

export const REVISION_REPLY = "revision.reply";
export const REVISIONS_REQUESTED = "revisions_requested";

/** The shortest reply worth sending an engineer, and the longest the screen takes. */
export const REPLY_MIN = 3;
export const REPLY_MAX = 2000;

/** A file event as the timeline holds it. */
export type FileEventRow = { kind: string; to_status: string | null; body: string | null; at: string };

export type RevisionRound = {
  requestedAt: string;
  /** The engineer's note. The decision requires one for a revision, so it is never blank in practice. */
  note: string;
  /** The latest reply written after this request, or null. */
  reply: { at: string; body: string } | null;
};

/**
 * The most recent revision request and the latest reply after it. Null when
 * the file has never been sent back. Rows are ordered by their recorded time
 * here rather than trusted to arrive in sequence.
 */
export function latestRevision(events: FileEventRow[]): RevisionRound | null {
  const rows = events.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let round: RevisionRound | null = null;
  for (const row of rows) {
    if (row.kind === "status" && row.to_status === REVISIONS_REQUESTED) {
      round = { requestedAt: row.at, note: (row.body ?? "").trim(), reply: null };
    } else if (row.kind === REVISION_REPLY && round && Date.parse(row.at) >= Date.parse(round.requestedAt)) {
      round.reply = { at: row.at, body: (row.body ?? "").trim() };
    }
  }
  return round;
}

/**
 * Whether the engineer's note asked a question, read mechanically: it carries
 * a question mark. That is the reading of Robert's "when the note asked a
 * question" this platform can apply without a person; an engineer who asks
 * without a question mark gets the stricter rule, which needs new evidence.
 */
export function noteAsksAQuestion(note: string): boolean {
  return note.includes("?");
}

/** Null when the reply may be recorded, otherwise the sentence. */
export function replyRefusal(body: string): string | null {
  const text = body.trim();
  if (text.length < REPLY_MIN) return "Write a short reply to the engineer before sending it.";
  if (text.length > REPLY_MAX) return `Keep the reply under ${REPLY_MAX} characters. The photographs carry the detail.`;
  return null;
}

/**
 * Whether a package that was sent back may be submitted again. Null when it
 * may, otherwise the sentence the technician reads.
 *
 *   - Every return is answered: no resubmission without a reply written after
 *     the request.
 *   - And the thing asked for is captured: something new in the package since
 *     the request (a capture or an exception recorded after it), unless the
 *     note only asked a question, where the reply is the answer.
 */
export function resubmitRefusal(round: RevisionRound | null, newEvidenceSinceRequest: boolean): string | null {
  if (!round) return null;
  if (!round.reply) return "Reply to the engineer's note before submitting again. The reply goes with the package.";
  if (!newEvidenceSinceRequest && !noteAsksAQuestion(round.note)) {
    return "Capture what the engineer asked for before submitting again. Nothing has been added since the package came back.";
  }
  return null;
}
