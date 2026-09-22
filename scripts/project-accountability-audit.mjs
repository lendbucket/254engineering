/**
 * A PROJECT NO DOCUMENT ACCOUNTS FOR IS NAMED BY THE BOARD.
 *
 *   npx tsx scripts/project-accountability-audit.mjs
 *
 * WHY IT EXISTS
 * -------------
 * `docs/production-cutover-plan.md` said of `254engineering-rehearsal`, in
 * writing, "since deleted". Eleven days later that project was alive, billable,
 * and holding 239 audit events, 2 order payments, 1 profile and 1 service order.
 *
 * Nobody deleted it and nobody checked. Operator ruling, 2026-09-14: a document
 * that records a destructive action as done is a claim nothing supports unless
 * something checked, and any project in the organisation that no document
 * accounts for is named by the board.
 *
 * WHAT IT CAN SEE, AND THE HALF IT CANNOT
 * ----------------------------------------
 * It cannot list the organisation's projects. That needs a Supabase management
 * credential and standing law keeps those out of the working tree. This is the
 * same split `schema-ledger-audit` has always had, and the reasoning is the
 * same: the failure was not a wrong answer, it was a question nobody was made
 * to answer.
 *
 * So it asserts, with no credentials at all:
 *
 *   1. Every ref in the declaration is accounted for by a document that EXISTS
 *      and that actually NAMES it. A pointer at a document that does not mention
 *      the project is a pointer nobody can follow, which is the failure one
 *      level in.
 *   2. Every project ref that appears ANYWHERE in the source, tracked or merely
 *      written, is in the declaration. This is the reverse scan, and it is the
 *      half that catches a project somebody wired up without telling this file,
 *      exactly as the environment file scan catches a credential nothing reads.
 *   3. A retired project says when it was confirmed gone AND how. Intending to
 *      delete is not confirming.
 *   4. An EXTERNAL project carries who owns it, when somebody looked, and that
 *      it holds zero `eng_` tables. External is a declaration rather than a
 *      dismissal, and a project holding this firm's data cannot be dismissed.
 *   5. Nothing is declared twice, no two entries share a ref, and nothing is
 *      declared both ours and external.
 *
 * It prints the by hand command for the half it cannot do, rather than implying
 * it has done it.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PROJECTS, RETIRED, EXTERNAL, REFS, DECLARED_REFS } from "../supabase/projects.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========= A PROJECT NO DOCUMENT ACCOUNTS FOR =========");

/*
 * A Supabase project ref is exactly twenty lower case letters. Anchored on word
 * boundaries so it cannot match the middle of a hash, and the corpus is
 * filtered below so ordinary English words of that length do not count.
 */
const REF_PATTERN = /\b[a-z]{20}\b/g;

// ------------------------------------------------- 1. the declaration is sane

{
  const seen = new Set();
  const dupes = [];
  for (const p of [...PROJECTS, ...RETIRED]) {
    if (seen.has(p.ref)) dupes.push(p.ref);
    seen.add(p.ref);
  }
  rec(
    `every declared project is declared once (${REFS.length})`,
    dupes.length === 0,
    dupes.length ? `declared twice: ${dupes.join(", ")}` : "",
  );

  const shapeless = [...PROJECTS, ...RETIRED].filter(
    (p) => !/^[a-z]{20}$/.test(p.ref) || !p.name || !p.because || !p.status,
  );
  rec(
    "every declared project carries a ref, a name, a status and a reason",
    shapeless.length === 0,
    shapeless.length ? `incomplete: ${shapeless.map((p) => p.ref || "(no ref)").join(", ")}` : "",
  );
}

// -------------------------------------- 2. the document exists and names it

for (const p of PROJECTS) {
  const path = p.accountedFor;
  if (!existsSync(path)) {
    rec(`${p.name} is accounted for by ${path}`, false, "that document does not exist");
    continue;
  }
  const body = readFileSync(path, "utf8");
  const named = body.includes(p.ref) || body.includes(p.name);
  rec(
    `${p.name} is accounted for by ${path}, which names it`,
    named,
    named ? "" : `${path} exists and mentions neither ${p.ref} nor ${p.name}`,
  );
}

// ------------------------------------------------------- 3. retired says how

for (const r of RETIRED) {
  const complete = Boolean(r.confirmedGoneAt) && Boolean(r.confirmedHow);
  rec(
    `retired project ${r.name} says when it was confirmed gone and how`,
    complete,
    complete
      ? ""
      : "a retired project records the date it was READ BACK as absent and what read it. " +
        "Intending to delete it is not confirming it, which is the defect this whole check exists for",
  );
}
if (RETIRED.length === 0) {
  rec("no project is declared retired (0)", true, "nothing has been confirmed deleted, which is honest");
}

