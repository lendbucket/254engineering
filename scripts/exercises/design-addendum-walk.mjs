// @runtime react-server
// A DESIGN JOB'S SCOPE ADDENDUM ON DEVELOPMENT, FROM UNSIGNED TO SIGNED TO PAID TO VOIDED. Operator rulings of 2026-10-22, 0082.
//
//   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/exercises/design-addendum-walk.mjs
//
// Proves the app path a design job's addendum takes, with INVENTED DATA ONLY (operator ruling): a fictional
// address, @audit-probe.invalid contacts, and a test engineer who exists ONLY in this process, appended to the
// register in memory as order-path-walk-child.mjs does. The engineer signs through src/lib/scope-addendum.ts with a
// real code from his own authenticator, exactly as Aman will in the portal. Needs 0082 on development.
//
// What it leaves, and why: the addendum, its seal acts and the audit rows refuse deletion by design, so they stay,
// labelled as test data; the test accounts are suspended on the way out. No email, SMS or payment leaves.
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";

/*
 * REFUSES TO RUN UNTIL IT RECORDS AGAINST THE FIXTURE ENGINEER. Operator ruling
 * 1 of 2026-10-23. This walk's two runs on 2026-10-23 each made a fresh probe
 * engineer and recorded a scope addendum and seal acts against it, records
 * that refuse deletion, so both accounts can never be swept (they are now on
 * KEPT_PROBES by name). Every walk that makes such records must use the one
 * permanent fixture engineer (fixtureEngineer in scripts/lib/portal-probe.mjs),
 * and this one does not yet: its engineer enrols a fresh second factor and
 * uploads seal images on each run, which a permanent account cannot repeat
 * as written. Until it is moved onto the fixture, it does not run.
 */
throw new Error(
  "design-addendum-walk refuses to run: it still makes a fresh probe engineer, and records that refuse deletion must be made against the fixture engineer (ruling 1 of 2026-10-23).",
);

const ROOT = new URL("../../", import.meta.url).href;
const { auditClient } = await import(ROOT + "scripts/lib/db-target.mjs");
const db = auditClient("design addendum walk", { neverProduction: true });
if (!db) throw new Error("no development client");

const { verifiedEngineers } = await import(ROOT + "src/config/credentials.ts");
const mfa = await import(ROOT + "src/lib/ops-mfa.ts");
const totp = await import(ROOT + "src/lib/totp.ts");
const { uploadSealImage } = await import(ROOT + "src/lib/seal-store.ts");
const { signAddendum, designPayFor, addendaFor } = await import(ROOT + "src/lib/scope-addendum.ts");
const { productionCreditFor } = await import(ROOT + "src/lib/ops-engineer.ts");

const STAMP = Date.now().toString(36);
const LABEL = "Addendum Walk";
const TEST_ENGINEER = {
  name: "Addendum Walk Engineer, not a real person",
  /* Digits in the probe range no Texas licence can hold (nine digits from 900), for 0089's digits-only doors (2026-10-25). */
  licenseNumber: "900000002",
  disciplines: ["Civil"],
  sealsOnly: ["structural"],
  granted: "2020-01-01",
  status: "Active",
  employersOnRoster: ["254 Engineering LLC"],
  expires: "2099-12-31",
  verified: "2026-10-22",
};
const made = { profiles: [], quotes: [], addenda: [], clients: [], files: [], orders: [] };
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const stop = async (s) => {
  console.log(`WALK STOPPED: ${s}`);
  for (const p of made.profiles) await db.from("eng_profiles").update({ status: "suspended" }).eq("id", p.id);
  console.log(`WALK MADE ${JSON.stringify(made)}`);
  process.exit(1);
};

