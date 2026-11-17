/**
 * AN ENTER KEY WAITS FOR A COMPOSED WORD.
 *
 *   node scripts/proofs/an-enter-key-waits-for-a-composed-word.mjs
 *
 * Google's legacy-scan (rule ime-safe-enter-submit, issue #1, 6936206972) found
 * the staff search in src/components/portal/PortalChrome.tsx acting on Enter
 * without checking event.isComposing, so somebody typing through an input method
 * editor (Vietnamese, Chinese, Japanese) could fire the search half way through
 * a word. Fixed on Robert's word of 2026-11-16.
 *
 * THE CLASS, NOT THE INSTANCE. Every keydown handler in src that acts on Enter
 * must also ask isComposing, in the same condition, so the next one written
 * without it is red here rather than found by a person typing Vietnamese.
 * Counted and named, so a check over no handler cannot pass: there must be at
 * least one, and the staff search must be one of them.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.tsx?$/.test(f));

/* Each condition that tests a key against "Enter", read as the line it sits on. */
const ENTER = /(?:\.key|\.code)\s*===\s*["']Enter["']/;
const handlers = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (ENTER.test(line) && /\bif\s*\(/.test(line)) handlers.push({ where: `${f}:${i + 1}`, line: line.trim() });
  });
}

check("there is at least one Enter handler to read", handlers.length >= 1, `${handlers.length} found`);
check("the staff search is one of them", handlers.some((h) => h.where.startsWith("src/components/portal/PortalChrome.tsx")));
const missing = handlers.filter((h) => !/isComposing/.test(h.line));
check(
  "every Enter handler also asks isComposing, in the same condition",
  missing.length === 0,
  missing.map((h) => `${h.where}: ${h.line.slice(0, 90)}`).join(" | ") || `${handlers.length} handler(s): ${handlers.map((h) => h.where).join(", ")}`,
);

console.log(wrong === 0 ? "PASS: an Enter key waits for a composed word." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
