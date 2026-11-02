/**
 * A DUPLICATE PHOTOGRAPH IS FOUND, AND A PACKAGE WITH AN UNHASHED PHOTOGRAPH
 * IS "NOT CHECKED", NEVER A PASS. Robert's ruling P5, 2026-11-01 evening:
 * "store a SHA-256 of every evidence file at upload (migration, development
 * first) and add the 'no duplicate photos' check to the engineer's queue once
 * every item in a job has a hash. Items captured before the migration show
 * 'not checked', never a pass. The property location check stays off; no
 * geocoder is added."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-duplicate-photo-is-found-and-unhashed-is-not-checked.mjs
 *
 * The rule is asked of the pure check with captures handed to it. Where the
 * hash comes from is asked of the source, because the property that matters
 * (the server hashes the stored bytes, never a value the phone sent) is about
 * a path no fixture here reaches without storage.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { duplicatePhotoCheck, duplicateCheckSentence, sha256Hex } = await import("../../src/lib/evidence-fingerprint.ts");

/* The expected hash is node's own, computed here, not the module's. */
const bytes = new TextEncoder().encode("a photograph");
check("the hash is the lowercase hex SHA-256 of the bytes", sha256Hex(bytes) === createHash("sha256").update(bytes).digest("hex"));

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const H3 = "c".repeat(64);
const photo = (id, label, sha256) => ({ id, itemKey: id, label, kind: "photo", sha256 });

const clear = duplicatePhotoCheck([photo("1", "Front elevation", H1), photo("2", "Rear elevation", H2), { id: "3", itemKey: "3", label: "Roof pitch", kind: "measurement", sha256: null }]);
check("every photograph hashed and different is clear, and a measurement with no hash does not hold it", clear.state === "clear" && clear.photos === 2, JSON.stringify(clear));

const dup = duplicatePhotoCheck([photo("1", "Front elevation", H1), photo("2", "Rear elevation", H2), photo("3", "Left elevation", H1)]);
check("the same bytes twice is a duplicate, naming both items", dup.state === "duplicates" && dup.groups.length === 1 && dup.groups[0].labels.join("|") === "Front elevation|Left elevation", JSON.stringify(dup));

const old = duplicatePhotoCheck([photo("1", "Front elevation", H1), photo("2", "Rear elevation", null), photo("3", "Left elevation", H1)]);
check("one unhashed photograph makes the whole package not checked, even beside a duplicate", old.state === "not_checked" && old.unhashed === 1 && old.photos === 3, JSON.stringify(old));
check("and its sentence says not checked, never none", /not checked/.test(duplicateCheckSentence(old)) && !/none\./i.test(duplicateCheckSentence(old)));

const bad = duplicatePhotoCheck([photo("1", "Front elevation", "A".repeat(64)), photo("2", "Rear elevation", H3)]);
check("a hash not in the stored shape counts as unhashed", bad.state === "not_checked" && bad.unhashed === 1);
check("a failed read says so, never a pass", /could not be read/.test(duplicateCheckSentence(null)));
check("a clear package says byte for byte, so nobody reads it as a visual comparison", /byte for byte/.test(duplicateCheckSentence(clear)));
check("and so does a duplicate", /byte for byte/.test(duplicateCheckSentence(dup)));

/* ---- where the hash comes from ---- */
const field = readFileSync("src/lib/ops-field.ts", "utf8");
const fn = field.slice(field.indexOf("export async function recordCapture("), field.indexOf("export async function", field.indexOf("export async function recordCapture(") + 10));
const download = fn.indexOf('.storage.from("eng-evidence").download(input.storageKey)');
const hashed = fn.indexOf("contentSha256 = sha256Hex(await stored.arrayBuffer());");
const upsert = fn.indexOf(".upsert(");
check("recordCapture reads the stored object back and hashes those bytes, before the row is written", download > 0 && hashed > download && upsert > hashed);
check("and writes that value, never one from the request", /content_sha256: contentSha256,/.test(fn) && !/input\.(sha256|contentSha256|hash)/i.test(fn));
check("a file that cannot be read back is refused, not recorded unhashed", /if \(readError \|\| !stored\) \{\s*return \{ ok: false,/.test(fn));
check("and a key outside this job's folder is refused before it is read", fn.indexOf("if (!input.storageKey.startsWith(`${fileId}/`))") > 0 && fn.indexOf("if (!input.storageKey.startsWith(`${fileId}/`))") < download);

const engineer = readFileSync("src/lib/ops-engineer.ts", "utf8");
check("the package reads the fingerprints in a read of its own, every row", /readEvery<\{ id: string; content_sha256: string \| null \}>\(\(from, to\) =>\s*db\.from\("eng_evidence_items"\)\.select\("id, content_sha256"\)\.eq\("file_id", fileId\)/.test(engineer));
check("and a failed read is null, which the screen says, never a pass", /const duplicates = !hashRead\.ok\s*\? null/.test(engineer));
const jobRead = field.search(/\.from\("eng_evidence_items"\)\s*\.select\(\s*"id, item_key, kind,/);
check("jobView's capture read is found", jobRead > 0);
check("and is untouched, so a failure costs one line rather than the package", jobRead > 0 && !/content_sha256/.test(field.slice(jobRead, jobRead + 400)));

const page = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("the engineer's package shows the sentence from its one home", (page.match(/\{duplicateCheckSentence\(selected\.duplicates\)\}/g) ?? []).length === 1);

const migration = readFileSync("supabase/migrations/0107_every_evidence_file_carries_its_sha256.sql", "utf8");
check("0107 adds the column and holds it to 64 lowercase hex characters", /add column if not exists content_sha256 text;/.test(migration) && /content_sha256 is null or content_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/.test(migration));
check("and drops nothing", !/\bdrop\s+(constraint|column|table|index)\b/i.test(migration.replace(/\/\*[\s\S]*?\*\//g, "")));

const lib = readFileSync("src/lib/evidence-fingerprint.ts", "utf8");
check("no geocoder and no location comparison is added", !/geocod|lat|lng|distance/i.test(lib.replace(/\/\*[\s\S]*?\*\//g, "")));

console.log(wrong === 0 ? "PASS: a duplicate photograph is found byte for byte, and an unhashed one leaves the package not checked." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
