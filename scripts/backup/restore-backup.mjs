/**
 * THE RESTORE. Robert's addendum of 2026-10-25, 22:46 Central, item 11: a
 * restore script and a documented test restore against development. The
 * procedure is docs/backups.md; read it before --apply.
 *
 *   node scripts/backup/restore-backup.mjs --file <backup.sealed> --key <private.pem>
 *   node scripts/backup/restore-backup.mjs --from <s3 prefix> --key <private.pem>
 *       verify only: open the backup, check every file against the manifest,
 *       and have pg_restore read the dump's table of contents. Writes nothing
 *       anywhere but a temporary folder it removes.
 *
 *   ... --apply --target-ref <ref>
 *       restore into the project named by RESTORE_DATABASE_URL and
 *       SUPABASE_URL, which must both name <ref>.
 *
 * WHAT IT NEVER DOES, AND NO FLAG CHANGES IT: restore onto production. A
 * restore over the live database is a sitting with Robert present, written as
 * its own procedure when it is needed, because it replaces every row the firm
 * holds. ALLOW_PRODUCTION_DB is not read here, so setting it opens nothing.
 *
 * AND --apply MUST NAME ITS TARGET TWICE: --target-ref on the command line and
 * the same ref in both credentials. A restore aimed by an environment variable
 * alone is one stale shell away from the wrong database.
 *
 * It prints no object or person names, for the reason the backup gives.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_REF, pairClient, refOf } from "../lib/db-target.mjs";
import { manifestProblems, missingEnv, refOfDatabaseUrl, sameProject, sha256 } from "../lib/backup-plan.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const SEAL = join(REPO, "scripts/ci/seal.mjs");

class Refusal extends Error {}
function stop(message) {
  throw new Refusal(message);
}
function refuseAndExit(e) {
  console.log(`REFUSED: ${e instanceof Refusal ? e.message : `an unexpected error: ${e?.message ?? e}`}`);
  process.exit(1);
}
process.on("uncaughtException", refuseAndExit);

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? "" : null;
};
const FILE = opt("--file");
const FROM = opt("--from");
const KEY = opt("--key");
const APPLY = args.includes("--apply");
const TARGET_REF = opt("--target-ref");

/* ---------------------------------------- the target, refused before anything */

