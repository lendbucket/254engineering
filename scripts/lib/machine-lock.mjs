/**
 * =============================================================================
 * ONE LOCK FOR THE WHOLE MACHINE. Operator ruling, 2026-09-24.
 * =============================================================================
 *
 * Two projects share this computer and both run Next servers, boards and dev
 * servers. Until today they coordinated by accident: each had a build guard
 * that could see the other's processes but not talk to it, so the only
 * available move was to refuse and wait for a person.
 *
 * WHAT THAT COST, on one day. A board refused twice on this repository's own
 * orphaned server, then twice more on the other project's `e2e-chain` and
 * `dispatch-mobile-check`, then again on its `launch-audit`. Five refusals,
 * each needing a person to look at a pid, and one of them needed the operator
 * to kill a process because this session correctly would not.
 *
 * AND THE GUARD'S CLEVERNESS COULD NOT CLOSE IT. `placeByOwner` was built the
 * same day to recognise a server belonging to another checkout, and it works
 * only when the owner's command line carries an absolute path. The last
 * blocker was `node scripts/launch-audit.mjs`, relative, unplaceable, and the
 * guard was right to refuse. Detection has a ceiling; cooperation does not.
 *
 * =============================================================================
 * THE PROTOCOL, AND EVERY PROJECT ON THIS MACHINE OBEYS THE SAME ONE
 * =============================================================================
 *
 *   take     before any board, full suite, build or dev server
 *   wait     if the file exists and its pid is ALIVE, poll every 60 seconds
 *   reap     if the file exists and its pid is DEAD, remove it and proceed
 *   release  delete it when the run exits, however it exits
 *
 * IT IS ADVISORY, NOT ENFORCED, and that is stated rather than papered over. A
 * project that does not take the lock is not stopped by it. What the lock buys
 * is that projects which DO take it stop colliding, and the build guard remains
 * underneath as the detector for everything else. The two are layers: the lock
 * is cooperation between willing parties, the guard is the check on the
 * unwilling.
 *
 * THE FILE IS JSON AND HUMAN READABLE, because the person most likely to read
 * it is somebody wondering why their run is waiting, and a lock that cannot
 * explain itself gets deleted by hand.
 *
 * A DEAD PID IS REAPED RATHER THAN RESPECTED. A crashed run must not wedge the
 * machine until somebody notices, which is the failure mode of every lock that
 * has no reaper. The cost is a reused pid: Windows recycles them, so a very
 * unlucky reap could read a live unrelated process as the owner and wait, or
 * read a dead one as alive. Waiting is the safe direction of that error, and
 * the start time in the file is what lets a person tell the difference.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

/** The one path, absolute, shared by every project on this machine. */
export const LOCK_PATH = "C:/Users/salon/.test-lock";

const POLL_MS = 60_000;

/** Is that pid a live process? `kill(pid, 0)` signals nothing and throws if not. */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    /*
     * EPERM means it exists and belongs to somebody else, which is ALIVE. Only
     * ESRCH means no such process. Treating EPERM as dead would reap a live
     * lock, which is the one error this must not make.
     */
    return e?.code === "EPERM";
  }
}

/**
 * What the file says, or null when it is absent or unreadable.
 *
 * TOLERANT ABOUT EVERY FIELD EXCEPT `pid`, because the first other project to
 * adopt this lock wrote `start` where this one writes `startedAt`, and the wait
 * message then read "started undefined". A shared protocol between two
 * codebases is only as strong as the field names they happen to agree on, so
 * only the one that decides BEHAVIOUR is required. `since` and `label` are
 * normalised for display and their absence costs a reader nothing.
 *
 * Requiring the whole shape would be worse than useless here: it would make
 * this project ignore a lock another project is genuinely holding, which is the
 * one outcome the lock exists to prevent.
 */
