/**
 * PROOF: A FAILED READ IS SAID, NEVER DRAWN AS AN EMPTY STATE OR A COUNT, AND
 * A CAPPED LIST SAYS WHAT IT IS PART OF.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-failed-read-is-said-and-a-capped-list-says-what-it-is-part-of.mjs
 *
 * Robert's Q13 of 2026-11-02 (office audit F4, F7, F9, F10, F11, F12, F13):
 * "every failed read renders an error, never an empty state or a count;
 * messages scoped in SQL before the limit; uninvited applications from a
 * database query; error state copy says "a failed read, not an empty list"."
 *
 * The real reads run against a stub PostgREST that answers from tables held
 * here, honors offset and limit and the exact count header, and fails any one
 * table on demand. No request leaves this process.
 *
 *   F4   record search: a failed order read and a failed file read come back as
 *        errors, never as "no match"
 *   F7   the roles view: any of its three reads failing is a failed view, and a
 *        grant change refuses on it before touching a grant
 *   F9   the clients list reports its failure; the leads panel reads an exact
 *        count
 *   F10  a technician whose only conversation is older than 150 newer ones he
 *        may not read still sees it; a failed read is a failed read
 *   F11  the waiting partner material is the oldest 100 of an exact total
 *   F12  the uninvited applications are the exact difference of two tables
 *        read whole, not a filter over the newest 200
 *   F13  no error state in the portal says "Nothing here means"; each screen
 *        here renders its failure as an ErrorState
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const tables = {};
const failing = new Set();
const requests = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  requests.push({ method, table });
  const json = { "content-type": "application/json" };
  if (failing.has(table)) {
    return new Response(JSON.stringify({ message: `stub failure on ${table}`, code: "XX000" }), { status: 500, headers: json });
  }
  const rows = tables[table] ?? [];
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + limit);
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  if (method !== "GET") return new Response("[]", { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { readThreads, THREAD_PAGE } = await import("../../src/lib/ops-threads.ts");
const { rolesView, setGrants } = await import("../../src/lib/ops-roles.ts");
const { listClientsRead } = await import("../../src/lib/ops-crm.ts");
const { searchRecords } = await import("../../src/lib/ops-search.ts");
const { submissionsAwaitingDecision, SUBMISSION_QUEUE_SHOWN } = await import("../../src/lib/ops-partner-assets.ts");
const { listUninvitedApplications } = await import("../../src/lib/ops-onboarding.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const actor = (id, role, grants) => ({ id, role, status: "active", email: `${id}@proof.invalid`, displayName: id, grants: new Set(grants) });
const iso = (n) => new Date(Date.UTC(2026, 9, 1) + n * 60_000).toISOString();
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/* F10 --------------------------------------------------------------------- */
const tech = actor(uuid(9001), "field_tech", ["messages.use"]);
const channels = Array.from({ length: 150 }, (_, i) => ({ id: uuid(i + 1), kind: "channel", file_id: null, name: `Office ${i}`, channel_roles: ["admin"], last_message_at: iso(1000 - i), created_at: iso(0) }));
const direct = { id: uuid(500), kind: "direct", file_id: null, name: null, channel_roles: null, last_message_at: iso(10), created_at: iso(0) };
tables.eng_threads = [...channels, direct];
tables.eng_thread_participants = [{ thread_id: direct.id, profile_id: tech.id, last_read_at: null, eng_profiles: { display_name: "Tech", role: "field_tech" } }];
tables.eng_messages = [];
const threads = await readThreads(tech);
check("a conversation older than the newest 150 is still the technician's", threads.ok && threads.threads.length === 1 && threads.threads[0].id === direct.id, JSON.stringify(threads.ok ? threads.threads.map((t) => t.id) : threads));
check("and he is told how many he may read", threads.ok && threads.readableTotal === 1);
check("the page is THREAD_PAGE", THREAD_PAGE === 100);
failing.add("eng_threads");
const threadsFailed = await readThreads(tech);
check("a failed thread read is a failed read", threadsFailed.ok === false, JSON.stringify(threadsFailed));
failing.clear();
failing.add("eng_thread_participants");
const scopeFailed = await readThreads(tech);
check("and a failed read of who may read them is too", scopeFailed.ok === false, JSON.stringify(scopeFailed));
failing.clear();

