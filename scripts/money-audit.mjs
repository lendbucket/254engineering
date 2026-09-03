/**
 * Money, the evidence binder, and the one CSV escaping rule.
 *
 *   npx tsx scripts/money-audit.mjs
 *
 * Pure. No server, no database, no network. Runs in phase zero.
 *
 * WHAT THIS FILE IS GUARDING
 * --------------------------
 * That an absent figure never becomes a zero.
 *
 * A file whose client price has not been entered and a file priced at nothing
 * are different facts, and every naive money implementation renders them
 * identically. Somebody then sums a column, gets a margin, and acts on a number
 * that is mostly absence. The error always points the same way, because the
 * missing figures are costs more often than revenue, so the invented margin is
 * always too high and always looks plausible.
 *
 * The second thing it guards is the formula escape on exports, which now belongs
 * to one module rather than being copied into each one.
 */
import fs from "node:fs";
import {
  add,
  coverageSentence,
  isKnown,
  marginOf,
  money,
  moneyCell,
  periodTotals,
  subtract,
} from "../src/lib/ops-money.ts";
import { BINDER_HEADERS, binderRows, decisionLabel, limitationsFor } from "../src/lib/ops-binder.ts";
import { cell, csv, csvHeaders, row } from "../src/lib/csv.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

// =====================================================================
// THE ONE THAT MATTERS: absent is not zero.
// =====================================================================
{
  rec("a known figure is known", isKnown(0) && isKnown(45000));
  rec("null is not", !isKnown(null));
  rec("undefined is not", !isKnown(undefined));
  rec("a non finite number is not", !isKnown(Number.NaN) && !isKnown(Infinity));

  /*
   * Zero is a price. It is displayed as one, because a file genuinely priced at
   * nothing is a real thing and hiding it behind "not set" would be the same
   * error in the other direction.
   */
  rec("zero displays as a figure", money(0) === "$0.00");
  rec("absent displays as words, not as zero", money(null) === "not set");
  rec("and the words are not a dash somebody could read as zero", !/^[-–—]$/.test(money(null)));
  rec("a real figure formats with separators", money(123456789) === "$1,234,567.89");

  rec("a CSV cell for zero is 0.00", moneyCell(0) === "0.00");
  /*
   * Empty, not "0.00". A spreadsheet column of costs where absence appears as
   * zero will be summed by somebody, and the sum will be wrong in the direction
   * that flatters.
   */
  rec("a CSV cell for absent is empty, never 0.00", moneyCell(null) === "");
}

// =====================================================================
// Arithmetic propagates absence.
// =====================================================================
{
  rec("adding known figures works", add(100, 200, 300) === 600);
  rec("adding nothing to something is unknown", add(100, null) === null);
  rec("and the null can be anywhere", add(null, 100) === null && add(100, null, 200) === null);
  rec("adding zeros is zero, not unknown", add(0, 0) === 0);

  rec("subtracting known figures works", subtract(1000, 400) === 600);
  rec("subtracting from nothing is unknown", subtract(null, 400) === null);
  rec("subtracting nothing is unknown", subtract(1000, null) === null);
  rec("a negative result is kept rather than clamped", subtract(100, 400) === -300);
}

// =====================================================================
// Margin on one file.
// =====================================================================
{
  const complete = marginOf({ clientPriceCents: 45000, techCostCents: 18500, engineerCostCents: 9500 });
  rec("a complete file has a margin", complete.margin === 17000);
  rec("and a percentage", complete.marginPercent === 37.8, String(complete.marginPercent));
  rec("and nothing missing", complete.missing.length === 0);

  const noEngineer = marginOf({ clientPriceCents: 45000, techCostCents: 18500, engineerCostCents: null });
  rec("a file missing the engineer figure has NO margin", noEngineer.margin === null);
  rec("and no percentage", noEngineer.marginPercent === null);
  rec("and names what is missing", noEngineer.missing.includes("engineer production"));
  /*
   * The revenue is still known and is still shown. Refusing to show anything
   * because one input is absent would be less useful than the truth, which is
   * that revenue is known and margin is not.
   */
  rec("but the revenue it does know is still reported", noEngineer.revenue === 45000);

  /*
   * A desk review with no site visit genuinely has no technician cost. That is a
   * cost of zero, not a missing figure, and its margin is knowable.
   */
  const deskReview = marginOf({ clientPriceCents: 30000, techCostCents: 0, engineerCostCents: 9500 });
  rec("a genuine zero cost still produces a margin", deskReview.margin === 20500);
  rec("and is not reported as missing", deskReview.missing.length === 0);

  const nothing = marginOf({ clientPriceCents: null, techCostCents: null, engineerCostCents: null });
  rec("a file with no figures at all names all three", nothing.missing.length === 3);
  rec("and has no margin", nothing.margin === null);

  const free = marginOf({ clientPriceCents: 0, techCostCents: 0, engineerCostCents: 0 });
  rec("a file priced at nothing has a margin of zero, which is a number", free.margin === 0);
  rec("and no percentage, because dividing by zero revenue is not a percentage", free.marginPercent === null);
}

