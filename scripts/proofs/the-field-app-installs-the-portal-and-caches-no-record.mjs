/**
 * THE FIELD APP INSTALLS THE PORTAL, AND ITS WORKER CACHES NO RECORD.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-field-app-installs-the-portal-and-caches-no-record.mjs
 *
 * Mobile phase 1, Robert's mobile plan rulings (ruling 13 of 2026-10-27): make
 * the portal installable, a service worker for the technician screens only, and
 * no offline writes yet. Four properties, each a way the phase could quietly be
 * something else:
 *   1. The portal names the field app's manifest, and nothing outranks it. A
 *      src/app/manifest.ts would, because file-based metadata beats every
 *      layout, so its absence is asserted.
 *   2. The field manifest opens on the jobs, inside the portal, and its icons
 *      exist. The site's manifest is unchanged: it still opens on the home page.
 *   3. The worker, RUN against simulated requests, answers only GETs for the
 *      build's static files. A page, an API call and a POST all go to the
 *      network untouched, so no job, photograph or address is ever cached and
 *      nothing is written offline.
 *      SINCE ROBERT'S T2 (2026-11-07, answer 1 of 6717223376): it also keeps
 *      ONE page, the offline screen, which renders nothing from the database,
 *      and shows it in place of a jobs screen only when the network fails. So
 *      3 now also asserts: a navigation that reaches the network is passed
 *      through and nothing is cached from it; the only thing ever put into the
 *      shell cache is the offline screen; and with the network down a jobs
 *      navigation is answered with that kept screen. The day's jobs live in
 *      IndexedDB, never in a worker cache.
 *   4. It is registered from the jobs layout alone, with the scope its header
 *      allows and no wider.
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const SCOPE = "/portal/jobs";

console.log("1. The portal names the field app's manifest");
check("no src/app/manifest.ts, which as file-based metadata would outrank the portal's layout", !existsSync("src/app/manifest.ts"));
const portalLayout = readFileSync("src/app/portal/layout.tsx", "utf8");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
check("the portal layout names /field-app.webmanifest", /manifest:\s*"\/field-app\.webmanifest"/.test(portalLayout));
check("the root layout names the site's /manifest.webmanifest", /manifest:\s*"\/manifest\.webmanifest"/.test(rootLayout));

console.log("2. The two manifests");
const field = await (await (await import("../../src/app/field-app.webmanifest/route.ts")).GET()).json();
const site = await (await (await import("../../src/app/manifest.webmanifest/route.ts")).GET()).json();
check("the field app opens on the jobs", field.start_url === SCOPE, field.start_url);
check("inside the portal", field.scope === "/portal", field.scope);
check("as a standalone window", field.display === "standalone", field.display);
check("its name is the firm's, never 'Services'", field.name.startsWith("254 Engineering") && !/Services/.test(field.name), field.name);
const missing = field.icons.map((i) => i.src).filter((src) => !existsSync(`public${src}`) && !existsSync(`src/app${src}`));
check("every icon it names exists", missing.length === 0, missing.join(", ") || `${field.icons.length} icons`);
check("the site's manifest still opens on the home page, scope /", site.start_url === "/" && site.scope === "/", `${site.start_url} ${site.scope}`);

console.log("3. The worker, run against simulated requests");
const swResponse = (await import("../../src/app/field-sw.js/route.ts")).GET();
check("its header allows exactly the jobs scope", swResponse.headers.get("Service-Worker-Allowed") === SCOPE, swResponse.headers.get("Service-Worker-Allowed"));
check("it is served as JavaScript", /javascript/.test(swResponse.headers.get("Content-Type") ?? ""));
const source = await swResponse.text();

const listeners = {};
const answered = [];
const fakeSelf = {
  location: { origin: "https://254engineering.com" },
  addEventListener: (type, fn) => { listeners[type] = fn; },
  skipWaiting: () => {},
  clients: { claim: () => Promise.resolve() },
};
const fakeCaches = {
  open: async () => ({ match: async () => undefined, put: async () => {} }),
  keys: async () => [],
  delete: async () => true,
};
new Function("self", "caches", "fetch", source)(fakeSelf, fakeCaches, async () => new Response("ok"));
check("it listens for fetch", typeof listeners.fetch === "function");
const tryRequest = (method, path) => {
  let responded = false;
  listeners.fetch({ request: new Request(`https://254engineering.com${path}`, { method }), respondWith: () => { responded = true; } });
  answered.push(`${method} ${path}: ${responded ? "cached" : "network"}`);
  return responded;
};
check("a build file is answered from the cache", tryRequest("GET", "/_next/static/chunks/app.js") === true);
check("a jobs page goes to the network", tryRequest("GET", "/portal/jobs/123") === false);
check("an API read goes to the network", tryRequest("GET", "/api/portal/jobs?mine=1") === false);
check("a POST goes to the network, so nothing is written offline", tryRequest("POST", "/api/portal/jobs") === false);
check("a POST to a static path is not answered either", tryRequest("POST", "/_next/static/chunks/app.js") === false);
check("another origin goes to the network", (() => {
  let responded = false;
  listeners.fetch({ request: new Request("https://example.com/_next/static/x.js"), respondWith: () => { responded = true; } });
  return !responded;
})());

/*
 * T2: run the worker again against a cache that records every put, and a
 * network that can be switched off. A navigation is a plain object, because a
 * Request cannot be constructed with mode "navigate".
 */
