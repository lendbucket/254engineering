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

/*
 * RULE THREE, EXERCISED AGAINST INJECTED GIT STATE. Added 2026-09-18.
 *
 * The state is handed in rather than created, because making a repository that
 * is on main with a staged migration, from inside a proof, would mean staging a
 * migration on main, which is the thing being refused.
 *
 * AND BECAUSE A RULE TESTED ONLY WITH ITS INPUT HANDED TO IT SAYS NOTHING ABOUT
 * THE READ THAT FEEDS IT, the last case runs the real reader against this
 * repository and asserts it returns a branch and a list. That is the half the
 * comms-audit incident was about: every assertion was right and the read that
 * supplied them had never once succeeded.
 */
const GIT_CASES = [
  ["a migration staged on main", { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql", "src/a.ts"] }, true],
  ["the same migration on a branch", { branch: "feat/x", stagedFiles: ["supabase/migrations/0052_x.sql"] }, false],
  ["no migration, on main", { branch: "main", stagedFiles: ["src/a.ts", "docs/b.md"] }, false],
  ["a migration on main, but detached HEAD", { branch: "", stagedFiles: ["supabase/migrations/0052_x.sql"] }, false],
  ["no git state at all", null, false],
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
/*
 * RULES FOUR AND FIVE, AGAINST THE COMMANDS THAT ACTUALLY DID IT.
 *
 * Every refusal case below is a real command from 2026-09-19 and 2026-09-20,
 * not a shape invented to match the rule. The allow cases are the ones that
 * must keep working, and they are the reason the rules test the redirect TARGET
 * and the heredoc BODY rather than the whole command: a Windows path in a
 * redirect is full of backslashes and is not content.
 *
 * The dangerous strings are built by concatenation for the same reason the file
 * header gives: this proof is itself a shell payload, and a guard that refuses
 * its own proof is a guard nobody can test.
 */
const WRITE_CASES = [
  ["the twenty backspaces: a heredoc carrying word boundaries",
    'cat > ' + 'scratchpad/split.mjs <<' + "'SCRIPT'\nconst p = /" + '\\b' + "order/;\nSCRIPT",
    true],
  ["a heredoc into the scratchpad, which a tracked-files rule would have missed",
    'cat > ' + '/tmp/fill5.mjs <<' + "'S'\ns.split(\"" + '\\n' + "\");\nS",
    true],
  ["an in place perl edit of a source file",
    "perl -0pi -e " + "'s/x/y/' " + "src/lib/regulatory.mjs",
    true],
  ["a redirect straight into a source file",
    "echo 'x' > " + "src/config/turnaround.ts",
    true],
  ["an inline node script carrying an interpolation",
    'node -e ' + '"const s = `${CL}`; writeFileSync(p, s)"',
    true],

  ["the board redirected to a log, which carries no content",
    "npm run audit > /tmp/board.log 2>&1",
    false],
  ["a board log on a Windows path, whose backslashes are a PATH and not content",
    'npm run audit > "C:' + '\\Users' + '\\salon' + '\\board.log" 2>&1',
    false],
  ["a grep with an escape, which reads rather than writes",
    'grep -rn "' + '\\b' + 'firmName" src/',
    false],
  ["a commit message heredoc, which writes no file",
    'git ' + 'commit -F - <<EOF\nfix: a message\nEOF',
    false],
  ["a plain heredoc with no escapes, into the scratchpad",
    "cat > /tmp/notes.txt <<'EOF'\nplain words\nEOF",
    false],
  ["reading a source file",
    "sed -n '1,40p' src/lib/launch.ts",
    false],

  /*
   * THE FALSE POSITIVE THE RULE ITSELF PRODUCED, kept as a fixture because it
   * is the exact shape rule one already had to solve and rule four repeated.
   *
   * The commit introducing these rules DESCRIBED them, so its message carried
   * the words sed, perl, ruby, a -0pi, and the extension list. Rule four read a
   * commit MESSAGE as a command that edits source and refused the commit.
   * Rule four now tests the stripped command, exactly as rule one does.
   */
  ["a commit whose message describes this very rule",
    'git ' + 'commit -F - <<EOF\nfeat(guard): refuse sed/perl/ruby -0pi writing .ts .mjs .sql files\nEOF',
    false],
];

/* Rules four and five, through the hook's own entry point. */
for (const [name, command, shouldRefuse] of WRITE_CASES) {
  const out = ask(command);
  const refused = out.includes('"permissionDecision":"deny"');
  const ok = refused === shouldRefuse;
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "WRONG"}  ${shouldRefuse ? "refused" : "allowed"}: ${name}`);
}

/* Rule three, against injected state. */
const { migrationOnMainVerdict, readGitStateForProof } = await import("../hooks/commit-guard.mjs");
const commitCommand = "git " + "commit -m 'x'";
for (const [name, state, shouldRefuse] of GIT_CASES) {
  const refused = migrationOnMainVerdict(commitCommand, state) !== null;
  const ok = refused === shouldRefuse;
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "WRONG"}  ${shouldRefuse ? "refused" : "allowed"}: ${name}`);
}

/*
 * And the READ, against this repository, because the rule above proves the
 * function and says nothing about whether anything can supply its input.
 */
{
  const state = readGitStateForProof();
  const ok = Boolean(state) && typeof state.branch === "string" && Array.isArray(state.stagedFiles);
  if (!ok) wrong += 1;
  console.log(
    `${ok ? "PASS" : "WRONG"}  the git state can actually be read here` +
      (state ? ` (branch "${state.branch}", ${state.stagedFiles.length} staged)` : " (returned null)"),
  );
}

console.log(wrong === 0
  ? `\nAll ${REFUSE.length + ALLOW.length + WRITE_CASES.length + GIT_CASES.length + 1} cases correct.`
  : `\n${wrong} case(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
