/**
 * A DASHBOARD COUNTS ONLY THE THREADS ITS VIEWER MAY READ.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-dashboard-counts-only-threads-its-viewer-may-read.mjs
 *
 * Product audit, 2026-10-10, defect 17: the customer service dashboard's
 * "Threads by how long they have been quiet" counted every thread in the
 * table, other people's direct messages included, which are private even from
 * an administrator (7 against the viewer's 1). It now filters the full read by
 * canReadThread through threadsReadableBy, the rule the inbox applies.
 *
 * Measured from the dashboard itself, before and after, on development:
 * a direct thread between two OTHER people moves nothing; a direct thread the
 * viewer is in moves the count by one. Probes use @audit-probe.invalid.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the dashboard thread scope proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { dashboardFor } = await import("../../src/lib/ops-dashboard.ts");
const { destroyProbes } = await import("../lib/portal-probe.mjs");

const LABEL = "thread-scope-proof";
const STAMP = Date.now();
const threads = [];

async function probe(role) {
  const email = `${LABEL}-${role}-${STAMP}-${Math.random().toString(36).slice(2, 6)}@audit-probe.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, password: `p-${randomUUID()}`, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser ${role}: ${error?.message}`);
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: data.user.id, email, display_name: `Thread scope proof ${role}, not a real person`,
    role, status: "active", is_demo: true,
  });
  if (pErr) throw new Error(`profile ${role}: ${pErr.message}`);
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", data.user.id).single();
  const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", role);
  return { ...row, grants: new Set((grants ?? []).map((g) => g.action)) };
}

async function directBetween(a, b) {
  const { data, error } = await db
    .from("eng_threads")
    .insert({ kind: "direct", created_by: a.id, direct_key: [a.id, b.id].sort().join(":"), last_message_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error(`thread: ${error?.message}`);
  threads.push(data.id);
  const { error: tpErr } = await db.from("eng_thread_participants").insert([
    { thread_id: data.id, profile_id: a.id },
    { thread_id: data.id, profile_id: b.id },
  ]);
  if (tpErr) throw new Error(`participants: ${tpErr.message}`);
}

async function threadTotal(actor) {
  const dash = await dashboardFor(actor);
  const section = (dash?.breakdowns ?? []).find((b) => b.title === "Threads by how long they have been quiet");
  if (!section) return null;
  return section.rows.reduce((n, r) => n + (typeof r.count === "number" ? r.count : 0), 0);
}

try {
  const csr = await probe("customer_service");
  const a = await probe("dispatcher");
  const b = await probe("dispatcher");

  const before = await threadTotal(csr);
  check("the customer service dashboard has its thread section", before !== null, `role ${csr.role}`);

  await directBetween(a, b);
  const afterOthers = await threadTotal(csr);
  check(
    "a direct thread between two other people is not counted on the viewer's dashboard",
    afterOthers === before,
    `${before} before, ${afterOthers} after`,
  );

  await directBetween(csr, a);
  const afterOwn = await threadTotal(csr);
  check("a direct thread the viewer is in is counted, by one", afterOwn === (afterOthers ?? 0) + 1, `${afterOthers} then ${afterOwn}`);
} catch (err) {
  wrong += 1;
  console.log(`  FAIL: the proof could not run (${err instanceof Error ? err.message : String(err)})`);
} finally {
  if (threads.length) {
    const { error } = await db.from("eng_threads").delete().in("id", threads);
    if (error) console.log(`  note: ${threads.length} probe thread(s) not removed: ${error.message}`);
  }
  const swept = await destroyProbes(LABEL);
  if (!swept.ok) console.log(`  note: probe teardown: ${JSON.stringify(swept)}`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a dashboard counts only the threads its viewer may read.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
