/**
 * WHEN A DELETE FAILS, THE TEARDOWN DISABLES WHAT IT COULD NOT REMOVE, AND SAYS
 * SO.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-probe-that-cannot-be-deleted-cannot-sign-in.mjs
 *
 * Operator ruling, 2026-10-02: check every delete's error, disable what cannot be
 * deleted, verify against `eng_partner_users`, and add an injection test where a
 * delete fails.
 *
 * WHAT WENT WRONG, because the test is shaped by it. `destroyPartnerProbes`
 * deleted tokens, then users, then the partner. The token and USER deletes had no
 * error check. `eng_partner_acceptances` references the partner and is append
 * only, so the partner delete fails by design. The verification then counted
 * `eng_partners`.
 *
 * The result was a partner USER with a password, able to sign in, reported as
 * "1 probe partner left behind", which reads like a stray row. Three board
 * audits caught it; the teardown's own return value did not.
 *
 * WHY THIS IS A FAKE CLIENT AND NOT A DATABASE. The failure under test is a
 * delete being REFUSED. Reproducing that against the real database means either
 * creating a partner and an acceptance, which is a write to an append only table
 * that can never be cleaned up, or waiting for the condition to recur. A client
 * whose deletes refuse on command reproduces the exact branch, costs nothing, and
 * leaves nothing behind.
 *
 * THAT IS A STATED LIMIT RATHER THAN A HIDDEN ONE. CLAUDE.md: a rule tested with
 * its input handed to it says nothing about the read that feeds it in production.
 * This proves the BRANCH is correct. What proves the real refusal still happens is
 * the board, where three audits assert the probe domain is clean, and they are
 * what caught this in the first place.
 *
 * SO BOTH DIRECTIONS ARE TESTED. A teardown that disabled everything and deleted
 * nothing would satisfy the refusal case perfectly and would leave a row behind on
 * every ordinary run, so the happy path is asserted too.
 */

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const PARTNER = "11111111-2222-3333-4444-555555555555";
const DOMAIN = "audit-probe.invalid";

/**
 * A Supabase-shaped client whose deletes refuse for the tables named.
 *
 * It records every call, so the test can assert what was ATTEMPTED as well as
 * what came back. The old code's defect was invisible from the return value and
 * visible in what it did not check, which is exactly what a call log shows.
 */
function fakeClient({ refuseDeleteOn = [], refuseUpdateOn = [] } = {}) {
  const calls = [];
  const rows = {
    eng_partners: [{ id: PARTNER, status: "active", contact_email: `p@${DOMAIN}` }],
    eng_partner_users: [
      { id: "user-1", partner_id: PARTNER, status: "active", password_hash: "a-hash", email: `u@${DOMAIN}` },
    ],
    eng_partner_tokens: [],
  };

  const table = (name) => {
    const api = {
      _op: null,
      _patch: null,
      select() {
        api._op = "select";
        return api;
      },
      delete() {
        api._op = "delete";
        return api;
      },
      update(patch) {
        api._op = "update";
        api._patch = patch;
        return api;
      },
      like() {
        return api._settle();
      },
      eq() {
        return api._settle();
      },
      _settle() {
        calls.push({ table: name, op: api._op, patch: api._patch });
        if (api._op === "delete") {
          if (refuseDeleteOn.includes(name)) {
            return Promise.resolve({ data: null, error: { message: `${name} is append only. DELETE is not permitted on it.` } });
          }
          rows[name] = [];
          return Promise.resolve({ data: null, error: null });
        }
        if (api._op === "update") {
          if (refuseUpdateOn.includes(name)) {
            return Promise.resolve({ data: null, error: { message: `${name} refused the update` } });
          }
          rows[name] = (rows[name] ?? []).map((r) => ({ ...r, ...api._patch }));
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: rows[name] ?? [], error: null });
      },
      then(resolve, reject) {
        return api._settle().then(resolve, reject);
      },
    };
    return api;
  };

  return { from: table, _calls: calls, _rows: rows };
}

/*
 * The function under test takes its client from a module level factory, so it is
 * exercised through a small reimplementation of its body rather than imported.
 * That is a real limit and it is stated: this proves the SHAPE the operator
 * ruled for, and `scripts/lib/portal-probe.mjs` must keep that shape. The board
 * is what proves the live behaviour.
 *
 * WHY NOT REFACTOR THE REAL ONE TO TAKE A CLIENT. Because that would change a
 * function every audit's teardown depends on, in the same commit as the fix to
 * it, which CLAUDE.md warns about: the hole a fix opens is found by verifying the
 * FIX. One change at a time.
 */
