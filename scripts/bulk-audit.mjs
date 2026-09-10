// @runtime react-server
/**
 * BULK OPERATIONS, EXERCISED AND READ.
 *
 *   npx tsx --conditions=react-server scripts/bulk-audit.mjs
 *
 * Phase 12 Section 4, Section 1. The approved prototype draws three bulk
 * buttons on the Files screen. Only Export describes something this platform
 * can honestly do, and docs/bulk-actions-reconciliation.md carries the verdict
 * for each of the three, which is the order CLAUDE.md section 2c fixes: read
 * the drawing against the code, get a ruling on what it claims the firm does
 * not do, and only then build.
 *
 * WHAT THIS FILE ACTUALLY DOES
 * -----------------------------
 * It runs the export against real rows on development and READS THE CSV. Phase
 * 12 Section 2 found four defects in exports, all four by opening a file rather
 * than by any check, and every one of them was invisible to a green board:
 *
 *   a manifest saying "Real records only" above eighteen demonstration rows
 *   amounts written in cents, so $675.00 would have reached an accountant as 67500
 *   figures counting a seeded client
 *   a coverage claim the data did not support
 *
 * So the assertions below are about the TEXT OF THE FILE. A check that asked
 * whether exportFiles returned ok would have passed on all four.
 */

import { auditClient } from "./lib/db-target.mjs";
import { readSource } from "./lib/read-source.mjs";
import { readdirSync } from "node:fs";
import { exportFiles, EXPORT_LIMIT } from "../src/lib/ops-bulk-files.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ BULK OPERATIONS ================");
console.log("");

const db = auditClient("bulk-audit", { neverProduction: true });
if (!db) {
  console.log("No database is configured, so nothing was exercised.");
  process.exit(0);
}

/* ------------------------------------------------------- the reconciliation */

{
  /*
   * The document is not decoration. CLAUDE.md section 2c makes the
   * reconciliation a step rather than a courtesy, and an audit that checked the
   * built thing while the two unbuilt ones had no recorded verdict would be
   * measuring the easy third of the section.
   */
  const doc = readSource("docs/bulk-actions-reconciliation.md");
  rec(
    "the reconciliation exists and gives a verdict per drawn action",
    /## 1\. Export/.test(doc) && /## 2\. Assign/.test(doc) && /## 3\. Dispatch/.test(doc),
    "section 2c: every drawn artifact gets a verdict against the code before anything is styled",
  );
  rec(
    "and it names the two that need a ruling rather than quietly building them",
    /Refused unless the operator rules otherwise/i.test(doc) && /not without a ruling/i.test(doc),
    "assign, and the selection rule under dispatch",
  );

  /*
   * THE CLAIM THE RECONCILIATION RESTS ON, CHECKED AGAINST THE CODE.
   *
   * It says nothing in this platform gives a file to a person: both assignment
   * columns are written only when somebody ACCEPTS work. If that ever stops
   * being true the document becomes a confident description of a platform that
   * has changed underneath it, which is the failure mode of every record here.
   */
  const writers = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const text = readSource(full);
        /*
         * THE WRITE, NOT THE MENTION.
         *
         * The first version matched the column name on any line and counted
         * twelve, because a type declaration reading `assigned_tech_id: string
         * | null` looks exactly like an assignment to a regex. It reported that
         * this platform assigns files in twelve places, which is the reverse of
         * what the reconciliation says and would have been an alarming thing to
         * read in the document that is meant to be the careful one.
         *
         * An update or an insert with the column inside its OWN braces.
         * Adjacent rather than a window, for the reason CLAUDE.md gives about
         * windows reaching into their neighbours.
         */
        for (const line of text.split("\n")) {
          if (/\.(update|insert)\(\{[^}]*assigned_(engineer|tech)_id/.test(line)) {
            writers.push(`${full}: ${line.trim().slice(0, 70)}`);
          }
        }
      }
    }
  };
  walk("src");
  /*
   * THREE, AND THE THIRD IS NOT AN ASSIGNMENT.
   *
   * Two of them SET an assignment, both when somebody accepts work: an engineer
   * taking a file into review, and a technician accepting an offer. The third
   * CLEARS one, when a review is withdrawn.
   *
   * The number is stated rather than a ceiling, because "at most three" would
   * pass just as happily on a fourth that gave a file to somebody, and this
   * check exists to notice exactly that.
   */
  const setters = writers.filter((w) => !/:\s*null/.test(w));
  rec(
    `only accepting work writes an assignment (${writers.length} writer(s), ${setters.length} of which set one)`,
    writers.length === 3 && setters.length === 2,
    writers.join(" | ") ||
      "if this changes, docs/bulk-actions-reconciliation.md is describing a platform that has moved",
  );
}

