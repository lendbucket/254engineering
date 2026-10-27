/**
 * A ROUTE A BROWSER AUDIT NEVER MEASURED IS COULD NOT TELL, NEVER FAIL AND
 * NEVER PASS, AND IT BLOCKS A MERGE EXACTLY AS A FAIL DOES.
 *
 *   node scripts/proofs/an-unmeasured-route-is-could-not-tell-and-blocks.mjs
 *
 * Robert's ruling of 2026-10-26, 08:19 Central, answer 9, from board
 * 40266030302, where a lost sign in printed 284 layout FAILs nobody measured.
 * The verdict rule is asked directly, its ceiling is pinned here as a literal,
 * and the source is read for the three places that decide it: the bounce, the
 * missing session, and the exit code, plus the board's tally, which must count
 * COULD NOT TELL against a merge or none of this means anything.
 */
import { readFileSync } from "node:fs";
import { unmeasuredVerdict, MAX_UNMEASURED_ROUTE_SHARE } from "../lib/unmeasured-verdict.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* The ruled ceiling, pinned as a literal so moving it costs two edits. */
check("the share that fails a run outright is 10% of routes", MAX_UNMEASURED_ROUTE_SHARE === 0.1, String(MAX_UNMEASURED_ROUTE_SHARE));

const v = (failures, unmeasuredRoutes, totalRoutes) => unmeasuredVerdict({ failures, unmeasuredRoutes, totalRoutes });
check("everything measured and nothing failed is a PASS, exit 0", v([], 0, 60).exitCode === 0 && v([], 0, 60).verdict === "PASS");
const one = v([], 1, 60);
check("one route unmeasured and nothing failed is COULD NOT TELL, exit 3, never a PASS", one.exitCode === 3 && one.verdict === "COULD NOT TELL", one.headline);
check("at exactly the ceiling it is still COULD NOT TELL", v([], 6, 60).exitCode === 3, v([], 6, 60).headline);
const lost = v([], 7, 60);
check("above the ceiling the run fails outright, exit 1, saying it measured too little", lost.exitCode === 1 && /measured too little/.test(lost.headline), lost.headline);
const allLost = v([], 51, 60);
check("a run that lost its sign in for most routes is a FAIL, not a partial green", allLost.exitCode === 1, allLost.headline);
check("a FAIL on what was measured is a FAIL even with a route unmeasured", v(["home @320: overflow"], 1, 60).exitCode === 1);
check("and no routes at all is not a pass", v([], 0, 0).exitCode === 1);

/* The source: what decides it in mobile-audit. */
const src = readFileSync("scripts/mobile-audit.mjs", "utf8");
check(
  "a page that bounced to sign in is returned unmeasured, not as three false checks",
  /return \{ unreachable: true, hscroll: null, taps: null, clip: null, phone: null, note: "bounced to sign in, not measured" \};/.test(src) &&
    !/hscroll: false, taps: false, clip: false, phone: false, note: "bounced to sign in/.test(src),
);
const noSession = src.slice(src.indexOf("if (t.portal && !sessions[t.portal]?.cookie)"), src.indexOf("const cell = await measurePage("));
check(
  "a template with no session is counted as unmeasured, never written and skipped",
  /unreachable: true/.test(noSession) && /unreachable\.push\(/.test(noSession) && /unmeasuredRoutes\.add\(t\.name\)/.test(noSession),
);
check("every unmeasured cell counts toward the route share", (src.match(/unmeasuredRoutes\.add\(t\.name\)/g) ?? []).length === 2);
check(
  "the exit code is the verdict's, and nothing else sets it in the result",
  /process\.exitCode = verdict\.exitCode;/.test(src) && !/`GREEN ON WHAT LOADED, and \$\{/.test(src) &&
    (src.slice(src.indexOf("RESULT ================"), src.lastIndexOf("} catch (err)")).match(/process\.exitCode =/g) ?? []).length === 1,
);

/* The board: COULD NOT TELL must block a merge, or exit 3 is a pass by another name. */
const audit = readFileSync("scripts/audit.mjs", "utf8");
check("the suite reads exit 3 as COULD NOT TELL", /r\.code === COULD_NOT_TELL \? "COULD NOT TELL"/.test(audit));
const board = readFileSync("scripts/ci/board-verdict.mjs", "utf8");
check(
  "and the board counts anything but PASS against the merge",
  /if \(verdict !== "PASS" && !INFORMATIONAL\.has\(name\)\) problems\.push/.test(board),
);
const { INFORMATIONAL } = await import("../ci/shards.mjs");
check("with mobile-audit not exempt as informational", INFORMATIONAL instanceof Set && !INFORMATIONAL.has("mobile-audit"), [...(INFORMATIONAL ?? [])].join(", ") || "none");

console.log("");
if (wrong === 0) {
  console.log("PASS: an unmeasured route is COULD NOT TELL, it blocks a merge as a FAIL does, and a run that measured too little fails outright.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
