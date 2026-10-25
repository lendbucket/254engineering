// @runtime react-server
//
// Declared because it imports src/lib/ops-docs.ts, which carries server-only.

/**
 * THE READ BEHIND EVERY MONEY TILE COVERS EVERY FILE, NOT THE NEWEST 500.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-margin-read-covers-every-file.mjs
 *
 * Robert's audit of 2026-10-24. fileMargins is the single read behind the
 * administrator's money tiles, the margin by period table, the billing screen
 * and two CSV exports. It stopped at 500 files with no count, so past 500 the
 * older periods' revenue and margin shrank silently. Here 1,200 priced files
 * are served by a fake PostgREST that honours offset and limit, as PostgREST
 * does; a read that stops at 500 cannot see the oldest 700.
 */
process.env.SUPABASE_URL = "http://margin-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "margin-proof-not-a-key";
delete process.env.VERCEL_ENV;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const FILES = [];
for (let i = 0; i < 1200; i += 1) {
  FILES.push({
    id: `f-${String(i).padStart(5, "0")}`, file_number: `254-PROOF-${i}`, property_address: "1 Proof Way", county: "Nueces", status: "delivered",
    service_slug: "roof-inspections", client_price_cents: 70900, tech_cost_cents: 20000, engineer_cost_cents: 15000, partner_id: null,
    delivered_at: "2026-10-01T12:00:00Z", created_at: new Date(Date.UTC(2026, 0, 1) + i * 3600_000).toISOString(),
  });
}
FILES.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
let failing = false;
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_files") {
    if (failing) return json({ message: "proof: the files read failed", code: "XX000" }, 500);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(1000, url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 1000);
    return json(FILES.slice(offset, offset + limit));
  }
  return json([]);
};

const { fileMargins } = await import("../../src/lib/ops-docs.ts");
const admin = { id: "admin-proof", role: "admin", status: "active", grants: new Set(["billing.read"]) };

const margins = await fileMargins(admin);
check("every one of 1,200 files is read, the oldest included", Array.isArray(margins) && margins.length === 1200, String(margins?.length));
check("and the oldest file is in it", Array.isArray(margins) && margins.some((m) => (m.fileNumber ?? m.file_number) === "254-PROOF-0"), "");
failing = true;
const failed = await fileMargins(admin);
check("a failed read is null, never a short or empty list", failed === null, JSON.stringify(failed)?.slice(0, 80));

console.log("");
if (wrong === 0) {
  console.log("PASS: the read behind every money tile covers every file, and a failed read is said.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
