/**
 * NO WORKFLOW HERE CAN BE STARTED BY A FORK WITH OUR SECRETS. Operator ruling,
 * 2026-10-22: the cloud board's workflows trigger on a push to a branch of this
 * repository and on workflow_dispatch, and nothing else. No pull_request_target,
 * and nothing a fork's pull request can run with access to secrets.
 *
 *   node scripts/ci/workflow-triggers.mjs [workflows dir]
 *
 * An ALLOWLIST of triggers rather than a list of dangerous ones, because the
 * dangerous set is GitHub's to grow: pull_request_target, pull_request,
 * workflow_run (which runs with secrets after a fork's workflow finishes),
 * issue_comment, workflow_call and whatever comes next. A trigger not named
 * here fails by name. pull_request_target is ALSO refused anywhere in a file,
 * comments aside, so it cannot arrive inside a reusable reference.
 *
 * What it cannot do, said plainly: a pull request that edits this file and the
 * workflow together could remove the check. The repository setting is what
 * stops a fork's run before anybody reads it: "Fork pull request workflows"
 * requires approval for all outside contributors, set 2026-10-22.
 *
 * Exits 1 with the file and trigger named, or when it finds no workflow at all,
 * because a check of an empty directory is a check of nothing.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["push", "workflow_dispatch"]);
const dir = process.argv[2] ?? ".github/workflows";

const stripComments = (text) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|\s)#.*$/, "$1"))
    .join("\n");

/** The trigger names under a workflow's top level `on:` key, in all three YAML spellings. */
function triggersOf(text) {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^(on|"on"|'on'|true)\s*:/.test(l));
  if (at === -1) return null;
  const inline = lines[at].replace(/^[^:]*:\s*/, "").trim();
  if (inline) {
    return inline.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  const names = [];
  let indent = null;
  for (const line of lines.slice(at + 1)) {
    if (!line.trim()) continue;
    const lead = line.match(/^\s*/)[0].length;
    if (lead === 0) break;
    if (indent === null) indent = lead;
    if (lead === indent) {
      const m = line.trim().match(/^-?\s*["']?([A-Za-z_]+)["']?\s*:?/);
      if (m) names.push(m[1]);
    }
  }
  return names;
}

const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)) : [];
const problems = [];
if (files.length === 0) problems.push(`no workflow file under ${dir}, so there was nothing to check`);
for (const f of files) {
  const text = stripComments(readFileSync(join(dir, f), "utf8"));
  if (/pull_request_target/.test(text)) problems.push(`${f} names pull_request_target`);
  const triggers = triggersOf(text);
  if (triggers === null) problems.push(`${f} has no top level on: key that this check can read`);
  else {
    if (triggers.length === 0) problems.push(`${f} declares on: with no trigger this check can read`);
    for (const t of triggers) if (!ALLOWED.has(t)) problems.push(`${f} triggers on ${t}; only push and workflow_dispatch are allowed`);
  }
}

if (problems.length) {
  console.log("REFUSED: a workflow could run for somebody outside this repository.");
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`${files.length} workflow file(s): every trigger is push or workflow_dispatch, and none names pull_request_target.`);
