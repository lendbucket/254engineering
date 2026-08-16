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
 *      convention, so a listener is unambiguous.
 *   2. Any `next start` / `next dev` whose command line contains THIS
 *      repository's path. npx resolves the local binary, so the inner process
 *      command line carries the project path, which is precise attribution. This
 *      catches a server on a port outside the range.
 *
 * It deliberately does NOT refuse because some other project's dev server is
 * running. A check that cries wolf gets switched off within a week, and a
 * `next dev` in a different repo cannot touch this `.next`.
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
 * Every `next start` / `next dev` belonging to THIS repository.
 *
 * The path match is what keeps a sibling project's dev server out of the
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

  return rows.filter((r) => {
    if (r.pid === process.pid) return false;
    const c = r.command.toLowerCase().replace(/\\/g, "/");
    if (!c.includes(needle)) return false;
    return /\bnext\b/.test(c) && /\b(start|dev)\b/.test(c);
  });
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
  for (const { pid } of nextProcessesInThisRepo()) add(pid, "a next server running out of this repo");

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

  throw new Error(
    `\n=== BUILD GUARD: REFUSING TO ${label.toUpperCase()} ===\n\n` +
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
