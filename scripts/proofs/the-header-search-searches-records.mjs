/**
 * THE HEADER'S SEARCH BOX SEARCHES RECORDS, FOR WHOEVER MAY SEARCH.
 *
 *   node scripts/proofs/the-header-search-searches-records.mjs
 *
 * Office ready, operator ruling of 2026-10-20: "One global search over orders,
 * customers, prospects and addresses, by any field staff would type." The
 * 2026-10-24 survey found the Ctrl K box jumped between screens only, under a
 * footer saying record search had not arrived, which was no longer true.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const chrome = readFileSync("src/components/portal/PortalChrome.tsx", "utf8");
const search = readFileSync("src/lib/ops-search.ts", "utf8");
check("the box searches records through /portal/search with the term", /`\/portal\/search\?q=\$\{encodeURIComponent\(term\)\}`/.test(chrome));
check("only for whoever's menu carries Search, so it widens nothing", /const canSearch = items\.some\(\(i\) => i\.href === "\/portal\/search"\);/.test(chrome) && /canSearch && term\.length >= SEARCH_MIN_LENGTH/.test(chrome));
check("Enter runs the search", /e\.key === "Enter" && searchHref/.test(chrome));
check(
  "the box and the server read one minimum, from the client safe rule",
  /import \{ SEARCH_MIN_LENGTH \} from "@\/lib\/search-rules";/.test(chrome) && /import \{ SEARCH_MIN_LENGTH, cleanSearchTerm \} from "\.\/search-rules";/.test(search) && !/export const SEARCH_MIN_LENGTH/.test(search),
);
/* 2026-10-24: the term's cleaning moved to search-rules too, so every list's search box cleans it the same way. */
check("and the server cleans a term with the shared rule, keeping no copy of its own", /cleanSearchTerm\(raw \?\? ""\)/.test(search) && !/function clean\(/.test(search));
check("and the box no longer says record search has not arrived", !/Navigation only for now/.test(chrome));

console.log("");
if (wrong === 0) {
  console.log("PASS: the header's search box searches records, for whoever may search.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
