/**
 * THE REFUND REQUESTS EXPORT TO CSV EXACTLY WHAT THE SCREEN SHOWS, AND THE ROUTE
 * THAT MOVES MONEY STILL HAS NO GET.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/refund-requests-export-what-the-screen-shows.mjs
 *
 * Office ready, operator ruling of 2026-10-20: "export to CSV". The search and
 * the sort are one function, run here on built rows; the export and the screen
 * are read for calling it, the grants, the money and the GET.
 */
import { readFileSync } from "node:fs";

const { refundListRows } = await import("../../src/lib/refund-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const row = (id, createdAt, owed, reference, reason, by = "Proof Rep") => ({
  id, createdAt, orderId: id, orderReference: reference, requestedBy: "x", requestedByName: by, reason, owedCentsAtRequest: owed, decision: null,
});
const rows = [
  row("a", "2026-10-20T10:00:00Z", 70900, "254-O-1", "Customer moved the date"),
  row("b", "2026-10-21T10:00:00Z", 17500, "254-O-2", "Duplicate order"),
  row("c", "2026-10-19T10:00:00Z", 50000, "254-O-3", "Duplicate payment", "Other Rep"),
];
check("with no query, oldest asked first", refundListRows(rows, {}).map((r) => r.id).join("") === "cab");
check("search matches the reason", refundListRows(rows, { q: "duplicate" }).map((r) => r.id).sort().join("") === "bc");
check("search matches who asked", refundListRows(rows, { q: "other rep" }).map((r) => r.id).join("") === "c");
check("sorts by amount, largest first when asked", refundListRows(rows, { sort: "amount", dir: "desc" }).map((r) => r.id).join("") === "acb");
check("and never reorders the rows it was given", rows.map((r) => r.id).join("") === "abc");

const page = readFileSync("src/app/portal/(app)/refunds/page.tsx", "utf8");
const exp = readFileSync("src/app/api/portal/refunds/export/route.ts", "utf8");
const money = readFileSync("src/app/api/portal/refunds/route.ts", "utf8");
check("the screen and the export use the one function, so their rows cannot differ", /refundListRows\(read\.rows/.test(page) && /refundListRows\(read\.rows/.test(exp));
check("the screen offers the export with its own state, search and sort", /csvHref=\{`\/api\/portal\/refunds\/export\?\$\{csvQuery\}`\}/.test(page) && /\{ state, q: params\.q, sort: params\.sort, dir: params\.dir \}/.test(page));
check(
  "the export asks the screen's grants",
  /can\(actor, "refunds\.request"\) \|\| can\(actor, "refunds\.approve_within_limit"\) \|\| can\(actor, "payments\.refund"\)/.test(exp),
);
check("money is written as dollars, blank where unknown, never cents", /moneyCell\(r\.owedCentsAtRequest\)/.test(exp) && /moneyCell\(r\.decision\.refundedCents\)/.test(exp) && !/owedCentsAtRequest,/.test(exp));
check("every cell goes through the shared escaping rule (the formula guard)", /from "@\/lib\/csv"/.test(exp) && /csv\(\{/.test(exp));
check("and the route that moves money still has no GET", !/export (async )?function GET/.test(money));

console.log("");
if (wrong === 0) {
  console.log("PASS: the refund requests export what the screen shows, and the money route has no GET.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
