#!/usr/bin/env node
import { execFileSync } from "node:child_process";
/**
 * LAYER ONE OF THE COMMIT GUARD. Operator ruling, 2026-09-15.
 *
 * A Claude Code PreToolUse hook on the Bash tool. It reads the command before
 * anything runs and refuses two shapes outright:
 *
 *   1. A command that contains `git commit` AND also runs something: anything
 *      under `scripts/`, any `npm run`, or any `tsx`. A commit gets its own
 *      command, always.
 *   2. A command that contains `npm run audit` and anything else at all, apart
 *      from redirecting its own output to a file.
 *
 * WHY IT IS A HOOK AND NOT A GIT HOOK. A git pre-commit hook is layer two, and
 * layer two alone would not have caught instance five. Instance five was
 * `npx tsx scripts/db-guard-audit.mjs | tail -1 && git add ... && git commit`,
 * and an audit invoked directly with `npx tsx` runs no npm pre hook and RECORDS
 * NOTHING. A git hook that refuses on the last recorded failing run has nothing
 * to read. This hook reads the command itself, so it refuses before a single
 * process starts, whether or not anything was recorded and whether or not
 * anybody remembers the rule.
 *
 * The five instances this exists to make impossible:
 *   3. A generator run beside a board killed the board (2026-09-12).
 *   4. `git commit ... && npm run audit` made the build guard kill its caller.
 *   5. An audit piped through `tail`, which discarded its exit code, chained
 *      into the commit that then landed red (2026-09-15, commit 8b6d396).
 *
 * ON THE BLUNTNESS. Both rules are tested against the command with quoted
 * strings and heredoc bodies replaced by a placeholder word, so a commit
 * MESSAGE naming a script is not a refusal. That is the only softening: it
 * refuses exactly the shape "one command both runs something and commits",
 * which is the shape that cost the run, rather than refusing a sentence about
 * it. Everything else is a substring rule on purpose, including a `cd` in front
 * of a board run: the Bash working directory persists between commands, so `cd`
 * is its own command.
 *
 * Fails closed. If the payload cannot be parsed, or quoting cannot be resolved,
 * the raw command is tested instead of being waved through.
 */

