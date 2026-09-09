import "server-only";
import { csv } from "./csv";
import { formatFigure, type Figure, type Report } from "./ops-reports";
import { moneyCell } from "./ops-money";


/**
 * A REPORT AS A FILE, AND THE MANIFEST THAT SAYS WHAT THE FILE IS.
 *
 * Phase 12 Section 2, the reporting prompt's Section 3. The four owner reports already answer "what did the firm
 * do this period" on a screen. This is the same answer as something somebody
 * can send to an accountant, and the difference between the two is not the
 * formatting: a screen is read by the person who opened it, in front of the
 * numbers, with the notes beside them. A file is read later, by somebody else,
 * with none of that context and no way to ask.
 *
 * WHY THERE IS A MANIFEST AND WHAT IT IS FOR
 * ------------------------------------------
 * ops-binder.ts already argued this for evidence and the reasoning transfers
 * exactly: the manifest is what lets a reader tell a COMPLETE document from a
 * truncated one, and lets an audit assert both that everything present is
 * listed and that everything missing is marked missing rather than quietly
 * omitted.
 *
 * A report export without one is a column of numbers with no way to know
 * whether a figure is absent because the firm earned nothing or because a query
 * failed, which is the exact distinction the whole of Section 2 exists to keep.
 * So the manifest carries, for every figure:
 *
 *   the figure as the screen renders it, including "not computed"
 *   how many rows it was computed from
 *
 * and, separately, every reason the report could not compute something. A
 * reader who opens the file and finds "Gross, not computed" can see on the same
 * page that payments could not be read, rather than reading a blank as a zero.
 *
 * THE ROW COUNT IN THE MANIFEST IS A CHECK, NOT A DECORATION
 * ----------------------------------------------------------
 * The rows follow the manifest in the same file. If the two disagree, the file
 * was truncated between assembly and delivery, and reporting-audit asserts they
 * agree on every figure of every report. That is the one thing a CSV can prove
 * about itself.
 *
 * WHAT THE SCOPE LINE IS DOING THERE
 * ----------------------------------
 * Every export states the scope it was computed under, in the manifest, in
 * words. Real is the only scope any of this is reachable with today, and it
 * says so anyway: the day somebody adds a walkthrough export, a file that does
 * not name its scope becomes a file nobody can tell apart from a real one.
 */

/** The name a downloaded report should carry. */
export function exportFilename(report: Report, on = new Date()): string {
  return `254-${report.key}-${report.period}-${on.toISOString().slice(0, 10)}.csv`;
}

/**
 * How many rows the file will carry, so the manifest can be checked against it.
 *
 * Counted from the same arrays the rows are written from, which is the point:
 * there is no second traversal to disagree with the first.
 */
export function exportRowCount(report: Report): number {
  return report.sections.reduce(
    (n, section) => n + section.figures.reduce((m, f) => m + (f.rows?.length ?? 0), 0),
    0,
  );
}

/**
 * A row's contribution, in the units a person reading the file expects.
 *
 * Money in DOLLARS, through moneyCell, which ops-money already provides for
 * exactly this and which renders an absent amount as an empty cell rather than
 * as 0.00. The first version wrote raw cents, so a $675.00 refund appeared in
 * an accountant's spreadsheet as 67500, and it was found by reading a real file
 * rather than by a check.
 *
 * Counts and durations are written as the integers they are, because a count of
 * three is three and not 0.03.
 */
function cellFor(kind: Figure["kind"], value: number | null): string {
  if (value === null) return "";
  return kind === "money" ? moneyCell(value) : String(value);
}

export function reportCsv(
  report: Report,
  by: { email: string; role: string },
  on = new Date(),
): string {
  /*
   * READ OFF THE REPORT, NEVER PASSED IN. The parameter that used to be here
   * defaulted to "real", so a report built including demonstrations produced a
   * file stating in words that demonstrations were excluded. See the comment on
   * Report.scope: a document that describes itself wrongly is the defect this
   * whole section is about, one level up.
   */
  const scope = report.scope;
  const figures = report.sections.flatMap((s) =>
    s.figures.map((f) => ({ section: s.title, figure: f })),
  );

  const preamble: [string, unknown][] = [
    ["254 Engineering Services", report.title],
    ["Period", report.period],
    ["Assembled", on.toISOString()],
    ["Assembled for", `${by.email} (${by.role})`],
    [
      "Scope",
      scope === "real"
        ? "Real records only. Seeded and demonstration records are excluded by the query, not by this file."
        : "INCLUDING DEMONSTRATIONS. This file counts seeded records and is not a statement about the firm.",
    ],
    ["Figures", figures.length],
    ["Rows", exportRowCount(report)],
  ];

  /*
   * MANIFEST FIRST, ROWS SECOND, IN ONE FILE.
   *
   * Two files would be two things to keep together, and the one that goes
   * missing is always the manifest.
   */
  for (const { section, figure } of figures) {
    preamble.push([
      `Figure: ${section} / ${figure.label}`,
      `${formatFigure(figure)} (${figure.rows === null ? "no rows: the query did not run" : `${figure.rows.length} row(s)`})`,
    ]);
  }

  if (report.unavailable.length === 0) {
    preamble.push(["Not computed", "Nothing. Every figure on this report was produced by a query that ran."]);
  } else {
    for (const [i, reason] of report.unavailable.entries()) {
      preamble.push([`Not computed ${i + 1}`, reason]);
    }
  }

  const rows: unknown[][] = [];
  for (const { section, figure } of figures) {
    for (const row of figure.rows ?? []) {
      rows.push([section, figure.label, figure.kind, row.label, row.detail, cellFor(figure.kind, row.value)]);
    }
  }

  return csv({
    preamble,
    headers: ["Section", "Figure", "Kind", "Record", "Detail", "Amount or count"],
    rows,
  });
}
