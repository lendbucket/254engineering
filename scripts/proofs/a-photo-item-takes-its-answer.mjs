/**
 * A PHOTOGRAPH ITEM THAT ASKS FOR A WRITTEN ANSWER TAKES THE ANSWER.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-photo-item-takes-its-answer.mjs
 *
 * Operator ruling, 2026-10-15. Three 254-RC-001 checklist items carry [PHOTO]
 * and also print a value to record beside the photograph: the tile count per
 * plane, the deck material and thickness, and the owner-reported roof age. The
 * technician's screen showed "Record: ..." under a camera button with nowhere
 * to type, so the value the document asks for could not be captured at all.
 *
 * The three keys and the document's prompts are PINNED here as literals rather
 * than read back from the registry, so the set cannot move without this file
 * being edited on purpose. RC-001's text is not changed.
 */
import { readSource } from "../lib/read-source.mjs";

const { photoAnswersFor, photoAnswerRefusal } = await import("../../src/lib/protocol-run.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/*
 * FOUR, NOT THREE. The ruling named three; the first run of this proof found
 * shingle-seal-bond, whose ambient temperature section 8 says the result "is
 * not meaningful without". Same defect, so it is in the set and pinned here.
 */
const PINNED = {
  "shingle-seal-bond": { prompt: "Ambient temperature during seal-bond check (F)", numeric: true, wholeNonNegative: false },
  "tile-damage": { prompt: "Cracked/slipped/missing tiles, count per plane", numeric: true, wholeNonNegative: true },
  "deck-material": { prompt: "Deck material / thickness", numeric: false, wholeNonNegative: false },
  "product-label": { prompt: "Owner-reported roof age / replacement year (verbatim)", numeric: false, wholeNonNegative: false },
};

const asks = photoAnswersFor("254-RC-001");
check(
  "RC-001 has exactly the four photograph items that ask for an answer",
  JSON.stringify(Object.keys(asks).sort()) === JSON.stringify(Object.keys(PINNED).sort()),
  Object.keys(asks).join(", ") || "none",
);
for (const [key, want] of Object.entries(PINNED)) {
  check(
    `${key} asks in the document's own words, ${want.numeric ? "as a number" : "as text"}`,
    asks[key]?.prompt === want.prompt &&
      asks[key]?.numeric === want.numeric &&
      asks[key]?.wholeNonNegative === want.wholeNonNegative,
    asks[key] ? `${asks[key].prompt} | numeric ${asks[key].numeric}` : "missing",
  );
}
check("an unknown document asks for nothing", Object.keys(photoAnswersFor("NOT-A-DOC")).length === 0);

/* The refusal itself, both ways, for each kind of answer. */
const tile = asks["tile-damage"];
const deck = asks["deck-material"];
check("a tile photograph with no count is refused", photoAnswerRefusal(tile, {}) !== null, photoAnswerRefusal(tile, {}) ?? "allowed");
check("and a negative count is refused", photoAnswerRefusal(tile, { valueNumber: -1 }) !== null);
check("and a fractional count is refused", photoAnswerRefusal(tile, { valueNumber: 2.5 }) !== null);
check("a tile photograph with a count of zero is recorded", photoAnswerRefusal(tile, { valueNumber: 0 }) === null);
const temp = asks["shingle-seal-bond"];
check("a seal-bond photograph with no temperature is refused", photoAnswerRefusal(temp, {}) !== null);
check(
  "and one with a temperature is recorded, decimals and below zero included",
  photoAnswerRefusal(temp, { valueNumber: 84.5 }) === null && photoAnswerRefusal(temp, { valueNumber: -3 }) === null,
);
check("a deck photograph with blank text is refused", photoAnswerRefusal(deck, { valueText: "   " }) !== null);
check("a deck photograph with the material written is recorded", photoAnswerRefusal(deck, { valueText: "OSB 7/16 in" }) === null);
check("a photograph item that asks nothing is never refused for it", photoAnswerRefusal(undefined, {}) === null);

/* The server, the page and the screen each use it, read from the source. */
const field = readSource("src/lib/ops-field.ts");
check(
  "recordCapture refuses through the one rule",
  /const unanswered = photoAnswerRefusal\(asks, input\);\s*if \(unanswered\) return \{ ok: false, error: unanswered \};/.test(field) &&
    /photoAnswersFor\(view\.protocol\?\.document_number \?\? null\)\[item\.itemKey\]/.test(field),
);
const page = readSource("src/app/portal/(app)/jobs/[id]/page.tsx");
check("the job page hands each item its answer", /answer: photoAnswers\[i\.itemKey\] \?\? null/.test(page));
const client = readSource("src/app/portal/(app)/jobs/[id]/CaptureClient.tsx");
check(
  "the screen sends the answer with the photograph",
  /onCapture\(\{ blob: file, value: Number\(answer\) \}\)/.test(client) && /onCapture\(\{ blob: file, text: answer \}\)/.test(client),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the four photograph items take the answer the document asks for.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