if (APPLY) {
  if (!TARGET_REF) stop("--apply needs --target-ref, the project being restored into, named on the command line.");
  if (TARGET_REF === PRODUCTION_REF) stop("this script never restores onto production, and no flag changes that.");
  const missing = missingEnv(process.env, ["RESTORE_DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length) stop(`these are not set: ${missing.join(", ")}. Nothing was written.`);
  const supabaseRef = refOf(process.env.SUPABASE_URL);
  const databaseRef = refOfDatabaseUrl(process.env.RESTORE_DATABASE_URL);
  if (supabaseRef === PRODUCTION_REF || databaseRef === PRODUCTION_REF) {
    stop("a credential names production, and this script never restores onto production.");
  }
  const agree = sameProject(supabaseRef, databaseRef);
  if (!agree.ok) stop(`${agree.reason}. Nothing was written.`);
  if (supabaseRef !== TARGET_REF) stop(`--target-ref says ${TARGET_REF} and the credentials name ${supabaseRef}. Nothing was written.`);
}
if (!KEY) stop("--key is needed: a backup opens only with the private key it was sealed to.");
if (!FILE === !FROM) stop("give exactly one of --file and --from.");

const PG_RESTORE = process.env.PG_RESTORE || "pg_restore";
const work = mkdtempSync(join(tmpdir(), "254-restore-"));

function run(cmd, argv, env = process.env) {
  const r = spawnSync(cmd, argv, { env, encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.error) stop(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0) stop(`${cmd} exited ${r.status}: ${(r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" | ")}`);
  return r.stdout;
}

try {
  /* ------------------------------------------------------------- fetch it */

  let sealedFile = FILE;
  let summary = null;
  if (FROM) {
    const missing = missingEnv(process.env, ["BACKUP_S3_ENDPOINT", "BACKUP_S3_REGION", "BACKUP_S3_ACCESS_KEY_ID", "BACKUP_S3_SECRET_ACCESS_KEY"]);
    if (missing.length) stop(`these are not set: ${missing.join(", ")}.`);
    const s3env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: process.env.BACKUP_S3_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
      AWS_DEFAULT_REGION: process.env.BACKUP_S3_REGION,
    };
    const endpoint = ["--endpoint-url", process.env.BACKUP_S3_ENDPOINT, "--only-show-errors"];
    sealedFile = join(work, "backup.sealed");
    run("aws", ["s3", "cp", `${FROM.replace(/\/$/, "")}/backup.sealed`, sealedFile, ...endpoint], s3env);
    run("aws", ["s3", "cp", `${FROM.replace(/\/$/, "")}/summary.json`, join(work, "summary.json"), ...endpoint], s3env);
    summary = JSON.parse(readFileSync(join(work, "summary.json"), "utf8"));
    const got = sha256(readFileSync(sealedFile));
    if (got !== summary.sealed.sha256) stop(`the sealed file hashes to ${got} and its summary says ${summary.sealed.sha256}`);
  }

  /* ------------------------------------------------------------- open it */

  const tarFile = join(work, "backup.tgz");
  run(process.execPath, [SEAL, "open", sealedFile, tarFile, KEY]);
  const stage = join(work, "stage");
  mkdirSync(stage);
  run("tar", ["--force-local", "-xzf", tarFile, "-C", stage]);
  const manifest = JSON.parse(readFileSync(join(stage, "manifest.json"), "utf8"));
  const problems = manifestProblems(manifest, stage);
  if (problems.length) stop(`the backup does not match its own manifest: ${problems.join("; ")}`);
  if (summary && summary.objects !== manifest.objects.length) {
    stop(`the summary says ${summary.objects} objects and the manifest lists ${manifest.objects.length}`);
  }

  /* pg_restore reading the table of contents proves the dump is a dump, not only a file with the right hash. */
  const toc = run(PG_RESTORE, ["--list", join(stage, "database.dump")]);
  const firmTables = toc.split("\n").filter((l) => / TABLE DATA public eng_/.test(l)).length;
  if (firmTables === 0) stop("the dump's table of contents holds no eng_ table data");
  console.log(
    `verified: backup of ${manifest.project} taken ${manifest.createdAt}; the dump (${manifest.database.bytes} bytes) lists ` +
      `${firmTables} eng_ table(s) with data; ${manifest.objects.length} object(s) in ${Object.keys(manifest.buckets).length} bucket(s), every one matching the manifest.`,
  );

  if (!APPLY) {
    console.log("PASS: the backup opens and is whole. Nothing was restored (add --apply and --target-ref to restore).");
  } else {
    /* ------------------------------------------------------------- restore it */

    const db = pairClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, "destination", "the restore");
    run(PG_RESTORE, [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--schema=public",
      "--no-password",
      `--dbname=${process.env.RESTORE_DATABASE_URL}`,
      join(stage, "database.dump"),
    ]);
    console.log(`database: the public schema restored into ${TARGET_REF}`);

    let restored = 0;
    for (const o of manifest.objects) {
      const buf = readFileSync(join(stage, o.file));
      const { error } = await db.storage.from(o.bucket).upload(o.name, buf, { upsert: true });
      if (error) stop(`object ${o.index} could not be written back: ${error.message}`);
      restored += 1;
    }
    /* Read every object back, because a write that reported success is a claim. */
    for (const o of manifest.objects) {
      const { data, error } = await db.storage.from(o.bucket).download(o.name);
      if (error || !data) stop(`object ${o.index} could not be read back`);
      if (sha256(Buffer.from(await data.arrayBuffer())) !== o.sha256) stop(`object ${o.index} read back with different bytes`);
    }
    console.log(`PASS: restored into ${TARGET_REF}: the public schema and ${restored} object(s), every object read back matching.`);
  }
} catch (e) {
  rmSync(work, { recursive: true, force: true });
  refuseAndExit(e);
} finally {
  rmSync(work, { recursive: true, force: true });
}
