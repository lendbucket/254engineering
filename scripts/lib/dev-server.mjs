import { spawn, spawnSync } from "node:child_process";
import { readSource } from "./read-source.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Boot and reliably tear down a Next server for a harness to drive.
 *
 * WHY THIS IS A MODULE AND NOT FOUR LINES INLINE
 * ----------------------------------------------
 * Ported from the engineering reference repo, where two harnesses got this wrong
 * in the same two ways. The failure mode is the expensive kind: a run that
 * reports a result about a server nobody meant to test.
 *
 *   1. `child.kill()` does not stop a Next server on Windows. spawn runs through
 *      a shell there, so killing the child kills the shell and orphans the node
 *      process holding the port.
 *
 *   2. A naive waitForServer treats any answer on the port as success. Combined
 *      with (1), a run whose own server failed to bind silently attaches to the
 *      orphan, an older build, and reports whatever that stranger happens to do.
 *      That is how a passing check and a failing check both become meaningless.
 *
 * So: refuse to start if the port is taken, and kill the whole process tree.
 */

/**
 * Resolves true when nothing answers at `url`.
 *
 * Deliberately a connect probe and not a bind probe. Binding is the obvious test
 * and it is wrong here: on Windows a stray server holds the port on IPv6,
 * `localhost` resolves to ::1 first, and a probe that binds 127.0.0.1 succeeds
 * while every request the harness makes still reaches the stranger. Asking the
 * same question the harness asks, over the same name resolution, is the only
 * probe that cannot disagree with it.
 */
async function nothingAnswersAt(url) {
  try {
    await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2000) });
    return false;
  } catch {
    return true;
  }
}

/*
 * HOW LONG A PORT MAY TAKE TO FALL SILENT AFTER ITS SERVER IS STOPPED.
 *
 * Board 42505750069 (2026-11-08): after native-audit, the next audit found port
 * 4300 still answering and refused to start, correctly, and fourteen writers
 * audits never ran. Off Windows stopTree resolves when the npx process exits,
 * and the Next server it spawned can still hold the port for a moment after.
 * So stop() waits for the port to fall silent, and a start that finds the port
 * answering waits the same bounded time before it refuses, and names the
 * process still listening when it does (BACKLOG, "THE WRITERS SHARD CAN STOP ON
 * ITS OWN SERVER"; Robert's overnight orders of 2026-11-13, item 3).
 */
export const PORT_RELEASE_MS = 30_000;

