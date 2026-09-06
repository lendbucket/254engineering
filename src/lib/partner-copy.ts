import {
  ALL_REGULATED,
  NEVER_CLAIMS,
} from "../../scripts/lib/regulatory.mjs";
import { BANNED_PHRASES } from "../../scripts/lib/voice-blocklist.mjs";
import { isPrelaunch } from "./launch";

/**
 * Whether a piece of partner marketing copy may be published.
 *
 * WHY THE APPLICATION IMPORTS FROM scripts/, WHICH LOOKS BACKWARDS
 * ----------------------------------------------------------------
 * Because the alternative is two copies of the regulated vocabulary, and this
 * repository already knows exactly what that costs. The header of
 * scripts/lib/regulatory.mjs records it: two detectors carried their own lists,
 * the lists disagreed within a day, and the half that mattered was the stale
 * one.
 *
 * The audits are not the owner of that knowledge, they were merely its first
 * reader. A third reader, the code that decides whether a partner may publish a
 * sentence, has to ask the same question in the same words or the platform will
 * approve copy its own audit would fail.
 *
 * The unusual direction of the import is the smallest price available. Moving
 * the file into src/ would break the one property it depends on, which is that
 * it travels verbatim between three repositories at a known path.
 *
 * WHAT THIS ENFORCES, AND WHAT IT CANNOT
 * --------------------------------------
 * Non negotiable 2 of the partner programme: no partner surface may render a
 * service claim the public site could not. This makes the approved path
 * enforceable, so a copy block that would fail voice-audit cannot be published
 * into the asset library and cannot reach a partner.
 *
 * It does not stop a partner writing whatever they like on their own website.
 * Nothing in software does. The real control is the agreement, the right to
 * withdraw approval, and somebody looking at what partners publish. This makes
 * the approved path easy and the record complete, which is the honest limit and
 * is stated on the screen as well as here.
 */

type Pattern = { pattern: RegExp; why: string };

const REGULATED = ALL_REGULATED as Pattern[];
const NEVER = NEVER_CLAIMS as Pattern[];
const BANNED = BANNED_PHRASES as Pattern[];

export type CopyFinding = {
  kind: "regulated" | "never" | "voice" | "style";
  why: string;
  match: string;
};

export type CopyVerdict = {
  ok: boolean;
  findings: CopyFinding[];
  /** A sentence for the person who typed it, rather than a list of regexes. */
  summary: string;
};

/*
 * The style laws that apply to every rendered string this firm publishes, from
 * CLAUDE.md. They are here rather than only in an audit for the same reason the
 * regulated patterns are: an asset library is a place where copy is written by
 * somebody who has not read the standing law and published by a click.
 */
const STYLE: Pattern[] = [
  { pattern: /[—–]/, why: "an em dash or en dash, which this firm does not use" },
  {
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    why: "an emoji, which this firm does not use",
  },
  { pattern: /!/, why: "an exclamation mark" },
];

/**
 * Look at a piece of copy and say whether it may be published.
 *
 * THE REGULATED CHECK IS CONDITIONAL ON THE GATE AND THE OTHERS ARE NOT
 * ---------------------------------------------------------------------
 * A present tense service claim becomes publishable the day the firm is
 * registered and an engineer is in responsible charge, because on that day it
 * is true. A guaranteed approval never becomes publishable, and neither does an
 * em dash. Treating those three the same would mean the day the gate lifts,
 * either the guarantees become allowed or the claims stay blocked, and both are
 * wrong.
 */
export function copyVerdict(text: string): CopyVerdict {
  const findings: CopyFinding[] = [];
  const check = (patterns: Pattern[], kind: CopyFinding["kind"]) => {
    for (const { pattern, why } of patterns) {
      const m = text.match(pattern);
      if (m) findings.push({ kind, why, match: m[0] });
    }
  };

  if (isPrelaunch()) check(REGULATED, "regulated");
  check(NEVER, "never");
  check(BANNED, "voice");
  check(STYLE, "style");

  return {
    ok: findings.length === 0,
    findings,
    summary: summarise(findings),
  };
}

function summarise(findings: CopyFinding[]): string {
  if (findings.length === 0) return "Nothing in this would fail the firm's own copy rules.";

  const regulated = findings.filter((f) => f.kind === "regulated" || f.kind === "never");
  if (regulated.length > 0) {
    return (
      `This says something the firm's own website may not say while its registration is pending: ` +
      `${regulated.map((f) => `"${f.match}" (${f.why})`).join(", ")}. ` +
      `A partner surface is held to the same rule as the public site, because the licence at risk is the same licence.`
    );
  }

  return `This breaks the firm's copy rules: ${findings.map((f) => `"${f.match}" (${f.why})`).join(", ")}.`;
}

/**
 * The sentence every partner facing piece of material has to carry.
 *
 * Non negotiable 1: the performing firm is named on the page, near the offer,
 * and not as fine print. Returned from one place so that a screen, an export
 * and an emailed one pager cannot each carry their own wording of it, which is
 * how three wordings of one fact start to drift.
 */
export function performingFirmLine(): string {
  return isPrelaunch()
    ? "254 Engineering Services is the firm of record for work referred through this programme, and is the firm that will perform and seal it. Firm registration is pending with the Texas Board of Professional Engineers and Land Surveyors."
    : "254 Engineering Services is the firm of record for work referred through this programme, and is the firm that performs and seals it.";
}
