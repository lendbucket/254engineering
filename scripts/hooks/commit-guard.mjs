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

/*
 * ===========================================================================
 * RULES FOUR AND FIVE: SOURCE IS WRITTEN WITH THE EDITOR, NOT THE SHELL.
 * Operator ruling, approved 2026-09-19, built 2026-09-20 after the fourth bill.
 * ===========================================================================
 *
 * THE HAZARD. Content passed through this environment's shell does not arrive
 * intact. `\b` becomes a BACKSPACE byte, `\s` becomes `s`, `\n` becomes a real
 * newline that breaks a regex literal across two lines, `\d` becomes `d`, and
 * `${VAR}` is eaten by perl before node ever sees it.
 *
 * FOUR INSTANCES, AND THE FOURTH IS WHY THIS IS MECHANICAL.
 *
 *   2026-09-16  `\d` in stripe-webhook-audit: a date pattern matched nothing
 *               and its check failed on a correct record.
 *   2026-09-16  `\s*\n\s*` in gate-fixture: the file stopped parsing and the
 *               board reported three content failures for one syntax error.
 *   2026-09-16  `\b...\(` in compliance-audit: a backspace byte written into
 *               the source.
 *   2026-09-20  TWENTY `\b` into regulatory.mjs, every one a backspace. Four
 *               pattern sets matched nothing, one check passed BY matching
 *               nothing, and partner copy was loosened in three directions on
 *               main.
 *
 * WHY PREVENTIVE AND NOT DETECTIVE, which was the design question. A
 * PostToolUse syntax check would have caught the 2026-09-16 gate-fixture case
 * and NONE of the other three: `\d` arriving as `d` and `\b` arriving as a
 * backspace both parse perfectly and silently match nothing. The worst version
 * of this hazard produces VALID CODE. So the guard has to refuse before the
 * write, not inspect after it.
 *
 * AND THE ONE-LINE ARGUMENT FOR IT, from the 2026-09-20 incident: of the four
 * pattern sets, the only one that worked was SEALING_GATED, and it worked
 * because it spreads an existing array instead of retyping it. The part that
 * was not hand-written through the shell is the part that survived.
 */

/** Extensions where a mangled byte is a defect rather than a typo somebody sees. */
const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|sql|md|json|css)$/i;

/**
 * RULE FOUR: a shell command may not write into a source file.
 *
 * Not "when it has a backslash": always. Every time the shell was reached for
 * to edit source it was a shortcut, and the read-before-edit discipline is
 * bypassed by it whatever the escaping does.
 *
 * The redirect target is what is tested, so `npm run audit > board.log` is
 * untouched and `cat > src/lib/x.ts` is not.
 */
export function sourceWriteVerdict(command) {
  if (typeof command !== "string") return null;

  /*
   * TESTED AGAINST THE COMMAND WITH QUOTED STRINGS AND HEREDOC BODIES REPLACED,
   * exactly as rule one is, and the first version of this was not.
   *
   * It refused the commit that introduced it. The message described the rule,
   * so it contained the words "sed/perl/ruby", a "-0pi", and the extension
   * list, and the matcher read a COMMIT MESSAGE as a command that edits source.
   * That is the same defect rule one already solved: a commit message naming a
   * script is not a script.
   *
   * Rule five deliberately does the opposite and reads the bodies, because for
   * that rule the body IS the subject. The two rules want different views of
   * the same command, which is why each takes its own.
   */
  const stripped = stripQuoted(command) ?? command;
  const targets = [];
  /* A redirect, with or without a file descriptor in front of it. */
  for (const m of stripped.matchAll(/(?:^|\s)\d?>>?\s*(['"]?)([^\s'"|&;<>]+)\1/g)) {
    targets.push(m[2]);
  }
  /*
   * In place editors name their target as an ordinary argument.
   *
   * THE FLAG CLUSTER CARRIES DIGITS, which the first version of this pattern
   * did not allow, so `perl -0pi -e` walked straight past it and the proof
   * caught it on its first run. `-0777`, `-0pi` and `-pi` are all the same
   * rule, and a character class of letters only sees none of the first two.
   */
  if (/\b(?:sed|perl|ruby)\b[^|;]*\s-[a-zA-Z0-9]*i[a-zA-Z0-9]*\b/.test(stripped)) {
    for (const m of stripped.matchAll(/(?:^|\s)(['"]?)([^\s'"|&;<>]*\.[a-zA-Z]{1,5})\1(?=\s|$)/g)) {
      targets.push(m[2]);
    }
  }

  const hit = targets.find((t) => SOURCE_FILE.test(t));
  if (!hit) return null;

  return [
    `This command writes into ${hit}, which is a source file.`,
    "Source is written with the Write or Edit tool, never through the shell.",
    "This environment does not deliver backslashes intact: \\b arrives as a backspace,",
    "\\s arrives as s, and \\n arrives as a real newline. On 2026-09-20 twenty word",
    "boundaries went into regulatory.mjs as backspace bytes, four pattern sets",
    "matched nothing, and one check passed BY matching nothing.",
    "Use Write or Edit. If a script must generate the change, write the script to",
    "the scratchpad with the editor first, then run it.",
  ].join(" ");
}

/**
 * RULE FIVE: content carrying a backslash or an interpolation may not be
 * written through the shell, wherever it is going.
 *
 * SCRATCHPAD INCLUDED, AND THAT IS THE OPERATOR'S CAVEAT RATHER THAN A DETAIL.
 * `fill5.mjs` was corrupted on its way INTO the scratchpad, before it had run
 * once. A tracked-files-only rule would have missed it entirely.
 *
 * ONLY THE CONTENT IS TESTED, never the whole command. A heredoc BODY and a
 * `-e` script are content; a Windows path in a redirect target is not, and
 * `grep "\bfoo" src/` reads rather than writes and is untouched. That is what
 * keeps this from becoming the problem it is preventing.
 */
export function lossyContentVerdict(command) {
  if (typeof command !== "string") return null;

  const bodies = [];

  /* Heredoc bodies: everything between the tag and its closing line. */
  for (const m of command.matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n([\s\S]*?)\r?\n\2\b/g)) {
    bodies.push({ what: `the ${m[2]} heredoc`, text: m[3] });
  }

  /* Inline scripts handed to an interpreter. */
  for (const m of command.matchAll(/\b(node|perl|ruby|python3?)\b[^|;]*?\s-[a-zA-Z0]*e\s+(['"])([\s\S]*?)\2/g)) {
    bodies.push({ what: `the inline ${m[1]} script`, text: m[3] });
  }

  for (const body of bodies) {
    const backslash = body.text.includes("\\");
    const interpolation = body.text.includes("${");
    if (!backslash && !interpolation) continue;
    return [
      `This command writes ${body.what}, and it carries`,
      backslash ? "a backslash" : "a ${...} interpolation",
      backslash && interpolation ? "and a ${...} interpolation" : "",
      "through the shell.",
      "That content does not arrive intact. A backslash is eaten or turned into a",
      "control byte, and ${...} is expanded before the interpreter sees it.",
      "Four instances so far, the worst on 2026-09-20: twenty word boundaries",
      "became backspace bytes, the regexes parsed, and they matched nothing.",
      "Write the file with the Write or Edit tool instead.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return null;
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

  const refusal =
    verdict(command) ??
    sourceWriteVerdict(command) ??
    lossyContentVerdict(command) ??
    migrationOnMainVerdict(command, readGitState());
  if (refusal) deny(refusal);
}

// The check is exercised through this entry point rather than by importing
// verdict(), so what is proven is the thing the hook actually runs.
await main();
