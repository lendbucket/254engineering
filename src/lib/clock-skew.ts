/**
 * ===========================================================================
 * THE THIRD TIME VALUE, AND THE VERDICT ON IT. 254-RC-001 section 9.
 * ===========================================================================
 *
 * The signed protocol, quoted:
 *
 *   "Photographs carry location and three time values from the field
 *    application: the time reported by the device, the server time at sync,
 *    and the difference between them. A device clock that disagrees with the
 *    server is recorded as disagreeing rather than presented as certain."
 *
 * The device time and the server time already existed. This is the third
 * value and the sentence about it.
 *
 * WHY A TOLERANCE AT ALL, AND WHY IT IS RULED RATHER THAN TUNED. Every clock
 * disagrees a little. A phone that is two seconds out has not told anybody
 * anything, and flagging it would make the flag meaningless within a week,
 * which is the mechanism by which a warning everybody dismisses becomes a
 * warning nobody reads.
 *
 * THE FIGURE IS THE OPERATOR'S, NOT A TUNING PARAMETER, and it is pinned in
 * the audit as section 6c requires, so moving it costs two edits made on
 * purpose. Sixty seconds: longer than any plausible network round trip on a
 * roof with one bar, short enough that a phone set to the wrong hour, the
 * wrong day or the wrong timezone is caught every time. Those are the errors
 * that actually happen, and they are all far larger than a minute.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: reject the photograph. A disagreeing
 * clock is recorded, not refused. The protocol says "recorded as disagreeing
 * rather than presented as certain", which is a statement about how evidence
 * is PRESENTED, and a technician on a roof with a wrong phone clock has still
 * taken the photograph the engineer needs. Throwing it away would lose the
 * observation to protect the timestamp.
 */

/**
 * THE RULED TOLERANCE, IN SECONDS.
 *
 * Pinned in `scripts/protocol-run-audit.mjs` as a literal. If that audit
 * fails on this number, it is asking whether you meant to move it.
 */
export const CLOCK_TOLERANCE_SECONDS = 60;

export type ClockReading = {
  /** Device clock minus server clock, signed. Negative means the device is behind. */
  skewSeconds: number;
  /** Whether that exceeds the ruled tolerance in either direction. */
  disagrees: boolean;
};

/**
 * The third value and its verdict, from the two the platform already has.
 *
 * SIGNED, AND THE SIGN IS KEPT. A device ahead of the server is as much a
 * disagreement as one behind, and is the commoner direction on a phone
 * somebody has set by hand. Taking an absolute value here would throw away
 * which way it was wrong, and "the photograph claims to have been taken in the
 * future" is a different conversation from "the phone is slow".
 *
 * THE COMPARISON IS ON THE ABSOLUTE VALUE even though the stored number is
 * signed, because the tolerance is about magnitude.
 *
 * RETURNS NULL WHEN EITHER TIME IS MISSING OR UNPARSEABLE, rather than
 * guessing a zero. The database then holds null for both columns, which is
 * "nobody measured it" and is a different state from "they agreed". 0057's
 * check constraint keeps that pair honest.
 */
export function clockReading(deviceIso: string | null, serverIso: string | null): ClockReading | null {
  if (!deviceIso || !serverIso) return null;

  const device = Date.parse(deviceIso);
  const server = Date.parse(serverIso);
  if (!Number.isFinite(device) || !Number.isFinite(server)) return null;

  const skewSeconds = Math.round((device - server) / 1000);
  return { skewSeconds, disagrees: Math.abs(skewSeconds) > CLOCK_TOLERANCE_SECONDS };
}

/**
 * The sentence a person reads beside a photograph.
 *
 * ONE HOME, because this appears on the technician's screen and on the
 * engineer's review screen, and those two saying it differently about the same
 * row is the defect this repository spends its time removing.
 *
 * THE UNMEASURED CASE HAS ITS OWN SENTENCE and does not borrow the agreeing
 * one. A row captured before 0057 has no reading, and rendering "the clocks
 * agreed" over it would be asserting a measurement nobody took, which is the
 * absent-versus-zero defect wearing a timestamp.
 */
export function clockSentence(reading: ClockReading | null): string {
  if (!reading) return "No clock comparison was recorded for this capture.";

  if (!reading.disagrees) {
    return `Device and server clocks agreed within ${CLOCK_TOLERANCE_SECONDS} seconds at sync (${reading.skewSeconds}s).`;
  }

  const ahead = reading.skewSeconds > 0;
  const magnitude = Math.abs(reading.skewSeconds);
  return (
    `The device clock disagreed with the server at sync: ${magnitude}s ${ahead ? "ahead" : "behind"}. ` +
    "The time this photograph reports is not certain."
  );
}
