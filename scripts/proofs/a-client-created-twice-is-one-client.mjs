/**
 * A CLIENT CREATED TWICE BY THE SAME PERSON IS ONE CLIENT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-client-created-twice-is-one-client.mjs
 *
 * BACKLOG.md, "create_client has no double-submit protection": the staff walk
 * of 2026-10-03 fired create_client twice and got two rows 0.6 seconds apart.
 * Driven through createClient, the function the route calls, on DEVELOPMENT
 * only, with a probe staff profile; every client it makes is swept by id and
 * the probe account by destroyProbes. The audit rows createClient writes are
 * permanent, as every live audit's are, because that table refuses deletes.
 *
 * It asserts both directions, because a guard that merged everything would
 * pass the first half: a repeat is one client, AND a different address, or a
 * different person, is still a second client.
 */
import { auditClient } from "../lib/db-target.mjs";
import { destroyProbes, PROBE_DOMAIN } from "../lib/portal-probe.mjs";
import { ProbeLedger } from "../lib/probe-ledger.mjs";

const LABEL = "client-double-submit";
const db = auditClient(LABEL, { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client, so nothing was measured.");
  process.exit(0);
}
const { createClient, SYSTEM_AUTHOR } = await import("../../src/lib/ops-crm.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ledger = new ProbeLedger(LABEL);

/*
 * A STAFF PROFILE WITH NO SESSION, made the way createProbe makes one before
 * it signs in, because nothing here needs a server. createProbe itself was
 * tried first and THREW on a dead base URL after the profile existed, leaving
 * an account behind; destroyProbes swept it, and this does not call it. Same
 * domain and is_demo, so destroyProbes sweeps these too.
 */
async function staffProbe(n) {
  const email = `probe-${Date.now()}-${n}-${LABEL}@${PROBE_DOMAIN}`;
  try {
    const { data, error } = await db.auth.admin.createUser({ email, password: `probe-${Date.now()}-${n}-${LABEL}`, email_confirm: true });
    if (error || !data?.user) return { id: null, fault: `creating the account was refused: ${error?.message ?? "no user"}` };
    const { error: pErr } = await db.from("eng_profiles").insert({
      id: data.user.id, email, display_name: `Audit Probe ${LABEL}`, role: "admin", status: "active", is_demo: true,
    });
    if (pErr) return { id: data.user.id, fault: `the profile insert was rejected: ${pErr.message}` };
    return { id: data.user.id, email, fault: null };
  } catch (err) {
    return { id: null, fault: `threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}
const one = await staffProbe(1);
const two = await staffProbe(2);
try {
  if (one.fault || two.fault) {
    console.log(`COULD NOT TELL: a probe staff profile could not be made (${one.fault ?? two.fault ?? "no id"})`);
    process.exitCode = 0;
  } else {
    const actor = (p) => ({ id: p.id, role: "admin", status: "active", email: p.email });
    const stamp = `${Date.now()}`;
    const name = `Probe Client ${stamp}, not a real person`;
    const email = `probe-client-${stamp}@audit-probe.invalid`;
    const input = { kind: "individual", name, email };

    const a = await createClient(actor(one), input);
    const b = await createClient(actor(one), input);
    for (const r of [a, b]) if (r.ok) ledger.made("eng_clients", r.id);
    check("the same person creating the same client twice gets one client", a.ok && b.ok && a.id === b.id, a.ok ? a.id : a.error);

    const { count } = await db.from("eng_clients").select("id", { count: "exact", head: true }).eq("name", name);
    check("and one row exists, read back from the table", count === 1, `${count} row(s) named ${name.slice(0, 26)}...`);

    const c = await createClient(actor(one), { ...input, email: `other-${email}` });
    if (c.ok) ledger.made("eng_clients", c.id);
    check("a different address with the same name is a second client", c.ok && c.id !== a.id, "a household and a landlord are both real");

    const d = await createClient(actor(two), input);
    if (d.ok) ledger.made("eng_clients", d.id);
    check("a different person creating the same client is not merged into the first", d.ok && d.id !== a.id, "only a person's own repeat is caught");

    const e = await createClient(actor(one), { kind: "individual", name: `${name} no address` });
    const f = await createClient(actor(one), { kind: "individual", name: `${name} no address` });
    for (const r of [e, f]) if (r.ok) ledger.made("eng_clients", r.id);
    check("with no address, a repeat is still one client", e.ok && f.ok && e.id === f.id);

    /* A PREMISE, not a test of the guard: the guard skips an author with no id, and this says the system author is one. */
    check("premise: the system author has no id, so checkout's creates are outside the guard", SYSTEM_AUTHOR.id === null);
  }
} finally {
  const swept = await ledger.sweep();
  const probes = await destroyProbes(LABEL);
  check("every client this run made is gone", swept.ok, swept.note || "swept by id");
  check("and the probe accounts", probes.ok, probes.note || `left ${probes.left}`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a client created twice by the same person is one client, and nothing else is merged.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
