/**
 * EVERY PORT THIS PROJECT BINDS COMES FROM ONE DECLARATION, AND THE BLOCK IS
 * CLEAR OF EVERY OTHER PROJECT ON THIS MACHINE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/every-port-comes-from-one-declaration.mjs
 *
 * Operator ruling, 2026-10-02: move this project's build, dev server and audit
 * ports to a range no other project uses, after checking what is in use.
 *
 * WHAT THIS EXISTS TO STOP, and it is two different failures.
 *
 * THE FIRST IS THE ONE THAT HAPPENED. A build refused because a stale server
 * held a port, the build guard printed a taskkill line, and the process was
 * another project's LIVE server. Following the guard's own suggestion would have
 * destroyed a run of the operator's. The ports moved out of that neighbourhood
 * so the two projects stop competing at all.
 *
 * THE SECOND IS WORSE AND WAS ALREADY TRUE. Thirty two literals held this
 * project's ports, and FIVE of them collided with each other: design-shots with
 * break-glass, probe-capture with doors, overnight-roles with launch-audit's
 * live build, exploratory-portal and preview-mispointing with its prelaunch
 * build, and wordmark-measure with break-glass again. Nothing had broken,
 * because no two of those run at once today. The symptom when they do is not a
 * refusal: it is a server answering on a port another script believes it owns,
 * which is a WRONG ANSWER rather than an error, and much harder to read.
 *
 * SO THE CHECK IS NOT "ARE THE PORTS RIGHT". It is that no script may write a
 * port literal at all, which is the only version that survives somebody adding
 * a fourteenth harness in six months.
 */

import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import {
  PORTS,
  PORT_BASE,
  PORT_RANGE,
  ALL_PORTS,
  AUDIT_BASE_URL,
  PACKAGE_JSON_DEV_PORT,
} from "../lib/ports.mjs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------- 1. the declaration is coherent */

rec(
  "every declared port is distinct",
  new Set(ALL_PORTS).size === ALL_PORTS.length,
  `${ALL_PORTS.length} port(s), ${new Set(ALL_PORTS).size} distinct. The old scheme had five collisions, which is why this is asserted rather than assumed`,
);

rec(
  "and every one is inside the declared range",
  ALL_PORTS.every((p) => p >= PORT_RANGE.from && p < PORT_RANGE.to),
  `${PORT_RANGE.from} to ${PORT_RANGE.to - 1}, which is what the build guard scans`,
);

/*
 * THE GUARD'S RANGE MUST COVER THE PORTS, or a genuinely stale server of ours is
 * reported as not ours and the operator is told to investigate somebody else's
 * process. That is the failure this whole change is about, inverted.
 */
const guardSrc = readFileSync("scripts/lib/build-guard.mjs", "utf8");
rec(
  "the build guard derives its range rather than naming one",
  /AUDIT_PORT_RANGE = \[PORT_RANGE\.from, PORT_RANGE\.to\]/.test(guardSrc),
  "a literal there would go on watching an empty range after the block moved",
);

/* --------------------------------- 2. no script writes a port literal */

/*
 * THE SUBJECT IS EVERY SCRIPT, derived by a glob rather than listed, because a
 * list is the memory problem one level down and this check exists precisely to
 * catch the file nobody remembered.
 */
const files = globSync("scripts/**/*.mjs").filter(
  (f) => !f.replace(/\\/g, "/").endsWith("scripts/lib/ports.mjs"),
);

rec(
  "the sweep has a subject",
  files.length > 40,
  `${files.length} script(s) scanned. A glob that matched nothing would pass every check below it`,
);

/*
 * A BINDING, not any four digit number. A port in a comment or a usage example
 * is prose, and failing on it would make this a check nobody can satisfy; CLAUDE.md
 * records an allowlist being refused for exactly that reason, so the pattern
 * names the SHAPES that bind instead.
 */
