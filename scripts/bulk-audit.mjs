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
import { readdirSync, existsSync } from "node:fs";
import { BULK_PATHS, REFUSALS, refusalKeys } from "./lib/bulk-paths.mjs";
import { exportFiles, EXPORT_LIMIT } from "../src/lib/ops-bulk-files.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/* Comments stripped before anything is matched. A check that finds the word in
 * a sentence about the word is a check on wording. */
const codeOnly = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

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


/* ============================================================ bulk dispatch */

/*
 * Operator ruling at gate 1: bulk dispatch reproduces the single file rule
 * EXACTLY and introduces no selection rule. No technician is chosen by a bulk
 * path that the single path would not have chosen for that file.
 *
 * The single path preselects nothing, so these checks are mostly about what is
 * ABSENT: no default, no fan out, and no second implementation of "may this
 * work be offered".
 */
{
  const bulkDispatch = codeOnly(readSource("src/lib/ops-bulk-dispatch.ts"));
  const panel = codeOnly(readSource("src/app/portal/(app)/files/DispatchPanel.tsx"));
  const client = codeOnly(readSource("src/app/portal/(app)/files/dispatch/BulkDispatchClient.tsx"));

  rec(
    "the single file panel still preselects nothing",
    /useState<string\[\]>\(\[\]\)/.test(panel),
    "if this ever gains a default, bulk has to reproduce THAT and this check is where it is noticed",
  );
  rec(
    "and the bulk screen preselects nothing either",
    /useState<Record<string, string\[\]>>\(\{\}\)/.test(client),
    "no technician is chosen by a bulk path that the single path would not have chosen",
  );

  rec(
    "bulk dispatch sends through the single file sendOffers",
    /sendOffers\(/.test(bulkDispatch),
    "a second answer to whether work may be offered would drift from the first",
  );
  rec(
    "and writes no offer of its own",
    !/eng_assignments/.test(bulkDispatch),
    "the refusals sendOffers makes, a file that already has a technician and a service line with no published protocol, are the ones that matter",
  );

  /*
   * THE ABSENCE THAT IS THE WHOLE RULING. A control offering every eligible
   * technician at once would be a selection rule this path invented.
   */
  rec(
    "there is no offer-to-everyone shortcut anywhere in the bulk path",
    !/selectAll|offerAll|everyEligible|all eligible/i.test(bulkDispatch + client),
    "a bulk action that fanned every plan out would route the firm's field spend by a rule nobody ruled on",
  );

  rec(
    "a file that cannot be dispatched is shown with the reason, not dropped",
    /blocked/.test(bulkDispatch) && /plan\.blocked/.test(client),
    "a file missing from a review screen reads as a file that was fine",
  );
  rec(
    "and the ineligible technicians are shown with theirs",
    /ineligible/.test(bulkDispatch) && /plan\.ineligible/.test(client),
    "a shorter list of eligible technicians is not an answer to who could do this",
  );
  rec(
    "partial failure is reported per file rather than as one number",
    /refused/.test(bulkDispatch) && /refused/.test(client),
    "a screen reporting 12 dispatched over three silent refusals describes work that did not happen",
  );
  rec(
    "and the ids are resolved through the scoped read before anything is sent",
    /filesByIds\(/.test(bulkDispatch),
    "a browser carries picks, never a decision about which files it may reach",
  );
}

/* ================================================= the B2B paste, and money */

/*
 * The defect this found is live, it is money, and it was on the customer facing
 * path. /account/order split each pasted line on commas, so an address with a
 * suite number put a CITY in the county column, and splitBatch checked the
 * county was PRESENT and never that it was real.
 *
 * The coastal surcharge is decided by county. The protocol is decided by
 * county. The property was accepted, priced, charged and dispatched.
 */
{
  const { parseLine } = await import("../src/lib/csv.ts");
  const { splitBatch } = await import("../src/lib/bulk-order.ts");

  const naive = "1200 Ocean Drive, Suite 4, Corpus Christi, Nueces, 78404".split(",").map((x) => x.trim());
  rec(
    "the defect is real: splitting on commas puts a city in the county column",
    naive[2] === "Corpus Christi",
    "this is the check that says the fix below is fixing something",
  );

  const quoted = parseLine('"1200 Ocean Drive, Suite 4","Corpus Christi","Nueces","78404"');
  rec(
    "parseLine keeps a quoted comma inside its own field",
    quoted[0] === "1200 Ocean Drive, Suite 4" && quoted[2] === "Nueces",
    JSON.stringify(quoted),
  );
  rec(
    "and a doubled quote is one literal quote",
    parseLine('"He said ""go""","Bexar"')[0] === 'He said "go"',
    "what a spreadsheet writes when a field contains a quotation mark",
  );

  rec(
    "the paste box uses it rather than splitting on commas",
    /parseLine\(/.test(codeOnly(readSource("src/app/account/order/BulkOrderClient.tsx"))) &&
      !/line\.split\(","\)/.test(codeOnly(readSource("src/app/account/order/BulkOrderClient.tsx"))),
    "",
  );

  /*
   * AND THE SERVER REFUSES, which is the half that is a guarantee rather than a
   * convenience. Exercised through splitBatch itself with a real catalog entry.
   */
  const { catalogFor } = await import("../data/catalog.ts");
  const entry = catalogFor("windstorm-wpi-8");
  const twia = new Set(["Nueces", "Aransas"]);
  const answers = (entry?.qualifiers ?? []).map((q) => ({ qualifierId: q.id, optionIndex: 0 }));

  if (entry) {
    const split = splitBatch(
      entry,
      [
        { ref: "REAL", propertyAddress: "1 Somewhere", county: "Nueces", answers },
        { ref: "CITY", propertyAddress: "1200 Ocean Drive", county: "Corpus Christi", answers },
        { ref: "SHIFTED", propertyAddress: "1200 Ocean Drive", county: "78404", answers },
      ],
      twia,
    );

    const rejected = new Map(split.rejected.map((r) => [r.ref, r.reason]));
    rec(
      "a county that is not one of the 254 is refused rather than priced",
      rejected.has("CITY") && rejected.has("SHIFTED"),
      rejected.get("CITY") ?? "it was accepted",
    );
    rec(
      "and the refusal quotes back what was received",
      /Corpus Christi/.test(rejected.get("CITY") ?? ""),
      "the customer has to be able to see what their own line turned into",
    );
    rec(
      "while a real county is still accepted",
      split.accepted.some((a) => a.ref === "REAL"),
      "the dangerous direction is a refusal nobody asked for",
    );
    rec(
      "and the accepted coastal property carries the surcharge",
      split.accepted.find((a) => a.ref === "REAL")?.twiaCounty === true,
      "the surcharge is the thing the wrong county was silently dropping",
    );
  } else {
    rec("the catalog entry the county check is exercised against exists", false, "windstorm-wpi-8");
  }
}


/* ================================================ SECTION 2: WHAT BULK MUST NOT DO */

/*
 * Every bulk path on this platform, and the refusals each declares.
 *
 * A path with no declared refusals fails, for the same reason a registered job
 * kind with no probe does: the list is the mechanism.
 */
{
  const paths = BULK_PATHS;
  const keys = refusalKeys();

  rec(
    "there are bulk paths declared (" + paths.length + ")",
    paths.length >= 4,
    paths.map((x) => x.module.split("/").pop()).join(", "),
  );

  const undeclared = paths.filter((x) => !Array.isArray(x.refuses) || x.refuses.length === 0);
  rec(
    "every declared bulk path names the refusals that apply to it",
    undeclared.length === 0,
    undeclared.map((x) => x.module).join(", "),
  );

  const invented = paths.flatMap((x) => x.refuses.filter((r) => !keys.includes(r)).map((r) => x.module + ":" + r));
  rec(
    "and names only refusals that exist",
    invented.length === 0,
    invented.join(", "),
  );

  const unexplained = paths.filter((x) => !x.note || x.note.length < 60);
  rec(
    "and says why the ones it does NOT name do not apply",
    unexplained.length === 0,
    unexplained.map((x) => x.module).join(", ") ||
      "an exemption with no reason beside it is a gap wearing a reason",
  );

  const missingFiles = paths.filter((x) => !existsSync(x.module));
  rec(
    "every declared path is a real module",
    missingFiles.length === 0,
    missingFiles.map((x) => x.module).join(", "),
  );

  /*
   * AND THE DECLARATION IS NOT THE ONLY LIST.
   *
   * A module that acts on many records and is NOT declared here is the failure
   * this file exists to catch, so the tree is swept for the shape and every hit
   * has to be accounted for. Same idiom as surface-audit: adding one without
   * declaring it is a red board.
   */
  const declaredModules = new Set(paths.map((x) => x.module));
  const suspects = [];
  const sweep = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) sweep(full);
      else if (/\.ts$/.test(entry.name)) {
        const text = codeOnly(readSource(full));
        /* .in("id", ids) or .in("<col>", <something plural>) on a write. */
        if (/\.(update|delete)\([^)]*\)[\s\S]{0,200}?\.in\(/.test(text) && !declaredModules.has(full)) {
          suspects.push(full);
        }
      }
    }
  };
  sweep("src/lib");
  rec(
    "no module writes to many rows at once without being declared a bulk path (" + suspects.length + ")",
    suspects.length === 0,
    suspects.join(", ") || "swept src/lib for an update or delete followed by an .in()",
  );
}

