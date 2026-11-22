/**
 * PROOF: NO CLIENT SCREEN CARRIES THE LAUNCH GATE OR THE PROTOCOL REGISTRY, AND
 * NO CLIENT FILE ON THE ACCOUNT SCREEN CARRIES ZOD.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-client-screen-carries-no-server-registry.mjs
 *
 * Robert's answers 2 and 3 of 2026-11-22 (issue #1, 7080044238), from the byte
 * report 7074090867.
 *
 * 2. The files, review and messages screens each shipped about 100 KB of server
 *    data to the browser. FileClient read STATUS_LABEL from ops-files.ts and
 *    ReviewClient read its labels from ops-review.ts; both modules import
 *    isOpen from launch.ts, and launch.ts carries the protocol registry and the
 *    service copy. MessagesClient read KeyboardAwareComposer from the design
 *    barrel, which re-exports RestrictedMode, which imports launch.ts. The
 *    labels moved to file-status-labels.ts and review-labels.ts, and
 *    MessagesClient imports the composer from its own file.
 *
 * 3. /account shipped zod to every signed in customer through PartnerProfile,
 *    which read the roofer form's choices from roofer-application.ts. The
 *    choices moved to roofer-application-labels.ts and the schemas now load
 *    when a roofer saves.
 *
 * HOW IT READS. The import graph of src, from the source: every static value
 * import and re-export, `import type` excluded because it never reaches the
 * bundle, and dynamic import() excluded because it is a separate chunk loaded
 * on demand, which is the shape answer 3 chose on purpose. A client file is one
 * whose first lines say "use client". For each client file it asks whether any
 * chain of static imports reaches a forbidden module, and names the chain.
 *
 * A GRAPH THAT RESOLVES NOTHING WOULD PASS, so the premises are asserted first:
 * the graph holds over a hundred client files, and three chains known to exist
 * on the server side are found (ops-files.ts and the design barrel each reach
 * launch.ts, and roofer-application.ts reaches zod). If the resolver stopped
 * following aliases or barrels, those fail before the property is read.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const listed = execFileSync("git", ["-C", ROOT, "ls-files", "--cached", "--others", "--exclude-standard", "src", "data"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(ts|tsx)$/.test(f) && existsSync(join(ROOT, f)));

function resolve(from, spec) {
  if (spec === "zod" || spec.startsWith("zod/")) return "pkg:zod";
  let base;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith("@data/")) base = `data/${spec.slice(6)}`;
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec)).split("\\").join("/");
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx)$/.test(c) && existsSync(join(ROOT, c))) return c;
  }
  return null;
}

const edges = new Map();
for (const f of listed) {
  const text = readFileSync(join(ROOT, f), "utf8");
  const deps = [];
  for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+["']([^"']+)["']/gm)) {
    const r = resolve(f, m[1]);
    if (r) deps.push(r);
  }
  for (const m of text.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    const r = resolve(f, m[1]);
    if (r) deps.push(r);
  }
  edges.set(f, deps);
}
const isClient = (f) => /^\s*["']use client["']/m.test(readFileSync(join(ROOT, f), "utf8").split("\n").slice(0, 3).join("\n"));
const clients = listed.filter(isClient);

/** The shortest chain of static imports from `start` to any of `targets`, or null. */
function chain(start, targets) {
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift();
    if (targets.includes(n)) {
      const path = [];
      for (let p = n; p; p = prev.get(p)) path.unshift(p);
      return path;
    }
    for (const d of edges.get(n) ?? []) if (!prev.has(d)) { prev.set(d, n); queue.push(d); }
  }
  return null;
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
};

const LAUNCH = "src/lib/launch.ts";
/*
 * NOT THE CATALOGUE. data/catalog.ts reaches the browser on purpose: the order
 * flow and the operator intake form draw their services, deliverables and
 * prices from it (through order-flow.ts and intake-fields.ts). Answer 2 was
 * about the launch gate and the protocol registry reaching screens that use
 * neither, and the catalogue reaching those screens only ever went through
 * launch.ts, which this forbids.
 */
