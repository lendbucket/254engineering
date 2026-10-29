/**
 * THE WORKFLOW MAP, READ AS DATA. docs/workflows.md is the W1 map of every
 * workflow (254-WF-001 to 254-WF-036); this reads its step tables so the W2
 * walk drives exactly the steps the map names and no others. It parses the
 * document rather than restating it, because a second list of steps would be a
 * second account of the map, and the two would disagree the first time a step
 * is added.
 *
 * A step row is a table row whose first cell is a number, under a heading
 * `### 254-WF-NNN title`. Cells are split on ` | ` outside backticks.
 */

import { readFileSync } from "node:fs";

export const MAP_PATH = "docs/workflows.md";

/** Split one markdown table row into cells, ignoring pipes inside backticks. */
export function cellsOf(line) {
  const cells = [];
  let cur = "";
  let tick = false;
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (const ch of body) {
    if (ch === "`") tick = !tick;
    if (ch === "|" && !tick) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Every `src/app/...` directory a Screen cell names, as the URL path it serves.
 * Route groups `(x)` drop out; a dynamic `[segment]` is kept so the walk knows
 * it has to reach the page from a record rather than by typing the address.
 */
export function routesOf(screenCell) {
  const out = [];
  for (const m of screenCell.matchAll(/`src\/app\/([^`]+)`/g)) {
    const segs = m[1]
      .split("/")
      .filter((s) => s && !/^\(.*\)$/.test(s) && !/\.(tsx?|jsx?)$/.test(s));
    const path = "/" + segs.join("/");
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

/** The map's own marks on a step. */
export function marksOf(marksCell) {
  return {
    needsCode: marksCell.includes("[NEEDS SQL, A SCRIPT OR A CODE EDIT]"),
    noScreen: marksCell.includes("[NO SCREEN]"),
  };
}

export function readWorkflowMap(root = process.cwd()) {
  const text = readFileSync(`${root}/${MAP_PATH}`, "utf8");
  const workflows = [];
  let current = null;
  let section = null;
  for (const line of text.split("\n")) {
    const sec = /^## (.+)$/.exec(line);
    if (sec) {
      section = sec[1].trim();
      current = null;
      continue;
    }
    const head = /^### (254-WF-\d{3}) (.+)$/.exec(line);
    if (head) {
      current = { id: head[1], title: head[2].trim(), section, steps: [] };
      workflows.push(current);
      continue;
    }
    if (!current || !/^\| *\d+ *\|/.test(line)) continue;
    const c = cellsOf(line);
    /* # | Screen | Who | Sees | Does | What happens next | Who is told | Record written | Marks | W2 result */
    if (c.length < 10) {
      current.steps.push({ n: Number(c[0]), malformed: `${c.length} cells where 10 are expected` });
      continue;
    }
    current.steps.push({
      n: Number(c[0]),
      screen: c[1],
      who: c[2],
      sees: c[3],
      does: c[4],
      next: c[5],
      marks: marksOf(c[8]),
      routes: routesOf(c[1]),
      w2: c[9],
    });
  }
  return workflows;
}

/**
 * THE MAP AGAINST WHAT IT SAYS ABOUT ITSELF: the four static checks the W2 walk
 * runs before it walks anything, as one function the walk and the preflight
 * both call, so they cannot disagree about the rule. The PINS are not here: the
 * walk types them as literals (an audit never imports its expectation from the
 * thing it audits), and the preflight reads them from the walk's source with
 * mapPinsFrom, so there is one copy of each number.
 *
 * Board 40833339969 missed on the fourth: the map had 12 steps marked with no
 * screen and the walk's pin still said 13, a check that needs only the files.
 */
export function mapChecks(workflows, pins) {
  const steps = workflows.flatMap((w) => w.steps.map((s) => ({ ...s, wf: w.id })));
  const ids = workflows.map((w) => w.id);
  const expectedIds = Array.from({ length: pins.workflows }, (_, i) => `254-WF-${String(i + 1).padStart(3, "0")}`);
  const malformed = steps.filter((s) => s.malformed);
  const needsCode = steps.filter((s) => s.marks?.needsCode).length;
  const noScreen = steps.filter((s) => s.marks?.noScreen).length;
  return [
    {
      name: `the map names 254-WF-001 to 254-WF-${String(pins.workflows).padStart(3, "0")}, once each and in order`,
      ok: ids.join(",") === expectedIds.join(","),
      note: `${ids.length} workflow(s) parsed`,
    },
    {
      name: "every step row has the map's ten columns",
      ok: malformed.length === 0,
      note: malformed.map((s) => `${s.wf} step ${s.n}: ${s.malformed}`).join("; "),
    },
    {
      name: `the map holds at least ${pins.stepsAtLeast} steps`,
      ok: steps.length >= pins.stepsAtLeast,
      note: `${steps.length} parsed; a parser that matched nothing would walk nothing and pass`,
    },
    {
      name: "the marks parsed are the marks the map counts",
      ok: needsCode === pins.needsCode && noScreen === pins.noScreen,
      note: `${needsCode} needing SQL, a script or a code edit (the map says ${pins.needsCode}); ${noScreen} with no screen (the map says ${pins.noScreen})`,
    },
  ];
}

/**
 * The walk's four pins, read from its source text, never retyped. Refuses
 * (returns null) unless all four are found exactly once, so a renamed pin is a
 * failure rather than a silent default.
 */
export function mapPinsFrom(walkSource) {
  const one = (name) => {
    const found = [...walkSource.matchAll(new RegExp(`^const ${name} = (\\d+);$`, "gm"))];
    return found.length === 1 ? Number(found[0][1]) : null;
  };
  const pins = {
    workflows: one("MAP_WORKFLOWS"),
    stepsAtLeast: one("MAP_STEPS_AT_LEAST"),
    needsCode: one("MAP_NEEDS_CODE"),
    noScreen: one("MAP_NO_SCREEN"),
  };
  return Object.values(pins).every((v) => Number.isInteger(v)) ? pins : null;
}
