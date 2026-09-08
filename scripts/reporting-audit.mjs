// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`.

/**
 * EVERY REPORT IS MEASURED, AND THE LIST OF REPORTS IS DERIVED.
 *
 *   npm run reporting-audit
 *
 * Phase 12 Section 2. The registry in src/lib/ops-reports.ts is the declared
 * inventory, the same idiom as scripts/lib/surfaces.mjs and for the same
 * reason: a list of things to check, maintained by hand, stops describing the
 * system the first time somebody forgets, and the forgetting is silent.
 *
 * email-audit learned this the expensive way. Three templates were written,
 * wired and shipped while its count sat at 352 and nothing failed, because the
 * fixture list was a list. So this derives the reports from the registry, and a
 * report that exists and is not measured here is a red board.
 *
 * WHAT THIS ASSERTS ABOUT A FIGURE
 * --------------------------------
 * The rule the section adds: every figure is a number a query produced, the
 * word none because the query ran and found nothing, or an absence because it
 * could not run. There is no fourth state, and in particular there is no
 * designed slot filled with a plausible value.
 *
 * So every figure must carry a note saying what its zero means, and every
 * figure must be expandable into the rows behind it. A total nobody can expand
 * is a number somebody has to trust, which the brief names as the defect class.
 */

process.loadEnvFile?.(".env.local");

import { readFileSync } from "node:fs";
import { REPORTS, ROWS_PER_PAGE, formatFigure, pageOfRows, periodOf } from "../src/lib/ops-reports.ts";
import { LICENSED_FIGURES } from "../src/lib/ops-authz.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("============ EVERY FIGURE IS ONE OF THREE THINGS ============");
console.log("");

// -------------------------------------------- the registry describes the module

{
  const source = readFileSync("src/lib/ops-reports.ts", "utf8");

  /*
   * Every exported builder must be in the registry. Read from the source rather
   * than from the registry itself, because the registry cannot report a report
   * it does not contain.
   */
  const exported = [...source.matchAll(/export async function (\w+Report)\(/g)].map((m) => m[1]);
  const registered = REPORTS.map((r) => r.build.name);
  const unmeasured = exported.filter((e) => !registered.includes(e)).sort();

  rec(
    `the module exports report builders (${exported.length})`,
    exported.length > 2,
    "a derivation over nothing passes forever",
  );
  rec(
    "every report builder that exists is in the registry",
    unmeasured.length === 0,
    unmeasured.length ? `NOT REGISTERED: ${unmeasured.join(", ")}` : `${registered.length} of ${exported.length}`,
  );

  /* And each carries the grant that gates it, so a report cannot ship ungated. */
  const ungated = REPORTS.filter((r) => !/^reports\.[a-z_]+$/.test(r.action)).map((r) => r.key);
  rec(
    "every report is gated by a reports.* action",
    ungated.length === 0,
    ungated.join(", "),
  );

  /*
   * The screen asks the same grant the registry names. Asserted on the source,
   * because the alternative is a page that renders for everybody while the
   * registry says otherwise.
   */
  const page = readFileSync("src/app/portal/(app)/reports/page.tsx", "utf8");
  rec(
    "the screen filters the registry by the actor's grants",
    /REPORTS\.filter\(\(r\) => can\(actor, r\.action\)\)/.test(page),
    "a report is a permission, and the screen has to ask",
  );
  rec(
    "and refuses outright when a role holds none of them",
    /allowed\.length === 0\) notFound\(\)/.test(page),
    "an empty reports page tells somebody what they are not allowed to see",
  );
}

// ------------------------------------------------ every figure obeys the rule

