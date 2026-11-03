/**
 * PROOF: THE FIELD AUDIT'S LOW FINDINGS ARE CLOSED.
 *
 * The chat counterpart's field and seal audit of 2026-11-02 (issue #1 comment
 * 6585008833), low findings, built under Robert's ruling of the same day:
 *
 *   F17  the pay period and the fee schedule's "today" were UTC dates; they are
 *        the firm's calendar (America/Chicago).
 *   F18  the offline queue replayed in IndexedDB key order (cap_<uuid>, random)
 *        and the online listener held a stale flush whose guard never tripped;
 *        it replays in queued order and the guard reads a ref.
 *   F19  the single file dispatch accepted a negative or zero expiry window,
 *        so offers could be born expired; it is bounded like the bulk route.
 *
 * F9 (medium, a letter's visit date taken from a clock recorded as disagreeing)
 * is not built here: refusing a draft changes when a letter can be sealed, so
 * it is a question for Robert.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-field-low-findings-hold.mjs
 */
import { readFileSync } from "node:fs";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

// F17
const field = readFileSync("src/lib/ops-field.ts", "utf8");
const feeAt = field.indexOf("async function techFeeFor(");
const feeBody = field.slice(feeAt, field.indexOf("\n}\n", feeAt));
check("the fee schedule's today is the firm's day", /const today = todayInFirmCalendar\(\);/.test(feeBody) && !/toISOString\(\)\.slice\(0, 10\)/.test(feeBody));
check("the pay ledger's period is the firm's month", field.includes("period: todayInFirmCalendar().slice(0, 7),") && !field.includes("period: new Date().toISOString().slice(0, 7),"));
const { todayInFirmCalendar } = await import("../../src/lib/firm-calendar.ts");
const lateOnTheLastDay = new Date("2026-11-01T01:30:00Z"); // 7:30 PM Central on 31 October
check("7:30 PM Central on 31 October books to October", todayInFirmCalendar(lateOnTheLastDay).slice(0, 7) === "2026-10", todayInFirmCalendar(lateOnTheLastDay));

// F18
const { inQueueOrder } = await import("../../src/lib/offline-queue.ts");
const entries = [
  { id: "cap_zzz", fileId: "f", itemKey: "a", kind: "photo", capturedAt: "2026-11-02T10:00:00Z", queuedAt: "2026-11-02T10:00:01Z", attempts: 0 },
  { id: "cap_aaa", fileId: "f", itemKey: "a", kind: "photo", capturedAt: "2026-11-02T10:05:00Z", queuedAt: "2026-11-02T10:05:01Z", attempts: 0, exception: { kind: "not_observed", reason: "x" } },
  { id: "cap_mmm", fileId: "f", itemKey: "b", kind: "photo", capturedAt: "2026-11-02T09:00:00Z", attempts: 0 },
];
const order = inQueueOrder(entries).map((e) => e.id);
check("the queue replays in queued order, not key order", order.join(",") === "cap_mmm,cap_zzz,cap_aaa", order.join(","));
check("an entry queued before the field existed falls back to its capture time", order[0] === "cap_mmm");
const queue = readFileSync("src/lib/offline-queue.ts", "utf8");
check("enqueue stamps queuedAt", /queuedAt: new Date\(\)\.toISOString\(\)/.test(queue));
check("pendingFor returns the queue in order", /return inQueueOrder\(all\.filter/.test(queue));
const client = readFileSync("src/app/portal/(app)/jobs/[id]/CaptureClient.tsx", "utf8");
check("the flush guard reads a ref", /if \(flushingRef\.current\) return;/.test(client) && !/if \(flushing\) return;/.test(client));
check("the online listener calls the latest flush", /void flushRef\.current\(\);/.test(client) && !/const up = \(\) => \{\s*setOnline\(true\);\s*void flush\(\);/.test(client));

// F19
const route = readFileSync("src/app/api/portal/field/route.ts", "utf8");
const sendAt = route.indexOf('action === "send_offers"');
const sendBody = route.slice(sendAt, sendAt + 900);
check("the single dispatch bounds its window above zero", /hours !== null && Number\.isFinite\(hours\) && hours > 0 \? hours : undefined/.test(sendBody), sendBody.slice(0, 80));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(failed === 0 ? "PASS: the field audit's low findings hold: the firm's calendar, the queue's order, a live guard and a bounded window." : `FAIL: ${failed} check(s).`);
process.exitCode = failed === 0 ? 0 : 1;
