/**
 * A REVIEW REQUEST WITH NO ORDER IS REFUSED, AND THE DELIVERY GOES ON.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-review-request-with-no-order-is-refused-and-delivery-goes-on.mjs
 *
 * Operator ruling, 2026-10-12. review.request keyed on `String(p.orderId ?? "")`,
 * so a request queued without an order got the bare key `review-request:`, and
 * every such request after the first would have been deduplicated away against
 * it without a word. The key now refuses, enqueue records the refusal, and the
 * operation that queued the request is never failed by it.
 *
 * Two halves, both live on development:
 *
 *   1. enqueue("review.request", {}) is refused naming orderId, writes no queue
 *      row, and leaves a fault on record naming the field.
 *   2. A REAL delivery, through transitionFile, the one door to delivered, of a
 *      probe file whose order comes back with its id withheld. The order lookup
 *      is answered without `id` by wrapping fetch in a child process, so the
 *      product code runs unaltered and meets exactly the payload the ruling
 *      names. The file must reach delivered, no row may be queued, and the
 *      refusal must be on record.
 *
 * Delivery is gated while the firm is prelaunch, so the second half runs in
 * inOpenGateProcess, the child the gate fixture opens. Every probe row is
 * removed and read back, except the one file.transition row the delivery writes
 * to eng_audit_events, which refuses deletes by design, as every audit that
 * moves a file leaves.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ROUTE = "enqueue:review.request";

const { auditClient } = await import("../lib/db-target.mjs");
const db = auditClient("the review request refusal proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so nothing ran.");
  process.exit(3);
}

/** Queue rows for review.request that carry no order id. */
const orderlessRows = async () => {
  const { count, error } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "review.request")
    .is("payload->>orderId", null);
  if (error) throw new Error(`could not count orderless review.request rows: ${error.message}`);
  return count ?? 0;
};