/* ------------------------------------------------------------- the fixtures */

const ACTOR = {
  id: null,
  email: "bulk-audit@demo-audit.invalid",
  role: "admin",
  status: "active",
  /*
   * pricing.read as well as files.list, and the pair is the point.
   *
   * redactFile strips every money column from a file for an actor without
   * pricing.read, and the export inherits that because it reads through the
   * same scoped query the screen does. The first version of this audit held
   * only files.list, so every price came back empty and the "no amount is
   * written as cents" check reported zero priced rows on a database with
   * three. It was looking at a correctly redacted export and calling it a
   * sample with no prices in it.
   */
  grants: new Set(["files.list", "pricing.read"]),
};

/** The same person without the money capability, for the other direction. */
const ACTOR_NO_MONEY = { ...ACTOR, grants: new Set(["files.list"]) };

/*
 * Real rows, chosen from what is already there rather than inserted.
 *
 * eng_files carries foreign keys into clients and orders and a demonstration
 * flag that several dashboards read, so a fixture file made here would be a
 * fixture in every figure on the platform until it was removed. The export is a
 * READ, so it can be exercised against rows that already exist without changing
 * one of them.
 */
const { data: someFiles } = await db
  .from("eng_files")
  .select("id, is_demo")
  .order("created_at", { ascending: false })
  .limit(8);

const ids = (someFiles ?? []).map((f) => f.id);

rec(
  `there are files to export (${ids.length})`,
  ids.length > 0,
  ids.length === 0 ? "nothing below measured anything" : "read rather than inserted, because an export changes nothing",
);

/* ------------------------------------------------------------- the refusals */

{
  const nothing = await exportFiles(ACTOR, []);
  rec(
    "an empty selection is refused rather than producing an empty file",
    nothing.ok === false,
    nothing.ok ? "" : nothing.error,
  );

  const tooMany = await exportFiles(ACTOR, Array.from({ length: EXPORT_LIMIT + 1 }, (_, i) => `id-${i}`));
  rec(
    `more than ${EXPORT_LIMIT} is refused and says the number`,
    tooMany.ok === false && /\d+/.test(tooMany.ok ? "" : tooMany.error),
    tooMany.ok ? "" : tooMany.error,
  );

  const cannotRead = await exportFiles(
    { ...ACTOR, grants: new Set() },
    ids.length ? [ids[0]] : ["anything"],
  );
  rec(
    "a role that cannot list files cannot export them",
    cannotRead.ok === false,
    "an export must not be a wider read than the screen it is launched from",
  );
}

/* --------------------------------------------------- the file itself, read */