export function readLock() {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    const held = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
    if (typeof held?.pid !== "number") return null;
    return {
      ...held,
      project: held.project ?? "an unnamed project",
      label: held.label ?? "an unnamed run",
      since: held.startedAt ?? held.start ?? held.started ?? "an unrecorded time",
    };
  } catch {
    /*
     * A CORRUPT LOCK IS A DEAD LOCK. A half written file cannot name an owner,
     * so nothing can be waited for, and leaving it would wedge the machine for
     * ever on a file nobody can interpret.
     */
    return null;
  }
}

/**
 * Take the lock, waiting for a live holder.
 *
 * @param {{ project: string, label: string, pollMs?: number, onWait?: (held: object) => void }} opts
 * @returns {Promise<() => void>} release, which is safe to call twice
 */
export async function takeLock({ project, label, pollMs = POLL_MS, onWait }) {
  /*
   * RE-ENTRANT ACROSS THE PROCESS TREE, AND WITHOUT THIS IT DEADLOCKS ON
   * ITSELF. The suite takes the lock and then spawns `npm run build`, whose
   * `prebuild` hook takes it too. That child is a different pid, the parent is
   * very much alive, and the child would wait sixty seconds at a time for a
   * lock its own parent is holding, for ever.
   *
   * So the holder publishes its pid into the environment, which every child
   * inherits, and a descendant that finds the lock held by THAT pid proceeds
   * without waiting and without releasing on its way out. The release belongs
   * to whoever took it.
   *
   * Checked against the FILE as well as the variable: an inherited variable
   * from a run that has since died must not excuse a descendant from a lock
   * somebody else now holds.
   */
  const inherited = Number(process.env.MACHINE_LOCK_HELD);
  if (Number.isInteger(inherited) && inherited > 0) {
    const held = readLock();
    if (held?.pid === inherited && alive(inherited)) return () => {};
  }

  for (;;) {
    const held = readLock();

    if (held && alive(held.pid)) {
      if (onWait) onWait(held);
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }

    if (held) {
      /*
       * Reaped. Said out loud, because a silent reap hides a crashed run.
       *
       * INJECTION-VERIFIED, and the first attempt at proving the release was
       * proven by nothing: it called an ALREADY RELEASED handle, so it returned
       * at the idempotence flag and never reached the ownership check below.
       * Deleting that check left the proof green. It now releases a LIVE handle
       * with the file changed underneath it, which is the real shape of the
       * hazard, and the same injection turns it red.
       */
      if (onWait) onWait({ ...held, reaped: true });
      try {
        unlinkSync(LOCK_PATH);
      } catch {}
    }

    writeFileSync(
      LOCK_PATH,
      JSON.stringify({ project, pid: process.pid, label, startedAt: new Date().toISOString() }, null, 2),
    );

    /*
     * READ IT BACK. Two projects can reach the write in the same instant, and
     * the one whose bytes landed second owns the lock. Reading back is what
     * turns "I wrote it" into "I hold it", and it is the same rule this
     * repository applies to a deletion and to a restore: the write and the
     * check are separate statements.
     */
    const back = readLock();
    if (back?.pid === process.pid) {
      /* Published for descendants. See the re-entrancy note at the top. */
      process.env.MACHINE_LOCK_HELD = String(process.pid);

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        const still = readLock();
        /* Only ever remove OUR lock. Removing somebody else's is the worst
         * thing this file could do, because it is silent. */
        if (still?.pid === process.pid) {
          try {
            unlinkSync(LOCK_PATH);
          } catch {}
        }
      };

      /* However it exits. A lock that survives its owner is the thing the
       * reaper exists to clean up, and not needing the reaper is better. */
      process.once("exit", release);
      process.once("SIGINT", () => {
        release();
        process.exit(130);
      });
      process.once("SIGTERM", () => {
        release();
        process.exit(143);
      });

      return release;
    }

    /* Lost the race. Round again rather than assuming. */
    await new Promise((r) => setTimeout(r, 250));
  }
}
