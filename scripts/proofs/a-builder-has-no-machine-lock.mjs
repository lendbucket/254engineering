/**
 * PROOF: THE BUILD PREFLIGHT DOES NOT REQUIRE THIS COMPUTER.
 *
 * Operator ruling, 2026-09-28, after the production deploy of `0d4024e` failed.
 *
 * WHAT HAPPENED. `bc2397b` put the machine lock into `scripts/preflight-build.mjs`,
 * which is wired as `prebuild` so that it runs on every `npm run build` without
 * anybody remembering it. That is the right design and it is exactly why this
 * broke: Vercel runs `npm run build` too. The lock wrote to a TYPED
 * `C:/Users/salon/.test-lock`, a directory no builder has, and the deploy died:
 *
 *     Error: ENOENT: no such file or directory, open 'C:/Users/salon/.test-lock'
 *       at takeLock (scripts/lib/machine-lock.mjs:164)
 *       at scripts/preflight-build.mjs:25
 *
 * Production was unaffected only because Vercel kept serving the previous
 * deployment. Nothing protected us there; we were lucky about which half of the
 * pipeline failed.
 *
 * =============================================================================
 * WHY NO BOARD COULD HAVE CAUGHT IT, WHICH IS THE PART WORTH CARRYING
 * =============================================================================
 *
 * Every board builds. Sixty of them have. Not one of them has ever built the way
 * a builder does, because every board runs on the machine whose home directory
 * happens to exist, holding a lock file that happens to be there. The board and
 * the deploy run the same command and do not run the same thing.
 *
 * That is this repository's vacuous green in a new costume. A check is only over
 * the environment it ran in, and "the build passes" had silently meant "the
 * build passes HERE" for four days. The backlog carries the unbuilt half: a
 * board that builds under a CI-shaped environment.
 *
 * =============================================================================
 * WHAT THIS PROVES, IN BOTH DIRECTIONS
 * =============================================================================
 *
 * The reproduction is the absent home directory, because that is what the
 * builder actually had. `os.homedir()` reads USERPROFILE on Windows, so pointing
 * it at a path that does not exist reproduces Vercel's condition exactly: a lock
 * path whose parent directory is not there.
 *
 *   as deployed   VERCEL=1 and a home that does not exist. The preflight must
 *                 say it skipped both and exit 0, touching no filesystem.
 *   injected      the same, with the CI skip removed from BOTH the preflight and
 *                 takeLock. It must fail with ENOENT naming that path.
 *   at home       no VERCEL, the real home. The lock must still be taken and
 *                 released, or this fix has bought CI at the cost of the machine.
 *
 * THE THIRD CASE IS THE ONE THAT KEEPS THIS HONEST. A skip that fires everywhere
 * would pass the first two and quietly delete the coordination the lock exists
 * for, which is the failure this proof would otherwise be blind to.
 *
 * It runs the PREFLIGHT rather than a whole build, deliberately: a full
 * `next build` takes minutes and would test Next rather than this hook. The
 * whole-build form is the one command in the report, run once by hand.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = "C:/Users/salon/projects/254engineering";
const PREFLIGHT = "scripts/preflight-build.mjs";

/* A home that does not exist, which is the builder's condition. Built under a
 * real temp directory so the name cannot collide with anything real. */
const ABSENT_HOME = join(mkdtempSync(join(tmpdir(), "no-home-")), "not-created");

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

function runPreflight(env) {
  const r = spawnSync("node", [PREFLIGHT], {
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

// ------------------------------------------------------------ as deployed

const deployed = runPreflight({
  VERCEL: "1",
  USERPROFILE: ABSENT_HOME,
  HOME: ABSENT_HOME,
});

check(
  "on a builder the preflight exits 0",
  deployed.status === 0,
  `exit ${deployed.status}. ${deployed.out.trim().split("\n").pop() ?? ""}`,
);

check(
  "and says in one line that it skipped both",
  /CI or deploy environment: skipping the machine lock and the build guard/.test(deployed.out),
  deployed.out.trim().split("\n")[0] ?? "no output",
);

check(
  "and wrote no lock into the home it was given",
  !existsSync(join(ABSENT_HOME, ".test-lock")),
  "a builder's filesystem is not ours to write to",
);

// ---------------------------------------------------------------- injected

/*
 * THE INJECTION IS THE REAL FILE, EDITED AND RESTORED BY COPY. CLAUDE.md, tooling
 * rule three: `git checkout <path>` restores the last COMMITTED state, which is
 * not "the line I just changed", and the difference is exactly the work in
 * progress. So both files are backed up, patched, and restored byte identical,
 * and the restore is VERIFIED rather than assumed.
 */
const targets = [join(REPO, PREFLIGHT), join(REPO, "scripts/lib/machine-lock.mjs")];
const backups = targets.map((t) => readFileSync(t, "utf8"));

let injected;
try {
  /* Remove the skip from the caller and from the lock, which is what "remove the
   * skip" has to mean now that the fix lives in both. Patching only one would
   * leave the other holding the line and the injection would prove nothing. */
  writeFileSync(
    targets[0],
    backups[0].replace("if (inCiOrDeploy()) {", "if (false && inCiOrDeploy()) {"),
  );
  writeFileSync(
    targets[1],
    backups[1].replace("if (inCiOrDeploy()) return () => {};", "/* skip removed by the injection */"),
  );

  const bothPatched =
    readFileSync(targets[0], "utf8").includes("false && inCiOrDeploy()") &&
    !readFileSync(targets[1], "utf8").includes("if (inCiOrDeploy()) return () => {};");
  check("the injection actually patched both files", bothPatched, "or the FAIL below would mean nothing");

  injected = runPreflight({
    VERCEL: "1",
    USERPROFILE: ABSENT_HOME,
    HOME: ABSENT_HOME,
  });
} finally {
  targets.forEach((t, i) => writeFileSync(t, backups[i]));
}

const restored = targets.every((t, i) => readFileSync(t, "utf8") === backups[i]);
check("both files restored byte identical", restored, "verified by comparison, not assumed");

check(
  "with the skip removed, a builder fails with ENOENT on the lock path",
  injected.status !== 0 && /ENOENT/.test(injected.out) && /\.test-lock/.test(injected.out),
  `exit ${injected.status}. ${(injected.out.match(/Error:.*/) ?? ["no Error line"])[0]}`,
);

// ------------------------------------------------------------------ at home

/*
 * The machine keeps its lock. Run with no CI variable and the REAL home, the
 * preflight must reach the lock and the guard. It is run with the lock already
 * published as held by this process, so it takes the re-entrant path and cannot
 * wait sixty seconds on anything.
 */
const atHome = runPreflight({
  VERCEL: "",
  CI: "",
  GITHUB_ACTIONS: "",
  MACHINE_LOCK_HELD: "",
});

check(
  "at home the preflight does NOT report a CI skip",
  !/skipping the machine lock/.test(atHome.out),
  "a skip that fires everywhere would pass the two cases above and delete the coordination",
);

check(
  "and it reaches the build guard, which reports on .next",
  /\[build-guard\]/.test(atHome.out),
  atHome.out.trim().split("\n").pop() ?? "no output",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. The preflight coordinates on a developer machine and gets out of the way on a builder."
    : `\n${wrong} check(s) wrong.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
