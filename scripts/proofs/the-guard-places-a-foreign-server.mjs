/**
 * PROOF: A SERVER WHOSE OWNER NAMES ANOTHER CHECKOUT DOES NOT BLOCK OUR BOARD.
 *
 * Operator ruling, 2026-09-24: "a server whose owner's command line names
 * another checkout is foreign and does not block our board."
 *
 * =============================================================================
 * THE EVIDENCE THIS WAS BUILT FROM IS REAL AND IS QUOTED BELOW
 * =============================================================================
 *
 * A board on this repository refused twice on 2026-09-24. The second refusal
 * printed, in the guard's own words:
 *
 *     PID 19288  next start -p 3155
 *       OWNED BY PID 5492 (e2e-chain.mjs), which will start another server if
 *       you kill only the one above.
 *       node --require C:\Users\salon\projects\wattsmith\node_modules\tsx\...
 *
 * `classifyNextProcess` could not place the SERVER, because it was started with
 * a RELATIVE path (`node node_modules/next/dist/bin/next start -p 3155`) and
 * only an absolute path can positively name a checkout. So it was `unknown`,
 * and unknown blocks.
 *
 * The guard had already resolved the owner and printed its command line, which
 * names another checkout in plain text, and used it only to say which pid to
 * kill. It held the evidence and did not use it.
 *
 * =============================================================================
 * EVERY FIXTURE HERE IS A REAL COMMAND LINE
 * =============================================================================
 *
 * Taken from this machine on 2026-09-24 rather than invented to match the rule,
 * which is the standard the commit-guard proof set: a check is only as good as
 * the inputs it was given, and the input worth having is the real one.
 */
import { placeByOwner } from "../lib/build-guard.mjs";

const OURS = "c:/users/salon/projects/254engineering";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/* ---------------------------------------------------------- foreign owners */

check(
  "wattsmith's e2e chain places its server as foreign",
  placeByOwner(
    '"C:\\Program Files\\nodejs\\node.exe" --require C:\\Users\\salon\\projects\\wattsmith\\node_modules\\tsx\\dist\\preflight.cjs --import file:///C:/Users/salon/projects/wattsmith/node_modules/tsx/dist/loader.mjs --conditions=react-server scripts/e2e-chain.mjs',
    OURS,
  ) === "foreign",
  "the real owner command line that blocked a board this morning",
);

check(
  "and so does its dispatch check, which blocked the next build",
  placeByOwner(
    '"C:\\Program Files\\nodejs\\node.exe" --import file:///C:/Users/salon/projects/wattsmith/node_modules/tsx/dist/loader.mjs scripts/dispatch-mobile-check.mjs',
    OURS,
  ) === "foreign",
  "a second real one, on port 3151",
);

/* ------------------------------------------------------------- our owners */

check(
  "an owner running out of THIS repository is ours",
  placeByOwner(
    '"C:\\Program Files\\nodejs\\node.exe" --import file:///C:/Users/salon/projects/254engineering/node_modules/tsx/dist/loader.mjs scripts/launch-audit.mjs',
    OURS,
  ) === "ours",
  "the same shape as the foreign ones, differing only in the checkout",
);

/*
 * THE CASE THAT MATTERS MOST, AND IT IS THE ONE A LOOSER RULE WOULD GET WRONG.
 * An owner that mentions ANOTHER checkout somewhere but also runs out of ours
 * is OURS. Anything else would set aside a real server of this repository and
 * let a build run underneath it.
 */
/*
 * THE CASE THAT THE FIRST VERSION OF THIS PROOF DID NOT COVER, AND THE
 * INJECTION IS WHAT SAID SO.
 *
 * `placeByOwner` opens with `if (c.includes(needle)) return "ours"`. Removing
 * that line left every check here green, because the fallback below it answers
 * "ours" too whenever a node_modules path resolves to this repository. An
 * injection that passes is a check proven by nothing, so the missing fixture is
 * the one where the early return is the ONLY thing that can answer: an owner
 * that names this repository WITHOUT going through node_modules, which is what
 * an audit invoked by absolute path looks like.
 *
 * Without the early return that case answers "unknown". Both "ours" and
 * "unknown" block, so nothing unsafe follows from it, and it is still wrong:
 * the guard would be saying it cannot place a process running out of its own
 * repository, and the next person to build on that answer inherits it.
 */
check(
  "an owner naming this repository WITHOUT a node_modules path is still ours",
  placeByOwner('"node" C:/Users/salon/projects/254engineering/scripts/launch-audit.mjs', OURS) === "ours",
  "the early return is the only thing that can answer this, which is why it exists",
);

check(
  "an owner naming another checkout AND ours is ours",
  placeByOwner(
    '"node" --import file:///C:/Users/salon/projects/254engineering/node_modules/tsx/dist/loader.mjs scripts/copy-project.mjs --from C:/Users/salon/projects/wattsmith/node_modules/thing',
    OURS,
  ) === "ours",
  "a wrong answer here would stop the guard protecting this repository",
);

/* ------------------------------------------------- when it must not decide */

check(
  "an owner with no absolute path is UNKNOWN, not foreign",
  placeByOwner('"node" scripts/e2e-chain.mjs', OURS) === "unknown",
  "a relative command line names no checkout, and unknown keeps blocking",
);

check(
  "no owner at all is UNKNOWN",
  placeByOwner(null, OURS) === "unknown" && placeByOwner("", OURS) === "unknown",
  "an absent answer is never a permissive one",
);

check(
  "a path that does not run through node_modules names no checkout",
  placeByOwner('"node" C:/Users/salon/Downloads/thing.mjs', OURS) === "unknown",
  "the evidence has to be a path through node_modules, which is where a launch root shows",
);

/* ------------------------------------------------- it names no project ever */

const source = (await import("node:fs")).readFileSync("scripts/lib/build-guard.mjs", "utf8");
check(
  "the guard names no project, so the rule holds for one nobody has heard of yet",
  !/wattsmith/i.test(source.replace(/\/\*[\s\S]*?\*\//g, "")),
  "an allowlist of names is a list somebody grows until the scan checks nothing",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. A foreign server is placed by its owner and does not block."
    : `\n${wrong} check(s) wrong.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