async function teardown(d) {
  const refused = [];
  const disabled = [];
  const ids = [PARTNER];

  for (const id of ids) {
    const { data: users } = await d.from("eng_partner_users").select("id").eq("partner_id", id);
    for (const u of users ?? []) {
      const { error: te } = await d.from("eng_partner_tokens").delete().eq("user_id", u.id);
      if (te) refused.push(`tokens: ${te.message}`);
    }
    const { error: ue } = await d.from("eng_partner_users").delete().eq("partner_id", id);
    if (ue) {
      refused.push(`users: ${ue.message}`);
      const { error: de } = await d
        .from("eng_partner_users")
        .update({ password_hash: null, password_salt: null, status: "suspended" })
        .eq("partner_id", id);
      if (de) refused.push(`could not disable: ${de.message}`);
      else disabled.push("user(s) suspended and password cleared");
    }
    const { error: pe } = await d.from("eng_partners").delete().eq("id", id);
    if (pe) {
      refused.push(pe.message);
      const { error: spe } = await d.from("eng_partners").update({ status: "suspended" }).eq("id", id);
      if (spe) refused.push(`could not suspend: ${spe.message}`);
      else disabled.push("partner suspended");
    }
  }

  const { data: partnersLeft } = await d.from("eng_partners").select("id, status").like("contact_email", "x");
  const { data: usersLeft } = await d
    .from("eng_partner_users")
    .select("id, status, password_hash")
    .like("email", "x");

  const liveUsers = (usersLeft ?? []).filter((u) => u.password_hash !== null || u.status !== "suspended");
  const activePartners = (partnersLeft ?? []).filter((p) => p.status !== "suspended");
  const left = liveUsers.length + activePartners.length;
  return { ok: left === 0, left, disabled, refused };
}

/* ------------------------------- 1. the ordinary run, where deletes succeed */

{
  const d = fakeClient();
  const r = await teardown(d);
  rec("an ordinary run deletes and reports clean", r.ok && r.left === 0, `left ${r.left}`);
  rec(
    "and it disabled nothing, because it did not need to",
    r.disabled.length === 0,
    r.disabled.length === 0 ? "nothing suspended" : `it suspended something it could have deleted: ${r.disabled.join(", ")}`,
  );
}

/* ------------- 2. the real failure: the partner cannot be deleted */

{
  const d = fakeClient({ refuseDeleteOn: ["eng_partners"] });
  const r = await teardown(d);
  rec("a refused partner delete is reported, not swallowed", r.refused.some((x) => /append only/.test(x)), r.refused[0] ?? "nothing was reported");
  rec("and the partner is suspended instead", r.disabled.includes("partner suspended"), r.disabled.join("; ") || "nothing disabled");
  rec(
    "and the run is still clean, because nothing can sign in",
    r.ok,
    r.ok ? "the user was deleted and the partner cannot authenticate" : `left ${r.left}`,
  );
}

/* --------- 3. the case that actually happened: the USER cannot be deleted */

{
  const d = fakeClient({ refuseDeleteOn: ["eng_partner_users", "eng_partners"] });
  const r = await teardown(d);
  rec(
    "a refused USER delete is reported, which the old code discarded entirely",
    r.refused.some((x) => /^users:/.test(x)),
    r.refused.find((x) => /^users:/.test(x)) ?? "the user delete failure was not reported",
  );
  rec(
    "and the password is cleared so it cannot sign in",
    d._rows.eng_partner_users.every((u) => u.password_hash === null && u.status === "suspended"),
    JSON.stringify(d._rows.eng_partner_users.map((u) => ({ status: u.status, hash: u.password_hash }))),
  );
  rec(
    "and the verdict is clean only because it cannot authenticate",
    r.ok && r.disabled.length === 2,
    `${r.disabled.join("; ")}`,
  );
}

/* ------- 4. and when even the disable fails, the run is NOT reported clean */

{
  const d = fakeClient({
    refuseDeleteOn: ["eng_partner_users", "eng_partners"],
    refuseUpdateOn: ["eng_partner_users"],
  });
  const r = await teardown(d);
  rec(
    "a probe that can still sign in is reported as left behind",
    !r.ok && r.left >= 1,
    r.ok ? "it reported clean over a live credential, which is the original defect" : `left ${r.left}`,
  );
  rec(
    "and it says it could not even disable it",
    r.refused.some((x) => /could not disable/.test(x)),
    r.refused.find((x) => /could not disable/.test(x)) ?? "it did not say so",
  );
}

/* ---- 5. the old shape is proved to fail, so this proof is not vacuous ---- */

/*
 * THE INJECTION. Without this, every check above passes on a teardown that never
 * had the bug. This runs the OLD body, which discarded the user delete error and
 * verified against partners alone, against the case that actually happened, and
 * requires it to report clean over a live credential. If it does not, the test
 * is not reproducing the defect and nothing above means anything.
 */
async function oldTeardown(d) {
  const refused = [];
  for (const id of [PARTNER]) {
    const { data: users } = await d.from("eng_partner_users").select("id").eq("partner_id", id);
    for (const u of users ?? []) await d.from("eng_partner_tokens").delete().eq("user_id", u.id);
    await d.from("eng_partner_users").delete().eq("partner_id", id);
    const { error } = await d.from("eng_partners").delete().eq("id", id);
    if (error) refused.push(error.message);
  }
  const { data } = await d.from("eng_partners").select("id").like("contact_email", "x");
  const left = (data ?? []).length;
  return { ok: left === 0, left, refused };
}

{
  const d = fakeClient({ refuseDeleteOn: ["eng_partner_users", "eng_partners"] });
  const r = await oldTeardown(d);
  const stillLive = d._rows.eng_partner_users.some((u) => u.password_hash !== null);
  rec(
    "the OLD teardown leaves a user with a password, which is the defect",
    stillLive,
    stillLive ? "its password was never cleared" : "the fixture is not reproducing the defect",
  );
  rec(
    "and the old teardown did not report it as clean, it reported the wrong thing",
    !r.ok && r.left === 1,
    `it said left=${r.left} counting partners, while a signed-in-capable user sat beside it`,
  );
}

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A probe that cannot be deleted cannot sign in, and a run that leaves one says so.`);
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks: ${failed.map((r) => r.name).join("; ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
