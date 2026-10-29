/**
 * THE STORAGE BUCKETS THE MIGRATION CHAIN CREATES, READ FROM THE MIGRATION
 * FILES THEMSELVES.
 *
 * scripts/copy-project.mjs carried a typed list of buckets, and it fell six
 * behind the chain: eng-documents, eng-seals, eng-partner-branding,
 * eng-protocol-sources, eng-insurance and eng-engineer-drafts were created by
 * migrations and absent from the list, with nothing comparing the two
 * (BACKLOG, "COPY-PROJECT'S BUCKET LIST IS SIX BUCKETS BEHIND THE CHAIN"). A
 * cutover run would have copied five buckets of twelve and agreed with itself.
 *
 * So the list is derived from the declaration that creates the buckets, the
 * same idiom migration-audit uses for the buckets the code names. A new bucket
 * in a new migration is copied without anybody remembering to type it here.
 *
 * And it is not trusted on its own: migration-audit compares this parse with
 * the buckets a real replay of the chain holds, so a bucket created in a shape
 * this parse cannot read turns the board red instead of being skipped.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const INSERT = /insert\s+into\s+storage\.buckets\s*\([^)]*\)\s*values\s*\(\s*'([a-z0-9][a-z0-9-]*)'/gi;

/** Every bucket id an `insert into storage.buckets` in the chain names, sorted and once each. */
export function chainBuckets(root = process.cwd()) {
  const dir = join(root, "supabase", "migrations");
  const found = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (const m of sql.matchAll(INSERT)) found.add(m[1]);
  }
  return [...found].sort();
}
