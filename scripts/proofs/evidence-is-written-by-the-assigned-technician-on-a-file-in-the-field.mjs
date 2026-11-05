/**
 * EVIDENCE IS WRITTEN ONLY BY THE ASSIGNED TECHNICIAN, ONLY ON A FILE STILL IN
 * THE FIELD, AND AN OFFER IS TAKEN ONLY ON A FILE STILL WAITING FOR ONE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/evidence-is-written-by-the-assigned-technician-on-a-file-in-the-field.mjs
 *
 * Robert's ruling Q3 of 2026-11-02, from audit field F3, F7, F16 and F15:
 * "assigned technician guard on submitEvidence; acceptance only when status is
 * needs_dispatch, withdraw offers when a file leaves needs_dispatch; refused
 * and repairs_required close capture; evidence writes scoped to
 * evidence.capture and the assigned technician."
 *
 *   A  the write rule: the evidence.capture grant and the assigned technician,
 *      whatever the role; a reviewer, an unassigned file and another
 *      technician's file are each refused
 *   B  refused and repairs_required close capture, beside the six that did
 *   C  leaving needs_dispatch withdraws open offers, except into dispatched
 *   D  the removal rule binds every role the same way
 *   E  in the code: all six evidence writes ask the rule and none admits
 *      evidence.review; submitEvidence asks before the gate; acceptOffer
 *      refuses a file not waiting and its claim carries the status; the
 *      transition withdraws open offers after its update; the job screen is
 *      read only to anybody the rule refuses
 *
 * Pure rules and source reading. Nothing reaches a database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { evidenceWriteRefusal, leavesDispatchWithOffers, CAPTURE_CLOSED_STATUSES } = await import("../../src/lib/evidence-capture-rules.ts");
const { captureDeleteRefusal } = await import("../../src/lib/ops-evidence.ts");

const TECH = "tech-a";
const OTHER = "tech-b";

/* A */
check("the assigned technician holding evidence.capture may write", evidenceWriteRefusal({ id: TECH, mayCapture: true }, TECH) === null);
check("a reviewer without evidence.capture is refused, even if assigned", evidenceWriteRefusal({ id: TECH, mayCapture: false }, TECH) !== null);
check("a technician whose offer was withdrawn is refused on the assigned technician's file", /Another technician/.test(String(evidenceWriteRefusal({ id: OTHER, mayCapture: true }, TECH))));
check("nobody writes on a file nobody has accepted", /Accept this job/.test(String(evidenceWriteRefusal({ id: TECH, mayCapture: true }, null))));

/* B */
for (const status of ["refused", "repairs_required", "evidence_submitted", "under_review", "sealed", "delivered", "closed", "cancelled"]) {
  check(`capture is closed at ${status}`, CAPTURE_CLOSED_STATUSES.includes(status));
}
for (const status of ["dispatched", "evidence_in_progress", "revisions_requested"]) {
  check(`capture stays open at ${status}`, !CAPTURE_CLOSED_STATUSES.includes(status));
}

/* C */
for (const to of ["cancelled", "intake"]) check(`needs_dispatch to ${to} withdraws the open offers`, leavesDispatchWithOffers("needs_dispatch", to));
check("needs_dispatch to dispatched does not (acceptOffer withdraws the others itself)", !leavesDispatchWithOffers("needs_dispatch", "dispatched"));
check("a move that does not start at needs_dispatch does not", !leavesDispatchWithOffers("dispatched", "cancelled") && !leavesDispatchWithOffers("under_review", "needs_dispatch"));

/* D */
const del = (role, assigned, mayCapture = true) => captureDeleteRefusal({ actorId: "me", actorRole: role, mayCapture, assignedTechId: assigned, status: "evidence_in_progress" });
check("the assigned technician may remove a capture in the field", del("field_tech", "me") === null);
check("an administrator not assigned may not, whatever the grant", del("admin", "someone") !== null);
check("an engineer not assigned may not", del("engineer", null) !== null);
check("nobody without evidence.capture may", del("field_tech", "me", false) !== null);

/* E */
const field = readFileSync("src/lib/ops-field.ts", "utf8");
const bodyOf = (name) => {
  const start = field.indexOf(`export async function ${name}(`);
  if (start < 0) return "";
  const next = field.indexOf("\nexport ", start + 10);
  return field.slice(start, next < 0 ? undefined : next);
};
/* The exact two lines: the rule's answer assigned, then refused on. A call with a prefix ("null &&") or no refusal reads differently. */
const RULE = 'const notYours = evidenceWriteRefusal({ id: actor.id, mayCapture: can(actor, "evidence.capture") }, view.file.assigned_tech_id);\n  if (notYours) return { ok: false, error: notYours };';
for (const name of ["recordCapture", "recordException", "withdrawException", "closeRepairItem", "submitEvidence"]) {
  const body = bodyOf(name);
  check(`${name} is found`, body.length > 100);
  check(`${name} asks the write rule and refuses on its answer`, body.includes(RULE));
  check(`${name} admits no evidence.review`, !body.includes('"evidence.review"'));
}
const delBody = bodyOf("deleteCapture");
check("deleteCapture asks the removal rule with evidence.capture alone", /mayCapture: can\(actor, "evidence\.capture"\),/.test(delBody) && !delBody.includes('"evidence.review"'));
const submit = bodyOf("submitEvidence");
check("submitEvidence asks the rule before the gate and before the move", submit.indexOf(RULE) > 0 && submit.indexOf(RULE) < submit.indexOf("view.state.canSubmit") && submit.indexOf(RULE) < submit.indexOf("transitionFile("));
const accept = bodyOf("acceptOffer");
check("acceptOffer refuses a file that is not waiting, before the claim", accept.indexOf('  if (file.status !== "needs_dispatch") {\n    return { ok: false,') > 0 && accept.indexOf('if (file.status !== "needs_dispatch")') < accept.indexOf('.update({ assigned_tech_id: offer.tech_id })'));
check("and the claim itself carries the status", /\.update\(\{ assigned_tech_id: offer\.tech_id \}\)\s*\.eq\("id", offer\.file_id\)\s*\.eq\("status", "needs_dispatch"\)\s*\.is\("assigned_tech_id", null\)/.test(accept));
const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
const tf = crm.slice(crm.indexOf("export async function transitionFile("));
check("transitionFile withdraws open offers when the move leaves needs_dispatch, after its update", tf.indexOf("  if (leavesDispatchWithOffers(current.status, to)) {") > tf.indexOf('.update(patch).eq("id", id).eq("status", current.status)') &&/\.update\(\{ state: "withdrawn", responded_at: DB_NOW \}\)\s*\.eq\("file_id", id\)\s*\.eq\("state", "offered"\)/.test(tf));
const page = readFileSync("src/app/portal/(app)/jobs/[id]/page.tsx", "utf8");
check("the job screen is read only to anybody the rule refuses", /CAPTURE_CLOSED_STATUSES\.includes\(view\.file\.status\) \|\|/.test(page) && /evidenceWriteRefusal\(\{ id: actor\.id, mayCapture: can\(actor, "evidence\.capture"\) \}, view\.file\.assigned_tech_id\) !== null/.test(page));
check("and draws Remove only on evidence.capture", /mayCapture: can\(actor, "evidence\.capture"\),/.test(page) && !/mayCapture: can\(actor, "evidence\.capture"\) \|\| can\(actor, "evidence\.review"\)/.test(page));

console.log(
  wrong === 0
    ? "PASS: evidence is written only by the assigned technician on a file still in the field, and an offer is taken only on a file still waiting for one."
    : `FAIL: ${wrong} check(s) above.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
