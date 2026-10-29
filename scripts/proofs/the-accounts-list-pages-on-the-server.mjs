/**
 * THE ACCOUNTS LIST PAGES ON THE SERVER: ONE PAGE IS READ IN FULL, AND EVERY
 * COUNT IS OVER EVERY ACCOUNT.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-accounts-list-pages-on-the-server.mjs
 *
 * Robert's answer 4 of 2026-10-28: a profiling bundle first, then a paged
 * accounts list. Board 40733329479 timed /portal/accounts at 10.3 to 10.5
 * seconds: every figure for about 3,020 accounts was read so the browser could
 * show fifty. Two things must now both be true, and either alone is a defect:
 *
 *   - the orders, seats and open statements are read for the page's ids only,
 *     and the balances by a read whose size does not grow with the accounts;
 *   - every count on the screen (the total, the warning that names the
 *     accounts that cannot order, the accounts with unbilled work) is over
 *     EVERY account. A count taken from a page is the length of a sample read
 *     as a total (CLAUDE.md, section 6).
 *
 * The paging rule is pure and driven here with a roster built to be more than
 * three pages; the reads are asserted in the source, because which ids reach a
 * read is the property and no database is needed to see it. The live half,
 * that the screen computes against development, is
 * the-accounts-screen-refuses-what-it-could-not-read.mjs.
 */
import { readFileSync } from "node:fs";

