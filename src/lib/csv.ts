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

/**
 * READING a CSV line, which is not the mirror image of writing one.
 *
 * Phase 12 Section 4, Section 1. This module has escaped OUTPUT since Phase 6
 * and nothing had ever parsed INPUT, so the one place that needed to did it
 * with `line.split(",")` and had a live defect for it.
 *
 * WHAT THAT COST, AND IT IS MONEY
 * --------------------------------
 * `/account/order` lets a B2B customer paste properties, one per line, as
 * address, city, county, postcode. Split on commas, this
 *
 *   1200 Ocean Drive, Suite 4, Corpus Christi, Nueces, 78404
 *
 * gives address "1200 Ocean Drive", city "Suite 4", COUNTY "Corpus Christi" and
 * postcode "Nueces". splitBatch checked the county was PRESENT and never that
 * it was real, so:
 *
 *   isCoastal asks twiaCounties.has("Corpus Christi"), a city, and answers no,
 *   so the coastal surcharge is not applied to a property on the coast and the
 *   firm undercharges; and the county also chooses the protocol, so the
 *   property is dispatched under the wrong inspection.
 *
 * The property was accepted, priced, charged and dispatched, and nothing said a
 * word. A suite number is not an exotic address.
 *
 * WHY IT LIVES HERE
 * ------------------
 * The same argument the top of this file makes about escaping. One rule for how
 * this platform reads a delimited line, tested once, and every caller inherits
 * it. A second copy is a second chance for one of them to be the copy that
 * forgot quotes.
 */
export function parseLine(line: string, delimiter = ","): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      /* A doubled quote inside a quoted field is one literal quote. */
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}
