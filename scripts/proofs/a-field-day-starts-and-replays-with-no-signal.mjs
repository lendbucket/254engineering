/**
 * PROOF: A FIELD DAY STARTS WITH NO SIGNAL, EVERY PHOTOGRAPH IS THE ONE TAKEN,
 * AND THE QUEUE REPLAYS IN TIME ORDER.
 *
 * Robert's T2, 2026-11-07: "offline start. The assigned technician opens the
 * checklist and captures photos with no signal, the hash is taken at capture,
 * and the queue replays in time order when signal returns. Prove the replay
 * order with a planted fault." With his answers 1 and 2 of the same night
 * (6717223376) on what the phone keeps and where the hash is taken.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs
 *
 *   A  the replay, RUN: replayQueue against a queue whose key order is the
 *      reverse of its time order, with a planted failure in the middle. It
 *      sends oldest first, stops at the failure, and sends nothing after it;
 *      and the checklist's flush is that function, not a loop of its own.
 *   B  the hash: the phone's sha256OfBlob agrees with Node's on the same bytes;
 *      the server compares it with its own hash of the stored bytes and refuses
 *      a mismatch before anything is written; a malformed hash is refused at
 *      the door.
 *   C  the day pack's rules: only his jobs, only in the field, only today or
 *      tomorrow or not yet scheduled; shown only to him and only under 48 hours.
 *   D  no money travels: the checklist props built from a job view that carries
 *      an offer and its amount contain neither, and the pack builder never
 *      reads the offer.
 *   E  the phone: the pack is replaced whole, kept apart from the capture queue,
 *      and forgotten at both sign outs; the offline screen shows only the pack
 *      for the technician it was rendered for.
 */
import { createHash } from "node:crypto";
import { readSource } from "../lib/read-source.mjs";

