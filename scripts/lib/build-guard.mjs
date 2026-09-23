import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Refuse to build while a server is holding `.next`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `next build` will happily overwrite `.next` while a `next start` is still
 * serving out of it, and the result is not a loud failure. It is a torn
 * artifact: a route can come out with a 404 baked into its `.meta` file while the
 * same route sits correctly in `prerender-manifest.json`. The build reports
 * success and the page 404s.
 *
 * What makes this worth a guard rather than a habit is the second half. The
 * usual smoke check confirms the broken route as healthy, because the curl is
 * answered by the still-running stale process, which serves the OLD build and
 * says 200. So the two signals that would normally catch a missing page, the
 * build result and the smoke check, agree that nothing is wrong, each reading a
 * different half of a torn artifact. A failure mode that makes two independent
 * checks agree on the wrong answer does not get caught by being careful.
 *
 * It does its own process handling rather than shelling out to `pkill`, because
 * pkill does not match the way Windows presents these command lines: it reports
 * success and kills nothing, which is the worst of both.
 *
 * WHAT IT WILL AND WILL NOT REFUSE
 * --------------------------------
 * Two independent detections, because either alone has a hole:
 *
 *   1. Anything LISTENING on a port in the audit range. These ports are ours by
 *      convention, so a listener is unambiguous. Its hole is the range itself,
 *      which is TYPED and narrower than the ports harnesses actually claim.
 *      Recorded in BACKLOG.md; the range wants deriving, not widening.
 *   2. Any `next start` / `next dev` this guard cannot vouch for, which is
 *      three answers rather than two. See `classifyNextProcess`.
 *
 * ON 2026-09-22 THIS SECTION SAID DETECTION 2 CATCHES "any next start whose
 * command line contains THIS repository's path", and that was the defect
 * written down as a feature. A server started with a RELATIVE binary path
 * carries no repository path at all, so it was dropped silently, and a board
 * died after 32 of 58 audits with the guard having printed "nothing holding
 * .next, proceeding".
 *
 * So ownership that cannot be ESTABLISHED is now reported rather than assumed
 * harmless. It still does NOT refuse because some other project's dev server is
 * running, where that can be positively identified by an absolute path into a
 * different checkout: a check that cries wolf gets switched off within a week,
 * and a `next dev` in a different repo cannot touch this `.next`. What changed
 * is that "I cannot tell" stopped being filed under "not ours".
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The port map, gathered from the harnesses that claim them:
 *   3223  mobile-audit
 *   3224  contrast-audit
 *   3225  the main dev/prod server every audit points BASE_URL at
 *   3226  shots
 * The range is scanned whole rather than as a list, so a harness that claims a
 * new port inside it is covered before anyone remembers to update this comment.
 */
export const AUDIT_PORT_RANGE = [3223, 3229];

const isWindows = process.platform === "win32";

/**
 * True when no local server can possibly exist, so the guard must not run.
 *
 * Load bearing rather than defensive: `prebuild` runs on Vercel too, and a guard
 * that can fail a deployment because it misread a build container's process
 * table would be a worse bug than the one it is preventing.
 */
export function inCiOrDeploy() {
  return Boolean(process.env.VERCEL || process.env.CI || process.env.GITHUB_ACTIONS);
}

/** Run a command and return stdout, or "" if it is unavailable. Never throws. */
function run(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true });
    return r.status === 0 && r.stdout ? r.stdout : "";
  } catch {
    return "";
  }
}

/**
 * Every process listening on a port in the audit range, as {pid, port}.
 *
 * On Windows this asks Get-NetTCPConnection rather than parsing `netstat`,
 * because netstat's column layout shifts with locale and a misparse here reads
 * as "nothing is running", which is the exact wrong answer to be confident about.
 */
