/**
 * PROOF: THE MACHINE LOCK IS CREATED, NEVER OVERWRITTEN.
 *
 *   node scripts/proofs/the-machine-lock-is-created-never-overwritten.mjs
 *
 * BACKLOG, "our lock and wattsmith's were both held at once, 2026-10-09". The
 * lock was written with writeFileSync, which overwrites, so two takers that
 * both found no file could each write, each read back their own pid, and each
 * hold the lock (scripts/lib/machine-lock.mjs, createLockFile, for the steps).
 * It is now created with `wx`, which fails on an existing file.
 *
 * THIS PROOF NEVER TOUCHES THE REAL LOCK. The real file belongs to every
 * project on this machine, and moving it aside while another project holds it
 * would cause the collision the lock exists to prevent. The primitive is
 * exercised on a scratch file in the OS temp directory; takeLock's use of it is
 * read from source.
 *
 *   A  creating on an empty path makes the file, with the body given
 *   B  creating again finds it there, says so, and leaves the first body alone
 *   C  takeLock creates through that primitive, and nothing in the file
 *      writes the lock any other way
 *   D  an unreadable lock file is removed only after a pause and a second read,
 *      never on the first sight of it
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLockFile } from "../lib/machine-lock.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const dir = mkdtempSync(join(tmpdir(), "lock-proof-"));
const path = join(dir, "lock");
try {
  const first = JSON.stringify({ project: "first", pid: 111 });
  const second = JSON.stringify({ project: "second", pid: 222 });

  const made = createLockFile(path, first);
  check("A: creating on an empty path makes the file", made === true && existsSync(path));
  check("A: and it holds the body given", readFileSync(path, "utf8") === first);

  const again = createLockFile(path, second);
  check("B: creating again finds the file there and says so", again === false);
  check(
    "B: and leaves the first holder's body alone, so the second taker cannot also hold it",
    readFileSync(path, "utf8") === first,
    readFileSync(path, "utf8") === first ? "" : `the file now reads ${readFileSync(path, "utf8")}`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const source = readFileSync("scripts/lib/machine-lock.mjs", "utf8");
const take = source.slice(source.indexOf("export async function takeLock("));
check("C: takeLock creates the lock through createLockFile", /createLockFile\(\s*LOCK_PATH,/.test(take));
check("C: and the primitive opens with wx", /openSync\(path, "wx"\)/.test(source));
check("C: nothing in the file writes the lock any other way", !/writeFileSync\(/.test(source));
check(
  "D: an unreadable lock file is removed only after a pause and a second read",
  /if \(!held && existsSync\(LOCK_PATH\)\) \{\s*await new Promise\(\(r\) => setTimeout\(r, 1_000\)\);\s*if \(readLock\(\) === null && existsSync\(LOCK_PATH\)\)/.test(take),
);

console.log(wrong === 0 ? "PASS: the machine lock is created, never overwritten." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