// =====================================================================
// Period rollups. The dangerous one.
// =====================================================================
{
  const f = (price, tech, engineer) => ({
    clientPriceCents: price,
    techCostCents: tech,
    engineerCostCents: engineer,
  });

  const allComplete = periodTotals("2026-09", [f(45000, 18500, 9500), f(30000, 0, 9500)]);
  rec("a period of complete files totals", allComplete.revenue === 75000 && allComplete.margin === 37500);
  rec("and says it covers everything", /whole period/i.test(allComplete.coverage), allComplete.coverage);

  /*
   * The case this module exists for. Adding what is present would give revenue
   * 120000 against cost 28000, a margin of 92000 and 76 percent, which is
   * nonsense and looks entirely reasonable.
   */
  const mixed = periodTotals("2026-09", [
    f(45000, 18500, 9500),
    f(75000, null, null),
  ]);
  rec("a partial period excludes the incomplete file rather than zeroing it", mixed.revenue === 45000);
  rec("so the margin is the truth about what is known", mixed.margin === 17000);
  rec("and it is NOT the flattering number", mixed.margin !== 92000);
  rec("it counts how many files it covers", mixed.complete === 1 && mixed.files === 2);
  rec("and says so in words beside the number", /1 of 2/.test(mixed.coverage), mixed.coverage);
  rec(
    "and says the excluded file was left out rather than counted as nothing",
    /rather than counted as nothing/i.test(mixed.coverage),
  );

  const noneComplete = periodTotals("2026-09", [f(45000, null, null), f(30000, null, null)]);
  rec("a period where nothing is complete has no total at all", noneComplete.revenue === null && noneComplete.margin === null);
  rec("and says why rather than showing zero", /no total to show/i.test(noneComplete.coverage), noneComplete.coverage);

  const empty = periodTotals("2026-09", []);
  rec("an empty period has no total", empty.margin === null);
  rec("and says it is empty", /No files/i.test(empty.coverage));

  rec("the coverage sentence is singular when it should be", /1 file has/.test(coverageSentence(1, 1)), coverageSentence(1, 1));
}

// =====================================================================
// The CSV rule, now shared by every export.
// =====================================================================
{
  rec("a plain cell is quoted", cell("hello") === '"hello"');
  rec("an empty value is an empty quoted cell", cell(null) === '""' && cell(undefined) === '""');
  rec("a comma does not split the row", cell("a, b") === '"a, b"');
  rec("a quote is doubled", cell('he said "no"') === '"he said ""no"""');

  /*
   * The guard. These files carry free text somebody typed and are handed to
   * regulators, accountants and clients.
   */
  /*
   * Asserted on the prefix rather than by exact equality. The first version
   * compared against `"'${dangerous}"`, which is right until the dangerous
   * string itself contains a quote: HYPERLINK does, the quote doubling fires,
   * and the test failed while the code was correct.
   */
  for (const dangerous of ["=SUM(A1)", "+1", "-1", "@cmd", '=HYPERLINK("http://x")']) {
    rec(
      `a cell starting ${dangerous[0]} is neutralised (${dangerous.slice(0, 12)})`,
      cell(dangerous).startsWith("\"'"),
      cell(dangerous),
    );
  }
  const DANGEROUS = "=HYPERLINK(" + String.fromCharCode(34) + "http://x" + String.fromCharCode(34) + ")";
  const QUOTE = String.fromCharCode(34);
  const APOS = String.fromCharCode(39);
  const DQ = String.fromCharCode(34);
  rec(
    "and a dangerous string containing quotes is both neutralised and quoted",
    cell(DANGEROUS) === QUOTE + APOS + '=HYPERLINK(' + DQ + DQ + 'http://x' + DQ + DQ + ')' + QUOTE,
    cell(DANGEROUS),
  );
  rec("a tab is neutralised too", cell("\tvalue").startsWith("\"'"));
  rec("an ordinary minus inside text is left alone", cell("a - b") === '"a - b"');

  rec("a row joins with commas", row(["a", "b"]) === '"a","b"');

  const doc = csv({
    preamble: [["Report", "Margin"], ["Period", "2026-09"]],
    headers: ["File", "Margin"],
    rows: [["254-2026-0001", "170.00"]],
  });
  rec("a document carries its preamble", doc.includes('"Report","Margin"'));
  rec("and a blank line before the table", doc.includes("\r\n\r\n"));
  rec("and the headers", doc.includes('"File","Margin"'));
  /*
   * CRLF, because these are opened in Excel on Windows and a lone newline turns
   * the file into one very long row there.
   */
  rec("lines end CRLF", doc.includes("\r\n") && !/[^\r]\n/.test(doc));

  const headers = csvHeaders("margin-2026-09.csv");
  rec("the download is named", String(headers["Content-Disposition"]).includes("margin-2026-09.csv"));
  rec("and typed as CSV", String(headers["Content-Type"]).includes("text/csv"));
  rec("and told not to cache, because it names people and money", String(headers["Cache-Control"]).includes("no-store"));
}

