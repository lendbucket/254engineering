import { STRUCTURAL_LETTER_OPTION_SENTENCE, type StructuralLetterOption } from "@/content/letters/structural-letter";

/**
 * WHICH OF HIS THREE SENTENCES A STRUCTURAL LETTER FOR PERMIT CARRIES, OR WHY
 * NONE. Operator ruling, 2026-10-22, from the engineer's email that day
 * (docs/rulings-2026-10-22.md):
 *
 *   A  pass, no condition. A condition listed with A is refused: the letter
 *      would say "satisfies" with a schedule of conditions nobody reads.
 *   B  pass with at least one condition in the letter's schedule. B with an
 *      empty schedule is refused: it would promise "the conditions in the
 *      attached schedule" and attach none.
 *   C  repairs required. Not a pass.
 *   revise, site revisit, decline: no letter.
 *
 * The engineer chooses A or B on a pass; the platform never infers B from the
 * presence of a condition, because that would be choosing his sentence for him.
 * Every refusal is a sentence that says what to do, and sealing asks this
 * function before anything is rendered, so a refused letter is never sealed.
 */
export type StructuralLetterVerdict =
  | { ok: true; option: StructuralLetterOption; sentence: string; conditions: readonly string[] }
  | { ok: false; letter: false; why: string }
  | { ok: false; letter: true; why: string };

export function structuralLetterVerdict(input: {
  determination: string;
  /** His choice on a pass. Null on any other determination. */
  option: StructuralLetterOption | null;
  /** The conditions listed in the letter's schedule, in his words. */
  conditions: readonly string[];
}): StructuralLetterVerdict {
  const conditions = input.conditions.map((c) => c.trim()).filter((c) => c.length > 0);

  if (input.determination === "repairs-required") {
    if (input.option !== null && input.option !== "C") {
      return { ok: false, letter: true, why: `A repairs required determination takes option C, not option ${input.option}.` };
    }
    return { ok: true, option: "C", sentence: STRUCTURAL_LETTER_OPTION_SENTENCE.C, conditions: [] };
  }

  if (input.determination !== "pass") {
    return {
      ok: false,
      letter: false,
      why: `A ${input.determination} determination produces no letter. A pass takes option A or B, and repairs required takes option C.`,
    };
  }

  if (input.option === "A") {
    if (conditions.length > 0) {
      return {
        ok: false,
        letter: true,
        why: "Option A states the element is acceptable with no conditions, and conditions are listed. Choose option B, or remove the conditions.",
      };
    }
    return { ok: true, option: "A", sentence: STRUCTURAL_LETTER_OPTION_SENTENCE.A, conditions: [] };
  }

  if (input.option === "B") {
    if (conditions.length === 0) {
      return {
        ok: false,
        letter: true,
        why: "Option B issues the letter subject to the conditions in the attached schedule, and the schedule lists none. List the load limit or what the contractor must do, or choose option A.",
      };
    }
    return { ok: true, option: "B", sentence: STRUCTURAL_LETTER_OPTION_SENTENCE.B, conditions };
  }

  return {
    ok: false,
    letter: true,
    why: input.option === "C"
      ? "Option C is the repairs required sentence, and this determination is a pass. Record repairs required, or choose option A or B."
      : "A pass takes option A, acceptable with no conditions, or option B, acceptable with the conditions listed. Choose one.",
  };
}
