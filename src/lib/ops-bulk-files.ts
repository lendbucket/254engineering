import "server-only";
import { csv } from "./csv";
import { moneyCell } from "./ops-money";
import { can, type Actor } from "./ops-authz";
import { filesByIds, type FileRow } from "./ops-crm";
import { writeAudit } from "./ops-audit";

/**
 * Exporting the files somebody selected.
 *
 * Phase 12 Section 4, Section 1. The approved prototype draws three bulk
 * buttons on the Files screen and this is the one of the three that describes
 * something the platform can honestly do. The reconciliation for all three is
 * docs/bulk-actions-reconciliation.md, and it comes before this file rather
 * than after it, which is the order CLAUDE.md section 2c fixes.
 *
 * WHY THIS IS NOT A REPORT
 * -------------------------
 * src/lib/ops-reports.ts has four exports and every one is keyed on a PERIOD
 * and a SCOPE, carries a manifest and records that the firm handed a statement
 * about itself to somebody. A selection of rows has no period. Putting it in
 * that module would mean inventing one, and a manifest that named a period this
 * export does not have is the same class of fabrication as a coverage claim the
 * data does not support.
 *
 * So it is an ordinary download of the rows a person is looking at, and it says
 * that about itself in its own preamble.
 *
 * EVERY ONE OF SECTION 2'S FOUR EXPORT DEFECTS IS ANSWERED HERE
 * --------------------------------------------------------------
 * Those four were found by READING a CSV rather than by any check, and each one
 * has a line in this file:
 *
 *   an export whose manifest said "Real records only" above eighteen
 *   demonstration rows          -> the preamble COUNTS them and the rows carry
 *                                  a Demonstration column. Nothing is filtered
 *                                  silently, because a filtered export and an
 *                                  empty one look identical to a reader.
 *   amounts written in cents    -> moneyCell, which writes dollars and leaves an
 *                                  absent figure EMPTY rather than 0.
 *   figures counting a seeded
 *   client                      -> there are no figures. This is rows, not sums,
 *                                  and that is deliberate: a total across a
 *                                  selection somebody made is a number whose
 *                                  meaning depends on what they happened to tick.
 *   a coverage claim the data
 *   did not support             -> the preamble says how many rows were ASKED
 *                                  for and how many came back, which are
 *                                  different numbers whenever a selection
 *                                  contains something the reader may not see.
 *
 * THE SELECTION IS NOT TRUSTED
 * -----------------------------
 * The browser sends ids. What comes back is whatever those ids resolve to
 * THROUGH THE SAME SCOPED QUERY the screen itself uses, so a person cannot
 * export a file by knowing its id. That is the rule /api/order-flow already
 * follows for a single order and ops-bulk follows for a batch: the second
 * computation is the authoritative one.
 */

/**
 * A date a spreadsheet understands, or a sentence saying there is not one.
 *
 * The same rule and the same spelling ops-reports.ts uses for the four reports.
 * Two spellings of "how this platform writes a date in a CSV" would drift, and
 * the reader holding both files is the person who would notice.
 */
const day = (value: string | null | undefined): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "no date recorded";

/** How many files one export may name. */
export const EXPORT_LIMIT = 300;

export type ExportResult =
  | { ok: true; filename: string; body: string; asked: number; returned: number; demonstration: number }
  | { ok: false; error: string };

/**
 * The columns, declared once.
 *
 * A list rather than an object spread, because the ORDER of a CSV's columns is
 * part of what somebody's spreadsheet formula points at, and a column order
 * that came out of key iteration is a column order nobody chose.
 */
