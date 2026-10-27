# Backups

Robert's addendum of 2026-10-25, 22:46 Central, item 11, in his words:

> 11. BACKUPS. Write a backup script that exports the production database and every object in the eng- storage buckets to an S3-compatible bucket, reading its credentials from environment variables only. Add a scheduled GitHub Actions workflow for it, nightly. Robert rules this one schedule an exception to his push-or-dispatch rule, because a backup must run on its own. It stays disabled until Robert creates the bucket and sets the secrets himself. Include a restore script and a documented test restore against development.

**State on 2026-10-27: built, switched off, never run against production.** Nothing here has read production. The workflow will not run until the steps under "Switching it on" are done, and those steps are Robert's.

## What is built

| File | What it does |
| --- | --- |
| `scripts/backup/production-backup.mjs` | Dumps the database with `pg_dump` (custom format), downloads every object in every `eng-` bucket, writes a manifest of sizes and SHA-256 hashes, tars and seals the lot, uploads it, then downloads it again and compares the hash. |
| `scripts/backup/restore-backup.mjs` | Verifies a backup by default: fetches it, opens it with the private key, checks every file against the manifest, and has `pg_restore` read the dump's table of contents. With `--apply` it restores into a project named twice, never production. |
| `scripts/lib/backup-plan.mjs` | The decisions both scripts make, as pure functions so they can be proven. |
| `.github/workflows/backup.yml` | Nightly at 08:17 UTC (03:17 Central), plus a manual run. Runs only when the repository variable `BACKUP_ENABLED` is `true`. |
| `scripts/proofs/a-backup-proves-what-it-kept.mjs` | 31 checks, no database and no network. Six injections were each run against it and each turned its own check red. |

`scripts/ci/workflow-triggers.mjs` allows `schedule` in `backup.yml` by name and in no other file. A schedule anywhere else still fails the board.

### What one run leaves in the bucket

Under `backups/<date>/<time>Z/`, so two runs never overwrite each other:

- `backup.sealed` holds the dump, every object and the manifest, in one tar, encrypted by `scripts/ci/seal.mjs` to the operator's public key (`scripts/ci/log-key.public`).
- `summary.json` holds counts and hashes. It names no object and no person.

### What it refuses, before reading anything

- A variable it needs is unset. It names the variable and never echoes a value.
- The database URL and `SUPABASE_URL` name different projects. The rows and the files must come from one project, or a restore would hold documents pointing at objects that do not exist.
- Production without `ALLOW_PRODUCTION_DB=1`, through `pairClient`, as everywhere else. The workflow sets it, because the workflow's job is production.
- A bucket listing that is missing any bucket the migration chain creates (11 today, read from the migrations).
- An object name that could leave its folder.

## Two properties to know before switching it on

**The backups are sealed, so only the private key opens them.** The dump holds every customer record and every sign-in's password hash, and the objects hold resumes and licences. Sealed, neither GitHub, nor the bucket's provider, nor anybody holding the bucket's keys can read a backup. **The cost: the private half lives in one place, `C:/Users/salon/.254-ci/log-key.pem` on Robert's PC, and if it is lost, every backup is unreadable.** It is the same key that opens the board's logs.

**The logs are public.** This repository is public, so anybody can read a workflow's log. The backup prints counts, sizes and hashes only, never an object name, because a key can carry a person's name.

## Switching it on (Robert)

1. **Create the bucket** at any S3-compatible provider. Give it its own access key, scoped to that bucket alone.
2. **Create a read-only Postgres role** on production for the dump, and build its connection string. A backup needs nothing more than read access, and the connection string is a password.
3. **Set these as GitHub Actions secrets** on `lendbucket/254engineering`:

   | Secret | Value |
   | --- | --- |
   | `BACKUP_SUPABASE_URL` | `https://fsaryeciduszuahgjbly.supabase.co` |
   | `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | production's service role key, used to read the storage buckets |
   | `BACKUP_DATABASE_URL` | the read-only role's connection string to the same project |
   | `BACKUP_S3_ENDPOINT` | the provider's S3 endpoint URL |
   | `BACKUP_S3_BUCKET` | the bucket's name |
   | `BACKUP_S3_REGION` | its region (`auto` where the provider has none) |
   | `BACKUP_S3_ACCESS_KEY_ID` | the bucket key's id |
   | `BACKUP_S3_SECRET_ACCESS_KEY` | the bucket key's secret |

   **This puts a production credential in GitHub Actions.** Until now, production credentials have lived only in Vercel (CLAUDE.md section 6b). The ruling to back up from a GitHub workflow is what places them there.
4. **Set the repository variable** `BACKUP_ENABLED` to `true` (Settings, Secrets and variables, Actions, Variables).
5. **Run it once by hand** from the Actions tab (backup, Run workflow) and read the last line. It must say `PASS: uploaded to backups/... and read back from the bucket ... hashes agree`.
6. **Do the test restore below** on that first backup.

To switch it off again, set `BACKUP_ENABLED` to anything else.

## The test restore

### Step 1: verify. This writes nothing anywhere

On the PC that holds the private key, with the bucket's four values set in the shell for that one command:

```
node scripts/backup/restore-backup.mjs --from s3://<bucket>/backups/<date>/<time>Z --key C:/Users/salon/.254-ci/log-key.pem
```

It needs the AWS CLI and PostgreSQL 17's `pg_restore` (or `PG_RESTORE` set to its path). It must end with `PASS: the backup opens and is whole`. The line above that reports how many `eng_` tables the dump holds data for, and how many objects matched the manifest.

### Step 2: restore into a project that is not production. Needs Robert's word at the time

```
node scripts/backup/restore-backup.mjs --from <same> --key <same> --apply --target-ref <ref>
```

This needs `RESTORE_DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the target. All three must name the target, and so must `--target-ref`. It runs `pg_restore --clean --if-exists --no-owner --no-privileges --schema=public`, then writes every object back and reads each one back to compare.

**Against development, read this first.** The ruling says the test restore is against development. Doing it **replaces development's public schema with production's, real customer records included**, on the database every audit and probe writes to. Development has held no real data since 2026-09-02, by design. A restore into a throwaway project, deleted afterwards, proves the same thing without that cost. Which target to use is Robert's ruling, asked below.

It **never** restores onto production. That refusal has no flag, and `ALLOW_PRODUCTION_DB` is not read there. A restore over the live database would be a sitting with Robert present, written as its own procedure when it is needed.

## Limits, said plainly

- **The dump is the whole database,** and production is shared with unrelated applications, so their tables are in it too. The restore takes only the `public` schema. Supabase's own `auth` and `storage` schemas are not restored, so restored rows that name a user point at sign-ins the target does not hold.
- **Only `eng-` buckets are backed up.** Other applications' buckets are not.
- **GitHub's scheduler is best effort.** A run can start late. On a public repository, GitHub also switches a schedule off after 60 days with no activity in the repository, so a quiet two months would stop the backups. The run history on the Actions tab is the check on that.
- **Nothing deletes old backups.** How long to keep them is a retention question, which is counsel's (the records retention period is outside this addendum).

## Questions for Robert, each with a recommendation

1. **Where does the test restore go?** Recommendation: a throwaway Supabase project, deleted after the test, rather than development, so real records never reach the database the probes use.
2. **Which key are the backups sealed to?** Recommendation: keep the log key for now, and put an offline copy of `log-key.pem` somewhere other than this PC today. A dedicated backup key pair can follow.
3. **Should the dump hold only the firm's tables?** Recommendation: yes, once wattsmith's move off the shared project is settled (BACKLOG.md). Until then, the whole database is the safer default for a backup.
