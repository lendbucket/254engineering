// @runtime react-server
// THE ORDER PATH ON DEVELOPMENT, FROM ORDER TO SEALED LETTER TO REFUND. Operator ruling 1 of 2026-10-07, option B.
// Run only by scripts/exercises/order-path-walk.mjs, inside the gate fixture, as its own process. The test engineer exists ONLY in this
// process: it is appended to the register in memory and never written anywhere that ships. Every person, address and
// record this creates says it is test data. No Stripe (ORDER_PAYMENTS_FAKE), no email or SMS leaves (.invalid addresses).
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const ROOT = new URL("../../", import.meta.url).href;
const OUT = (await import("node:path")).join((await import("node:os")).tmpdir(), "order-path-walk");
(await import("node:fs")).mkdirSync(OUT, { recursive: true });
const { auditClient } = await import(ROOT + "scripts/lib/db-target.mjs");
const db = auditClient("order path walk", { neverProduction: true });
if (!db) throw new Error("no development client");

const { verifiedEngineers } = await import(ROOT + "src/config/credentials.ts");
const { isPrelaunch } = await import(ROOT + "src/lib/launch.ts");
const { fieldsFor } = await import(ROOT + "data/intake-fields.ts");
const { catalogFor } = await import(ROOT + "data/catalog.ts");
const { placeOrder } = await import(ROOT + "src/lib/ops-intake.ts");
const pay = await import(ROOT + "src/lib/ops-payments.ts");
const { fakeProvider } = await import(ROOT + "src/lib/payments.ts");
const field = await import(ROOT + "src/lib/ops-field.ts");
const eng = await import(ROOT + "src/lib/ops-engineer.ts");
const mfa = await import(ROOT + "src/lib/ops-mfa.ts");
const totp = await import(ROOT + "src/lib/totp.ts");
const { uploadSealImage } = await import(ROOT + "src/lib/seal-store.ts");
const letters = await import(ROOT + "src/lib/letter-seal.ts");
const delivery = await import(ROOT + "src/lib/letter-delivery.ts");

const STAMP = Date.now().toString(36);
const LABEL = "Audit Walk";
const TEST_ENGINEER = {
  name: "Audit Walk Engineer, not a real person",
  licenseNumber: "AUDIT-WALK-PE",
  disciplines: ["Civil"],
  sealsOnly: ["structural"],
  granted: "2020-01-01",
  status: "Active",
  employersOnRoster: ["254 Engineering LLC"],
  expires: "2099-12-31",
  verified: "2026-10-07",
};
const made = { profiles: [], orders: [], files: [], clients: [], documents: [], objects: [] };
const log = (s) => console.log(`WALK ${s}`);
const stop = async (s) => {
  console.log(`WALK STOPPED: ${s}`);
  /* A stopped walk leaves no live account: every test account it made is suspended on the way out. */
  for (const p of made.profiles) await db.from("eng_profiles").update({ status: "suspended" }).eq("id", p.id);
  console.log(`WALK MADE ${JSON.stringify(made)}`);
  process.exit(1);
};

