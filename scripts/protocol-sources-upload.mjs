/**
 * PUT THE ENGINEER'S PRIVATE ORIGINALS INTO eng-protocol-sources, ON DEVELOPMENT.
 *
 *   npx tsx scripts/protocol-sources-upload.mjs
 *
 * Operator rulings 2026-10-22, migration 0080. Run once, after 0080 is on
 * development and before the three files leave the tree. For each entry in
 * src/content/protocols/private-sources.ts: the file at its path must match the
 * declared SHA-256 and size; it is uploaded with upsert OFF, so an object
 * already there is never overwritten; it is then downloaded again and the
 * download must match too. A second run reports each object as already present
 * and proves it by download, writing nothing.
 *
 * Development only: the client is neverProduction, and no flag changes that.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { auditClient } from "./lib/db-target.mjs";

const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../src/content/protocols/private-sources.ts");

const db = auditClient("the protocol source upload", { neverProduction: true });
if (!db) {
  console.log("REFUSED: no development database client. Nothing was uploaded.");
  process.exit(1);
}

const digest = (buf) => createHash("sha256").update(buf).digest("hex");
let wrong = 0;
for (const s of PRIVATE_SOURCES) {
  if (!existsSync(s.path)) {
    console.log(`  REFUSED: ${s.path} is not on disk to upload.`);
    wrong++;
    continue;
  }
  const local = readFileSync(s.path);
  if (local.length !== s.bytes || digest(local) !== s.sha256) {
    console.log(`  REFUSED: ${s.path} on disk is not the declared file (${local.length} bytes, ${digest(local).slice(0, 12)}).`);
    wrong++;
    continue;
  }
  const up = await db.storage
    .from(PROTOCOL_SOURCE_BUCKET)
    .upload(s.key, local, { contentType: s.contentType, upsert: false });
  const already = up.error && /exists|duplicate/i.test(up.error.message);
  if (up.error && !already) {
    console.log(`  FAIL: ${s.key} was not uploaded (${up.error.message}).`);
    wrong++;
    continue;
  }
  const down = await db.storage.from(PROTOCOL_SOURCE_BUCKET).download(s.key);
  const back = down.data ? Buffer.from(await down.data.arrayBuffer()) : null;
  const ok = back && back.length === s.bytes && digest(back) === s.sha256;
  if (!ok) wrong++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}: ${PROTOCOL_SOURCE_BUCKET}/${s.key} ${already ? "was already there" : "uploaded"}, ` +
      `read back ${back ? `${back.length} bytes, ${digest(back).slice(0, 12)}` : `nothing (${down.error?.message})`}`,
  );
}
console.log(wrong === 0 ? "\nAll three are in the private bucket and read back identical." : `\n${wrong} source(s) not in place.`);
process.exitCode = wrong === 0 ? 0 : 1;