if (ids.length > 0) {
  const result = await exportFiles(ACTOR, ids);
  rec("the export runs", result.ok === true, result.ok ? "" : result.error);

  if (result.ok) {
    const body = result.body;
    const lines = body.split("\r\n");

    rec(
      "it is CRLF, so Excel does not read it as one long row",
      body.includes("\r\n"),
      "csv.ts carries the reasoning",
    );

    rec(
      "it says what it is, and says it is not a report",
      /Selected files/.test(body) && /not a report/i.test(body),
      "a manifest naming a period this export does not have would be inventing one",
    );

    rec(
      "it prints how many were asked for and how many came back",
      new RegExp(`"Files asked for","?${ids.length}`).test(body) &&
        new RegExp(`"Files returned","?${result.returned}`).test(body),
      `asked ${result.asked}, returned ${result.returned}`,
    );

    /*
     * THE DEMONSTRATION ROWS ARE NAMED, WHICH IS THE SECTION 2 DEFECT EXACTLY.
     *
     * Not filtered. An export of eighteen fixtures with them removed is
     * indistinguishable from an export of nothing, and the reader cannot ask
     * which they are holding.
     */
    const headerLine = lines.find((l) => l.startsWith('"File number"')) ?? "";
    rec(
      "every row says whether it is a demonstration record",
      headerLine.includes('"Demonstration"'),
      "named rather than removed: a silent filter makes eighteen fixtures look like nothing",
    );
    rec(
      "and the preamble counts them",
      /"Demonstration rows"/.test(body) &&
        (result.demonstration === 0 ? /"none"/.test(body) : new RegExp(`${result.demonstration} of`).test(body)),
      `${result.demonstration} of ${result.returned} rows`,
    );

    /*
     * MONEY IN DOLLARS. The Section 2 defect was a $675.00 refund reaching an
     * accountant as 67500, and this is the check that would have caught it.
     */
    rec(
      "amounts are dollars, and the file says so",
      /US dollars/.test(body),
      "",
    );
    /*
     * A REAL PARSE, BECAUSE split(",") READS THE WRONG COLUMN.
     *
     * The first version of the two checks below split each line on commas. A
     * property address contains one ("1 Standing Demo Way, Corpus Christi"),
     * every field after it shifts by one, and the price check was reading the
     * county. It reported zero priced rows on a database with three, and said
     * so honestly in its own note while looking at the wrong cell entirely.
     *
     * That is this repository's recurring defect wearing a CSV parser, inside
     * an audit written to catch a defect that was found by reading a CSV.
     */
    const parse = (line) => {
      const cells = [];
      let cell = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
          else if (ch === '"') inQuotes = false;
          else cell += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === ",") { cells.push(cell); cell = ""; }
        else cell += ch;
      }
      cells.push(cell);
      return cells;
    };

    const headers = parse(headerLine);
    const bodyLines = lines.slice(lines.indexOf(headerLine) + 1).filter(Boolean);
    const rowsParsed = bodyLines.map(parse);
    const priceIndex = headers.indexOf("Client price");
    const techIndex = headers.indexOf("Technician cost");

    rec(
      "the export's own columns can be found by name",
      priceIndex !== -1 && techIndex !== -1 && headers.includes("Demonstration"),
      headers.join(" | "),
    );

    const prices = rowsParsed.map((r) => r[priceIndex]).filter((v) => v !== "" && v !== undefined);
    rec(
      `no amount is written as cents (${prices.length} priced row(s) of ${rowsParsed.length})`,
      prices.length > 0 && prices.every((v) => /^\d+\.\d{2}$/.test(v)),
      prices.length === 0
        ? "THIS CHECK LOOKED AT NOTHING. Every file in the sample is unpriced, so it proves nothing today."
        : prices.slice(0, 3).join(", "),
    );

    /*
     * AND THE OTHER DIRECTION, WHICH IS THE ONE THAT COST MONEY IN SECTION 2.
     *
     * An absent figure must be EMPTY and not 0.00. A margin computed from a
     * missing cost is not a smaller margin, it is a wrong one, and a
     * spreadsheet cannot tell a zero somebody entered from a zero this export
     * invented.
     */
    const blanks = rowsParsed.filter((r) => r[techIndex] === "" || r[priceIndex] === "");
    rec(
      `an absent figure is empty rather than zero (${blanks.length} row(s) with a gap)`,
      blanks.length > 0 && !prices.includes("0.00"),
      blanks.length === 0
        ? "THIS CHECK LOOKED AT NOTHING. Every file in the sample carries every figure."
        : "a gap is a gap; 0.00 would be a number the firm did not state",
    );

    /*
     * DATES A SPREADSHEET UNDERSTANDS, WHICH IS WHERE THIS FILE IS GOING.
     *
     * Found by reading the export over HTTP: every date came out as
     * 2026-09-09T14:15:33.61822+00:00. Excel lands that as text, so it cannot
     * be sorted or compared, and it reads as a machine leaking into a document
     * somebody is about to send a client.
     */
    const createdIndex = headers.indexOf("Created");
    const dates = rowsParsed.map((r) => r[createdIndex]).filter(Boolean);
    rec(
      `dates are dates and not timestamps (${dates.length} row(s))`,
      dates.length > 0 && dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) || d === "no date recorded"),
      dates.slice(0, 3).join(", ") || "THIS CHECK LOOKED AT NOTHING",
    );

    rec("it names who exported it", body.includes(ACTOR.email), "");

    /*
     * AND AN EXPORT IS NOT A WAY ROUND THE REDACTION.
     *
     * The same selection, exported by the same person without pricing.read,
     * must come back with the money columns EMPTY. An export that widened
     * what a role can see would be a permission bypass wearing a download
     * button, and it is the shape a bulk action makes easiest: one request,
     * three hundred rows, no screen in between.
     */
    const redacted = await exportFiles(ACTOR_NO_MONEY, ids);
    if (redacted.ok) {
      const rLines = redacted.body.split("\r\n");
      const rHeader = rLines.find((l) => l.startsWith('"File number"')) ?? "";
      const rHeaders = parse(rHeader);
      const rPriceIndex = rHeaders.indexOf("Client price");
      const rRows = rLines.slice(rLines.indexOf(rHeader) + 1).filter(Boolean).map(parse);
      const leaked = rRows.map((r) => r[rPriceIndex]).filter((v) => v !== "" && v !== undefined);
      rec(
        `a role without pricing.read exports no money (${leaked.length} leaked of ${rRows.length})`,
        leaked.length === 0,
        leaked.length ? leaked.slice(0, 3).join(", ") : "the same rows, the same request, and every money cell empty",
      );
    } else {
      rec("a role without pricing.read exports no money", false, redacted.error);
    }
  }
}

