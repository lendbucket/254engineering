// @runtime react-server
//
// Declared because it imports src/lib/dispatch-hold.ts and src/lib/ops-file-inputs.ts,
// which carry server-only.

/**
 * A FAILED READ OF A JOB'S ANSWERS IS NEVER "NOBODY ANSWERED YES".
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-failed-answers-read-holds-the-job.mjs
 *
 * Robert's audit of 2026-10-24, finding F12. answersFor returned {} on a failed
 * read, beneath its own comment saying it must not. holdFor read that empty
 * record as "no yes", so a roof job whose customer answered yes to question 8
 * (an open insurance claim), which RC-001 routes to the engineer before anybody
 * is dispatched, read as not held and could be dispatched. Each of the three
 * reads answersFor makes is failed in turn against a fake PostgREST, and each
 * must leave the job "could not be checked", which dispatch refuses on.
 *
 * Nothing reaches a database: the fetch below answers every request.
 */
process.env.SUPABASE_URL = "http://answers-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "answers-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const FILE = "00000000-0000-4000-8000-000000000001";
const ORDER = "00000000-0000-4000-8000-000000000002";
let failing = null;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === failing) return json({ message: `proof: the ${table} read failed`, code: "XX000" }, 500);
  if (table === "eng_files") return json([{ id: FILE, service_slug: "roof-inspections" }]);
  if (table === "eng_file_inputs") return json([]);
  if (table === "eng_service_orders") return json([{ id: ORDER }]);
  if (table === "eng_order_inputs") return json([{ key: "rc001_q8", value_text: "yes" }]);
  if (table === "eng_file_events") return json([]);
  return json([]);
};

const { holdFor, holdRefusal } = await import("../../src/lib/dispatch-hold.ts");
const { readAnswers } = await import("../../src/lib/ops-file-inputs.ts");

failing = null;
const premise = await holdFor(FILE);
check("the premise: with every read answering, a yes to question 8 holds the job", premise.held === true, JSON.stringify(premise));

for (const table of ["eng_file_inputs", "eng_service_orders", "eng_order_inputs"]) {
  failing = table;
  const hold = await holdFor(FILE);
  check(
    `a failed ${table} read leaves the job "could not be checked", and dispatch refuses it`,
    hold.held === null && typeof holdRefusal(hold) === "string",
    JSON.stringify(hold),
  );
}

failing = "eng_order_inputs";
const unread = await readAnswers(FILE);
check("readAnswers says the read failed rather than returning an empty record", unread.ok === false && /could not be read/.test(unread.error), JSON.stringify(unread));
failing = null;
const read = await readAnswers(FILE);
check("and returns the answers when every read answers", read.ok === true && read.answers.rc001_q8 === "yes", JSON.stringify(read));

const files = readFileSync("src/app/portal/(app)/files/page.tsx", "utf8");
check(
  "the Files screen reads with readAnswers and says a failed read instead of showing blank details",
  /await readAnswers\(selected\.id\)/.test(files) && /\{answersUnread \? \(/.test(files) && !/answersFor\(/.test(files),
);
const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check(
  "the review screen reads with readAnswers and shows its could-not-be-read sentence on a failure",
  /await readAnswers\(selected\.file\.id\)/.test(review) && /letterAnswersRead\?\.ok \? await recordedFactsFor/.test(review) && !/answersFor\(/.test(review),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a failed read of a job's answers holds the job and is said on every screen, never read as no answers.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
