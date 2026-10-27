/**
 * THE NIGHTLY BACKUP. Robert's addendum of 2026-10-25, 22:46 Central, item 11:
 * export the production database and every object in the eng- storage buckets
 * to an S3-compatible bucket, reading its credentials from environment
 * variables only. Run by .github/workflows/backup.yml, which stays switched off
 * until Robert creates the bucket and sets the secrets himself. The procedure,
 * the setup and the test restore are in docs/backups.md.
 *
 *   node scripts/backup/production-backup.mjs            to the bucket
 *   node scripts/backup/production-backup.mjs --local D  to a folder, nothing uploaded
 *
 * WHAT ONE RUN LEAVES IN THE BUCKET, under backups/<date>/<time>Z/:
 *   backup.sealed  the dump, every object and the manifest, in one tar, SEALED
 *                  to the operator's public key by scripts/ci/seal.mjs
 *   summary.json   counts and hashes, and no name of any object or person
 *
 * WHY SEALED. The dump holds every customer record and every sign in's
 * password hash, and the objects hold resumes and licences. Sealed to a public
 * key, neither the runner, nor the bucket's provider, nor anybody holding the
 * bucket's credentials can read a backup: only the private key can, and it
 * lives with the operator and nowhere else. The cost is written in
 * docs/backups.md: lose that key and every backup is unreadable.
 *
 * WHY IT PRINTS NO NAMES. This repository is public, so its workflow logs are
 * readable by anybody. An object key can carry a person's name, so the log
 * says counts, sizes and hashes and nothing else.
 *
 * WHAT IT REFUSES, each before anything is read:
 *   - any variable it needs is unset (named, never echoed)
 *   - the database URL and SUPABASE_URL name different projects
 *   - production without ALLOW_PRODUCTION_DB=1, through pairClient
 *   - a bucket listing missing any bucket the migration chain creates
 *   - an object name that could climb out of its folder
 * And after the upload it reads the sealed file BACK from the bucket and
 * compares its hash, because an upload that reported success is a claim.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pairClient, refOf } from "../lib/db-target.mjs";
import { walkBucket } from "../lib/bucket-walk.mjs";
import {
  backupPrefix,
  bucketsTheChainCreates,
  firmBuckets,
  manifestProblems,
  missingEnv,
  refOfDatabaseUrl,
  safeObjectPath,
  sameProject,
  sha256,
} from "../lib/backup-plan.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const SEAL = join(REPO, "scripts/ci/seal.mjs");
const args = process.argv.slice(2);
const localAt = args.indexOf("--local");
const LOCAL_DIR = localAt >= 0 ? args[localAt + 1] : null;

/*
 * A refusal THROWS rather than exiting, so the finally below always removes
 * the staged copy. An exit inside the try would skip it and leave an
 * unencrypted dump in the temporary folder of whatever machine ran this.
 */
class Refusal extends Error {}
function stop(message) {
  throw new Refusal(message);
}
function refuseAndExit(e) {
  console.log(`REFUSED: ${e instanceof Refusal ? e.message : `an unexpected error: ${e?.message ?? e}`}`);
  process.exit(1);
}
process.on("uncaughtException", refuseAndExit);

/* ------------------------------------------------------------- the inputs */

const NEEDED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BACKUP_DATABASE_URL"];
const NEEDED_FOR_THE_BUCKET = [
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_REGION",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
];
if (localAt >= 0 && !LOCAL_DIR) stop("--local needs a folder");
const missing = missingEnv(process.env, LOCAL_DIR ? NEEDED : [...NEEDED, ...NEEDED_FOR_THE_BUCKET]);
if (missing.length) stop(`these are not set: ${missing.join(", ")}. Nothing was read.`);

const agree = sameProject(refOf(process.env.SUPABASE_URL), refOfDatabaseUrl(process.env.BACKUP_DATABASE_URL));
if (!agree.ok) stop(`${agree.reason}. Nothing was read.`);

/* Production needs ALLOW_PRODUCTION_DB=1, exactly, as everywhere else. */
const db = pairClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, "source", "the backup");

const PG_DUMP = process.env.PG_DUMP || "pg_dump";
const work = mkdtempSync(join(tmpdir(), "254-backup-"));
const stage = join(work, "stage");
mkdirSync(join(stage, "storage"), { recursive: true });
const startedAt = new Date();

