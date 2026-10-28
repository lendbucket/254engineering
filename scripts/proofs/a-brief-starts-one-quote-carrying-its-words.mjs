/**
 * A DESIGN BRIEF STARTS ONE QUOTE, CARRYING ITS WORDS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-brief-starts-one-quote-carrying-its-words.mjs
 *
 * Robert's answer 2 of 2026-10-27, 11:48 Central: "start a quote from this
 * brief" on the inquiries screen opens a quote request carrying the brief, and
 * the two tables are not merged. Four properties, each a way the action could
 * quietly do something else:
 *   1. The quote's brief carries every answer the customer gave, an unanswered
 *      one says so rather than vanishing, and the three flags that decide
 *      whether the firm takes the work survive by name.
 *   2. One brief opens one quote: the request is keyed on the brief, through
 *      requestQuote's idempotency, so a second press returns the same quote.
 *   3. It goes through the one quote door, on the design line, as a deliverable
 *      the office chose, and only the people who open quotes can do it. The
 *      audit names the brief only when a quote was actually opened.
 *   4. The brief's labels have one home, so the screen and the quote cannot
 *      describe the same answer two ways.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { composeQuoteBrief, briefQuoteRequestId, DESIGN_SERVICE } = await import("../../src/lib/brief-quote-rules.ts");
const { deliverablesFor } = await import("../../data/catalog.ts");

console.log("1. The quote carries the brief");
const full = composeQuoteBrief({
  asking_as: "builder",
  work_kind: "addition",
  deliverable: "sealed_plans",
  jurisdiction: "City of Waco",
  square_feet: 640,
  storeys: 2,
  drawings: "Architectural set, no structural",
  soil_report: false,
  permit_status: "Not applied",
  deadline: "Before the end of November",
  open_insurance_claim: true,
  active_litigation: false,
  prior_adverse_report: false,
});
for (const line of [
  "Asking as: Builder",
  "Work: Addition",
  "Asked for: Sealed plans",
  "Jurisdiction: City of Waco",
  "Square feet: 640",
  "Stories: 2",
  "What they have: Architectural set, no structural",
  "Soil report: no",
  "Permit status: Not applied",
  "Their date: Before the end of November",
  "Open insurance claim: yes",
  "Active or threatened litigation: no",
  "Prior adverse report: no",
]) {
  check(`it carries "${line}"`, full.split("\n").includes(line));
}
const sparse = composeQuoteBrief({
  asking_as: "owner", work_kind: "repair", deliverable: "design_review",
  jurisdiction: null, square_feet: null, storeys: null, drawings: "  ", soil_report: null,
  permit_status: null, deadline: null,
  open_insurance_claim: false, active_litigation: false, prior_adverse_report: false,
});
check("an unanswered square footage reads not given", sparse.includes("Square feet: not given"));
check("a blank answer reads not given rather than blank", sparse.includes("What they have: not given"));
check("a soil report nobody mentioned reads not said, which is not no", sparse.includes("Soil report: not said"));
check("every flag is carried even when all three are no", (sparse.match(/: no$/gm) ?? []).length >= 3);

console.log("2. One brief, one quote");
check("the key names the brief", briefQuoteRequestId("abc") === "design-inquiry:abc");
const inquiries = readFileSync("src/lib/ops-inquiries.ts", "utf8");
const act = inquiries.slice(inquiries.indexOf("export async function startQuoteFromBrief"));
check("the request is keyed on the brief", act.includes("clientRequestId: briefQuoteRequestId(brief.id)"));
check("the list finds a started quote by the same key", inquiries.includes('.in("client_request_id", keys)') && inquiries.includes("briefQuoteRequestId(r.id)"));

console.log("3. Through the one quote door, by the people who open quotes");
check("it calls requestQuote", /await requestQuote\(\{/.test(act));
check("on the design line", act.includes("serviceSlug: DESIGN_SERVICE,"));
check("as the deliverable the office chose", /\n\s*tier,\n/.test(act));
const quoted = deliverablesFor(DESIGN_SERVICE).filter((d) => d.orderType === "quote");
check("the design line has quoted deliverables to choose from", quoted.length > 0, quoted.map((d) => d.tier).join(", "));
check("only quotes.manage starts one", /if \(!can\(actor, "quotes\.manage"\)\) return \{ ok: false/.test(act));
check("the audit is written only when a quote was opened", /if \(!result\.duplicate\) \{\s*await writeAudit\(\{[^}]*action: "design_inquiry\.quote_started"/.test(act));
const route = readFileSync("src/app/api/portal/inquiries/route.ts", "utf8");
check("the route's start_quote action calls it", /action === "start_quote"[\s\S]*?startQuoteFromBrief\(actor,/.test(route));

console.log("4. One home for the labels");
const page = readFileSync("src/app/portal/(app)/inquiries/page.tsx", "utf8");
check("the screen imports the labels", /import \{ ASKING_AS, WORK_KIND, DELIVERABLE, DESIGN_SERVICE \} from "@\/lib\/brief-quote-rules"/.test(page));
check("and types none of its own", !/const (ASKING_AS|WORK_KIND|DELIVERABLE)\b/.test(page));
check("the start control is shown only to quotes.manage", page.includes('const canQuote = can(actor, "quotes.manage")'));

console.log(wrong === 0 ? "\nPASS: a design brief starts one quote, carrying its words." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
