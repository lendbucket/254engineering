/**
 * THE CLIENTS LIST SEARCHES, FILTERS, SORTS AND PAGES, AND ITS COUNT IS OF THE
 * CLIENTS THAT MATCH.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-clients-list-searches-sorts-and-pages.mjs
 *
 * Office ready, operator ruling of 2026-10-20: "Every list sorts, filters,
 * searches and pages." The query rules are pure and run here on built input;
 * then the source is read for the property a page of results rests on: the
 * list and its count apply the same search, the same filter and the same demo
 * exclusion, so "40 matching" can be reached by paging, and the screen pages.
 */
import { readFileSync } from "node:fs";

const { clientListQuery, clientSearchOr } = await import("../../src/lib/client-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const none = clientListQuery({});
check("with nothing asked, everyone, newest first, page one", none.term === "" && none.kind === "all" && none.sort === "added" && none.ascending === false && none.page === 1);
check("by name reads A to Z unless told otherwise", clientListQuery({ sort: "name" }).ascending === true && clientListQuery({ sort: "name", dir: "desc" }).ascending === false);
check("an unknown kind or sort falls back rather than reaching the database", clientListQuery({ kind: "everyone'; drop", sort: "salary" }).kind === "all" && clientListQuery({ sort: "salary" }).sort === "added");
check("a page that is not a number is page one", clientListQuery({ page: "x" }).page === 1 && clientListQuery({ page: "-3" }).page === 1 && clientListQuery({ page: "4" }).page === 4);
const hostile = clientListQuery({ q: "smith,email.eq.x)(*%" });
check("the term loses what PostgREST's or() reads as syntax", !/[,()*%\\]/.test(hostile.term), hostile.term);
const or = clientSearchOr("Reyna");
check("a search reaches name, email and city", or === "name.ilike.%Reyna%,email.ilike.%Reyna%,city.ilike.%Reyna%", or ?? "");
check("a phone is matched on its digits however it was typed", (clientSearchOr("361 555") ?? "").includes("phone.ilike.%3%6%1%5%5%5%"));
check("no term, no search", clientSearchOr("") === null);

const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
const list = crm.slice(crm.indexOf("export async function listClients("), crm.indexOf("export async function countClients("));
const count = crm.slice(crm.indexOf("export async function countClients("), crm.indexOf("export async function getClient("));
for (const [name, body] of [["the list", list], ["the count", count]]) {
  check(
    `${name} excludes demonstration clients and applies the search and the kind`,
    /\.not\("is_demo", "is", true\)/.test(body) && /clientSearchOr\((q|query)\.term\)/.test(body) && /\.eq\("kind", (q|query)\.kind\)/.test(body),
  );
}
check("the list pages by offset, with a tie broken by id so no client is shown twice or skipped", /\.range\(offset, offset \+ limit - 1\)/.test(list) && /\.order\("id", \{ ascending: true \}\)/.test(list));

const page = readFileSync("src/app/portal/(app)/clients/page.tsx", "utf8");
check("the screen reads one query and hands it to the list and the count", /const query = clientListQuery\(params\);/.test(page) && /listClients\(actor, \{ limit: CLIENT_PAGE_SIZE, offset: \(query\.page - 1\) \* CLIENT_PAGE_SIZE, query \}\)/.test(page) && /countClients\(actor, query\)/.test(page));
check("it offers search, a filter and a sort, and pages over the matching count", /<ListControls/.test(page) && /<Pager page=\{query\.page\} pageSize=\{CLIENT_PAGE_SIZE\} total=\{total\}/.test(page));
check("and no longer says search and paging are not built", !/Search and paging for the rest are/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the clients list searches, filters, sorts and pages, and its count is of the clients that match.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
