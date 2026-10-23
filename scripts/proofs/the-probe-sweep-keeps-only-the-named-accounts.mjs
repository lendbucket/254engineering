/**
 * THE PROBE SWEEP KEEPS EXACTLY THE NAMED ACCOUNTS, AND A THIRD UNDELETABLE
 * PROBE STILL TURNS IT RED.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-probe-sweep-keeps-only-the-named-accounts.mjs
 *
 * Operator ruling of 2026-10-23: the design-addendum walk's two engineers,
 * held by records that refuse deletion, are kept by design, counted and named
 * in the sweep's output, and any other leftover probe still fails; the one
 * permanent fixture engineer is on the same list. "Prove the sweep still goes
 * red on a third undeletable probe."
 *
 * WHY A FAKE CLIENT, said as in a-customer-teardown-that-cannot-delete-says-so:
 * making a real undeletable probe on development to prove this would be the
 * very silt the ruling stops. The REAL destroyProbes runs, against an
 * in-memory database whose deletes refuse for the accounts named, and every
 * delete it attempts is recorded, so the proof can say what it tried as well
 * as what it returned. What proves the real refusal still happens is the
 * board's own sweep, which names the kept accounts on every run.
 */
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const probe = await import("../lib/portal-probe.mjs");
const { destroyProbes, __setProbeClientForTests, KEPT_PROBES, FIXTURE_ENGINEER_EMAIL, PROBE_DOMAIN } = probe;

/* The list is the ruling, pinned as literals here and never read back to compare with itself. */
const RULED_IDS = ["bf376756-f8c4-4525-9eef-ca2492b6c6aa", "3b09b3a2-b6e6-43ad-ab7b-dcc4f041ebbe"];
check(
  "the kept list is exactly the two walk engineers and the fixture",
  KEPT_PROBES.length === 3 &&
    RULED_IDS.every((id) => KEPT_PROBES.some((k) => k.id === id)) &&
    KEPT_PROBES.some((k) => k.email === `fixture-engineer@${PROBE_DOMAIN}`) &&
    FIXTURE_ENGINEER_EMAIL === `fixture-engineer@${PROBE_DOMAIN}`,
  KEPT_PROBES.map((k) => k.id ?? k.email).join(", "),
);

const FIXTURE_ID = "f1f1f1f1-0000-4000-8000-000000000001";
const THIRD = "d3d3d3d3-0000-4000-8000-000000000003";
const ORDINARY = "0a0a0a0a-0000-4000-8000-00000000000a";

/** An in-memory database: profiles and auth users on the domain; deletes refuse for `pinned`. */
function fakeDb({ accounts, pinned }) {
  const profiles = new Map(accounts.map((a) => [a.id, { id: a.id, email: a.email }]));
  const users = new Map(accounts.map((a) => [a.id, { id: a.id, email: a.email }]));
  const deletes = [];
  const query = (table) => {
    const q = {
      _op: "select",
      _filter: null,
      select() { return q; },
      delete() { q._op = "delete"; return q; },
      like(col, pattern) { q._filter = { kind: "like", col, pattern }; return q; },
      eq(col, value) { q._filter = { kind: "eq", col, value }; return q; },
      then(resolve) {
        if (q._op === "delete") {
          deletes.push({ table, ...q._filter });
          if (table === "eng_profiles" && !pinned.has(q._filter.value)) profiles.delete(q._filter.value);
          return resolve({ error: null });
        }
        if (table === "eng_profiles") {
          const suffix = q._filter.pattern.replace(/^%/, "");
          return resolve({ data: [...profiles.values()].filter((p) => p.email.endsWith(suffix)), error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return q;
  };
  return {
    deletes,
    from: query,
    auth: {
      admin: {
        listUsers: async ({ page }) => ({ data: { users: page === 1 ? [...users.values()] : [] }, error: null }),
        deleteUser: async (id) => {
          deletes.push({ table: "auth.users", value: id });
          if (pinned.has(id)) return { error: { message: "Database error deleting user" } };
          users.delete(id);
          return { error: null };
        },
      },
    },
  };
}

const named = [
  { id: RULED_IDS[0], email: `addendum-walk-engineer-mvkcsn41@${PROBE_DOMAIN}` },
  { id: RULED_IDS[1], email: `addendum-walk-engineer-mvkcv2q2@${PROBE_DOMAIN}` },
  { id: FIXTURE_ID, email: FIXTURE_ENGINEER_EMAIL },
];

/* 1. Only the named accounts and an ordinary probe: green, the three kept and named, the ordinary one gone. */
{
  const db = fakeDb({ accounts: [...named, { id: ORDINARY, email: `probe-1@${PROBE_DOMAIN}` }], pinned: new Set(named.map((a) => a.id)) });
  __setProbeClientForTests(db);
  const r = await destroyProbes("proof");
  check("with only the named accounts left, the sweep is green", r.ok === true && r.left === 0, r.note);
  check("and it names all three as kept by design", (r.kept ?? []).length === 3 && named.every((a) => r.note.includes(a.id)), r.note.slice(0, 140));
  check("it never attempts to delete a kept account", !db.deletes.some((d) => named.some((a) => a.id === d.value)));
  check("and an ordinary probe is still deleted", db.deletes.some((d) => d.table === "auth.users" && d.value === ORDINARY));
}

/* 2. A third account that refuses deletion, not on the list: red, and named. */
{
  const third = { id: THIRD, email: `addendum-walk-engineer-third@${PROBE_DOMAIN}` };
  const db = fakeDb({ accounts: [...named, third], pinned: new Set([...named.map((a) => a.id), THIRD]) });
  __setProbeClientForTests(db);
  const r = await destroyProbes("proof");
  check("a third undeletable probe turns the sweep red", r.ok === false, r.note.slice(0, 160));
  check("and the red names it, as left behind and as refused", r.note.includes(`deleteUser refused: ${THIRD}`) && /left behind on/.test(r.note));
  check("while the three named stay kept, not counted against it", (r.kept ?? []).length === 3 && r.left === 2, `left ${r.left}: the third's profile and auth user`);
}

/* 3. The same address as a kept account but a different id is not kept by the id entries. */
{
  const impostor = { id: "e5e5e5e5-0000-4000-8000-000000000005", email: `addendum-walk-engineer-mvkcsn41@${PROBE_DOMAIN}` };
  const db = fakeDb({ accounts: [impostor], pinned: new Set([impostor.id]) });
  __setProbeClientForTests(db);
  const r = await destroyProbes("proof");
  check("a walk engineer's address on another id is not kept: the list names ids", r.ok === false, r.note.slice(0, 120));
}

__setProbeClientForTests(null);
console.log("");
if (wrong === 0) {
  console.log("PASS: the sweep keeps exactly the named accounts, and any other leftover still fails.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
