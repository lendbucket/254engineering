import {
  MANUFACTURED_HOME_LETTER_LINES,
  MANUFACTURED_HOME_LETTER_OPTION,
  MANUFACTURED_HOME_LETTER_SLOTS,
  MANUFACTURED_HOME_NO_ADDITIONS,
  type ManufacturedHomeLetterDetermination,
  type ManufacturedHomeLetterSlot,
} from "@/content/letters/manufactured-home-certification";
import {
  SOLAR_LETTER_LINES,
  SOLAR_LETTER_OPTION,
  SOLAR_LETTER_SLOTS,
  type SolarLetterDetermination,
  type SolarLetterSlot,
} from "@/content/letters/solar-structural-letter";
import type { DraftLine } from "./letter-draft";

/**
 * ===========================================================================
 * THE MANUFACTURED HOME AND SOLAR LETTER DRAFTS. PURE: FACTS IN, LINES OUT.
 * ===========================================================================
 *
 * Item B of Robert's ruling of 2026-10-25, 23:51 Central: drafts are built only
 * from recorded facts (0087) and the drafted wording on file. The same contract
 * as the roof, foundation and permit drafts: every sentence is the wording on
 * file (src/content/letters/manufactured-home-certification.ts and
 * solar-structural-letter.ts, each proved against the drafts document and his
 * answered templates), every {{slot}} is a fact handed in by the caller, and a
 * draft that cannot fill a slot is refused by name rather than sealed with a
 * gap.
 *
 * Which determination gives which option is the wording's own: the
 * manufactured home's option A on pass and option B on repairs required, the
 * solar letter's option A on pass and option C on repairs required. Revise,
 * site revisit and decline give no letter, because the wording on file has
 * none for them.
 */

export type MhSlDraft = { ok: true; lines: DraftLine[] } | { ok: false; why: string; missing: string[] };

const blank = (v: string | null | undefined) => typeof v !== "string" || v.trim() === "";
const isNone = (v: string | null | undefined) => typeof v === "string" && /^none\.?$/i.test(v.trim());

export function producesManufacturedHomeLetter(determination: string): determination is ManufacturedHomeLetterDetermination {
  return Object.prototype.hasOwnProperty.call(MANUFACTURED_HOME_LETTER_OPTION, determination);
}

export function producesSolarLetter(determination: string): determination is SolarLetterDetermination {
  return Object.prototype.hasOwnProperty.call(SOLAR_LETTER_OPTION, determination);
}

function fillWith<S extends string>(facts: Record<S, string | null | undefined>) {
  return (t: string) => t.replace(/{{([a-z_]+)}}/g, (_, s: S) => (facts[s] as string).trim());
}

/** Section 1 of the drafts document. `named_requirement` is filled by the caller (HUD-7584, or refused). */
export function draftManufacturedHomeLetter(
  determination: string,
  facts: Record<ManufacturedHomeLetterSlot, string | null | undefined>,
): MhSlDraft {
  if (!producesManufacturedHomeLetter(determination)) {
    return {
      ok: false,
      why: `A ${determination} determination produces no manufactured home letter. Pass gives option A and repairs required gives option B; the wording on file has no letter for any other.`,
      missing: [],
    };
  }
  const missing: string[] = MANUFACTURED_HOME_LETTER_SLOTS.filter((s) => blank(facts[s]));
  if (missing.length) {
    return { ok: false, why: `The letter cannot be drafted until it has: ${missing.join(", ")}. A letter is never sealed with a gap.`, missing };
  }
  const fill = fillWith(facts);
  const lines: DraftLine[] = MANUFACTURED_HOME_LETTER_LINES.flatMap((line): DraftLine[] => {
    if (line.kind === "determination") {
      return MANUFACTURED_HOME_LETTER_OPTION[determination].map((text) => ({ kind: "determination", text: fill(text) }));
    }
    if (line.kind === "additions") {
      return [{ kind: "body", text: isNone(facts.additions_as_observed) ? MANUFACTURED_HOME_NO_ADDITIONS : fill(line.text) }];
    }
    return [{ kind: line.kind, text: fill(line.text) }];
  });
  return { ok: true, lines };
}

/** Section 2 of the drafts document. A recorded installer's survey date is refused: its sentence is not worded. */
export function draftSolarLetter(
  determination: string,
  facts: Record<SolarLetterSlot, string | null | undefined>,
  surveyDate: string | null,
): MhSlDraft {
  if (!producesSolarLetter(determination)) {
    return {
      ok: false,
      why: `A ${determination} determination produces no solar letter. Pass gives option A and repairs required gives option C; the wording on file has no letter for any other.`,
      missing: [],
    };
  }
  if (!blank(surveyDate)) {
    return {
      ok: false,
      why:
        "An installer's site survey date is recorded for this file. The wording on file says that case changes the date in a sentence of the engineer's own, and that sentence is not yet worded for it, so nothing was drafted.",
      missing: [],
    };
  }
  const missing: string[] = SOLAR_LETTER_SLOTS.filter((s) => blank(facts[s]));
  if (missing.length) {
    return { ok: false, why: `The letter cannot be drafted until it has: ${missing.join(", ")}. A letter is never sealed with a gap.`, missing };
  }
  const fill = fillWith(facts);
  const lines: DraftLine[] = SOLAR_LETTER_LINES.flatMap((line): DraftLine[] =>
    line.kind === "determination"
      ? SOLAR_LETTER_OPTION[determination].map((text) => ({ kind: "determination", text: fill(text) }))
      : [{ kind: line.kind, text: fill(line.text) }],
  );
  return { ok: true, lines };
}