// -------------------------------------- 3b. external is a declaration, not a dismissal

/*
 * THE GUARD THAT STOPS THIS LIST BECOMING A WAY TO SILENCE A FINDING.
 *
 * Operator ruling, 2026-09-14: a project outside this firm is named as
 * declared-external rather than unaccounted. The obvious abuse is moving an
 * awkward project into that list to make the board go quiet, so an external
 * entry has to carry the thing that makes it dismissible: somebody looked, on a
 * date, and it holds none of this firm's data.
 *
 * An external project with even one eng_ table is a FAIL, because a database
 * with this firm's records in it is this firm's problem whoever owns the
 * account it is billed to.
 */
for (const e of EXTERNAL) {
  const documented =
    Boolean(e.owner) && Boolean(e.checkedAt) && Boolean(e.because) && typeof e.engTables === "number";
  rec(
    `external project ${e.name} says who owns it, when it was checked, and what it holds`,
    documented,
    documented
      ? ""
      : "an external entry carries owner, checkedAt, because and engTables. Without them it is not a " +
        "declaration, it is a way to stop the board mentioning a project",
  );

  rec(
    `external project ${e.name} holds no eng_ table (checked ${e.checkedAt ?? "never"})`,
    e.engTables === 0,
    e.engTables === 0
      ? ""
      : `it reports ${e.engTables} eng_ tables. A project holding this firm's data is this firm's ` +
        "problem whoever owns the account, and it cannot be dismissed as external",
  );
}

{
  const ours = new Set(REFS);
  const bothWays = EXTERNAL.filter((e) => ours.has(e.ref)).map((e) => e.ref);
  rec(
    `no project is declared both ours and external (${EXTERNAL.length} external)`,
    bothWays.length === 0,
    bothWays.length ? `declared twice, in opposite senses: ${bothWays.join(", ")}` : "",
  );
}

// ----------------------------------- 4. the reverse scan, over tracked source

{
  /*
   * THE SCAN RUNS FROM THE FILES RATHER THAN FROM THE DECLARATION, which is the
   * half that can find something nobody told this file about. The same shape as
   * the environment file scan: a check derived only from the declaration can
   * find what the declaration already knows.
   */
  /*
   * TRACKED **AND** UNTRACKED-BUT-NOT-IGNORED, AND THE SECOND HALF IS THERE
   * BECAUSE ITS ABSENCE COST THIS AUDIT ITS FIRST BOARD.
   *
   * The first version listed `git ls-files`, which is tracked files only. This
   * audit's own declaration, `supabase/projects.mjs`, was still UNTRACKED while
   * the audit was being written, so the scan could not see the one file in the
   * repository most certain to contain project refs. It passed four times
   * locally over a set that excluded itself, and went red on the board the
   * moment the commit made the file tracked.
   *
   * That is this repository's recurring defect wearing a file list: a green
   * audit is a green audit of the files it read. `--others --exclude-standard`
   * adds the files git can see but does not yet track, so a declaration is
   * scanned the moment it is written rather than the moment it is committed.
   */
  const tracked = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|mjs|js|md|json|sql|yml|yaml)$/.test(f));

  /*
   * Twenty letter English words exist and a few are in this repository's prose.
   * A ref is only interesting where it appears in a SUPABASE context, so the
   * corpus is the lines that mention one, which is also what makes a finding
   * actionable: the check can print the line.
   */
  const found = new Map();
  for (const file of tracked) {
    let body;
    try {
      body = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!/supabase|project.?ref|PRODUCTION_REF/i.test(body)) continue;
    for (const line of body.split("\n")) {
      if (!/supabase\.co|supabase\.com|project|ref/i.test(line)) continue;
      for (const m of line.match(REF_PATTERN) ?? []) {
        if (!found.has(m)) found.set(m, `${file}: ${line.trim().slice(0, 100)}`);
      }
    }
  }

  const declared = new Set(DECLARED_REFS);
  /*
   * Twenty letter lower case words that are not refs. Listed rather than
   * pattern matched away, because a list somebody has to add to on purpose is
   * the mechanism, and a cleverer pattern would silently swallow a real ref.
   */
  const NOT_REFS = new Set([
    "responsibilities",
    "indistinguishable",
    "unrepresentable",
    "reconciliation",
  ]);

  const unaccounted = [...found.keys()].filter((r) => !declared.has(r) && !NOT_REFS.has(r));

  rec(
    `every project ref in the source is declared (${found.size} found, ${REFS.length} ours, ${EXTERNAL.length} external)`,
    unaccounted.length === 0,
    unaccounted.length
      ? unaccounted.map((r) => `${r} is not in supabase/projects.mjs -> ${found.get(r)}`).join(" | ")
      : "",
  );

  /*
   * The count is asserted rather than trusted. A scan that matched nothing would
   * pass this check silently while proving nothing, which is the vacuous green
   * this repository has been caught by before.
   */
  rec(
    "the reverse scan actually found refs to check",
    found.size > 0,
    found.size === 0
      ? "the scan matched no project ref anywhere, so the check above passed over an empty set"
      : "",
  );
}