/* A real PNG, w by h, of a plain two-tone pattern: an image the seal store accepts, and plainly not a seal. */
function png(w, h, seed) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
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
  const email = `walk-${role}-${STAMP}@order-walk.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, password: `walk-${randomUUID()}`, email_confirm: true });
  if (error || !data?.user) await stop(`createUser ${role}: ${error?.message}`);
  const id = data.user.id;
  const { error: pErr } = await db.from("eng_profiles").insert({
    id,
    email,
    display_name: `${LABEL} ${role}, not a real person`,
    role,
    status: "active",
    is_demo: true,
    ...extra,
  });
  if (pErr) await stop(`profile ${role}: ${pErr.message}`);
  made.profiles.push({ id, role, email });
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", id).single();
  return { ...row, grants: await grantsFor(role) };
}
async function waitForNextStep(lastStep) {
  while (totp.stepAt(Date.now()) <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  return totp.stepAt(Date.now());
}

// ---------------------------------------------------------------- 0. the premises
if (isPrelaunch()) await stop("the gate is shut in this process, so nothing can be ordered or sealed");
verifiedEngineers.push(TEST_ENGINEER);
log(`register in THIS PROCESS ONLY: ${verifiedEngineers.map((e) => `${e.name} ${e.licenseNumber}`).join("; ")}`);

// ---------------------------------------------------------------- 1. the people
const admin = await staffProbe("admin");
const engineer = await staffProbe("engineer", { license_number: TEST_ENGINEER.licenseNumber });
const { data: tpl } = await db
  .from("eng_protocol_templates")
  .select("id, version_label")
  .eq("document_number", "254-RC-001")
  .eq("status", "published")
  .single();
if (!tpl) await stop("no published RC-001 on development");
const tech = await staffProbe("field_tech", { coverage_counties: ["Nueces"], certification_status: "certified", base_city: "Corpus Christi", base_county: "Nueces" });
{
  const { error } = await db.from("eng_certifications").insert({
    profile_id: tech.id, service_slug: "roof-inspections", template_id: tpl.id, status: "certified", attempts: 1, certified_at: new Date().toISOString(),
  });
  if (error) await stop(`certification: ${error.message}`);
  for (const kind of ["drivers_license", "vehicle_insurance", "w9", "ic_agreement"]) {
    const { error: cErr } = await db.from("eng_credentials").insert({
      profile_id: tech.id, kind, label: `${LABEL} test credential, no document`, issued_on: "2026-01-01", expires_on: "2099-01-01", status: "verified", verified_at: new Date().toISOString(),
    });
    if (cErr) await stop(`credential ${kind}: ${cErr.message}`);
  }
}
log(`people: admin ${admin.id}, engineer ${engineer.id} (${TEST_ENGINEER.licenseNumber}), technician ${tech.id} certified on RC-001 ${tpl.version_label}`);

// ---------------------------------------------------------------- 2. the engineer's second factor and images
const begun = await mfa.beginEnrolment(engineer.id, engineer.email);
if (!begun.ok) await stop(`MFA begin: ${begun.error}`);
const secret = totp.base32Decode(begun.secret);
let step = totp.stepAt(Date.now());
const confirmed = await mfa.confirmEnrolment(engineer.id, totp.codeForStep(secret, step));
if (!confirmed.ok) await stop(`MFA confirm: ${confirmed.error}`);
log("engineer enrolled in MFA");
for (const [kind, w, h] of [["seal", 600, 600], ["signature", 800, 300]]) {
  step = await waitForNextStep(step);
  const up = await uploadSealImage({ actor: engineer, kind, bytes: png(w, h, kind === "seal" ? 0 : 7), code: totp.codeForStep(secret, step) });
  if (!up.ok) await stop(`${kind} image: ${up.error}`);
  log(`${kind} image stored, a plain test pattern`);
}

// ---------------------------------------------------------------- 3. an order, as the site places it
const provider = fakeProvider();
pay.setPaymentProvider(provider);
async function order(n, overrides = {}) {
  const entry = catalogFor("roof-inspections", "standard");
  const answers = entry.qualifiers.map((q) => ({ qualifierId: q.id, optionIndex: q.options.findIndex((_, i) => !q.disqualifyOn.includes(i)) }));
  const inputs = {};
  const files = [];
  for (const f of fieldsFor("roof-inspections", "standard").filter((x) => x.audience === "customer")) {
    if (f.kind === "file") {
      if (!f.required) continue;
      const storageKey = `orders/walk-${STAMP}-${n}/${f.id}/${randomUUID()}.png`;
      const { error } = await db.storage.from("eng-uploads").upload(storageKey, Buffer.from(png(300, 300, 3)), { contentType: "image/png" });
      if (error) await stop(`order upload: ${error.message}`);
      made.objects.push(`eng-uploads/${storageKey}`);
      files.push({ key: f.id, bucket: "eng-uploads", storageKey, contentType: "image/png", byteSize: 1000 });
      continue;
    }
    if (f.kind === "select" || f.kind === "boolean") inputs[f.id] = f.options?.includes("No") ? "No" : (f.options?.[0] ?? "Yes");
    else if (f.kind === "date") inputs[f.id] = "2026-11-30";
    else if (f.kind === "tel") inputs[f.id] = "+15125550100";
    else inputs[f.id] = `${LABEL} answer for ${f.id}, not a real request`;
  }
  inputs.rc001_q1 = "Insurance renewal. Audit walk, not a real request.";
  inputs.rc001_q2 = "Audit Walk Insurer, not a real company";
  inputs.rc001_q13 = "Yes";
  Object.assign(inputs, overrides);
  const placed = await placeOrder({
    site: "254",
    clientRequestId: `walk-${STAMP}-${n}`,
    serviceSlug: "roof-inspections",
    tier: "standard",
    customer: { name: `${LABEL} Customer ${n}, not a real person`, email: `walk-customer-${STAMP}-${n}@order-walk.invalid` },
    property: { propertyAddress: `${n} Audit Walk Street, not a real address`, city: "Corpus Christi", county: "Nueces", postalCode: "78401" },
    answers,
    inputs,
    files,
  });
  if (!placed.ok) await stop(`order ${n}: ${placed.error}${placed.field ? ` (${placed.field})` : ""}`);
  made.orders.push(placed.orderId);
  const checkout = await pay.startCheckout(placed.orderId);
  if (!checkout.ok) await stop(`checkout ${n}: ${checkout.error}`);
  const { data: o } = await db.from("eng_service_orders").select("total_cents, file_id, client_id, reference").eq("id", placed.orderId).single();
  provider.settle(checkout.sessionRef, { paid: true, amountCents: o.total_cents, orderId: placed.orderId });
  const paid = await pay.markPaid({ orderId: placed.orderId, chargeRef: `fake-${checkout.sessionRef}`, amountCents: o.total_cents, provider: "fake" });
  if (!paid.ok) await stop(`paid ${n}: ${paid.error}`);
  await db.from("eng_service_orders").update({ is_demo: true }).eq("id", placed.orderId);
  if (o.client_id) await db.from("eng_clients").update({ is_demo: true }).eq("id", o.client_id);
  if (o.file_id) await db.from("eng_files").update({ is_demo: true }).eq("id", o.file_id);
  made.files.push(o.file_id);
  made.clients.push(o.client_id);
  const { data: f } = await db.from("eng_files").select("status, file_number, is_demo").eq("id", o.file_id).single();
  const { data: oo } = await db.from("eng_service_orders").select("is_demo").eq("id", placed.orderId).single();
  const { data: cc } = await db.from("eng_clients").select("is_demo").eq("id", o.client_id).single();
  log(`order ${n}: ${o.reference}, $${(o.total_cents / 100).toFixed(2)} paid through the fake till, file ${f?.file_number} is ${f?.status}`);
  log(`order ${n} labelled as test data: order ${oo?.is_demo}, file ${f?.is_demo}, client ${cc?.is_demo}`);
  return { orderId: placed.orderId, fileId: o.file_id, reference: o.reference, totalCents: o.total_cents };
}
const first = await order(1);

// ---------------------------------------------------------------- 4. the field
const sent = await field.sendOffers(admin, first.fileId, [tech.id]);
if (!sent.ok) await stop(`offer: ${sent.error}`);
const { data: offer } = await db.from("eng_assignments").select("id").eq("file_id", first.fileId).eq("tech_id", tech.id).single();
const accepted = await field.acceptOffer(tech, offer.id);
if (!accepted.ok) await stop(`accept: ${accepted.error}`);
const job = await field.jobView(tech, first.fileId);
if (!job) await stop("the technician cannot see the job");
const items = job.items ?? job.protocol?.items ?? [];
log(`dispatched and accepted; ${items.length} checklist item(s)`);
const evidenceIds = [];
const capturedKeys = [];
let i = 0;
for (const item of items) {
  i += 1;
  const key = item.key ?? item.itemKey;
  if (i % 4 === 0) {
    const ex = await field.recordException(tech, first.fileId, { itemKey: key, kind: "not_observed", reason: `${LABEL}: not reachable on this test visit` });
    if (!ex.ok) await stop(`exception ${key}: ${ex.error}`);
    continue;
  }
  let storageKey = null;
  if (item.kind === "photo") {
    storageKey = `${first.fileId}/walk-${STAMP}/${key}.png`;
    const { error } = await db.storage.from("eng-evidence").upload(storageKey, Buffer.from(png(400, 300, i)), { contentType: "image/png" });
    if (error) await stop(`evidence upload: ${error.message}`);
    made.objects.push(`eng-evidence/${storageKey}`);
  }
  const cap = await field.recordCapture(tech, first.fileId, {
    clientCaptureId: randomUUID(),
    itemKey: key,
    kind: item.kind,
    valueText: item.kind === "text" || item.kind === "note" ? `${LABEL} observation, not a real property` : null,
    valueNumber: item.kind === "number" || item.kind === "measurement" ? 1 : null,
    storageKey,
    capturedAt: new Date().toISOString(),
    lat: 27.8,
    lng: -97.4,
    accuracy: 5,
  });
  if (!cap.ok) await stop(`capture ${key} (${item.kind}): ${cap.error}`);
  evidenceIds.push(cap.id);
  capturedKeys.push(key);
}
const submitted = await field.submitEvidence(tech, first.fileId, `${LABEL}: submitted by the test technician`);
if (!submitted.ok) await stop(`submit: ${submitted.error} ${(submitted.blockers ?? []).join("; ")}`);
log(`evidence: ${evidenceIds.length} capture(s), ${items.length - evidenceIds.length} not observed, submitted`);

// ---------------------------------------------------------------- 5. the engineer's determination, the letter, the seal
const opened = await eng.openReview(engineer, first.fileId);
if (!opened.ok) await stop(`open review: ${opened.error}`);
const decided = await eng.decideReview(engineer, first.fileId, "seal", null, {}, {
  determination: "pass",
  reliedOnItemKeys: capturedKeys.slice(0, 3),
  reliedOnEvidenceIds: evidenceIds.slice(0, 3),
  note: `${LABEL}: a test determination about a property that does not exist`,
});
if (!decided.ok) await stop(`decide: ${decided.error}`);
const { data: det } = await db.from("eng_determinations").select("id, determination").eq("file_id", first.fileId).order("created_at", { ascending: false }).limit(1).single();
const entered = { recipientAddress: "Audit Walk Insurer, 1 Not A Real Road, Corpus Christi, TX 78401", recipientSalutation: "To whom it may concern" };
const draft = await letters.draftForDetermination(engineer, det.id, entered);
if (!draft || draft.ok === false) await stop(`draft: ${draft?.why ?? "no draft"}`);
writeFileSync(`${OUT}/draft-${STAMP}.json`, JSON.stringify(draft, null, 2));
log(`determination ${det.determination}; letter drafted (${JSON.stringify(draft).length} characters, saved)`);
step = await waitForNextStep(step);
const sealed = await letters.sealLetter(engineer, { determinationId: det.id, code: totp.codeForStep(secret, step), ...entered });
if (!sealed.ok) await stop(`seal: ${sealed.error}`);
made.documents.push(sealed.documentId);
log(`SEALED: document ${sealed.documentId}, sha256 ${sealed.sha256}, delivered ${sealed.delivered}${sealed.warning ? `, warning: ${sealed.warning}` : ""}`);

// ---------------------------------------------------------------- 6. what the customer receives
const mine = await delivery.customerLetters(first.orderId);
const got = mine[0] ? await delivery.customerLetterFor(first.orderId, mine[0].id) : { ok: false };
if (!got.ok) await stop("the customer cannot download the sealed letter");
const bytes = Buffer.from(got.bytes);
writeFileSync(`${OUT}/sealed-letter-${STAMP}.pdf`, bytes);
const hash = createHash("sha256").update(bytes).digest("hex");
const { data: act } = await db.from("eng_seal_acts").select("content_sha256, sealed_by, mfa_verified_at").eq("document_id", sealed.documentId).single();
const { data: o1 } = await db.from("eng_service_orders").select("status, completed_at").eq("id", first.orderId).single();
const { data: f1 } = await db.from("eng_files").select("status").eq("id", first.fileId).single();
log(`customer download: ${got.filename}, ${bytes.length} bytes, sha256 ${hash === act?.content_sha256 ? "MATCHES" : "DOES NOT MATCH"} the seal act; sealed by the test engineer: ${act?.sealed_by === engineer.id}`);
log(`order 1 is ${o1?.status} (completed ${o1?.completed_at ?? "never"}); file is ${f1?.status}`);
const otherOrder = await delivery.customerLetterFor(randomUUID(), sealed.documentId);
log(`the letter through another order's door: ${otherOrder.ok ? "SERVED, WHICH IS WRONG" : "refused"}`);

