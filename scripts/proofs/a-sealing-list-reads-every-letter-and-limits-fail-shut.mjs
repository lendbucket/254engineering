// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, src/lib/account-api-keys.ts and
// src/lib/sister-intake.ts, which carry server-only.

/**
 * THE SEALING LIST READS EVERY LETTER AND SAYS WHEN IT CANNOT, AND A RATE LIMIT
 * WHOSE COUNT CANNOT BE READ REFUSES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-sealing-list-reads-every-letter-and-limits-fail-shut.mjs
 *
 * Robert's audit of 2026-10-24.
 *
 * lettersAwaitingSeal read the engineer's OLDEST 200 determinations, sealed
 * ones included, and filtered afterwards. Past 200 sealed letters every new one
 * was invisible, and the review page offers the seal panel from that list, so
 * it could not be sealed from the screen. A failed read was "nothing waiting".
 * Here: 250 sealed letters and one new one, read through paging, plus a failed
 * read.
 *
 * withinRateLimit (the v1 API key) and acceptSisterLead (the sister sites) read
 * a failed count as zero, so the limit opened exactly when the database was in
 * trouble. And decideReview's guard against a second decision on an unsealed
 * pass ignored the read error on the passes, skipping the guard.
 *
 * Against a fake PostgREST that honours offset and limit. Nothing reaches a
 * database.
 */
process.env.SUPABASE_URL = "http://sealing-list-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sealing-list-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ENGINEER = "00000000-0000-4000-8000-0000000000e9";
const pad = (n) => String(n).padStart(4, "0");
const DETS = [];
for (let i = 0; i < 250; i += 1) {
  DETS.push({ id: `det-${pad(i)}`, file_id: `file-${pad(i)}`, determination: "pass", decided_at: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00Z`, protocol_document: "254-RC-001" });
}
DETS.sort((a, b) => (a.decided_at + a.id < b.decided_at + b.id ? -1 : 1));
DETS.push({ id: "det-new", file_id: "file-new", determination: "pass", decided_at: "2026-10-24T15:00:00Z", protocol_document: "254-RC-001" });
const SEALED = new Set(DETS.filter((d) => d.id !== "det-new").map((d) => d.id));

const state = { fail: null };
const json = (b, status = 200, headers = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...headers } });
const inList = (url, key) => {
  const v = url.searchParams.get(key);
  return v && v.startsWith("in.(") ? v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")) : null;
};
const page = (url, rows) => {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  return rows.slice(offset, offset + limit);
};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (state.fail === table) return json({ message: `proof: the ${table} read failed`, code: "XX000" }, 500);
  if (table === "eng_determinations") return json(page(url, DETS));
  if (table === "eng_seal_acts") {
    const ids = inList(url, "determination_id") ?? [];
    return json(page(url, ids.filter((id) => SEALED.has(id)).sort().map((determination_id) => ({ determination_id }))));
  }
  if (table === "eng_files") {
    const ids = inList(url, "id") ?? [];
    return json(page(url, ids.sort().map((id) => ({ id, file_number: id.toUpperCase(), property_address: "1 Proof Way" }))));
  }
  if (table === "eng_account_api_requests" || table === "eng_leads") {
    return new Response(null, { status: 200, headers: { "content-range": "*/3" } });
  }
  return json([]);
};

const { lettersAwaitingSeal } = await import("../../src/lib/letter-seal.ts");
const { withinRateLimit } = await import("../../src/lib/account-api-keys.ts");
const { acceptSisterLead } = await import("../../src/lib/sister-intake.ts");
const engineer = { id: ENGINEER, role: "engineer", status: "active" };

const all = await lettersAwaitingSeal(engineer);
check(
  "with 250 of his letters sealed, the one he decided today is waiting for his seal",
  all.ok === true && all.letters.length === 1 && all.letters[0].determinationId === "det-new",
  all.ok ? all.letters.map((l) => l.determinationId).join(", ") || "none" : all.error,
);
check("and it is offered with its file", all.ok === true && all.letters[0]?.fileNumber === "FILE-NEW", all.ok ? all.letters[0]?.fileNumber : "");

state.fail = "eng_determinations";
const noDets = await lettersAwaitingSeal(engineer);
check("a failed read of his determinations says so, never an empty list", noDets.ok === false && /could not be read/.test(noDets.error), JSON.stringify(noDets));
state.fail = "eng_seal_acts";
const noActs = await lettersAwaitingSeal(engineer);
check("a failed read of the seal acts says so, never every letter waiting again", noActs.ok === false && /already sealed could not be read/.test(noActs.error), JSON.stringify(noActs));
state.fail = null;

const key = { keyId: "key-proof", accountId: "acct-proof", rateLimitPerMinute: 60 };
check("the API key limit allows a request under it", (await withinRateLimit(key)).ok === true);
state.fail = "eng_account_api_requests";
const unread = await withinRateLimit(key);
check("a count that could not be read refuses, and says it could not be read", unread.ok === false && unread.unreadable === true, JSON.stringify(unread));
state.fail = "eng_leads";
const sister = await acceptSisterLead("sealed", { form: "contact", email: "sister-proof@audit-probe.invalid", message: "proof" });
check("a sister lead whose rate cannot be counted is refused, and nothing is saved", sister.ok === false && sister.status === 503, JSON.stringify(sister));
state.fail = null;

const route = readFileSync("src/app/api/v1/orders/route.ts", "utf8");
check(
  "the v1 route answers an unreadable count with 503, never 'rate limit reached'",
  /if \(limit\.unreadable\) \{[\s\S]{0,200}status: 503/.test(route) && route.indexOf("if (limit.unreadable)") < route.indexOf("if (!limit.ok)"),
);
const engineerSrc = readFileSync("src/lib/ops-engineer.ts", "utf8");
check(
  "the second-decision guard refuses when the earlier passes cannot be read",
  /const \{ data: passes, error: passesError \}[\s\S]{0,600}if \(passesError\) \{\s*return \{\s*ok: false,/.test(engineerSrc),
);
const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("the review screen states a failed read of the sealing list", /!awaitingRead\.ok \? \(/.test(review));

console.log("");
if (wrong === 0) {
  console.log("PASS: the sealing list reads every letter and says when it cannot, and an unreadable rate count refuses.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
