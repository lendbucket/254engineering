/**
 * A TABLE IN A NARROW COLUMN IS CARDS. Robert's answer 2 of 2026-11-12 (to
 * 6838484380): at 1280 the franchisee record's certificate table cut off its
 * Withdraw button and the owner's people table its Role, because each sat in a
 * column narrower than the table's 640px minimum, and the shared table chose
 * between cards and a table by the VIEWPORT.
 *
 *   node scripts/proofs/a-narrow-table-is-cards.mjs
 *
 * The shared DataTable now chooses by its CONTAINER: cards below 640px of the
 * column it sits in, the table at 640px and over. Read from the source, the one
 * component every portal table renders through.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const src = readFileSync("src/components/portal/design/Table.tsx", "utf8");
const min = /min-w-\[(\d+)px\]/.exec(src)?.[1];
check("the table keeps a minimum width", Boolean(min), min ?? "none found");
check("the table's outer element is a size container", /<div className="@container">/.test(src));
check(`the cards hide at a ${min}px container, the table's own minimum`, new RegExp(`<ul className="[^"]*@min-\\[${min}px\\]:hidden[^"]*">`).test(src));
check(`and the table shows at a ${min}px container`, new RegExp(`<div className="scroll-x hidden @min-\\[${min}px\\]:block"`).test(src));
check("neither half chooses by the viewport any more", !/<ul className="[^"]*\bmd:hidden/.test(src) && !/scroll-x hidden md:block/.test(src));
check("the table half is still a region a keyboard can reach", /tabIndex=\{0\} role="region" aria-label=\{caption\}/.test(src));

console.log(wrong === 0 ? "\nPASS: a table in a column narrower than itself is cards." : `\nFAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