// ---------------------------------------------------------------- 7. the refund: a second order the engineer declines before anyone attends
const second = await order(2);
const settled = await pay.settleDecision({ orderId: second.orderId, outcome: "refuse", actorId: engineer.id });
log(`order 2 declined before attendance: ${JSON.stringify(settled).slice(0, 300)}`);
const { data: pays } = await db.from("eng_order_payments").select("kind, amount_cents, provider").eq("order_id", second.orderId).order("created_at");
const { data: o2 } = await db.from("eng_service_orders").select("status, refunded_at").eq("id", second.orderId).single();
log(`order 2 money: ${(pays ?? []).map((p) => `${p.kind} $${(p.amount_cents / 100).toFixed(2)}`).join(", ")}; status ${o2?.status}, refunded ${o2?.refunded_at ? "yes" : "no"}`);
log(`fake till asked to refund: ${JSON.stringify(provider.ledger.filter((l) => l.kind === "refund" || l.type === "refund")).slice(0, 300)}`);

// ---------------------------------------------------------------- 7b. a yes holds the job for the engineer (ruling 1 of 2026-10-07)
const hold = await import(ROOT + "src/lib/dispatch-hold.ts");
const claimOrder = await order(3, { rc001_q8: "Yes", rc001_q8_detail: `${LABEL}: an open claim on a roof that does not exist` });
const claimSend = await field.sendOffers(admin, claimOrder.fileId, [tech.id]);
log(`order 3, an open insurance claim: dispatch ${claimSend.ok ? "WENT THROUGH, WHICH IS WRONG" : `refused: ${claimSend.error}`}`);
const listed = await hold.heldFiles();
const heldEntry = listed.ok ? listed.files.find((f) => f.id === claimOrder.fileId) : null;
log(`the engineer's held list: ${heldEntry ? `${heldEntry.fileNumber}, ${heldEntry.questions.map((q) => `question ${q.number}${q.standingRuling ? ` [${q.standingRuling}]` : ""}`).join("; ")}` : "NOT LISTED"}`);
const { data: claimFile0 } = await db.from("eng_files").select("status").eq("id", claimOrder.fileId).single();
log(`and it is held, not declined: the file is ${claimFile0?.status}`);
const bare = await hold.recordPrereview(engineer, claimOrder.fileId, "decline", "no");
log(`a decline with no referral: ${bare.ok ? "ACCEPTED, WHICH IS WRONG" : `refused: ${bare.error}`}`);
const declined = await hold.recordPrereview(engineer, claimOrder.fileId, "decline", `${LABEL} referral: the customer's own insurer's adjuster handles an open claim; not a real referral`);
if (!declined.ok) await stop(`decline: ${declined.error}`);
const { data: claimFile } = await db.from("eng_files").select("status").eq("id", claimOrder.fileId).single();
const { data: claimPays } = await db.from("eng_order_payments").select("kind, amount_cents").eq("order_id", claimOrder.orderId);
const { data: claimOrderRow } = await db.from("eng_service_orders").select("status").eq("id", claimOrder.orderId).single();
log(`the engineer declined with his referral: file ${claimFile?.status}, order ${claimOrderRow?.status}, money ${(claimPays ?? []).map((p) => `${p.kind} $${(p.amount_cents / 100).toFixed(2)}`).join(", ")}`);

const leakOrder = await order(4, { rc001_q10: "Yes", rc001_q10_detail: `${LABEL}: a leak in a house that does not exist` });
const leakSend = await field.sendOffers(admin, leakOrder.fileId, [tech.id]);
log(`order 4, an active leak: dispatch ${leakSend.ok ? "WENT THROUGH, WHICH IS WRONG" : "refused, held"}`);
const accepted4 = await hold.recordPrereview(engineer, leakOrder.fileId, "accept", `${LABEL}: accepted, the technician notes the leak`);
if (!accepted4.ok) await stop(`accept: ${accepted4.error}`);
const leakSend2 = await field.sendOffers(admin, leakOrder.fileId, [tech.id]);
log(`after the engineer accepted: dispatch ${leakSend2.ok ? `sent (${leakSend2.sent} offer)` : `STILL REFUSED: ${leakSend2.error}`}`);

// ---------------------------------------------------------------- 8. the test accounts are closed
for (const p of made.profiles) await db.from("eng_profiles").update({ status: "suspended" }).eq("id", p.id);
log(`the ${made.profiles.length} test accounts are suspended; their records stay, labelled, because they cannot be deleted`);
console.log(`WALK MADE ${JSON.stringify(made)}`);
console.log("WALK DONE");
