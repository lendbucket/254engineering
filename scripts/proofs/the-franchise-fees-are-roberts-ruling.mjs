/**
 * THE FRANCHISE FEES ARE ROBERT'S RULING, AND ONLY IN ONE PLACE. Robert Reyna's
 * ruling of 2026-11-10 (overnight orders, the 254 franchise fees, FR3).
 *
 *   A  every figure, pinned here as a literal, independent of the file it
 *      checks (an audit never imports its expectation from the thing it
 *      audits): $39,500, $29,500 for the first three territories, 7% royalty
 *      on territory revenue, 2% brand fund, $400 a month technology fee, 20%
 *      veteran discount, and the engineering capacity fee not decided until
 *      FR1.
 *   B  the ruling carries Robert's name and the date, on every figure.
 *   C  no other source file types a figure: the amounts in cents and the
 *      ruled rates as their own constants appear nowhere else under src/.
 *   D  nothing public reads the file: no page under src/app/(site) imports it.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";

const { FRANCHISE_FEES, FRANCHISE_FEES_RULED_BY, FRANCHISE_FEES_RULED_ON, FRANCHISE_FEE_READINGS_ON, feeSentence } = await import("../../src/config/franchise-fees.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* The ruling, typed here by hand. Moving a figure means editing this AND the config. */
const RULED = {
  initialFee: { cents: 3_950_000, basisPoints: null },
  initialFeeFirstThreeTerritories: { cents: 2_950_000, basisPoints: null },
  royalty: { cents: null, basisPoints: 700 },
  brandFund: { cents: null, basisPoints: 200 },
  technologyFee: { cents: 40_000, basisPoints: null },
  veteranDiscount: { cents: null, basisPoints: 2_000 },
};

/* ------------------------------------------------------------- A, the figures */

for (const [key, want] of Object.entries(RULED)) {
  const f = FRANCHISE_FEES[key];
  check(`A: ${key} is set at the ruled figure`, f?.state === "set" && f.cents === want.cents && f.basisPoints === want.basisPoints, f ? `${f.cents ?? ""}${f.basisPoints ?? ""}` : "missing");
}
check("A: the royalty is charged on territory revenue", FRANCHISE_FEES.royalty.per === "territory revenue");
check("A: the technology fee is monthly", FRANCHISE_FEES.technologyFee.per === "month");
check("A: the engineering capacity fee is not decided, and waits on FR1", FRANCHISE_FEES.engineeringCapacityFee.state === "not-decided" && /FR1/.test(FRANCHISE_FEES.engineeringCapacityFee.waitsOn));
check("A: not decided is not zero", !("cents" in FRANCHISE_FEES.engineeringCapacityFee) && !("basisPoints" in FRANCHISE_FEES.engineeringCapacityFee));
check("A: the file holds exactly the seven fees the ruling names", Object.keys(FRANCHISE_FEES).sort().join() === [...Object.keys(RULED), "engineeringCapacityFee"].sort().join(), Object.keys(FRANCHISE_FEES).join());
check("A: the sentences read as the ruling does", feeSentence("initialFee") === "$39,500.00 per territory, once" && feeSentence("royalty") === "7% of territory revenue" && feeSentence("technologyFee") === "$400.00 per month" && feeSentence("engineeringCapacityFee") === "Not decided");

/*
 * THE FOUR READINGS, Robert's answer 8 of 2026-11-11 on issue #1, "all four
 * readings as written", typed here by hand as the figures are. Moving one is an
 * edit to the config AND to this list.
 */
const READINGS = {
  initialFeeFirstThreeTerritories: "the first three territories sold system wide",
  royalty: "territory revenue is the paid orders in the territory, net of refunds, by calendar month",
  brandFund: "the brand fund is charged on territory revenue, as the royalty is",
  veteranDiscount: "the veteran discount comes off the initial fee only",
};
check("A: the readings are dated 2026-11-11", FRANCHISE_FEE_READINGS_ON === "2026-11-11");
for (const [key, reading] of Object.entries(READINGS)) {
  const open = FRANCHISE_FEES[key]?.open ?? "";
  check(`A: ${key} carries Robert's reading, for counsel to confirm`, open === `Robert's reading of 2026-11-11 (issue #1, answer 8), for counsel to confirm: ${reading}.`, open);
}
check("A: the brand fund is charged on territory revenue", FRANCHISE_FEES.brandFund.per === "territory revenue" && feeSentence("brandFund") === "2% of territory revenue");
check("A: the veteran discount comes off the initial fee only", FRANCHISE_FEES.veteranDiscount.per === "the initial fee only");
const stillOpen = Object.entries(FRANCHISE_FEES).filter(([, f]) => f.state === "set" && f.open !== null && !String(f.open).startsWith("Robert's reading of 2026-11-11")).map(([k]) => k);
check("A: no fee is left open that the readings answered", stillOpen.length === 0, stillOpen.join(", "));

/* ------------------------------------------------------------ B, the ruling */

check("B: ruled by Robert Reyna", FRANCHISE_FEES_RULED_BY === "Robert Reyna");
check("B: on 2026-11-10", FRANCHISE_FEES_RULED_ON === "2026-11-10");
for (const [key, f] of Object.entries(FRANCHISE_FEES)) check(`B: ${key} carries the name and the date`, f.by === "Robert Reyna" && f.on === "2026-11-10");

/* ------------------------------------------------------- C, one home only */

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
});
const files = walk("src").map((p) => p.split("\\").join("/")).filter((p) => p !== "src/config/franchise-fees.ts");
const FIGURES = ["3_950_000", "3950000", "2_950_000", "2950000", "39,500", "29,500"];
const typed = files.filter((p) => {
  const src = readSource(p);
  return FIGURES.some((f) => src.includes(f));
});
check("C: no other source file types a franchise fee figure", typed.length === 0, typed.join(", ") || `${files.length} files read`);
check("C: the sweep read real files", files.length > 300, `${files.length}`);

/* --------------------------------------------------------- D, nothing public */

const site = walk("src/app/(site)").map((p) => p.split("\\").join("/"));
const importers = site.filter((p) => readSource(p).includes("franchise-fees"));
check("D: no public page imports the fees", importers.length === 0, importers.join(", ") || `${site.length} public files read`);

console.log(wrong === 0 ? "PASS: the franchise fees are Robert's ruling of 2026-11-10, and live in one file." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
