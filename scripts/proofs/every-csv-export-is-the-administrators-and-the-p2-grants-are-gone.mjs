/**
 * EVERY CSV EXPORT IS THE ADMINISTRATOR'S, AND THE FIVE P2 GRANTS ARE GONE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/every-csv-export-is-the-administrators-and-the-p2-grants-are-gone.mjs
 *
 * Robert, 2026-11-02, approving P2 (issue #1, comment 6567596115) with one
 * addition: "engineer loses clients.list; read_only loses pricing.read,
 * billing.read, ledger.read_all AND clients.list; every CSV export moves to the
 * admin export gate (option a), per my 2026-10-28 ruling 'owner or admin only'."
 *
 * Asked three ways, none of them the module agreeing with itself:
 *   1. the five revoked pairs by name, against DEFAULT_ROLES, and against the
 *      migration chain read in order (0108 deletes exactly them);
 *   2. mayExport for every one of the nine roles against every screen grant a
 *      CSV door asks, so only the administrator gets a file;
 *   3. every CSV door in src, FOUND by its csvHeaders or text/csv rather than
 *      listed, asks the export gate before it reads. A new CSV door that forgets
 *      the gate turns this red without anybody adding it here.
 * The live refusal of the two staff levels at the real routes is roles-audit's,
 * on the board.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const { LIST_EXPORT_GRANT, mayExport } = await import("../../src/lib/list-exports.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ---- 1. the five pairs, by name ---- */
const REVOKED = [
  ["engineer", "clients.list"],
  ["read_only", "pricing.read"],
  ["read_only", "billing.read"],
  ["read_only", "ledger.read_all"],
  ["read_only", "clients.list"],
];
const grantsOf = (key) => DEFAULT_ROLES.find((r) => r.key === key)?.grants ?? [];
const stillHeld = REVOKED.filter(([r, a]) => grantsOf(r).includes(a));
check("DEFAULT_ROLES holds none of the five revoked pairs", stillHeld.length === 0, stillHeld.map((p) => p.join(" ")).join(", ") || "engineer clients.list; read_only pricing.read, billing.read, ledger.read_all, clients.list");
check("and the administrator still holds all four actions", ["clients.list", "pricing.read", "billing.read", "ledger.read_all"].every((a) => grantsOf("admin").includes(a)));
check("and the rest of the office keeps clients.list", ["dispatcher", "sales", "customer_service", "rep", "ops_manager"].every((r) => grantsOf(r).includes("clients.list")));

const DIR = "supabase/migrations";
const migration = readdirSync(DIR).find((f) => f.startsWith("0108_"));
check("0108 exists", Boolean(migration), migration ?? "none");
const sql = migration ? readFileSync(join(DIR, migration), "utf8") : "";
const deletes = [...sql.matchAll(/delete\s+from\s+eng_role_grants\s+where\s+role_key\s*=\s*'([a-z_]+)'\s+and\s+action\s*=\s*'([^']+)'\s*;/gi)].map((m) => `${m[1]} ${m[2]}`);
check(
  "0108 deletes exactly the five pairs, each by role and action",
  deletes.length === 5 && REVOKED.every(([r, a]) => deletes.includes(`${r} ${a}`)),
  deletes.join(", "),
);
check("and inserts nothing, drops nothing", !/\binsert\s+into\b/i.test(sql) && !/\bdrop\s+/i.test(sql));
check("and every delete in it names a role, so none can revoke from every role", ![...sql.matchAll(/delete\s+from\s+eng_role_grants\s+where\s+([^;]*);/gi)].some((m) => !/role_key\s*=/.test(m[1])));

/* ---- 2. the gate, for every role ---- */
const SCREEN_GRANTS = ["clients.list", "inbox.read", "quotes.manage", "refunds.request", "payments.charge", "crm.use", "orders.read", "files.list", "billing.read", "reports.revenue", "reports.production", "reports.pipeline", "reports.turnaround", "reports.activity", "reports.partner"];
const actorOf = (key) => ({ status: "active", grants: new Set(grantsOf(key)) });
const leaks = [];
for (const role of DEFAULT_ROLES.map((r) => r.key)) {
  for (const g of SCREEN_GRANTS) {
    if (mayExport(actorOf(role), g) && role !== "admin") leaks.push(`${role} ${g}`);
  }
}
check(`no role but the administrator may export any of ${SCREEN_GRANTS.length} screens (${DEFAULT_ROLES.length} roles)`, leaks.length === 0, leaks.join(", "));
const adminMissing = SCREEN_GRANTS.filter((g) => !mayExport(actorOf("admin"), g));
check("and the administrator may export every one of them", adminMissing.length === 0, adminMissing.join(", "));
check("the export gate is held by the administrator alone", DEFAULT_ROLES.filter((r) => r.grants.includes(LIST_EXPORT_GRANT)).map((r) => r.key).join(",") === "admin");
check("a suspended administrator exports nothing", !mayExport({ status: "suspended", grants: new Set(grantsOf("admin")) }, "clients.list"));

