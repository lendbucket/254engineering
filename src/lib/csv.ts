/**
 * One CSV escaping rule for the whole platform.
 *
 * WHY THIS IS A SHARED MODULE AND NOT A HELPER IN EACH EXPORT
 * -----------------------------------------------------------
 * The responsible charge export wrote its own. Phase 6 adds four more exports,
 * and five copies of an escaping rule is five chances for one of them to be the
 * copy that forgot the formula guard. The rule lives once, and the audit tests
 * it once, and every export inherits both.
 *
 * THE FORMULA GUARD IS THE POINT
 * ------------------------------
 * A spreadsheet treats a cell beginning =, +, - or @ as a formula. These exports
 * carry free text somebody typed: why an engineer would not seal a package, what
 * a technician observed, a client's name. A reason beginning "-- the roof deck"
 * is evaluated rather than read, and one beginning "=HYPERLINK(...)" is worse
 * than that.
 *
 * The guard is a leading apostrophe, which every spreadsheet reads as "this is
 * text" and does not display. It is not a cosmetic decision: these files are
 * handed to regulators, accountants and clients.
 */

/** Escape one cell. Everything that becomes a CSV goes through here. */
export function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** One row. */
export function row(values: unknown[]): string {
  return values.map(cell).join(",");
}

/**
 * A whole document: optional preamble lines, a header row, and the body.
 *
 * CRLF line endings, because the people opening these are on Windows with Excel
 * and a lone newline turns the file into one long row there.
 */
export function csv(options: {
  preamble?: [string, unknown][];
  headers: string[];
  rows: unknown[][];
}): string {
  const lines: string[] = [];
  for (const [label, value] of options.preamble ?? []) lines.push(row([label, value]));
  if (options.preamble?.length) lines.push("");
  lines.push(row(options.headers));
  for (const r of options.rows) lines.push(row(r));
  return lines.join("\r\n");
}

/** The headers a download needs, so a browser saves it rather than showing it. */
export function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    /*
     * These files name properties, people and money. Nothing between here and
     * the person who asked for it should keep a copy.
     */
    "Cache-Control": "no-store, max-age=0",
  };
}