// =====================================================================
// The evidence binder.
// =====================================================================
{
  const item = (over) => ({
    itemKey: over.itemKey ?? "elevations",
    label: over.label ?? "All four elevations",
    kind: over.kind ?? "photo",
    required: over.required ?? true,
    captures: over.captures ?? [],
    satisfied: over.satisfied ?? false,
    shortfall: over.shortfall ?? null,
  });
  /*
   * "storageKey" in over, not over.storageKey ?? default.
   *
   * The first version used ??, so passing an explicit null got the default back
   * and the measurement row appeared to carry a photograph. That is precisely
   * the absent-versus-default confusion this whole module exists to prevent,
   * committed inside its own test helper.
   */
  const capture = (over = {}) => ({
    id: over.id ?? "c1",
    valueText: "valueText" in over ? over.valueText : null,
    valueNumber: "valueNumber" in over ? over.valueNumber : null,
    unit: "unit" in over ? over.unit : null,
    storageKey: "storageKey" in over ? over.storageKey : "k/1.jpg",
    capturedAt: "capturedAt" in over ? over.capturedAt : "2026-09-01T10:00:00.000Z",
    lat: "lat" in over ? over.lat : 27.8,
    lng: "lng" in over ? over.lng : -97.4,
  });

  const rows = binderRows({
    items: [
      item({ captures: [capture(), capture({ id: "c2" })], satisfied: true }),
      item({
        itemKey: "deck",
        label: "Deck attachment",
        captures: [],
        satisfied: false,
        shortfall: "Needs a photograph.",
      }),
      item({
        itemKey: "pitch",
        label: "Roof pitch",
        kind: "measurement",
        captures: [capture({ id: "c3", valueNumber: 6, unit: "in12", storageKey: null })],
        satisfied: true,
      }),
    ],
  });

  rec("every capture becomes a row", rows.length === 4, `${rows.length} rows`);

  /*
   * The point of the binder. An item the protocol required and nobody captured
   * appears, marked MISSING. A binder that silently drops what is absent makes
   * an incomplete package look complete, which is the opposite of its purpose.
   */
  const missingRow = rows.find((r) => r[0] === "deck");
  rec("a required item nobody captured still appears", Boolean(missingRow));
  rec("marked as missing", missingRow?.[4] === "MISSING");
  rec("carrying the shortfall in words", missingRow?.[5] === "Needs a photograph.");

  const measurement = rows.find((r) => r[0] === "pitch");
  rec("a measurement carries its value and unit", measurement?.[5] === "6 in12");
  rec("and no stored file, because there is not one", measurement?.[6] === "");

  const photo = rows.find((r) => r[0] === "elevations");
  rec("a photograph references its stored file", photo?.[6] === "k/1.jpg");
  rec("and the location the device reported", String(photo?.[8]).includes("27.8"));
  rec("every row has as many columns as there are headers", rows.every((r) => r.length === BINDER_HEADERS.length));

  rec("a seal reads as sealed", decisionLabel("seal") === "Sealed");
  rec("a refusal reads as declining, not cancelling", /declined/i.test(decisionLabel("refuse")));

  const limits = limitationsFor({ complete: false, missingCount: 2, sealed: false, photographCount: 7 });
  rec("the binder says it is not an engineering opinion", limits.some((l) => /not an engineering opinion/i.test(l)));
  rec("and that it is not sealed", limits.some((l) => /not been certified/i.test(l)));
  rec("and names how many items are missing", limits.some((l) => /2 items/.test(l)));
  rec("and says photographs are referenced rather than embedded", limits.some((l) => /not embedded/i.test(l)));
  rec(
    "and that a recorded location is not a survey",
    limits.some((l) => /not a survey/i.test(l)),
  );

  const clean = limitationsFor({ complete: true, missingCount: 0, sealed: true, photographCount: 1 });
  rec("a complete sealed file does not claim items are missing", !clean.some((l) => /are not present/i.test(l)));
  rec("nor that it is uncertified", !clean.some((l) => /not been certified/i.test(l)));
  rec("but still states what it is", clean.some((l) => /not an engineering opinion/i.test(l)));
  rec("and still says photographs are not embedded", clean.some((l) => /not embedded/i.test(l)));
  rec("the singular reads correctly", /1 image is/.test(clean.find((l) => /not embedded/i.test(l)) ?? ""));
}

