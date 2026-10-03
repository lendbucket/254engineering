import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT_RANGE } from "./ports.mjs";

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
 * THE RANGE THIS PROJECT MAY BIND, DERIVED FROM THE ONE DECLARATION.
 *
 * The map that used to sit here listed four ports in a comment and a range of
 * seven in the code, and the two had already drifted: the project bound thirteen
 * ports, four of them outside this range and four of them colliding with each
 * other. A comment listing ports is a second account of a fact, and this one was
 * wrong in both directions at once.
 *
 * So the range comes from `ports.mjs`, which is where a port is now added. The
 * range is still scanned WHOLE rather than as a list, for the reason the old
 * comment gave and which was the only correct thing about it: a harness that
 * claims a new port inside the block is covered before anybody remembers this
 * file exists.
 *
 * AND MOVING THE BLOCK MOVES THE GUARD WITH IT. That is what made this worth
 * deriving rather than editing. On 2026-10-02 the ports moved out of the 3200s
 * because another project on this machine had spread across them; had this
 * stayed a literal, the guard would have gone on watching an empty range and
 * reported every genuinely stale server of ours as not ours.
 */
export const AUDIT_PORT_RANGE = [PORT_RANGE.from, PORT_RANGE.to];

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

/**
 * WHO OWNS THIS SERVER, AND IS KILLING IT ENOUGH.
 * Operator ruling, 2026-09-23.
 *
 * WHAT THIS COST. On 2026-09-22 a board stopped after 32 of 58 audits with its
 * server gone. The cause, established the following night: an orphaned
 * `launch-audit` was alive and starting a fresh server every time one died.
 *
 * AND THE ORPHAN WAS MADE BY FOLLOWING THIS GUARD'S OWN ADVICE. It prints
 * `taskkill /PID <server> /T /F`. `/T` kills a process's CHILDREN, not its
 * PARENT, so tree-killing the server leaves the audit that owns it running, and
 * `launch-audit` starts three servers one after another. Windows said so at the
 * time, in its own output: "SUCCESS: The process with PID 31996 (child process
 * of PID 34400) has been terminated." The parent named there was never killed.
 *
 * So the guard named a symptom and printed the command that reproduces it. A
 * blocker now carries its OWNER where one can be established, and `describe`
 * prints the kill that actually ends the cycle.
 *
 * WHAT COUNTS AS AN OWNER, and it is deliberately narrow. A node process, in
 * this repository, that is not itself a next server. A shell is not an owner:
 * killing `cmd.exe` leaves the node process it wrapped, which is the same
 * mistake one level up. Anything else is left alone, because a guard that tells
 * somebody to kill a process it cannot account for is worse than one that says
 * nothing.
 */
export function classifyOwnerCandidate(command, needle) {
  if (!command || !String(command).trim()) return false;

  const c = String(command).toLowerCase().replace(/\\/g, "/");

  /* A shell is not an owner. Killing it orphans what it wrapped. */
  const first = String(command).trim().match(/^"([^"]+)"|^(\S+)/);
  const exe = (first?.[1] ?? first?.[2] ?? "").toLowerCase().replace(/\\/g, "/");
  if (!/(^|\/)node(\.exe)?$/.test(exe)) return false;

  /* A next server's parent that is itself a next server is not the owner. */
  if (/\bnext\b/.test(c) && /\b(start|dev)\b/.test(c)) return false;

  /*
   * It has to name a scripts/ entry, which is how an audit is invoked, or sit
   * under the repository root for an absolute invocation.
   *
   * A KNOWN LIMIT, STATED RATHER THAN PRETENDED AWAY: a node process running
   * `scripts/<something>.mjs` in a DIFFERENT checkout matches this and would be
   * named as an owner. The cost is bounded and one-directional. The guard
   * refuses and prints a pid for a person to look at; it kills nothing on its
   * own. Naming one process too many costs a glance, and naming one too few
   * cost a board.
   */
  const scriptMatch = String(command).match(/scripts[\/\\]([\w.-]+\.mjs)/);
  return Boolean(scriptMatch) || c.includes(needle);
}