const { ACCOUNT_PAGE_SIZE, accountListQuery, pageOfAccounts } = await import("../../src/lib/account-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A roster of 173: three full pages and a fourth of 23, so a page and the set can never agree by accident. */
const N = 173;
const roster = Array.from({ length: N }, (_, i) => ({
  id: `a${String(i).padStart(3, "0")}`,
  clientId: `c${String(i).padStart(3, "0")}`,
  status: i % 10 === 0 ? "suspended" : i % 17 === 0 ? "closed" : "active",
  billingMode: i % 3 === 0 ? "invoice" : "card",
  createdAt: new Date(Date.UTC(2026, 0, 1) + i * 3600_000).toISOString(),
  cannotOrder: i % 3 === 0 && i % 10 !== 0 && i % 17 !== 0 && i % 2 === 0,
  superseded: false,
}));
const nameOf = new Map(roster.map((a, i) => [a.clientId, `Org ${String((i * 37) % N).padStart(3, "0")}`]));

check("a page is fifty", ACCOUNT_PAGE_SIZE === 50, String(ACCOUNT_PAGE_SIZE));

const p1 = pageOfAccounts(roster, accountListQuery({}), null, null);
check("page one shows fifty, and the total is every account", p1.ids.length === 50 && p1.total === N && p1.pages === 4, `${p1.ids.length} shown, ${p1.total} total, ${p1.pages} pages`);

const seen = [];
for (let page = 1; page <= p1.pages; page += 1) seen.push(...pageOfAccounts(roster, accountListQuery({ page: String(page) }), null, null).ids);
check("the pages together hold every account exactly once", seen.length === N && new Set(seen).size === N);

const beyond = pageOfAccounts(roster, accountListQuery({ page: "99" }), null, null);
check("a page past the end shows the last page rather than nothing", beyond.page === 4 && beyond.ids.length === N - 150, `${beyond.ids.length} on page ${beyond.page}`);

const blocked = roster.filter((a) => a.cannotOrder).length;
const onlyBlocked = pageOfAccounts(roster, accountListQuery({ attention: "cannot_order" }), null, null);
check("the cannot-order filter counts every such account, not those on one page", onlyBlocked.total === blocked && blocked > 0, `${onlyBlocked.total} of ${blocked}`);

const invoice = roster.filter((a) => a.billingMode === "invoice").length;
check("the billing filter counts over every account", pageOfAccounts(roster, accountListQuery({ billing: "invoice" }), null, null).total === invoice);
const suspended = roster.filter((a) => a.status === "suspended").length;
check("the status filter counts over every account", pageOfAccounts(roster, accountListQuery({ status: "suspended" }), null, null).total === suspended);

const matching = new Set(roster.filter((_, i) => i % 2 === 1).map((a) => a.clientId));
const searched = pageOfAccounts(roster, accountListQuery({ q: "Org" }), matching, null);
check("a search keeps every matching account across pages", searched.total === matching.size && searched.pages === Math.ceil(matching.size / 50), `${searched.total} matching`);

const byName = pageOfAccounts(roster, accountListQuery({ sort: "name" }), null, nameOf);
const firstNames = byName.ids.map((id) => nameOf.get(`c${id.slice(1)}`));
check("sorted by name, page one is the first fifty names of every account", firstNames[0] === "Org 000" && firstNames[49] === "Org 049", `${firstNames[0]} to ${firstNames[49]}`);
const byNameDesc = pageOfAccounts(roster, accountListQuery({ sort: "name", dir: "desc" }), null, nameOf);
check("and descending begins at the last name", nameOf.get(`c${byNameDesc.ids[0].slice(1)}`) === `Org ${String(N - 1).padStart(3, "0")}`);

const q = accountListQuery({ q: "50% off, (draft)", status: "nonsense", page: "-3" });
check("the query is cleaned and normalised", q.term === "50 off draft" && q.status === "all" && q.page === 1, JSON.stringify(q));

/*
 * SUPERSEDED ACCOUNTS: HIDDEN BY DEFAULT AND FROM THE COUNTS, SHOWN UNDER THEIR
 * OWN FILTER. Robert, 21:11 Central 2026-10-28. Fifty-nine superseded accounts
 * among the 173, more than a page, every status represented, so the filter's
 * count can only be right if it is taken over every one of them.
 */
const withSuperseded = roster.map((a, i) => ({ ...a, superseded: i % 3 === 1 || i === 0 }));
const supersededIds = new Set(withSuperseded.filter((a) => a.superseded).map((a) => a.id));
const inUse = N - supersededIds.size;
const byDefault = pageOfAccounts(withSuperseded, accountListQuery({}), null, null);
check(
  "by default no superseded account is on any page, and the total is the accounts in use",
  byDefault.total === inUse && byDefault.matchingIds.every((id) => !supersededIds.has(id)),
  `${byDefault.total} of ${N}, ${supersededIds.size} superseded`,
);
const statuses = ["active", "suspended", "closed"];
check(
  "nor under any other status filter",
  statuses.every((s) => pageOfAccounts(withSuperseded, accountListQuery({ status: s }), null, null).matchingIds.every((id) => !supersededIds.has(id))),
);
const onlySuperseded = pageOfAccounts(withSuperseded, accountListQuery({ status: "superseded" }), null, null);
check(
  "the superseded filter shows every superseded account and nothing else, counted exactly across pages",
  onlySuperseded.total === supersededIds.size &&
    onlySuperseded.matchingIds.length === supersededIds.size &&
    onlySuperseded.matchingIds.every((id) => supersededIds.has(id)) &&
    onlySuperseded.pages === Math.ceil(supersededIds.size / 50),
  `${onlySuperseded.total} of ${supersededIds.size}`,
);
check("and the filter value survives the query", accountListQuery({ status: "superseded" }).status === "superseded");

/* ------------------------------------------------ which ids reach which read */

const admin = readFileSync("src/lib/ops-accounts-admin.ts", "utf8");
const at = admin.indexOf("export async function accountRows(");
const body = admin.slice(at, admin.indexOf("\nexport ", at + 10));

/*
 * Since bundle 11 the CSV export asks scope "every" and reads the paging rule's
 * matchingIds; the screen keeps the default, one page. Both halves are asserted:
 * the default must stay "page", or the screen would read every account again.
 */
check(
  "the page is chosen by the paging rule over the whole roster, and the screen's default scope is one page",
  /const shown = pageOfAccounts\(roster, query, matchingClients, allNames\);\s*const ids = scope === "every" \? shown\.matchingIds : shown\.ids;/.test(body) &&
    /scope: "page" \| "every" = "page",/.test(admin),
);
for (const table of ["eng_service_orders", "eng_customer_users", "eng_statements"]) {
  check(
    `${table} is read for the page's ids only`,
    new RegExp(`readEveryIn<Record<string, unknown>>\\(ids, \\(chunk, from, to\\) =>\\s*db\\s*\\.from\\("${table}"\\)`).test(body),
  );
}
check(
  "the balances come from a read that does not take the account ids",
  /await openBalancesForEveryAccount\(\)/.test(body) && !/accountBalances\(/.test(body),
);
/*
 * "all" was every account until 21:11 Central 2026-10-28, and is now every
 * account IN USE: superseded ones are counted only under their own filter. The
 * pins below name the new shape exactly rather than accepting either.
 */
check(
  "the roster reads superseded_at for every account",
  /\.select\("id, client_id, status, billing_mode, credit_limit_cents, net_days, created_at, superseded_at"\)/.test(body),
);
check(
  "the total is the matching set, all is every account in use, and the superseded are counted apart",
  /total: shown\.total,/.test(body) && /all: inUse\.length,/.test(body) && /superseded: accounts\.length - inUse\.length,/.test(body),
);
check(
  "the warning names every account that cannot order, from the whole roster, and never a superseded one",
  /const blockedIds = roster\.filter\(\(a\) => a\.cannotOrder\)\.map\(\(a\) => a\.id\);/.test(body) &&
    /cannotOrder: !isSuperseded\(a\) && a\.status === "active"/.test(body),
);
check(
  "and the unbilled count is over every account in use",
  /const unbilledAccounts = inUse\.filter\(/.test(body),
);
/*
 * The search asks for every word of the cleaned term, never the cleaned phrase:
 * cleanSearchTerm turns "Acme, Inc." into "Acme Inc.", which the stored name
 * does not contain, so a phrase search could not find an organization typed as
 * it is written (board 40755884083).
 */
const cleanedFromPunctuation = accountListQuery({ q: "Acme, Inc. (North)" }).term;
check("a name with a comma and brackets is cleaned to words", cleanedFromPunctuation === "Acme Inc. North", JSON.stringify(cleanedFromPunctuation));
check(
  "and the search asks for each word, not the cleaned phrase",
  /for \(const w of words\) q = q\.ilike\("name", `%\$\{w\}%`\);/.test(body) && !/ilike\("name", `%\$\{query\.term\}%`\)/.test(body),
);

const page = readFileSync("src/app/portal/(app)/accounts/page.tsx", "utf8");
check(
  "the screen takes its warning and its counts from the whole set, never from the page's rows",
  /const blocked = result\.blocked;/.test(page) && /const unbilledAccounts = result\.unbilledAccounts;/.test(page) && !/rows\.filter\(/.test(page),
);
check("and the address carries the page, so it links and prints", /hrefFor=\{\(p\) => listHref\("\/portal\/accounts", keep, \{ page: String\(p\) \}\)\}/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the accounts list reads one page in full, and every count on it is over every account.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