function run(cmd, argv, env = process.env) {
  const r = spawnSync(cmd, argv, { env, encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.error) stop(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0) stop(`${cmd} exited ${r.status}: ${(r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" | ")}`);
  return r.stdout;
}

try {
  /* ------------------------------------------------------------ the database */

  const version = run(PG_DUMP, ["--version"]).trim();
  const dumpFile = join(stage, "database.dump");
  run(PG_DUMP, ["--format=custom", "--no-password", `--file=${dumpFile}`, `--dbname=${process.env.BACKUP_DATABASE_URL}`]);
  const dump = readFileSync(dumpFile);
  console.log(`database: ${dump.length} bytes in custom format (${version})`);

  /* ------------------------------------------------------------- the objects */

  const { data: listed, error: listError } = await db.storage.listBuckets();
  if (listError) stop(`the buckets could not be listed: ${listError.message}`);
  const buckets = firmBuckets((listed ?? []).map((b) => b.name));
  const expected = bucketsTheChainCreates(join(REPO, "supabase/migrations"));
  if (expected.length === 0) stop("no bucket was found in the migration chain, so completeness cannot be checked");
  const absent = expected.filter((b) => !buckets.includes(b));
  if (absent.length) stop(`the listing is missing ${absent.length} bucket(s) the migration chain creates (${absent.join(", ")})`);

  const manifest = {
    createdAt: startedAt.toISOString(),
    project: refOf(process.env.SUPABASE_URL),
    pgDump: version,
    database: { file: "database.dump", bytes: dump.length, sha256: sha256(dump) },
    buckets: {},
    objects: [],
  };
  for (const bucket of buckets) {
    const files = await walkBucket(db, bucket);
    for (const f of files) {
      const rel = safeObjectPath(f.name);
      if (!rel) stop(`an object in ${bucket} has a name that could leave its folder (object ${manifest.objects.length})`);
      const { data: blob, error } = await db.storage.from(bucket).download(f.name);
      if (error || !blob) stop(`an object in ${bucket} could not be downloaded (object ${manifest.objects.length})`);
      const buf = Buffer.from(await blob.arrayBuffer());
      const file = `storage/${bucket}/${rel}`;
      mkdirSync(dirname(join(stage, file)), { recursive: true });
      writeFileSync(join(stage, file), buf);
      manifest.objects.push({ index: manifest.objects.length, bucket, name: f.name, file, bytes: buf.length, sha256: sha256(buf) });
    }
    manifest.buckets[bucket] = { objects: files.length };
    console.log(`${bucket.padEnd(22)} ${String(files.length).padStart(5)} object(s)`);
  }
  writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

  /* The staged copy is checked against its own manifest before it is sealed. */
  const problems = manifestProblems(manifest, stage);
  if (problems.length) stop(`the staged backup does not match its manifest: ${problems.join("; ")}`);

  /* ------------------------------------------------------------- seal it */

  const tarFile = join(work, "backup.tgz");
  run("tar", ["--force-local", "-czf", tarFile, "-C", stage, "."]);
  const sealedFile = join(work, "backup.sealed");
  run(process.execPath, [SEAL, "seal", tarFile, sealedFile]);
  const sealed = readFileSync(sealedFile);
  const summary = {
    createdAt: manifest.createdAt,
    project: manifest.project,
    sealed: { bytes: sealed.length, sha256: sha256(sealed) },
    database: { bytes: dump.length, sha256: manifest.database.sha256 },
    objects: manifest.objects.length,
    buckets: Object.fromEntries(Object.entries(manifest.buckets).map(([k, v]) => [k, v.objects])),
  };
  writeFileSync(join(work, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`sealed: ${sealed.length} bytes, sha256 ${summary.sealed.sha256}; ${manifest.objects.length} object(s) in ${buckets.length} bucket(s)`);

  /* ------------------------------------------------------------- deliver it */

  const prefix = backupPrefix(startedAt);
  if (LOCAL_DIR) {
    const out = join(LOCAL_DIR, prefix);
    mkdirSync(out, { recursive: true });
    copyFileSync(sealedFile, join(out, "backup.sealed"));
    copyFileSync(join(work, "summary.json"), join(out, "summary.json"));
    const back = readFileSync(join(out, "backup.sealed"));
    if (sha256(back) !== summary.sealed.sha256) stop("the copy in the folder does not hash to what was sealed");
    console.log(`PASS: written to ${prefix} in the folder and read back, hashes agree. Nothing was uploaded.`);
  } else {
    const s3env = {
      ...process.env,
      AWS_ACCESS_KEY_ID: process.env.BACKUP_S3_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
      AWS_DEFAULT_REGION: process.env.BACKUP_S3_REGION,
    };
    const target = `s3://${process.env.BACKUP_S3_BUCKET}/${prefix}`;
    const endpoint = ["--endpoint-url", process.env.BACKUP_S3_ENDPOINT, "--only-show-errors"];
    run("aws", ["s3", "cp", sealedFile, `${target}/backup.sealed`, ...endpoint], s3env);
    run("aws", ["s3", "cp", join(work, "summary.json"), `${target}/summary.json`, ...endpoint], s3env);

    /* THE READ-BACK. An upload that said it worked is a claim until the bytes come back. */
    const back = join(work, "readback.sealed");
    run("aws", ["s3", "cp", `${target}/backup.sealed`, back, ...endpoint], s3env);
    const backHash = sha256(readFileSync(back));
    if (backHash !== summary.sealed.sha256) stop(`the bucket returned a file hashing to ${backHash}, not ${summary.sealed.sha256}`);
    console.log(`PASS: uploaded to ${prefix} and read back from the bucket, ${statSync(back).size} bytes, hashes agree.`);
  }
} catch (e) {
  rmSync(work, { recursive: true, force: true });
  refuseAndExit(e);
} finally {
  rmSync(work, { recursive: true, force: true });
}
