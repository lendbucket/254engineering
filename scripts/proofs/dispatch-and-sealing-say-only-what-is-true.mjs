// @runtime node
//
// Reads source files and replays the migrations in process; imports nothing server-only.

/**
 * PROOF: DISPATCH AND SEALING SAY ONLY WHAT IS TRUE. Robert's ruling Q6,
 * 2026-11-02 (audit field F6, F13, F14, F10, F11): "revoke withdraws offers
 * and re-checks at acceptance; dispatch refuses when the protocol pin write
 * fails; the self service check writes in_progress not certified; a trigger
 * refuses sealed or delivered on eng_files without a live seal act (stage
 * branch); transitionFile checks its row count."
 *
 *   F10  on a replay of every migration: a file is not moved to sealed, nor
 *        given sealed_at, nor inserted sealed, without a live letter act; with
 *        one it moves to sealed and then delivered; another column on a sealed
 *        file still changes; after the act is voided, delivered is refused
 *   F13  sendOffers writes the protocol pin first, reads its row count, and
 *        refuses before any offer is written
 *   F6   acceptOffer asks eligibleToAccept (certification and credential
 *        blockers, a failed read refusing) before the claim; revokeCertification
 *        withdraws the technician's open offers for the line and notes the jobs
 *        he still holds
 *   F14  a passed check writes in_progress, never certified, and both writes'
 *        errors are read
 *   F11  transitionFile reads its row count and refuses before the event and
 *        the audit row
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/dispatch-and-sealing-say-only-what-is-true.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const between = (src, from, to) => {
  const a = src.indexOf(from);
  const b = a < 0 ? -1 : src.indexOf(to, a + from.length);
  return a < 0 || b < 0 ? "" : src.slice(a, b);
};

/* ------------------------------------------------------------- F10: trigger */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0110 included", files.some((f) => f.startsWith("0110_")), `${files.length} files`);