/**
 * =============================================================================
 * PLACE A SERVER BY ASKING WHO OWNS IT. Operator ruling, 2026-09-24.
 * =============================================================================
 *
 * `classifyNextProcess` can say `foreign` only from an ABSOLUTE path to another
 * checkout's next binary. A server started as `node node_modules/next/dist/bin/
 * next start -p 3155` has a RELATIVE path, so it is unplaceable from its own
 * command line and is reported as `unknown`, which blocks.
 *
 * WHAT THAT COST, on 2026-09-24. A board on this repository refused twice. The
 * second refusal named:
 *
 *     PID 19288  next start -p 3155
 *       OWNED BY PID 5492 (e2e-chain.mjs)
 *       node --require C:\Users\salon\projects\wattsmith\node_modules\tsx\...
 *
 * The guard had already resolved the owner and PRINTED its command line, which
 * names another checkout in plain text, and used that only to say which pid to
 * kill. It held the evidence to place the server and did not use it. Port 3151
 * and 3155 are nowhere near this repository's audit range of 3223 to 3229.
 *
 * SO THE OWNER'S COMMAND LINE IS EVIDENCE ABOUT THE CHILD. A checkout root is
 * derived from any absolute path running through a `node_modules` directory,
 * which is the one shape that positively identifies where a process was
 * launched from. If every root found belongs to somewhere else, and none is
 * ours, the server is foreign.
 *
 * IT IS NOT AN ALLOWLIST AND NAMES NO PROJECT. wattsmith appears nowhere in
 * this file. The test is "a checkout that is not this one", which stays true
 * for a project nobody has heard of yet.
 *
 * THE RISK, STATED RATHER THAN WAVED AT. Placing a server as foreign means it
 * no longer blocks, and a wrong placement would let a build run under a live
 * server of OURS and produce a torn artifact. Three things bound it: the
 * evidence has to be an absolute path through node_modules, the owner must not
 * mention this repository anywhere, and a placed server is still PRINTED so a
 * person can see what was set aside and why. The guard reports; it never kills
 * on its own.
 */