function listenersInRange() {
  const [lo, hi] = AUDIT_PORT_RANGE;
  const found = [];

  if (isWindows) {
    const out = run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.LocalPort -ge ${lo} -and $_.LocalPort -le ${hi} } | ` +
        `ForEach-Object { "$($_.OwningProcess) $($_.LocalPort)" }`,
    ]);
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/^(\d+)\s+(\d+)$/);
      if (m) found.push({ pid: Number(m[1]), port: Number(m[2]) });
    }
    return found;
  }

  for (let port = lo; port <= hi; port++) {
    const out = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    for (const line of out.split(/\r?\n/)) {
      const pid = Number(line.trim());
      if (pid) found.push({ pid, port });
    }
  }
  return found;
}

/** Command line for a pid, or "" when it cannot be read. */
function commandLineOf(pid) {
  if (isWindows) {
    const out = run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue).CommandLine`,
    ]);
    return out.trim().replace(/\s+/g, " ");
  }
  return run("ps", ["-o", "command=", "-p", String(pid)]).trim();
}

/**
 * WHOSE `next start` OR `next dev` IS THIS, from its command line alone.
 *
 * Returns `null` when the process is not a next server at all, and otherwise
 * one of `ours`, `foreign` or `unknown`. `needle` is the repository root,
 * lowercased with forward slashes.
 *
 * EXPORTED AS A PURE FUNCTION SO THE BOARD CAN PROVE IT. The live half needs a
 * process table, and a rule that can only be exercised by starting real servers
 * is a rule nothing exercises: the check would need a fixture that spawns a
 * server on a port, which is the thing this guard exists to complain about.
 * Extracted, the classification is fed four fixtures by
 * `scripts/proofs/the-build-guard-knows-whose-server-it-is.mjs` and the live
 * half applies the same function to real command lines.
 *
 * AND THAT IS THE CAVEAT CLAUDE.md RECORDS ABOUT PURE FUNCTIONS: a rule tested
 * with its input handed to it proves the rule and says nothing about whether
 * production can construct that input. The live half is what reads the process
 * table, and the fixtures below are REAL command lines copied from it rather
 * than shapes invented to match the rule.
 */
export function classifyNextProcess(command, needle) {
  /*
   * THE PROCESS HAS TO BE A NODE PROCESS, NOT SOMETHING THAT MENTIONS ONE.
   *
   * Found by reading an injection's output rather than its exit code. Widening
   * this function to report unknown ownership immediately produced three false
   * positives: the bash wrappers that had spawned the commands, whose command
   * lines CONTAIN the server's whole invocation as an argument and therefore
   * match every text test that matches the server itself.
   *
   * A shell wrapping `next start` and a `next start` are not distinguishable by
   * searching for "next" and "start", because the shell's command line contains
   * the server's. What separates them is the EXECUTABLE: one is node, the other
   * is bash. So the first token has to be a node binary.
   *
   * This matters more than tidiness. The comment at the top of this file says a
   * check that cries wolf gets switched off within a week, and a guard that
   * named three shells every time somebody ran anything would have been
   * disabled by the end of the day, taking the real detection with it.
   */
  const first = String(command).trim().match(/^"([^"]+)"|^(\S+)/);
  const exe = (first?.[1] ?? first?.[2] ?? "").toLowerCase().replace(/\\/g, "/");
  if (!/(^|\/)node(\.exe)?$/.test(exe)) return null;

  const c = String(command).toLowerCase().replace(/\\/g, "/");
  if (!(/\bnext\b/.test(c) && /\b(start|dev)\b/.test(c))) return null;

  if (needle && c.includes(needle)) return "ours";

  /*
   * An absolute path to a next binary belonging to somewhere else. Matched as a
   * drive-lettered or root-anchored path ending at the next package, which is
   * the only shape that can positively identify a DIFFERENT checkout.
   */
  return /(?:[a-z]:\/|\/)[^"']*\/node_modules\/next\//.test(c) ? "foreign" : "unknown";
}

/**
 * Every `next start` / `next dev` this guard will not vouch for.
 *
 * Returns the ones classified `ours` AND the ones classified `unknown`.
 * `foreign` is dropped, which keeps a sibling project's dev server out of the
 * results. Comparison is case-insensitive and separator-insensitive because
 * Windows command lines mix `/` and `\` freely.
 */