/* F7 ---------------------------------------------------------------------- */
tables.eng_roles = [{ key: "admin", name: "Administrator", landing_path: "/portal", is_system: true, description: null }];
tables.eng_role_grants = [{ role_key: "admin", action: "roles.manage" }];
tables.eng_profiles = [{ id: uuid(1), display_name: "Owner", email: "owner@proof.invalid", role: "admin", status: "active" }];
const roles = await rolesView();
check("the roles view reads", roles.ok && roles.roles.length === 1 && roles.roles[0].grants.includes("roles.manage"));
for (const table of ["eng_roles", "eng_role_grants", "eng_profiles"]) {
  failing.add(table);
  const r = await rolesView();
  check(`a failed ${table} read is a failed view`, r.ok === false, JSON.stringify(r));
  failing.clear();
}
failing.add("eng_role_grants");
requests.length = 0;
const refused = await setGrants(actor(uuid(1), "admin", ["roles.manage"]), "admin", ["roles.manage"]);
check("a grant change refuses on a failed view", refused.ok === false && /could not be read/.test(refused.error), JSON.stringify(refused));
// Since 0111 (F8) the write is the function eng_set_role_grants, so a call to it counts as touching a grant.
check("and touches no grant", !requests.some((r) => (r.table === "eng_role_grants" || r.table.startsWith("rpc/eng_set_role_grants")) && r.method !== "GET" && r.method !== "HEAD"));
failing.clear();

/* F9 ---------------------------------------------------------------------- */
const office = actor(uuid(2), "admin", ["clients.list", "clients.create", "files.list", "orders.read", "payments.reconcile", "profiles.create", "partners.manage"]);
tables.eng_clients = [{ id: uuid(3), kind: "individual", name: "A Client" }];
const clients = await listClientsRead(office, {});
check("the clients list reads", clients.ok && clients.rows.length === 1);
failing.add("eng_clients");
const clientsFailed = await listClientsRead(office, {});
check("a failed clients read is a failed read, never no clients", clientsFailed.ok === false, JSON.stringify(clientsFailed));
failing.clear();

/* F4 ---------------------------------------------------------------------- */
tables.eng_files = [];
tables.eng_service_orders = [{ reference: "254-O2026-PROOF1", status: "paid", service_slug: "roof-inspections", customer_name: "C", customer_email: "c@proof.invalid", customer_phone: null, property_address: "1 Main", file_id: null, created_at: iso(1), is_demo: false }];
const found = await searchRecords(office, "proof");
check("a search reads orders and files", found.ok && found.orders?.length === 1 && found.ordersError === null && found.filesError === null, JSON.stringify(found.ok ? { o: found.orders?.length, oe: found.ordersError, fe: found.filesError } : found));
failing.add("eng_service_orders");
const noOrders = await searchRecords(office, "proof");
check("a failed order read is an error, never no order", noOrders.ok && noOrders.ordersError !== null && noOrders.orders === null);
failing.clear();
/*
 * With no client matching, the file search is the only reader of eng_files, so
 * this check is about the file search and not the files-by-client read (an
 * injection that dropped only the file search's error passed the first version).
 */
const someClients = tables.eng_clients;
tables.eng_clients = [];
failing.add("eng_files");
const noFiles = await searchRecords(office, "proof");
check("a failed file search is an error, never no file", noFiles.ok && /the file search/.test(noFiles.filesError ?? ""), JSON.stringify(noFiles.ok ? noFiles.filesError : noFiles));
failing.clear();
tables.eng_clients = someClients;
failing.add("eng_clients");
const noClientLookup = await searchRecords(office, "proof");
check("a failed client lookup behind the files is an error too", noClientLookup.ok && /the client lookup/.test(noClientLookup.filesError ?? ""), JSON.stringify(noClientLookup.ok ? noClientLookup.filesError : noClientLookup));
failing.clear();
failing.add("eng_files");
const noByClient = await searchRecords(office, "proof");
check("and so is a failed read of the files by client", noByClient.ok && /the files by client/.test(noByClient.filesError ?? ""), JSON.stringify(noByClient.ok ? noByClient.filesError : noByClient));
failing.clear();

