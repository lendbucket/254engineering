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
 *
 * ONE NAMED EXCEPTION, AND IT IS A FILE RATHER THAN A TRIGGER. Robert's
 * addendum of 2026-10-25, 22:46 Central, item 11: the nightly backup runs on a
 * schedule, "an exception to his push-or-dispatch rule, because a backup must
 * run on its own". So `schedule` is allowed in backup.yml and in no other file:
 * the allowlist above is not widened, and a schedule anywhere else still fails
 * by name. A schedule cannot be started by a fork (GitHub runs it from the
 * default branch with this repository's secrets), which is why it does not
 * reopen what this check guards. The exception must name a file that exists,
 * and the output says it was applied, so it cannot outlive the file or hide.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["push", "workflow_dispatch"]);
const SCHEDULE_BY_RULING = new Map([["backup.yml", "Robert's addendum of 2026-10-25, item 11: the nightly backup"]]);
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
const applied = [];
if (files.length === 0) problems.push(`no workflow file under ${dir}, so there was nothing to check`);
for (const f of files) {
  const text = stripComments(readFileSync(join(dir, f), "utf8"));
  if (/pull_request_target/.test(text)) problems.push(`${f} names pull_request_target`);
  const triggers = triggersOf(text);
  if (triggers === null) problems.push(`${f} has no top level on: key that this check can read`);
  else {
    if (triggers.length === 0) problems.push(`${f} declares on: with no trigger this check can read`);
    for (const t of triggers) {
      if (ALLOWED.has(t)) continue;
      if (t === "schedule" && SCHEDULE_BY_RULING.has(f)) {
        applied.push(`${f} runs on a schedule by ruling (${SCHEDULE_BY_RULING.get(f)})`);
        continue;
      }
      problems.push(`${f} triggers on ${t}; only push and workflow_dispatch are allowed`);
    }
  }
}
for (const f of SCHEDULE_BY_RULING.keys()) {
  if (!files.includes(f)) problems.push(`the schedule exception names ${f}, which is not a workflow under ${dir}`);
}

if (problems.length) {
  console.log("REFUSED: a workflow could run for somebody outside this repository.");
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(
  `${files.length} workflow file(s): every trigger is push or workflow_dispatch${applied.length ? `, apart from ${applied.length} exception(s) by ruling` : ""}, and none names pull_request_target.`,
);
for (const a of applied) console.log(`  exception: ${a}`);
