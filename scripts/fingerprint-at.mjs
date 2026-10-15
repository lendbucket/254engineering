/**
 * BOTH FINGERPRINTS AT ANY POINT IN THE CHAIN, FROM THE FILES ALONE.
 *
 * Replays supabase/migrations into an in process Postgres, stopping after each
 * migration named on the command line, and prints the shape and behaviour
 * fingerprints it produced. No database and no credentials.
 *
 *   npx tsx scripts/fingerprint-at.mjs 0037 0041
 *
 * WHAT IT IS FOR. The cutover plan's read-backs are re-derived from this on the
 * day they run, and it is what found the 2026-09-11 finding that a behaviour
 * digest cannot byte match a live Supabase project: PGlite is PostgreSQL 18.3
 * and production is 17.6, so conbin::text renders differently, and the three
 * function bodies carrying SQL comments are stored on production with those
 * comments stripped. The reasoning is in supabase/applied.mjs.
 *
 * SO COMPARE THE SHAPE DIGEST WHOLE, and compare behaviour against a LIVE
 * project by the seven portable kinds plus counts and names for ck and fn.
 * Against another replay, both digests compare whole.
 *
 * It lived at the repository root until 2026-09-11, which is where a leftover
 * looks exactly like a tool.
 */
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "./lib/read-source.mjs";
import { SHAPE_SQL, behaviourSqlFull, digestOf } from "./lib/fingerprints.mjs";
import { SUPABASE_REPLAY_STUBS as STUBS } from "./lib/replay-stubs.mjs";
const DIR = "supabase/migrations";
const md5 = (s) => createHash("md5").update(s).digest("hex");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const stops = process.argv.slice(2);
for (const stop of stops) {
  const db = new PGlite();
  await db.exec(STUBS);
  for (const f of files) { await db.exec(readSource(join(DIR, f))); if (f.startsWith(stop)) break; }
  const sh = await db.query(SHAPE_SQL);
  const be = await db.query(behaviourSqlFull());
  console.log(`${stop}  shape ${md5(digestOf(sh.rows))} / ${sh.rows.length} cols   behaviour ${md5(digestOf(be.rows))} / ${be.rows.length} facts`);
  await db.close();
}
process.exit(0);
