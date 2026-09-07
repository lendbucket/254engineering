/**
 * A CAST THAT SWITCHES OFF A TOTAL FUNCTION CHECK HAS TO SAY WHY.
 *
 *   npx tsx scripts/role-cast-audit.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * Operator ruling, 2026-09-07, after a sweep found six live instances of one
 * defect: a total function over the Phase 0 role union that stopped being total
 * when 0018 made roles rows.
 *
 * The important part of that sweep was not the six. It was the MECHANISM. In
 * every instance TypeScript had it right, and in every instance somebody wrote
 * `as Role` and switched it off. The worst of the six sat three lines below a
 * comment explaining that the same route used to refuse those very roles:
 *
 *     role: role as Role,
 *
 * The value had just been validated against eng_roles, so the author knew it
 * could be any of seven. The cast was how a validated dispatcher reached an
 * email template whose ternary fell through to "Field Technician".
 *
 * WHAT THIS ASSERTS
 * -----------------
 * No `as Role` anywhere in src/, unless the exact file is in ALLOWED below with
 * a stated reason. Same shape as the surface inventory and the pricing fields,
 * for the same reason: the thing that must not silently grow is given a
 * declaration, and adding to it is a deliberate act with a sentence attached.
 *
 * `RoleKey` is `string` and needs no cast, which is the point. A cast to `Role`
 * is a claim that a value is one of exactly three things, and after 0018 that
 * claim is almost always false.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Files permitted to cast to the Phase 0 union, and why.
 *
 * EMPTY, AND THAT IS THE CORRECT STARTING STATE. Every cast in the tree on
 * 2026-09-07 was removed rather than grandfathered, because grandfathering the
 * six that caused the sweep would have kept the mechanism that produced them.
 *
 * A future entry needs a reason a reviewer would accept. "It was easier" is not
 * one; "this is the three role matrix that seeds DEFAULT_ROLES and the union is
 * the honest type there" would be.
 */
const ALLOWED = {
  // "src/lib/example.ts": "why this file legitimately needs the narrow union",
};

const ROOT = "src";

/* `as Role`, `as Role[]`, `<Role>` and the unknown laundering variant. */
const PATTERNS = [
  { re: /\bas\s+Role\b(?!Key|Row|Shape|Grants)/g, what: "as Role" },
  { re: /\bas\s+unknown\s+as\s+Role\b(?!Key|Row|Shape|Grants)/g, what: "as unknown as Role" },
];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(path);
  }
  return found;
}

console.log("");
console.log("======== A CAST THAT SWITCHES OFF THE CHECK MUST SAY WHY ========");
console.log("");

const files = walk(ROOT);
rec(`there are files to search (${files.length})`, files.length > 0, "a search over nothing passes forever");

/*
 * The canary. If the pattern cannot match, every check below is vacuous, so it
 * is run against a string that must match before it is trusted on the tree.
 */
{
  const probe = "const r = value as Role;";
  const matches = PATTERNS.some((p) => {
    p.re.lastIndex = 0;
    return p.re.test(probe);
  });
  rec("the pattern still recognises a cast when it sees one", matches, "otherwise this audit is decorative");
}

const offences = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const normalised = file.split("\\").join("/");

  for (const line of source.split(/\r?\n/).entries()) {
    const [n, text] = line;

    /* A comment describing the defect is not the defect. Every fix committed
     * today explains the cast it removed, and flagging those would make the
     * audit unusable in exactly the files that document it best. */
    const trimmed = text.trim();
    if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      if (p.re.test(text)) {
        if (ALLOWED[normalised]) continue;
        offences.push(`${normalised}:${n + 1}  ${trimmed.slice(0, 90)}`);
      }
    }
  }
}

rec(
  "no file casts to the Phase 0 role union without a stated reason",
  offences.length === 0,
  offences.length
    ? `${offences.length} cast(s): ${offences.join(" | ")}`
    : `${Object.keys(ALLOWED).length} file(s) allowed`,
);

/*
 * And the allowlist itself has to be honest: an entry naming a file that does
 * not exist, or one with no reason, is a permission nobody can evaluate.
 */
{
  const ghosts = Object.keys(ALLOWED).filter(
    (f) => !files.map((x) => x.split("\\").join("/")).includes(f),
  );
  rec("every allowed file exists", ghosts.length === 0, ghosts.join(", "));

  const silent = Object.entries(ALLOWED).filter(([, why]) => !why || !String(why).trim());
  rec("every allowed file gives a reason", silent.length === 0, silent.map(([f]) => f).join(", "));
}

// ------------------------------------------------------------------- verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("`Role` is the union of the three roles that shipped in Phase 0. Seven ship now.");
  console.log("If the value really is one of those three, say so in the type. If it is a role");
  console.log("key, it is `RoleKey`, which is `string` and needs no cast. If the cast is");
  console.log("genuinely right, add the file to ALLOWED with a reason a reviewer would accept.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Nothing switches off the role type without saying why.`);
