/**
 * A DASHBOARD NOTE IS IN PLAIN WORDS. Walk 2, 2026-11-15, under the office
 * ready rule of 2026-10-20: "Plain words. ... Nothing operational needs SQL, a
 * script or code."
 *
 * The customer service, operations manager and rep home screens explained what
 * they could not count in the database's own vocabulary: "there is no
 * awaiting_customer status", "eng_messages records an author and no
 * direction", "refund_case has no constraint anywhere", "From
 * eng_threads.last_message_at", and "Counted, not totalled", in British
 * spelling. Staff read those screens; none of them reads a schema.
 *
 * What must hold, over EVERY string src/lib/ops-dashboard.ts puts on a screen
 * as a reason or a note (each notComputable.push( argument and each note:
 * field), and the portal home's description of that list:
 *   1. No table or column name: nothing shaped like eng_x, and no
 *      lower_snake_case identifier.
 *   2. None of the words schema, column, constraint, query or row as the
 *      platform's own vocabulary.
 *   3. The sweep found strings to read, so it cannot pass over nothing.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const src = codeOf(readFileSync("src/lib/ops-dashboard.ts", "utf8"));
/** The string literals that are the first argument of notComputable.push( or the value of a note: field. */
const rendered = [];
for (const m of src.matchAll(/notComputable\.push\(\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g)) rendered.push(m[1]);
for (const m of src.matchAll(/\bnote:\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g)) rendered.push(m[1]);
const home = codeOf(readFileSync("src/app/portal/(app)/page.tsx", "utf8"));
const panel = home.match(/title="What could not be counted"\s*description="([^"]*)"/);
if (panel) rendered.push(`"${panel[1]}"`);

check("the sweep found the screen's notes and reasons", rendered.length >= 6, `${rendered.length} strings`);
check("it found the home screen's description of the list", Boolean(panel));

/* A template's ${...} is code, not words, so it is removed before the words are read. */
const words = (s) => s.slice(1, -1).replace(/\$\{[^}]*\}/g, " ");
const IDENT = /\beng_[a-z_]+|\b[a-z]+_[a-z_]+\b/;
const VOCAB = /\b(schema|column|constraint|query|queries)\b/i;
const withIdent = rendered.filter((s) => IDENT.test(words(s))).map((s) => words(s).match(IDENT)[0]);
const withVocab = rendered.filter((s) => VOCAB.test(words(s))).map((s) => words(s).match(VOCAB)[0]);
check("no note names a table or a column", withIdent.length === 0, withIdent.join(", "));
check("and none explains itself in database words", withVocab.length === 0, withVocab.join(", "));

console.log("");
if (wrong === 0) {
  console.log("PASS: every dashboard note is in plain words.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
