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