// ---------------------------------------------------------------------------
// The surfaces, read from disk.
//
// Everything above tests the modules. This tests that nothing else quietly
// reimplements them. The defect this catches is the one the modules exist to
// prevent: a page that formats cents itself, gets null, and prints $0.00.
//
// It reads source rather than a running page on purpose. A rendered screen only
// shows the branch the current data happens to take, and the dangerous branch is
// the one with no data in it.
// ---------------------------------------------------------------------------
{
  const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

  const surfaces = [
    "src/app/portal/(app)/page.tsx",
    "src/app/portal/(app)/billing/page.tsx",
    "src/app/portal/(app)/documents/page.tsx",
    "src/components/portal/Dashboard.tsx",
  ];

  for (const p of surfaces) {
    const src = read(p);
    rec(`${p} exists`, src !== null);
    if (!src) continue;

    /*
     * Dividing by 100 and formatting is what money() is for. Anywhere else it is
     * a second implementation, and the second one is the one that has not
     * thought about null.
     */
    rec(
      `${p} does not format cents itself`,
      !/\/\s*100\s*\)?\s*\.toFixed/.test(src) && !/toLocaleString\(["']en-US["']/.test(src),
      "use money() or moneyCell()",
    );
  }

  const dash = read("src/components/portal/Dashboard.tsx") ?? "";
  rec("the dashboard renders money through money()", /\bmoney\(/.test(dash));
  rec(
    "and asks isKnown rather than testing truthiness",
    /isKnown\(/.test(dash) && !/tile\.value\s*\?/.test(dash),
    "a zero is truthy-false and would render as absent",
  );

  const countTile = dash.slice(dash.indexOf("export function CountTiles"), dash.indexOf("export function MoneyTiles"));
  rec(
    "the count tile never calls money()",
    countTile.length > 0 && !/\bmoney\(/.test(countTile),
    "counts and money are different facts",
  );

  const board = read("src/lib/ops-dashboard.ts") ?? "";
  rec("dashboard money is typed Cents", /value: Cents;/.test(board));
  /*
   * The mirror of the rule the rest of this file enforces. An empty ledger is a
   * real zero and must read as one; only a read that failed is unknown. The
   * first version of the dashboard got this backwards and printed "not set" for
   * a month in which an engineer had simply earned nothing.
   */
  rec(
    "an empty ledger is a zero, not an absence",
    /rows === null \? null : rows\.reduce/.test(board),
    "only a failed read is unknown",
  );
  /*
   * Counted, not merely found. Both money-bearing dashboards say it, and a
   * check that passes on one occurrence goes green while the other role has
   * quietly lost the distinction. That is the defect class this project keeps
   * hitting, and it caught this exact check being too weak.
   */
  rec(
    "and both ledgers say a failed read is not a zero",
    (board.match(/could not be read, so this is not a zero/g) ?? []).length >= 2,
    "the engineer's production and the technician's pay",
  );

  const docs = read("src/lib/ops-docs.ts") ?? "";
  rec("every export is composed through csv()", (docs.match(/return csv\(/g) ?? []).length >= 3);
  rec(
    "no export builds a row by joining commas",
    !/\.join\(","\)/.test(docs),
    "cell() is the only escaping rule",
  );
  rec("money cells go through moneyCell", /moneyCell\(/.test(docs));
  rec(
    "the by-file export states what an empty cell means",
    /has not been entered\. It is not a zero/.test(docs),
  );
  rec(
    "the by-period export states which files it left out",
    /excluded rather than counted as nothing/.test(docs),
  );

  const route = read("src/app/api/portal/exports/route.ts") ?? "";
  rec("the export route exists", route.length > 0);
  rec(
    "every export writes an audit row",
    (route.match(/writeAudit\(/g) ?? []).length >= 2,
    "taking records off the platform is an event",
  );
  rec("the billing exports check billing.read", /can\(actor, "billing\.read"\)/.test(route));
  rec(
    "the report is chosen from a fixed list",
    /report === "binder"/.test(route) && /That is not a report this platform produces/.test(route),
    "never a path or table name from the caller",
  );
}

console.log("============ MONEY, BINDER, AND EXPORTS ============");
console.log("an absent figure is never a zero, and a missing item is never omitted\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Nothing absent is reported as nothing.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