/** Resolves true once nothing answers at `base`, false if something still does after `ms`. */
export async function waitUntilFree(base, ms = PORT_RELEASE_MS) {
  const started = Date.now();
  for (;;) {
    if (await nothingAnswersAt(`${base}/`)) return true;
    if (Date.now() - started >= ms) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** The process listening on `port`, as the system reports it, for a refusal to name. Never throws. */
export function listenerOn(port) {
  try {
    if (process.platform === "win32") {
      /* Every protocol: "-p TCP" lists IPv4 only, and localhost resolves to ::1 first on Windows. */
      const out = spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout ?? "";
      const line = out.split(/\r?\n/).find((l) => l.includes(`:${port} `) && /LISTENING/.test(l));
      return line ? `pid ${line.trim().split(/\s+/).pop()} (netstat)` : "no listener named by netstat";
    }
    const lsof = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    const text = (lsof.stdout ?? "").trim();
    if (text) return text.split(/\r?\n/).slice(1).join(" | ") || text;
    const ss = spawnSync("ss", ["-ltnp", `sport = :${port}`], { encoding: "utf8" });
    return (ss.stdout ?? "").trim().split(/\r?\n/).slice(1).join(" | ") || "no listener named by lsof or ss";
  } catch (err) {
    return `the listener could not be read (${err instanceof Error ? err.message : String(err)})`;
  }
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} never came up.`);
}

/**
 * Start a Next server on `port` with `env` layered over the current environment.
 * Returns the base URL and a stop() that actually stops it.
 *
 * `command` picks `next start` (the default, and what any harness driving a built
 * app wants) or `next dev`. The dev option exists for contrast-audit, which is
 * deliberately runnable without a build: it reads the CSS the browser computes,
 * so a production bundle buys it nothing and costs a build step.
 */
export async function startNextServer({ port, env = {}, timeoutMs = 120000, command = "start" }) {
  const base = `http://localhost:${port}`;

  if (!(await nothingAnswersAt(`${base}/`))) {
    console.log(`  [dev-server] ${base} is still answering; waiting up to ${PORT_RELEASE_MS / 1000} s for it to fall silent`);
    if (!(await waitUntilFree(base, PORT_RELEASE_MS))) {
      throw new Error(
        `Something is still serving ${base} after ${PORT_RELEASE_MS / 1000} s. Refusing to start, because attaching ` +
          `to whatever is there would report results about the wrong server. Listening: ${listenerOn(port)}. Stop it and re-run.`,
      );
    }
    console.log(`  [dev-server] ${base} fell silent; starting`);
  }

  // The server's own output goes to a file, not to /dev/null.
  //
  // stdio: "ignore" is the tempting default and it costs days. When a page
  // cannot reach its database the server says so on every request, straight into
  // the void, and what the harness shows instead is a Playwright timeout on some
  // element, which points at markup that is fine. The one process that knows the
  // answer must not be the one being silenced.
  const logDir = process.env.AUDIT_LOG_DIR || os.tmpdir();
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `next-${command}-${port}.log`);
  const log = fs.openSync(logPath, "w");
  console.log(`  [dev-server] port ${port} logging to ${logPath}`);

  const child = spawn("npx", ["next", command, "-p", String(port)], {
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log],
    shell: process.platform === "win32",
    /* Its own process group off Windows, so stopTree can stop npx AND the next
     * server it spawned; see stopTree. Windows walks the tree with taskkill. */
    detached: process.platform !== "win32",
  });

  try {
    await waitForServer(`${base}/`, timeoutMs);
  } catch (err) {
    await stopTree(child);
    // A server that never came up has already explained why in the log. Carry
    // the tail into the error rather than making the reader go and find it.
    throw new Error(`${err.message}\n\nLast lines of ${logPath}:\n${tailOf(logPath)}`);
  } finally {
    fs.closeSync(log);
  }

  /* `state()` says whether the npx process is alive, exited, or killed by a signal,
   * so a lost server can be reported as one of those rather than as silence. */
  const state = () =>
    child.signalCode ? `killed by ${child.signalCode}` : child.exitCode !== null ? `exited ${child.exitCode}` : "still running";
  /* Stopped, and the port silent, before the next audit may start one (PORT_RELEASE_MS above). */
  const stop = async () => {
    await stopTree(child);
    if (!(await waitUntilFree(base, PORT_RELEASE_MS))) {
      console.log(`  [dev-server] ${base} still answering ${PORT_RELEASE_MS / 1000} s after stop. Listening: ${listenerOn(port)}`);
    }
  };
  return { base, logPath, state, stop };
}

/** Last `lines` of a log file, for pasting into an error. Never throws. */
function tailOf(file, lines = 25) {
  try {
    return (
      readSource(file).trimEnd().split(/\r?\n/).slice(-lines).join("\n") || "(empty)"
    );
  } catch {
    return "(log unreadable)";
  }
}

/**
 * Kill a child and everything it spawned.
 *
 * On Windows `taskkill /T` is what walks the tree; killing the shell alone would
 * leave the server behind. Elsewhere the child leads its own process group, and
 * the group is signalled.
 */
function stopTree(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();

    if (process.platform === "win32" && child.pid) {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      killer.on("exit", () => resolve());
      killer.on("error", () => {
        child.kill();
        resolve();
      });
      return;
    }

    child.once("exit", () => resolve());
    /*
     * The whole group, not the npx process alone. Until 2026-10-22 this said "the
     * plain kill is enough", which had never been tried: every board ran on
     * Windows. On a Linux runner a server that outlived its npx would hold its
     * port and its .next into phase two, which is the collision the build guard
     * exists for.
     */
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill();
    }
    // Do not hang the harness on a process that refuses to go.
    setTimeout(resolve, 5000).unref?.();
  });
}

