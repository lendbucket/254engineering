/**
 * MIGRATION 0065 IS EXACTLY WHAT ITS GENERATOR WRITES FROM THE PDFs.
 *
 *   node scripts/proofs/the-seven-drafts-are-what-the-generator-writes.mjs
 *
 * 0065 enters Aman's seven v1.1 protocols as drafts, each carrying the digest of
 * its PDF. It says "not hand edited", and that sentence is only true if
 * something checks it: the generator is run in check mode, which hashes every
 * PDF again, rebuilds the SQL, and reports UNCHANGED only when the committed
 * file is byte for byte what it would write. A digest typed by hand, a status
 * other than draft, or a PDF replaced on disk all fail here.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const r = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "scripts/emit-received-protocols-migration.mjs"],
  { encoding: "utf8" },
);
const said = `${r.stdout}${r.stderr}`.trim().split(/\r?\n/).pop() ?? "";
check("the generator, run again from the PDFs, would write exactly the committed 0065", r.status === 0 && /^UNCHANGED/.test(said), said.slice(0, 160));

const sql = readFileSync("supabase/migrations/0065_seven_protocols_enter_as_drafts.sql", "utf8");
const statuses = [...sql.matchAll(/'1\.1', '([a-z_]+)', /g)].map((m) => m[1]);
check("all seven inserts are drafts, and nothing else", statuses.length === 7 && statuses.every((s) => s === "draft"), statuses.join(", "));
check("and no insert carries a signature date", !/document_signed_at[\s\S]*?'\d{4}-\d{2}-\d{2}T/.test(sql));

console.log("");
if (wrong === 0) {
  console.log("PASS: 0065 is what the generator writes from the seven PDFs, and it seeds seven drafts.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