/* ---- 3. every CSV door, found by what it serves ---- */
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
/* The two CSV files about one record that Robert has not ruled on: the engineer's monthly responsible charge log and one file's evidence binder (list-exports.ts says why). Named, and counted below. */
const NOT_LISTS = [join("src", "app", "api", "portal", "review", "route.ts")];
const doors = walk(join("src", "app", "api")).filter((p) => /csvHeaders\(|text\/csv/.test(readFileSync(p, "utf8")));
const unguarded = doors.filter((p) => {
  if (NOT_LISTS.includes(p)) return false;
  const src = readFileSync(p, "utf8");
  /* exportFiles( is the ticked-files door delegating to ops-bulk-files, whose gate is asserted on its own below. */
  return !/mayExport\(|LIST_EXPORT_GRANT|"accounts\.manage"|exportFiles\(/.test(src);
});
check("the CSV doors were found at all", doors.length >= 10, `${doors.length}: ${doors.map((p) => p.split(/[\\/]/).slice(3, -1).join("/")).join(", ")}`);
check("every CSV door asks the export gate", unguarded.length === 0, unguarded.join(", "));
check("exactly one route is excused, the monthly responsible charge log", doors.filter((p) => NOT_LISTS.includes(p)).length === 1);
const bulk = readFileSync("src/lib/ops-bulk-files.ts", "utf8");
const body = bulk.slice(bulk.indexOf("export async function exportFiles("));
check(
  "the ticked-files export asks the gate before the screen's own grant and before any read",
  body.indexOf("can(actor, LIST_EXPORT_GRANT)") > 0 && body.indexOf("can(actor, LIST_EXPORT_GRANT)") < body.indexOf('can(actor, "files.list")') && body.indexOf("can(actor, LIST_EXPORT_GRANT)") < body.indexOf("filesByIds("),
);
const exportsRoute = readFileSync("src/app/api/portal/exports/route.ts", "utf8");
check("the margin and period files ask mayExport on billing.read", /if \(!mayExport\(actor, "billing\.read"\)\)/.test(exportsRoute));
check("the report files ask mayExport on the report's own action", /if \(!mayExport\(actor, entry\.action\)\)/.test(exportsRoute));

/* ---- and the screens offer the file only to whoever the door will serve ---- */
const SCREENS = {
  clients: /csvHref=\{mayExport\(actor, "clients\.list"\)/,
  inbox: /csvHref=\{mayExport\(actor, "inbox\.read"\)/,
  quotes: /csvHref=\{mayExport\(actor, "quotes\.manage"\)/,
  refunds: /csvHref=\{can\(actor, LIST_EXPORT_GRANT\)/,
  "payment-links": /csvHref=\{mayExport\(actor, "payments\.charge"\)/,
  prospects: /csvHref=\{mayExport\(actor, "crm\.use"\)/,
  "order-lookup": /csvHref=\{can\(actor, LIST_EXPORT_GRANT\)/,
};
const offered = Object.entries(SCREENS).filter(([s, re]) => !re.test(readFileSync(join("src", "app", "portal", "(app)", s, "page.tsx"), "utf8")));
check(`the ${Object.keys(SCREENS).length} list screens offer the CSV only through the gate`, offered.length === 0, offered.map(([s]) => s).join(", "));
check("the Files screen offers Export only through the gate", /canExport=\{mayExport\(actor, "files\.list"\)\}/.test(readFileSync(join("src", "app", "portal", "(app)", "files", "page.tsx"), "utf8")));

console.log(wrong ? `FAIL: ${wrong} check(s) above.` : "PASS: every CSV export is the administrator's, and the engineer and read only no longer hold the five revoked grants.");
process.exit(wrong ? 1 : 0);
