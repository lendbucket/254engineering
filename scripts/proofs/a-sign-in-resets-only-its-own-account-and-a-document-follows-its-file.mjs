// @runtime react-server
//
// Declared because it imports src/lib/ops-rate-limit.ts and src/lib/ops-docs.ts, which carry server-only.

/**
 * A SIGN IN RESETS ONLY ITS OWN ACCOUNT, AND A DOCUMENT FOLLOWS ITS FILE.
 * Robert, 2026-11-02, audit fix Q9, auth H1 and H2: "success resets only the
 * signed in identity, never the address bucket; documentUrl loads the
 * document's file and applies canSeeFile."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-sign-in-resets-only-its-own-account-and-a-document-follows-its-file.mjs
 *
 * H1 is the attack the audit wrote down, run against the real counting
 * function replayed from every migration: seven guesses at the owner, one good
 * sign in to the attacker's own account, seven more guesses. It was never
 * refused while a success wrote a null reset. Then the in-memory fallback, and
 * the source of clearLoginAttempts and releaseLock.
 *
 * H2 asks mayOpenDocument, the one predicate the opener and the list share,
 * about engineers, the administrator and documents with and without a file,
 * and reads that documentUrl and listDocuments both ask it.
 *
 * Nothing reaches a database: the SQL runs in an in-process Postgres.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

process.env.SUPABASE_URL = "http://q9-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "q9-proof-not-a-key";
delete process.env.VERCEL_ENV;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------ H1, the database */
const MAX_IDENTITY = 8;
const MAX_ADDRESS = 20;
const WINDOW = 15 * 60;
const ADDRESS = "203.0.113.50";
const OWNER = "owner@audit-probe.invalid";
const MINE = "attacker@audit-probe.invalid";

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));
const take = async (address, identity) =>
  (await db.query("select eng_take_sign_in_attempt($1, $2, $3, $4, $5) as r", [address, identity, MAX_ADDRESS, MAX_IDENTITY, WINDOW])).rows[0].r;
const reset = (address, identity) => db.query("insert into eng_sign_in_attempts (address, identity, kind) values ($1, $2, 'reset')", [address, identity]);

/* Seven guesses at the owner, then a good sign in to the attacker's own account, the way clearLoginAttempts now writes it. */
for (let i = 0; i < 7; i += 1) await take(ADDRESS, OWNER);
await take(ADDRESS, MINE);
await reset(ADDRESS, MINE);
const eighth = await take(ADDRESS, OWNER);
const ninth = await take(ADDRESS, OWNER);
check("after the attacker's own good sign in, the owner's eighth guess is still counted as the eighth", eighth.allowed === true && eighth.remaining === 0, JSON.stringify(eighth));
check("and the ninth guess at the owner is refused on the owner's count", ninth.allowed === false && ninth.scope === "identity", JSON.stringify(ninth));

/* The same sequence with the reset the code used to write (identity null) is what H1 was: the count starts again. */
const OLD = "198.51.100.50";
for (let i = 0; i < 7; i += 1) await take(OLD, OWNER);
await reset(OLD, null);
let oldShape = null;
for (let i = 0; i < 7; i += 1) oldShape = await take(OLD, OWNER);
check("a null reset (the old success, now only the administrator's release) ends the owner's count, which is the hole", oldShape.allowed === true, JSON.stringify(oldShape));

/* The address bucket is not reset by a named success: twenty one attempts across accounts with successes between are still refused. */
const SPRAY = "192.0.2.50";
let sprayed = null;
for (let i = 1; i <= 21; i += 1) {
  sprayed = await take(SPRAY, `account-${i}@audit-probe.invalid`);
  if (i % 5 === 0) await reset(SPRAY, `account-${i}@audit-probe.invalid`);
}
check("named success resets do not reset the address: the twenty first attempt from one address is refused", sprayed.allowed === false && sprayed.scope === "address", JSON.stringify(sprayed));
await db.close();

/* ------------------------------------------------------------------ H1, the in-memory fallback */
const limiter = await import("../../src/lib/ops-rate-limit.ts");
const MEM = "203.0.113.51";
for (let i = 0; i < 7; i += 1) limiter.takeLoginAttemptInMemory(MEM, OWNER);
limiter.clearLoginAttemptsInMemory(MEM, MINE);
limiter.takeLoginAttemptInMemory(MEM, OWNER);
const memNinth = limiter.takeLoginAttemptInMemory(MEM, OWNER);
check("in memory too, another account's success leaves the owner's count, and the ninth is refused", memNinth.allowed === false && memNinth.scope === "identity", JSON.stringify(memNinth));
const MEM2 = "203.0.113.52";
for (let i = 1; i <= 20; i += 1) limiter.takeLoginAttemptInMemory(MEM2, `m${i}@audit-probe.invalid`);
limiter.clearLoginAttemptsInMemory(MEM2, "m1@audit-probe.invalid");
const memAddress = limiter.takeLoginAttemptInMemory(MEM2, "m21@audit-probe.invalid");
check("and a success does not clear the address bucket in memory", memAddress.allowed === false && memAddress.scope === "address", JSON.stringify(memAddress));

