/**
 * PROOF: THE BACKUP KEEPS ONE PROJECT WHOLE, SAYS SO ONLY WHEN IT CAN, AND THE
 * RESTORE NEVER TOUCHES PRODUCTION. Robert's addendum of 2026-10-25, 22:46
 * Central, item 11.
 *
 * Nothing here reaches a database, a bucket or the network: every refusal is
 * one the scripts make before they read anything, and the manifest is checked
 * against files this proof writes to a temporary folder. The run against real
 * storage is the documented procedure in docs/backups.md, not this file.
 *
 *   A  a database URL is read for its project in both of Supabase's shapes,
 *      and anything else is unrecognised rather than safe
 *   B  the rows and the objects must come from one project
 *   C  only eng- buckets are kept, and the chain's buckets are read from the
 *      migrations, so a listing missing one can be refused
 *   D  an object name that could leave its folder is refused
 *   E  the manifest check finds a changed byte, a missing file, an extra file
 *      and a count that does not add up, and passes a whole backup
 *   F  the backup refuses, before anything is read: a missing variable (named,
 *      its neighbours' values never echoed), two projects, and production
 *      without ALLOW_PRODUCTION_DB
 *   G  the restore refuses production by --target-ref and by credential, with
 *      ALLOW_PRODUCTION_DB=1 set, and refuses a target named only once
 *   H  the trigger check allows a schedule in backup.yml and nowhere else
 *
 * F AND G RUN THE REAL SCRIPTS IN A CHILD PROCESS, from a temporary working
 * folder, so no .env.local is loaded and nothing on this machine is reached.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
const PROD = "fsaryeciduszuahgjbly";
const DEV = "ythzaiqeoijlrdibnieo";
const SECRET = "not-a-real-secret-7f3a91";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const scratch = mkdtempSync(join(tmpdir(), "254-backup-proof-"));

function runScript(script, argv, env) {
  const r = spawnSync(process.execPath, [join(REPO, script), ...argv], {
    cwd: scratch,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    encoding: "utf8",
    timeout: 60000,
  });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

try {
  /* ------------------------------------------------------------------ A */
  check("a direct database URL names its project", refOfDatabaseUrl(`postgresql://postgres:${SECRET}@db.${PROD}.supabase.co:5432/postgres`) === PROD);
  check(
    "a pooler URL names its project by its user",
    refOfDatabaseUrl(`postgres://postgres.${DEV}:${SECRET}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`) === DEV,
  );
  check("a pooler user on a host that is not Supabase's names nothing", refOfDatabaseUrl(`postgres://postgres.${PROD}:x@example.com/postgres`) === null);
  check("a URL that is not Postgres names nothing", refOfDatabaseUrl(`https://${PROD}.supabase.co`) === null);
  check("garbage names nothing", refOfDatabaseUrl("not a url") === null && refOfDatabaseUrl(undefined) === null);

  /* ------------------------------------------------------------------ B */
  check("one project agrees with itself", sameProject(PROD, PROD).ok === true);
  const split = sameProject(DEV, PROD);
  check("two projects are refused, naming both", !split.ok && split.reason.includes(DEV) && split.reason.includes(PROD), split.reason);
  check("an unrecognised side is refused", !sameProject(PROD, null).ok && !sameProject(null, PROD).ok);

  /* ------------------------------------------------------------------ C */
  check("only eng- buckets are kept", JSON.stringify(firmBuckets(["avatars", "eng-seals", "eng-uploads", "eng-seals", "wattsmith-files"])) === '["eng-seals","eng-uploads"]');
  const chain = bucketsTheChainCreates(join(REPO, "supabase/migrations"));
  check("the chain's buckets are read from the migrations", chain.length >= 11 && chain.includes("eng-seals") && chain.includes("eng-uploads"), `${chain.length} bucket(s)`);
  check("a run's prefix is dated in UTC to the second", backupPrefix("2026-10-27T03:17:05-05:00") === "backups/2026-10-27/081705Z");

  /* ------------------------------------------------------------------ D */
  check("an ordinary nested name is kept", safeObjectPath("254/abc/resume.pdf") === "254/abc/resume.pdf");
  check(
    "a name that climbs, is absolute, carries a drive or a backslash, or has an empty part is refused",
    ["../x", "a/../b", "/etc/x", "C:x", "a\\b", "a//b", "./a", ""].every((n) => safeObjectPath(n) === null),
  );

  /* ------------------------------------------------------------------ E */
  const stage = join(scratch, "stage");
  mkdirSync(join(stage, "storage/eng-seals"), { recursive: true });
  const dump = Buffer.from("PGDMP fixture");
  const obj = Buffer.from("%PDF fixture");
  writeFileSync(join(stage, "database.dump"), dump);
  writeFileSync(join(stage, "storage/eng-seals/a.pdf"), obj);
  const manifest = {
    database: { file: "database.dump", bytes: dump.length, sha256: sha256(dump) },
    buckets: { "eng-seals": { objects: 1 } },
    objects: [{ index: 0, bucket: "eng-seals", name: "a.pdf", file: "storage/eng-seals/a.pdf", bytes: obj.length, sha256: sha256(obj) }],
  };
  writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest));
  check("a whole backup has no problems", manifestProblems(manifest, stage).length === 0, manifestProblems(manifest, stage).join("; "));

  writeFileSync(join(stage, "storage/eng-seals/a.pdf"), Buffer.from("%PDF fixturE"));
  const changed = manifestProblems(manifest, stage);
  check("a changed byte is found", changed.some((p) => p.includes("object 0") && p.includes("hash")), changed.join("; "));

  unlinkSync(join(stage, "storage/eng-seals/a.pdf"));
  check("a missing object is found", manifestProblems(manifest, stage).some((p) => p === "object 0 is missing"));
  writeFileSync(join(stage, "storage/eng-seals/a.pdf"), obj);

  writeFileSync(join(stage, "storage/eng-seals/extra.pdf"), obj);
  check("a file the manifest does not name is found", manifestProblems(manifest, stage).some((p) => p.includes("does not name")));
  unlinkSync(join(stage, "storage/eng-seals/extra.pdf"));

  check(
    "bucket counts that do not add to the object list are found",
    manifestProblems({ ...manifest, buckets: { "eng-seals": { objects: 2 } } }, stage).some((p) => p.includes("add to 2")),
  );
  check("a manifest with no database entry is refused", manifestProblems({ objects: [] }, stage).length === 1);

  /* ------------------------------------------------------------------ F */
  check("missingEnv names only what is unset", JSON.stringify(missingEnv({ A: "x", B: " ", C: "" }, ["A", "B", "C", "D"])) === '["B","C","D"]');

  const unset = runScript("scripts/backup/production-backup.mjs", [], {
    SUPABASE_URL: `https://${PROD}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
  });
  check(
    "the backup names a missing variable and echoes no value",
    unset.status === 1 && unset.out.includes("REFUSED") && unset.out.includes("BACKUP_DATABASE_URL") && !unset.out.includes(SECRET),
    unset.out.trim().split("\n")[0],
  );

  const s3 = {
    BACKUP_S3_ENDPOINT: "https://s3.invalid",
    BACKUP_S3_BUCKET: "proof",
    BACKUP_S3_REGION: "auto",
    BACKUP_S3_ACCESS_KEY_ID: "proof",
    BACKUP_S3_SECRET_ACCESS_KEY: SECRET,
  };
  const twoProjects = runScript("scripts/backup/production-backup.mjs", [], {
    ...s3,
    SUPABASE_URL: `https://${DEV}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    BACKUP_DATABASE_URL: `postgresql://postgres:${SECRET}@db.${PROD}.supabase.co:5432/postgres`,
    ALLOW_PRODUCTION_DB: "1",
  });
  check(
    "the backup refuses rows and objects from two projects, and echoes no credential",
    twoProjects.status === 1 && twoProjects.out.includes("different projects") && !twoProjects.out.includes(SECRET),
    twoProjects.out.trim().split("\n")[0],
  );

  const unflagged = runScript("scripts/backup/production-backup.mjs", [], {
    ...s3,
    SUPABASE_URL: `https://${PROD}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    BACKUP_DATABASE_URL: `postgres://postgres.${PROD}:${SECRET}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  });
  check(
    "the backup refuses production without ALLOW_PRODUCTION_DB=1",
    unflagged.status === 1 && unflagged.out.includes("PRODUCTION") && !unflagged.out.includes(SECRET),
    unflagged.out.trim().split("\n").find((l) => l.includes("REFUSED")),
  );

  /* ------------------------------------------------------------------ G */
  const key = join(scratch, "unused.pem");
  /* The credentials name DEVELOPMENT here, so only the --target-ref refusal can produce this sentence. */
  const toProduction = runScript("scripts/backup/restore-backup.mjs", ["--file", "x", "--key", key, "--apply", "--target-ref", PROD], {
    ALLOW_PRODUCTION_DB: "1",
    SUPABASE_URL: `https://${DEV}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    RESTORE_DATABASE_URL: `postgresql://postgres:${SECRET}@db.${DEV}.supabase.co:5432/postgres`,
  });
  check(
    "the restore refuses production by --target-ref, with ALLOW_PRODUCTION_DB=1 set",
    toProduction.status === 1 && toProduction.out.includes("no flag changes that"),
    toProduction.out.trim(),
  );

  const credentialProduction = runScript("scripts/backup/restore-backup.mjs", ["--file", "x", "--key", key, "--apply", "--target-ref", DEV], {
    ALLOW_PRODUCTION_DB: "1",
    SUPABASE_URL: `https://${DEV}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    RESTORE_DATABASE_URL: `postgresql://postgres:${SECRET}@db.${PROD}.supabase.co:5432/postgres`,
  });
  check(
    "the restore refuses a credential naming production, whatever --target-ref says",
    credentialProduction.status === 1 && credentialProduction.out.includes("a credential names production") && !credentialProduction.out.includes(SECRET),
    credentialProduction.out.trim(),
  );

  const namedOnce = runScript("scripts/backup/restore-backup.mjs", ["--file", "x", "--key", key, "--apply"], {
    SUPABASE_URL: `https://${DEV}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    RESTORE_DATABASE_URL: `postgresql://postgres:${SECRET}@db.${DEV}.supabase.co:5432/postgres`,
  });
  check("the restore refuses a target named only by its credentials", namedOnce.status === 1 && namedOnce.out.includes("--target-ref"), namedOnce.out.trim());

  const otherRef = runScript("scripts/backup/restore-backup.mjs", ["--file", "x", "--key", key, "--apply", "--target-ref", "kmiwxtbtqrlorxfogtht"], {
    SUPABASE_URL: `https://${DEV}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: SECRET,
    RESTORE_DATABASE_URL: `postgresql://postgres:${SECRET}@db.${DEV}.supabase.co:5432/postgres`,
  });
  check("the restore refuses a --target-ref its credentials do not name", otherRef.status === 1 && otherRef.out.includes("--target-ref says"), otherRef.out.trim());

  /* ------------------------------------------------------------------ H */
  const flows = (name, files) => {
    const d = join(scratch, name);
    mkdirSync(d);
    for (const [f, text] of Object.entries(files)) writeFileSync(join(d, f), text);
    return runScript("scripts/ci/workflow-triggers.mjs", [d], {});
  };
  const scheduled = 'on:\n  schedule:\n    - cron: "17 8 * * *"\n  workflow_dispatch:\njobs: {}\n';
  const pushed = "on:\n  push:\njobs: {}\n";
  const ruled = flows("ruled", { "backup.yml": scheduled, "board.yml": pushed });
  check("a schedule in backup.yml passes, and says the exception was applied", ruled.status === 0 && ruled.out.includes("exception: backup.yml"), ruled.out.trim());
  const elsewhere = flows("elsewhere", { "backup.yml": scheduled, "board.yml": scheduled });
  check("a schedule in any other file still fails by name", elsewhere.status === 1 && elsewhere.out.includes("board.yml triggers on schedule"), elsewhere.out.trim());
  const gone = flows("gone", { "board.yml": pushed });
  check("an exception naming a file that is not there fails", gone.status === 1 && gone.out.includes("names backup.yml"), gone.out.trim());
  const real = runScript("scripts/ci/workflow-triggers.mjs", [join(REPO, ".github/workflows")], {});
  check("the repository's own workflows pass", real.status === 0, real.out.trim().split("\n")[0]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the backup keeps one project whole and says so only when it can, and the restore never touches production.");
} else {
  console.log(`FAIL: ${wrong} check(s) above.`);
  process.exit(1);
}