export function placeByOwner(ownerCommand, needle) {
  if (!ownerCommand || !String(ownerCommand).trim()) return "unknown";

  /* Flattened for the same reason classifyNextProcess is. See flattenPaths. */
  const c = flattenPaths(ownerCommand);
  if (c.includes(needle)) return "ours";

  /*
   * Every absolute path that runs through a node_modules directory. The text
   * before it is where that process was launched from, which is the only part
   * of an arbitrary command line that positively names a checkout.
   */
  const roots = new Set();
  for (const m of c.matchAll(/(?:file:\/\/\/)?((?:[a-z]:\/|\/)[^"'\s]*?)\/node_modules\//g)) {
    roots.add(m[1].replace(/^\/+/, "/"));
  }

  if (roots.size === 0) return "unknown";
  return [...roots].every((r) => r !== needle) ? "foreign" : "ours";
}

function ownerOf(pid) {
  const parentPid = parentPidOf(pid);
  if (!parentPid) return null;

  const command = commandLineOf(parentPid);
  const needle = repoRoot.toLowerCase().replace(/\\/g, "/");
  if (!classifyOwnerCandidate(command, needle)) return null;

  const scriptMatch = command.match(/scripts[\/\\]([\w.-]+\.mjs)/);
  return { pid: parentPid, command, script: scriptMatch ? scriptMatch[1] : null };
}

/** Parent pid for a pid, or 0 when it cannot be read. */
function parentPidOf(pid) {
  if (isWindows) {
    const out = run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue).ParentProcessId`,
    ]);
    return Number(out.trim()) || 0;
  }
  return Number(run("ps", ["-o", "ppid=", "-p", String(pid)]).trim()) || 0;
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
/**
 * A COMMAND LINE'S PATHS, FLATTENED SO A BINARY REACHED SIDEWAYS STILL PLACES.
 *
 * Operator ruling, 2026-10-02, after a build refused for two days against a
 * server it could plainly see and could not place.
 *
 * THE SHAPE THAT DEFEATED IT. npm's shim invokes a package binary through the
 * `.bin` directory and a parent hop:
 *
 *   "node" "C:\\Users\\salon\\projects\\wattsmith\\node_modules\\.bin\\\\..\\next\\dist\\bin\\next" start
 *
 * Lowercased with separators normalised, that is
 * `.../node_modules/.bin//../next/dist/bin/next`. Every test below looked for
 * the literal `/node_modules/next/`, which **never appears**: the path goes
 * through `.bin`, back up with `..`, and only then into `next`. So a server
 * whose command line names its checkout in full was classified `unknown`, the
 * guard failed closed exactly as designed, and the only remedies it could offer
 * were to stop another project's live server or to have the guard kill it.
 *
 * THE GUARD WAS NOT WRONG TO REFUSE. Failing closed on something it cannot
 * place is the 2026-09-22 ruling and it is right. What was wrong is that it
 * COULD place this one and the pattern could not see it, so a correct policy
 * fired on a false premise. That is worse than a missing rule, because the
 * output argues convincingly for the wrong action.
 *
 * SO THE PATH IS FLATTENED BEFORE ANY TEST, rather than every test learning a
 * second shape. Doubled separators collapse and `segment/..` pairs resolve, so
 * `.bin//../next` becomes `next` and the existing patterns match what they
 * always meant. A new shim shape tomorrow is handled here once instead of in
 * four regexes.
 */
export function flattenPaths(command) {
  let c = String(command).toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  /*
   * Resolve `x/../` repeatedly, because `a/b/../../c` needs two passes. Bounded
   * rather than while(true): a malformed path must not spin here, and the guard
   * runs before every build.
   */
  for (let i = 0; i < 8; i += 1) {
    const next = c.replace(/\/[^/"']+\/\.\.\//g, "/");
    if (next === c) break;
    c = next;
  }
  return c;
}

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

  const c = flattenPaths(command);
  if (!(/\bnext\b/.test(c) && /\b(start|dev)\b/.test(c))) return null;

  /*
   * A LAUNCHER IS NOT A SERVER, AND THE EXECUTABLE TEST CANNOT SEE THAT.
   *
   * The check above separates a shell from a server by its executable: bash is
   * not node. `npx` defeats that completely, because npx IS node running npm's
   * own CLI:
   *
   *   "node.exe" "C:/Program Files/nodejs/node_modules/npm/bin/npx-cli.js" next start -p 3188
   *
   * It passes the node test, it contains `next` and `start`, and the only
   * node_modules path in it belongs to npm's installation rather than to any
   * checkout. So it classified as `unknown` and blocked every build, while the
   * REAL server underneath it had just been correctly placed as foreign. The
   * guard was refusing on a wrapper whose child it had already cleared.
   *
   * WHAT SEPARATES THEM IS THE SCRIPT NODE IS RUNNING, not the executable: npm's
   * or npx's own CLI rather than next's binary. The server is always a separate
   * process and gets classified on its own merits, which is the same reason
   * `killTree` exists at all: the wrapper is not the thing holding the port.
   *
   * DROPPING IT LOSES NOTHING. If the wrapper were ours, the server beneath it
   * is ours too and blocks on its own command line. Nothing is cleared by this
   * except a process that was never the one writing .next.
   */
  if (/\/node_modules\/npm\/bin\/(npx|npm)-cli\.js/.test(c)) return null;

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
  /*
   * FOREIGN IS NOW RETURNED RATHER THAN DROPPED. Operator ruling, 2026-10-02:
   * a server placed in another repository is reported and ignored, never killed.
   *
   * It used to be silently discarded here, which was the right BEHAVIOUR and
   * left no trace. The cost showed up the first time a foreign server was the
   * reason a build could not proceed: the guard's output named two processes it
   * could not place and said nothing about the one it could, so a reader had no
   * way to see that the guard had already understood most of what was running.
   *
   * Reported and ignored is strictly more useful than invisible, and it costs
   * one line in a report that only prints when something is up anyway.
   */
  const classified = [];
  for (const r of rows) {
    if (r.pid === process.pid) continue;
    const ownership = classifyNextProcess(r.command, needle);
    if (ownership === null) continue;
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
        : ownership === "foreign"
          ? "a next server placed in ANOTHER repository, so it cannot touch this .next"
          : "a next server whose repository could not be established from its command line, so it is reported rather than assumed harmless",
    );
  }

  for (const e of byPid.values()) {
    e.command = commandLineOf(e.pid) || "(command line unavailable)";
    e.owner = ownerOf(e.pid);
  }

  /*
   * PLACED BY THEIR OWNER, AND SET ASIDE. See placeByOwner above.
   *
   * Only a process whose ONLY reason is that it could not be placed is eligible.
   * One holding an audit port keeps blocking whatever its owner says, because a
   * port in this repository's own range is a conflict regardless of whose server
   * it is: two servers cannot both have 3225.
   */
  const placed = [];
  const blockers = [];
  for (const e of [...byPid.values()].sort((a, b) => a.pid - b.pid)) {
    const onlyUnplaceable =
      e.ports.length === 0 &&
      e.reasons.length === 1 &&
      e.reasons[0].startsWith("a next server whose repository could not be established");

    /*
     * PLACED BY ITS OWN COMMAND LINE, which is the case that was missing.
     *
     * The branch below places a process by its OWNER, the parent, and that was
     * the only route available. It cannot help a foreign server started by a
     * shell: the parent is `cmd.exe /c npm run start`, which names no checkout,
     * so the server stayed unplaceable however clearly its own command line
     * named wattsmith.
     *
     * A server's own command line is better evidence about which repository it
     * belongs to than its parent's, and it was being consulted for everything
     * except this decision.
     *
     * STILL ONLY WHEN IT HOLDS NO PORT OF OURS. A foreign server on one of this
     * project's ports is a conflict whoever owns it, because two servers cannot
     * both have 4300. That reasoning is the existing comment's and is unchanged.
     */
    const placedItself =
      e.ports.length === 0 &&
      e.reasons.length === 1 &&
      e.reasons[0].startsWith("a next server placed in ANOTHER repository");

    if (placedItself) {
      placed.push({ ...e, placedAs: "foreign", placedBy: e.pid });
      continue;
    }

    if (onlyUnplaceable && e.owner && placeByOwner(e.owner.command, repoRoot.toLowerCase().replace(/\\/g, "/")) === "foreign") {
      placed.push({ ...e, placedAs: "foreign", placedBy: e.owner.pid });
      continue;
    }
    blockers.push(e);
  }

  blockers.placed = placed;
  return blockers;
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
      const head = `  PID ${b.pid}${where}\n    ${b.reasons.join("; ")}\n    ${b.command}`;
      if (!b.owner) return head;
      /*
       * THE OWNER IS PRINTED BECAUSE KILLING THE SERVER ALONE STARTS ANOTHER.
       * This is the line that would have saved the board of 2026-09-22.
       */
      return (
        `${head}\n    OWNED BY PID ${b.owner.pid}` +
        `${b.owner.script ? ` (${b.owner.script})` : ""}, which will start another server if you kill` +
        `\n    only the one above. Kill the owner instead.\n    ${b.owner.command}`
      );
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

  /*
   * SAY WHAT WAS SET ASIDE, ALWAYS, INCLUDING WHEN NOTHING BLOCKS.
   *
   * A placement that is silent is a guard quietly deciding not to protect
   * something, which is worse than the refusal it replaces: a wrong placement
   * would let a build run under a live server of ours. Printed, it is one line
   * a person can disagree with. This is the same rule the audits follow about
   * saying which world they measured.
   */
  for (const p of blockers.placed ?? []) {
    console.error(
      `[build-guard] PID ${p.pid} placed as FOREIGN by its owner (PID ${p.placedBy}) and is not blocking.\n` +
        `              ${p.command}\n` +
        `              owner: ${p.owner?.command ?? "(unknown)"}`,
    );
  }

  if (blockers.length === 0) return { skipped: false, blockers: [], placed: blockers.placed ?? [] };

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
      /*
       * THE COMMAND TARGETS THE OWNER WHERE THERE IS ONE. Operator ruling,
       * 2026-09-23. Until today this printed the SERVER's pid, and following it
       * is what produced the orphan that killed a board: /T kills children, not
       * the parent, so the audit that owns the server survives and starts
       * another. The guard was printing the command that reproduces the fault
       * it was reporting.
       */
      (isWindows
        ? (() => {
            const target = blockers[0].owner ?? blockers[0];
            const note = blockers[0].owner
              ? `    That is the OWNER, not the server. Killing the server alone leaves the\n` +
                `    audit that started it running, and it will start another one.\n`
              : `    (/T matters: npx is a shell wrapping the real server, and killing it\n` +
                `    alone orphans the server. This is also why pkill appears to succeed\n` +
                `    here and does nothing.)\n`;
            return `  - taskkill /PID ${target.pid} /T /F\n${note}`;
          })()
        : `  - kill -9 ${blockers.map((b) => b.owner?.pid ?? b.pid).join(" ")}\n`) +
      `  - Re-run with AUDIT_KILL_STALE=1 to have this guard kill them for you.\n`,
  );
}
