/**
 * AN EMPTY LIST OFFERS WHAT ITS READER CAN DO NEXT, AND NOTHING THEY CANNOT.
 *
 * The every-role walk of 2026-11-14 (autopilot item 4): office ready, every
 * empty state says what to do next.
 *   1. Both partner lists said it in words and linked nowhere: referrals did
 *      not say where the code and link are, and statements named "the
 *      overview" without linking it.
 *   2. Files told a technician to "open one above, or convert a lead from the
 *      clients screen", neither of which a technician can do.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (path) =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const emptyOf = (code, title) => {
  const at = code.indexOf(`title="${title}"`);
  return at < 0 ? "" : code.slice(at, code.indexOf("/>", code.indexOf("</Link>", at)) + 2);
};

const referrals = emptyOf(codeOf("src/app/partner/(app)/referrals/page.tsx"), "No referrals yet");
check("no referrals yet links to the code and link on the overview", /action=\{\s*<Link href="\/partner"[^>]*>\s*Your code and link\s*<\/Link>/.test(referrals), referrals.slice(0, 80));
const statements = emptyOf(codeOf("src/app/partner/(app)/statements/page.tsx"), "No statements yet");
check("no statements yet links to the overview it names", /what you have earned is on the overview/.test(statements) && /action=\{\s*<Link href="\/partner"[^>]*>\s*What you have earned\s*<\/Link>/.test(statements));
const overview = codeOf("src/app/partner/(app)/page.tsx");
check("and the overview is where the code is", /Your referral code is/.test(overview));

const files = codeOf("src/app/portal/(app)/files/page.tsx");
const filesEmpty = files.slice(files.indexOf('"No files yet"'), files.indexOf("/>", files.indexOf('"No files yet"')));
check(
  "Files offers opening or converting only to whoever can, and tells a technician where their files come from",
  /can\(actor, "files\.create"\) && can\(actor, "clients\.create"\)\s*\? "[^"]*convert a lead from the clients screen\."/.test(filesEmpty) &&
    /: can\(actor, "offers\.list_own"\)\s*\? "A file appears here when a job in it is offered to you or assigned to you\. Your offers are on My jobs\."/.test(filesEmpty),
);
check(
  "and the sentence about the clients screen is reached only through that test",
  (filesEmpty.match(/convert a lead from the clients screen/g) ?? []).length === 1,
);

console.log("");
if (wrong === 0) {
  console.log("PASS: an empty list offers what its reader can do next, and nothing they cannot.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
