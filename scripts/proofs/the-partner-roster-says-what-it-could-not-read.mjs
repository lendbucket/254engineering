/**
 * THE PARTNER ROSTER SEARCHES AND FILTERS, AND SAYS WHAT IT COULD NOT READ
 * RATHER THAN NOTHING PAYABLE TO ANYBODY.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-partner-roster-says-what-it-could-not-read.mjs
 *
 * Office ready, operator ruling of 2026-10-20, and the 2026-10-12 ruling that a
 * failed read is not an empty list. ops-partner-comp.ts fixed this class for a
 * partner's own balance; the administrator's roster kept it: a failed entries
 * read made every partner's payable $0.00, a failed roster read was nobody, a
 * failed referrals or people read was 0, and the roster stopped at 200. Read
 * from the source, since the reads run against a database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const lib = readFileSync("src/lib/ops-partners-admin.ts", "utf8");
const fn = lib.slice(lib.indexOf("export async function partnerRoster("), lib.indexOf("export type PartnerDetail"));
check("it still asks for partners.manage", /can\(actor, "partners\.manage"\)/.test(fn));
check("the roster is read whole by paging, not stopped at 200", /readEvery<Record<string, unknown>>\(\(from, to\) =>[\s\S]*?from\("eng_partners"\)[\s\S]*?\.range\(from, to\)/.test(fn) && !/\.limit\(200\)/.test(fn));
check("a roster that could not be read is a failed read, not nobody", /if \(!partnerRead\.ok\) \{[\s\S]*?return \{ ok: false, error:/.test(fn));
check("a ledger that could not be read makes payable unknown, never the sum of no rows", /const payable =\s*entries === null\s*\? null/.test(fn) && /blocked: entries === null \? null :/.test(fn));
check("referrals and people that could not be counted are missing, not zero", /referrals: ordersError \? null :/.test(fn) && /people: usersError \? null :/.test(fn));
check("and every failed source is named", /entries === null \? \["The partner ledger could not be read/.test(fn) && /ordersError \?/.test(fn) && /usersError \?/.test(fn) && /return \{ ok: true, rows, failed \};/.test(fn));
check("the figures' type admits unknown", /referrals: number \| null;/.test(lib) && /payableCents: Cents;/.test(lib) && /blocked: number \| null;/.test(lib) && /people: number \| null;/.test(lib));

const page = readFileSync("src/app/portal/(app)/partners/page.tsx", "utf8");
check("the screen shows an unknown figure as could not be read, never a number", /p\.payableCents === null \? unread/.test(page) && /p\.referrals === null \? unread/.test(page) && /p\.people === null \? unread/.test(page) && /p\.blocked === null \? unread/.test(page));
check("names each failed source above the roster", /read\.failed\.map\(\(f\) => <li key=\{f\}>\{f\}<\/li>\)/.test(page));
check("says the roster could not be loaded, not no partners", /\{!read\.ok \? \(\s*<div role="alert" data-list-not-loaded/.test(page));
check("and offers a search and a state filter", /<ListControls\s+action="\/portal\/partners"/.test(page) && /name: "state"/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the partner roster searches and filters, and says what it could not read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
