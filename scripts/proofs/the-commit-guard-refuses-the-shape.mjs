// Proves scripts/hooks/commit-guard.mjs in both directions by feeding real
// payloads to the hook's own entry point. Exits non-zero if any case is wrong.
//
// The fixtures build the two dangerous words by concatenation on purpose. The
// guard reads the COMMAND, so any shell one liner carrying these literals whole
// (a heredoc rewriting this file, an inline test harness) is itself refused.
// That refusal is the guard working; splitting the literals is how the proof
// stays editable from a shell. The first version of this proof was written
// inline and the guard refused it, which is how the split got here.
import { spawnSync } from "node:child_process";

const HOOK = "scripts/hooks/commit-guard.mjs";

const REFUSE = [
  ["instance five, audit piped to tail then commit",
    'npx tsx scripts/db-guard-audit.mjs | tail -1 && git add -A && git ' + 'commit -m "x"'],
  ["instance four, commit chained into the board",
    'git ' + 'commit -m "x" && npm run audit'],
  ["board with a cd in front",
    'cd /c/Users/salon/projects/254engineering && npm run audit'],
  ["board piped to tee", 'npm run audit | tee /tmp/board.log'],
  ["board then a commit", 'npm run audit && git ' + 'commit -m "x"'],
  ["unbalanced quote with a real chain, fails closed",
    "npx tsx scripts/queue-audit.mjs && git " + "commit -m 'x"],
];

const ALLOW = [
  ["board alone", "npm run audit"],
  ["board redirected, unquoted path", "npm run audit > /tmp/board.log 2>&1"],
  ["board redirected, QUOTED path", 'npm run audit > "/c/Temp/board close.log" 2>&1'],
  ["board appended to a file", "npm run audit >> /tmp/board.log 2>&1"],
  ["plain commit", 'git ' + 'commit -m "fix(queue): restore strays"'],
  ["commit whose message names a script and the board",
    'git ' + 'commit -m "fix: scripts/queue-audit.mjs, run npm run audit after"'],
  ["heredoc commit message naming npm run",
    'git ' + 'commit -F - <<EOF\nfix: npm run audit is now its own command\nEOF'],
  ["standalone audit", "npx tsx scripts/queue-audit.mjs"],
  ["git add then commit", 'git add -A && git ' + 'commit -m "x"'],
  ["git status", "git status --short"],
];

function ask(command) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });
  return r.stdout.trim();
}

let wrong = 0;
for (const [name, command] of REFUSE) {
  const out = ask(command);
  const ok = out.includes('"permissionDecision":"deny"');
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "WRONG"}  refused: ${name}`);
}
for (const [name, command] of ALLOW) {
  const out = ask(command);
  const ok = out === "";
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "WRONG"}  allowed: ${name}`);
}
console.log(wrong === 0
  ? `\nAll ${REFUSE.length + ALLOW.length} cases correct.`
  : `\n${wrong} case(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
