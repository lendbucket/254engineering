/**
 * A ROLE'S GRANT SET IS REPLACED IN ONE ACT, OR NOT AT ALL.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-role-grant-set-is-replaced-in-one-act.mjs
 *
 * Robert's Q12 of 2026-11-02 (office audit F8): "setGrants becomes one SQL
 * function (stage branch)." Numbered 0111 by his ruling (a) of 2026-11-04.
 *
 * Before 0111, setGrants deleted every grant for a role and then inserted the
 * new set as two calls outside a transaction, so an insert that failed after
 * the delete left the role with no grants at all. For admin that is every
 * administrator locked out of everything, the roles screen included.
 *
 * TWO HALVES, BECAUSE EACH CAN BE RIGHT WHILE THE OTHER IS WRONG.
 *
 *   The database. Every migration replays into an in-process Postgres (PGlite,
 *   the engine migration-audit replays into), and the real function runs
 *   there. A proof-only trigger refuses one sentinel action, so the insert
 *   fails AFTER the delete has run inside the function. The role keeps every
 *   grant it had. The same failure written the old way, a delete and an insert
 *   as two statements, leaves the role with none, which is what shows the
 *   fixture can tell the two shapes apart.
 *
 *   The code. setGrants runs against a stub PostgREST that answers its reads
 *   and records its writes. It sends one call, to eng_set_role_grants, with the
 *   filtered and sorted list; it never deletes or inserts a grant itself; and a
 *   refusal from the function comes back as "The grants were not changed", with
 *   no audit row written for a change that did not happen.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------ the database */

const pg = new PGlite();
await pg.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await pg.exec(readSource(join(DIR, f)));
check("every migration replays, 0111 included", files.some((f) => f.startsWith("0111_")), `${files.length} files`);

const one = async (sql, params) => (await pg.query(sql, params)).rows[0];
const grantsOf = async (role) =>
  (await pg.query("select action from eng_role_grants where role_key = $1 order by action", [role])).rows.map((r) => r.action);
const refusal = async (sql, params) => {
  try {
    await pg.query(sql, params);
    return null;
  } catch (e) {
    return String(e?.message ?? e);
  }
};

check(
  "the function exists",
  (await one("select to_regprocedure('public.eng_set_role_grants(text, text[])') is not null as ok")).ok === true,
);
for (const who of ["anon", "authenticated"]) {
  check(
    `and ${who} cannot execute it`,
    (await one(`select has_function_privilege('${who}', 'public.eng_set_role_grants(text, text[])', 'execute') as ok`)).ok === false,
  );
}

const adminBefore = await grantsOf("admin");
check("the chain seeds the administrator's grants, so the failure below has something to lose", adminBefore.includes("roles.manage"), `${adminBefore.length} grants`);

/*
 * THE FAILURE. A trigger written only here refuses one sentinel action, which
 * makes the insert fail after the delete has already run inside the function.
 */
await pg.exec(`
  create function proof_refuse_sentinel() returns trigger language plpgsql as $f$
  begin
    if new.action = 'proof.refused' then raise exception 'proof: the insert fails here'; end if;
    return new;
  end $f$;
  create trigger proof_refuse_sentinel before insert on eng_role_grants
    for each row execute function proof_refuse_sentinel();
`);

const failed = await refusal("select eng_set_role_grants($1, $2)", ["admin", [...adminBefore, "proof.refused"]]);
check("an insert that fails inside the function is a refusal", failed !== null && /the insert fails here/.test(failed), failed ?? "it returned");
check(
  "and the administrator keeps every grant it had",
  JSON.stringify(await grantsOf("admin")) === JSON.stringify(adminBefore),
  `${(await grantsOf("admin")).length} of ${adminBefore.length}`,
);

/*
 * THE OLD SHAPE, SAME FAILURE. Two statements, each its own transaction, as
 * the two PostgREST calls were. The role is left with nothing. Throwaway
 * database, so the grants are put back afterwards for the checks below.
 */
await pg.query("delete from eng_role_grants where role_key = 'admin'");
const oldFailed = await refusal(
  "insert into eng_role_grants (role_key, action) select 'admin', a from unnest($1::text[]) a",
  [[...adminBefore, "proof.refused"]],
);
const oldLeft = await grantsOf("admin");
check(
  "while the same failure written the old way leaves the administrator with no grants",
  oldFailed !== null && oldLeft.length === 0,
  `${oldLeft.length} left`,
);
await pg.query("insert into eng_role_grants (role_key, action) select 'admin', a from unnest($1::text[]) a", [adminBefore]);
await pg.exec("drop trigger proof_refuse_sentinel on eng_role_grants; drop function proof_refuse_sentinel();");

