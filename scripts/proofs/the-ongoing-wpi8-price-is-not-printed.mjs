/**
 * PROOF: WHILE WPI-8 ONGOING CONSTRUCTION CANNOT BE ORDERED, NO PUBLIC PAGE
 * PRINTS ITS PRICE, AND EACH PAGE THAT NAMED IT SAYS IT IS QUOTED.
 *
 * Robert's ruling Q14 of 2026-11-02, from the live site audit (issue #1,
 * 6585009543, issue 1): "remove the $995 figure from the five pages and
 * llms-full until the line opens, saying ongoing construction is quoted; fix
 * the cost guide sentence".
 *
 *   A  the price book still holds the ruled $995 for the tier (nothing deleted)
 *   B  statedPriceCents is null for it while SCOPE_ADDENDUM_REQUIRED lists it,
 *      and equals the catalog price for every deliverable that needs no addendum
 *   C  no public content module carries $995 or its coastal total $1,070: every
 *      insight, every windstorm guide page and the price book's sentences
 *   D  the five pages the audit named each say ongoing construction is quoted
 *   E  the cost guide's "each figure is the one the order page charges" now
 *      stands beside only orderable figures, and says ongoing is quoted
 *   F  llms-full.txt's price line asks statedPriceCents (read in its source:
 *      the route reads the signed record at build, so it is not called here)
 *
 * When the line opens this proof goes red on B, which is the cue in BACKLOG.md
 * to restore the figure on purpose.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-ongoing-wpi8-price-is-not-printed.mjs
 */
import { readFileSync } from "node:fs";

const { CATALOG, catalogFor, statedPriceCents } = await import("../../data/catalog.ts");
const { SCOPE_ADDENDUM_REQUIRED } = await import("../../src/config/engineer-pay.ts");
const { deliverablePriceCents, servicePrices } = await import("../../src/config/prices.ts");
const { insights } = await import("../../src/content/insights.ts");
const { windstormPages } = await import("../../src/content/windstorm-program.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

/* The ruled figure, written out: an audit never takes its expectation from the thing it audits. */
const RULED_ONGOING_CENTS = 99_500;
const PRINTED = "$995";
const PRINTED_COASTAL = "$1,070";

check("the price book still holds $995 for WPI-8 ongoing", deliverablePriceCents("windstorm-wpi-8", "ongoing") === RULED_ONGOING_CENTS);

const ongoing = catalogFor("windstorm-wpi-8", "ongoing");
check("WPI-8 ongoing needs the signed scope addendum", "windstorm-wpi-8/ongoing" in SCOPE_ADDENDUM_REQUIRED);
check("so a page may state no price for it", ongoing !== undefined && statedPriceCents(ongoing) === null);
const others = CATALOG.filter((e) => !(`${e.serviceSlug}/${e.tier}` in SCOPE_ADDENDUM_REQUIRED));
check(
  "and every deliverable that needs no addendum states its catalog price",
  others.length > 0 && others.every((e) => statedPriceCents(e) === e.priceCents),
  `${others.length} deliverables`,
);

const corpus = JSON.stringify({ insights, windstormPages, servicePrices });
check(`no insight, windstorm guide page or price book sentence prints ${PRINTED}`, !corpus.includes(PRINTED));
check(`nor its coastal total ${PRINTED_COASTAL}`, !corpus.includes(PRINTED_COASTAL));

const post = (slug) => JSON.stringify(insights.find((p) => p.slug === slug) ?? null);
const page = (slug) => JSON.stringify(windstormPages.find((p) => p.slug === slug) ?? null);
const NAMED = [
  ["/windstorm/catastrophe-area", page("catastrophe-area"), "ongoing construction is quoted"],
  ["/structural-engineer/cost (the price book sentence)", JSON.stringify(servicePrices["windstorm-wpi-8"]?.whatChangesIt ?? null), "is quoted until it can be ordered online"],
  ["/insights/wpi-8-certificate", post("wpi-8-certificate"), "a WPI-8 inspection of ongoing construction is quoted"],
  ["/insights/structural-inspection-cost-texas", post("structural-inspection-cost-texas"), "a WPI-8 inspection of ongoing construction is quoted"],
  ["/insights/texas-windstorm-certificate-lookup", post("texas-windstorm-certificate-lookup"), "ongoing construction is quoted"],
];
for (const [path, text, phrase] of NAMED) check(`${path} says "${phrase}"`, text !== "null" && text.includes(phrase));

const cost = insights.find((p) => p.slug === "structural-inspection-cost-texas");
const sentence = (cost?.body ?? []).map((b) => b.text ?? "").find((t) => t.includes("Each figure is the one the order page charges")) ?? "";
check("the cost guide's sentence names only orderable figures and says ongoing is quoted", sentence.includes("Each figure is the one the order page charges; a WPI-8 inspection of ongoing construction is quoted.") && !sentence.includes(PRINTED), sentence.slice(0, 90));

const llms = readFileSync("src/app/llms-full.txt/route.ts", "utf8");
const body = llms.slice(llms.indexOf("function priceLine("), llms.indexOf("\n}\n", llms.indexOf("function priceLine(")));
check("llms-full's price line asks statedPriceCents and prints quoted when it is null", body.length > 0 && body.includes("statedPriceCents(entry)") && body.includes(": quoted."));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: while WPI-8 ongoing construction waits on its signed addendum, no public page or llms-full prints its price, the five pages say it is quoted, and the price book keeps $995."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