function nextProcessesInThisRepo() {
  const needle = repoRoot.toLowerCase().replace(/\\/g, "/");
  const rows = [];

  if (isWindows) {
    const out = run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.CommandLine -like "*next*" } | ` +
        `ForEach-Object { "$($_.ProcessId)|$($_.CommandLine -replace '\\s+',' ')" }`,
    ]);
    for (const line of out.split(/\r?\n/)) {
      const i = line.indexOf("|");
      if (i < 1) continue;
      rows.push({ pid: Number(line.slice(0, i)), command: line.slice(i + 1).trim() });
    }
  } else {
    const out = run("ps", ["-eo", "pid=,command="]);
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/^(\d+)\s+(.*)$/);
      if (m) rows.push({ pid: Number(m[1]), command: m[2] });
    }
  }

  /*
   * ===========================================================================
   * UNKNOWN OWNERSHIP IS REPORTED, NOT DROPPED. Operator ruling, 2026-09-22.
   * ===========================================================================
   *
   * WHAT THIS COST, measured rather than argued. On 2026-09-22 a board printed
   * "[build-guard] nothing holding .next, proceeding." while a server started
   * out of this very repository had been alive for eighteen minutes. It killed
   * the suite's own server partway through and the board stopped after 32 of 58
   * audits with THE SUITE DID NOT RUN TO COMPLETION.
   *
   * WHY IT WAS INVISIBLE. This filter kept a process only when the repository
   * root appeared in its COMMAND LINE. The orphan's command line was
   *
   *     "C:/Program Files/nodejs/node.exe" node_modules/next/dist/bin/next start -p 3141
   *
   * which names the binary RELATIVELY. The process was running in this
   * directory; its command line does not say so, and nothing here can read a
   * Windows process's working directory. So `includes(needle)` was false and
   * the row was dropped.
   *
   * THE SHAPE OF THE MISTAKE, which is the part worth carrying. The old line
   * answered "I cannot establish whose this is" with "not ours", silently, in
   * the direction that lets a build proceed. That is `unreachable is not
   * failed` inverted: an inability to measure was reported as a measurement.
   * A server started by hand carries an ABSOLUTE path and was caught every
   * time, which is exactly why the guard looked sound. It was only ever tested
   * against the invocation shape it can see.
   *
   * SO THERE ARE THREE ANSWERS, NOT TWO, and only one of them drops the row:
   *
   *   ours      the repository root is in the command line. A blocker.
   *   foreign   some OTHER absolute path to a next binary is in the command
   *             line. Dropped, and that is the original reasoning preserved:
   *             a next dev in a different repository cannot touch this .next,
   *             and a guard that cries wolf gets switched off within a week.
   *   unknown   a next start or dev naming no absolute path at all. REPORTED,
   *             because it might be ours and nothing here can tell.
   *
   * It errs shut. The cost of a false positive is one `taskkill` the operator
   * runs after reading a PID and a command line printed for them. The cost of
   * the false negative is the twenty minute board above, and a red that means
   * two things.
   */
  /*
   * THE PROCESS HAS TO BE A NODE PROCESS, NOT SOMETHING THAT MENTIONS ONE.
   *
   * Found by reading an injection's output rather than its exit code. Widening
   * this function to report unknown ownership immediately produced three false
   * positives: the bash wrappers that had spawned the commands, whose command
   * lines CONTAIN the server's whole invocation as an argument and therefore
   * match every text test that matches the server itself.
   *
   * A shell wrapping `next start` and a `next start` are not distinguishable by
   * searching for "next" and "start", because the shell's command line contains
   * the server's. What separates them is the EXECUTABLE: one is node, the other
   * is bash. So the first token has to be a node binary.
   *
   * This matters more than tidiness here. The comment at the top of this file
   * says a check that cries wolf gets switched off within a week, and a guard
   * that named three shells every time somebody ran anything would have been
   * disabled by the end of the day, taking the real detection with it.
   */
  const classified = [];
  for (const r of rows) {
    if (r.pid === process.pid) continue;
    const ownership = classifyNextProcess(r.command, needle);
    if (ownership === null || ownership === "foreign") continue;
    classified.push({ ...r, ownership });
  }

  return classified;
}

/** Everything that would make a build unsafe, merged by pid. */
export function findBlockers() {
  const byPid = new Map();

  const add = (pid, reason, port) => {
    if (!byPid.has(pid)) byPid.set(pid, { pid, command: "", ports: [], reasons: [] });
    const e = byPid.get(pid);
    if (!e.reasons.includes(reason)) e.reasons.push(reason);
    if (port && !e.ports.includes(port)) e.ports.push(port);
  };

  for (const { pid, port } of listenersInRange()) add(pid, "listening on an audit port", port);
  for (const { pid, ownership } of nextProcessesInThisRepo()) {
    add(
      pid,
      ownership === "ours"
        ? "a next server running out of this repo"
        : "a next server whose repository could not be established from its command line, so it is reported rather than assumed harmless",
    );
  }

  for (const e of byPid.values()) e.command = commandLineOf(e.pid) || "(command line unavailable)";
  return [...byPid.values()].sort((a, b) => a.pid - b.pid);
}

/**
 * Kill a pid and everything it spawned.
 *
 * `taskkill /T` is the whole point on Windows. `npx next start` is a shell with
 * the real server underneath it, so killing the pid alone orphans the process
 * actually holding the port.
 */
export function killTree(pid) {
  if (isWindows) {
    const r = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return r.status === 0;
  }
  try {
    process.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

function describe(blockers) {
  return blockers
    .map((b) => {
      const where = b.ports.length ? ` on port ${b.ports.join(", ")}` : "";
      return `  PID ${b.pid}${where}\n    ${b.reasons.join("; ")}\n    ${b.command}`;
    })
    .join("\n");
}

/**
 * The guard itself. Returns normally when it is safe to build.
 *
 * Refusing is the default. Killing is opt-in via `--kill` or
 * `AUDIT_KILL_STALE=1`, because a running server is often a deliberate session
 * somebody is using. What is not optional is that the build does not proceed.
 */
export function assertClearToBuild({ kill = false, label = "build" } = {}) {
  if (inCiOrDeploy()) return { skipped: true, blockers: [] };

  let blockers = findBlockers();
  if (blockers.length === 0) return { skipped: false, blockers: [] };

  if (kill) {
    console.error(`\n[build-guard] ${blockers.length} process(es) holding .next or an audit port:`);
    console.error(describe(blockers));
    for (const b of blockers) {
      const ok = killTree(b.pid);
      console.error(`[build-guard] ${ok ? "killed" : "COULD NOT KILL"} PID ${b.pid}`);
    }
    // Re-check rather than trust the kill. taskkill can report success on a
    // process that takes a moment to release the port, and a guard that assumes
    // its own fix worked is the same class of bug it exists to catch.
    const deadline = Date.now() + 5000;
    do {
      blockers = findBlockers();
    } while (blockers.length > 0 && Date.now() < deadline);

    if (blockers.length === 0) {
      console.error("[build-guard] clear.\n");
      return { skipped: false, blockers: [], killed: true };
    }
  }

  const action = label === "build" ? "Building now" : `Running ${label} now`;
  /*
   * "REFUSING TO THE AUDIT SUITE" is what this printed until 2026-09-22, when
   * the suite stopped killing and started refusing, which turned a rare line
   * into a common one. The verb belongs in the heading, not only in the
   * sentence below it.
   */
  const heading = label === "build" ? "REFUSING TO BUILD" : `REFUSING TO RUN ${label.toUpperCase()}`;

  throw new Error(
    `\n=== BUILD GUARD: ${heading} ===\n\n` +
      `${blockers.length} process(es) are holding .next or an audit port:\n\n` +
      `${describe(blockers)}\n\n` +
      `${action} would write .next underneath a running server and produce a torn\n` +
      `artifact: routes that 404 from a build that reported success, while a curl\n` +
      `smoke check against the stale process still answers 200.\n\n` +
      `Fix it one of these ways:\n` +
      `  - Stop the server(s) above, then re-run.\n` +
      (isWindows
        ? `  - taskkill /PID ${blockers[0].pid} /T /F     (/T matters: npx is a shell\n` +
          `    wrapping the real server, and killing it alone orphans the server.\n` +
          `    This is also why pkill appears to succeed here and does nothing.)\n`
        : `  - kill -9 ${blockers.map((b) => b.pid).join(" ")}\n`) +
      `  - Re-run with AUDIT_KILL_STALE=1 to have this guard kill them for you.\n`,
  );
}
