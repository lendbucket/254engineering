/**
 * PROOF: THE VISIT CLOCK IS THE SERVER'S, NEVER THE PHONE'S.
 *
 * Robert's T6, 2026-11-07: "navigation to the property, with the visit clock
 * recorded by the server, never by the phone."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-visit-clock-is-the-servers.mjs
 *
 *   A  the rules: visits read in recorded-time order whatever order the rows
 *      arrive in, a return trip is a second visit, arriving twice and leaving
 *      without arriving are refused with a sentence.
 *   B  the write: recordVisit inserts with no time of its own, so the column
 *      default now() on the database is the time, and it reads the time back
 *      off the row written; the route passes the act and nothing else from the
 *      body; only the assigned technician, only while the file is in the field;
 *      and the arrival moves no money (the refund rule is not touched).
 *   C  the database: eng_file_events.created_at defaults to now(), replayed
 *      from the migrations, so a row written with no time carries the
 *      database's.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const rules = await import("../../src/lib/visit-clock-rules.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------ A, rules */

const t = (m) => `2026-11-07T15:${String(m).padStart(2, "0")}:00Z`;
const shuffled = [
  { kind: rules.VISIT_LEFT, at: t(40) },
  { kind: "status", at: t(5) },
  { kind: rules.VISIT_ARRIVED, at: t(50) },
  { kind: rules.VISIT_ARRIVED, at: t(10) },
];
const s = rules.visitState(shuffled);
check(
  "A: rows read in recorded-time order, whatever order they arrive in",
  s.visits.length === 2 && s.visits[0].arrivedAt === t(10) && s.visits[0].leftAt === t(40) && s.visits[1].arrivedAt === t(50),
  JSON.stringify(s.visits),
);
check("A: a row that is not a visit is ignored", !JSON.stringify(s).includes(t(5)));
check("A: the last thing recorded is an arrival, so the technician is on site", s.onSite === true);
check("A: arriving again while on site is refused with a sentence", typeof rules.visitRefusal(s, "arrive") === "string");
check("A: leaving while on site is allowed", rules.visitRefusal(s, "leave") === null);
const none = rules.visitState([]);
check("A: leaving with no arrival is refused with a sentence", typeof rules.visitRefusal(none, "leave") === "string");
check("A: arriving with nothing recorded is allowed", rules.visitRefusal(none, "arrive") === null);
check("A: a leaving with no open arrival does not invent a visit", rules.visitState([{ kind: rules.VISIT_LEFT, at: t(1) }]).visits.length === 0);
check(
  "A: the request names an act and nothing else",
  rules.visitActionFrom("arrive") === "arrive" && rules.visitActionFrom("leave") === "leave" && rules.visitActionFrom("2026-11-07T15:00:00Z") === null,
);

/* ------------------------------------------------------------------ B, the write */

const field = readSource("src/lib/ops-field.ts");
const at = field.indexOf("export async function recordVisit(");
const body = at >= 0 ? field.slice(at, field.indexOf("\n}\n", at)) : "";
check("B: recordVisit exists", body.length > 0);
const insertAt = body.indexOf('.from("eng_file_events")');
const insert = insertAt >= 0 ? body.slice(insertAt, body.indexOf(".select(", insertAt)) : "";
check("B: it inserts into eng_file_events", insert.includes(".insert({"));
check(
  "B: the insert carries no time of its own, so the database's now() is the time",
  insert.length > 0 && !/created_at|DB_NOW|new Date|Date\.now|\bat:/.test(insert),
  insert.replace(/\s+/g, " ").slice(0, 160),
);
check("B: the time returned is read back off the row written", /\.select\("created_at"\)\s*\.single\(\)/.test(body) && body.includes("at: data.created_at"));
check("B: only the assigned technician, the evidence write rule", body.includes("evidenceWriteRefusal(") && body.includes("view.file.assigned_tech_id"));
check("B: only while the file is in the field", body.includes("CAPTURE_CLOSED_STATUSES.includes(view.file.status)"));
check("B: refused when the clock cannot be read, rather than written blind", body.includes("if (!state) return { ok: false"));
check("B: the arrival moves no money: the refund rule is not called from here", !body.includes("recordTechnicianVisit("));

const route = readSource("src/app/api/portal/field/route.ts");
const r0 = route.indexOf('if (action === "record_visit")');
const branch = r0 >= 0 ? route.slice(r0, route.indexOf("\n  }\n", r0)) : "";
check("B: the route has the record_visit branch", branch.length > 0);
const bodyReads = [...branch.matchAll(/body\?\.([a-zA-Z_]+)/g)].map((m) => m[1]).sort();
check(
  "B: the route reads only the act, the file and the late flag from the body",
  JSON.stringify(bodyReads) === JSON.stringify(["fileId", "late", "visit"]),
  bodyReads.join(", "),
);
check("B: the late flag is a literal true or nothing", rules.visitLateFrom(true) === true && rules.visitLateFrom("2026-11-07T15:00:00Z") === false && rules.visitLateFrom(1) === false);
check("B: what is stored for it is a boolean, never a time", /meta: \{ late \}/.test(insert));

/* ---------------------------------------------- B2, a press with no signal (answer 4) */

const lateRead = rules.visitState([
  { kind: rules.VISIT_ARRIVED, at: t(10), late: true },
  { kind: rules.VISIT_LEFT, at: t(30) },
]);
check("B2: a late arrival is read as late, a timely leaving as not", lateRead.visits[0].arrivedLate === true && lateRead.visits[0].leftLate === false);
const clock = readSource("src/app/portal/(app)/jobs/[id]/VisitClock.tsx");
check("B2: the phone holds only the act when there is no signal", /localStorage\.setItem\(heldKey\(fileId\), visit\)/.test(clock));
check("B2: and reads no clock anywhere in the component", !/new Date|Date\.now|toISOString|getTime|performance\.now/.test(clock));
check("B2: a held press is sent marked late", /send\(waiting, true\)/.test(clock) && /send\(pending, true\)/.test(clock));
check("B2: a late time is labelled as such on the screen", clock.includes("(recorded when signal returned)"));

/* ------------------------------------------------- B3, Apple Maps on an iPhone (answer 5) */

const job = readSource("src/app/portal/(app)/jobs/[id]/page.tsx");
const apple = readSource("src/app/portal/(app)/jobs/[id]/AppleMapsLink.tsx");
check("B3: the job keeps its external Directions link", job.includes("https://maps.google.com/?q=${mapQuery}"));
check("B3: and adds Apple Maps, drawn only on an Apple device", job.includes("<AppleMapsLink query={mapQuery} />") && /iPhone\|iPad\|iPod/.test(apple) && apple.includes("if (!apple) return null;"));

/* ------------------------------------------------------------- C, the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));
const def = (
  await db.query(
    `select column_default from information_schema.columns where table_schema = 'public' and table_name = 'eng_file_events' and column_name = 'created_at'`,
  )
).rows[0]?.column_default;
check("C: eng_file_events.created_at defaults to now() on the database", def === "now()", String(def));

console.log(wrong === 0 ? "PASS: the visit clock is the server's." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