const BINDING = [
  { what: "a next server port", re: /\bport:\s*\d{4}\b/ },
  { what: "a PORT constant", re: /\bPORT\w*\s*=\s*\d{4}\b/ },
  { what: "a port default behind an env var", re: /process\.env\.\w*PORT\w*\s*(?:\|\||\?\?)\s*\d{4}\b/ },
  { what: "a localhost URL with a port", re: /["'`]http:\/\/localhost:\d{4}["'`]/ },
];

const offenders = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  /* Comments stripped, so a usage example in a header is not a finding. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
  for (const { what, re } of BINDING) {
    const hit = code.match(re);
    if (hit) offenders.push(`${file.replace(/\\/g, "/")}: ${what}: ${hit[0]}`);
  }
}

rec(
  "no script binds a port literal",
  offenders.length === 0,
  offenders.length === 0
    ? `${files.length} script(s) clean against ${BINDING.length} binding shapes`
    : offenders.slice(0, 6).join("  |  "),
);

/*
 * AND THE SCAN CAN SEE ONE. A pattern set that matched nothing would pass the
 * check above for ever, which is the vacuous green this repository keeps meeting.
 * Each shape is handed a line it must catch.
 */
/*
 * EVERY FIXTURE IS ASSEMBLED AT RUNTIME, SO THIS FILE CONTAINS NO PORT LITERAL.
 *
 * The first version wrote them out, and the sweep above caught THIS FILE four
 * times, which is correct: the file testing the rule contained the shapes the
 * rule forbids. The alternative was to exempt this path by name, and an
 * exemption is a list somebody grows until the scan checks nothing.
 *
 * The same answer as `the-sweep-refuses-to-write-a-secret.mjs`, which builds key
 * shapes from fragments for exactly this reason. The lines are still the real
 * ones from before this change; only the digits are composed.
 */
const p = (n) => String(3000 + n);
const MUST_CATCH = [
  `  server = await startNextServer({ port: ${p(230)} });`,
  `const PORT = ${p(227)};`,
  `const PORT = Number(process.env.SWEEP_PORT ?? ${p(240)});`,
  `const BASE = process.env.BASE_URL ?? "http://localhost:${p(225)}";`,
];
const caught = MUST_CATCH.filter((line) => BINDING.some(({ re }) => re.test(line)));
rec(
  "and the scan catches every shape it is meant to",
  caught.length === MUST_CATCH.length,
  `${caught.length} of ${MUST_CATCH.length} real lines from before this change are matched`,
);

/* ------------- 3. package.json, the one place that cannot import */

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const devPort = /-p\s+(\d+)/.exec(pkg.scripts?.dev ?? "")?.[1];
const startPort = /-p\s+(\d+)/.exec(pkg.scripts?.start ?? "")?.[1];

rec(
  "package.json's dev and start ports equal the declared audit port",
  devPort === String(PACKAGE_JSON_DEV_PORT) && startPort === String(PACKAGE_JSON_DEV_PORT),
  `dev ${devPort}, start ${startPort}, declared ${PACKAGE_JSON_DEV_PORT}. A package.json script cannot import, so this duplication is turned into a comparison rather than pretended away`,
);

/* --------- 4. the block is clear of the other projects on this machine --- */

/*
 * READ FROM THEIR SOURCE, not from what happens to be listening. A project that
 * is not running right now still owns the ports it declares, and the collision
 * that caused all this was with a server that was up; the one with wattsmith's
 * 3240 was with a port it merely declares.
 *
 * It reports COULD NOT TELL rather than failing when a sibling checkout is not
 * on this machine, because a proof that fails on somebody else's laptop is a
 * proof that gets switched off.
 */
const SIBLINGS = ["C:/Users/salon/projects/wattsmith", "C:/Users/salon/projects/dispatch-scheduling"];
let examined = 0;
const clashes = [];
for (const dir of SIBLINGS) {
  let theirs;
  try {
    theirs = globSync(`${dir}/{package.json,scripts/**/*.mjs}`);
  } catch {
    theirs = [];
  }
  if (theirs.length === 0) continue;
  examined += 1;
  for (const file of theirs) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/\b(4\d{3})\b/g)) {
      const n = Number(m[1]);
      if (n >= PORT_RANGE.from && n < PORT_RANGE.to) {
        clashes.push(`${dir.split("/").pop()} declares ${n}`);
      }
    }
  }
}

if (examined === 0) {
  console.log(
    "COULD NOT TELL  no sibling checkout was readable on this machine, so the block was not compared against another project",
  );
} else {
  rec(
    "and no sibling project declares a port inside this block",
    clashes.length === 0,
    clashes.length === 0
      ? `${examined} sibling checkout(s) read, none declares anything in ${PORT_RANGE.from}-${PORT_RANGE.to - 1}`
      : [...new Set(clashes)].join(", "),
  );
}

/* ------------------------------------------------------------------ verdict */

rec(
  "the audit base URL is built from the declared port",
  AUDIT_BASE_URL === `http://localhost:${PORTS.audit}` && PORTS.audit === PORT_BASE,
  AUDIT_BASE_URL,
);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. One declaration, ${ALL_PORTS.length} ports, no literals, and the block is nobody else's.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
