// @runtime react-server
//
// Declared because it imports src/lib/letter-facts.ts, which carries server-only.

/**
 * THE TRIAGE LIST READS EVERY OPEN PERMIT JOB, AND EACH ROW SHOWS ITS OWN ITEMS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-triage-list-reads-every-job-and-its-own-items.mjs
 *
 * Robert's audit of 2026-10-24, finding F13 and the triage starvation claim.
 *
 * filesAwaitingTriage read the OLDEST 200 open permit letter files and dropped
 * the triaged ones afterwards. Once 200 open files were triaged, every new one
 * fell outside the window and never reached the engineer's queue, and his
 * answer is due within a business day of the order. And the review screen
 * handed every row of that list an empty capture list, so an item he added
 * from the row read back as "None added. The protocol's items are the list."
 *
 * Here: 250 open files already triaged and one new one with two items of his,
 * through a fake PostgREST that honours offset and limit, plus a failed read of
 * each of the three tables. Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://triage-list-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "triage-list-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const pad = (n) => String(n).padStart(4, "0");
const FILES = [];
for (let i = 0; i < 250; i += 1) {
  FILES.push({ id: `file-${pad(i)}`, file_number: `PL-${pad(i)}`, property_address: `${i} Proof Way`, created_at: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00Z` });
}
FILES.sort((a, b) => (a.created_at + a.id < b.created_at + b.id ? -1 : 1));
FILES.push({ id: "file-new", file_number: "PL-NEW", property_address: "9 New Street", created_at: "2026-10-24T15:00:00Z" });
const TRIAGED = new Set(FILES.filter((f) => f.id !== "file-new").map((f) => f.id));
const ADDITIONS = [
  { id: "add-1", file_id: "file-new", label: "Photograph the beam pocket at the north wall" },
  { id: "add-2", file_id: "file-new", label: "Measure the header span over the garage door" },
  { id: "add-x", file_id: "file-0003", label: "An item on a job already triaged" },
];

const state = { fail: null };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const inList = (url, key) => {
  const v = url.searchParams.get(key);
  return v && v.startsWith("in.(") ? v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")) : null;
};
const page = (url, rows) => {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  return rows.slice(offset, offset + limit);
};
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (state.fail === table) return json({ message: `proof: the ${table} read failed`, code: "XX000" }, 500);
  if (table === "eng_files") return json(page(url, FILES));
  if (table === "eng_job_triage") {
    const ids = new Set(inList(url, "file_id") ?? []);
    return json(page(url, [...TRIAGED].filter((id) => ids.has(id)).sort().map((file_id) => ({ file_id }))));
  }
  if (table === "eng_job_capture_additions") {
    const ids = new Set(inList(url, "file_id") ?? []);
    return json(page(url, ADDITIONS.filter((a) => ids.has(a.file_id))));
  }
  return json([]);
};

const { filesAwaitingTriage } = await import("../../src/lib/letter-facts.ts");

const all = await filesAwaitingTriage();
check(
  "with 250 open permit jobs triaged, the one ordered today is waiting for his triage",
  all.ok === true && all.files.length === 1 && all.files[0].id === "file-new",
  all.ok ? all.files.map((f) => f.id).join(", ") || "none" : all.error,
);
check(
  "and its row carries the two items he added, in his words",
  all.ok === true && JSON.stringify(all.files[0]?.additions.map((a) => a.label)) === JSON.stringify([ADDITIONS[0].label, ADDITIONS[1].label]),
  all.ok ? JSON.stringify(all.files[0]?.additions) : "",
);

for (const [table, sentence] of [
  ["eng_files", /permit letter files could not be read/],
  ["eng_job_triage", /triage could not be read/],
  ["eng_job_capture_additions", /capture items could not be read/],
]) {
  state.fail = table;
  const failed = await filesAwaitingTriage();
  check(`a failed read of ${table} says so, never a list`, failed.ok === false && sentence.test(failed.error), JSON.stringify(failed).slice(0, 160));
}
state.fail = null;

const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
const triageSection = review.slice(review.indexOf("Permit letter jobs waiting for your triage"), review.indexOf("Letters waiting for your seal"));
check(
  "the review screen hands each row its own items, never an empty list",
  /<TriagePanel fileId=\{f\.id\} basis=\{null\} additions=\{f\.additions\} \/>/.test(triageSection) && !/additions=\{\[\]\}/.test(triageSection),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the triage list reads every open permit job, says when it cannot, and each row shows its own items.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