/*
 * THE NESTED-PAGE 404 DIAGNOSTIC. Robert's ruling of 2026-11-18, answer 3:
 * "if it recurs a third time on any commit, build a diagnostic that dumps the
 * dev server's route state when a page that exists on disk answers 404, and
 * never loosen the check." It recurred a third time on board 44874371813
 * (2026-11-21, batch/day-1121 at 1851b22): mobile-audit's next dev on 4301
 * answered `/` with 200 and every nested page and nested API route with 404,
 * from its first request, minutes after doors-audit's next dev in the same
 * checkout had stopped cleanly.
 *
 * WHAT IT WRITES, beside the server's own log so the board seals it with that
 * log: the `.next` tree (path, size, modified time) to a bounded depth; every
 * routes manifest found under `.next`, with whether the failing route's page
 * key appears in it; and every running `next` process with its age, its
 * parent and its command line. That is the state that would tell a stale or
 * half-written dev cache, a second server on the same checkout, and a missing
 * route entry apart. It CHANGES NOTHING and decides nothing: the audit's FAIL
 * stands exactly as it was, which is the second half of the ruling.
 */
export function dumpRouteState({ port, failedPath, logDir = process.env.AUDIT_LOG_DIR || os.tmpdir() }) {
  const out = [];
  const say = (line) => out.push(line);
  say(`ROUTE STATE at ${new Date().toISOString()}, port ${port}, after ${failedPath} answered 404`);
  say(`cwd ${process.cwd()}`);
  say("");
  say("== the .next tree (depth 5, at most 1500 entries) ==");
  let listed = 0;
  const walk = (dir, depth) => {
    if (depth > 5 || listed >= 1500) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      say(`  (could not read ${dir}: ${e.message})`);
      return;
    }
    for (const e of entries) {
      if (listed >= 1500) return;
      const p = path.join(dir, e.name);
      let st = null;
      try {
        st = fs.statSync(p);
      } catch {
        /* removed between readdir and stat */
      }
      listed += 1;
      say(`  ${e.isDirectory() ? "d" : "f"} ${String(st ? st.size : "?").padStart(10)} ${st ? st.mtime.toISOString() : "?"} ${path.relative(process.cwd(), p)}`);
      if (e.isDirectory() && e.name !== "node_modules" && !/^(cache|turbopack)$/.test(e.name)) walk(p, depth + 1);
    }
  };
  walk(path.join(process.cwd(), ".next"), 1);
  say("");
  say("== routes manifests ==");
  const manifests = [];
  const findManifests = (dir, depth) => {
    if (depth > 6) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) findManifests(p, depth + 1);
      else if (/(app-paths-manifest|routes-manifest|pages-manifest|app-path-routes-manifest)\.json$/.test(e.name)) manifests.push(p);
    }
  };
  findManifests(path.join(process.cwd(), ".next"), 1);
  if (!manifests.length) say("  none found under .next");
  const firstSegment = failedPath.split("?")[0].split("/").filter(Boolean)[0] ?? "";
  for (const m of manifests) {
    let text = "";
    try {
      text = fs.readFileSync(m, "utf8");
    } catch (e) {
      say(`  ${path.relative(process.cwd(), m)}: could not read (${e.message})`);
      continue;
    }
    const keys = text.match(/"\/[^"]*"/g) ?? [];
    const near = keys.filter((k) => firstSegment && k.includes(`/${firstSegment}`)).slice(0, 40);
    say(`  ${path.relative(process.cwd(), m)}: ${text.length} bytes, ${keys.length} quoted paths, ${near.length} under /${firstSegment}`);
    for (const k of near) say(`    ${k}`);
  }
  say("");
  say("== running next processes ==");
  const ps =
    process.platform === "win32"
      ? spawnSync("tasklist", ["/v"], { encoding: "utf8" })
      : spawnSync("ps", ["-eo", "pid,ppid,etime,args"], { encoding: "utf8" });
  const lines = String(ps.stdout || "").split("\n").filter((l) => /next|turbopack/i.test(l) && !/\bps -eo\b/.test(l));
  for (const l of lines.slice(0, 40)) say(`  ${l.trim().slice(0, 300)}`);
  if (!lines.length) say("  none matched");
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const file = path.join(logDir, `route-state-${port}-${Date.now()}.txt`);
    fs.writeFileSync(file, out.join("\n") + "\n");
    console.log(`  [dev-server] a page that exists answered 404; route state written to ${file}`);
    return file;
  } catch (e) {
    console.log(`  [dev-server] a page that exists answered 404, and the route state could not be written: ${e.message}`);
    return null;
  }
}
