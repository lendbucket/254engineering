// @runtime react-server
//
// Declared because it imports src/lib/ops-field.ts, which carries server-only.

/**
 * THE CAPTURE DOOR IS THE ASSIGNED TECHNICIAN'S, NEVER OVERWRITES, AND A
 * CAPTURE ROW NAMES ONLY ITS OWN OBJECT, WHICH MUST BE THERE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-capture-door-is-the-assigned-technicians-and-never-overwrites.mjs
 *
 * Robert's ruling Q2 of 2026-11-02, from audit field F2 and F4:
 * "sign_upload loads the file through jobView, requires the assigned
 * technician and an open status, uploads with upsert false; record_capture
 * refuses a storage key that is not exactly fileId/captureId.ext and confirms
 * the object exists."
 *
 *   A  the upload door opens only to the assigned technician, only while
 *      capture is open; an unassigned file, another technician's file and a
 *      file that has left the field are each refused
 *   B  the one key a capture may carry is fileId/captureId.ext for an allowed
 *      type; another file's folder, another capture id, a stray extension and
 *      a path with extra segments are each refused; no key is not asked
 *   C  the existence check answers present, absent, and failed as three
 *      different things, never folding a failed listing into either
 *   D  in the route: jobView and the door refusal come before any URL, the URL
 *      is upsert false, a stored object is answered without a URL, and no
 *      upsert true remains; in recordCapture: the key check and the existence
 *      check come before the row is written
 *
 * Against a fake storage API. Nothing reaches a database or a bucket.
 */
process.env.SUPABASE_URL = "http://capture-door-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "capture-door-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { captureDoorRefusal, captureKeyProblem, captureStorageKey, CAPTURE_CLOSED_STATUSES } = await import("../../src/lib/evidence-capture-rules.ts");

const TECH = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";
const FILE = "00000000-0000-4000-8000-00000000f001";
const FILE_B = "00000000-0000-4000-8000-00000000f002";
const CAP = "cap_0f8e6a2c-1111-4222-8333-444455556666";

/* A */
check("the assigned technician on a dispatched file is let in", captureDoorRefusal(TECH, { assigned_tech_id: TECH, status: "dispatched" }) === null);
check("and on a file with evidence in progress", captureDoorRefusal(TECH, { assigned_tech_id: TECH, status: "evidence_in_progress" }) === null);
check("an unassigned file is refused", /Accept this job/.test(String(captureDoorRefusal(TECH, { assigned_tech_id: null, status: "needs_dispatch" }))));
check("another technician's file is refused", /another technician/.test(String(captureDoorRefusal(OTHER, { assigned_tech_id: TECH, status: "dispatched" }))));
for (const status of ["evidence_submitted", "under_review", "sealed", "delivered", "closed", "cancelled"]) {
  check(`a file at ${status} is refused, even to its technician`, /left the field/.test(String(captureDoorRefusal(TECH, { assigned_tech_id: TECH, status }))));
}
check("the closed list names at least the six statuses after the field", CAPTURE_CLOSED_STATUSES.length >= 6);

/* B */
const key = captureStorageKey(FILE, CAP, "image/jpeg");
check("sign_upload's key is fileId/captureId.ext", key === `${FILE}/${CAP}.jpeg`, String(key));
check("an unaccepted type has no key", captureStorageKey(FILE, CAP, "image/gif") === null);
check("the capture's own key is accepted", captureKeyProblem(FILE, CAP, key) === null);
check("a PDF capture's own key is accepted", captureKeyProblem(FILE, CAP, `${FILE}/${CAP}.pdf`) === null);
check("another file's folder is refused", captureKeyProblem(FILE_B, CAP, key) !== null);
check("another capture id is refused", captureKeyProblem(FILE, "cap_9999aaaa-1111-4222-8333-444455556666", key) !== null);
check("a stray extension is refused", captureKeyProblem(FILE, CAP, `${FILE}/${CAP}.exe`) !== null);
check("a path with extra segments is refused", captureKeyProblem(FILE, CAP, `${FILE}/x/${CAP}.jpeg`) !== null);
check("a prefix match alone is not enough", captureKeyProblem(FILE, CAP, `${FILE}/${CAP}.jpeg.png`) !== null);
check("a capture with no key (a measurement) is not asked", captureKeyProblem(FILE, CAP, null) === null && captureKeyProblem(FILE, CAP, "") === null);

/* C */
const listing = { mode: "present" };
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.pathname.includes("/storage/v1/object/list/")) {
    if (listing.mode === "fail") return new Response(JSON.stringify({ message: "proof: listing failed" }), { status: 500, headers: { "content-type": "application/json" } });
    const rows = listing.mode === "present" ? [{ name: `${CAP}.jpeg` }, { name: `${CAP}.jpeg.png` }] : [{ name: `${CAP}.jpeg.png` }];
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
};
const { evidenceObjectExists } = await import("../../src/lib/ops-field.ts");
const present = await evidenceObjectExists(key);
check("a stored object reads as present", present.ok === true && present.exists === true, JSON.stringify(present));
listing.mode = "absent";
const absent = await evidenceObjectExists(key);
check("an object not stored reads as absent, though a longer name shares its prefix", absent.ok === true && absent.exists === false, JSON.stringify(absent));
listing.mode = "fail";
const failed = await evidenceObjectExists(key);
check("a failed listing is a failure, never absent and never present", failed.ok === false, JSON.stringify(failed));

/* D */
const route = readFileSync("src/app/api/portal/field/route.ts", "utf8");
const sign = route.slice(route.indexOf('if (action === "sign_upload")'), route.indexOf('if (action === "record_capture")'));
const at = (s) => sign.indexOf(s);
check("the sign_upload branch is found", sign.length > 200);
check("sign_upload reads the file through jobView before any URL", at("await jobView(actor, fileId)") > 0 && at("await jobView(actor, fileId)") < at("createSignedUploadUrl"));
check("and asks the door before any URL", at("captureDoorRefusal(actor.id, view.file)") > 0 && at("captureDoorRefusal(actor.id, view.file)") < at("createSignedUploadUrl"));
check("the URL is issued with upsert false", /createSignedUploadUrl\(path, \{ upsert: false \}\)/.test(sign));
check("no upsert true remains in the route", !/upsert: true/.test(route));
check("a stored object is answered without a URL, before one is issued", at("stored: true") > 0 && at("stored: true") < at("createSignedUploadUrl"));
const field = readFileSync("src/lib/ops-field.ts", "utf8");
const rc = field.slice(field.indexOf("export async function recordCapture("), field.indexOf("export async function recordException("));
const rcAt = (s) => rc.indexOf(s);
check("recordCapture is found", rc.length > 500);
check("recordCapture refuses a key that is not this capture's own before writing", rcAt("captureKeyProblem(fileId, input.clientCaptureId, input.storageKey)") > 0 && rcAt("captureKeyProblem(") < rcAt('.from("eng_evidence_items")'));
check("and confirms the object exists before writing", rcAt("await evidenceObjectExists(input.storageKey)") > 0 && rcAt("await evidenceObjectExists(") < rcAt('.from("eng_evidence_items")'));
const queue = readFileSync("src/lib/offline-queue.ts", "utf8");
check("the offline queue records a stored object without uploading it again", /signedBody\.stored && signedBody\.path/.test(queue));

console.log(
  wrong === 0
    ? "PASS: the capture door is the assigned technician's while capture is open, never overwrites, and a capture names only its own object, which must be there."
    : `FAIL: ${wrong} check(s) above.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
