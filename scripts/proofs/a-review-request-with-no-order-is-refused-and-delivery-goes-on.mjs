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
 * inOpenGateProcess, the child the gate fixture opens.
 *
 * THE FILE REACHES SEALED BY A SEAL ACT, NEVER BY ITS STATUS. Since 0110
 * (Robert's ruling Q6, 2026-11-02, applied on development that day) a file
 * cannot be marked sealed or delivered without a live letter seal act for a
 * determination on it. This proof used to insert its probe file straight at
 * "sealed", which 0110 refuses, so it failed on every board after the sitting
 * (P2's board 41535610791). The fixture now does what the database allows:
 * the file is inserted under review, then a probe evidence item, a pass
 * determination and a letter seal act are recorded against the permanent
 * development fixture engineer (fixtureEngineer(), licence 900000003, the one
 * account that exists for records which refuse deletion), with that engineer's
 * current seal and signature images (or a probe pair recorded for him the first
 * time). Only then is the file moved to sealed, and the delivery under test
 * moves it on. The same rows as migration-audit's 0053 replay fixture. It works
 * the same with or without 0110: the act simply exists first.
 *
 * WHAT STAYS. The determination, the seal act and their file refuse deletion by
 * design, so the probe file, its evidence item, its document and its act stay on
 * development, pinned to the fixture engineer exactly as the walks' sealed
 * records are, along with the file.transition rows in eng_audit_events. The
 * probe order and any orderless queue row this run made are removed and read
 * back.
 *
 * ONE SEALED FIXTURE FILE, MADE ONCE AND REUSED. Robert's answer of 2026-11-03:
 * "Review-request proof: seal one fixture file once and reuse it." Each run
 * used to make a new file, and a sealed file cannot be deleted, so one
 * unpriced, delivered demonstration file stayed behind per board; seven of
 * them pushed every priced file out of bulk-audit's sample (board 41606344690).
 * The file is now found by its fixed number, FIXTURE_FILE_NUMBER. Its evidence,
 * determination, document and letter seal act are recorded only when it has no
 * live letter act (the first run, or a first run that stopped part way). Each
 * run then puts it back at sealed, which 0110 allows because the act is live,
 * and the delivery under test moves it to delivered through transitionFile,
 * exactly as before. What stays per run is only telemetry and the audit trail;
 * the probe order is still made and removed every run, and a probe order an
 * earlier run failed to remove from this file is removed first, so the order
 * lookup under test reads this run's order alone. The earlier per-run files
 * (254-DEMO-RQ followed by six digits) are left exactly as they are.
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
/** The one sealed fixture file every run reuses. */
const FIXTURE_FILE_NUMBER = "254-DEMO-RQ-FIXTURE";
/** A probe order this proof makes, and only this proof: its email names it. */
const PROBE_EMAIL_PREFIX = "review-refusal-";
const PROBE_EMAIL_DOMAIN = "@audit-probe.invalid";
let fileId = null;
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

  /* The fixture file: found by its fixed number, made only the first time. */
  const { data: found, error: findErr } = await db
    .from("eng_files")
    .select("id, status")
    .eq("file_number", FIXTURE_FILE_NUMBER);
  if (findErr) throw new Error(`the fixture file could not be looked up: ${findErr.message}`);
  if ((found ?? []).length > 1) throw new Error(`${found.length} files carry ${FIXTURE_FILE_NUMBER}; expected one at most`);
  if ((found ?? []).length === 1) {
    fileId = found[0].id;
  } else {
    fileId = randomUUID();
    const { error: fErr } = await db.from("eng_files").insert({
      id: fileId,
      file_number: FIXTURE_FILE_NUMBER,
      is_demo: true,
      client_id: client.id,
      service_slug: "roof-inspections",
      property_address: "1 Review Refusal Way",
      county: "Kenedy",
      status: "under_review",
    });
    if (fErr) throw new Error(`fixture file: ${fErr.message}`);
  }

  /* Does it already carry a live letter seal act (made by an earlier run)? */
  const { data: liveActs, error: actReadErr } = await db
    .from("eng_seal_acts")
    .select("id, eng_determinations!inner(file_id)")
    .eq("kind", "letter")
    .is("voided_at", null)
    .eq("eng_determinations.file_id", fileId);
  if (actReadErr) throw new Error(`the fixture file's seal acts could not be read: ${actReadErr.message}`);
  const hasLiveAct = (liveActs ?? []).length > 0;
  console.log(`  note: fixture file ${FIXTURE_FILE_NUMBER} ${(found ?? []).length === 1 ? "reused" : "made this run"}, ${hasLiveAct ? "its live letter act reused" : "its letter act recorded this run"}`);

  /* The seal act that lets the file be sealed (0110), against the fixture engineer, recorded once. */
  if (!hasLiveAct) {
  const { fixtureEngineer } = await import("../lib/portal-probe.mjs");
  const fixture = await fixtureEngineer("the review request refusal proof");
  if (!fixture.ok) throw new Error(`the fixture engineer: ${fixture.error}`);
  const currentImage = async (kind) => {
    const { data, error } = await db
      .from("eng_seal_images")
      .select("id")
      .eq("profile_id", fixture.id)
      .eq("kind", kind)
      .is("superseded_at", null)
      .maybeSingle();
    if (error) throw new Error(`the fixture engineer's ${kind} image could not be read: ${error.message}`);
    if (data) return data.id;
    const id = randomUUID();
    const hex = kind === "seal" ? "c" : "d";
    const { error: iErr } = await db.from("eng_seal_images").insert({
      id,
      profile_id: fixture.id,
      kind,
      storage_key: `probe/fixture-engineer-${kind}.png`,
      sha256: hex.repeat(64),
      byte_size: 1000,
      width: 600,
      height: kind === "seal" ? 600 : 200,
      mfa_verified_at: new Date().toISOString(),
    });
    if (iErr) throw new Error(`a ${kind} image for the fixture engineer: ${iErr.message}`);
    return id;
  };
  const sealImage = await currentImage("seal");
  const signatureImage = await currentImage("signature");
  const evidenceId = randomUUID();
  const { error: eErr } = await db.from("eng_evidence_items").insert({ id: evidenceId, file_id: fileId, item_key: "probe", kind: "note" });
  if (eErr) throw new Error(`probe evidence: ${eErr.message}`);
  const determinationId = randomUUID();
  const { error: dErr } = await db.from("eng_determinations").insert({
    id: determinationId,
    file_id: fileId,
    protocol_document: "254-RC-001",
    determination: "pass",
    relied_on_item_keys: ["probe"],
    relied_on_evidence_ids: [evidenceId],
    engineer_id: fixture.id,
  });
  if (dErr) throw new Error(`probe determination: ${dErr.message}`);
  const documentId = randomUUID();
  const { error: docErr } = await db.from("eng_documents").insert({
    id: documentId,
    file_id: fileId,
    kind: "deliverable",
    title: "Probe sealed letter for the review request refusal proof",
    bucket: "docs",
    storage_key: `probe/review-refusal-${STAMP}`,
  });
  if (docErr) throw new Error(`probe document: ${docErr.message}`);
  const { error: aErr } = await db.from("eng_seal_acts").insert({
    id: randomUUID(),
    kind: "letter",
    document_id: documentId,
    determination_id: determinationId,
    content_sha256: "e".repeat(64),
    letterhead_sha256: "f".repeat(64),
    seal_image_id: sealImage,
    signature_image_id: signatureImage,
    sealed_by: fixture.id,
    mfa_verified_at: new Date().toISOString(),
  });
  if (aErr) throw new Error(`probe seal act: ${aErr.message}`);
  }

  /*
   * Back to sealed, so the delivery under test starts where a real one does.
   * From under_review on the first run, from delivered on every later one; 0110
   * allows the move because the letter act above is live. delivered_at is
   * cleared so the row reads as a sealed file that has not been delivered.
   */
  const { data: current, error: curErr } = await db.from("eng_files").select("status, sealed_at").eq("id", fileId).single();
  if (curErr || !current) throw new Error(`the fixture file could not be read back: ${curErr?.message ?? "no row"}`);
  if (current.status !== "sealed") {
    const { data: sealedRows, error: sErr } = await db
      .from("eng_files")
      .update({ status: "sealed", sealed_at: current.sealed_at ?? new Date().toISOString(), delivered_at: null })
      .eq("id", fileId)
      .eq("status", current.status)
      .select("id");
    if (sErr || (sealedRows ?? []).length !== 1) throw new Error(`the fixture file could not be put back at sealed from ${current.status}: ${sErr?.message ?? "no row moved"}`);
  }

  /*
   * A probe order an earlier run made on this file and failed to remove would be
   * a second order for the lookup under test. Only this proof's own probe orders
   * are removed (demonstration, and an email only this proof writes), then the
   * file is read back as carrying no order before this run's is made.
   */
  const { data: staleOrders, error: staleErr } = await db
    .from("eng_service_orders")
    .select("id, customer_email, is_demo")
    .eq("file_id", fileId);
  if (staleErr) throw new Error(`the fixture file's orders could not be read: ${staleErr.message}`);
  const ownStale = (staleOrders ?? []).filter(
    (o) => o.is_demo === true && String(o.customer_email ?? "").startsWith(PROBE_EMAIL_PREFIX) && String(o.customer_email ?? "").endsWith(PROBE_EMAIL_DOMAIN),
  );
  if (ownStale.length !== (staleOrders ?? []).length) {
    throw new Error(`the fixture file carries ${(staleOrders ?? []).length - ownStale.length} order(s) this proof did not make; refusing to touch them`);
  }
  if (ownStale.length > 0) {
    const { error: delErr } = await db.from("eng_service_orders").delete().in("id", ownStale.map((o) => o.id));
    if (delErr) throw new Error(`an earlier run's probe order could not be removed: ${delErr.message}`);
    console.log(`  note: removed ${ownStale.length} probe order(s) an earlier run left on the fixture file`);
  }
  const { count: ordersLeft } = await db.from("eng_service_orders").select("id", { count: "exact", head: true }).eq("file_id", fileId);
  if ((ordersLeft ?? 0) !== 0) throw new Error(`the fixture file still carries ${ordersLeft} order(s) before this run's`);

  const { data: order, error: oErr } = await db
    .from("eng_service_orders")
    .insert({
      site: "254engineering",
      reference: `254-DEMO-${String(STAMP).slice(-8)}`,
      service_slug: "roof-inspections",
      order_type: "desk",
      status: "complete",
      customer_name: "Review refusal proof customer, not a real person",
      customer_email: `${PROBE_EMAIL_PREFIX}${STAMP}${PROBE_EMAIL_DOMAIN}`,
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
  /* The fixture file stays for the next run: its determination and seal act refuse deletion (header). */
  if (fileId) console.log(`  note: the fixture file ${FIXTURE_FILE_NUMBER} (${fileId}) stays on development for the next run, pinned to the fixture engineer`);
  const { data: leftOrder } = orderId ? await db.from("eng_service_orders").select("id").eq("id", orderId) : { data: [] };
  check(
    "the probe order is removed, read back",
    (leftOrder ?? []).length === 0,
    `${(leftOrder ?? []).length} order(s) left`,
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
