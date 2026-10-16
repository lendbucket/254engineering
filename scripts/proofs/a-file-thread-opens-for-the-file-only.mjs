/**
 * A FILE'S CONVERSATION OPENS FROM THE FILE, AND ONLY FOR SOMEBODY WHO CAN SEE IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-file-thread-opens-for-the-file-only.mjs
 *
 * Operator ruling, 2026-10-15: a button on the order that opens its thread.
 * The open_file_thread action existed with no caller, so the office, the
 * technician and the engineer could only message each other directly. And
 * fileThread read nothing about its caller: anybody reaching the route could
 * open a thread on any file and be added as a participant, which is who a
 * message notifies. Adding a button makes that route easier to reach, so the
 * guard comes with it.
 *
 * What this proves, and what it does not. The VERDICT the guard asks for is
 * exercised here on canSeeFile with the subject fileThread builds. That the
 * guard runs BEFORE any thread or participant row is written is asserted from
 * the source, by position. fileThread itself needs a database and is walked
 * live on development in the Saturday rehearsal, with a technician who is not
 * on the file refused.
 */
import { readSource } from "../lib/read-source.mjs";

const { canSeeFile } = await import("../../src/lib/ops-authz.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const actor = (id, role) => ({ id, role, status: "active", grants: new Set(["messages.use"]) });
const file = {
  id: "file-1",
  status: "evidence_in_progress",
  assigned_tech_id: "tech-on-it",
  assigned_engineer_id: "eng-on-it",
  offered_tech_ids: ["tech-on-it"],
};

check("the technician on the file can see it", canSeeFile(actor("tech-on-it", "field_tech"), file));
check("a technician not on the file cannot", !canSeeFile(actor("tech-elsewhere", "field_tech"), file));
check("an administrator can", canSeeFile(actor("admin-1", "admin"), file));

/* The guard, located and ordered against the writes it protects. */
const threads = readSource("src/lib/ops-threads.ts");
const start = threads.indexOf("export async function fileThread(");
const end = threads.indexOf("\n}\n", start);
const body = start >= 0 && end > start ? threads.slice(start, end) : "";
check("fileThread is found, so the checks below read it", body.length > 0);

const grant = body.indexOf('if (!can(actor, "messages.use")) return null;');
const guard = body.indexOf("!canSeeFile(actor, {");
const insertThread = body.indexOf('.from("eng_threads")\n      .insert(');
const addPeople = body.indexOf('.from("eng_thread_participants")');
check("it refuses a caller without messaging", grant >= 0);
check(
  "it refuses a caller who cannot see the file, before creating a thread or adding anybody",
  guard > 0 && insertThread > guard && addPeople > guard,
  `guard at ${guard}, thread insert at ${insertThread}, participants at ${addPeople}`,
);
check("and the subject it judges carries the offers, as the file screens' does", /offered_tech_ids: offeredTechIds/.test(body));

/* The button and the three screens it sits on. */
const button = readSource("src/components/portal/FileThreadButton.tsx");
check(
  "the button opens the file's thread and goes to it",
  /action: "open_file_thread", fileId/.test(button) && /router\.push\(`\/portal\/messages\?id=\$\{body\.id\}`\)/.test(button),
);
for (const [screen, path, id] of [
  ["the technician's job", "src/app/portal/(app)/jobs/[id]/page.tsx", "view.file.id"],
  ["the engineer's review", "src/app/portal/(app)/review/page.tsx", "selected.file.id"],
  ["the office's file", "src/app/portal/(app)/files/page.tsx", "selected.id"],
]) {
  const src = readSource(path);
  check(`${screen} carries it for anybody who can message`, src.includes(`<FileThreadButton fileId={${id}} />`) && /can\(actor, "messages\.use"\) \?/.test(src));
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a file's conversation opens from the file, for the people who can see it.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