/* A plain two-tone PNG the seal store accepts, and plainly not a seal. */
function png(w, h, seed) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    const row = Buffer.alloc(w + 1);
    for (let x = 0; x < w; x += 1) row[x + 1] = ((x + y + seed) >> 4) % 2 ? 200 : 60;
    rows.push(row);
  }
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]),
  );
}
async function grantsFor(role) {
  const { data, error } = await db.from("eng_role_grants").select("action").eq("role_key", role);
  if (error) await stop(`grants for ${role}: ${error.message}`);
  return new Set((data ?? []).map((r) => r.action));
}
async function staffProbe(role, extra = {}) {
  const email = `addendum-walk-${role}-${STAMP}@audit-probe.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, password: `walk-${randomUUID()}`, email_confirm: true });
  if (error || !data?.user) await stop(`createUser ${role}: ${error?.message}`);
  const id = data.user.id;
  const { error: pErr } = await db.from("eng_profiles").insert({
    id, email, display_name: `${LABEL} ${role}, not a real person`, role, status: "active", is_demo: true, ...extra,
  });
  if (pErr) await stop(`profile ${role}: ${pErr.message}`);
  made.profiles.push({ id, role, email });
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", id).single();
  return { ...row, grants: await grantsFor(role) };
}
async function nextStep(last) {
  while (totp.stepAt(Date.now()) <= last) await new Promise((r) => setTimeout(r, 1000));
  return totp.stepAt(Date.now());
}

// ---------------------------------------------------------------- 1. the engineer, in this process only
verifiedEngineers.push(TEST_ENGINEER);
const engineer = await staffProbe("engineer", { license_number: TEST_ENGINEER.licenseNumber });
const begun = await mfa.beginEnrolment(engineer.id, engineer.email);
if (!begun.ok) await stop(`MFA begin: ${begun.error}`);
const secret = totp.base32Decode(begun.secret);
let step = totp.stepAt(Date.now());
const confirmed = await mfa.confirmEnrolment(engineer.id, totp.codeForStep(secret, step));
if (!confirmed.ok) await stop(`MFA confirm: ${confirmed.error}`);
for (const [kind, w, h] of [["seal", 600, 600], ["signature", 800, 300]]) {
  step = await nextStep(step);
  const up = await uploadSealImage({ actor: engineer, kind, bytes: png(w, h, kind === "seal" ? 0 : 7), code: totp.codeForStep(secret, step) });
  if (!up.ok) await stop(`${kind} image: ${up.error}`);
}
console.log(`WALK engineer ${engineer.id} enrolled, with test pattern images`);

// ---------------------------------------------------------------- 2. an invented design quote and its addendum
const { data: quote, error: qErr } = await db
  .from("eng_quote_requests")
  .insert({
    site: "254engineering", reference: `254-Q-WALK-${STAMP}`, service_slug: "residential-light-commercial-design", tier: "custom-package",
    customer_name: `${LABEL} contact, not a real person`, customer_email: `addendum-walk-contact-${STAMP}@audit-probe.invalid`,
    property_address: "200 Invented Avenue", city: "Nowhere", county: "Fictional",
    quoted_cents: 200000, scope: "Framing check, attachment and uplift calculation, sealed letter.", status: "sent",
    notes: `${LABEL}: test data, invented, never a real job`,
  })
  .select("id, reference")
  .single();
if (qErr) await stop(`quote: ${qErr.message}`);
made.quotes.push(quote.id);
const { data: addendum, error: aErr } = await db
  .from("eng_scope_addenda")
  .insert({
    quote_id: quote.id, deliverable: "residential-light-commercial-design/custom-package", engineer_id: engineer.id,
    scope: "Framing check, attachment and uplift calculation, sealed letter.", fee_cents: 200000, share_bp: 3500, pay_cents: 70000,
  })
  .select("id, addendum_text, content_sha256")
  .single();
if (aErr) await stop(`addendum: ${aErr.message}`);
made.addenda.push(addendum.id);
console.log(`WALK quote ${quote.reference}, addendum ${addendum.id}`);

// ---------------------------------------------------------------- 3. unsigned pays nothing
{
  const pay = await designPayFor(quote.id);
  check("an unsigned addendum pays nothing, and says why", !pay.ok && /no scope addendum signed/.test(pay.reason), pay.ok ? `PAID ${pay.cents}` : pay.reason);
  const listed = await addendaFor(engineer.id);
  check("and it is listed for the engineer to read and sign", listed.ok && listed.addenda.some((a) => a.id === addendum.id && a.signature.state === "unsigned"));
}

// ---------------------------------------------------------------- 4. a design job whose order came from the quote
const { data: client } = await db.from("eng_clients").insert({ kind: "individual", name: `${LABEL} client, not a real person`, is_demo: true }).select("id").single();
made.clients.push(client.id);
const { data: file, error: fErr } = await db
  .from("eng_files")
  .insert({
    /* is_demo and the -DEMO- segment agree, or eng_files_demo_number_agrees (0027) refuses the row. */
    file_number: `254-DEMO-WALK-D-${STAMP}`, client_id: client.id, service_slug: "residential-light-commercial-design", deliverable: "custom-package",
    property_address: "200 Invented Avenue", county: "Fictional", status: "under_review", is_demo: true,
  })
  .select("id, service_slug, deliverable")
  .single();
if (fErr) await stop(`file: ${fErr.message}`);
made.files.push(file.id);
const { data: ord, error: oErr } = await db
  .from("eng_service_orders")
  .insert({
    site: "254engineering", reference: `254-O-DEMO-WALK-${STAMP}`, service_slug: "residential-light-commercial-design", tier: "custom-package",
    order_type: "quote", status: "in_fulfilment", customer_name: `${LABEL} contact, not a real person`,
    customer_email: `addendum-walk-contact-${STAMP}@audit-probe.invalid`, property_address: "200 Invented Avenue", county: "Fictional",
    twia_county: false, total_cents: 200000, file_id: file.id, is_demo: true,
  })
  .select("id")
  .single();
if (oErr) await stop(`order: ${oErr.message}`);
made.orders.push(ord.id);
const { error: cErr } = await db.from("eng_quote_requests").update({ converted_order_id: ord.id, status: "accepted" }).eq("id", quote.id);
if (cErr) await stop(`quote conversion: ${cErr.message}`);
{
  const credit = await productionCreditFor(file);
  check("a decided design review credits nothing while the addendum is unsigned", !credit.ok, credit.ok ? `CREDITED ${credit.cents}` : credit.reason);
}

// ---------------------------------------------------------------- 5. he signs, exactly as a protocol is signed
{
  step = await nextStep(step);
  const badCode = await signAddendum(engineer, { addendumId: addendum.id, code: "000000" });
  check("a wrong code signs nothing", !badCode.ok, badCode.ok ? "SIGNED" : badCode.error.slice(0, 70));
  step = await nextStep(step);
  const signed = await signAddendum(engineer, { addendumId: addendum.id, code: totp.codeForStep(secret, step) });
  check("his own code signs it, over the hash of its own text", signed.ok && signed.sha256 === addendum.content_sha256, signed.ok ? signed.sha256.slice(0, 12) : signed.error);
}
{
  const pay = await designPayFor(quote.id);
  check("signed, it pays $700 on the $2,000 fee", pay.ok && pay.cents === 70000 && pay.addendumId === addendum.id, pay.ok ? String(pay.cents) : pay.reason);
  const credit = await productionCreditFor(file);
  check(
    "and a decided design review credits exactly the addendum's $700, naming it",
    credit.ok && credit.cents === 70000 && credit.tier === null && credit.addendumId === addendum.id,
    credit.ok ? `${credit.cents}, addendum ${credit.addendumId}` : credit.reason,
  );
}

// ---------------------------------------------------------------- 6. voided, it pays nothing again
{
  const { data: act } = await db.from("eng_seal_acts").select("id").eq("addendum_id", addendum.id).is("voided_at", null).single();
  const { error: vErr } = await db.rpc("eng_void_seal_act", { p_seal_act_id: act.id, p_voided_by: engineer.id, p_because: `${LABEL}: voided by the walk, test data` });
  if (vErr) await stop(`void: ${vErr.message}`);
  const pay = await designPayFor(quote.id);
  const credit = await productionCreditFor(file);
  check("voiding his signature stops the pay and the credit", !pay.ok && !credit.ok, pay.ok || credit.ok ? "STILL PAYS" : "nothing owed");
}

// ---------------------------------------------------------------- 7. the test accounts are closed
for (const p of made.profiles) await db.from("eng_profiles").update({ status: "suspended" }).eq("id", p.id);
console.log(`WALK MADE ${JSON.stringify(made)}`);
console.log("");
if (wrong === 0) {
  console.log("PASS: on development, a design job pays only under a scope addendum its engineer signed in the portal, and nothing once it is voided.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
