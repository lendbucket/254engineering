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
  /*
   * The sitting merge, Robert's answer 2 of 22:11 Central 2026-10-26: allowed
   * only when the STAGED ledger records every staged migration as applied to
   * production. Each way that can fall short is a refusal of its own.
   */
  ["a sitting merge: the staged ledger records the migration on production",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql", "supabase/applied.mjs"],
      ledger: { "0052_x.sql": { production: "2026-10-27", appliedBy: "apply_migration" } } }, false],
  ["the staged ledger names it with no production date",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql"],
      ledger: { "0052_x.sql": { production: null, appliedBy: "apply_migration" } } }, true],
  ["the staged ledger has no entry for it",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql"],
      ledger: { "0051_y.sql": { production: "2026-10-27", appliedBy: "apply_migration" } } }, true],
  ["one of two staged migrations is recorded and the other is pending",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql", "supabase/migrations/0053_z.sql"],
      ledger: { "0052_x.sql": { production: "2026-10-27", appliedBy: "apply_migration" },
        "0053_z.sql": { production: null, appliedBy: "apply_migration" } } }, true],
  ["a production date with no appliedBy",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql"],
      ledger: { "0052_x.sql": { production: "2026-10-27" } } }, true],
  ["a production value that is not a date",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql"],
      ledger: { "0052_x.sql": { production: "yes", appliedBy: "apply_migration" } } }, true],
  ["the staged ledger could not be read",
    { branch: "main", stagedFiles: ["supabase/migrations/0052_x.sql"], ledger: null }, true],
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

  /*
   * QUOTING THE PATH DEFEATED RULE FOUR ENTIRELY UNTIL 2026-10-03, and these
   * three are the real commands that proved it, kept here so it cannot return.
   *
   * The first is the one that actually got through, typed while porting the
   * review screen to V10. The flag was never the problem: `-i.bak` matches the
   * cluster pattern. The TARGET was gone before anything looked for it, because
   * the matcher ran against the command with quoted strings replaced by a
   * placeholder, and the path is a quoted string.
   *
   * The second and third show it was not peculiar to one flag or one tool: a
   * plain `sed -i` and a bare `echo >` escaped the same way the moment the path
   * had quotes round it.
   *
   * WHY IT MATTERED MORE THAN A CURIOSITY, and it is the reason this is three
   * fixtures rather than one. Every portal screen lives under
   * `src/app/portal/(app)/`, and a path with parentheses is one a person quotes
   * by reflex. The rule was blind on exactly the directory most of this
   * project's source edits land in, for as long as it had existed.
   */
  ["the one that got through: an in place sed with a QUOTED path containing parentheses",
    "sed -i.bak " + "'s|a|b|' " + '"src/app/portal/(app)/review/page.tsx"',
    true],
  ["a plain -i with a quoted path, which escaped the same way",
    "sed -i " + "'s|a|b|' " + '"src/lib/launch.ts"',
    true],
  ["a redirect into a quoted source path",
    'echo hi > "src/lib/launch.ts"',
    true],

  /*
   * THE SECOND HOLE, FOUND HOURS AFTER THE FIRST AND THE SAME WAY. The flag
   * cluster was terminated with `\b`, and `_` is a word character, so `-i_x`
   * had no boundary after the `i` and the whole rule never engaged. The path
   * here is UNQUOTED, so the morning's quoting fix was not what was missing.
   *
   * `-i.bak` passed only because `.` is not a word character. A word boundary
   * is simply the wrong terminator for a shell flag cluster, and these three
   * are the suffixes sed accepts that a `\b` version gets wrong.
   */
  ["an in place sed whose backup suffix starts with an underscore",
    "sed -i_x " + "'s/a/b/' " + "BACKLOG.md",
    true],
  ["the same with a tilde suffix, which sed also accepts",
    "sed -i~ " + "'s/a/b/' " + "src/lib/launch.ts",
    true],
  ["and a bare -i immediately before the script, which must still be caught",
    "sed -i " + "'s/a/b/' " + "src/config/prices.ts",
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

/*
 * And the STAGED LEDGER READ, for the same reason: the sitting-merge cases
 * above hand the rule its ledger, and this is the read that supplies it.
 * 0091 is pinned because it is on production (2026-10-27, comment 6432012426).
 */
{
  const { readStagedLedger } = await import("../hooks/commit-guard.mjs");
  const ledger = await readStagedLedger();
  const entry = ledger?.["0091_three_letters_seal_without_a_template.sql"];
  const ok =
    Boolean(ledger) && Object.keys(ledger).length >= 90 &&
    entry?.production === "2026-10-27" && entry?.appliedBy === "apply_migration";
  if (!ok) wrong += 1;
  console.log(
    `${ok ? "PASS" : "WRONG"}  the staged ledger can actually be read here` +
      (ledger ? ` (${Object.keys(ledger).length} entries, 0091 production ${entry?.production})` : " (returned null)"),
  );
}

/*
 * And end to end, through the hook's own entry point, in a throwaway repository
 * on main: the rule reads the ledger AS STAGED, never the working tree. A
 * production date typed into the working copy and not staged must not open the
 * door, and a staged record must open it whatever the working copy says.
 */
{
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "commit-guard-sitting-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  const ledgerWith = (production) =>
    `export const APPLIED = [\n  { file: "0052_x.sql", appliedBy: "apply_migration", production: ${production} },\n];\n`;
  /*
   * THE HOOK IS NAMED BY AN ABSOLUTE PATH HERE, AND THAT IS THE LESSON OF ITS
   * FIRST RUN. HOOK is relative, and with cwd set to the throwaway repository
   * node could not find it: empty output, which `ask` would read as "allowed".
   * The allowed case passed because the hook never ran. So each answer here
   * must also show the hook ran: exit 0 and no error on stderr.
   */
  const { resolve } = await import("node:path");
  const absoluteHook = resolve(HOOK);
  const askIn = (command) => {
    const r = spawnSync(process.execPath, [absoluteHook], {
      cwd: dir,
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
      encoding: "utf8",
    });
    return { out: r.stdout.trim(), ran: r.status === 0 && !/Error|could not/.test(r.stderr) };
  };
  try {
    git("init", "-q", "-b", "main");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(dir, "supabase", "migrations"), { recursive: true });
    writeFileSync(join(dir, "supabase", "migrations", "0052_x.sql"), "select 1;\n");
    const cases = [
      ["end to end: staged pending, working copy says applied", "null", '"2026-10-27"', true],
      ["end to end: staged applied, working copy says pending", '"2026-10-27"', "null", false],
    ];
    for (const [name, staged, working, shouldRefuse] of cases) {
      writeFileSync(join(dir, "supabase", "applied.mjs"), ledgerWith(staged));
      git("add", "supabase");
      writeFileSync(join(dir, "supabase", "applied.mjs"), ledgerWith(working));
      const { out, ran } = askIn("git " + "commit -m 'sitting'");
      const refused = out.includes('"permissionDecision":"deny"');
      const ok = ran && refused === shouldRefuse;
      if (!ok) wrong += 1;
      console.log(`${ok ? "PASS" : "WRONG"}  ${shouldRefuse ? "refused" : "allowed"}: ${name}${ran ? "" : " (the hook did not run)"}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(wrong === 0
  ? `\nAll ${REFUSE.length + ALLOW.length + WRITE_CASES.length + GIT_CASES.length + 4} cases correct.`
  : `\n${wrong} case(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
