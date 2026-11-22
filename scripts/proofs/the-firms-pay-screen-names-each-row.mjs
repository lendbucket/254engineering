// @runtime react-server
/**
 * PROOF: THE FIRM'S PAY SCREEN NAMES WHOSE PAY EACH ROW IS, AND SAYS SO WHEN
 * THE NAMES COULD NOT BE READ.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-firms-pay-screen-names-each-row.mjs
 *
 * Robert's answer 9 of 2026-11-21 (issue #1, 7072967992), on Q10 of the
 * morning of 2026-10-15: the administrator's Pay screen lists every
 * technician's ledger rows, and no row said whose it was.
 *
 * Two halves:
 *   A  techNamesRead, run against a stub PostgREST held here that refuses an
 *      in() list past 150 ids and never answers more than 1,000 rows, as the
 *      real transport does: 400 technicians are all named, an id with no profile
 *      maps to nothing, and a failed read is null, never a partial map.
 *   B  the screen's source: the firm's view reads the names, leads each row with
 *      its technician, says once when the names could not be read, and a
 *      technician's own view reads no names at all.
 * No request leaves this process.
 */
import { readFileSync } from "node:fs";

const profiles = [];
let failing = false;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const json = { "content-type": "application/json" };
  if (failing) return new Response(JSON.stringify({ message: "stub failure", code: "XX000" }), { status: 500, headers: json });
  let rows = [...profiles];
  const inParam = url.searchParams.get("id");
  if (inParam?.startsWith("in.")) {
    const values = inParam.slice(inParam.indexOf("(") + 1, inParam.lastIndexOf(")")).split(",").map((v) => v.replace(/^"|"$/g, ""));
    if (values.length > 150) return new Response(JSON.stringify({ message: "stub: in() past the cliff" }), { status: 400, headers: json });
    rows = rows.filter((r) => values.includes(r.id));
  }
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const asked = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + Math.min(asked, 1000));
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if ((init.method ?? "GET").toUpperCase() === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { techNamesRead } = await import("../../src/lib/ops-field.ts");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
};
const uuid = (i) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`;

console.log("A  the names behind the rows");
for (let i = 0; i < 400; i += 1) profiles.push({ id: uuid(i), display_name: `Technician ${i}` });
const ids = profiles.map((p) => p.id).concat([uuid(999)]);
const names = await techNamesRead([...ids, ...ids.slice(0, 50)]);
check("it answers past the 150-id cliff", names !== null);
check("every one of 400 technicians is named", names !== null && profiles.every((p) => names.get(p.id) === p.display_name), `${names?.size ?? 0} names`);
check("an id with no profile maps to nothing, for the screen to say so", names !== null && !names.has(uuid(999)));
check("no ids is an empty map, not a read", (await techNamesRead([]))?.size === 0);
failing = true;
const failed = await techNamesRead([uuid(1)]);
failing = false;
check("a failed read is null, never a partial map", failed === null);

console.log("B  the screen");
const page = readFileSync("src/app/portal/(app)/pay/page.tsx", "utf8");
check("the firm's view reads the names, and a technician's view reads none", /const firmView = copy === FIRM_COPY;/.test(page) && /firmView \? await techNamesRead\(/.test(page));
check("each row leads with whose pay it is", /data-pay-person[\s\S]{0,200}\{whose\(row\.tech_id\)\}/.test(page));
check("a row with no profile name says so", /A technician with no profile name on file/.test(page));
check("a failed read is said once, above the list", /firmView && names === null && rows\.length > 0/.test(page) && /names could not be read/.test(page));

console.log("");
if (failures === 0) {
  console.log("PASS: the firm's pay screen names whose pay each row is, and says so when it cannot.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failures} check(s).`);
  process.exitCode = 1;
}
