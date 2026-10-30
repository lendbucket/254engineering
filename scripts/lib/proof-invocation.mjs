/**
 * How a proof under scripts/proofs is run: one home, read by proofs-audit (the
 * board) and by the preflight.
 *
 * WHY ONE HOME, 2026-10-30. Board 41127255244 reported
 * every-declared-title-and-description-meets-the-budget.mjs as "could not be
 * invoked": proofs-audit ran it under bare node, because it imports
 * src/lib/seo.ts through a computed path the source scan could not see, and the
 * loader refused the `@/config` alias. The preflight had run the same proof
 * green, because it always launched proofs under tsx. Two runners deciding
 * separately how to run one file is a fact with two homes, and the difference
 * reached a board. Both now ask this module, so a proof the board cannot launch
 * fails the preflight the same way.
 *
 * Moved here from scripts/proofs-audit.mjs unchanged in behavior.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "./read-source.mjs";
import { runtimeFor } from "./audit-runtime.mjs";

export const PROOF_DIR = "scripts/proofs";

/*
 * TSX IS INVOKED AS A SCRIPT, NEVER AS A COMMAND NAME. `node
 * node_modules/tsx/dist/cli.mjs <proof>` is tsx's own declared bin entry, with
 * no shell and no `.cmd`. The full reasoning is in scripts/proofs-audit.mjs.
 */
export const TSX_CLI = "node_modules/tsx/dist/cli.mjs";

/**
 * Does this proof import TypeScript?
 *
 * A proof that imports a `.ts` module cannot run under bare `node`: the loader
 * reports ERR_MODULE_NOT_FOUND for the specifier, or for a path alias it cannot
 * resolve. Derived from the source rather than listed.
 */
export function importsTypeScript(path) {
  const src = readSource(path);
  if (/from\s+"[^"]+\.tsx?"/.test(src) || /import\(\s*[`"][^`"]+\.tsx?/.test(src)) return true;
  if (/from\s+"@\//.test(src) || /import\(\s*[`"]@\//.test(src)) return true;
  /* A relative specifier that resolves to a .ts file on disk. */
  const specs = [...src.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)].map((m) => m[1]);
  return specs.some((s) => {
    const base = join(PROOF_DIR, s);
    return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
  });
}

/** The argv for `node` that runs one proof file (a name inside PROOF_DIR). */
export function invocationFor(file) {
  const path = `${PROOF_DIR}/${file}`;
  const needsTsx = importsTypeScript(path);
  const { needsReactServer } = runtimeFor(path);
  const args = [];
  if (needsTsx) args.push(TSX_CLI);
  if (needsReactServer) args.push("--conditions=react-server");
  args.push(path);
  return { command: "node", args, needsTsx, needsReactServer };
}
