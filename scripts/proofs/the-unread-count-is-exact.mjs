/**
 * THE UNREAD COUNT ON /messages IS EXACT, AND EVERY CONVERSATION HAS ITS PREVIEW.
 *
 * Office-ready Batch B (issue #1, 6871302517): readThreads drew both from one
 * read of at most 400 messages across the page's threads, so a busy thread's
 * unread figure was the length of a sample shown as a count, and a quiet
 * thread whose messages fell outside the 400 had no preview and no unread.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-unread-count-is-exact.mjs
 *
 * The real readThreads, against a PostgREST stand-in (the shape the search and
 * mentions proof uses, with gt, order and exact counts added), over a subject
 * built to be bigger than the old read:
 *   A, a busy direct thread: 450 messages, the reader has read the first 100;
 *   B, a quiet direct thread: one message, older than all of A's, never read.
 * The old read took A's newest 400, so B had no preview and 0 unread, and A's
 * figure was counted inside the sample. The exact read gives A 350, B 1 and
 * B's preview. B is the subject that separates the two answers.
 */
import { readFileSync } from "node:fs";

const tables = {};
const unquote = (s) => s.replace(/^"|"$/g, "");
const match = (row, key, raw) => {
  const v = row[key];
  if (raw.startsWith("in.(")) return raw.slice(4, -1).split(",").map(unquote).includes(String(v));
  if (raw.startsWith("eq.")) return String(v) === raw.slice(3);
  if (raw.startsWith("gt.")) return String(v) > raw.slice(3);
  return true;
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const json = { "content-type": "application/json" };
  let rows = [...(tables[table] ?? [])];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    rows = rows.filter((r) => match(r, key, raw));
  }
  const order = url.searchParams.get("order");
  if (order) {
    const keys = order.split(",").map((o) => o.split("."));
    rows.sort((x, y) => {
      for (const [k, dir] of keys) {
        if (x[k] === y[k]) continue;
        const c = String(x[k]) < String(y[k]) ? -1 : 1;
        return dir === "desc" ? -c : c;
      }
      return 0;
    });
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + limit);
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  if (method !== "GET") return new Response("[]", { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { readThreads } = await import("../../src/lib/ops-threads.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const iso = (n) => new Date(Date.UTC(2026, 9, 1) + n * 60_000).toISOString();
const reader = { id: uuid(9001), role: "field_tech", status: "active", email: "reader@proof.invalid", grants: new Set(["messages.use"]) };
const other = uuid(9002);
const A = uuid(1);
const B = uuid(2);

tables.eng_threads = [
  { id: A, kind: "direct", file_id: null, name: null, channel_roles: null, last_message_at: iso(1449), created_at: iso(0) },
  { id: B, kind: "direct", file_id: null, name: null, channel_roles: null, last_message_at: iso(10), created_at: iso(0) },
];
tables.eng_thread_participants = [
  { thread_id: A, profile_id: reader.id, last_read_at: iso(1099), eng_profiles: { display_name: "Reader", role: "field_tech" } },
  { thread_id: A, profile_id: other, last_read_at: null, eng_profiles: { display_name: "Office", role: "admin" } },
  { thread_id: B, profile_id: reader.id, last_read_at: null, eng_profiles: { display_name: "Reader", role: "field_tech" } },
  { thread_id: B, profile_id: other, last_read_at: null, eng_profiles: { display_name: "Office", role: "admin" } },
];
tables.eng_messages = [
  ...Array.from({ length: 450 }, (_, n) => ({ id: 1000 + n, thread_id: A, created_at: iso(1000 + n), body: `busy message ${n}` })),
  { id: 1, thread_id: B, created_at: iso(10), body: "The quiet one: the gate code is 4417." },
];

const newest400 = [...tables.eng_messages].sort((x, y) => (x.created_at < y.created_at ? 1 : -1)).slice(0, 400);
check("the premise: the old read of the newest 400 holds nothing from the quiet thread", !newest400.some((m) => m.thread_id === B));

const read = await readThreads(reader);
check("the list reads", read.ok, read.ok ? "" : read.error);
const a = read.ok ? read.threads.find((x) => x.id === A) : null;
const b = read.ok ? read.threads.find((x) => x.id === B) : null;
check("the busy thread's unread is the exact count after the read mark", a?.unread === 350, `got ${a?.unread}`);
check("the quiet thread, outside the old 400, has its preview", b?.preview === "The quiet one: the gate code is 4417.", `got ${JSON.stringify(b?.preview)}`);
check("and its one unread message", b?.unread === 1, `got ${b?.unread}`);
check("the busy thread's preview is its newest message", a?.preview === "busy message 449", `got ${JSON.stringify(a?.preview)}`);

/* By source: no capped read of messages remains in the list, and the CSV carries the exact figure. */
const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const threads = code("src/lib/ops-threads.ts");
const list = threads.slice(threads.indexOf("export async function readThreads("), threads.indexOf("export async function listEveryThread("));
check("readThreads holds no capped read of messages", list.length > 100 && !/\.limit\(400\)/.test(list) && /count: "exact", head: true/.test(list));
const exports = code("src/lib/list-exports.ts");
check("the conversations CSV carries the exact unread", /"Unread by you"\]/.test(exports) && /t\.created_at, t\.unread\]/.test(exports));

console.log(wrong === 0 ? "\nThe unread count is exact, and every conversation has its preview." : `\n${wrong} check(s) wrong.`);
process.exitCode = wrong === 0 ? 0 : 1;
