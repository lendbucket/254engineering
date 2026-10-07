import {
  ROOF_LETTER_DETERMINATION_SENTENCE,
  ROOF_LETTER_LINES,
  ROOF_LETTER_SLOTS,
  type RoofLetterDetermination,
  type RoofLetterSlot,
} from "@/content/letters/roof-certification";

/**
 * ===========================================================================
 * THE DRAFT OF A ROOF CERTIFICATION LETTER. PURE: FACTS IN, LINES OUT.
 * ===========================================================================
 *
 * CLAUDE.md section 1, operator ruling of 2026-10-06: "The platform drafts each
 * letter from the fixed sentence for the determination the engineer records."
 * This is that drafting, and it is deliberately small:
 *
 *   - every sentence is the engineer's, from src/content/letters/roof-
 *     certification.ts, which a proof compares against his Word file;
 *   - every {{slot}} is a fact handed in by the caller, read from the file;
 *   - the determination picks ONE of his three sentences, by key, so the
 *     recorded determination and the letter cannot say different things.
 *
 * IT REFUSES RATHER THAN FILLING A GAP. A slot with no value is named in
 * `missing` and no lines are returned, because a letter with a blank where the
 * county goes, or a determination that is not one of the three that produce a
 * letter, is a letter nobody should be able to seal. Revise and site revisit
 * send a job back rather than to a customer, so they are refused here by name.
 *
 * NOTHING HERE TOUCHES A SEAL IMAGE. Rendering with the seal happens only in
 * the sealing step (src/lib/letter-seal.ts), which is the one reader of the
 * images, control 2 in docs/sealing-controls.md.
 */

export type LetterFacts = Record<RoofLetterSlot, string | null | undefined>;

export type DraftLine = { kind: "date" | "recipient" | "re" | "salutation" | "body" | "heading" | "determination"; text: string };

export type LetterDraft =
  | { ok: true; lines: DraftLine[]; determination: RoofLetterDetermination }
  | { ok: false; why: string; missing: RoofLetterSlot[] };

const PRODUCES_A_LETTER = Object.keys(ROOF_LETTER_DETERMINATION_SENTENCE) as RoofLetterDetermination[];

export function producesLetter(determination: string): determination is RoofLetterDetermination {
  return (PRODUCES_A_LETTER as string[]).includes(determination);
}

export function draftRoofLetter(determination: string, facts: LetterFacts): LetterDraft {
  if (!producesLetter(determination)) {
    return {
      ok: false,
      why:
        `A ${determination} determination produces no letter. Only pass, repairs required and decline do, ` +
        "each with the engineer's own sentence; revise and site revisit send the job back.",
      missing: [],
    };
  }

  const missing = ROOF_LETTER_SLOTS.filter((s) => {
    const v = facts[s];
    return typeof v !== "string" || v.trim() === "";
  });
  if (missing.length > 0) {
    return {
      ok: false,
      why: `The letter cannot be drafted until the file holds: ${missing.join(", ")}. A letter is never sealed with a gap.`,
      missing,
    };
  }

  const fill = (text: string) => text.replace(/{{([a-z_]+)}}/g, (_, slot: RoofLetterSlot) => (facts[slot] as string).trim());

  const lines: DraftLine[] = ROOF_LETTER_LINES.map((line) =>
    line.kind === "determination"
      ? { kind: "determination", text: ROOF_LETTER_DETERMINATION_SENTENCE[determination] }
      : { kind: line.kind, text: fill(line.text) },
  );
  return { ok: true, lines, determination };
}

/** A date as the letter prints it, in the firm's own time zone: "October 7, 2026". */
export function letterDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}
