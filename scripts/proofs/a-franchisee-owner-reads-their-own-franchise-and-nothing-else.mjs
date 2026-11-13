/**
 * A FRANCHISEE OWNER READS THEIR OWN FRANCHISE, AND NOTHING ELSE (0127).
 * Robert's overnight orders of 2026-11-10, platform item X2, the franchisee
 * owner role, cut from X1 under his answer 1 of 2026-11-11.
 *
 *   A  the role, pinned as literals: it lands on /portal/franchise, is not a
 *      system role, and holds exactly three grants; none of them reaches work,
 *      money, another territory, another person, the record's controls or a
 *      price.
 *   B  the grant: franchise.read_own is admin's and the owner's and nobody
 *      else's, in DEFAULT_ROLES and in the seed, and the owner may be one of a
 *      franchisee's people.
 *   C  the scope, read in the code: the one function that reads an owner's
 *      franchise takes no id, finds the franchise by the reader's own live
 *      membership, and reads every other row through that franchise: its
 *      territories, their counties, its people, and the sales list companies
 *      and orders in its counties by the sales list's own county rule. It
 *      touches only the ten tables it names, returns no figure on any order
 *      row, reads no cost, pay or commission, and computes revenue as paid
 *      orders net of refunds by month (Robert's reading 4 of 2026-11-11). The
 *      page asks the same grant, takes two page numbers from the address and
 *      nothing else, and changes nothing.
 *   D  the seed, replayed: after 0127 the role exists with its second factor
 *      required, holds exactly its three grants, and franchise.read_own has
 *      exactly two holders.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/franchisee-rules.ts");
const own = await import("../../src/lib/own-franchise-rules.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");
const { NAV } = await import("../../src/components/portal/nav.ts");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------ A, the role */

const owner = DEFAULT_ROLES.find((r) => r.key === "franchisee_owner");
check("A: the franchisee owner is a declared role", Boolean(owner));
const grants = [...(owner?.grants ?? [])].sort();
check(
  "A: it holds exactly profiles.read_self, profiles.update_self and franchise.read_own",
  JSON.stringify(grants) === JSON.stringify(["franchise.read_own", "profiles.read_self", "profiles.update_self"]),
  grants.join(", "),
);
check("A: it lands on its own franchise", owner?.landingPath === "/portal/franchise", owner?.landingPath);
check("A: it is not a system role", owner?.isSystem === false);
check("A: creating one asks for nothing beyond a name and an email", Array.isArray(owner?.inviteFields) && owner.inviteFields.length === 0);
const FORBIDDEN = /^(files\.|orders\.|pricing\.|billing\.|ledger\.|payments\.|crm\.|reports\.|clients\.|offers\.|refunds\.|quotes\.|evidence\.|review\.)|^profiles\.list$|^franchise\.manage$|^roles\.manage$/;
const reached = (owner?.grants ?? []).filter((g) => FORBIDDEN.test(g));
check("A: no grant reaches work, money, another territory, another person, the record's controls or a price", reached.length === 0, reached.join(", "));

/* ----------------------------------------------------------------- B, the grant */

const holders = DEFAULT_ROLES.filter((r) => r.grants.includes("franchise.read_own")).map((r) => r.key).sort();
check("B: franchise.read_own is held by admin and franchisee_owner, nobody else", JSON.stringify(holders) === JSON.stringify(["admin", "franchisee_owner"]), holders.join(", "));
const manage = DEFAULT_ROLES.filter((r) => r.grants.includes("franchise.manage")).map((r) => r.key);
check("B: franchise.manage is still admin's alone", JSON.stringify(manage) === JSON.stringify(["admin"]), manage.join(", "));
check("B: an owner may be one of a franchisee's people", rules.mayBeMember("franchisee_owner"));
check("B: a technician and a rep still may, and an administrator still may not", rules.mayBeMember("field_tech") && rules.mayBeMember("rep") && !rules.mayBeMember("admin"));

