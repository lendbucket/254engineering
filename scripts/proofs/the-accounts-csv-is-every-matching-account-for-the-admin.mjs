/**
 * THE ACCOUNTS CSV IS EVERY ACCOUNT THE SCREEN MATCHES, FOR THE OWNER OR AN
 * ADMINISTRATOR ONLY, THROUGH THE SHARED ESCAPING RULE, AND A FAILED READ
 * WRITES NO FILE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-accounts-csv-is-every-matching-account-for-the-admin.mjs
 *
 * Robert, 2026-10-28, 16:11 Central (issue #1 comment 6480742347): "It exports
 * every matching account through the same query and filters as the page,
 * owner or admin only, with the same CSV safety as the other exports."
 *
 * The paging rule and the CSV builder are pure and are driven here with built
 * rows. The door and the screen are read for the grant, the shared query, the
 * every-account scope and the refusal. roles-audit asks the rep and the
 * operations manager through the real route on the board.
 */
import { readFileSync } from "node:fs";

const { accountListQuery, pageOfAccounts, ACCOUNT_PAGE_SIZE } = await import("../../src/lib/account-list.ts");
const { accountsCsv, ACCOUNT_EXPORT_HEADERS } = await import("../../src/lib/account-export.ts");
const { can, DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ---------------------------------------------------- the gate, by role */
const actorFor = (role) => ({ id: `probe-${role}`, role, status: "active", grants: new Set(DEFAULT_ROLES.find((r) => r.key === role)?.grants ?? []) });
check("the administrator, which the owner holds, may export", can(actorFor("admin"), "accounts.manage") === true);
for (const role of ["rep", "ops_manager", "engineer", "field_tech", "dispatcher", "sales", "customer_service", "read_only"]) {
  check(`${role} may not`, can(actorFor(role), "accounts.manage") === false);
}

/* --------------------------------- every matching account, in the page's order */
const N = 173;
const roster = Array.from({ length: N }, (_, i) => ({
  id: `a${String(i).padStart(3, "0")}`,
  clientId: `c${String(i).padStart(3, "0")}`,
  status: i % 5 === 0 ? "suspended" : "active",
  billingMode: i % 2 ? "invoice" : "card",
  createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}.${String(i).padStart(3, "0")}Z`,
  cannotOrder: i % 7 === 0,
}));
const q = accountListQuery({ billing: "invoice", sort: "added", dir: "desc", page: "2" });
const shown = pageOfAccounts(roster, q, null, null);
const pages = [];
for (let p = 1; p <= shown.pages; p += 1) pages.push(...pageOfAccounts(roster, { ...q, page: p }, null, null).ids);
check("the export's list is every page of the screen's list, in the same order", shown.matchingIds.join() === pages.join(), `${shown.matchingIds.length} matching`);
check("not one page: more than a page, and the count is the total", shown.matchingIds.length === shown.total && shown.total > ACCOUNT_PAGE_SIZE, `${shown.total} of ${N}`);
check("and the filter is applied, not dropped", shown.matchingIds.length === roster.filter((a) => a.billingMode === "invoice").length);

/* ------------------------------------------------- the file, read as a file */
const row = (over) => ({
  id: "a1", clientId: "c1", clientName: "Acme, Inc.", status: "active", billingMode: "invoice",
  creditLimitCents: 500000, netDays: 30, orders: 3, ordersThisPeriod: 1, issuedUnpaidCents: 67500,
  unbilledCents: null, oldestUnpaidDays: 12, canOrder: true, blockedReason: "", users: 2,
  openStatement: { id: "s1", reference: "ST-1", period: "2026-10", totalCents: 67500 }, ...over,
});
const file = accountsCsv([row({}), row({ id: "a2", clientName: "=HYPERLINK(\"http://x\")", blockedReason: "-- over limit" })], q, N);
const lines = file.split("\r\n");
check("CRLF lines, as the other exports", lines.length > 6 && !file.includes("\n\n"));
check("the header row is the declared one", lines.includes(ACCOUNT_EXPORT_HEADERS.map((h) => `"${h}"`).join(",")));
check("money is dollars, never cents", file.includes('"675.00"') && file.includes('"5000.00"') && !file.includes('"67500"'));
check("an unknown figure is an empty cell, never zero", lines.find((l) => l.startsWith('"Acme, Inc."'))?.split(",").includes('""'));
check("a cell beginning with = is guarded as text", file.includes(`"'=HYPERLINK(""http://x"")"`));
check("and one beginning with - is guarded too", file.includes(`"'-- over limit"`));
check("the preamble says how many of how many, and the filter", file.includes('"2 matching, of 173"') && file.includes('"on invoice"'));

/* ----------------------------------------------- the door and the screen */
const route = readFileSync("src/app/api/portal/exports/route.ts", "utf8");
const at = route.indexOf('if (report === "accounts") {');
const branch = at < 0 ? "" : route.slice(at, route.indexOf("\n  }\n", at));
check("the door has an accounts branch", branch.length > 0);
check("it asks accounts.manage before reading anything", /if \(!can\(actor, "accounts\.manage"\)\) return bad\(/.test(branch) && branch.indexOf('can(actor, "accounts.manage")') < branch.indexOf("accountRows("));
check("it parses the page's query with the page's own helper", /const query = accountListQuery\(\{/.test(branch));
check("it reads every matching account through the screen's function", /await accountRows\(query, "every"\)/.test(branch));
check(
  "a failed read refuses before any audit row or file",
  /if \(!read\.ok\) \{\s*return bad\(/.test(branch) && branch.indexOf("if (!read.ok)") < branch.indexOf("writeAudit(") && branch.indexOf("if (!read.ok)") < branch.indexOf("accountsCsv("),
);
check("every export is audited, as the door's others are", /action: "export\.accounts"/.test(branch));
check("and the file is the shared builder behind the shared headers", /accountsCsv\(read\.rows, query, read\.all\)/.test(branch) && /csvHeaders\(accountsFilename\(stamp\(\)\)\)/.test(branch));
/* The name is dated by the door's own stamp(), so the export module reads no clock (board 40779701058). */
const exportModule = readFileSync("src/lib/account-export.ts", "utf8");
check("and the export module reads no clock of its own", !/new Date\(/.test(exportModule.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
const builder = readFileSync("src/lib/account-export.ts", "utf8");
check("the builder escapes through csv.ts and writes money through moneyCell, with no escaper of its own", /from "\.\/csv"/.test(builder) && /moneyCell\(/.test(builder) && !/replace\(\/"\/g/.test(builder));

const admin = readFileSync("src/lib/ops-accounts-admin.ts", "utf8");
check("accountRows takes every matching account from the paging rule, never a second filter", /const ids = scope === "every" \? shown\.matchingIds : shown\.ids;/.test(admin));

const page = readFileSync("src/app/portal/(app)/accounts/page.tsx", "utf8");
check(
  "the screen offers the export with its own query, only to the grant the door asks",
  /csvHref=\{can\(actor, "accounts\.manage"\) \? listHref\("\/api\/portal\/exports", keep, \{ report: "accounts" \}\) : undefined\}/.test(page),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the accounts CSV is every account the screen matches, for the owner or an administrator, escaped once, and refused on a failed read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
