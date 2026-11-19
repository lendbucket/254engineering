/**
 * EVERY PUBLIC API ROUTE IS DECLARED, AND EVERY TOKEN ROUTE IS SENT ITS PAIR.
 *
 *   node scripts/proofs/every-public-api-route-is-declared.mjs
 *
 * Robert's answer 6 of 2026-11-18: the public-route sweep that
 * docs/new-surface-checklist.md row 2 said was missing. security-audit's
 * perimeter walks the API routes under the signed in surfaces; this walks the
 * rest, so a route gated only by a token cannot ship unnamed.
 *
 *   A  every route.ts under src/app/api outside the signed in surfaces is in
 *      scripts/lib/public-api-routes.mjs, and every entry there names a route
 *      that exists, so the two cannot drift
 *   B  every entry is one of the two kinds, a reason entry says why, and a
 *      token entry says how to call it
 *   C  security-audit imports the declaration and sends every token route both
 *      halves of the pair, so declaring a route a token route is a check that
 *      runs, not a label
 *   D  the walk found routes at all: a sweep over nothing passes for ever
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_API_ROUTES, GUARDED_API_PREFIXES } from "../lib/public-api-routes.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const onDisk = walk("src/app/api")
  .filter((f) => /route\.(ts|tsx|js|mjs)$/.test(f))
  .map((f) => "/" + f.replace(/\\/g, "/").replace(/^src\/app\//, "").replace(/\/route\.(ts|tsx|js|mjs)$/, ""))
  .filter((r) => !GUARDED_API_PREFIXES.some((p) => r === p || r.startsWith(`${p}/`)))
  .sort();
const declared = Object.keys(PUBLIC_API_ROUTES).sort();

check("D: the walk found public API routes to sweep", onDisk.length >= 20, `${onDisk.length} found`);
const undeclared = onDisk.filter((r) => !PUBLIC_API_ROUTES[r]);
check("A: every public API route on disk is declared", undeclared.length === 0, undeclared.join(", ") || `${onDisk.length} route(s)`);
const gone = declared.filter((r) => !onDisk.includes(r));
check("A: every declared route exists on disk", gone.length === 0, gone.join(", ") || `${declared.length} entr(ies)`);

const badKind = declared.filter((r) => !["token", "reason"].includes(PUBLIC_API_ROUTES[r].kind));
check("B: every entry is a token route or carries a reason", badKind.length === 0, badKind.join(", "));
const noWhy = declared.filter((r) => String(PUBLIC_API_ROUTES[r].why ?? "").trim().length < 20);
check("B: every entry says why, in a sentence", noWhy.length === 0, noWhy.join(", "));
const tokens = declared.filter((r) => PUBLIC_API_ROUTES[r].kind === "token");
const unusable = tokens.filter((r) => !["GET", "POST"].includes(PUBLIC_API_ROUTES[r].method));
check("B: every token route says how it is called", unusable.length === 0, unusable.join(", ") || `${tokens.length} token route(s)`);

/*
 * E: THE KIND IS DERIVED FROM THE SOURCE, NOT TAKEN FROM THE LABEL. Found by
 * injection on 2026-11-19: relabelling an onboarding route "reason" left every
 * check above green and silently dropped its pair. A route whose own source
 * reads a link token must be declared a token route.
 */
const READS_A_TOKEN = /\bbody\??\.token\b|searchParams\.get\(\s*["']token["']\s*\)|\bfindByToken\(|\bcustomerQuote\(\s*token\b/;
const fileFor = (route) =>
  ["ts", "tsx", "js", "mjs"].map((x) => `src/app${route}/route.${x}`).find((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
const readsToken = onDisk.filter((r) => READS_A_TOKEN.test(readFileSync(fileFor(r), "utf8")));
check("E: the routes whose source reads a link token were found", readsToken.length >= 1, `${readsToken.length}: ${readsToken.join(", ")}`);
const mislabelled = readsToken.filter((r) => PUBLIC_API_ROUTES[r]?.kind !== "token");
check("E: and every one is declared a token route, so none can be labelled out of its pair", mislabelled.length === 0, mislabelled.join(", "));

const sec = readFileSync("scripts/security-audit.mjs", "utf8");
check("C: security-audit imports the declaration", /import \{ PUBLIC_API_ROUTES \} from "\.\/lib\/public-api-routes\.mjs";/.test(sec));
const block = sec.slice(sec.indexOf("PUBLIC TOKEN ROUTES, EVERY ONE"));
check(
  "C: and sends every token route no token and a wrong token, from the declaration rather than a list of its own",
  block.length > 0 &&
    /for \(const \[route, entry\] of Object\.entries\(PUBLIC_API_ROUTES\)\)/.test(block) &&
    /if \(entry\.kind !== "token"\) continue;/.test(block) &&
    /const noToken = await call\(null\);/.test(block) &&
    /const wrongToken = await call\("not-a-real-token"\);/.test(block),
);
check(
  "C: and requires the pair refused alike: never 2xx, the same status, the same body",
  /noToken\.status === wrongToken\.status/.test(block) && /noTokenBody === wrongTokenBody/.test(block) && /noToken\.status >= 400/.test(block),
);

console.log(wrong === 0 ? "PASS: every public API route is declared, and every token route is sent its pair." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