/* F11 --------------------------------------------------------------------- */
tables.eng_partner_submissions = Array.from({ length: 120 }, (_, i) => ({ id: uuid(2000 + i), partner_id: uuid(7), kind: "wording", title: `Piece ${i}`, body: null, link: null, created_at: iso(i), decision_note: null }));
const queue = await submissionsAwaitingDecision();
check("the waiting material is the oldest 100 of an exact 120", queue.ok && queue.rows.length === SUBMISSION_QUEUE_SHOWN && queue.total === 120, JSON.stringify(queue.ok ? { n: queue.rows.length, total: queue.total } : queue));
failing.add("eng_partner_submissions");
const queueFailed = await submissionsAwaitingDecision();
check("a failed read of it is a failed read", queueFailed.ok === false);
failing.clear();

/* F12 --------------------------------------------------------------------- */
tables.eng_applications = Array.from({ length: 250 }, (_, i) => ({ id: uuid(3000 + i), created_at: iso(500 - i), site: "254", role: "field_technician", name: `Applicant ${i}`, email: `applicant${i}@proof.invalid`, status: "new" }));
tables.eng_onboardings = Array.from({ length: 10 }, (_, i) => ({ id: uuid(4000 + i), email: `applicant${i}@proof.invalid` }));
const uninvited = await listUninvitedApplications(office);
check("the uninvited are exactly 240 of 250, the oldest included", uninvited !== null && uninvited.length === 240 && uninvited.some((a) => a.name === "Applicant 249"), String(uninvited?.length));
failing.add("eng_onboardings");
check("a failed read of who was invited is null, never a list", (await listUninvitedApplications(office)) === null);
failing.clear();
failing.add("eng_applications");
check("and so is a failed read of the applications", (await listUninvitedApplications(office)) === null);
failing.clear();

/* F13 and the screens ------------------------------------------------------ */
const portal = "src/app/portal/(app)";
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) files.push(p);
  }
};
walk(portal);
const saying = files.filter((f) => /Nothing here means/.test(readFileSync(f, "utf8")));
check("no portal error state says \"Nothing here means\"", saying.length === 0, saying.join(", "));
const screen = (p) => readFileSync(join(portal, p), "utf8");
check("search renders each failed section as an error", /result\.ordersError !== null \? \(\s*<ErrorState/.test(screen("search/page.tsx")) && /result\.filesError !== null \? \(\s*<ErrorState/.test(screen("search/page.tsx")));
check("roles renders a failed view as an error and offers no boxes", /read\.ok \? \(\s*<RolesClient/.test(screen("roles/page.tsx")) && /<ErrorState/.test(screen("roles/page.tsx")));
check("clients renders a failed list and failed leads as errors", /!clientsRead\.ok \? \(\s*<ErrorState/.test(screen("clients/page.tsx")) && /leadsError !== null \? \(/.test(screen("clients/page.tsx")) && /count: "exact"/.test(screen("clients/page.tsx")));
check("messages renders a failed read as an error", /!threadsRead\.ok \? \(\s*<ErrorState/.test(screen("messages/page.tsx")));
check("partners renders a failed queue as an error", /!queue\.ok \? \(\s*<ErrorState/.test(screen("partners/page.tsx")));
check("a partner's page renders failed material as an error", /submissionsError !== null \? \(\s*<ErrorState/.test(screen("partners/[id]/page.tsx")) && /count: "exact"/.test(screen("partners/[id]/page.tsx")));

console.log(
  wrong === 0
    ? "PASS: a failed read is said on every screen named in office audit F4 to F13, the message list is scoped before its page, and a capped list says what it is part of."
    : `FAIL: ${wrong} check(s).`,
);
process.exitCode = wrong === 0 ? 0 : 1;
