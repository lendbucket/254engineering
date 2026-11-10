/**
 * PROOF: RETURNED EVIDENCE IS ANSWERED FROM THE PHONE, AND GOES BACK ANSWERED.
 *
 * Robert's T5, 2026-11-07, and his answer 3 of the same night (6717223376):
 * "The engineer's note sits at the top of the job. The technician captures
 * what was asked and writes a short reply, stored as a file event, then
 * resubmits. A reply alone resubmits only when the note asked a question."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/returned-evidence-is-answered-from-the-phone.mjs
 *
 *   A  the rules: the latest request is the one answered, a reply written
 *      before it does not count, and a resubmission needs a reply plus new
 *      evidence unless the note asked a question.
 *   B  the code: the server refuses a resubmission the rules refuse, before
 *      the file moves; only the assigned technician replies, only while the
 *      file is sent back; the job shows the note and the review shows the reply.
 *   C  the premise: the review decision writes the engineer's note into the
 *      file timeline as the request this reads, in the migration that defines it.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/revision-rules.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------- A, rules */

const t = (m) => `2026-11-07T15:${String(m).padStart(2, "0")}:00Z`;
const req = (m, body) => ({ kind: "status", to_status: "revisions_requested", body, at: t(m) });
const reply = (m, body) => ({ kind: rules.REVISION_REPLY, to_status: null, body, at: t(m) });

const two = rules.latestRevision([reply(25, "second answer"), req(10, "Photograph the north wall."), reply(12, "first answer"), req(20, "And the gutter?")]);
check("A: the latest request is the one shown", two?.note === "And the gutter?" && two?.requestedAt === t(20), JSON.stringify(two));
check("A: its reply is the one written after it", two?.reply?.body === "second answer");
const stale = rules.latestRevision([reply(5, "early"), req(10, "Photograph the north wall.")]);
check("A: a reply written before the request does not answer it", stale?.reply === null);
check("A: a file never sent back has no round", rules.latestRevision([{ kind: "status", to_status: "evidence_submitted", body: null, at: t(1) }]) === null);

const asked = { requestedAt: t(10), note: "Photograph the north wall.", reply: null };
const answered = { ...asked, reply: { at: t(12), body: "Done, two photographs." } };
const question = { requestedAt: t(10), note: "Was the crawl space open?", reply: { at: t(12), body: "Yes, from the east side." } };
check("A: no reply, refused", typeof rules.resubmitRefusal(asked, true) === "string");
check("A: a reply and nothing new, on an instruction, refused", typeof rules.resubmitRefusal(answered, false) === "string");
check("A: a reply and something new, allowed", rules.resubmitRefusal(answered, true) === null);
check("A: a reply alone, when the note asked a question, allowed", rules.resubmitRefusal(question, false) === null);
check("A: a package never sent back is not held by this rule", rules.resubmitRefusal(null, false) === null);
check("A: a blank reply is refused", typeof rules.replyRefusal("  ok ") === "string" && rules.replyRefusal("Done.") === null);
check("A: an overlong reply is refused", typeof rules.replyRefusal("x".repeat(rules.REPLY_MAX + 1)) === "string");

/* -------------------------------------------------------------------- B, code */

const field = readSource("src/lib/ops-field.ts");
const subAt = field.indexOf("export async function submitEvidence(");
const sub = field.slice(subAt, field.indexOf("\n}\n", subAt));
const gateAt = sub.indexOf("resubmitRefusal(revision.round, revision.newEvidenceSinceRequest)");
const moveAt = sub.indexOf('transitionFile(actor, fileId, "evidence_submitted"');
check("B: submitEvidence asks the rule while the file is sent back", sub.includes("if (view.file.status === REVISIONS_REQUESTED)") && gateAt > 0);
check("B: and asks it before the file moves", gateAt > 0 && moveAt > gateAt);
check("B: a failed read refuses rather than submitting", sub.includes("if (!revision) return { ok: false"));

const repAt = field.indexOf("export async function replyToRevision(");
const rep = field.slice(repAt, field.indexOf("\n}\n", repAt));
check("B: only the assigned technician replies", rep.includes("evidenceWriteRefusal(") && rep.includes("view.file.assigned_tech_id"));
check("B: only while the file is sent back", rep.includes("view.file.status !== REVISIONS_REQUESTED"));
check("B: only against a request that exists", rep.includes("if (!revision.round) return { ok: false"));
check("B: the reply is a file event of its own kind", /kind: REVISION_REPLY, body: body\.trim\(\)/.test(rep));

const revAt = field.indexOf("export async function revisionFor(");
const rev = field.slice(revAt, field.indexOf("\n}\n", revAt));
check("B: new evidence counts captures and exceptions after the request", rev.includes('.gt("created_at", round.requestedAt)') && rev.includes('.gt("recorded_at", round.requestedAt)'));
check("B: a failed count is not read as nothing added", rev.includes("captures.count === null || exceptions.count === null) return null"));

const route = readSource("src/app/api/portal/field/route.ts");
check("B: the route has reply_revision", route.includes('if (action === "reply_revision")') && route.includes("replyToRevision("));

const job = readSource("src/app/portal/(app)/jobs/[id]/page.tsx");
const noteAt = job.indexOf("<RevisionAnswer");
const mapAt = job.indexOf("Directions");
check("B: the job shows the engineer's note above everything but its title line", noteAt > 0 && mapAt > noteAt);
const review = readSource("src/app/portal/(app)/review/page.tsx");
check("B: the review shows the technician's reply", review.includes("lastReturn.round.reply.body") && review.includes("revisionFor("));

/* -------------------------------------------------------------- C, the premise */

const DIR = "supabase/migrations";
const defining = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => readSource(join(DIR, f)).includes("function eng_record_review_decision"));
const last = defining.length ? readSource(join(DIR, defining[defining.length - 1])) : "";
check(
  "C: the latest eng_record_review_decision writes the note as a status event with its target",
  /insert into public\.eng_file_events \(file_id, actor_id, kind, from_status, to_status, body\)\s*values \(v_file_id, v_actor_id, 'status', v_status, v_target, v_note\)/.test(last),
  defining[defining.length - 1] ?? "none",
);

console.log(wrong === 0 ? "PASS: returned evidence is answered from the phone." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
