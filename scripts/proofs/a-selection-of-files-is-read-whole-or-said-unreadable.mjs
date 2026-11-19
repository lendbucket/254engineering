/**
 * PROOF: A SELECTION OF FILES IS READ WHOLE, OR SAID TO BE UNREADABLE, AND
 * NEVER ANSWERED AS A SELECTION WITH NO FILES IN IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-selection-of-files-is-read-whole-or-said-unreadable.mjs
 *
 * Robert's all-day prompt of 2026-11-19, job two (`docs/master-undone-2026-11-19.md`,
 * the `.in()` survey). `filesByIds` resolves the ids a browser sends for bulk
 * dispatch and the bulk export, through the same scope the Files list uses. It
 * sent one `.in()` over the whole selection, which runs to EXPORT_LIMIT ids,
 * and it discarded both reads' errors, so a refused or failed read answered an
 * empty list: bulk dispatch reviewed the selection as having no files and sent
 * nothing, and nothing said why.
 *
 *   A  a full selection of EXPORT_LIMIT ids is read whole, past the stub's
 *      150-id cliff, demonstration flags included
 *   B  a failure on eng_files answers null, never []
 *   C  the export says it could not read the files, rather than writing a
 *      spreadsheet that returned none of them
 *   D  a role that may see no file still answers an empty list, which is a
 *      true answer and not a failure
 *   E  the Documents screen's "Filed documents" panel says when there are more
 *      than it lists, and a failed read of the documents or of the files they
 *      sit on is an error, never an empty table. It discarded its error and
 *      its cap of 300 with nothing said.
 *
 * The real functions run against a stub PostgREST held here, which refuses an
 * in() list longer than 150 ids and never answers more than 1,000 rows. No
 * request leaves this process.
 */
const tables = {};
const failing = new Set();
let refusedForLength = 0;

const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
function parseIn(value) {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  return inner.length ? inner.split(",").map(unquote) : [];
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const json = { "content-type": "application/json" };
  if (failing.has(table)) {
    return new Response(JSON.stringify({ message: `stub failure on ${table}`, code: "XX000" }), { status: 500, headers: json });
  }
  let rows = [...(tables[table] ?? [])];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    if (raw.startsWith("in.")) {
      const values = parseIn(raw);
      if (values.length > 150) {
        refusedForLength += 1;
        return new Response(JSON.stringify({ message: "TypeError: fetch failed (stub: in() past the cliff)" }), { status: 400, headers: json });
      }
      rows = rows.filter((r) => values.includes(String(r[key])));
    } else if (raw.startsWith("eq.")) {
      rows = rows.filter((r) => String(r[key]) === raw.slice(3));
    }
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const asked = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + Math.min(asked, 1000));
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  if (method !== "GET") return new Response("[]", { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { filesByIds } = await import("../../src/lib/ops-crm.ts");
const { exportFiles, EXPORT_LIMIT } = await import("../../src/lib/ops-bulk-files.ts");
const { ALL_ACTIONS } = await import("../../src/lib/ops-authz.ts");
const { listDocuments, DOCUMENT_LIST_CAP } = await import("../../src/lib/ops-docs.ts");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}
const uuid = (i) => `f${String(i).padStart(7, "0")}-0000-4000-8000-000000000000`;

/* An administrator holding every action, which is what the export needs; the grants are the actions the code declares. */
const everyAction = new Set(ALL_ACTIONS);
const admin = { id: "a0000000-0000-4000-8000-000000000000", role: "admin", status: "active", email: "proof@audit-probe.invalid", grants: everyAction };
const nobody = { id: "b0000000-0000-4000-8000-000000000000", role: "read_only", status: "active", email: "proof2@audit-probe.invalid", grants: new Set() };

console.log("the fixture");
check("the proof holds an administrator with grants to export", everyAction.size > 0 && everyAction.has("files.list"), `${everyAction.size} actions`);
check("a full selection is past the stub's cliff", EXPORT_LIMIT > 150, `EXPORT_LIMIT ${EXPORT_LIMIT}`);

tables.eng_files = [];
for (let i = 0; i < EXPORT_LIMIT; i += 1) {
  tables.eng_files.push({
    id: uuid(i),
    file_number: `254-F-${i}`,
    status: "intake",
    county: "Bexar",
    service_slug: "roof-inspections",
    property_address: `${i} Example St`,
    created_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
    is_demo: i % 10 === 0,
  });
}
const ids = tables.eng_files.map((f) => f.id);

console.log("A  a full selection is read whole");
{
  const before = refusedForLength;
  const rows = await filesByIds(admin, ids);
  check("it answers rather than failing", rows !== null);
  if (rows) {
    check(`all ${EXPORT_LIMIT} selected files come back`, rows.length === EXPORT_LIMIT, `${rows.length}`);
    check("every tenth carries its demonstration flag", rows.filter((r) => r.is_demo).length === EXPORT_LIMIT / 10, `${rows.filter((r) => r.is_demo).length}`);
  }
  check("no request it sent was past the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);
}

console.log("B  a failed read is null, never an empty selection");
{
  failing.add("eng_files");
  const rows = await filesByIds(admin, ids.slice(0, 5));
  failing.delete("eng_files");
  check("a failure on eng_files answers null", rows === null);
}

console.log("C  the export says so");
{
  failing.add("eng_files");
  const result = await exportFiles(admin, ids.slice(0, 5));
  failing.delete("eng_files");
  check("a failed read is no export", result.ok === false, result.ok ? `exported ${result.returned} of ${result.asked}` : "");
  check("and its sentence says the files could not be read", result.ok === false && /could not be read/.test(result.error), result.ok ? "" : result.error);
  const whole = await exportFiles(admin, ids);
  check("a readable full selection exports every file", whole.ok === true && whole.returned === EXPORT_LIMIT, whole.ok ? `${whole.returned} of ${whole.asked}` : whole.error);
}

console.log("D  a role that may see no file");
{
  const rows = await filesByIds(nobody, ids.slice(0, 5));
  check("is answered an empty list, which is true, not null", Array.isArray(rows) && rows.length === 0);
}

console.log("E  the Documents screen's Filed documents panel");
{
  tables.eng_documents = [];
  for (let i = 0; i < DOCUMENT_LIST_CAP + 1; i += 1) {
    tables.eng_documents.push({
      id: `d${String(i).padStart(7, "0")}-0000-4000-8000-000000000000`,
      title: `Document ${i}`,
      kind: "deliverable",
      version: 1,
      visibility: "staff",
      sealed_at: null,
      byte_size: 1000,
      file_id: uuid(i % EXPORT_LIMIT),
      created_at: new Date(Date.UTC(2026, 10, 2, 0, i)).toISOString(),
    });
  }
  tables.eng_assignments = [];
  const before = refusedForLength;
  const read = await listDocuments(admin);
  check("past the cap, the panel is told there are more", read.error === null && read.more === true, `more ${read.more}, error ${read.error}`);
  check(`and it lists ${DOCUMENT_LIST_CAP}, every one an administrator may open`, read.rows.length === DOCUMENT_LIST_CAP, `${read.rows.length}`);
  check("the files they sit on were read without passing the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);
  for (const table of ["eng_documents", "eng_files", "eng_assignments"]) {
    failing.add(table);
    const broken = await listDocuments(admin);
    failing.delete(table);
    check(`a failure on ${table} is an error, never an empty list of documents`, broken.error !== null && broken.rows.length === 0, `error ${broken.error}`);
  }
}

if (failures) {
  console.log(`FAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log("PASS: a selection of files is read whole, or said to be unreadable.");