/* ---------------------------------------- the refusals, exercised where they bite */

{
  const dispatchSrc = codeOnly(readSource("src/lib/ops-bulk-dispatch.ts"));
  const fieldSrc = codeOnly(readSource("src/lib/ops-field.ts"));
  const exportSrc = codeOnly(readSource("src/lib/ops-bulk-files.ts"));
  const retentionSrc = codeOnly(readSource("src/lib/ops-retention.ts"));

  /*
   * THE SEALED REFUSAL, WHICH IS THE ONE SECTION 2 FOUND.
   *
   * sendOffers selected the status column and never read it. The Files page rendered the
   * dispatch panel only for a file in needs_dispatch, and that was the entire
   * rule: a UI condition guarding a function anybody could call. Bulk dispatch
   * calls it directly, as it must, and a sealed file became dispatchable.
   */
  rec(
    "sendOffers refuses a file that is not waiting for dispatch",
    /file\.status !== "needs_dispatch"/.test(fieldSrc),
    "the rule used to live in the Files page, which is not the platform",
  );
  rec(
    "and the bulk review says so before anything is ticked",
    /file\.status !== "needs_dispatch"/.test(dispatchSrc),
    "twelve refusals after the press is a worse way to learn it",
  );

  /* No bulk path writes an assignment or deletes. */
  for (const [name, src] of [
    ["the export", exportSrc],
    ["bulk dispatch", dispatchSrc],
  ]) {
    /*
     * THE WRITE, NOT THE MENTION, FOR THE SECOND TIME IN THIS FILE.
     *
     * The first version matched the column name anywhere and failed on bulk
     * dispatch, which READS file.assigned_tech_id to tell a dispatcher that a
     * file already has a technician. Refusing to let a bulk path even mention
     * the column would mean refusing to let it explain itself.
     *
     * An update or an insert with the column inside its own braces, which is
     * the same matcher the reconciliation check above already uses. Two checks
     * in one file learning the same lesson separately is how a third one
     * eventually gets it wrong.
     */
    rec(
      name + " writes no assignment",
      !/\.(update|insert)\(\{[^}]*assigned_(engineer|tech)_id/.test(src),
      "nothing gives a file to a person; an engineer accepts one",
    );
    rec(
      name + " deletes nothing",
      !/\.delete\(/.test(src),
      "retention is the only path that removes rows, and it plans first",
    );
  }

  /*
   * AND RETENTION IS STILL THE ONLY ONE THAT DELETES, which is what makes the
   * refusal above meaningful rather than a rule about two files nobody was
   * going to break.
   */
  rec(
    "retention is still the one path that deletes, and still plans before it does",
    /\.delete\(/.test(retentionSrc) && /manifest/i.test(retentionSrc),
    "a bulk screen offering deletion would be a second answer to what may be removed",
  );

  /* Every bulk path that reaches outside decides the mode. */
  rec(
    "no bulk path sends without the mode being decided",
    !/queueEmail\(|notify\(/.test(exportSrc + dispatchSrc),
    "neither of these sends at all; dispatch notifies through sendOffers, which is where the decision is made",
  );
}

/* ================== N PLANS, AND EACH ONE IS THE SINGLE FILE'S PLAN EXACTLY */

/*
 * ===========================================================================
 * NO TECHNICIAN IS CHOSEN BY A BULK PATH THAT THE SINGLE PATH WOULD NOT HAVE
 * CHOSEN FOR THAT FILE.
 * Operator ruling, gate 1, and this is the block that proves it rather than
 * describing it.
 * ===========================================================================
 *
 * Every other dispatch check in this file reads SOURCE: that the panel
 * preselects nothing, that bulk calls sendOffers, that no shortcut exists.
 * Those are worth having and none of them can see the thing the ruling
 * actually says, which is a statement about two computed answers being the
 * same answer.
 *
 * So this computes both and compares them, field by field, in order.
 *
 *   the SINGLE path  dispatchContext(actor, file).plan.offers
 *   the BULK path    dispatchPlans(actor, [id]).plans[0].offers
 *
 * And then the part that makes it N PLANS rather than one plan applied N
 * times: every file is planned again as part of a BATCH, and each file's plan
 * in the batch must equal its plan alone. A batch that re-ranked, deduplicated
 * across files, or spread work between them would pass the two checks above
 * and fail here.
 *
 * THE SUBJECT IS BUILT, BECAUSE FILTERING FOR IT FINDS NOTHING.
 *
 * Development holds one file in needs_dispatch and it is in Aransas, where no
 * certified technician covers the service line, so its plan is empty. Two
 * empty lists are equal and prove nothing at all: that is the vacuous check
 * CLAUDE.md rules against, so three files are created in a county two
 * certified technicians DO cover, planned, compared, and removed.
 */
{
  const { dispatchPlans } = await import("../src/lib/ops-bulk-dispatch.ts");
  const { dispatchContext } = await import("../src/lib/ops-field.ts");
  const { createFile, transitionFile } = await import("../src/lib/ops-crm.ts");
  const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");

  /*
   * A real profile, and a DEMONSTRATION one, so every file this block opens is
   * a demonstration file. That is the ruling of 2026-09-10 working for us: the
   * fixture cannot mint a real file by accident, and the DEMO number is what
   * the teardown finds.
   */
  const { data: demoAdmins } = await db
    .from("eng_profiles")
    .select("id, email")
    .eq("role", "admin")
    .eq("status", "active")
    .eq("is_demo", true)
    .limit(1);

  const { data: anyClient } = await db.from("eng_clients").select("id").eq("is_demo", true).limit(1);

  const planner = demoAdmins?.[0]
    ? {
        id: demoAdmins[0].id,
        email: demoAdmins[0].email,
        role: "admin",
        status: "active",
        grants: new Set(DEFAULT_ROLES.find((r) => r.key === "admin").grants),
        license_number: null,
        coverage_counties: [],
        is_demo: true,
      }
    : null;

  const made = [];
  let built = 0;

  if (!planner || !anyClient?.[0]) {
    rec(
      "a demonstration administrator and client exist to build the dispatch subject with",
      false,
      "seed-field-demo has not run on this database, so the N plans proof has no subject",
    );
  } else {
    /*
     * THE COUNTY AND THE SERVICE LINE ARE CHOSEN SO THE PLAN IS NOT EMPTY.
     *
     * windstorm-wpi-8 is the one service line with a published protocol, and
     * Nueces is covered by both certified technicians. A file here plans two
     * offers; a file in Aransas plans none, which is why the one file already
     * on the database could not be the subject.
     */
    for (let i = 0; i < 3; i += 1) {
      const opened = await createFile(planner, {
        clientId: anyClient[0].id,
        serviceSlug: "windstorm-wpi-8",
        propertyAddress: `${10 + i} N Plans Proof Row`,
        county: "Nueces",
        urgency: "standard",
        notes: "Opened by bulk-audit to compare the single and bulk dispatch plans. Removed at the end of the run.",
      });
      if (!opened.ok) continue;
      made.push(opened.id);
      const moved = await transitionFile(planner, opened.id, "needs_dispatch", "Ready to dispatch, for the plan comparison.");
      if (moved.ok) built += 1;
    }

    rec(
      `three dispatchable files were built for the comparison (${built})`,
      built === 3,
      built === 3 ? "in Nueces, windstorm-wpi-8, which two certified technicians cover" : "the subject could not be built",
    );

    /* The shape a comparison can be made on: ids in order, and every number. */
    const shapeOf = (offers) =>
      offers.map((o) => [o.techId, o.rank, o.miles ?? o.distanceMiles ?? null, o.openJobs, o.amountCents].join("|"));

    /* ---- 1. one file at a time: bulk equals single ---- */
    const singles = new Map();
    const alone = new Map();
    let planned = 0;

    for (const id of made) {
      const { data: row } = await db
        .from("eng_files")
        .select("id, county, service_slug, latitude, longitude")
        .eq("id", id)
        .single();

      const context = await dispatchContext(planner, row);
      singles.set(id, shapeOf(context?.plan.offers ?? []));

      const bulk = await dispatchPlans(planner, [id]);
      alone.set(id, bulk.ok ? shapeOf(bulk.plans[0].offers) : ["BULK REFUSED: " + bulk.error]);
      if ((context?.plan.offers ?? []).length > 0) planned += 1;
    }

    rec(
      `the built files actually plan somebody (${planned} of ${made.length})`,
      planned === made.length && made.length > 0,
      planned
        ? `${[...singles.values()][0].length} offer(s) on the first file, so the comparison below has something to compare`
        : "every plan is empty, so comparing them proves nothing",
    );

    const mismatchAlone = made.filter((id) => singles.get(id).join(" ") !== alone.get(id).join(" "));
    rec(
      "a bulk plan for one file is the single path's plan, in the same order, with the same numbers",
      mismatchAlone.length === 0,
      mismatchAlone.length
        ? mismatchAlone
            .map((id) => `${id}: single [${singles.get(id).join(", ")}] vs bulk [${alone.get(id).join(", ")}]`)
            .join(" | ")
        : `${made.length} file(s) compared on techId, rank, miles, open jobs and amount`,
    );

    /* ---- 2. and the batch does not change any of them ---- */
    const batch = await dispatchPlans(planner, made);
    const inBatch = new Map(
      batch.ok ? batch.plans.map((p) => [p.fileId, shapeOf(p.offers)]) : [],
    );

    rec(
      "planning all of them at once returns a plan for every one",
      batch.ok && batch.plans.length === made.length,
      batch.ok ? `${batch.plans.length} of ${made.length}` : batch.error,
    );

    const mismatchBatch = made.filter(
      (id) => (inBatch.get(id) ?? ["MISSING"]).join(" ") !== singles.get(id).join(" "),
    );
    rec(
      "and each file's plan in the batch is identical to its plan alone",
      mismatchBatch.length === 0,
      mismatchBatch.length
        ? mismatchBatch
            .map((id) => `${id}: alone [${singles.get(id).join(", ")}] vs in batch [${(inBatch.get(id) ?? []).join(", ")}]`)
            .join(" | ")
        : "N plans, not one plan applied N times: no re-ranking, no spreading, no deduplication across files",
    );

    /*
     * ---- 3. and the batch chooses nobody ----
     *
     * The single path preselects nothing, so the bulk path must preselect
     * nothing, and "nothing" here means the plan carries no selection field at
     * all rather than an empty one somebody could default.
     */
    const firstPlan = batch.ok ? batch.plans[0] : null;
    rec(
      "a plan carries no selection of its own",
      Boolean(firstPlan) && !("selected" in firstPlan) && !("chosen" in firstPlan) && !("techIds" in firstPlan),
      firstPlan
        ? `the plan's fields are: ${Object.keys(firstPlan).join(", ")}`
        : "no plan was returned",
    );
  }

  /* ---- teardown: the files this block created, on development ---- */
  if (made.length) {
    for (const id of made) await db.from("eng_file_events").delete().eq("file_id", id);
    await db.from("eng_files").delete().in("id", made);
    const { data: left } = await db.from("eng_files").select("id").in("id", made);
    rec(
      "the files this comparison built were removed",
      (left ?? []).length === 0,
      (left ?? []).length ? `${left.length} left behind` : `${made.length} removed`,
    );
  }
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
