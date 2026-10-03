/**
 * EVERY EMPLOYMENT RULE NAMES ITS SOURCE, AND NONE OF THEM CLAIMS TO BE CHECKED.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/every-hr-rule-cites-its-source.mjs
 *
 * Part C item 5, closing Part B7 of `docs/audits/hr-lifecycle-2026-10-02.md`:
 * "the rules file Part B7 describes does not exist, so none of these rules is
 * enforceable by a check."
 *
 * WHAT THIS PROVES AND WHAT IT DELIBERATELY DOES NOT, said first because the
 * limit is the whole design.
 *
 * It proves the DECLARATION is complete and honest: every rule carries a source,
 * every unverified rule says what is uncertain, every lifecycle step that
 * carries a legal obligation names a rule that exists, and the number of
 * unverified citations is pinned so one cannot quietly become settled.
 *
 * IT DOES NOT PROVE THE FIRM COMPLIES WITH ANYTHING, and it must not be read or
 * quoted as though it did. Not one citation in that file has been checked
 * against the statute by a person. A check that asserted "overtime is paid at
 * 1.5 times over 40 hours, per 29 U.S.C. 207(a)" would be putting a legal
 * conclusion nobody confirmed into the firm's own records, which is the
 * fabricated assurance this repository already rules on for sealed work.
 *
 * So an unverified rule is enforceable as a REMINDER and never as a conclusion,
 * and the loudest line this proof prints is the count of them.
 *
 * IT IS REACHED BECAUSE IT EXISTS. proofs-audit enumerates this directory and
 * runs every .mjs in it, which is why no audit needed editing to add this.
 */

import { HR_RULES, HR_STEPS } from "../../src/config/hr-rules.ts";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/*
 * THE SUBJECT IS ASSERTED FIRST. A declaration that failed to load, or one
 * somebody emptied, would make every check below pass over nothing, which is
 * the vacuous green this repository keeps meeting.
 */
rec(
  "the rules declaration has a subject",
  HR_RULES.length >= 7 && HR_STEPS.length >= 7,
  `${HR_RULES.length} rule(s), ${HR_STEPS.length} lifecycle step(s). Below either floor every check under it passes over an empty list`,
);

/* ------------------------------------------------- 1. every rule is complete */

const incomplete = [];
for (const r of HR_RULES) {
  if (!r.key || !r.rule || !r.source) incomplete.push(`${r.key || "(no key)"}: missing key, rule or source`);
  if (r.verified === false && !r.uncertain) {
    incomplete.push(`${r.key}: unverified and says nothing about what is uncertain`);
  }
  if (r.verified !== false && (!r.verified.on || !r.verified.by)) {
    incomplete.push(`${r.key}: claims verification with no date or no person`);
  }
  if (!["platform", "gusto", "operator"].includes(r.owner)) {
    incomplete.push(`${r.key}: owner "${r.owner}" is not one this file understands`);
  }
}
rec(
  "every rule names its source, its owner, and what is uncertain about it",
  incomplete.length === 0,
  incomplete.slice(0, 4).join(" | ") ||
    `${HR_RULES.length} rule(s). An unverified rule that cannot say what is doubtful reads as a settled one`,
);

/* ------------------------------------------------ 2. the keys are unique */

const seen = new Map();
for (const r of HR_RULES) seen.set(r.key, (seen.get(r.key) ?? 0) + 1);
const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
rec(
  "no two rules share a key",
  duplicated.length === 0,
  duplicated.join(", ") || `${seen.size} distinct key(s), and a step naming a duplicated one would be ambiguous`,
);

/* --------------------------------- 3. every step names a rule that exists */

const dangling = [];
for (const s of HR_STEPS) {
  if (s.rules.length === 0) {
    dangling.push(`step ${s.step} ${s.name}: listed as carrying an obligation and names no rule`);
    continue;
  }
  for (const key of s.rules) {
    if (!seen.has(key)) dangling.push(`step ${s.step} ${s.name}: names "${key}", which is not a rule`);
  }
}
rec(
  "every lifecycle step that carries a legal obligation names a rule that exists",
  dangling.length === 0,
  dangling.slice(0, 4).join(" | ") ||
    `${HR_STEPS.length} step(s), ${HR_STEPS.reduce((n, s) => n + s.rules.length, 0)} reference(s), all resolving. This is the half Part B7 asked for: a step built without a rule is a red board rather than a gap`,
);

/* ------------------------- 4. and every rule is reachable from some step */

/*
 * THE OTHER DIRECTION, and it is not symmetry for its own sake. A rule nobody's
 * step names is a rule that will never be looked at while building anything,
 * which is how a declaration stops being read and then stops being true. This
 * repository's own account of the declared inventory idiom is exactly that.
 */
const named = new Set(HR_STEPS.flatMap((s) => s.rules));
const orphans = HR_RULES.filter((r) => !named.has(r.key)).map((r) => r.key);
rec(
  "and every rule is named by at least one step",
  orphans.length === 0,
  orphans.join(", ") || `${named.size} of ${HR_RULES.length} rule(s) reachable from a step`,
);

/* ------------------------------------- 5. the unverified count is pinned */

/*
 * PINNED AS A LITERAL, exactly as CLAUDE.md section 6c pins the firm's business
 * rulings, and for the same reason: moving it costs two edits made on purpose.
 *
 * SEVEN OF SEVEN ARE UNVERIFIED TODAY. The day somebody reads a statute and sets
 * one, this goes red and names it, and that is correct: "a citation became
 * verified" is a claim about work a person did, and it should cost a deliberate
 * edit rather than slipping through with a styling commit.
 */
const UNVERIFIED_TODAY = 7;
const unverified = HR_RULES.filter((r) => r.verified === false);
rec(
  "the number of unverified citations is what the declaration says it is",
  unverified.length === UNVERIFIED_TODAY,
  `${unverified.length} of ${HR_RULES.length} unverified, pinned at ${UNVERIFIED_TODAY}. A citation becoming verified is a person reading a statute, so it costs an edit here as well`,
);

console.log("");
console.log(
  `  NOT ONE OF THESE ${HR_RULES.length} CITATIONS HAS BEEN CHECKED AGAINST ITS SOURCE BY A PERSON.`,
);
console.log(
  "  This proves the declaration is complete and honest. It proves nothing about",
);
console.log(
  "  whether the firm complies, and it must not be quoted as though it did.",
);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Every employment rule names its source, and none of them claims to be settled.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