/** Ids of those rows, so a run that wrongly queues one removes only its own. */
const orderlessIds = async () => {
  const { data, error } = await db
    .from("eng_jobs")
    .select("id")
    .eq("kind", "review.request")
    .is("payload->>orderId", null)
    .limit(1000);
  if (error) throw new Error(`could not list orderless review.request rows: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id));
};

/** Faults recorded by the refusal, and the newest one's message. */
const refusals = async () => {
  const { data, count, error } = await db
    .from("eng_error_events")
    .select("message, extra", { count: "exact" })
    .eq("route", ROUTE)
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`could not read the refusal faults: ${error.message}`);
  return { count: count ?? 0, latest: (data ?? [])[0] ?? null };
};

const STAMP = Date.now();
const fileId = randomUUID();
let fileMade = false;
let orderId = null;
let preexisting = new Set();

try {
  preexisting = await orderlessIds();

  // ---------------------------------------------------------- 1. enqueue alone
  const { enqueue } = await import("../../src/lib/ops-jobs.ts");
  const rowsBefore = await orderlessRows();
  const faultsBefore = await refusals();

  let bare;
  try {
    bare = await enqueue("review.request", {}, { effectMode: "no_external_effect" });
  } catch (err) {
    bare = { ok: false, error: "", threw: err instanceof Error ? err.message : String(err) };
  }
  check("enqueue answers the refusal rather than throwing it", bare.threw === undefined, bare.threw ? `threw: ${bare.threw}` : "returned");
  check("enqueue refuses a review.request with no orderId", bare.ok === false, bare.ok ? `queued as row ${bare.id}` : bare.error);
  check("and the refusal names the missing field", !bare.ok && /orderId/.test(bare.error), bare.ok ? "" : bare.error);
  check("and writes no queue row", (await orderlessRows()) === rowsBefore);
  const faultsAfter = await refusals();
  check(
    "and a fault is on record naming orderId",
    faultsAfter.count === faultsBefore.count + 1 && /orderId/.test(faultsAfter.latest?.message ?? ""),
    `${faultsAfter.count - faultsBefore.count} new, "${faultsAfter.latest?.message ?? "none"}"`,
  );

  // ------------------------------------------------ 2. a real delivery goes on
  const { data: client } = await db.from("eng_clients").select("id").eq("is_demo", true).limit(1).maybeSingle();
  if (!client) throw new Error("development holds no demonstration client to hang a file on");

  const { error: fErr } = await db.from("eng_files").insert({
    id: fileId,
    file_number: `254-DEMO-RQ${String(STAMP).slice(-6)}`,
    is_demo: true,
    client_id: client.id,
    service_slug: "roof-inspections",
    property_address: "1 Review Refusal Way",
    county: "Kenedy",
    status: "sealed",
  });
  if (fErr) throw new Error(`probe file: ${fErr.message}`);
  fileMade = true;

  const { data: order, error: oErr } = await db
    .from("eng_service_orders")
    .insert({
      site: "254engineering",
      reference: `254-DEMO-${String(STAMP).slice(-8)}`,
      service_slug: "roof-inspections",
      order_type: "desk",
      status: "complete",
      customer_name: "Review refusal proof customer, not a real person",
      customer_email: `review-refusal-${STAMP}@audit-probe.invalid`,
      property_address: "1 Review Refusal Way",
      county: "Kenedy",
      is_demo: true,
      file_id: fileId,
    })
    .select("id")
    .single();
  if (oErr || !order) throw new Error(`probe order: ${oErr?.message}`);
  orderId = order.id;

  const rowsBeforeDelivery = await orderlessRows();
  const faultsBeforeDelivery = await refusals();

  const { inOpenGateProcess } = await import("../lib/gate-fixture.mjs");
  const child = await inOpenGateProcess(
    `const FILE_ID = ${JSON.stringify(fileId)};\n` +
      `const realFetch = globalThis.fetch;\n` +
      `let withheld = 0;\n` +
      `globalThis.fetch = async (input, init) => {\n` +
      `  const res = await realFetch(input, init);\n` +
      `  const url = typeof input === "string" ? input : (input && input.url) || String(input);\n` +
      `  const method = String((init && init.method) || "GET").toUpperCase();\n` +
      `  if (method === "GET" && url.includes("/rest/v1/eng_service_orders") && url.includes("file_id=eq." + FILE_ID)) {\n` +
      `    const rows = await res.json();\n` +
      `    withheld += 1;\n` +
      `    const out = Array.isArray(rows) ? rows.map(({ id, ...rest }) => rest) : rows;\n` +
      `    const headers = new Headers(res.headers);\n` +
      `    headers.delete("content-length");\n` +
      `    headers.delete("content-encoding");\n` +
      `    return new Response(JSON.stringify(out), { status: res.status, headers });\n` +
      `  }\n` +
      `  return res;\n` +
      `};\n` +
      `const { transitionFile, SYSTEM_AUTHOR } = await import("./src/lib/ops-crm.ts");\n` +
      `let result;\n` +
      `try {\n` +
      `  result = await transitionFile(SYSTEM_AUTHOR, FILE_ID, "delivered", "review request refusal proof: delivered with the order id withheld");\n` +
      `} catch (err) {\n` +
      `  result = { ok: false, error: "the delivery threw: " + (err instanceof Error ? err.message : String(err)) };\n` +
      `}\n` +
      `answer({ result, withheld });\n`,
  );

  check("the order lookup really was answered without its id", child.withheld > 0, `${child.withheld} lookup(s) withheld`);
  check("the delivery returns ok", child.result?.ok === true, child.result?.ok ? "ok" : child.result?.error);
  const { data: delivered } = await db.from("eng_files").select("status").eq("id", fileId).single();
  check("and the file is delivered", delivered?.status === "delivered", `status ${delivered?.status}`);
  check("and no review.request row was queued without an order", (await orderlessRows()) === rowsBeforeDelivery);
  const { count: forOrder } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .eq("kind", "review.request")
    .eq("payload->>orderId", orderId);
  check("nor one for the probe order under its real id", (forOrder ?? 0) === 0, `${forOrder ?? 0} row(s)`);
  const faultsAfterDelivery = await refusals();
  check(
    "and the refusal is on record, naming orderId",
    faultsAfterDelivery.count === faultsBeforeDelivery.count + 1 && /orderId/.test(faultsAfterDelivery.latest?.message ?? ""),
    `${faultsAfterDelivery.count - faultsBeforeDelivery.count} new`,
  );
} catch (err) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${err instanceof Error ? err.message : String(err)})`);
} finally {
  /* Only when the refusal is broken does a run queue an orderless row; it is
   * this run's own, on a telemetry table, and is removed. */
  const strays = [...(await orderlessIds().catch(() => new Set()))].filter((id) => !preexisting.has(id));
  if (strays.length > 0) {
    const { error } = await db.from("eng_jobs").delete().in("id", strays);
    console.log(`  note: removed ${strays.length} orderless review.request row(s) this run queued${error ? `, with an error: ${error.message}` : ""}`);
  }
  if (orderId) {
    const { error } = await db.from("eng_service_orders").delete().eq("id", orderId);
    if (error) console.log(`  note: the probe order was not removed: ${error.message}`);
  }
  if (fileMade) {
    const { error } = await db.from("eng_files").delete().eq("id", fileId);
    if (error) console.log(`  note: the probe file was not removed: ${error.message}`);
  }
  const { data: leftFile } = await db.from("eng_files").select("id").eq("id", fileId);
  const { data: leftOrder } = orderId ? await db.from("eng_service_orders").select("id").eq("id", orderId) : { data: [] };
  check(
    "the probe file and order are removed, read back",
    (leftFile ?? []).length === 0 && (leftOrder ?? []).length === 0,
    `${(leftFile ?? []).length} file(s), ${(leftOrder ?? []).length} order(s) left`,
  );
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a review request with no order is refused, and the delivery goes on.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
