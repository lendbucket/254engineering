import {
  FOUNDATION_LETTER_LINES,
  FOUNDATION_LETTER_OPTION_SENTENCE,
  FOUNDATION_LETTER_SLOTS,
  type FoundationLetterDetermination,
  type FoundationLetterSlot,
} from "@/content/letters/foundation-certification";
import {
  STRUCTURAL_LETTER_BASIS,
  STRUCTURAL_LETTER_HEAD,
  STRUCTURAL_LETTER_LIMITATIONS,
  STRUCTURAL_LETTER_OPENING,
  STRUCTURAL_LETTER_OPTION_SENTENCE,
  STRUCTURAL_LETTER_REQUIREMENT,
} from "@/content/letters/structural-letter";
import { structuralLetterVerdict } from "./structural-letter-verdict";
import type { DraftLine } from "./letter-draft";

/**
 * ===========================================================================
 * THE FOUNDATION AND PERMIT LETTER DRAFTS. PURE: FACTS IN, LINES OUT.
 * ===========================================================================
 *
 * The same contract as the roof draft (letter-draft.ts): every sentence is the
 * engineer's (src/content/letters/foundation-certification.ts and
 * structural-letter.ts, each proved against his file), every {{slot}} is a fact
 * handed in by the caller, and a draft that cannot fill a slot is refused by
 * name rather than sealed with a gap.
 *
 * FOUNDATION (template 4), operator ruling FC-1 of 2026-10-23: pass gives
 * option A, repairs required gives B, a decline recorded at review gives C;
 * revise and site revisit give no letter. His observed condition is required,
 * because he wrote that the platform will not write it.
 *
 * PERMIT (template 7), operator rulings of 2026-10-22 and ruling 7 of
 * 2026-10-23: the option is the one recorded with the determination (0083)
 * and must pass the ruling's verdict; the basis sentence comes ONLY from his
 * triage record (PL-4), never from whether evidence exists; a desk job's
 * documents schedule is the evidence he marked relied on (PL-5); option B's
 * schedule is the conditions he recorded. Decline, revise and site revisit
 * give no letter.
 */

export type FcPlDraft =
  | { ok: true; lines: DraftLine[] }
  | { ok: false; why: string; missing: string[] };

const blank = (v: string | null | undefined) => typeof v !== "string" || v.trim() === "";

export function producesFoundationLetter(determination: string): determination is FoundationLetterDetermination {
  return Object.prototype.hasOwnProperty.call(FOUNDATION_LETTER_OPTION_SENTENCE, determination);
}

export function draftFoundationLetter(
  determination: string,
  facts: Record<FoundationLetterSlot, string | null | undefined>,
  observedCondition: string,
): FcPlDraft {
  if (!producesFoundationLetter(determination)) {
    return {
      ok: false,
      why: `A ${determination} determination produces no letter. Pass, repairs required and a decline recorded at review do (ruling FC-1); revise and site revisit send the job back.`,
      missing: [],
    };
  }
  const missing: string[] = FOUNDATION_LETTER_SLOTS.filter((s) => blank(facts[s]));
  if (observedCondition.trim().length < 10) missing.push("observed_condition");
  if (missing.length) {
    return { ok: false, why: `The letter cannot be drafted until it has: ${missing.join(", ")}. A letter is never sealed with a gap.`, missing };
  }
  const fill = (t: string) => t.replace(/{{([a-z_]+)}}/g, (_, s: FoundationLetterSlot) => (facts[s] as string).trim());
  const lines: DraftLine[] = FOUNDATION_LETTER_LINES.map((line) =>
    line.kind === "determination"
      ? { kind: "determination", text: FOUNDATION_LETTER_OPTION_SENTENCE[determination] }
      : line.kind === "observed"
        ? { kind: "body", text: observedCondition.trim() }
        : { kind: line.kind, text: fill(line.text) },
  );
  return { ok: true, lines };
}