const seed = readSource("supabase/migrations/0127_a_franchisee_owner_reads_their_own_franchise.sql");
check(
  "B: 0127 inserts the role landing on /portal/franchise, not system",
  /insert into eng_roles \(key, name, landing_path, is_system\) values\s+\('franchisee_owner', 'Franchisee Owner', '\/portal\/franchise', false\)\s+on conflict \(key\) do nothing;/.test(seed),
);
check("B: and requires its second factor", /update eng_roles set mfa_requirement = 'required' where key = 'franchisee_owner';/.test(seed));
check(
  "B: 0127 seeds exactly the owner's three grants and admin's franchise.read_own",
  /insert into eng_role_grants \(role_key, action\) values\s+\('franchisee_owner', 'profiles\.read_self'\),\s+\('franchisee_owner', 'profiles\.update_self'\),\s+\('franchisee_owner', 'franchise\.read_own'\),\s+\('admin', 'franchise\.read_own'\)\s+on conflict/.test(seed),
);
const grantLines = (seed.match(/\('[a-z_]+', '[a-z_.]+'\)/g) ?? []).length;
check("B: and no other grant row", grantLines === 4, String(grantLines));

/* ----------------------------------------------------------------- C, the scope */

const lib = readSource("src/lib/own-franchise.ts");
const signature = lib.match(/export async function ownFranchise\(([^)]*)\)/);
check("C: the owner's read takes the actor and nothing else", signature?.[1].trim() === "actor: Actor | null", signature?.[1]);
check("C: it asks franchise.read_own before it reads", /if \(!actor \|\| !can\(actor, "franchise\.read_own"\)\) return refuse\(/.test(lib));
const membership = lib.match(/\.from\("eng_franchisee_members"\)\s*\.select\("franchisee_id, created_at"\)\s*\.eq\("profile_id", actor\.id\)\s*\.is\("ended_at", null\)/);
check("C: the franchise is found by the reader's own live membership", Boolean(membership));
check("C: the franchisee row is read by that membership's franchise", /\.from\("eng_franchisees"\)\s*\.select\([^)]*\)\s*\.eq\("id", franchiseeId\)/.test(lib));
const tr = readSource("src/lib/territory-revenue.ts");
/*
 * THE FILTER IS READ IN THE CODE, NOT IN THE FILE. Found 2026-11-13 while
 * injecting demo-audit's franchise sweep: the check below matched
 * `.eq("is_demo", false)` anywhere in the file, so an injection that left the
 * old line in a comment and filtered with `.in("is_demo", [false, true])` passed
 * it. The code is now read with comments removed, the filter must sit on the
 * orders read itself, and no other is_demo condition may stand beside it.
 */
