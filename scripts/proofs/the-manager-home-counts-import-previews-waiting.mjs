// @runtime react-server
// Declared because it imports src/lib/staff-desk.ts, which carries server-only.
/**
 * PROOF: THE MANAGER'S HOME SCREEN COUNTS THE IMPORT PREVIEWS WAITING, AND ONLY
 * FOR THE PEOPLE WHO CAN PRESS WRITE.
 *
 * Robert's R2 answer 3 of 2026-11-02: "yes, a count of previews waiting on the
 * manager's home screen in R5." The desk (src/lib/staff-desk.ts) is the home
 * screen of the operations manager, and the administrator's dashboard carries
 * the desk's tiles as its "due" row, so one tile serves both.
 *
 *   A  a crm.import holder sees "Import previews waiting" with the exact count
 *      of runs in the previewed state, linking to /portal/crm/imports
 *   B  the count is asked of eng_crm_import_runs, status previewed, exactly
 *   C  a failed read is a null count with the reason, never zero
 *   D  a rep (crm.use without crm.import) sees no such tile
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-manager-home-counts-import-previews-waiting.mjs
 */
process.env.SUPABASE_URL = "http://desk-previews-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "desk-previews-proof-not-a-key";
delete process.env.VERCEL_ENV;

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const state = { previewed: 3, failRuns: false, asked: [] };
const json = (b, status = 200, headers = {}) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...headers } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  const method = (init.method ?? (typeof input === "object" && input.method) ?? "GET").toUpperCase();
  if (table === "eng_crm_import_runs") {
    state.asked.push({ method, search: url.search });
    if (state.failRuns) return json({ message: "the runs table timed out" }, 500);
    return new Response(null, { status: 200, headers: { "content-range": `*/${state.previewed}` } });
  }
  return json([], 200, { "content-range": "*/0" });
};

const { deskDashboard } = await import("../../src/lib/staff-desk.ts");

const actor = (grants) => ({ id: "00000000-0000-4000-8000-000000000001", role: "ops_manager", status: "active", email: "desk-proof@audit-probe.invalid", grants: new Set(grants) });
const manager = actor(["crm.use", "crm.import", "inbox.answer"]);
const rep = actor(["crm.use", "inbox.answer"]);

const tileOf = (d) => d.tiles.find((t) => t.label === "Import previews waiting");

const shown = await deskDashboard(manager);
const tile = tileOf(shown);
check("A: a crm.import holder sees the tile", Boolean(tile));
check("A: with the exact count of previewed runs", tile?.count === 3, `count ${tile?.count}`);
check("A: linking to the imports screen", tile?.href === "/portal/crm/imports", String(tile?.href));
check(
  "B: the count is asked of the previewed runs, exactly",
  state.asked.some((a) => /status=eq\.previewed/.test(a.search)),
  JSON.stringify(state.asked),
);

state.previewed = 0;
const none = tileOf(await deskDashboard(manager));
check("A: zero previews reads as zero, said plainly", none?.count === 0 && /No import is waiting/.test(none?.note ?? ""), `${none?.count} ${none?.note}`);

state.failRuns = true;
const failed = await deskDashboard(manager);
const failedTile = tileOf(failed);
check("C: a failed read is a null count, never zero", failedTile?.count === null, `count ${failedTile?.count}`);
check("C: and the reason is said", failed.notComputable.some((n) => /Import previews waiting could not be counted/.test(n)), failed.notComputable.join(" | "));
state.failRuns = false;

state.asked = [];
const repView = await deskDashboard(rep);
check("D: a rep sees no import previews tile", !tileOf(repView), repView.tiles.map((t) => t.label).join(", "));
check("D: and the runs table is not even asked", state.asked.length === 0, JSON.stringify(state.asked));

let failedCount = 0;
for (const x of out) {
  if (!x.ok) failedCount += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failedCount === 0
    ? "PASS: the manager's home screen counts the import previews waiting, exactly, says a failed read, and shows it only to the people who can press Write."
    : `FAIL: ${failedCount} check(s).`,
);
process.exitCode = failedCount === 0 ? 0 : 1;