const COLUMNS: { header: string; of: (f: FileRow) => unknown }[] = [
  { header: "File number", of: (f) => f.file_number },
  { header: "Status", of: (f) => f.status },
  { header: "Service", of: (f) => f.service_slug },
  { header: "Deliverable", of: (f) => f.deliverable },
  { header: "Property address", of: (f) => f.property_address },
  { header: "City", of: (f) => f.city },
  { header: "County", of: (f) => f.county },
  { header: "Urgency", of: (f) => f.urgency },
  /*
   * A DATE, NOT A TIMESTAMP, AND FOUND BY READING THE FILE.
   *
   * The first version wrote the column straight through, so a cell read
   * 2026-09-09T14:15:33.61822+00:00. Excel does not recognise that as a date:
   * it lands as text, cannot be sorted or compared, and looks like a machine
   * leaked into a document somebody is about to send a client.
   *
   * `day` in ops-reports.ts already made this decision for the four reports and
   * this is the same one, spelled the same way. An absent date says so in words
   * rather than being an empty cell, for the reason moneyCell gives about a
   * blank that somebody will eventually decide means zero.
   */
  { header: "Due", of: (f) => day(f.due_at) },
  { header: "Created", of: (f) => day(f.created_at) },
  /*
   * Money in dollars with an absent figure left EMPTY. A margin is deliberately
   * not here: it is a computed figure, and this export carries facts rather
   * than arithmetic, for the reason in the header.
   */
  { header: "Client price", of: (f) => moneyCell(f.client_price_cents ?? null) },
  { header: "Technician cost", of: (f) => moneyCell(f.tech_cost_cents ?? null) },
  { header: "Engineer cost", of: (f) => moneyCell(f.engineer_cost_cents ?? null) },
  /*
   * NAMED, NOT FILTERED. A demonstration row removed silently makes an export
   * of eighteen fixtures indistinguishable from an export of nothing, and the
   * reader has no way to ask which they are holding.
   */
  { header: "Demonstration", of: (f) => (f.is_demo ? "yes" : "no") },
];

export async function exportFiles(
  actor: Actor & { email: string },
  ids: string[],
  context: Record<string, unknown> = {},
): Promise<ExportResult> {
  /*
   * The same capability the Files screen itself needs. An export is a read, and
   * it must not be a wider read than the screen it is launched from.
   */
  if (!can(actor, "files.list")) return { ok: false, error: "Your role cannot read files." };
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (ids.length > EXPORT_LIMIT) {
    return {
      ok: false,
      error: `That is ${ids.length} files. This export names at most ${EXPORT_LIMIT} at a time.`,
    };
  }

  const rows = await filesByIds(actor, ids);
  const demonstration = rows.filter((f) => f.is_demo).length;

  /*
   * ASKED AND RETURNED ARE DIFFERENT NUMBERS AND BOTH ARE PRINTED.
   *
   * They differ whenever the selection contained a file this actor may not see,
   * or one deleted between the click and the export. A file silently missing
   * from a spreadsheet somebody is about to work from is the worst shape
   * available: it reads as a complete list.
   */
  const body = csv({
    preamble: [
      ["Export", "Selected files"],
      [
        "What this is",
        "The files that were selected on the Files screen, as they stand now. This is not a report: it has no period, and no figure here is a total.",
      ],
      ["Files asked for", ids.length],
      ["Files returned", rows.length],
      ...(rows.length !== ids.length
        ? ([
            [
              "Why those differ",
              "A selected file is missing from this export when your role may not see it, or when it no longer exists.",
            ],
          ] as [string, unknown][])
        : []),
      [
        "Demonstration rows",
        demonstration === 0
          ? "none"
          : `${demonstration} of ${rows.length}. They are seeded records, not the firm's work, and they are named in the Demonstration column rather than removed.`,
      ],
      ["Exported by", actor.email],
      /*
       * NO TIMESTAMP FROM THIS PROCESS. The audit row below is stamped by the
       * database and it is the record of when this happened; a second time
       * written here from a machine clock would be a second answer to the same
       * question. src/lib/db-now.ts carries the reasoning.
       */
      ["Amounts", "US dollars. An empty cell means the figure has not been entered, which is not zero."],
    ],
    headers: COLUMNS.map((c) => c.header),
    rows: rows.map((f) => COLUMNS.map((c) => c.of(f))),
  });

  /*
   * WRITTEN DOWN, BECAUSE AN EXPORT LEAVES THE BUILDING.
   *
   * Every row here names a property and carries what the firm charges for it.
   * The reporting module records its exports for the same reason and the
   * argument is in docs/platform-state.md: once a file has been handed to
   * somebody, the question stops being what the screen shows today.
   */
  await writeAudit({
    actor,
    action: "export.files.selected",
    entityType: "file",
    entityId: `${rows.length} file(s)`,
    summary:
      `Exported ${rows.length} of ${ids.length} selected file(s)` +
      (demonstration ? `, ${demonstration} of them demonstration rows` : ""),
    ...context,
  });

  return {
    ok: true,
    filename: `selected-files-${rows.length}.csv`,
    body,
    asked: ids.length,
    returned: rows.length,
    demonstration,
  };
}
