/**
 * PROOF: ONE LOCK FOR THE WHOLE MACHINE, AND IT REAPS A DEAD HOLDER.
 *
 * Operator ruling, 2026-09-24. Two projects share this computer, and until
 * today they coordinated by refusing: five board refusals in one day, each
 * needing a person to read a pid, and one needing the operator to kill a
 * process this session correctly would not.
 *
 * WHAT IS PROVEN HERE, and each case exists because getting it wrong has a
 * specific cost:
 *
 *   A  an unheld lock is taken immediately
 *   B  a lock held by a LIVE pid makes a second taker WAIT
 *   C  releasing it lets the waiter through
 *   D  a lock held by a DEAD pid is REAPED, not respected
 *   E  a descendant of the holder proceeds without waiting
 *   F  a release only ever removes the holder's OWN lock
 *
 * D IS THE ONE THAT MATTERS MOST. A lock with no reaper wedges the machine
 * until somebody notices, which is a worse failure than the collisions it
 * prevents: a crashed board at 3am would stop every run until morning.
 *
 * F IS THE ONE THAT WOULD BE SILENT. Removing somebody else's lock produces no
 * error and no symptom until two builds write `.next` at once, and then the
 * symptom is a torn artifact that a smoke check reports as healthy.
 *
 * THE LOCK PATH IS REAL, SO THIS PROOF MOVES THE REAL FILE ASIDE FIRST and puts
 * it back, byte identical, in a finally. Running a proof that deletes the
 * machine's lock while another project holds it would be this file causing the
 * exact collision it exists to prevent.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { LOCK_PATH, readLock, takeLock } from "../lib/machine-lock.mjs";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/*
 * NEVER WHILE ANOTHER PROJECT HOLDS THE MACHINE. Found 2026-10-07: this proof
 * moves the real lock aside and puts it back, and it was run by hand (through
 * proofs-audit) while dispatch-scheduling held a live lock. The lock came back
 * byte for byte, and for the length of the run another project's lock was not
 * where its owner left it, which CLAUDE.md section 6d forbids. So a live lock
 * held by any other project means this proof does not run: it says so and
 * exits without touching the file. Under this project's own board, which holds
 * the lock itself, it runs as before.
 */
{
  const held = existsSync(LOCK_PATH) ? readLock() : null;
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === "EPERM";
    }
  };
  if (held && held.project !== "254engineering" && held.pid && alive(held.pid)) {
    console.log(`COULD NOT TELL: ${held.project} (pid ${held.pid}) holds the machine lock, and this proof never moves another project's lock. Run it when the machine is free.`);
    process.exit(0);
  }
}

const ASIDE = `${LOCK_PATH}.proof-aside`;
const hadReal = existsSync(LOCK_PATH);
if (hadReal) copyFileSync(LOCK_PATH, ASIDE);

/** A process that stays alive until killed, so "held by a live pid" is real. */
function sleeper() {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    detached: false,
  });
  return child;
}

const clean = () => {
  try {
    if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
  } catch {}
};

let held = null;

