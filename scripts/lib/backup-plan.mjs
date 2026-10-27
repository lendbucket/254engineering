/**
 * THE PARTS OF A BACKUP THAT CAN BE PROVEN WITHOUT A DATABASE. Robert's
 * addendum of 2026-10-25, 22:46 Central, item 11: a nightly export of the
 * production database and every object in the eng- buckets to an
 * S3-compatible bucket, credentials from the environment only, with a restore.
 *
 * Every decision the two scripts in scripts/backup/ make about WHAT they are
 * allowed to touch lives here, as pure functions, so
 * scripts/proofs/a-backup-proves-what-it-kept.mjs can exercise each one. A
 * check that only runs inside a script that exits on load is a check nothing
 * can test (see the header of scripts/lib/bucket-walk.mjs, which learned that
 * the expensive way).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The project a Postgres connection string names, or null.
 *
 * Supabase hands out two shapes. The direct one carries the ref in the HOST,
 * db.<ref>.supabase.co. The pooler carries it in the USER, postgres.<ref>, on
 * a host that names only the region. Anything else is an unrecognised
 * database, which is never read as safe.
 */
export function refOfDatabaseUrl(url) {
  let u;
  try {
    u = new URL(String(url ?? ""));
  } catch {
    return null;
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return null;
  const host = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (host) return host[1].toLowerCase();
  const user = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]+)$/i);
  if (user && /\.pooler\.supabase\.com$/i.test(u.hostname)) return user[1].toLowerCase();
  return null;
}

/**
 * THE DUMP AND THE OBJECTS COME FROM ONE PROJECT, OR NEITHER IS TAKEN.
 *
 * The database is reached by a connection string and the buckets by
 * SUPABASE_URL. They are two credentials, so they can name two projects, and a
 * backup that pairs production's rows with development's files restores into
 * a firm whose documents point at objects that do not exist. Refused, naming
 * both refs and never a credential.
 */
export function sameProject(supabaseRef, databaseRef) {
  if (!supabaseRef) return { ok: false, reason: "SUPABASE_URL names no Supabase project this check recognises" };
  if (!databaseRef) return { ok: false, reason: "the database URL names no Supabase project this check recognises" };
  if (supabaseRef !== databaseRef) {
    return {
      ok: false,
      reason: `the database URL names ${databaseRef} and SUPABASE_URL names ${supabaseRef}, so the rows and the objects would come from different projects`,
    };
  }
  return { ok: true };
}

/** The environment variables a run needs that are unset. Names only: a value is never echoed. */
export function missingEnv(env, names) {
  return names.filter((n) => !String(env[n] ?? "").trim());
}

/** Only the firm's buckets. Production is shared with unrelated applications. */
export function firmBuckets(names) {
  return [...new Set(names)].filter((n) => /^eng-[a-z0-9-]+$/.test(n)).sort();
}

/**
 * The buckets the migration chain creates, read from the migrations
 * themselves. A listing that is missing one of these is a listing that cannot
 * be trusted to be complete, and the backup refuses rather than keeping part.
 */
export function bucketsTheChainCreates(migrationsDir) {
  const found = new Set();
  for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()) {
    const text = readFileSync(join(migrationsDir, f), "utf8");
    for (const m of text.matchAll(/insert\s+into\s+storage\.buckets[^;]*/gi)) {
      for (const id of m[0].matchAll(/'(eng-[a-z0-9-]+)'/g)) found.add(id[1]);
    }
  }
  return [...found].sort();
}

/**
 * Where an object may be written on disk. Refuses anything that could climb
 * out of the bucket's folder, because an object name is data somebody uploaded.
 */
export function safeObjectPath(name) {
  const s = String(name ?? "");
  if (!s || s.startsWith("/") || s.includes("\\") || /^[A-Za-z]:/.test(s)) return null;
  const parts = s.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  return parts.join("/");
}

/** The key prefix for one run, in UTC, so two runs on one day never overwrite each other. */
export function backupPrefix(now) {
  const iso = new Date(now).toISOString();
  return `backups/${iso.slice(0, 10)}/${iso.slice(11, 19).replace(/:/g, "")}Z`;
}

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * EVERY FILE THE MANIFEST NAMES IS PRESENT, THE SIZE IT SAYS AND THE HASH IT
 * SAYS, AND NOTHING IS PRESENT THAT IT DOES NOT NAME. Returns the problems,
 * empty when the backup is whole.
 *
 * The manifest names the database dump and every object. An empty manifest is
 * itself a problem: a backup of nothing that verifies cleanly is the vacuous
 * green this repository keeps meeting.
 */
export function manifestProblems(manifest, root) {
  const problems = [];
  const entries = [];
  if (!manifest || !manifest.database || !Array.isArray(manifest.objects)) {
    return ["the manifest has no database entry or no object list"];
  }
  entries.push({ label: "the database dump", path: manifest.database.file, bytes: manifest.database.bytes, sha256: manifest.database.sha256 });
  for (const o of manifest.objects) {
    entries.push({ label: `object ${o.index}`, path: o.file, bytes: o.bytes, sha256: o.sha256 });
  }
  const named = new Set();
  for (const e of entries) {
    named.add(e.path);
    const full = join(root, e.path);
    if (!existsSync(full)) {
      problems.push(`${e.label} is missing`);
      continue;
    }
    const buf = readFileSync(full);
    if (buf.length !== e.bytes) problems.push(`${e.label} is ${buf.length} bytes, the manifest says ${e.bytes}`);
    else if (sha256(buf) !== e.sha256) problems.push(`${e.label} does not hash to what the manifest says`);
  }
  const counted = Object.values(manifest.buckets ?? {}).reduce((n, b) => n + (b.objects ?? 0), 0);
  if (counted !== manifest.objects.length) {
    problems.push(`the bucket counts add to ${counted} and the manifest lists ${manifest.objects.length} objects`);
  }
  for (const f of filesUnder(root)) {
    if (f !== "manifest.json" && !named.has(f)) problems.push("a file is present that the manifest does not name");
  }
  return problems;
}

function filesUnder(root, rel = "") {
  const out = [];
  for (const name of readdirSync(join(root, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(join(root, r)).isDirectory()) out.push(...filesUnder(root, r));
    else out.push(r);
  }
  return out;
}
