/**
 * NO WORD IS BROKEN TO FIT, ONLY A TOKEN TOO LONG FOR ITS LINE. Walk 2, 2026-11-15.
 *
 * The clients screen at 390 read "Cor / pus Christi": the lead's line carried
 * the class break-all so a long email address could wrap, and break-all breaks
 * EVERY word at whatever letter reaches the edge, a city name included. The
 * class was on nineteen elements across the site and the portal.
 *
 * [overflow-wrap:anywhere] breaks a token only when it cannot fit its line, so
 * an email address still wraps and "Corpus Christi" does not, and it lowers the
 * element's min-content width the same way, which is what the flex rows these
 * sit in needed break-all for. The email layout made the same choice and says so
 * in src/lib/email-layout.ts.
 *
 * What must hold:
 *   1. No .tsx under src/app or src/components carries the class break-all.
 *   2. The fix is present where the walk found the defect: the clients screen's
 *      lead line and contact line wrap with [overflow-wrap:anywhere].
 *   3. The sweep read something: it found the .tsx files and the replacement in
 *      more than one file, so a check that lists nothing cannot pass.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/app", "src/components"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".tsx"));
const offenders = [];
let anywhere = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (/(?<![\w-])break-all(?![\w-])/.test(src)) offenders.push(f);
  if (src.includes("[overflow-wrap:anywhere]")) anywhere += 1;
}
check("the sweep read the site's and the portal's components", files.length > 300, `${files.length} .tsx files`);
check("no component breaks every word with break-all", offenders.length === 0, offenders.join(", "));
check("and the token-only wrap is in use across them", anywhere >= 10, `${anywhere} files`);

const clients = readFileSync("src/app/portal/(app)/clients/page.tsx", "utf8");
check("the clients screen's lead line wraps only a long token", /<p className="mt-0\.5 text-\[14px\] \[overflow-wrap:anywhere\] text-\[var\(--secondary\)\]">\s*\{lead\.email/.test(clients));
check("and so does each client's contact line", /<p className="mt-0\.5 text-\[14px\] \[overflow-wrap:anywhere\] text-\[var\(--secondary\)\]">\s*\{c\.email \?\? c\.phone/.test(clients));

console.log("");
if (wrong === 0) {
  console.log("PASS: no word is broken to fit; only a token too long for its line wraps.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
