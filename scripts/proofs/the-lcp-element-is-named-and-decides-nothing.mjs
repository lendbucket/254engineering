/**
 * perf-audit names each route's LCP element, and the naming decides nothing.
 *
 * Robert, 10:26 Central 2026-10-31: "Yes to the diagnostic line naming each
 * page's LCP element in the speed audit, no limit or verdict changed." The
 * audit launches Chrome on load, so what it reads off a run lives in a pure
 * function, scripts/lib/lcp-element.mjs, and this proof hands that function
 * the shape Lighthouse 13 returns, read off a real run on 2026-10-31: a list
 * holding a subparts table and a node.
 */
import { readFileSync } from "node:fs";
import { lcpElementOf, lcpElementAcross } from "../lib/lcp-element.mjs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const auditsWith = (subparts, node) => ({
  "lcp-breakdown-insight": {
    scoreDisplayMode: "informative",
    details: {
      type: "list",
      items: [
        {
          type: "table",
          items: Object.entries(subparts).map(([subpart, duration]) => ({ subpart, label: subpart, duration })),
        },
        ...(node ? [{ type: "node", selector: node.selector, nodeLabel: node.label, snippet: "<p>" }] : []),
      ],
    },
  },
});

const paragraph = { selector: "main > section > p.prelaunch", label: "This firm is   not yet\n offering services." };
const text = lcpElementOf(auditsWith({ timeToFirstByte: 410.4, elementRenderDelay: 2650.6 }, paragraph));
check("a text element is named", text.named === true && text.selector === paragraph.selector, JSON.stringify(text));
check("and read as text, because it waited on no resource", text.text === true);
check("with its label's whitespace collapsed", text.label === "This firm is not yet offering services.", text.label);
check("and its subparts rounded to whole ms", text.subparts?.elementRenderDelay === 2651, JSON.stringify(text.subparts));

const photo = lcpElementOf(
  auditsWith(
    { timeToFirstByte: 400, resourceLoadDelay: 900, resourceLoadDuration: 1200, elementRenderDelay: 100 },
    { selector: "img.hero", label: "Coastal Bend" },
  ),
);
check("an image is read as a resource", photo.named === true && photo.text === false, JSON.stringify(photo));
/* Lighthouse drops a subpart it has no value for, so either one alone still means a resource. */
const durationOnly = lcpElementOf(
  auditsWith({ timeToFirstByte: 400, resourceLoadDuration: 800, elementRenderDelay: 50 }, { selector: "img", label: "" }),
);
check("a load duration alone still reads as a resource", durationOnly.text === false, JSON.stringify(durationOnly.subparts));
const delayOnly = lcpElementOf(
  auditsWith({ timeToFirstByte: 400, resourceLoadDelay: 800, elementRenderDelay: 50 }, { selector: "img", label: "" }),
);
check("a load delay alone still reads as a resource", delayOnly.text === false, JSON.stringify(delayOnly.subparts));

const none = lcpElementOf({});
check("no insight audit says so rather than naming anything", none.named === false && /no lcp-breakdown-insight/.test(none.reason), JSON.stringify(none));
const errored = lcpElementOf({ "lcp-breakdown-insight": { scoreDisplayMode: "error" } });
check("an errored insight says so", errored.named === false && /error/.test(errored.reason), JSON.stringify(errored));
const nodeless = lcpElementOf(auditsWith({ timeToFirstByte: 1 }, null));
check("timings with no node are not a name", nodeless.named === false, JSON.stringify(nodeless));

const across = lcpElementAcross([text, text, photo]);
check("across runs the most common element wins", across.selector === paragraph.selector && across.count === 2 && across.runs === 3);
check("and a route whose element changed says how many it saw", across.distinct === 2, `${across.distinct}`);
const nothing = lcpElementAcross([none, none]);
check("a route no run could name carries the reason", nothing.named === false && nothing.runs === 2, JSON.stringify(nothing));

/* The audit must read it and must not turn it into a verdict. */
const audit = readFileSync(new URL("../perf-audit.mjs", import.meta.url), "utf8");
const start = audit.indexOf("LCP ELEMENT, recorded not judged");
const block = start < 0 ? "" : audit.slice(start, audit.indexOf("THE RAW SAMPLES, OPT IN", start));
check("perf-audit reads the element off every run", audit.includes("element: lcpElementOf(a),"));
check("and keeps the most common per route", audit.includes("lcpElement: lcpElementAcross(ok.map((r) => r.element)),"));
check(
  "and the block that prints it calls no rec() and reads no ceiling",
  block.length > 0 && !/rec\(|CEILINGS|verdictFor|process\.exitCode/.test(block),
  `${block.length} chars read`,
);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: perf-audit names each route's LCP element, says whether it is text, and the naming decides nothing."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
