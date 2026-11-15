/**
 * THE SENTENCES NEW JOB BUILDS FROM A FIELD'S LABEL, IN ONE PURE HOME.
 *
 * A label written by a protocol is often already a sentence with its own mark
 * ("Who should the letter be addressed to?"). The after walk of 2026-11-14 read
 * "addressed to?, needed", "house have?." and "a permit.." because a comma or a
 * full stop was added to a label that already ended in one. 990ef3d fixed it in
 * the screen; Robert asked for a check over every Still needed and Can follow
 * sentence (2026-11-14), and a check needs these as functions it can call, so
 * they live here and the screen imports them.
 */

export type FollowStage = "dispatch" | "seal" | "order";

/** True when the label already ends as a sentence does. */
export function endsAsSentence(label: string): boolean {
  return /[.?!]$/.test(label.trim());
}

/** A label as a sentence: its own mark kept, a full stop added only when it has none. */
export function asSentence(label: string): string {
  const t = label.trim();
  return endsAsSentence(t) ? t : `${t}.`;
}

/** A "Still needed" line for a field the job cannot be taken without. */
export function stillNeededSentence(label: string): string {
  return asSentence(label);
}

/** A "Can follow" line: what the field is, and the step that waits for it. */
export function canFollowSentence(label: string, stage: FollowStage): string {
  const t = label.trim();
  const when = stage === "dispatch" ? "a technician is sent" : "it can be sealed";
  return endsAsSentence(t) ? `${t} Needed before ${when}.` : `${t}, needed before ${when}.`;
}
