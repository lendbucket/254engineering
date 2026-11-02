// @runtime react-server
//
// Declared because it imports src/lib/ops-auth.ts, which carries server-only.

/**
 * PROOF: ONE LICENCE NUMBER BELONGS TO ONE ENGINEER. Robert's ruling Q5,
 * 2026-11-02 (audit field F5): "unique partial index on eng_profiles
 * (license_number) where role = engineer; createAccount and eng_seal_act_check
 * refuse a duplicate."
 *
 *   A  on a replay of every migration, a second engineer profile with the same
 *      number (whitespace aside) is refused by 0109's index, and a different
 *      number is not
 *   B  a seal act by an engineer goes through when his number is his alone,
 *      and is refused once another engineer profile also holds it (the index
 *      dropped in this throwaway database, to stand for a duplicate that
 *      predates it), with 0109's sentence
 *   C  createAccount asks whether another engineer holds the number before any
 *      auth user exists, refuses with one sentence, and translates the index's
 *      23505 into the same sentence
 *   D  engineerHoldingLicence compares trimmed numbers, and a failed read
 *      refuses rather than reading as "nobody holds it"
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/one-licence-number-belongs-to-one-engineer.mjs
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
const refused = async (sql, params, pattern) => {
  try {
    await db.query(sql, params);
    return { refused: false, message: "accepted" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { refused: pattern.test(message), message };
  }
};

/* ---------------------------------------------------------------- A: index */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0109 included", files.some((f) => f.startsWith("0109_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = id(1);
const B = id(2);
const C = id(3);
for (const u of [A, B, C]) await db.query("insert into auth.users (id, email) values ($1, $2)", [u, `${u}@audit-probe.invalid`]);
const profile = (u, licence) =>
  db.query("insert into eng_profiles (id, email, display_name, role, status, license_number) values ($1, $2, 'Probe', 'engineer', 'active', $3)", [u, `${u}@audit-probe.invalid`, licence]);

await profile(A, "123456");
const dupe = await refused(
  "insert into eng_profiles (id, email, display_name, role, status, license_number) values ($1, $2, 'Probe', 'engineer', 'active', $3)",
  [B, `${B}@audit-probe.invalid`, " 123456 "],
  /eng_profiles_engineer_license_key/,
);
check("a second engineer with the same number, padded with spaces, is refused by the index", dupe.refused, dupe.message.slice(0, 120));
let other = "accepted";
try {
  await profile(B, "777777");
} catch (err) {
  other = String(err);
}
check("and an engineer with a different number is not", other === "accepted", other.slice(0, 120));

/* --------------------------------------------------------- B: the seal check */
const hex = (c) => c.repeat(64);
const image = async (u, kind, n) => {
  await db.query(
    "insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at) values ($1, $2, $3, $4, $5, 10, 10, 10, now())",
    [id(n), u, kind, `${u}/${kind}.png`, hex(kind === "seal" ? "a" : "b")],
  );
  return id(n);
};
const sealImage = await image(A, "seal", 10);
const signatureImage = await image(A, "signature", 11);
/* Each act names its own version: one live protocol signature per version is a separate rule (eng_seal_acts_one_live_protocol). */
const act = (sha, version) =>
  db.query(
    "insert into eng_seal_acts (kind, content_sha256, seal_image_id, signature_image_id, sealed_by, mfa_verified_at, protocol_document, protocol_version) values ('protocol', $1, $2, $3, $4, now(), '254-RC-001', $5)",
    [sha, sealImage, signatureImage, A, version],
  );

let baseline = "accepted";
try {
  await act(hex("c"), "1.0");
} catch (err) {
  baseline = String(err);
}
check("a seal act by an engineer whose number is his alone goes through (so the refusal below is the clause, not the fixture)", baseline === "accepted", baseline.slice(0, 160));

/* Stand in for a duplicate that predates the index on some database. */
await db.exec("drop index if exists eng_profiles_engineer_license_key");
await db.query("update eng_profiles set license_number = '123456' where id = $1", [B]);
const shared = await refused(
  "insert into eng_seal_acts (kind, content_sha256, seal_image_id, signature_image_id, sealed_by, mfa_verified_at, protocol_document, protocol_version) values ('protocol', $1, $2, $3, $4, now(), '254-RC-001', '1.1')",
  [hex("d"), sealImage, signatureImage, A],
  /held by more than one engineer profile.*\(0109\)/,
);
check("once another engineer profile holds the same number, the same engineer seals nothing", shared.refused, shared.message.slice(0, 160));
await db.query("update eng_profiles set role = 'admin', license_number = null where id = $1", [B]);
let notEngineer = "accepted";
try {
  await act(hex("e"), "1.2");
} catch (err) {
  notEngineer = String(err);
}
check("and a number held only by one engineer seals again (the clause compares engineers, not every profile)", notEngineer === "accepted", notEngineer.slice(0, 160));

/* -------------------------------------------------------- C: createAccount */
const auth = readFileSync("src/lib/ops-auth.ts", "utf8");
const create = auth.slice(auth.indexOf("export async function createAccount("), auth.indexOf("export const duplicateLicenceRefusal"));
const asked = create.indexOf("const holder = await engineerHoldingLicence(db, licence);");
const authUser = create.indexOf("db.auth.admin.createUser(");
const existing = create.indexOf("const existingUserId = await findAuthUserId(db, email);");
check("createAccount asks before it looks up or creates any auth user", asked > 0 && asked < existing && asked < authUser, `asked ${asked}, lookup ${existing}, create ${authUser}`);
check("and refuses with one sentence on a holder or a failed read", /if \(!holder\.ok\) return \{ ok: false, error: holder\.error \};\s*if \(holder\.held\) return \{ ok: false, error: duplicateLicenceRefusal \};/.test(create));
check("the index's 23505 reads as the same sentence, not the driver's", /profileError\.code === "23505" && \/eng_profiles_engineer_license_key\/\.test\(profileError\.message\)\) \{\s*return \{ ok: false, error: duplicateLicenceRefusal \};/.test(create));

/* ---------------------------------------------- D: engineerHoldingLicence */
const { engineerHoldingLicence, duplicateLicenceRefusal } = await import("../../src/lib/ops-auth.ts");
const fakeDb = (rows, error = null) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => chain,
    range: async () => ({ data: error ? null : rows, error }),
  };
  return { from: () => chain };
};
const held = await engineerHoldingLicence(fakeDb([{ id: A, license_number: " 123456 " }]), "123456");
check("a number held with stray spaces counts as held", held.ok && held.held === true, JSON.stringify(held));
const free = await engineerHoldingLicence(fakeDb([{ id: A, license_number: "777777" }]), "123456");
check("a different number is free", free.ok && free.held === false, JSON.stringify(free));
const failed = await engineerHoldingLicence(fakeDb([], { message: "timeout" }), "123456");
check("a failed read refuses, never reads as free", failed.ok === false && /could not be read/.test(failed.error), JSON.stringify(failed));
check("the sentence says what happened and why", /already holds that license number/.test(duplicateLicenceRefusal) && /One license number belongs to one engineer/.test(duplicateLicenceRefusal));

console.log(wrong === 0 ? "PASS: one licence number belongs to one engineer: the index, createAccount and the seal check each refuse a second holder." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
