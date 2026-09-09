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

  for (const m of src.matchAll(/from "(\.[^"]+)"/g)) {
    const target = resolve(dirname(file), m[1]);
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
