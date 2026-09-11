/**
 * IS THE INDEX ACTUALLY THE INDEX.
 *
 *   npx tsx scripts/backlog-audit.mjs
 *
 * Pure. No server, no database, no network, so it runs in phase zero.
 *
 * WHY THIS EXISTS
 * ---------------
 * CLAUDE.md section 7 says BACKLOG.md carries every known and undone thing. On
 * 2026-09-06 the operator named seven open items from memory and none of them
 * was in it: three messaging capabilities, the unasserted half of native
 * standard point 8, the Sentry DSN, queue depth alerting, and metric charts.
 *
 * Every one was recorded honestly, in the document where its reasoning belonged.
 * The defect was not dishonesty, it was that the index had quietly stopped being
 * one, and a sweep then found five of the eight documents carrying open work
 * were never named in BACKLOG at all.
 *
 * That is this repository's own recurring defect one level up: a check that
 * passes while looking at the wrong thing, where the check is a person reading
 * the backlog and believing it is complete.
 *
 * WHAT IT ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * ---------------------------------------------------
 * It asserts that a document under docs/ carrying open work is NAMED in
 * BACKLOG.md. That is a coverage check of the same shape as security-audit's
 * perimeter list and native-audit's point 9 table.
 *
 * It does not try to match individual items between the two, and that restraint
 * is the design. A check clever enough to say "this paragraph is an open item
 * and it has no entry" would be a check with an opinion about prose, and it
 * would be wrong in both directions on a file this size. Naming the document is
 * the property that can be checked without judgment, and it is enough: a reader
 * who reaches the document finds the reasoning.
 */

import { readdirSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("THE BACKLOG IS THE INDEX");
console.log("");

const backlog = readSource("BACKLOG.md");

/*
 * The markers. Phrases this repository actually uses when it records something
 * as not done, taken from the documents rather than invented: every one of them
 * appears in at least one real entry.
 *
 * Deliberately narrow. A marker like "should" or "later" would match half the
 * prose in a repository that explains itself at this length, and a check that
 * fires on everything is a check somebody turns off.
 */
/*
 * A NEGATION GUARD, AND THE FIRST RUN NEEDED IT.
 *
 * ops-platform-program.md says "Kept for the reasoning, not because they are
 * still open", which is a sentence DENYING that something is open, and the
 * marker matched it. That is the defect scripts/lib/regulatory.mjs already
 * records at length: a check that matches a claim and its denial identically
 * teaches whoever runs it to delete the honest sentence to get a green board.
 *
 * Variable length lookbehind is supported in V8, so it sits inline.
 */
const NOT_OPEN = String.raw`(?<!not because they are )(?<!no longer )(?<!are not )(?<!is not )`;

const MARKERS = [
  /\bnot built\b/i,
  new RegExp(`${NOT_OPEN}\\bstill open\\b`, "i"),
  /\bnot yet built\b/i,
  /\bremains open\b/i,
  /\bis not done\b/i,
  /\bnothing (?:writes|reads|prunes|watches|computes|draws)\b/i,
  /\bwaiting on the operator\b/i,
  /*
   * A DOCUMENT THAT ASKS A QUESTION IS CARRYING OPEN WORK.
   *
   * Added 2026-09-09, after docs/bulk-actions-reconciliation.md was written with
   * a section headed "What is being asked at gate 1" and this audit passed
   * straight over it.
   *
   * Every marker above describes work somebody DECIDED not to do. None of them
   * describes work nobody has decided about yet, which is exactly the state a
   * reconciliation document exists to produce and exactly the state most likely
   * to be forgotten, because nobody has written a reason down yet.
   *
   * Same shape as everything else this section turned up: a check looking at the
   * right subject through too narrow a window.
   */
  /\bis being asked\b/i,
  /\bneeds a ruling\b/i,
  /\bwithout a ruling\b/i,
  /\bunless the operator rules\b/i,
];

const docs = readdirSync("docs")
  .filter((f) => /\.md$/.test(f))
  .sort();

rec("there are documents to check", docs.length > 0, `${docs.length} in docs/`);

/*
 * A document that RECORDS the rule cannot be evidence for it. BACKLOG names
 * itself constantly, and CLAUDE.md is law rather than a workstream document.
 */
const carrying = [];
const named = [];
const missing = [];

for (const file of docs) {
  const body = readSource(`docs/${file}`);
  const hits = MARKERS.filter((m) => m.test(body));
  if (hits.length === 0) continue;

  carrying.push(file);

  /*
   * Named WITHOUT its extension, because entries write both `docs/thing.md` and
   * "the thing document". The stem is the identifying part and requiring the
   * exact path would fail on a correct entry that phrased it differently.
   */
  const stem = file.replace(/\.md$/, "");
  if (backlog.includes(stem)) named.push(file);
  else missing.push(file);
}

rec(
  "documents carrying open work were found",
  carrying.length > 0,
  `${carrying.length} of ${docs.length}: ${carrying.join(", ")}`,
);

rec(
  "every document carrying open work is named in BACKLOG",
  missing.length === 0,
  missing.length
    ? `not named: ${missing.join(", ")}`
    : `${named.length} document(s) named`,
);

/*
 * AND THE CHECK IS NOT VACUOUS.
 *
 * If the markers stopped matching, the loop above would find nothing to check
 * and the assertion would pass on an empty set forever. So a known open item is
 * put through the matcher here.
 */
const canary = MARKERS.some((m) =>
  m.test("Alerting on queue depth is not built, and nothing watches it."),
);
rec(
  "and the markers still recognise an open item when they see one",
  canary,
  "a coverage check over an empty set passes forever",
);

/*
 * The seven that started this. Named individually, because "the document is
 * mentioned" is the property this audit can check mechanically and "these seven
 * specific items are indexed" is the property the operator actually asked for.
 * A regression on any of them is the exact failure this file exists for.
 */
const SEVEN = [
  ["everything addressed to you", "messaging item 5"],
  ["edit and delete", "messaging item 7"],
  ["export and retention", "messaging item 8"],
  ["scroll position", "native standard point 8"],
  ["SENTRY_DSN", "the Sentry DSN"],
  ["queue depth", "queue depth alerting"],
  ["Metric charts", "metric charts"],
];

for (const [needle, what] of SEVEN) {
  rec(
    `the index carries ${what}`,
    backlog.toLowerCase().includes(needle.toLowerCase()),
    "named individually because these are the seven that were missing",
  );
}

/*
 * The rule itself has to stay written down. An audit enforcing a rule nobody
 * can find is an audit somebody deletes as noise.
 */
const law = readSource("CLAUDE.md");
rec(
  "and CLAUDE.md still states the rule this enforces",
  /BACKLOG\.md` is the INDEX/.test(law),
  "if the law is edited away, this audit is enforcing nothing anybody agreed to",
);

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("An index that is not an index is worse than no index, because");
  console.log("somebody reads it and believes they have seen everything.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Everything undone is findable from one file.`);
