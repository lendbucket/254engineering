/**
 * docs/workflows.md, READ AS PROCEDURES. W4 of Robert's instruction of
 * 2026-10-26: "Each role gets a Procedures page that renders its workflows from
 * docs/workflows.md as numbered written procedures (254-OPS-001 onward)."
 *
 * The workflow map is the ONE home of the procedure text. This parser is the
 * only thing that reads it: scripts/emit-procedures.mjs writes its answer into
 * src/content/procedures.ts, and the proof parses the document again and
 * requires the module to equal it, so an edit to the map that nobody re-emitted
 * is a red board rather than a page that quietly says the old thing. The same
 * shape as emit-guide-dates and guide-dates-audit.
 *
 * WHAT IT READS. Every heading `### 254-WF-NNN Title` is one procedure, under
 * the role section (`## Rep`, `## Engineer` ...) it sits in. Its table rows are
 * its steps, and any plain paragraph between the table and the next heading or
 * rule is a note. Nothing else in the document is a procedure: the sections
 * about the marks, the counts and where the map sits are left alone.
 *
 * THE NUMBER IS THE WORKFLOW'S OWN. 254-WF-014 is 254-OPS-014, always. A number
 * taken from position in the list would renumber every procedure after an
 * insertion, and a new hire told "follow OPS-012" last week would be pointed at
 * a different job this week.
 */

/** The columns of every step table, in order, as the document writes them. */
export const STEP_COLUMNS = [
  "#", "Screen", "Who", "Sees", "Does", "What happens next", "Who is told", "Record written", "Marks", "W2 result",
];

const HEADING = /^### (254-WF-(\d{3})) (.+)$/;
const SECTION = /^## (.+)$/;

/** A portal screen named in a Screen cell, as the route a person opens. */
export function portalRoutesIn(cell) {
  const routes = [];
  for (const m of cell.matchAll(/`src\/app\/portal\/\(app\)((?:\/[a-z0-9-]+)*)`/g)) {
    routes.push(`/portal${m[1]}`);
  }
  return routes;
}

function cellsOf(line) {
  const parts = line.split("|").map((c) => c.trim());
  return parts.slice(1, parts.length - 1);
}

export function parseProcedures(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const procedures = [];
  let section = null;
  let current = null;
  let inTable = false;
  for (const line of lines) {
    const sectionMatch = SECTION.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      current = null;
      inTable = false;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      current = {
        workflow: heading[1],
        number: `254-OPS-${heading[2]}`,
        title: heading[3].trim(),
        section,
        steps: [],
        notes: [],
      };
      procedures.push(current);
      inTable = false;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("#") || line.trim() === "---") {
      current = null;
      inTable = false;
      continue;
    }
    if (line.startsWith("|")) {
      const cells = cellsOf(line);
      if (cells[0] === "#") {
        if (cells.join("|") !== STEP_COLUMNS.join("|")) {
          throw new Error(`${current.workflow}: the step table's columns are not the ones the procedures read`);
        }
        inTable = true;
        continue;
      }
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!inTable) throw new Error(`${current.workflow}: a table row before the step table's header`);
      if (cells.length !== STEP_COLUMNS.length) {
        throw new Error(`${current.workflow}: a step row with ${cells.length} cells, not ${STEP_COLUMNS.length}`);
      }
      const [n, screen, who, sees, does, next, told, record, marks] = cells;
      current.steps.push({ n, screen, routes: portalRoutesIn(screen), who, sees, does, next, told, record, marks });
      continue;
    }
    inTable = false;
    if (line.trim() !== "") current.notes.push(line.trim());
  }
  return procedures;
}
