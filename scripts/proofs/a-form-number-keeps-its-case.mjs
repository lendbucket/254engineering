/**
 * A FORM NUMBER KEEPS ITS CASE INSIDE A SENTENCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-form-number-keeps-its-case.mjs
 *
 * Robert, 2026-10-26, from /order on production: the WPI-8 button read
 * "Order a wpi-8e windstorm evaluation, completed construction", because the
 * catalogue name went through toLowerCase() whole. inSentence() is the one
 * home of that lowering now. The expected labels are literals here rather than
 * a second call to the function, so a reverted helper turns this red.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { inSentence } = await import("../../src/lib/ordering.ts");

const EXPECTED = [
  ["WPI-8E windstorm evaluation, completed construction", "WPI-8E windstorm evaluation, completed construction"],
  ["WPI-8 windstorm inspection, ongoing construction", "WPI-8 windstorm inspection, ongoing construction"],
  ["Roof certification letter", "roof certification letter"],
  ["Structural letter for permit", "structural letter for permit"],
  ["Manufactured home foundation certification", "manufactured home foundation certification"],
];
for (const [name, want] of EXPECTED) {
  const got = inSentence(name);
  check(`"${name}" reads "${want}" in a sentence`, got === want, got);
}

/* Every catalogue name that carries a form number keeps it, read from the catalogue. */
const { CATALOG } = await import("../../data/catalog.ts");
const designations = CATALOG.flatMap((e) => (e.name.match(/\b[A-Z]{2,}[A-Z0-9-]*\b/g) ?? []).map((d) => [e.name, d]));
check("the catalogue carries at least one form number to test", designations.length > 0, String(designations.length));
for (const [name, d] of designations) {
  check(`"${name}" keeps ${d}`, inSentence(name).includes(d), inSentence(name));
}

/* No surface lowers a catalogue name by hand again. */
for (const file of ["src/lib/ordering.ts", "src/app/(site)/order/page.tsx", "src/components/home/HomeOrderingSteps.tsx"]) {
  const src = readFileSync(file, "utf8");
  check(`${file} lowers no name or deliverable with toLowerCase()`, !/(name|deliverable)\.toLowerCase\(\)/.test(src));
}

console.log(wrong === 0 ? "\nPASS: a form number keeps its case" : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