/*
 * ===========================================================================
 * NO SOURCE FILE CARRIES A CONTROL CHARACTER. Operator ruling, 2026-09-21:
 * "fifth instance makes it a check, not a note."
 * ===========================================================================
 *
 * THE FIFTH INSTANCE, AND IT HAD BEEN SITTING IN THE TREE UNNOTICED.
 * `src/lib/sister-intake.ts` carried a raw NUL byte where `"\0"` was meant, as
 * the separator in the submission fingerprint's `.join()`. The shell ate the
 * backslash on its way to disk, which is the hazard CLAUDE.md section 6
 * already records four times: `\s` arriving as `s`, `\n` breaking a regex
 * across two lines, `\b` arriving as a backspace byte twenty times over.
 *
 * WHAT MAKES THIS ONE DIFFERENT, AND WHY IT EARNED A CHECK RATHER THAN A
 * FIFTH PARAGRAPH. The other four broke something: a pattern matched nothing,
 * a file stopped parsing. **This one was harmless and invisible.** A literal
 * NUL and `"\0"` are the same string value, so `fingerprintOf` worked
 * perfectly and always had. The damage was to VISIBILITY: `file` reported the
 * source as `data`, and `grep` printed "Binary file matches" instead of the
 * line. Every shell based scan of this repository had a blind spot exactly one
 * file wide, and nothing anywhere said so.
 *
 * It was found by a sweep for DBA names, which returned "Binary file
 * src/lib/sister-intake.ts matches" where every other hit was a line. The
 * sweep that found it had already silently skipped it.
 *
 * THIS IS THE VACUOUS GREEN IN ITS PUREST FORM: not a check looking at the
 * wrong thing, but a file that tools decline to look at at all, with the
 * decision made by a heuristic nobody configured.
 *
 * TAB, NEWLINE AND CARRIAGE RETURN ARE THE ONLY ONES ALLOWED, and they are
 * named rather than derived from a range, so widening the set is a deliberate
 * edit somebody has to justify.
 */
{
  const sourceFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|mjs|cjs|js|jsx|json|sql|css|md)$/.test(f));

  rec(
    "there is source to sweep for control characters",
    sourceFiles.length > 100,
    `${sourceFiles.length} files (if this were zero the check below would pass over nothing)`,
  );

  /*
   * Read as utf8 and compared by code point. A NUL survives a utf8 read as
   * U+0000, so nothing here depends on the file being legible as text, which
   * is the whole point: the file that prompted this was one tools called
   * binary.
   */
  const ALLOWED = new Set([0x09, 0x0a, 0x0d]);
  const carriers = [];
  for (const f of sourceFiles) {
    const text = readFileSync(f, "utf8");
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (code > 0x1f && code !== 0x7f) continue;
      if (ALLOWED.has(code)) continue;
      const line = text.slice(0, i).split("\n").length;
      carriers.push(`${f}:${line} U+${code.toString(16).padStart(4, "0").toUpperCase()}`);
      break;
    }
  }

  rec(
    "no source file carries a control character other than tab, newline or carriage return",
    carriers.length === 0,
    carriers.length
      ? carriers.join(", ") +
          ". A backslash escape was eaten by the shell on its way to disk. It may parse, run and " +
          "behave correctly while making the file invisible to every grep in the repository."
      : `${sourceFiles.length} files, every byte read`,
  );
}

// ------------------------------------------------------------------- verdict

console.log("");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}

const failed = out.filter((r) => !r.ok);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A Supabase project nobody accounts for is a database with the firm's data in it,");
  console.log("costing money, that no document explains and nobody is watching.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Every project this repository knows about is accounted for.`);
console.log("");
console.log("THIS CANNOT SEE THE ORGANISATION. It asserts that every project the REPOSITORY");
console.log("names is declared and explained; it cannot list what Supabase actually holds,");
console.log("because that needs a management credential and those stay out of the tree.");
console.log("For the other half, through the Supabase MCP, by hand:");
console.log("");
console.log("  list_projects, then compare every ref against supabase/projects.mjs");
console.log("");
console.log(`Declared: ${PROJECTS.length} this firm's, ${RETIRED.length} retired, ${EXTERNAL.length} external (Reyna Holdings, no eng_ tables).`);
