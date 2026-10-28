/**
 * THE PROCEDURES ARE THE WORKFLOW MAP, AND EACH ROLE READS ITS OWN.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-procedures-are-the-workflow-map.mjs
 *
 * W4 of Robert's instruction of 2026-10-26: "Each role gets a Procedures page
 * that renders its workflows from docs/workflows.md as numbered written
 * procedures (254-OPS-001 onward), so a new hire is trained from the screen."
 *
 * Three properties, each one a way the page could tell a new hire something
 * false:
 *   1. The text is the map's. src/content/procedures.ts must equal a fresh parse
 *      of docs/workflows.md, so an edit nobody re-emitted is red here.
 *   2. Every screen a step links to exists on disk. A link to a screen that is
 *      not there sends somebody to a 404 halfway through a procedure.
 *   3. A role sees exactly the sections written for it. Which sections those
 *      are is pinned below as a literal, not imported, so widening a role is a
 *      second, deliberate edit here.
 */
import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { parseProcedures } from "../lib/workflow-procedures.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const doc = readFileSync("docs/workflows.md", "utf8");
const parsed = parseProcedures(doc);
const { PROCEDURES } = await import("../../src/content/procedures.ts");
const { SECTIONS_FOR_ROLE, proceduresFor } = await import("../../src/lib/procedures.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");

/* 1. One home: the module is the map, parsed again now. */
console.log("1. The procedures are the map");
check(
  "src/content/procedures.ts equals a fresh parse of docs/workflows.md",
  isDeepStrictEqual(JSON.parse(JSON.stringify(PROCEDURES)), parsed),
  "run node scripts/emit-procedures.mjs and commit it",
);
const headings = doc.split("\n").filter((l) => /^### 254-WF-\d{3} /.test(l));
check("every workflow in the map is exactly one procedure", parsed.length === headings.length && headings.length > 0, `${parsed.length} procedures, ${headings.length} workflows`);
check(
  "each procedure's number is its workflow's own number",
  parsed.every((p) => p.number === p.workflow.replace("254-WF-", "254-OPS-")),
);
check("no procedure number is used twice", new Set(parsed.map((p) => p.number)).size === parsed.length);
check("every procedure has at least one step", parsed.every((p) => p.steps.length > 0), parsed.filter((p) => p.steps.length === 0).map((p) => p.number).join(", "));
const stepRows = doc.split("\n").filter((l) => /^\| \d+ \|/.test(l)).length;
check("every step row in the map is a step of some procedure", parsed.reduce((n, p) => n + p.steps.length, 0) === stepRows, `${stepRows} rows`);

/* 2. Every linked screen is a page on disk. */
console.log("2. Every linked screen exists");
const routes = [...new Set(parsed.flatMap((p) => p.steps.flatMap((s) => s.routes)))];
check("the map links some portal screens", routes.length > 10, String(routes.length));
const missing = routes.filter((r) => !existsSync(`src/app/portal/(app)${r.slice("/portal".length)}/page.tsx`));
check("every route a step links to has a page.tsx", missing.length === 0, missing.join(", ") || `${routes.length} routes`);
const unlinked = parsed.flatMap((p) =>
  p.steps
    .filter((s) => (s.screen.match(/`src\/app\/portal\/\(app\)[^`]*`/g) ?? []).filter((m) => !m.includes("[")).length !== s.routes.length)
    .map((s) => `${p.number} step ${s.n}`),
);
check("every portal screen named in a Screen cell, other than a dynamic one, becomes a link", unlinked.length === 0, unlinked.join(", "));

/* 3. A role sees exactly its own. The sections are pinned here, not imported. */
console.log("3. Each role reads its own procedures");
const PINNED = {
  admin: ["Customer", "Rep", "Ops manager", "Admin and owner", "Field technician", "Engineer", "Partner"],
  ops_manager: ["Rep", "Ops manager"],
  rep: ["Rep"],
  sales: ["Rep"],
  customer_service: ["Rep"],
  dispatcher: ["Rep"],
  field_tech: ["Field technician"],
  engineer: ["Engineer"],
  read_only: [],
};
check("the role table is the one ruled", isDeepStrictEqual({ ...SECTIONS_FOR_ROLE }, PINNED), JSON.stringify(SECTIONS_FOR_ROLE));
check(
  "every role DEFAULT_ROLES declares has a row, and no other role does",
  isDeepStrictEqual(Object.keys(SECTIONS_FOR_ROLE).sort(), DEFAULT_ROLES.map((r) => r.key).sort()),
);
const docSections = [...new Set(parsed.map((p) => p.section))];
check("the administrator reads every section of the map", isDeepStrictEqual([...PINNED.admin].sort(), [...docSections].sort()), docSections.join(", "));
for (const [role, sections] of Object.entries(PINNED)) {
  const expected = parsed.filter((p) => sections.includes(p.section)).map((p) => p.number);
  const got = proceduresFor(role).map((p) => p.number);
  check(`${role} reads exactly ${expected.length} procedures, its own sections'`, isDeepStrictEqual(got, expected), got.join(" "));
}
check("a role nobody named reads nothing", proceduresFor("not_a_role").length === 0);

/* The page and its link ask one question, and the page types no procedure. */
console.log("4. The page");
const page = readFileSync("src/app/portal/(app)/procedures/page.tsx", "utf8");
const nav = readFileSync("src/components/portal/nav.ts", "utf8");
check("the page is guarded on tasks.use", /can\(actor, "tasks\.use"\)/.test(page));
check("its nav item asks the same action", /href: "\/portal\/procedures",[^}]*action: "tasks\.use"/.test(nav));
check("the page reads the procedures for the actor's own role", page.includes("proceduresFor(actor.role)"));
check("the page types no procedure of its own", !/254-(WF|OPS)-\d{3}/.test(page));
check("a step's mark is rendered", page.includes("step.marks"));
check("a step with nothing next says so rather than going blank", page.includes("The map records nothing further at this step."));

console.log(wrong === 0 ? "\nPASS: the procedures are the workflow map, and each role reads its own." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