export type PermitLetterFacts = {
  determination_date: string | null;
  authority_name: string | null;
  authority_address: string | null;
  authority_salutation: string | null;
  element_described: string | null;
  property_address: string | null;
  county: string | null;
  permit_number: string | null;
  file_number: string | null;
  requestor_name: string | null;
  authority_requirement_verbatim: string | null;
  visit_date: string | null;
  evidence_count: string | null;
};

export function draftPermitLetter(input: {
  determination: string;
  option: "A" | "B" | "C" | null;
  conditions: readonly string[];
  basis: "site" | "desk" | null;
  documents: readonly string[];
  facts: PermitLetterFacts;
}): FcPlDraft {
  const verdict = structuralLetterVerdict({ determination: input.determination, option: input.option, conditions: input.conditions });
  if (!verdict.ok) return { ok: false, why: verdict.why, missing: [] };
  if (!input.basis) {
    return { ok: false, why: "The job has no triage on record, and the letter's basis sentence comes only from it (PL-4). Record site or desk first.", missing: ["triage"] };
  }
  const f = input.facts;
  const needed: (keyof PermitLetterFacts)[] = [
    "determination_date", "authority_name", "authority_address", "authority_salutation", "element_described",
    "property_address", "county", "permit_number", "file_number", "requestor_name", "authority_requirement_verbatim",
    ...(input.basis === "site" ? (["visit_date", "evidence_count"] as const) : []),
  ];
  const missing: string[] = needed.filter((k) => blank(f[k]));
  if (input.basis === "desk" && input.documents.length === 0) missing.push("documents_schedule");
  if (missing.length) {
    return { ok: false, why: `The letter cannot be drafted until it has: ${missing.join(", ")}. A letter is never sealed with a gap.`, missing };
  }
  const fill = (t: string) => t.replace(/{{([a-z_]+)}}/g, (_, s: keyof PermitLetterFacts) => (f[s] as string).trim());
  const always = STRUCTURAL_LETTER_LIMITATIONS.always;
  const [date, recipient, re, salutation] = STRUCTURAL_LETTER_HEAD;
  const lines: DraftLine[] = [
    { kind: "date", text: fill(date) },
    { kind: "recipient", text: fill(recipient) },
    { kind: "re", text: fill(re) },
    { kind: "salutation", text: fill(salutation) },
    ...STRUCTURAL_LETTER_OPENING.map((t) => ({ kind: "body" as const, text: fill(t) })),
    { kind: "body", text: fill(STRUCTURAL_LETTER_REQUIREMENT) },
    { kind: "body", text: fill(input.basis === "site" ? STRUCTURAL_LETTER_BASIS.visit : STRUCTURAL_LETTER_BASIS.noVisit) },
    { kind: "determination", text: fill(STRUCTURAL_LETTER_OPTION_SENTENCE[verdict.option]) },
    { kind: "heading", text: "Scope and limitations" },
    { kind: "body", text: fill(always[0]) },
    ...(input.basis === "desk" ? STRUCTURAL_LETTER_LIMITATIONS.deskOnly.map((t) => ({ kind: "body" as const, text: fill(t) })) : []),
    ...always.slice(1).map((t) => ({ kind: "body" as const, text: fill(t) })),
  ];
  /*
   * THE ATTACHED SCHEDULE his sentences refer to. The documents, on a desk job
   * (PL-5: the evidence he marked relied on), and the conditions, on option B.
   * The heading and the two sub headings are the only words here that are not
   * his; each entry is a recorded fact.
   */
  const schedule: DraftLine[] = [];
  if (input.basis === "desk") {
    schedule.push({ kind: "body", text: "Documents relied on:" }, ...input.documents.map((d) => ({ kind: "body" as const, text: d })));
  }
  if (verdict.option === "B") {
    schedule.push({ kind: "body", text: "Conditions:" }, ...verdict.conditions.map((c) => ({ kind: "body" as const, text: c })));
  }
  if (schedule.length) lines.push({ kind: "heading", text: "Attached schedule" }, ...schedule);
  return { ok: true, lines };
}
