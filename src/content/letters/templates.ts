/**
 * ===========================================================================
 * THE LETTER TEMPLATES THE ENGINEER SIGNS. Migration 0088, Robert's
 * instruction of 2026-10-24, narrowed by his ruling 3 the same day.
 * ===========================================================================
 *
 * A manufactured home, solar or WPI-8E letter seals only from a template he
 * has signed in his portal, as he signs a protocol. What he signs is the
 * template's fixed text as this platform holds it and prints it: every line in
 * his order, the slots as written, and each determination's sentence labelled
 * with the determination it belongs to. A change to any of it after he signs
 * reads as void (src/lib/letter-template-sign.ts).
 *
 * NARROWED TO THE THREE DRAFTED LINES. Roof, foundation and permit letters
 * seal exactly as they did before 0088 and are not templates here: the
 * database refuses a template on them (0088's eng_seal_act_check), and a
 * template key outside TEMPLATE_ADOPTION_PROTOCOLS cannot be signed.
 *
 * NONE OF THE THREE HAS A TEMPLATE YET, and that is expected: their wording is
 * in the drafts document awaiting the engineer's adoption. Until a template is
 * added here from his adopted words and he signs it, those letters seal
 * nothing, so their lines stay closed.
 *
 * A template is keyed by the protocol whose letter it is, and versioned by the
 * date of the adopted wording its words come from.
 */

export type LetterTemplate = {
  /** The protocol whose letter this is: one of TEMPLATE_ADOPTION_PROTOCOLS. */
  key: string;
  version: string;
  title: string;
  /** Where in his adopted wording the words are. */
  section: string;
  /** What he reads and signs, one line per line. */
  text: readonly string[];
};

/** The protocols whose letters seal only from a signed template. The same three 0088 names. */
export const TEMPLATE_ADOPTION_PROTOCOLS: readonly string[] = ["254-MH-001", "254-SL-001", "254-WS-001"];

type Flat = string | readonly unknown[] | { readonly [k: string]: unknown };

/* Every string, in declared order: a line object prints its text, a keyed set prints "key: sentence". */
export function flatten(value: Flat, label = ""): string[] {
  if (typeof value === "string") return [label ? `${label}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap((v) => flatten(v as Flat, label));
  const o = value as Record<string, unknown>;
  /* A line whose words are filled from the determination or the record shows where, by its kind. */
  if (typeof o.kind === "string" && ("text" in o || o.kind === "determination" || o.kind === "observed")) {
    return [typeof o.text === "string" && o.text.trim() ? o.text : `[${o.kind}]`];
  }
  return Object.entries(o).flatMap(([k, v]) => flatten(v as Flat, label ? `${label} ${k}` : k));
}

/* Empty until the engineer adopts the drafted wording for a line. */
export const LETTER_TEMPLATES: readonly LetterTemplate[] = [];

export const letterTemplateFor = (key: string) =>
  TEMPLATE_ADOPTION_PROTOCOLS.includes(key) ? (LETTER_TEMPLATES.find((t) => t.key === key) ?? null) : null;

/** Does this protocol's letter seal only from a signed template? */
export const letterNeedsTemplate = (protocolDocument: string) => TEMPLATE_ADOPTION_PROTOCOLS.includes(protocolDocument);