/* ------------------------------------------------------------------ H1, the source */
const rl = readFileSync("src/lib/ops-rate-limit.ts", "utf8");
const clearBody = rl.slice(rl.indexOf("export async function clearLoginAttempts("), rl.indexOf("export async function releaseLock("));
const releaseBody = rl.slice(rl.indexOf("export async function releaseLock("), rl.indexOf("export async function inspectLock("));
check("clearLoginAttempts writes the reset with the identity that signed in", /if \(identity\) await writeReset\(address, identity\);/.test(clearBody));
check("and never a null reset", !/writeReset\(address(, null)?\)/.test(clearBody));
check("the administrator's release alone writes the null reset", /await writeReset\(address, null\);/.test(releaseBody));
const memClear = rl.slice(rl.indexOf("export function clearLoginAttemptsInMemory("), rl.indexOf("export function releaseLockInMemory("));
check("the in-memory clear touches no address bucket", !memClear.includes("ip:"));

/* ------------------------------------------------------------------ H2 */
const { mayOpenDocument } = await import("../../src/lib/ops-docs.ts");
const ENGINEER_A = { id: "00000000-0000-4000-8000-00000000e0a1", role: "engineer", status: "active", email: "a@audit-probe.invalid", grants: new Set(["documents.read"]) };
const ADMIN = { id: "00000000-0000-4000-8000-00000000e0a2", role: "admin", status: "active", email: "x@audit-probe.invalid", grants: new Set(["documents.read", "files.list"]) };
const B_FILE = { id: "f-b", status: "sealed", assigned_tech_id: null, assigned_engineer_id: "00000000-0000-4000-8000-00000000e0b1", offered_tech_ids: [] };
const QUEUE_FILE = { id: "f-q", status: "under_review", assigned_tech_id: null, assigned_engineer_id: null, offered_tech_ids: [] };
const A_FILE = { ...B_FILE, id: "f-a", assigned_engineer_id: ENGINEER_A.id };
const doc = (file_id, kind, visibility = "internal") => ({ file_id, kind, visibility });

check("engineer A cannot open the binder on engineer B's sealed file", mayOpenDocument(ENGINEER_A, doc("f-b", "evidence_binder"), B_FILE) === false);
check("engineer A opens a document on his own file", mayOpenDocument(ENGINEER_A, doc("f-a", "deliverable"), A_FILE) === true);
check("and on a file in the shared review queue, as canSeeFile admits", mayOpenDocument(ENGINEER_A, doc("f-q", "deliverable"), QUEUE_FILE) === true);
check("a document whose file could not be found opens for nobody below the firm", mayOpenDocument(ENGINEER_A, doc("f-gone", "deliverable"), null) === false);
check("the administrator opens B's binder", mayOpenDocument(ADMIN, doc("f-b", "evidence_binder"), B_FILE) === true);
check("a firm document with no file opens on the role gate", mayOpenDocument(ENGINEER_A, doc(null, "firm_document"), null) === true);
check("a charge export with no file does not open for an engineer", mayOpenDocument(ENGINEER_A, doc(null, "responsible_charge_export"), null) === false);
check("but does for the administrator", mayOpenDocument(ADMIN, doc(null, "responsible_charge_export"), null) === true);
check("admin_only stays the administrator's", mayOpenDocument(ENGINEER_A, doc("f-a", "deliverable", "admin_only"), A_FILE) === false);
check("without documents.read nothing opens", mayOpenDocument({ ...ADMIN, grants: new Set(["files.list"]) }, doc(null, "firm_document"), null) === false);

const docs = readFileSync("src/lib/ops-docs.ts", "utf8");
const urlBody = docs.slice(docs.indexOf("export async function documentUrl("), docs.indexOf("// -------------------------------------------------------------- the binder"));
const askAt = urlBody.indexOf("if (!mayOpenDocument(actor, doc,");
check("documentUrl reads the document's file and asks mayOpenDocument", /select\("bucket, storage_key, visibility, sealed_at, file_id, kind"\)/.test(urlBody) && askAt > 0);
check("before it serves a sealed document or signs a link", askAt > 0 && askAt < urlBody.indexOf("if (data.sealed_at) {") && askAt < urlBody.indexOf("createSignedUrl("));
check("a failed read of the file refuses", /if \(!files\) return null;/.test(urlBody));
const listBody = docs.slice(docs.indexOf("export async function listDocuments("), docs.indexOf("const FIRM_LEVEL_KINDS"));
check("listDocuments filters by the same predicate, so the list and the opener agree", /rows\.filter\(\(r\) => mayOpenDocument\(actor, r,/.test(listBody));

console.log("");
if (wrong === 0) {
  console.log("PASS: a successful sign in resets only its own account, never the address, and a staff document opens only for someone who can see its file.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
