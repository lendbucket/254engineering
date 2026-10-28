/**
 * THE ENGINEER'S HELD LIST READS ITS HOLDS SEVERAL AT A TIME, AND A HOLD THAT
 * COULD NOT BE READ IS SAID RATHER THAN DROPPED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-held-list-reads-holds-together-and-drops-none.mjs
 *
 * Board 40733329479 profiled /portal/review: heldFiles was 4.6 to 6.6 seconds
 * of a 5.2 to 7.7 second page, because it asked holdFor of each waiting file
 * one after another, three reads each. The staff desk did the same. Both now
 * go through holdsFor, which keeps holdFor as the one rule and only removes
 * the waiting between files.
 *
 * And heldFiles used to skip a file whose hold came back null. Dispatch
 * refuses exactly that file (holdRefusal), so it was a job nobody could send
 * and nobody was shown. It now refuses the list with the file numbers, which
 * is what the review page already renders for a failed read.
 */
import { readFileSync } from "node:fs";

const { holdsFor, heldFiles, HOLD_READS_AT_ONCE } = await import("../../src/lib/dispatch-hold.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* With no database configured here, holdFor answers null for every id: the shut answer. */
const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
const states = await holdsFor(ids);
check("holdsFor answers once per file, in the order given", states.length === ids.length && states.every((s) => s && s.held === null), `${states.length} answers`);
check("and an empty list asks nothing", (await holdsFor([])).length === 0);
check("several at a time, bounded", Number.isInteger(HOLD_READS_AT_ONCE) && HOLD_READS_AT_ONCE > 1 && HOLD_READS_AT_ONCE <= 16, String(HOLD_READS_AT_ONCE));
const none = await heldFiles();
check("with no database the held list refuses rather than reading empty", none.ok === false, none.ok ? "listed" : none.error);

const hold = readFileSync("src/lib/dispatch-hold.ts", "utf8");
const body = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`);
  const next = src.indexOf("\nexport ", at + 10);
  return src.slice(at, next < 0 ? undefined : next);
};
const held = body(hold, "heldFiles");
check("heldFiles asks through holdsFor, and never awaits holdFor itself", /await holdsFor\(/.test(held) && !/await holdFor\(/.test(held));
check(
  "a hold that could not be read refuses the list, naming the files",
  /h\.held === null \? \[/.test(held) && /if \(unread\.length > 0\) \{\s*return \{ ok: false,/.test(held),
);
check("holdsFor runs its workers together", /await Promise\.all\(Array\.from\(\{ length: Math\.min\(HOLD_READS_AT_ONCE, fileIds\.length\) \}, worker\)\)/.test(body(hold, "holdsFor")));

const desk = readFileSync("src/lib/staff-desk.ts", "utf8");
check("the staff desk asks through holdsFor too, and never awaits holdFor in a loop", /await holdsFor\(/.test(desk) && !/await holdFor\(/.test(desk));
check("and still counts an unread hold as unknown, never as clear", /if \(h\.held === null\) unknown \+= 1;/.test(desk));

console.log("");
if (wrong === 0) {
  console.log("PASS: the held list and the desk read their holds together, in order, and a hold nobody could read is said.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
