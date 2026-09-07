/**
 * THE COUNTY MAP STILL RENDERS THE BYTES IT USED TO RENDER.
 *
 *   npx tsx --conditions=react-server scripts/map-markup-audit.mjs
 *
 * WHY THIS EXISTS, AND WHY IT IS LATE
 * -----------------------------------
 * TexasCountyMap.tsx has said since 2026-09-04 that "map-markup-audit asserts
 * the rendered bytes still match". It did not. The name appeared nowhere in the
 * repository except inside that comment, so the byte identity the homepage
 * optimisation promised was unguarded from the day it was claimed.
 *
 * Found on 2026-09-07 while extending the same treatment to the two coverage
 * routes, which is the change this audit was needed for. A comment asserting a
 * guarantee that nothing enforces is the defect class this repository spends
 * its time removing, and it had one of its own.
 *
 * WHAT IT ASSERTS
 * ---------------
 * The map is drawn three ways and each has to keep producing what it produced
 * before:
 *
 *   standalone     no shared geometry, every county the same fill
 *   activeRegion   one region filled differently, which cannot share geometry
 *   define/reuse   the homepage's two maps, geometry emitted once
 *
 * The first two are compared byte for byte against fixtures captured from the
 * LIVE SITE on 2026-09-07, before the change. That is the strongest baseline
 * available: not what the component produces today, but what a browser actually
 * received.
 *
 * WHY A FIXTURE RATHER THAN A HASH
 * --------------------------------
 * A hash tells you something changed. A fixture tells you WHAT changed, which
 * is what somebody staring at a red board at eleven at night needs. The files
 * are 60KB each and diff cleanly.
 */

import { readFileSync, existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TexasCountyMap } from "../src/components/map/TexasCountyMap.tsx";

const FIXTURES = "scripts/fixtures";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("=========== THE MAP RENDERS THE BYTES IT USED TO ===========");
console.log("");

/** The county group: the <g> carrying the hairline stroke and the 254 paths. */
function countyGroup(html) {
  const open =
    /<g stroke="[^"]+" stroke-width="0\.5" stroke-linejoin="round" vector-effect="non-scaling-stroke">/g;
  const m = open.exec(html);
  if (!m) return null;
  const start = m.index;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const nextOpen = html.indexOf("<g", i);
    const nextClose = html.indexOf("</g>", i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 2;
    } else {
      depth -= 1;
      i = nextClose + 4;
      if (depth === 0) return html.slice(start, i);
    }
  }
  return null;
}

function render(props) {
  return renderToStaticMarkup(createElement(TexasCountyMap, props));
}

/* ------------------------------------------------------- the two fixtures */

const CASES = [
  {
    name: "standalone, light",
    props: {},
    fixture: `${FIXTURES}/county-map-standalone-light.txt`,
    from: "the live /coverage on 2026-09-07",
  },
  {
    name: "activeRegion coastal-bend, light",
    props: { activeRegion: "coastal-bend" },
    fixture: `${FIXTURES}/county-map-coastal-bend-light.txt`,
    from: "the live /coverage/coastal-bend on 2026-09-07",
  },
];

let compared = 0;

for (const c of CASES) {
  if (!existsSync(c.fixture)) {
    rec(`${c.name}: the fixture exists`, false, `${c.fixture} is missing, so nothing can be compared`);
    continue;
  }
  const expected = readFileSync(c.fixture, "utf8");
  const actual = countyGroup(render(c.props));

  if (!actual) {
    rec(`${c.name}: the county group was found in the render`, false, "the group could not be located at all");
    continue;
  }

  compared += 1;

  const same = actual === expected;
  let where = "";
  if (!same) {
    let i = 0;
    while (i < Math.min(actual.length, expected.length) && actual[i] === expected[i]) i += 1;
    where = `first difference at byte ${i}: expected ${JSON.stringify(
      expected.slice(i, i + 60),
    )}, got ${JSON.stringify(actual.slice(i, i + 60))}`;
  }

  rec(
    `${c.name}: byte identical to ${c.from}`,
    same,
    same ? `${actual.length} bytes, ${(actual.match(/<path /g) || []).length} paths` : where,
  );
}

rec(
  `both rendered shapes were compared (${compared} of ${CASES.length})`,
  compared === CASES.length,
  "a comparison that silently skipped is a comparison that proves nothing",
);

/* ------------------------------------------- the shared pair still shares */

/*
 * The homepage's two maps. Not fixture compared, because the change of
 * 2026-09-07 did not touch that branch; what matters is the PROPERTY it was
 * built for, which is that the geometry appears once and the second instance
 * only references it.
 */
{
  const define = render({ shared: "define" });
  const reuse = render({ shared: "reuse" });

  const probe = (countyGroup(define) ?? "").match(/ d="([^"]{80,})"/)?.[1]?.slice(10, 60) ?? "";
  rec("a geometry probe could be taken from the define instance", probe.length > 0);

  rec(
    "the define instance carries the geometry once",
    probe ? define.split(probe).length - 1 === 1 : false,
    probe ? `${define.split(probe).length - 1} occurrence(s)` : "",
  );
  rec(
    "and the reuse instance carries none of it",
    probe ? reuse.split(probe).length - 1 === 0 : false,
    probe ? `${reuse.split(probe).length - 1} occurrence(s), it should only hold a use element` : "",
  );
  rec("the reuse instance references the shared id", reuse.includes("tx-county-shapes"));
}

/* ------------------------------------------------ the counties are all there */

/*
 * A count, because every check above compares strings and a string comparison
 * against a fixture that was itself wrong would agree with it forever. 254 is
 * the number in the firm's coverage claim.
 */
{
  const standalone = countyGroup(render({})) ?? "";
  const n = (standalone.match(/<path /g) || []).length;
  rec("the standalone map draws 254 counties", n === 254, `${n} paths`);
}

// ------------------------------------------------------------------- verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("The map's rendered markup changed. If that was intended, the fixtures in");
  console.log("scripts/fixtures are updated deliberately, in the same commit, with the reason.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. The map renders the bytes it rendered before.`);
