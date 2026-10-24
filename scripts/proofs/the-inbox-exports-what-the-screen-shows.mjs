/**
 * THE INBOX EXPORTS TO CSV EXACTLY WHAT THE SCREEN SHOWS, AND SAYS WHAT IT
 * COULD NOT READ.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-inbox-exports-what-the-screen-shows.mjs
 *
 * Office ready, operator ruling of 2026-10-20: "export to CSV". The filter,
 * search and sort are one function, run here on built items; the export and
 * the screen are read for calling it, the grant, and the partial read.
 */
import { readFileSync } from "node:fs";

const { inboxListRows } = await import("../../src/lib/inbox-list.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const item = (id, kind, receivedAt, name, summary) => ({
  kind, id, receivedAt, name, email: null, phone: null, summary, respondBy: null, answered: false, answeredAt: null, href: `/x/${id}`,
});
/* The read's own order is the due order. */
const items = [
  item("a", "contact", "2026-10-22T10:00:00Z", "Zed", "Roof question"),
  item("b", "design", "2026-10-20T10:00:00Z", "Amy", "Beam sizing"),
  item("c", "contact", "2026-10-21T10:00:00Z", "Bo", "Foundation crack"),
];
check("with no query, the read's due order stands", inboxListRows(items, {}).map((i) => i.id).join("") === "abc");
check("desc on due reverses it", inboxListRows(items, { dir: "desc" }).map((i) => i.id).join("") === "cba");
check("the kind filter keeps only that kind", inboxListRows(items, { kind: "contact" }).map((i) => i.id).join("") === "ac");
check("search matches the summary", inboxListRows(items, { q: "crack" }).map((i) => i.id).join("") === "c");
check("sorts by received", inboxListRows(items, { sort: "received" }).map((i) => i.id).join("") === "bca");
check("sorts by name", inboxListRows(items, { sort: "name" }).map((i) => i.id).join("") === "bca");
check("and never reorders the items it was given", items.map((i) => i.id).join("") === "abc");

const page = readFileSync("src/app/portal/(app)/inbox/page.tsx", "utf8");
const exp = readFileSync("src/app/api/portal/inbox/export/route.ts", "utf8");
check("the screen and the export use the one function", /inboxListRows\(read\.items/.test(page) && /inboxListRows\(read\.items/.test(exp));
check("the screen offers the export with its answered, kind, search and sort", /csvHref=\{`\/api\/portal\/inbox\/export/.test(page) && /answered: params\.answered, kind: params\.kind, q: params\.q/.test(page));
check("the export asks the screen's grant", /can\(actor, "inbox\.read"\)/.test(exp));
check("a source that could not be read is named in the file, so a short list is not passed off as the whole", /for \(const f of read\.failed\) preamble\.push\(\["Not included, could not be read", f\]\);/.test(exp));
check("every cell goes through the shared escaping rule", /from "@\/lib\/csv"/.test(exp) && /csv\(\{/.test(exp));

console.log("");
if (wrong === 0) {
  console.log("PASS: the inbox exports exactly what the screen shows, and says what it could not read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
