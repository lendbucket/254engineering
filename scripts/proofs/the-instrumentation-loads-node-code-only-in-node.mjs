/**
 * THE INSTRUMENTATION HOOK LOADS NODE-ONLY CODE ONLY IN THE NODE RUNTIME.
 *
 *   node scripts/proofs/the-instrumentation-loads-node-code-only-in-node.mjs
 *
 * Robert's ruling of 2026-10-23: main board 40035266531's live mode dev server
 * never came up, "Ecmascript file had an error" in the Edge Instrumentation
 * trace instrumentation.ts > ops-observability.ts > ops-mfa.ts > totp.ts's
 * node:crypto. The cause: an import with no runtime test is bundled for Edge.
 *
 * What this reads, from source: every dynamic import in src/instrumentation.ts
 * that is NOT inside an `if (process.env.NEXT_RUNTIME === "nodejs")` block is
 * followed through its static imports across src, and none may reach a node:
 * built-in or a "server-only" module. And the observability reporter, which
 * does, must sit inside that block.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const HOOK = "src/instrumentation.ts";
const src = readFileSync(HOOK, "utf8");

/* The span of every nodejs block, by brace counting from its opening. */
const guarded = [];
const guardRe = /if \(process\.env\.NEXT_RUNTIME === "nodejs"\) \{/g;
for (const m of src.matchAll(guardRe)) {
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  guarded.push([m.index, i]);
}
check("the hook has a nodejs runtime block", guarded.length > 0, `${guarded.length}`);

const imports = [...src.matchAll(/await import\("([^"]+)"\)/g)].map((m) => ({
  spec: m[1],
  at: m.index,
  inNode: guarded.some(([a, b]) => m.index > a && m.index < b),
}));
check("the hook's dynamic imports were found", imports.length >= 3, imports.map((i) => i.spec).join(", "));

const resolveSpec = (spec, from) => {
  const base = spec.startsWith("@/") ? join("src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of [".ts", ".tsx", "/index.ts", ""]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
};
/* Every node: built-in or server-only module reachable through static imports. */
function reaches(file, seen = new Set()) {
  if (seen.has(file)) return [];
  seen.add(file);
  const text = readFileSync(file, "utf8");
  const found = [];
  if (/^import "server-only";/m.test(text)) found.push(`${file} is server-only`);
  for (const m of text.matchAll(/^import(?:\s+type)?[^"']*["']([^"']+)["']/gm)) {
    if (/^import\s+type/.test(m[0])) continue;
    const spec = m[1];
    if (spec.startsWith("node:")) found.push(`${file} imports ${spec}`);
    const next = resolveSpec(spec, file);
    if (next) found.push(...reaches(next, seen));
  }
  return found;
}

for (const imp of imports.filter((i) => !i.inNode && (i.spec.startsWith("@/") || i.spec.startsWith(".")))) {
  const file = resolveSpec(imp.spec, HOOK);
  const bad = file ? reaches(file) : [`${imp.spec} could not be resolved`];
  check(`${imp.spec}, loaded in every runtime, reaches no node built-in and no server-only module`, bad.length === 0, bad.slice(0, 3).join("; "));
}
const reporter = imports.find((i) => i.spec === "@/lib/ops-observability");
check("the observability reporter is loaded only inside the nodejs block", Boolean(reporter) && reporter.inNode);
const reporterFile = resolveSpec("@/lib/ops-observability", HOOK);
check(
  "and it is the import that needs the guard: it reaches node code (so this proof is not vacuous)",
  Boolean(reporterFile) && reaches(reporterFile).length > 0,
  reporterFile ? reaches(reporterFile).slice(0, 1).join("") : "unresolved",
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the instrumentation hook loads node-only code only in the node runtime.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
