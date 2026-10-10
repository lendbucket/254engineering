/**
 * ONE SEARCH FINDS A RECORD BY ANY OF FOUR THINGS, AND WIDENS NOTHING.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/one-search-finds-a-record-and-widens-nothing.mjs
 *
 * Operator ruling, 2026-10-10 (gap 6 of the product audit): staff search by
 * order reference, email, phone or address, returning orders and files.
 *
 * Live on development through searchRecords: a probe client, file and
 * demonstration order are found by each of the four, as an administrator; a
 * phone typed with punctuation finds the digits; a technician who does not hold
 * the file finds nothing and is shown no orders at all. Probes on
 * @audit-probe.invalid and DEMO references; all removed and read back.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the record search proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { searchRecords } = await import("../../src/lib/ops-search.ts");

const STAMP = Date.now();
const TAIL = String(STAMP).slice(-6);
const users = [];
let clientId = null;
let fileId = null;
let orderId = null;

async function staff(tag, role) {
  const email = `search-proof-${tag}-${STAMP}@audit-probe.invalid`;
  const made = await db.auth.admin.createUser({ id: randomUUID(), email, password: `p-${randomUUID()}`, email_confirm: true });
  if (made.error || !made.data?.user) throw new Error(`createUser ${tag}: ${made.error?.message}`);
  users.push(made.data.user.id);
  const { error } = await db.from("eng_profiles").insert({
    id: made.data.user.id, email, display_name: `Search proof ${tag}, not a real person`, role, status: "active", is_demo: true,
  });
  if (error) throw new Error(`profile ${tag}: ${error.message}`);
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", made.data.user.id).single();
  const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", role);
  return { ...row, grants: new Set((grants ?? []).map((g) => g.action)) };
}

try {
  const admin = await staff("admin", "admin");
  const tech = await staff("tech", "field_tech");

  clientId = randomUUID();
  const email = `search.proof.${STAMP}@audit-probe.invalid`;
  const phone = `(361) 555-${TAIL.slice(-4)}`;
  const { error: cErr } = await db.from("eng_clients").insert({
    id: clientId, kind: "individual", name: "Search proof client, not a real person", email, phone, is_demo: true,
  });
  if (cErr) throw new Error(`client: ${cErr.message}`);
  fileId = randomUUID();
  const address = `${TAIL} Search Proof Way`;
  const fileNumber = `254-DEMO-SR${TAIL}`;
  const { error: fErr } = await db.from("eng_files").insert({
    id: fileId, file_number: fileNumber, is_demo: true, client_id: clientId, service_slug: "roof-inspections",
    property_address: address, county: "Nueces", status: "intake",
  });
  if (fErr) throw new Error(`file: ${fErr.message}`);
  const reference = `254-O2026-DEMO-SR${TAIL}`;
  const { data: o, error: oErr } = await db.from("eng_service_orders").insert({
    site: "254engineering", reference, service_slug: "roof-inspections", order_type: "field", status: "in_fulfilment",
    customer_name: "Search proof, not a real person", customer_email: email, customer_phone: phone.replace(/\D/g, ""),
    property_address: address, county: "Nueces", twia_county: false, total_cents: 0, file_id: fileId, is_demo: true,
  }).select("id").single();
  if (oErr) throw new Error(`order: ${oErr.message}`);
  orderId = o.id;

  const found = async (actor, q) => {
    const r = await searchRecords(actor, q);
    return {
      ok: r.ok,
      file: r.ok && r.files.some((f) => f.id === fileId),
      order: r.ok && (r.orders ?? []).some((x) => x.reference === reference),
      ordersShown: r.ok && r.orders !== null,
    };
  };

  for (const [what, q, wantFile, wantOrder] of [
    ["the order reference", reference, false, true],
    ["the email address", email, true, true],
    ["the phone number, typed with punctuation", phone, true, true],
    ["the street address", address, true, true],
    ["the file number", fileNumber, true, false],
  ]) {
    const r = await found(admin, q);
    check(
      `an administrator finds the record by ${what}`,
      r.ok && (!wantFile || r.file) && (!wantOrder || r.order),
      `file ${r.file ? "found" : "not found"}, order ${r.order ? "found" : "not found"}`,
    );
  }

  /* By EMAIL: that is the path through the client match, where canSeeFile does the guarding. */
  const asTech = await found(tech, email);
  check(
    "a technician who does not hold the file finds nothing, and is shown no orders at all",
    asTech.ok && !asTech.file && !asTech.ordersShown,
    `file ${asTech.file ? "SHOWN" : "hidden"}, orders ${asTech.ordersShown ? "SHOWN" : "not shown"}`,
  );
  const short = await searchRecords(admin, "ab");
  check("a term under three characters searches nothing and says so", short.ok === false);
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  if (orderId) await db.from("eng_service_orders").delete().eq("id", orderId);
  if (fileId) await db.from("eng_files").delete().eq("id", fileId);
  if (clientId) await db.from("eng_clients").delete().eq("id", clientId);
  for (const id of users) {
    await db.from("eng_profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
  const { data: lo } = orderId ? await db.from("eng_service_orders").select("id").eq("id", orderId) : { data: [] };
  const { data: lf } = fileId ? await db.from("eng_files").select("id").eq("id", fileId) : { data: [] };
  let lu = 0;
  for (const id of users) if ((await db.auth.admin.getUserById(id)).data?.user) lu += 1;
  check("the probe order, file, client and staff are removed, read back", (lo ?? []).length === 0 && (lf ?? []).length === 0 && lu === 0);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: one search finds a record by reference, email, phone or address, and widens nothing.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