{
  const period = periodOf();
  const built = await Promise.all(REPORTS.map((r) => r.build(period)));

  const figures = built.flatMap((r) =>
    r.sections.flatMap((s) => s.figures.map((f) => ({ ...f, report: r.key, section: s.title }))),
  );

  rec(
    `the reports produced figures to check (${figures.length})`,
    figures.length > 5,
    "a check over no figures passes forever",
  );

  const noNote = figures.filter((f) => !f.note || f.note.trim().length < 10);
  rec(
    "every figure says what its zero means",
    noNote.length === 0,
    noNote.map((f) => `${f.report}/${f.label}`).join(", "),
  );

  const noRows = figures.filter((f) => f.rows === null);
  rec(
    "every figure can be expanded into the rows that produced it",
    noRows.length === 0,
    noRows.length
      ? `${noRows.map((f) => `${f.report}/${f.label}`).join(", ")}. A total nobody can expand is a number somebody has to trust.`
      : `${figures.length} figures carry their record set`,
  );

  /*
   * AND THE EXPANSION ADDS UP TO THE FIGURE ABOVE IT.
   *
   * This is the check the previous shape could not support. A figure used to
   * carry an href, and an href cannot be added up: the screen it pointed at ran
   * its own query, so "See the rows" could open a set that had nothing to do
   * with the total, and most of them did. Every one pointed at /portal/orders,
   * which is not a list of orders at all but the screen for orders that have
   * stopped moving, so the ordinary case was an empty table under a figure
   * reading thousands of dollars.
   *
   * Now the rows ARE the set the total was summed over, which makes the
   * arithmetic assertable. A count must have as many rows as it counts, and a
   * money figure must equal the sum of its rows.
   */
  const countsWrong = figures.filter(
    (f) => f.kind === "count" && f.value !== null && f.rows !== null && f.rows.length !== f.value,
  );
  rec(
    "a count has exactly as many rows as it counts",
    countsWrong.length === 0,
    countsWrong.length
      ? countsWrong.map((f) => `${f.report}/${f.label}: says ${f.value}, expands to ${f.rows.length}`).join(", ")
      : "",
  );

  const sumOf = (rows) => rows.reduce((n, r) => n + (typeof r.value === "number" ? r.value : 0), 0);
  const moneyWrong = figures.filter(
    (f) => f.kind === "money" && f.value !== null && f.rows !== null && sumOf(f.rows) !== f.value,
  );
  rec(
    "a money figure equals the sum of the rows under it",
    moneyWrong.length === 0,
    moneyWrong.length
      ? moneyWrong.map((f) => `${f.report}/${f.label}: says ${f.value}, rows add to ${sumOf(f.rows)}`).join(", ")
      : `${figures.filter((f) => f.kind === "money").length} money figures reconcile with their expansion`,
  );

  /* The screen has to render the expansion rather than link away to a screen
   * that would run a second query. Asserted on the source for the same reason
   * the grant filter is. */
  const screen = readFileSync("src/app/portal/(app)/reports/page.tsx", "utf8");
  rec(
    "the screen renders the rows rather than linking to a screen that might have them",
    /window\.shown\.map\(/.test(screen) && !/href=\{figure\.rows\}/.test(screen),
    "an href cannot be added up, and /portal/orders is not a list of orders",
  );

  /*
   * THE PAGE IS A WINDOW AND THE SUM IS NOT.
   *
   * Every row a figure was computed from stays in the figure, because that is
   * what makes the total checkable and what demo-audit sweeps for a
   * demonstration record. What must not happen is all of them reaching the
   * HTML: the pipeline figures carry one row per order that has EVER existed,
   * since "orders in this state right now" is a standing count rather than a
   * count for the period, and that set only grows.
   *
   * So the screen renders ROWS_PER_PAGE at a time. The two things that could
   * go wrong are both checked here: the sum quietly becoming the sum of the
   * visible page, and the invisible remainder never being mentioned.
   */
  rec(
    `the screen renders a window rather than every row (${ROWS_PER_PAGE} at a time)`,
    /pageOfRows\(/.test(screen) && ROWS_PER_PAGE > 0,
    "a figure over a busy month carries one row per payment, and pipeline carries one per order ever",
  );
  rec(
    "and says how many rows it is not showing",
    /the\s*\n?\s*sum of all \{figure\.rows\.length\}/.test(screen) || /sum of all \{figure\.rows\.length\}/.test(screen),
    "a table that silently stops is a reader counting 25 rows under a figure that says 400",
  );

  /*
   * PAGING IS ASSERTED AGAINST A SET BUILT HERE, NOT AGAINST THE DATABASE.
   *
   * The obvious version filters the live figures for one that exceeds a page
   * and checks that one. On this database no figure does, so that check would
   * report a pass over an empty list every run until the day the data grew, and
   * then it would be exercised for the first time in production. A check that
   * has never had a subject is a check nobody has tested.
   *
   * So the window is exercised over a set constructed to be bigger than a page,
   * which makes the assertion true or false today and every day.
   */
  const wide = Array.from({ length: ROWS_PER_PAGE * 2 + 3 }, (_, i) => ({
    label: `row-${i}`,
    detail: "",
    value: 100,
  }));
  const whole = sumOf(wide);
  const first = pageOfRows(wide, 1);
  const last = pageOfRows(wide, 999);
  const rejoined = [
    ...pageOfRows(wide, 1).shown,
    ...pageOfRows(wide, 2).shown,
    ...pageOfRows(wide, 3).shown,
  ];

  rec(
    `a window shows one page and the pages cover the whole set (${wide.length} rows, ${first.pages} pages of ${ROWS_PER_PAGE})`,
    first.shown.length === ROWS_PER_PAGE &&
      first.pages === 3 &&
      rejoined.length === wide.length &&
      sumOf(rejoined) === whole,
    "if the pages did not rejoin into the set, rows would be unreachable and the total unverifiable",
  );
  rec(
    "and a page number past the end clamps rather than rendering an empty table",
    last.page === last.pages && last.shown.length > 0 && pageOfRows(wide, 0).page === 1,
    "an empty table under a figure reading a number is the defect this whole section is about",
  );

  /*
   * THE THIRD STATE IS RENDERED AS WORDS, NEVER AS A NUMBER.
   *
   * The one thing that must never happen is an absent figure rendering as 0 or
   * $0.00. formatFigure is the only thing that turns a Figure into text, so it
   * is checked directly rather than by scraping the page.
   */
  rec(
    "an absent figure renders as words rather than a zero",
    formatFigure({ label: "x", value: null, kind: "money", note: "n", rows: null }) === "not computed" &&
      formatFigure({ label: "x", value: null, kind: "count", note: "n", rows: null }) === "not computed",
    "absent must never be indistinguishable from nothing",
  );
  rec(
    "a real zero renders as a figure, not as an absence",
    formatFigure({ label: "x", value: 0, kind: "money", note: "n", rows: null }) === "$0.00" &&
      formatFigure({ label: "x", value: 0, kind: "count", note: "n", rows: null }) === "none",
    "turning a real zero into an absence is the same lie the flattering way round",
  );

  const numericAbsent = figures.filter((f) => f.value === null && /^[-–—]?\d/.test(formatFigure(f)));
  rec(
    "and no absent figure on any live report renders as a number",
    numericAbsent.length === 0,
    numericAbsent.map((f) => `${f.report}/${f.label}`).join(", "),
  );
}

// ------------------------------- every report leaves as a file that says what it is

{
  /*
   * Phase 12 Section 3. A report on a screen is read by the person who opened
   * it, with the notes beside it. A file is read later, by somebody else, with
   * none of that. So the export carries a MANIFEST, and the manifest is what
   * these checks are about.
   *
   * The one thing a CSV can prove about itself is that it is not truncated, and
   * it can only prove that if it states its own size. So the manifest's row
   * count is compared against the rows actually written, on every report.
   */
  const { reportCsv, exportRowCount, exportFilename } = await import("../src/lib/ops-report-export.ts");
  const period = periodOf();
  const by = { email: "audit@254engineering.com", role: "admin" };

  const files = [];
  for (const r of REPORTS) {
    const built = await r.build(period);
    files.push({ key: r.key, built, body: reportCsv(built, by), name: exportFilename(built) });
  }

  rec(
    `every report can be exported as a file (${files.length})`,
    files.length === REPORTS.length && files.every((f) => f.body.length > 0),
    "a report nobody can hand to an accountant is a report that gets retyped into a spreadsheet",
  );

  /* The manifest names every figure, including the ones that could not be
   * computed, because a blank in a file is read as a zero. */
  const unlisted = [];
  for (const f of files) {
    for (const section of f.built.sections) {
      for (const figure of section.figures) {
        if (!f.body.includes(`${section.title} / ${figure.label}`)) {
          unlisted.push(`${f.key}/${figure.label}`);
        }
      }
    }
  }
  rec(
    "and the manifest names every figure on it",
    unlisted.length === 0,
    unlisted.length
      ? `${unlisted.join(", ")} is in the report and not in the file's manifest`
      : "including the absent ones, which a blank cell would otherwise read as zero",
  );

  /*
   * THE SIZE THE MANIFEST CLAIMS IS THE SIZE THE FILE CARRIES.
   *
   * Checked over the DEMONSTRATION scope as well as the real one, and the
   * reason is the operator's ruling of 2026-09-09: a check that filters live
   * data for a subject that does not exist yet is vacuous, so build the
   * subject. Production and development both hold no real orders or payments,
   * so the real scope exports four files of zero rows, and a manifest that
   * claimed the wrong count would agree with an empty body every time.
   *
   * The demonstration scope has rows today, which is what makes this assertion
   * capable of failing. It is the same data demo-audit proves never reaches a
   * real figure, used here for the one thing it is good for.
   */
  const measured = [...files];
  for (const r of REPORTS) {
    const built = await r.build(period, "including_demonstrations");
    measured.push({ key: `${r.key} (demonstrations)`, built, body: reportCsv(built, by) });
  }

  const withRows = measured.filter((f) => exportRowCount(f.built) > 0);
  const countOf = (body) => {
    const lines = body.split("\r\n");
    const header = lines.findIndex((l) => l.startsWith('"Section"'));
    return header === -1 ? -1 : lines.length - header - 1;
  };

  const wrong = measured.filter((f) => {
    const claimed = f.body.match(/^"Rows","(\d+)"/m);
    return !claimed || Number(claimed[1]) !== countOf(f.body);
  });

  rec(
    `the manifest's row count is checkable against a file that has rows (${withRows.length} of ${measured.length})`,
    withRows.length > 0,
    withRows.length === 0
      ? "every export is empty in both scopes, so the check below would pass over nothing"
      : `${withRows.map((f) => `${f.key}: ${exportRowCount(f.built)}`).join(", ")}`,
  );
  rec(
    "and the row count in the manifest is the number of rows in the file",
    wrong.length === 0,
    wrong.length
      ? `${wrong.map((f) => f.key).join(", ")}: the manifest and the body disagree, which is what a truncated file looks like`
      : `${measured.reduce((n, f) => n + exportRowCount(f.built), 0)} rows across ${measured.length} files`,
  );

  /*
   * THE FILE STATES THE SCOPE IT WAS ACTUALLY COMPUTED UNDER.
   *
   * Found by reading a real file rather than by a check. The scope used to be a
   * PARAMETER to the exporter with a default of "real", so a report built
   * including demonstrations produced a document whose manifest said, in words,
   * that demonstrations were excluded. A document describing itself wrongly is
   * this section's defect one level up, and nothing was looking.
   *
   * Both scopes are exercised, because a check over "real" alone would pass on
   * the exact bug: the wrong answer and the right answer agree there.
   */
  const scoped = [
    ...files.map((f) => ({ ...f, want: "real" })),
    ...measured.filter((f) => f.key.includes("demonstrations")).map((f) => ({ ...f, want: "demonstrations" })),
  ];
  const lying = scoped.filter((f) => {
    const line = f.body.match(/^"Scope","([^"]*)"/m);
    if (!line) return true;
    return f.want === "real"
      ? !/^Real records only/.test(line[1])
      : !/^INCLUDING DEMONSTRATIONS/.test(line[1]);
  });
  rec(
    `every file states the scope it was computed under (${scoped.length} files, both scopes)`,
    lying.length === 0,
    lying.length
      ? `${lying.map((f) => f.key).join(", ")}: the manifest names a scope the figures were not computed under`
      : "read off the report rather than passed in, so there is no second place to say it",
  );

  /* And it says what it could not compute, rather than leaving a gap. */
  const silent = files.filter((f) => !/"Not computed/.test(f.body));
  rec(
    "and every file says what the report could not compute",
    silent.length === 0,
    silent.length
      ? `${silent.map((f) => f.key).join(", ")} carries no Not computed line at all, so a reader cannot tell an absent figure from a zero`
      : "",
  );

  /* The export is gated by the report's own action, read from the registry. */
  const route = readFileSync("src/app/api/portal/exports/route.ts", "utf8");
  rec(
    "the export route asks the grant the registry names",
    /can\(actor, entry\.action\)/.test(route) && /REPORTS\.find/.test(route),
    "a fixed list here would be a second list to keep in step, and the third entry is where somebody forgets the check",
  );

  /* The record goes on the queue and the file does not, which is the standing
   * rule in docs/platform-state.md. */
  rec(
    "the record of an export is queued and the file is not",
    /enqueue\("report\.export"/.test(route) && !/enqueue\([^)]*body/.test(route),
    "a queued CSV is a CSV nobody receives: nothing here delivers a file to somebody who has walked away",
  );
}

// ------------------------------------------- the coastal figure shows its work

{
  /*
   * TWIA IS THE ONE FIGURE ON THESE REPORTS WITH TWO SOURCES.
   *
   * An order carries a `twia_county` boolean written at intake and a county
   * name a rule can be applied to, and they can disagree. Development already
   * holds such a row: a seeded Nueces order with the flag false. A report that
   * showed one number would be picking a winner, and the county name cannot
   * even answer for Harris, where the designated area is the part east of State
   * Highway 146.
   *
   * So the pipeline report has to carry a figure for every answer the
   * derivation can give, and the answers are taken from the derivation itself
   * rather than from a list here, which is the same reason the report list is
   * derived from the registry.
   */
  const { twiaStatus } = await import("../src/lib/ops-counties.ts");
  const answers = [...new Set(["Nueces", "Harris", "Bexar"].map((c) => twiaStatus(c)))];

  const pipeline = await (await import("../src/lib/ops-reports.ts")).pipelineReport(periodOf());
  const section = pipeline.sections.find((s) => /derived/i.test(s.title));

  rec(
    `the derivation has more than one answer to show (${answers.join(", ")})`,
    answers.length === 3,
    "a check over a derivation that only ever says one thing proves nothing",
  );
  rec(
    "the pipeline report shows how the coastal figure was derived",
    Boolean(section),
    section ? section.title : "no section on the pipeline report explains the derivation",
  );

  if (section) {
    const labels = section.figures.map((f) => f.label).join(" | ");
    const missing = [
      ["designated", /says designated/],
      ["check", /cannot answer/],
      ["the flag itself", /order records/],
      ["the disagreement", /disagree/],
    ]
      .filter(([, re]) => !re.test(labels))
      .map(([name]) => name);

    rec(
      "and shows what the name says, what the order records, and where they differ",
      missing.length === 0,
      missing.length ? `no figure for: ${missing.join(", ")}` : labels,
    );
  }
}

// ------------------------------------- the nav reaches everybody who may read

{
  /*
   * A NAV ITEM CARRIES ONE ACTION AND THE SCREEN ALLOWS FOUR.
   *
   * So the item has to name an action every report reading role holds. If a
   * role is ever granted one report and not the nav's, the link disappears for
   * them while the page stays reachable by URL, which is how a screen becomes
   * something people find by accident rather than something they are given.
   *
   * Derived from DEFAULT_ROLES rather than from a list here, so a role added on
   * the permission screen is covered without anybody remembering.
   */
  const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");
  const { NAV } = await import("../src/components/portal/nav.ts");

  const item = NAV.find((n) => n.href === "/portal/reports");
  rec("the reports screen is in the navigation", Boolean(item), item ? item.action : "no nav item points at it");

  if (item) {
    const reportActions = REPORTS.map((r) => r.action);
    const stranded = DEFAULT_ROLES.filter((role) => {
      const holds = role.grants.filter((g) => reportActions.includes(g));
      return holds.length > 0 && !role.grants.includes(item.action);
    }).map((r) => r.key);

    rec(
      `every role that may read a report can see the link (${item.action})`,
      stranded.length === 0,
      stranded.length
        ? `${stranded.join(", ")} hold a report grant and not ${item.action}, so the page is reachable only by URL for them`
        : "",
    );
  }
}

// ---------------------------------------- licensed figures are not grantable

{
  /*
   * The compile proof does the real work; this asserts the list is not empty,
   * because a proof over an empty type proves nothing and would pass silently.
   */
  rec(
    `licensed figures are declared (${LICENSED_FIGURES.length})`,
    LICENSED_FIGURES.length > 0,
    "an empty list would make the compile proof vacuous",
  );

  const proof = readFileSync("scripts/proofs/licensed-actions-are-unrepresentable.ts", "utf8");
  const uncovered = LICENSED_FIGURES.filter((f) => !proof.includes(`"${f}"`));
  rec(
    "and every one of them appears in the compile proof",
    uncovered.length === 0,
    uncovered.length ? `not proved unrepresentable: ${uncovered.join(", ")}` : "",
  );
}

// ------------------------------------------------------------------ verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A figure on a report is a claim the firm makes about itself.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Every figure is a number, a none, or an absence with a reason.`);