try {
  clean();

  // ------------------------------------------------- A: an unheld lock is taken

  const began = Date.now();
  const release = await takeLock({ project: "proof-a", label: "case A", pollMs: 50 });
  check(
    "A: an unheld lock is taken at once",
    readLock()?.pid === process.pid && Date.now() - began < 2000,
    `${Date.now() - began}ms`,
  );

  check(
    "A: and the file says who holds it, since when, and for what",
    Boolean(readLock()?.project && readLock()?.label && readLock()?.startedAt),
    JSON.stringify(readLock()),
  );

  // ------------------------------------------ E: a descendant does not wait

  /*
   * The holder publishes its pid into the environment. Without this the suite
   * would deadlock on itself: it takes the lock, spawns `npm run build`, and
   * that build's prebuild hook waits sixty seconds at a time for its own
   * parent, for ever. Asserted here rather than discovered at 3am.
   */
  const descendantBegan = Date.now();
  const descendantRelease = await takeLock({ project: "proof-child", label: "case E", pollMs: 50 });
  check(
    "E: a descendant of the holder proceeds without waiting",
    Date.now() - descendantBegan < 2000 && readLock()?.pid === process.pid,
    `${Date.now() - descendantBegan}ms, and the lock still names the holder`,
  );
  descendantRelease();
  check(
    "E: and a descendant's release does NOT remove the holder's lock",
    readLock()?.pid === process.pid,
    "the release belongs to whoever took it",
  );

  release();
  check("A: releasing removes it", readLock() === null, "");

  // ------------------------------- B and C: a live holder makes a taker wait

  held = sleeper();
  writeFileSync(
    LOCK_PATH,
    JSON.stringify({ project: "other-project", pid: held.pid, label: "a board", startedAt: new Date().toISOString() }),
  );

  /*
   * Taken in a CHILD, because this process's own environment now carries
   * MACHINE_LOCK_HELD from case A and would excuse it. A proof that let its own
   * earlier case satisfy a later one would be proving nothing, which is the
   * re-entrancy hole seen from the other side.
   */
  const waiter = spawn(
    process.execPath,
    [
      "-e",
      `import("./scripts/lib/machine-lock.mjs").then(async (m) => {
         const t = Date.now();
         await m.takeLock({ project: "proof-waiter", label: "case B", pollMs: 200 });
         console.log("TOOK " + (Date.now() - t));
       })`,
    ],
    { stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, MACHINE_LOCK_HELD: "" } },
  );

  let waiterOut = "";
  waiter.stdout.on("data", (d) => (waiterOut += String(d)));

  await new Promise((r) => setTimeout(r, 1500));
  check(
    "B: a lock held by a LIVE pid makes a second taker wait",
    waiterOut === "" && readLock()?.pid === held.pid,
    `after 1500ms the waiter has not taken it; the lock still names pid ${held.pid}`,
  );

  /* Release by ending the holder and removing its file, as a real run would. */
  held.kill();
  held = null;
  unlinkSync(LOCK_PATH);

  await new Promise((r) => setTimeout(r, 2000));
  check(
    "C: and it goes through once the lock is released",
    /^TOOK \d+/.test(waiterOut.trim()),
    waiterOut.trim() || "the waiter never took it",
  );
  waiter.kill();
  clean();

  // ------------------------------------------------- D: a dead holder is reaped

  const corpse = sleeper();
  const corpsePid = corpse.pid;
  corpse.kill();
  await new Promise((r) => setTimeout(r, 500));

  writeFileSync(
    LOCK_PATH,
    JSON.stringify({ project: "crashed-project", pid: corpsePid, label: "a board that died", startedAt: "2026-09-24T00:00:00.000Z" }),
  );

  let reaped = false;
  const reapBegan = Date.now();
  const afterReap = await takeLock({
    project: "proof-d",
    label: "case D",
    pollMs: 50,
    onWait: (h) => {
      if (h.reaped) reaped = true;
    },
  });

  check(
    "D: a lock held by a DEAD pid is reaped rather than respected",
    reaped && readLock()?.pid === process.pid && Date.now() - reapBegan < 2000,
    `${Date.now() - reapBegan}ms. A lock with no reaper wedges the machine until somebody notices.`,
  );
  afterReap();

  // ---------------------------------- F: a release never removes another's lock

  /*
   * THE FIRST VERSION OF THIS CASE WAS PROVEN BY NOTHING, AND AN INJECTION IS
   * WHAT SAID SO. It called an ALREADY RELEASED handle, so it returned at the
   * `released` idempotence flag and never reached the ownership check at all.
   * Deleting the ownership check left this green.
   *
   * So the release must be a LIVE one, taken and not yet used, with the lock
   * file changed underneath it. That is the real shape of the hazard: this
   * process takes the lock, something goes wrong and its lock is reaped or
   * replaced by another project, and then its release fires on the way out and
   * removes a lock it does not own.
   */
  clean();
  const liveRelease = await takeLock({ project: "proof-f", label: "case F", pollMs: 50 });

  const foreign = sleeper();
  writeFileSync(
    LOCK_PATH,
    JSON.stringify({ project: "other-project", pid: foreign.pid, label: "a board", startedAt: new Date().toISOString() }),
  );

  liveRelease();
  check(
    "F: a release does not remove a lock somebody else now holds",
    readLock()?.pid === foreign.pid,
    readLock()?.pid === foreign.pid
      ? "removing another project's lock is silent until two builds write .next at once"
      : "IT REMOVED IT. The other project now believes it holds a lock that is gone.",
  );
  foreign.kill();
} finally {
  if (held) {
    try {
      held.kill();
    } catch {}
  }
  clean();
  if (hadReal) {
    copyFileSync(ASIDE, LOCK_PATH);
    unlinkSync(ASIDE);
    console.log(`\nthe machine's real lock was moved aside and put back: ${readFileSync(LOCK_PATH, "utf8").slice(0, 80)}`);
  }
}

console.log(
  wrong === 0
    ? "\nAll checks correct. One lock, it waits for the living and reaps the dead."
    : `\n${wrong} check(s) wrong.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