/* THE ORDINARY CASE, AND THE REFUSALS THE FUNCTION ADDS. */
const target = ["clients.list", "pricing.read"];
const otherRole = (await one("select key from eng_roles where key <> 'admin' order by key limit 1")).key;
const otherBefore = await grantsOf(otherRole);
const replaced = (await one("select eng_set_role_grants($1, $2) as r", [otherRole, target])).r;
check(
  "a replacement sets exactly the new set",
  JSON.stringify(await grantsOf(otherRole)) === JSON.stringify(target),
  `${otherRole}: ${JSON.stringify(await grantsOf(otherRole))}`,
);
check(
  "and says what it was and what it is",
  JSON.stringify(replaced?.before) === JSON.stringify(otherBefore) && JSON.stringify(replaced?.after) === JSON.stringify(target),
  JSON.stringify(replaced),
);
check("the administrator is untouched by another role's change", JSON.stringify(await grantsOf("admin")) === JSON.stringify(adminBefore));

const emptied = (await one("select eng_set_role_grants($1, $2) as r", [otherRole, []])).r;
check("an empty set is allowed and empties the role", (await grantsOf(otherRole)).length === 0 && emptied?.after?.length === 0);

const noRole = await refusal("select eng_set_role_grants($1, $2)", ["no_such_role", ["clients.list"]]);
check("a role that does not exist is refused", noRole !== null && /no role/.test(noRole), noRole ?? "it returned");
const twice = await refusal("select eng_set_role_grants($1, $2)", [otherRole, ["clients.list", "clients.list"]]);
check("an action named twice is refused", twice !== null && /named twice/.test(twice), twice ?? "it returned");
const nulled = await refusal("select eng_set_role_grants($1, null)", [otherRole]);
check("a null list is refused", nulled !== null && /is null/.test(nulled), nulled ?? "it returned");
await pg.close();

/* ---------------------------------------------------------------- the code */

const tables = {
  eng_roles: [
    { key: "admin", name: "Administrator", landing_path: "/portal", is_system: true, description: null },
    { key: "read_only", name: "Read only", landing_path: "/portal", is_system: true, description: null },
  ],
  eng_role_grants: [
    { role_key: "admin", action: "roles.manage" },
    { role_key: "read_only", action: "clients.list" },
  ],
  eng_profiles: [
    { id: "00000000-0000-4000-8000-000000000001", display_name: "Owner", email: "owner@proof.invalid", role: "admin", status: "active" },
  ],
};
const requests = [];
let rpcAnswer = { status: 200, body: { before: ["clients.list"], after: ["clients.list", "pricing.read"] } };
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const path = url.pathname.split("/rest/v1/")[1] ?? "";
  let body = null;
  try {
    body = init.body ? JSON.parse(String(init.body)) : null;
  } catch {
    body = String(init.body);
  }
  requests.push({ method, path, body });
  const json = { "content-type": "application/json" };
  if (path === "rpc/eng_set_role_grants") {
    return new Response(JSON.stringify(rpcAnswer.body), { status: rpcAnswer.status, headers: json });
  }
  if (method !== "GET" && method !== "HEAD") return new Response("[]", { status: 201, headers: json });
  const rows = tables[path] ?? [];
  return new Response(JSON.stringify(rows), { status: 200, headers: { ...json, "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { setGrants } = await import("../../src/lib/ops-roles.ts");
const owner = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "admin",
  status: "active",
  email: "owner@proof.invalid",
  displayName: "Owner",
  grants: new Set(["roles.manage"]),
};
const writes = () => requests.filter((r) => r.method !== "GET" && r.method !== "HEAD");

requests.length = 0;
const changed = await setGrants(owner, "read_only", ["pricing.read", "clients.list", "pricing.read", "no.such.action"]);
const calls = writes().filter((r) => r.path === "rpc/eng_set_role_grants");
check("a grant change succeeds", changed.ok === true, JSON.stringify(changed));
check("and sends exactly one call to the function", calls.length === 1, `${calls.length} calls`);
check(
  "with the list filtered to real actions, without repeats, and sorted",
  JSON.stringify(calls[0]?.body) === JSON.stringify({ p_role_key: "read_only", p_actions: ["clients.list", "pricing.read"] }),
  JSON.stringify(calls[0]?.body),
);
check(
  "and deletes or inserts no grant itself",
  !writes().some((r) => r.path.startsWith("eng_role_grants")),
  JSON.stringify(writes().map((r) => `${r.method} ${r.path}`)),
);

requests.length = 0;
rpcAnswer = { status: 400, body: { message: "eng_set_role_grants: an action is named twice", code: "22023" } };
const refused = await setGrants(owner, "read_only", ["clients.list"]);
check(
  "a refusal from the function comes back as a refusal that says nothing changed",
  refused.ok === false && /The grants were not changed/.test(refused.error ?? ""),
  JSON.stringify(refused),
);
check(
  "and writes no audit row for a change that did not happen",
  writes().every((r) => r.path === "rpc/eng_set_role_grants"),
  JSON.stringify(writes().map((r) => `${r.method} ${r.path}`)),
);

/* ------------------------------------------------------------ the verdict */

if (wrong) {
  console.log(`FAIL: ${wrong} check(s) wrong. A role's grant set is not replaced in one act.`);
  process.exit(1);
}
console.log("PASS: a role's grant set is replaced in one act: a failed insert leaves every grant in place, and setGrants writes only through eng_set_role_grants.");