const REGISTRIES = [LAUNCH, "src/content/protocols/index.ts"].filter((f) => existsSync(join(ROOT, f)));

console.log("the graph resolves what it reads");
check("over a hundred client files are read", clients.length > 100, `${clients.length}`);
check("both server registries exist to be looked for", REGISTRIES.length === 2, REGISTRIES.join(", "));
check("ops-files.ts reaches launch.ts, the chain that shipped the registry to /portal/files", chain("src/lib/ops-files.ts", [LAUNCH]) !== null);
check("the design barrel reaches launch.ts through RestrictedMode", chain("src/components/portal/design/index.ts", [LAUNCH]) !== null);
check("roofer-application.ts reaches zod", chain("src/lib/roofer-application.ts", ["pkg:zod"]) !== null);

console.log("no client file carries the launch gate");
const gated = clients.map((c) => chain(c, [LAUNCH])).filter(Boolean);
check("no client file reaches launch.ts by a static import", gated.length === 0, gated.map((p) => p.join(" -> ")).join(" | "));

console.log("the three screens of answer 2 carry neither registry");
for (const f of ["src/app/portal/(app)/files/FileClient.tsx", "src/app/portal/(app)/review/ReviewClient.tsx", "src/app/portal/(app)/messages/MessagesClient.tsx"]) {
  const p = clients.includes(f) ? chain(f, REGISTRIES) : ["not read as a client file"];
  check(`${f} reaches neither`, p === null, p ? p.join(" -> ") : "");
}

/*
 * THE CLIENTS THAT STILL CARRY THE PROTOCOL REGISTRY, COUNTED AND NAMED. The
 * order flow and the operator intake form ask each protocol's own intake
 * questions, which data/protocol-fields.ts derives in the browser from the
 * whole registry. That is outside answer 2 and is a question for Robert
 * (issue #1, 2026-11-22). Until he rules, the set is pinned: a new client file
 * reaching the registry turns this red, and so does one of these leaving it,
 * so the pin cannot outlive the thing it covers.
 */
const KNOWN_PROTOCOL_CLIENTS = ["src/app/portal/(app)/intake/IntakeClient.tsx", "src/components/order/OrderFlow.tsx"];
const protocolClients = clients.filter((c) => chain(c, ["src/content/protocols/index.ts"]) !== null).sort();
const extra = protocolClients.filter((c) => !KNOWN_PROTOCOL_CLIENTS.includes(c));
const gone = KNOWN_PROTOCOL_CLIENTS.filter((c) => !protocolClients.includes(c));
check(
  `the clients carrying the protocol registry are exactly the ${KNOWN_PROTOCOL_CLIENTS.length} named, awaiting Robert's ruling`,
  extra.length === 0 && gone.length === 0,
  [extra.length ? `new: ${extra.map((c) => chain(c, ["src/content/protocols/index.ts"]).join(" -> ")).join(" | ")}` : "", gone.length ? `no longer carrying, take off the list: ${gone.join(", ")}` : ""].filter(Boolean).join("; "),
);
console.log(`  note: ${protocolClients.length} client file(s) carry the protocol registry by ruling pending: ${protocolClients.join(", ")}`);

console.log("no client file on the account screen carries zod");
const accountClients = clients.filter((f) => f.startsWith("src/app/account/"));
check("the account screen's partner profile is among them", accountClients.includes("src/app/account/PartnerProfile.tsx"), `${accountClients.length} client files under src/app/account`);
const zodded = accountClients.map((c) => chain(c, ["pkg:zod"])).filter(Boolean);
check("none reaches zod by a static import", zodded.length === 0, zodded.map((p) => p.join(" -> ")).join(" | "));
check(
  "the profile still validates with the route's schemas, loaded when a roofer saves",
  /import\(\s*["']@\/lib\/roofer-application["']\s*\)/.test(readFileSync(join(ROOT, "src/app/account/PartnerProfile.tsx"), "utf8")),
);

console.log("");
if (failures === 0) {
  console.log("PASS: no client screen carries the launch gate or the protocol registry, and /account carries no zod.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failures} check(s).`);
  process.exitCode = 1;
}
