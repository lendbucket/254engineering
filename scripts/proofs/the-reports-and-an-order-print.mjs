/**
 * THE REPORTS AND AN ORDER SUMMARY PRINT, AND THE PRINTOUT CARRIES THE PAGE ONLY.
 *
 * Office-ready Batch B (issue #1, 6870906132): "Batch B prints the reports and
 * an order summary and fixes what does not print cleanly." CLAUDE.md 2d: order
 * summaries and reports print cleanly.
 *
 * By source, because printing is a browser act:
 *   1. /portal/reports and /portal/order-lookup/[id] each offer a print button;
 *   2. the button is hidden on the printout itself;
 *   3. the portal's menu, header and phone tabs are hidden in print, and the
 *      content column drops its offsets so the page starts at the margin.
 * The printout itself is read on a walk, as a PDF, and reported with the post.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (path) =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const reports = codeOf("src/app/portal/(app)/reports/page.tsx");
check("the reports offer a print button", /actions=\{<PrintButton label="Print these reports" \/>\}/.test(reports));
const order = codeOf("src/app/portal/(app)/order-lookup/[id]/page.tsx");
check("an order summary offers a print button", /<PrintButton label="Print this order" \/>/.test(order));
const button = codeOf("src/app/portal/(app)/intake/script/PrintButton.tsx");
check("the button prints and is hidden on the printout", /onClick=\{\(\) => window\.print\(\)\}/.test(button) && /print:hidden/.test(button));
const layout = codeOf("src/app/portal/(app)/layout.tsx");
check("the menu is not printed", /<aside className="[^"]*print:!hidden/.test(layout));
check("nor the header", /<header className="[^"]*print:hidden/.test(layout));
check("and the content column starts at the margin in print", /print:block print:pl-0 print:pt-0/.test(layout));
const chrome = codeOf("src/components/portal/PortalChrome.tsx");
check("nor the phone tabs", /data-portal-tabs[\s\S]{0,200}print:!hidden/.test(chrome));

console.log("");
if (wrong === 0) {
  console.log("PASS: the reports and an order summary print, and the printout carries the page only.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