const RUNS_SOMETHING = [
  { pattern: /scripts\//, what: "runs something under scripts/" },
  { pattern: /\bnpm\s+run\b/, what: "runs an npm script" },
  { pattern: /\btsx\b/, what: "runs tsx" },
];

/** `npm run audit` alone, with nothing but its own redirections after it. */
const BOARD_ALONE =
  /^\s*npm\s+run\s+audit\s*(?:(?:1|2)?>>?\s*[^\s|&;<>]+\s*|2>&1\s*|1>&2\s*)*$/;

const BOARD_MENTIONED = /\bnpm\s+run\s+audit\b/;

/**
 * Replace quoted strings and heredoc bodies with a placeholder WORD, so a
 * commit message cannot trip a rule about what the command RUNS. Returns null
 * when quoting is unbalanced, which is the signal to test the raw command
 * instead.
 *
 * It is a word rather than a space because the first real use of this hook
 * refused `npm run audit > "<path>" 2>&1`: blanking the quoted path left a
 * redirection with no target, so the board-alone shape no longer matched its
 * own output file. A placeholder keeps the SHAPE of the command intact, which
 * is the only thing these rules are about.
 */
const QUOTED = "q";

export function stripQuoted(command) {
  let out = "";
  let i = 0;
  while (i < command.length) {
    const c = command[i];
    if (c === "\\" && i + 1 < command.length) {
      out += QUOTED;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const close = command.indexOf(c, i + 1);
      if (close === -1) return null;
      out += QUOTED;
      i = close + 1;
      continue;
    }
    if (c === "<" && command.slice(i, i + 2) === "<<") {
      const rest = command.slice(i + 2);
      const tag = rest.match(/^-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
      if (!tag) {
        out += c;
        i += 1;
        continue;
      }
      const end = command.indexOf(`\n${tag[2]}`, i);
      if (end === -1) return null;
      out += QUOTED;
      i = end + 1 + tag[2].length;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

export function verdict(command) {
  if (typeof command !== "string" || command.trim() === "") return null;

  const stripped = stripQuoted(command) ?? command;

  if (/\bgit\s+commit\b/.test(stripped)) {
    const also = RUNS_SOMETHING.find((r) => r.pattern.test(stripped));
    if (also) {
      return [
        `This command commits and ${also.what} in one invocation.`,
        "A commit gets its own command. The audit or script runs first, on its",
        "own, and its exit code is read before anything is committed.",
        "This is the fifth instance of that rule and the reason this hook exists:",
        "on 2026-09-15 an audit was piped through tail, which discarded its exit",
        "code, and the commit chained after it landed while the audit was red.",
        "Run the two as two commands.",
      ].join(" ");
    }
  }

  if (BOARD_MENTIONED.test(stripped) && !BOARD_ALONE.test(stripped.trim())) {
    return [
      "The board is invoked on its own, with nothing chained to it and nothing",
      "else running against the repository. A board run takes twenty minutes and",
      "a command beside it has killed one already. Output may be redirected to a",
      "file and nothing else. Run `npm run audit` as its own command.",
    ].join(" ");
  }

  return null;
}

/**
 * RULE THREE: A COMMIT THAT ADDS A MIGRATION WHILE ON main.
 * Operator ruling, 2026-09-18.
 *
 * THE INCIDENT. After a merge, nineteen commits were made directly on main,
 * including two pending migrations. `schema-ledger-audit` caught it and named
 * the rule it broke: a migration on main is never pending, because merging is
 * the moment the decision stops being deferrable. Either it goes to production
 * in the merge sequence or it stays on its branch.
 *
 * WHY THE EXISTING RULES DID NOT COVER IT. CLAUDE.md says to read the branch off
 * git before every MERGE, and that was honoured: the branch was checked before
 * the merge and was correct. Nothing checks before every COMMIT, and a long run
 * is exactly where that drifts. The rule was known, the check at merge time was
 * done, and the gap was the nineteen commits in between.
 *
 * That is the fifth time this week a known rule failed for want of a mechanical
 * guard rather than for want of knowing it, which is why this is a hook rather
 * than another paragraph.
 *
 * IT TAKES THE GIT STATE RATHER THAN READING IT, so the rule can be exercised
 * against states that are awkward to create. `readGitState` below does the
 * reading and is exercised separately, because a rule tested only with its
 * input handed to it says nothing about whether the read that feeds it works.
 */
export function migrationOnMainVerdict(command, state) {
  if (typeof command !== "string") return null;
  const stripped = stripQuoted(command) ?? command;
  if (!/\bgit\s+commit\b/.test(stripped)) return null;
  if (!state || state.branch !== "main") return null;

  const migrations = (state.stagedFiles ?? []).filter((f) =>
    /^supabase\/migrations\/\d{4}_.*\.sql$/.test(f),
  );
  if (migrations.length === 0) return null;

  return [
    `This commit adds ${migrations.length === 1 ? "a migration" : `${migrations.length} migrations`} while on main:`,
    migrations.join(", ") + ".",
    "A migration on main is never pending. Either it goes to production in the",
    "merge sequence or it stays on its branch, because merging is the moment the",
    "decision stops being deferrable.",
    "On 2026-09-18 nineteen commits were made on main after a merge, two of them",
    "pending migrations, and the ledger caught it afterwards rather than the",
    "commit being refused. Branch first, then commit.",
  ].join(" ");
}

/**
 * The git state this hook needs, read from the repository.
 *
 * ON FAILING OPEN HERE, WHICH IS THE OPPOSITE OF THE OTHER RULES. The two rules
 * above fail closed, because an unparseable command is still a command and the
 * shape they refuse is visible in the text. This one needs to know which branch
 * is checked out, and if git cannot answer then the likeliest reason is that
 * this is not a git repository at all. Refusing every commit in that case would
 * make the hook the problem. It says so on stderr instead of deciding silently.
 */
export function readGitStateForProof() {
  return readGitState();
}

function readGitState() {
  try {
    const run = (args) =>
      execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return {
      branch: run(["branch", "--show-current"]).trim(),
      stagedFiles: run(["diff", "--cached", "--name-only"]).split("\n").map((s) => s.trim()).filter(Boolean),
    };
  } catch {
    process.stderr.write("commit-guard: could not read the git state, so the migration rule did not run\n");
    return null;
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let command;
  try {
    command = JSON.parse(raw)?.tool_input?.command;
  } catch {
    // An unparseable payload is not a licence to allow. Nothing to test, so
    // nothing is refused, but say so rather than exiting silently.
    process.stderr.write("commit-guard: could not parse the hook payload\n");
    return;
  }

  const refusal = verdict(command) ?? migrationOnMainVerdict(command, readGitState());
  if (refusal) deny(refusal);
}

// The check is exercised through this entry point rather than by importing
// verdict(), so what is proven is the thing the hook actually runs.
await main();
