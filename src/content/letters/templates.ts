/**
 * ===========================================================================
 * THE LETTER TEMPLATES THE ENGINEER SIGNS. Migration 0088, Robert's
 * instruction of 2026-10-24.
 * ===========================================================================
 *
 * A line's letter seals only from a template he has signed in his portal, as he
 * signs a protocol. What he signs is the template's fixed text as this platform
 * holds it and prints it: every line in his order, the slots as written, and
 * each determination's sentence labelled with the determination it belongs to.
 * The text is flattened from the same constants the drafts print from, so the
 * words he signs are the words a letter carries; a change to any of them after
 * he signs reads as void (src/lib/letter-template-sign.ts).
 *
 * A template is keyed by the protocol whose letter it is, and versioned by the
 * date of the answered template file its words come from.
 *
 * Only letters that are built are here. Manufactured home, solar and the
 * WPI-8E reports have no template until he adopts their wording.
 */
import { ROOF_LETTER_DETERMINATION_SENTENCE, ROOF_LETTER_LINES, ROOF_LETTER_SECTION } from "./roof-certification";
import {
  FOUNDATION_LETTER_LINES,
  FOUNDATION_LETTER_METHOD,
  FOUNDATION_LETTER_OPTION_SENTENCE,
  FOUNDATION_LETTER_SECTION,
} from "./foundation-certification";
import {
  STRUCTURAL_LETTER_BASIS,
  STRUCTURAL_LETTER_HEAD,
  STRUCTURAL_LETTER_LIMITATIONS,
  STRUCTURAL_LETTER_OPENING,
  STRUCTURAL_LETTER_OPTION_SENTENCE,
  STRUCTURAL_LETTER_REQUIREMENT,
  STRUCTURAL_LETTER_SECTION,
} from "./structural-letter";

export type LetterTemplate = {
  /** The protocol whose letter this is. */
  key: string;
  version: string;
  title: string;
  /** Where in his answered template file the words are. */
  section: string;
  /** What he reads and signs, one line per line. */
  text: readonly string[];
};

type Flat = string | readonly unknown[] | { readonly [k: string]: unknown };

/* Every string, in declared order: a line object prints its text, a keyed set prints "key: sentence". */
function flatten(value: Flat, label = ""): string[] {
  if (typeof value === "string") return [label ? `${label}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap((v) => flatten(v as Flat, label));
  const o = value as Record<string, unknown>;
  /* A line whose words are filled from the determination or the record shows where, by its kind. */
  if (typeof o.kind === "string" && ("text" in o || o.kind === "determination" || o.kind === "observed")) {
    return [typeof o.text === "string" && o.text.trim() ? o.text : `[${o.kind}]`];
  }
  return Object.entries(o).flatMap(([k, v]) => flatten(v as Flat, label ? `${label} ${k}` : k));
}

export const LETTER_TEMPLATES: readonly LetterTemplate[] = [
  {
    key: "254-RC-001",
    version: "2026-10-06",
    title: "Roof certification letter",
    section: ROOF_LETTER_SECTION,
    text: [...flatten(ROOF_LETTER_LINES), ...flatten(ROOF_LETTER_DETERMINATION_SENTENCE)],
  },
  {
    key: "254-FC-001",
    version: "2026-10-06",
    title: "Foundation certification letter",
    section: FOUNDATION_LETTER_SECTION,
    text: [
      ...flatten(FOUNDATION_LETTER_LINES),
      ...flatten(FOUNDATION_LETTER_OPTION_SENTENCE),
      ...flatten(FOUNDATION_LETTER_METHOD, "method"),
    ],
  },
  {
    key: "254-PL-001",
    version: "2026-10-06",
    title: "Structural letter for permit",
    section: STRUCTURAL_LETTER_SECTION,
    text: [
      ...flatten(STRUCTURAL_LETTER_HEAD),
      ...flatten(STRUCTURAL_LETTER_OPENING),
      STRUCTURAL_LETTER_REQUIREMENT,
      ...flatten(STRUCTURAL_LETTER_BASIS, "basis"),
      ...flatten(STRUCTURAL_LETTER_OPTION_SENTENCE, "option"),
      ...flatten(STRUCTURAL_LETTER_LIMITATIONS, "limitations"),
    ],
  },
];

export const letterTemplateFor = (key: string) => LETTER_TEMPLATES.find((t) => t.key === key) ?? null;