const trCode = tr.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
const ordersRead = trCode.match(/\.from\("eng_service_orders"\)\s*\.select\([^)]*\)([^;]*?)\.order\(/)?.[1] ?? "";
check("C: the orders read itself filters out demonstrations, in the code rather than a comment", /^\s*\.eq\("is_demo", false\)\s*$/.test(ordersRead), ordersRead.trim() || "no orders read found");
check("C: and no other is_demo condition stands in the code", (trCode.match(/is_demo/g) ?? []).length === 1, String((trCode.match(/is_demo/g) ?? []).length));
check("C: the owner's read hands the shared territory reader the franchise found by membership, and nothing else", /const territory = await territoryFacts\(db, franchiseeId\);/.test(lib) && (lib.match(/territoryFacts\(/g) ?? []).length === 1);
check("C: its territories are read by that franchise", /readEveryIn<[^>]*>\(franchiseeIds,[^;]*\.from\("eng_franchisee_territories"\)\s*\.select\("franchisee_id, territory_id"\)\s*\.in\("franchisee_id", \[\.\.\.chunk\]\)/s.test(tr) && /const many = await territoryFactsForMany\(db, \[franchiseeId\]\);/.test(tr));
check("C: its people are read by that franchise", /\.from\("eng_franchisee_members"\)\.select\("profile_id"\)\.eq\("franchisee_id", franchiseeId\)/.test(lib));
check("C: territory names are read only for the territories it holds", /readEveryIn<[^>]*>\(territoryIds,[^;]*\.from\("eng_crm_territories"\)\.select\("id, name"\)\.in\("id", \[\.\.\.chunk\]\)/s.test(lib));
check("C: counties are read only for the territories it holds", /readEveryIn<[^>]*>\(territoryIds,[^;]*\.from\("eng_crm_territory_counties"\)\s*\.select\("territory_id, county"\)\s*\.in\("territory_id", \[\.\.\.chunk\]\)/s.test(tr));
check("C: people are read only for its own members", /readEveryIn<[^>]*>\(memberIds,[^;]*\.from\("eng_profiles"\)\.select\("id, display_name, role"\)\.in\("id", \[\.\.\.chunk\]\)/s.test(lib));
check("C: sales list companies are read by name, county and stage only, no contact detail", /\.from\("eng_prospects"\)\.select\("id, company, county, stage"\)/.test(lib));
check("C: and only those in its counties are returned", /prospects: companies\.rows\s*\.filter\(\(p\) => inTerritory\(counties, p\.county\)\)/.test(lib));
check("C: orders are demonstration free, and each franchise keeps only those in its own counties", /\.eq\("is_demo", false\)/.test(tr) && /const theirs = all\.rows\.filter\(\(o\) => inTerritory\(anyCounties, o\.county\)\);/.test(tr) && /\.filter\(\(o\) => s\.counties\.has\(o\.county\)\)/.test(tr));
check("C: refunds are read only for its own orders", /readEveryIn<[^>]*>\(\s*theirs\.map\(\(o\) => String\(o\.id\)\),[^;]*\.from\("eng_order_payments"\)/s.test(tr));
const orderRow = lib.match(/orders: territory\.facts\.orders\.map\(\(o\) => \(\{([^}]*)\}\)\)/)?.[1] ?? "";
check("C: no order row it returns carries a figure", orderRow.length > 0 && !/cents|total|price/i.test(orderRow), orderRow.trim());
check("C: its revenue is computed by the shared rule, by month", /revenue: territory\.facts\.revenue,/.test(lib) && /revenue: revenueByMonth\(orders\)/.test(tr) && /import \{ inTerritory, revenueByMonth, type MonthRevenue \} from "\.\/own-franchise-rules"/.test(tr));
const tables = [...new Set([...(lib + tr).matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]))].sort();
const ALLOWED_TABLES = [
  "eng_crm_territories", "eng_crm_territory_counties", "eng_franchisee_members", "eng_franchisee_territories", "eng_franchisees",
  "eng_onboardings", "eng_order_payments", "eng_profiles", "eng_prospects", "eng_service_orders",
];
check("C: it touches the ten tables it names and no other", JSON.stringify(tables) === JSON.stringify(ALLOWED_TABLES), tables.join(", "));
const writes = (lib + tr).match(/\.(insert|update|upsert|delete)\(/g) ?? [];
check("C: it writes nothing", writes.length === 0, writes.join(", "));
check("C: it reads no email, phone or money column of a person", !/email|phone|cents|pay_|rate/.test(lib.match(/\.from\("eng_profiles"\)[^\n]*/)?.[0] ?? "x"));
check("C: it reads no cost, margin, pay or commission column of an order", !/cost|margin|pay|commission|engineer_|tech_/.test(tr.match(/\.from\("eng_service_orders"\)\s*\.select\("([^"]*)"\)/)?.[1] ?? "x"));

/* The rule it shares with the sales list, exercised. */
const owned = new Set(["Harris"]);
check("C: a county is in the territory however it is written", owned.size === 1 && own.inTerritory(owned, "harris county") && own.inTerritory(owned, " Harris "));
check("C: a county outside it, an unknown county and none are not", !own.inTerritory(owned, "Fort Bend") && !own.inTerritory(owned, "Gotham") && !own.inTerritory(owned, null));
const months = own.revenueByMonth([
  { status: "paid", totalCents: 50_000, refundedCents: 0, day: "2026-11-02" },
  { status: "complete", totalCents: 30_000, refundedCents: 10_000, day: "2026-11-20" },
  { status: "refunded", totalCents: 40_000, refundedCents: 40_000, day: "2026-11-21" },
  { status: "awaiting_payment", totalCents: 99_900, refundedCents: 0, day: "2026-11-22" },
  { status: "paid", totalCents: null, refundedCents: 0, day: "2026-10-05" },
]);
check(
  "C: revenue is paid orders net of refunds by month, newest first, with the refunded order counted and earning nothing",
  JSON.stringify(months) === JSON.stringify([
    { month: "2026-11", orders: 3, revenueCents: 70_000 },
    { month: "2026-10", orders: 1, revenueCents: null },
  ]),
  JSON.stringify(months),
);

const page = readSource("src/app/portal/(app)/franchise/page.tsx");
check("C: the page asks the same grant", /if \(!can\(actor, "franchise\.read_own"\)\) notFound\(\);/.test(page));
const fromAddress = [...new Set([...page.matchAll(/params\.([a-zA-Z]+)/g)].map((m) => m[1]))].sort();
check(
  "C: the page takes two page numbers from the address and nothing else",
  JSON.stringify(fromAddress) === JSON.stringify(["op", "pp"]) && /const op = pageOf\(params\.op\);/.test(page) && /const pp = pageOf\(params\.pp\);/.test(page),
  fromAddress.join(", "),
);
check("C: the page reads only through ownFranchise", /await ownFranchise\(actor\)/.test(page) && !/supabaseAdmin|from "@\/lib\/franchisees"/.test(page));
check("C: the page changes nothing", !/"use client"|<form|action=|fetch\(/.test(page));

/*
 * THE FOUR ONBOARDING STEPS, READ ONLY (Robert, 2026-11-12, from the walk's
 * screenshots). They come from the record's own reader, onboardingStepsFor,
 * which reads the agreement, the certificates, the people and the owners' and
 * technicians' standing; the ten-table scan above cannot see through it, so
 * what may leave is asserted here instead: the steps' key, label, whether met
 * and their sentence, and never a certificate, carrier or policy.
 */
check("C: the onboarding steps come from the record's own reader, by the franchise found by membership", /const onboarding = await onboardingStepsFor\(db, franchiseeId\);/.test(lib));
check(
  "C: and only each step's key, label, met and sentence leave the read",
  /onboarding: onboarding\.onboarding\.steps\.map\(\(s\) => \(\{ key: s\.key, label: s\.label, met: s\.met, says: s\.says \}\)\),/.test(lib) && !/onboarding\.onboarding\.certificates|agreementSignedOn/.test(lib),
);
check("C: the page shows the four steps under the status", /\{f\.onboarding\.map\(\(s\) =>/.test(page) && /title=\{FRANCHISEE_STATUS_LABEL\[f\.status\]\}/.test(page));
const nav = NAV.find((n) => n.href === "/portal/franchise");
check("C: the menu offers it on the same grant the page asks", nav?.action === "franchise.read_own", nav?.action);

/* ----------------------------------------------------------------- D, replayed */

const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const at = files.indexOf("0127_a_franchisee_owner_reads_their_own_franchise.sql");
check("D: 0127 is in the chain", at >= 0);
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));
const role = (await db.query("select landing_path, is_system, mfa_requirement from eng_roles where key = 'franchisee_owner'")).rows[0];
check("D: the role exists, landing on /portal/franchise, not system, its second factor required", role?.landing_path === "/portal/franchise" && role?.is_system === false && role?.mfa_requirement === "required", JSON.stringify(role));
const held = (await db.query("select action from eng_role_grants where role_key = 'franchisee_owner' order by action")).rows.map((r) => r.action);
check("D: it holds exactly its three grants", JSON.stringify(held) === JSON.stringify(["franchise.read_own", "profiles.read_self", "profiles.update_self"]), held.join(", "));
const readers = (await db.query("select role_key from eng_role_grants where action = 'franchise.read_own' order by role_key")).rows.map((r) => r.role_key);
check("D: franchise.read_own has exactly two holders", JSON.stringify(readers) === JSON.stringify(["admin", "franchisee_owner"]), readers.join(", "));
const again = await db.exec(readSource(join(DIR, files[at]))).then(() => "").catch((e) => String(e.message));
check("D: 0127 refuses to run twice", /expects no franchisee_owner role before it runs/.test(again), again || "it ran again");
await db.close();

console.log(wrong === 0 ? "PASS: a franchisee owner reads their own franchise, and nothing else." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
