// @runtime react-server
//
// Declared because it imports src/lib/ops-threads.ts, which carries server-only.

/**
 * SEARCH AND MENTIONS REACH EVERY READABLE CONVERSATION. Robert, 2026-11-02
 * (answer to issue #1 6587319903): "Extend message search and mentions to every
 * readable conversation, as a follow-up."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/search-and-mentions-reach-every-readable-conversation.mjs
 *
 * Q13 made the conversation list find a thread older than the newest hundred,
 * but search and mentions still took their thread ids from that hundred, so an
 * old conversation opened while its messages could not be found. The real
 * functions run here against a stub PostgREST that honours the filters these
 * reads use (in, cs, ilike, eq), offset and limit, and fails any one table on
 * demand. A technician can read 250 conversations, more than one page and more
 * than one chunk of ids, and the message and the mention live in the OLDEST.
 * No request leaves this process.
 */
import { readFileSync } from "node:fs";

const tables = {};
const failing = new Set();
const unquote = (s) => s.replace(/^"|"$/g, "");
const match = (row, key, raw) => {
  const v = row[key];
  if (raw.startsWith("in.(")) return raw.slice(4, -1).split(",").map(unquote).includes(String(v));
  if (raw.startsWith("cs.{")) return Array.isArray(v) && raw.slice(4, -1).split(",").map(unquote).every((x) => v.includes(x));
  if (raw.startsWith("ilike.")) {
    const needle = raw.slice(6).replace(/^\*|\*$/g, "").replace(/^%|%$/g, "").toLowerCase();
    return String(v ?? "").toLowerCase().includes(needle);
  }
  if (raw.startsWith("eq.")) return String(v) === raw.slice(3);
  return true;
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const json = { "content-type": "application/json" };
  if (failing.has(table)) return new Response(JSON.stringify({ message: `stub failure on ${table}`, code: "XX000" }), { status: 500, headers: json });
  let rows = tables[table] ?? [];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    rows = rows.filter((r) => match(r, key, raw));
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

const { searchMessages, mentionsFor, readThreads, THREAD_PAGE, THREAD_ID_CHUNK } = await import("../../src/lib/ops-threads.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const iso = (n) => new Date(Date.UTC(2026, 9, 1) + n * 60_000).toISOString();
const tech = { id: uuid(9001), role: "field_tech", status: "active", email: "tech@proof.invalid", displayName: "Tech", grants: new Set(["messages.use"]) };
const other = { id: uuid(9002), name: "Dana Office" };

/* 250 direct conversations the technician is in, newest first; the oldest holds the match and the mention. 30 office channels he may not read. */
const READABLE = 250;
const directs = Array.from({ length: READABLE }, (_, i) => ({ id: uuid(i + 1), kind: "direct", file_id: null, name: null, channel_roles: null, last_message_at: iso(5000 - i), created_at: iso(0) }));
const channels = Array.from({ length: 30 }, (_, i) => ({ id: uuid(1000 + i), kind: "channel", file_id: null, name: `Office ${i}`, channel_roles: ["admin"], last_message_at: iso(9000 - i), created_at: iso(0) }));
const oldest = directs[READABLE - 1];
tables.eng_threads = [...channels, ...directs];
tables.eng_thread_participants = directs.flatMap((t) => [
  { thread_id: t.id, profile_id: tech.id, last_read_at: null, eng_profiles: { display_name: "Tech", role: "field_tech" } },
  { thread_id: t.id, profile_id: other.id, last_read_at: null, eng_profiles: { display_name: other.name, role: "admin" } },
]);
tables.eng_messages = [
  { id: 1, created_at: iso(20), thread_id: oldest.id, author_id: other.id, body: "The gate code is 4417, @Tech", attachments: [], mentions: [tech.id], eng_profiles: { display_name: other.name, role: "admin" } },
  { id: 2, created_at: iso(30), thread_id: channels[0].id, author_id: other.id, body: "Office only: gate code 9999, @Tech", attachments: [], mentions: [tech.id], eng_profiles: { display_name: other.name, role: "admin" } },
];

check("the scenario is past one page and one chunk", READABLE > THREAD_PAGE && READABLE > THREAD_ID_CHUNK, `${READABLE} readable, page ${THREAD_PAGE}, chunk ${THREAD_ID_CHUNK}`);
const listed = await readThreads(tech);
check("the conversation list still shows only its newest page, and counts them all", listed.ok && listed.threads.length === THREAD_PAGE && listed.readableTotal === READABLE, listed.ok ? `${listed.threads.length} of ${listed.readableTotal}` : listed.error);

/* search */
const found = await searchMessages(tech, { text: "gate code" });
check("search finds the message in the oldest readable conversation", found.error === null && found.results.some((r) => r.id === 1), JSON.stringify(found.results.map((r) => r.id)));
check("and nothing from a conversation he may not read", !found.results.some((r) => r.id === 2));
check("searched counts every readable conversation", found.searched === READABLE, String(found.searched));
check("the hit carries its conversation's title", found.results.find((r) => r.id === 1)?.threadTitle === other.name, found.results.find((r) => r.id === 1)?.threadTitle);

/* mentions */
const named = await mentionsFor(tech);
check("mentions find the one in the oldest readable conversation", named.error === null && named.items.some((m) => m.messageId === 1), JSON.stringify(named.items.map((m) => m.messageId)));
check("and not the one in a conversation he may not read", !named.items.some((m) => m.messageId === 2));
check("and it counts as unread", named.unread === 1, String(named.unread));

/* failed reads */
failing.add("eng_messages");
const searchFailed = await searchMessages(tech, { text: "gate code" });
check("a failed message read is said, never no match", typeof searchFailed.error === "string" && searchFailed.results.length === 0, String(searchFailed.error));
const mentionsFailed = await mentionsFor(tech);
check("and mentions say it too, never 'nothing has named you'", typeof mentionsFailed.error === "string" && mentionsFailed.items.length === 0, String(mentionsFailed.error));
failing.delete("eng_messages");
failing.add("eng_threads");
const scopeFailed = await searchMessages(tech, { text: "gate code" });
check("a failed read of the conversations is said", typeof scopeFailed.error === "string", String(scopeFailed.error));
failing.delete("eng_threads");

/* the screens */
const page = readFileSync("src/app/portal/(app)/messages/page.tsx", "utf8");
check("the messages screen asks mentions for the full set, not its page", /await mentionsFor\(actor\);/.test(page) && !/mentionsFor\(actor, threads\)/.test(page));
check("and renders a failed mentions read as a failure", /mentions\.error \? \([\s\S]*?ErrorState[\s\S]*?This is a failed read, not an empty list/.test(page));
const route = readFileSync("src/app/api/portal/comms/route.ts", "utf8");
check("the search route refuses on a failed read rather than answering no match", /if \(found\.error\) return bad\(/.test(route));

console.log("");
if (wrong === 0) {
  console.log("PASS: message search and mentions reach every readable conversation, and a failed read is said.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