const id = (n) => `'00000000-0000-4000-8000-${String(n).padStart(12, "0")}'`;
const ENG = id(1);
const CL = id(2);
const F = id(3);
const DET = id(4);
const DOC = id(5);
const ACT = id(6);
const hex = (c) => `'${c.repeat(64)}'`;
const attempt = async (sql) => {
  try {
    await db.exec(sql);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};

await db.exec(`
  insert into auth.users (id) values (${ENG});
  insert into eng_profiles (id, email, display_name, role, status) values (${ENG}, 'q6-engineer@audit-probe.invalid', 'Probe Engineer', 'engineer', 'active');
  insert into eng_clients (id, kind, name) values (${CL}, 'individual', 'Probe Client, not a real person');
  insert into eng_files (id, client_id, file_number, property_address, county, service_slug, status)
  values (${F}, ${CL}, '254-PROBE-Q6', '1 Probe Street', 'Nueces', 'roof-certification', 'under_review');
  insert into eng_evidence_items (id, file_id, item_key, kind) values (${id(7)}, ${F}, 'probe', 'note');
  insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id)
  values (${DET}, ${F}, '254-RC-001', 'pass', array['probe'], array[${id(7)}::uuid], ${ENG});
`);

const bare = await attempt(`update eng_files set status = 'sealed' where id = ${F}`);
check("a file is not moved to sealed with no sealed letter", bare !== null && /\(0110\)/.test(bare), (bare ?? "it moved").slice(0, 140));
const stampOnly = await attempt(`update eng_files set sealed_at = now() where id = ${F}`);
check("nor given sealed_at by itself", stampOnly !== null && /\(0110\)/.test(stampOnly), (stampOnly ?? "it was stamped").slice(0, 140));
const inserted = await attempt(`
  insert into eng_files (id, client_id, file_number, property_address, county, service_slug, status)
  values (${id(8)}, ${CL}, '254-PROBE-Q6B', '2 Probe Street', 'Nueces', 'roof-certification', 'delivered')`);
check("nor inserted already delivered", inserted !== null && /\(0110\)/.test(inserted), (inserted ?? "it was inserted").slice(0, 140));

await db.exec(`
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at)
  values (${id(9)}, ${ENG}, 'seal', 'probe/q6-seal.png', ${hex("a")}, 1000, 600, 600, now()),
         (${id(10)}, ${ENG}, 'signature', 'probe/q6-signature.png', ${hex("b")}, 1000, 600, 200, now());
  insert into eng_documents (id, file_id, kind, title, bucket, storage_key)
  values (${DOC}, ${F}, 'deliverable', 'Probe sealed letter', 'docs', 'probe/q6-letter');
  insert into eng_seal_acts (id, kind, document_id, determination_id, content_sha256, letterhead_sha256, seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values (${ACT}, 'letter', ${DOC}, ${DET}, ${hex("c")}, ${hex("d")}, ${id(9)}, ${id(10)}, ${ENG}, now());
`);
const sealed = await attempt(`update eng_files set status = 'sealed', sealed_at = now() where id = ${F}`);
check("with a live sealed letter the file moves to sealed (so the refusals above are the rule, not the fixture)", sealed === null, sealed ?? "");
const delivered = await attempt(`update eng_files set status = 'delivered', delivered_at = now() where id = ${F}`);
check("and on to delivered", delivered === null, delivered ?? "");
const otherColumn = await attempt(`update eng_files set property_address = '1 Probe Street, rear' where id = ${F}`);
check("another column on a delivered file still changes", otherColumn === null, otherColumn ?? "");

await db.exec(`
  insert into eng_files (id, client_id, file_number, property_address, county, service_slug, status)
  values (${id(11)}, ${CL}, '254-PROBE-Q6C', '3 Probe Street', 'Nueces', 'roof-certification', 'under_review');
  insert into eng_evidence_items (id, file_id, item_key, kind) values (${id(12)}, ${id(11)}, 'probe', 'note');
  insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id)
  values (${id(13)}, ${id(11)}, '254-RC-001', 'pass', array['probe'], array[${id(12)}::uuid], ${ENG});
  insert into eng_documents (id, file_id, kind, title, bucket, storage_key)
  values (${id(14)}, ${id(11)}, 'deliverable', 'Probe letter to void', 'docs', 'probe/q6-void');
  insert into eng_seal_acts (id, kind, document_id, determination_id, content_sha256, letterhead_sha256, seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values (${id(15)}, 'letter', ${id(14)}, ${id(13)}, ${hex("e")}, ${hex("d")}, ${id(9)}, ${id(10)}, ${ENG}, now());
`);
const sealedC = await attempt(`update eng_files set status = 'sealed', sealed_at = now() where id = ${id(11)}`);
await db.query(`select eng_void_seal_act(${id(15)}::uuid, ${ENG}::uuid, 'Probe: the letter named the wrong county.')`);
const afterVoid = await attempt(`update eng_files set status = 'delivered', delivered_at = now() where id = ${id(11)}`);
check("after its letter is voided, a sealed file is not delivered", sealedC === null && afterVoid !== null && /\(0110\)/.test(afterVoid), `${sealedC ?? "sealed"}; ${(afterVoid ?? "delivered").slice(0, 120)}`);

const crm = readFileSync("src/lib/ops-crm.ts", "utf8");
check("the trigger's refusal reaches a person in plain words", /if \(error && \/\\\(0110\\\)\/\.test\(error\.message\)\) \{\s*return \{ ok: false, error: `This file cannot be marked/.test(crm));

/* ------------------------------------------------------------ F11: transitionFile */
const tf = between(crm, "export async function transitionFile(", "\n}\n");
const counted = tf.indexOf('.update(patch).eq("id", id).eq("status", current.status).select("id");');
const refusedNone = tf.indexOf("if (!moved?.length) {");
const event = tf.indexOf('from("eng_file_events").insert(');
check("transitionFile reads its row count", counted > 0, `at ${counted}`);
check("and refuses a move that changed no row before the event and the audit row", refusedNone > counted && event > refusedNone, `refuse ${refusedNone}, event ${event}`);

/* ------------------------------------------------------------ F13: sendOffers */
const field = readFileSync("src/lib/ops-field.ts", "utf8");
const send = between(field, "export async function sendOffers(", "\nexport async function ");
const pin = send.indexOf('.update({ protocol_template_id: protocol.id })');
const pinRead = send.indexOf('if (pinError) return { ok: false,');
const pinCount = send.indexOf("if (!pinned?.length) return { ok: false,");
const offers = send.indexOf('from("eng_assignments").upsert(rows');
check("sendOffers pins the protocol before any offer is written", pin > 0 && offers > pin, `pin ${pin}, offers ${offers}`);
check("and refuses on the pin's error or its empty count, before the offers", pinRead > pin && pinCount > pinRead && offers > pinCount);
check("the pin's result is never discarded again", !/await db\.from\("eng_files"\)\.update\(\{ protocol_template_id: protocol\.id \}\)\.eq\("id", fileId\);/.test(send));

/* ------------------------------------------------------------ F6: acceptance and revocation */
const accept = between(field, "export async function acceptOffer(", "\nexport async function ");
const asks = accept.indexOf("const stillEligible = await eligibleToAccept(offer.tech_id as string, file.service_slug as string);");
const claim = accept.indexOf('.update({ assigned_tech_id: offer.tech_id })');
check("acceptOffer asks whether the technician is still eligible before the claim", asks > 0 && claim > asks, `ask ${asks}, claim ${claim}`);
check("and refuses on its answer", /if \(!stillEligible\.ok\) return \{ ok: false, error: stillEligible\.error \};/.test(accept));
const eligible = between(field, "export async function eligibleToAccept(", "\n}\n");
check("eligibility reads the certification and refuses a failed read", /from\("eng_certifications"\)/.test(eligible) && /if \(certError\) return \{ ok: false,/.test(eligible) && /if \(cert\?\.status !== "certified"\)/.test(eligible));
check("and asks the same credential blockers dispatch asks", /credentialBlockersFor\(\[techId\]\)/.test(eligible) && /if \(blockers\.length\) return \{ ok: false,/.test(eligible));
const revoke = between(field, "export async function revokeCertification(", "\nexport async function ");
const revoked = revoke.indexOf('.update({ status: "revoked", revoked_at: DB_NOW })');
const lines = revoke.indexOf("const lineFiles = await openFilesForTechOnLine(profileId, serviceSlug);");
const withdraw = revoke.indexOf('.update({ state: "withdrawn", responded_at: DB_NOW })');
check("revoking reads the technician's open offers and held jobs on the line, after the certification changes", revoked > 0 && lines > revoked, `revoke ${revoked}, read ${lines}`);
check("withdraws his offered rows for those files", withdraw > lines && /\.eq\("tech_id", profileId\)\s*\.eq\("state", "offered"\)\s*\.in\("file_id", lineFiles\.offeredFileIds\)/.test(revoke));
check("and notes each job he still holds on its file for the office", /for \(const fileId of lineFiles\.assignedFileIds\)/.test(revoke) && /certification was withdrawn while this job was theirs/.test(revoke));
check("a failed read of either is said, never reported as nothing to withdraw", /if \(!lineFiles\.ok\) \{\s*return \{ ok: false,/.test(revoke));

/* ------------------------------------------------------------ F14: the self service check */
const attemptFn = between(field, "export async function submitAttempt(", "\nexport async function ");
check("a passed check writes in_progress", /status: grade\.passed \? "in_progress" : "failed",/.test(attemptFn));
check("and never certified, nor certified_at, nor the profile's certified flag", !/"certified"/.test(attemptFn) && /certified_at: null,/.test(attemptFn));
check("the attempt's write error is read", /const \{ error: attemptError \} = await db\.from\("eng_certification_attempts"\)\.insert\(/.test(attemptFn) && /if \(attemptError\) \{\s*return \{ ok: false,/.test(attemptFn));
check("and the certification's", /const \{ error: certError \} = await db\.from\("eng_certifications"\)\.upsert\(/.test(attemptFn) && /if \(certError\) \{\s*return \{ ok: false,/.test(attemptFn));
const screen = readFileSync("src/app/portal/(app)/certification/CertificationClient.tsx", "utf8");
check("the pass screen no longer says certified or that work follows", /Check passed/.test(screen) && !/<p className="portal-label">Certified<\/p>/.test(screen) && /when the engineer approves your/.test(screen));

console.log(wrong === 0 ? "PASS: dispatch and sealing say only what is true: a pinned protocol, a re-checked acceptance, a check that does not certify, a counted move, and no sealed file without a sealed letter." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