const puts = [];
const shellBody = "<html>offline screen</html>";
let networkUp = true;
const recordingCaches = {
  open: async (name) => ({
    match: async (key) => (name === "field-shell-v1" && key === "/portal/jobs/offline" ? new Response(shellBody) : undefined),
    put: async (key) => { puts.push(`${name} ${typeof key === "string" ? key : new URL(key.url).pathname}`); },
  }),
  keys: async () => [],
  delete: async () => true,
};
const t2 = {};
new Function("self", "caches", "fetch", source)(
  { ...fakeSelf, addEventListener: (type, fn) => { t2[type] = fn; } },
  recordingCaches,
  async () => {
    if (!networkUp) throw new TypeError("Failed to fetch");
    return new Response("<html>live job page</html>", { status: 200 });
  },
);
const navigate = async (path) => {
  let answer = null;
  t2.fetch({
    request: { method: "GET", url: `https://254engineering.com${path}`, mode: "navigate" },
    respondWith: (p) => { answer = p; },
  });
  return answer ? await answer : null;
};
const settle = () => new Promise((r) => setTimeout(r, 0));

networkUp = true;
const online = await navigate("/portal/jobs/2b7c0b8e-0000-4000-8000-000000000001");
await settle();
check("T2: with signal, a jobs navigation gets the live page", online !== null && (await online.text()) === "<html>live job page</html>");
check("T2: and nothing from it is cached", puts.length === 0, puts.join(", "));

await navigate("/portal/jobs/offline");
await settle();
check("T2: the offline screen is the one page kept, in the shell cache", puts.length === 1 && puts[0] === "field-shell-v1 /portal/jobs/offline", puts.join(", "));

networkUp = false;
const down = await navigate("/portal/jobs/2b7c0b8e-0000-4000-8000-000000000001");
check("T2: with no signal, a jobs navigation is answered with the kept offline screen", down !== null && (await down.text()) === shellBody);
let other = null;
t2.fetch({ request: { method: "GET", url: "https://254engineering.com/portal/files", mode: "navigate" }, respondWith: (p) => { other = p; } });
check("T2: a navigation outside the jobs screens is never answered", other === null);
check("T2: the shell cache's name is the one sign out clears", readFileSync("src/lib/field-day-store.ts", "utf8").includes('FIELD_SHELL_CACHE = "field-shell-v1"'));

console.log("4. Registered from the jobs screens alone");
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
  .split("\n").filter((f) => /\.(ts|tsx)$/.test(f));
const registering = files.filter((f) => readFileSync(f, "utf8").includes("serviceWorker.register"));
check("one file registers a service worker", registering.length === 1 && registering[0] === "src/components/portal/FieldAppWorker.tsx", registering.join(", "));
const worker = readFileSync("src/components/portal/FieldAppWorker.tsx", "utf8");
check("it registers /field-sw.js with the jobs scope", worker.includes(`register("/field-sw.js", { scope: "${SCOPE}" })`));
/* An import, not a mention: the worker's own route names the component in a comment. */
const mounting = files.filter((f) => /import\s*\{[^}]*\bFieldAppWorker\b[^}]*\}\s*from/.test(readFileSync(f, "utf8")));
check("only the jobs layout mounts it", mounting.length === 1 && mounting[0] === "src/app/portal/(app)/jobs/layout.tsx", mounting.join(", "));

console.log(`  (${answered.join("; ")})`);
console.log(wrong === 0 ? "\nPASS: the field app installs the portal, and its worker caches no record." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