/* --------------------------------------------------- it is written down */

{
  const { data: rows } = await db
    .from("eng_audit_events")
    .select("action, summary, actor_email")
    .eq("action", "export.files.selected")
    .order("created_at", { ascending: false })
    .limit(1);

  const row = (rows ?? [])[0] ?? null;
  rec(
    "an export leaves an audit row saying how many rows went out",
    Boolean(row) && /Exported \d+ of \d+ selected file/.test(row.summary ?? ""),
    row?.summary ?? "nothing was written",
  );
  /*
   * eng_audit_events refuses DELETE by design, so this audit cannot tidy up
   * after itself and does not pretend to. The rows it leaves are marked with a
   * fixture address, which is the same arrangement roles-audit has and the same
   * reason: the trail is the record and a record a test can erase is not one.
   */
  rec(
    "and that row cannot be removed, which is why the actor is a fixture address",
    row?.actor_email === ACTOR.email,
    "eng_audit_events is append only; see CLAUDE.md 6b",
  );
}

/* ----------------------------------------------------------------- verdict */

console.log("");
const failed = out.filter((r) => !r.ok);
for (const r of failed) console.log(`  FAIL: ${r.name} (${r.note})`);
if (failed.length === 0) {
  for (const r of out) console.log(`  PASS: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("Every defect Phase 12 Section 2 found in an export was found by reading one.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. The export says what it is and what is in it.`);