const queue = await import("../../src/lib/offline-queue.ts");
const day = await import("../../src/lib/field-day-rules.ts");
const props = await import("../../src/lib/job-checklist-props.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ----------------------------------------------- A, the replay, with a planted fault */

/* Keys sort z, y, x, w; times run w, x, y, z. A key-order replay would send z first. */
const entry = (id, minute, extra = {}) => ({
  id,
  fileId: "f",
  itemKey: `item_${id}`,
  kind: "photo",
  capturedAt: `2026-11-07T15:${String(minute).padStart(2, "0")}:00Z`,
  queuedAt: `2026-11-07T15:${String(minute).padStart(2, "0")}:01Z`,
  attempts: 0,
  ...extra,
});
const entries = [entry("cap_z", 40), entry("cap_y", 30), entry("cap_x", 20), entry("cap_w", 10)];
const sentOrder = [];
const dequeued = [];
const failed = [];
const PLANTED = "cap_x";
const result = await queue.replayQueue(
  entries,
  async (e) => {
    sentOrder.push(e.id);
    return e.id === PLANTED ? { ok: false, error: "planted fault: no signal" } : { ok: true };
  },
  async (e) => { dequeued.push(e.id); },
  async (e, error) => { failed.push(`${e.id}: ${error}`); },
);
check("A: it sends oldest first, not in key order", sentOrder[0] === "cap_w" && sentOrder[1] === "cap_x", sentOrder.join(", "));
check("A: it stops at the planted failure", result.stoppedAt === PLANTED && failed.length === 1 && failed[0].startsWith(PLANTED), JSON.stringify(result));
check("A: nothing after the failure is sent", !sentOrder.includes("cap_y") && !sentOrder.includes("cap_z"), sentOrder.join(", "));
check("A: only what was sent before it is dequeued", JSON.stringify(dequeued) === JSON.stringify(["cap_w"]), dequeued.join(", "));
const clean = [];
await queue.replayQueue(entries, async (e) => { clean.push(e.id); return { ok: true }; }, async () => {}, async () => {});
check("A: with no fault, the whole queue replays in time order", clean.join(",") === "cap_w,cap_x,cap_y,cap_z", clean.join(","));

const capture = readSource("src/app/portal/(app)/jobs/[id]/CaptureClient.tsx");
/* The flush function's own body, not the whole file: the preview builder above it also loops over the queue, and reads nothing out. */
const flushAt = capture.indexOf("const flush = useCallback(");
const flushBody = flushAt >= 0 ? capture.slice(flushAt, capture.indexOf("}, [fileId", flushAt)) : "";
check("A: the checklist's flush is replayQueue, so this is the loop that runs on the phone", /await replayQueue\(\s*pending,\s*flushOne,/.test(flushBody));
check("A: and it sends nothing itself, outside replayQueue", flushBody.length > 0 && !/await flushOne\(/.test(flushBody) && !/for \(const /.test(flushBody));

/* --------------------------------------------------------------------- B, the hash */

const bytes = new TextEncoder().encode("a photograph of a roof, standing in for the camera's bytes");
const phone = await queue.sha256OfBlob(new Blob([bytes]));
const node = createHash("sha256").update(bytes).digest("hex");
check("B: the phone's hash at capture is the SHA-256 of the bytes", phone === node, phone.slice(0, 16));

const field = readSource("src/lib/ops-field.ts");
const { captureHashMismatch: mismatch } = await import("../../src/lib/capture-hash.ts");
check("B: the same bytes pass", mismatch(node, node) === null);
check("B: case does not make a match a mismatch", mismatch(node.toUpperCase(), node) === null);
check("B: different bytes are refused, naming both fingerprints", typeof mismatch(node, "0".repeat(64)) === "string" && mismatch(node, "0".repeat(64)).includes(node.slice(0, 12)));
check("B: a capture from before the rule, with no hash, is recorded as before", mismatch(null, node) === null);

const rec = field.slice(field.indexOf("export async function recordCapture("), field.indexOf("export async function recordCapture(") + 20000);
const cmpAt = rec.indexOf("captureHashMismatch(input.captureSha256, contentSha256)");
const upsertAt = rec.indexOf('.from("eng_evidence_items")');
check("B: the server compares after hashing the stored bytes and before writing the row", cmpAt > rec.indexOf("contentSha256 = sha256Hex(") && upsertAt > cmpAt);
check("B: the server's own hash stays the record", rec.includes("content_sha256: contentSha256"));
const route = readSource("src/app/api/portal/field/route.ts");
const { SHA256_HEX } = await import("../../src/lib/capture-hash.ts");
check(
  "B: a malformed hash is refused at the door, not read as absent",
  route.includes("!SHA256_HEX.test(captureHash)") && SHA256_HEX.test(node) && !SHA256_HEX.test("2026-11-07T15:00:00Z") && !SHA256_HEX.test(node.slice(1)),
);
const capAt = capture.indexOf("captureSha256 = await sha256OfBlob(payload.blob)");
check("B: the phone hashes at capture, before the entry is queued", capAt > 0 && capture.indexOf("await enqueue(entry)", capAt) > capAt);

/* --------------------------------------------------------------- C, the pack's rules */

const me = "tech-a";
const today = "2026-11-08";
const tomorrow = day.nextCalendarDay(today);
const mine = { assigned_tech_id: me, status: "dispatched" };
check("C: tomorrow is the next calendar day", tomorrow === "2026-11-09" && day.nextCalendarDay("2026-12-31") === "2027-01-01" && day.nextCalendarDay("2027-03-13") === "2027-03-14");
check("C: his job visiting today is in", day.inDayPack(mine, me, today, today, tomorrow));
check("C: his job visiting tomorrow is in", day.inDayPack(mine, me, tomorrow, today, tomorrow));
check("C: his job with no visit time yet is in", day.inDayPack(mine, me, null, today, tomorrow));
check("C: his job visiting the day after tomorrow is out", !day.inDayPack(mine, me, "2026-11-10", today, tomorrow));
check("C: another technician's job is out", !day.inDayPack({ ...mine, assigned_tech_id: "tech-b" }, me, today, today, tomorrow));
check("C: a submitted job is out", !day.inDayPack({ ...mine, status: "evidence_submitted" }, me, today, today, tomorrow));
const pack = { techId: me, packedAt: "2026-11-08T12:00:00Z", jobs: [] };
const stored = Date.parse("2026-11-08T12:00:00Z");
check("C: shown to him within 48 hours", day.packUsable(pack, stored, me, stored + 47 * 3600 * 1000));
check("C: not shown at 48 hours", !day.packUsable(pack, stored, me, stored + 48 * 3600 * 1000));
check("C: never shown to another technician", !day.packUsable(pack, stored, "tech-b", stored + 1000));
check("C: not shown with a stored time in the future", !day.packUsable(pack, stored, me, stored - 1000));

/* ------------------------------------------------------------------- D, no money */

const view = {
  file: { id: "f", assigned_tech_id: me, file_number: "F-1", property_address: "1 Main", city: null, county: "Nueces", postal_code: null, service_slug: "roof", status: "dispatched", twia_county: true, evidence_due_at: null, notes: null },
  protocol: { name: "254-RC-001", version: "1.0", document_number: "254-RC-001", items: [{ id: "i1", itemKey: "k1", kind: "photo", label: "Roof", instructions: null, required: true, unit: null, minValue: null, maxValue: null, minCount: 1 }] },
  captures: [],
  exceptions: [],
  repairs: [],
  state: {},
  offer: { id: "o1", amountCents: 70900, state: "accepted" },
};
const json = JSON.stringify(props.checklistPropsFrom(view, {}));
const leaked = day.DAY_PACK_FORBIDDEN_KEYS.filter((k) => json.includes(`"${k}"`));
check("D: the checklist props built from a job view with an offer carry no money", leaked.length === 0 && !json.includes("70900"), leaked.join(", ") || "none");
const builderAt = field.indexOf("export async function dayPackFor(");
const builder = field.slice(builderAt, field.indexOf("\n}\n", builderAt));
check("D: the pack builder never reads the offer", builderAt > 0 && !/view\.offer|amountCents|amount_cents/.test(builder));
check("D: and reads only his own files, in the field", builder.includes('.eq("assigned_tech_id", actor.id)') && builder.includes(".in(\"status\", [...DAY_PACK_STATUSES])"));
check("D: a failed read refuses the whole pack rather than sending part of the day", builder.includes("if (!view) return { ok: false"));
const page = readSource("src/app/portal/(app)/jobs/[id]/page.tsx");
check("D: the job page renders from the same props, so the pack and the page cannot drift", page.includes("checklistPropsFrom(view, photoAnswers)") && page.includes("items={checklist.items}"));

/* ----------------------------------------------------------------------- E, the phone */

const store = readSource("src/lib/field-day-store.ts");
check("E: the pack is replaced whole on every refresh", /store\.put\(value, KEY\)/.test(store));
check("E: it is kept apart from the capture queue", store.includes('const DB_NAME = "eng-field-day";') && readSource("src/lib/offline-queue.ts").includes('const DB_NAME = "eng-field";'));
check("E: every read asks the 48 hour and owner rule", /packUsable\(stored\.pack, stored\.storedAtMs, techId, Date\.now\(\)\)/.test(store));
const chrome = readSource("src/components/portal/PortalChrome.tsx");
const signOut = readSource("src/components/portal/SignOutControl.tsx");
check("E: both sign outs forget the day before they end the session", [chrome, signOut].every((s) => s.indexOf("await forgetFieldDay();") > 0 && s.indexOf("await forgetFieldDay();") < s.indexOf('fetch("/api/portal/session", { method: "DELETE" })')));
const sync = readSource("src/components/portal/DayPackSync.tsx");
check("E: an ended session forgets the day", /res\.status === 401\) \{\s*await forgetFieldDay\(\);/.test(sync));
const offline = readSource("src/app/portal/(app)/jobs/offline/page.tsx");
const offlineDay = readSource("src/app/portal/(app)/jobs/offline/OfflineDay.tsx");
check("E: the offline screen is behind the technician's own grant", offline.includes('if (!actor || !can(actor, "offers.list_own")) notFound();'));
check("E: and reads the pack only for the technician it was rendered for", offline.includes("<OfflineDay techId={actor.id} />") && offlineDay.includes("readDayPack(techId)"));
check("E: it reads nothing from the database itself", !/supabase|jobView|dayPackFor/.test(offline));
check("E: offline capture is offered, removal is not", offlineDay.includes("readOnly={false}") && offlineDay.includes("canRemove={false}"));

console.log(wrong === 0 ? "PASS: a field day starts and replays with no signal." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
