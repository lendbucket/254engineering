import { existsSync } from "node:fs";
import { readSource } from "./read-source.mjs";
import { dirname, resolve } from "node:path";

/**
 * HOW AN AUDIT MUST BE RUN, DERIVED RATHER THAN REMEMBERED.
 *
 * Operator ruling, 2026-09-08, and it was earned. launch-audit gained a check
 * that imports a module carrying `server-only`. It ran green every time it was
 * tested, because it was tested with `npx tsx --conditions=react-server`, and
 * it failed on the board, because the board ran `node scripts/launch-audit.mjs`
 * and could not import TypeScript at all. An audit that is green the way it is
 * tested and red the way it is run is the worst shape a check can have: the
 * person who wrote it has evidence it works and the board disagrees.
 *
 * THE FIX IS NOT "REMEMBER TO UPDATE package.json".
 *
 * It is that the requirement is READ from the audit's own imports. An audit
 * that reaches a server-only module needs the react-server condition; that is
 * a fact about the file, not a preference, so this works it out and the runner
 * refuses to start when package.json disagrees.
 *
 * Same idiom as scripts/lib/surfaces.mjs, and for the same reason: a list
 * somebody maintains by hand stops describing the system the first time
 * somebody forgets, and the forgetting is silent.
 *
 * WHY ONE INVOCATION AND NOT TWO.
 *
 * Both the board and a person run `npm run <audit>`. There is deliberately no
 * second path: if the runner spawned tsx itself with its own flags, a hand run
 * could still differ from the board, which is the defect this closes rather
 * than a different spelling of it. package.json stays the single invocation and
 * is checked against what the file actually needs.
 */

/** The declaration an audit carries when it reaches a server-only module. */
export const DECLARATION = "@runtime react-server";

const SEEN = new Map();

/**
 * Whether a TypeScript module is server-only, following its relative imports.
 *
 * Two levels of indirection are followed rather than one, because the common
 * case is an audit importing a rules module that imports the database client.
 * Depth is bounded and cycles are remembered: an unbounded walk over this
 * codebase's import graph would be slower than the audit it protects.
 */
function serverOnly(file, depth = 0) {
  if (depth > 3) return false;
  if (SEEN.has(file)) return SEEN.get(file);
  if (!existsSync(file)) return false;

  SEEN.set(file, false);
  const src = readSource(file);

  if (/^import "server-only";/m.test(src)) {
    SEEN.set(file, true);
    return true;
  }

  /*
   * RELATIVE IMPORTS AND THE `@/` ALIAS, because following only one of the two
   * made this walk blind to most of the codebase.
   *
   * Found 2026-10-01. A new proof imported `../../src/proxy.ts`, which is
   * relative and was followed, and `proxy.ts` imports `@/lib/ops-session`, which
   * is `server-only` and was NOT, because the pattern required a leading dot. So
   * the walk reported "no server-only module reached", `proofs-audit` ran the
   * proof without `--conditions=react-server`, and it died on the import.
   *
   * THE BLIND SPOT WAS NEVER ABOUT ONE PROOF. Almost every module under `src`
   * imports its siblings through this alias, so any audit whose chain to a
   * server-only module passes through one aliased hop was undetectable, and the
   * failure mode is the one this file's own header describes: green the way it is
   * tested, dead the way the board runs it.
   */
  const specs = [
    ...[...src.matchAll(/from "(\.[^"]+)"/g)].map((m) => ({ spec: m[1], from: "relative" })),
    ...[...src.matchAll(/from "(@\/[^"]+)"/g)].map((m) => ({ spec: m[1], from: "alias" })),
  ];

  for (const { spec, from } of specs) {
    const target = from === "alias" ? aliasTarget(spec) : resolve(dirname(file), spec);
    if (!target) continue;
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`]) {
      if (existsSync(candidate) && serverOnly(candidate, depth + 1)) {
        SEEN.set(file, true);
        return true;
      }
    }
  }
  return false;
}

/**
 * Where `@/` points, READ FROM tsconfig rather than assumed.
 *
 * It is `./src/*` today. Hardcoding that would be a second home for a fact
 * tsconfig already owns, and this file exists because of a list somebody
 * maintained by hand. If the mapping cannot be read, this returns null and the
 * caller treats the import as unfollowable rather than guessing, which is the
 * honest failure: an undetected server-only module is a loud crash on the board,
 * and a wrongly guessed path would be a silent miss.
 */
let ALIAS_ROOT;
function aliasTarget(spec) {
  if (ALIAS_ROOT === undefined) {
    ALIAS_ROOT = null;
    try {
      const tsconfig = readSource("tsconfig.json");
      const m = tsconfig.match(/"@\/\*"\s*:\s*\[\s*"([^"]+)"/);
      if (m) ALIAS_ROOT = m[1].replace(/\*$/, "").replace(/^\.\//, "");
    } catch {
      ALIAS_ROOT = null;
    }
  }
  if (!ALIAS_ROOT) return null;
  return resolve(process.cwd(), ALIAS_ROOT + spec.slice(2));
}

/**
 * What an audit script needs, read from what it imports.
 *
 * Returns `{ needsReactServer, declares, reason }`. A dynamic import counts:
 * launch-audit's was dynamic, inside a try, and that is exactly why the failure
 * only appeared on the board.
 */
export function runtimeFor(scriptPath) {
  if (!existsSync(scriptPath)) return { needsReactServer: false, declares: false, reason: null };

  const src = readSource(scriptPath);
  const declares = src.includes(DECLARATION);

  let reason = null;
  const specifiers = [
    ...src.matchAll(/from "(\.\.\/[^"]+)"/g),
    ...src.matchAll(/import\(\s*"(\.\.\/[^"]+)"\s*\)/g),
  ].map((m) => m[1]);

  for (const spec of specifiers) {
    const target = resolve(dirname(scriptPath), spec);
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`]) {
      if (existsSync(candidate) && serverOnly(candidate)) {
        reason = spec;
        break;
      }
    }
    if (reason) break;
  }

  return { needsReactServer: reason !== null, declares, reason };
}
