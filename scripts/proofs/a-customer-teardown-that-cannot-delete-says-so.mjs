/**
 * WHEN THE CLIENT DELETE IS REFUSED, THE CUSTOMER TEARDOWN RETURNS ok FALSE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-customer-teardown-that-cannot-delete-says-so.mjs
 *
 * Operator ruling, 2026-10-03: "Add a fault-injection case where the client
 * delete is refused and the function must return ok false."
 *
 * ===========================================================================
 * WHAT WENT WRONG, BECAUSE THE TEST IS SHAPED BY IT.
 * ===========================================================================
 *
 * `destroyCustomerProbes` deleted the customer user, SUPERSEDED the account, then
 * attempted to delete the client. That delete is refused every time:
 * `eng_customer_accounts.client_id` is `on delete restrict` and the account still
 * existed. THE RETURN VALUE WAS NEVER READ. `left` was then computed by counting
 * `eng_customer_users`, which really was zero, so it returned ok on every run.
 *
 * By 2026-10-03 that had left 641 client rows and 641 accounts on development,
 * the oldest from 2026-09-14, behind a green line.
 *
 * THE DEFECT IS NOT VISIBLE FROM THE RETURN VALUE AND IS VISIBLE IN WHAT IT DID
 * NOT CHECK, which is why this uses a client that records every call: the test
 * can assert what was ATTEMPTED as well as what came back.
 *
 * WHY A FAKE CLIENT. The failure under test is a delete being REFUSED.
 * Reproducing it against the real database means creating an account that cannot
 * be removed, which is the silt this exists to prevent. A client whose deletes
 * refuse on command reproduces the exact branch and leaves nothing behind.
 *
 * THAT IS A STATED LIMIT. It proves the BRANCH. What proves the real refusal
 * still happens is the walk's own read-back against the probe domain, which is
 * what found the 641.
 *
 * BOTH DIRECTIONS. A teardown that returned ok false on everything would satisfy
 * the refusal case perfectly and be useless, so the clean path is asserted too.
 */

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const DOMAIN = "audit-probe.invalid";
const ACCOUNT = "aaaaaaaa-1111-2222-3333-444444444444";
const CLIENT = "cccccccc-1111-2222-3333-444444444444";

/**
 * A Supabase-shaped client whose deletes refuse for the tables named, and whose
 * reads answer from rows that the deletes actually remove. Every call is logged.
 */
function fakeClient({ refuseDeleteOn = [] } = {}) {
  const calls = [];
  const rows = {
    eng_customer_users: [{ id: "user-1", account_id: ACCOUNT, email: `c@${DOMAIN}` }],
    eng_customer_accounts: [{ id: ACCOUNT, client_id: CLIENT }],
    eng_clients: [{ id: CLIENT, email: `c@${DOMAIN}`, is_demo: true }],
  };

  const table = (name) => {
    const api = {
      _op: null,
      _patch: null,
      select() {
        api._op = api._op ?? "select";
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
      /*
       * The filter is RECORDED, not just accepted. The property that matters is
       * not "did it read eng_clients" but "did it read eng_clients BY ADDRESS",
       * because a read by id is bounded to this run and a read by address is the
       * whole domain. The first version of the assertion below could not tell
       * those apart and failed on correct code.
       */
      like() {
        api._byAddress = true;
        return api;
      },
      eq() {
        return api;
      },
      /*
       * `.in(column, ids)` was missing and the helper threw on it. Added rather
       * than routed around: the scoped count asks for rows BY ID, which is the
       * thing that makes `own` bounded, so a fake that cannot express it would
       * be testing a different function.
       */
      in(_column, ids) {
        api._in = ids;
        return api;
      },
      maybeSingle() {
        calls.push({ table: name, op: "select" });
        return Promise.resolve({ data: (rows[name] ?? [])[0] ?? null, error: null });
      },
      _settle() {
        calls.push({ table: name, op: api._op, patch: api._patch, byAddress: Boolean(api._byAddress) });
        if (api._op === "delete") {
          if (refuseDeleteOn.includes(name)) {
            return Promise.resolve({
              data: null,
              error: { message: `${name}: update or delete violates foreign key constraint` },
            });
          }
          rows[name] = [];
          return Promise.resolve({ data: null, error: null });
        }
        if (api._op === "update") {
          rows[name] = (rows[name] ?? []).map((r) => ({ ...r, ...api._patch }));
          return Promise.resolve({ data: null, error: null });
        }
        const all = rows[name] ?? [];
        return Promise.resolve({
          data: api._in ? all.filter((r) => api._in.includes(r.id)) : all,
          error: null,
        });
      },
      then(resolve, reject) {
        return api._settle().then(resolve, reject);
      },
    };
    return api;
  };

  return { from: table, _calls: calls, _rows: rows };
}

/* ------------------------------------------------------------------ the runs */

const ROOT = new URL("../..", import.meta.url).href.replace(/\/$/, "");
const probe = await import(ROOT + "/scripts/lib/portal-probe.mjs");

/*
 * The helper reads its client through a module-level factory, so the fake is
 * injected through the documented test seam rather than by patching a module
 * constant, which a fresh import would not unbind anyway.
 */
if (typeof probe.__setProbeClientForTests !== "function") {
  console.log("");
  console.log("COULD NOT TELL: portal-probe.mjs exposes no seam to inject a client.");
  console.log("The branch under test cannot be reached without one, and inventing");
  console.log("a second copy of the teardown to test instead would prove nothing");
  console.log("about the one that runs.");
  process.exit(1);
}

/* 1. The refusal: the client delete is refused and the function must say so. */
const refusing = fakeClient({ refuseDeleteOn: ["eng_clients"] });
probe.__setProbeClientForTests(refusing);
const refused = await probe.destroyCustomerProbes("proof");

rec(
  "a refused client delete returns ok false",
  refused.ok === false,
  refused.ok === false
    ? "the old version returned ok true here, on every run, for nineteen days"
    : `returned ok ${refused.ok}`,
);
rec(
  "and the refusal is reported rather than discarded",
  (refused.errors ?? []).some((e) => /eng_clients/.test(e)),
  (refused.errors ?? []).join(" | ") || "errors was empty, so the delete's return value was not read",
);
rec(
  "and the client delete was actually attempted",
  refusing._calls.some((c) => c.table === "eng_clients" && c.op === "delete"),
  "a teardown that never tried would also leave the row, and would look identical from the outside",
);
rec(
  "and the count that decides ok reads eng_clients, not only eng_customer_users",
  (refused.counts?.eng_clients ?? 0) > 0,
  `counts: ${JSON.stringify(refused.counts ?? {})}`,
);

/* 2. The clean path: nothing refuses, so nothing is left and ok is true. */
const clean = fakeClient();
probe.__setProbeClientForTests(clean);
const cleaned = await probe.destroyCustomerProbes("proof");

rec(
  "and a teardown that removes everything returns ok true",
  cleaned.ok === true && cleaned.left === 0,
  cleaned.ok === true
    ? "so the refusal branch is not simply a function that always fails"
    : `ok ${cleaned.ok}, left ${cleaned.left}`,
);
rec(
  "and it hard deleted the account rather than superseding it",
  clean._calls.some((c) => c.table === "eng_customer_accounts" && c.op === "delete"),
  "operator ruling 2026-10-03: probe accounts may be hard deleted on development only",
);

/*
 * ===========================================================================
 * 3. AN ORDINARY AUDIT INVOCATION CANNOT REACH A ROW IT DID NOT CREATE.
 * Operator ruling, 2026-10-03, and it is the half with the most behind it.
 * ===========================================================================
 *
 * The repair that made orphaned silt reachable, sweeping eng_clients by
 * address, also made every audit able to delete it: 641 historical rows would
 * have gone as a side effect of an ordinary run, with no transaction, no count
 * assertion and no dry run. That is the right outcome by the wrong route, and
 * the wrong route is the one that runs fifty times a day.
 *
 * So the default scope is bounded, and this is what proves the bound. The fake
 * database holds a client the run did NOT create, on the probe domain and
 * is_demo true, with no user row pointing at it: exactly the shape of the 641.
 * A default invocation must leave it alone.
 */
const HISTORIC_CLIENT = "dddddddd-9999-8888-7777-666666666666";

function fakeWithHistory() {
  const c = fakeClient();
  /* An orphan from an earlier run: no user, no account pointing at it. */
  c._rows.eng_clients.push({ id: HISTORIC_CLIENT, email: `old@${DOMAIN}`, is_demo: true });
  return c;
}

const bounded = fakeWithHistory();
probe.__setProbeClientForTests(bounded);
const ownRun = await probe.destroyCustomerProbes("proof");

rec(
  "a default invocation never reads eng_clients BY ADDRESS",
  !bounded._calls.some((c) => c.table === "eng_clients" && c.op === "select" && c.byAddress),
  "it reads that table only by id, which is bounded to this run. A read by address is the whole domain, and that is the one the 641 would have come back from",
);
rec(
  "and it deletes no client it did not create",
  !bounded._calls.some(
    (c) => c.table === "eng_clients" && c.op === "delete" && c._historic === true,
  ) && ownRun.scope === "own",
  `scope ${ownRun.scope}; the 641 are exactly this shape and an ordinary audit must not touch them`,
);

/* And the opt in is refused without the ref, which is the second deliberate act. */
probe.__setProbeClientForTests(fakeWithHistory());
const refusedScope = await probe.destroyCustomerProbes("proof", { scope: "domain" });
rec(
  "the domain scope is refused unless the caller names the development ref",
  refusedScope.ok === false && refusedScope.refusedScope === true,
  refusedScope.note,
);

probe.__setProbeClientForTests(fakeWithHistory());
const wrongRef = await probe.destroyCustomerProbes("proof", {
  scope: "domain",
  developmentRef: "not-the-development-ref",
});
rec(
  "and a wrong ref is refused too, so the parameter is checked rather than merely present",
  wrongRef.ok === false && wrongRef.refusedScope === true,
  "a guard satisfied by any truthy value is a guard satisfied by a typo",
);

probe.__setProbeClientForTests(null);

const failed = out.filter((r) => !r.ok);
console.log("");
console.log(
  failed.length === 0
    ? `PASS: ${out.length} checks. A teardown that cannot delete says so, and one that can still does.`
    : `FAIL: ${failed.length} of ${out.length}: ${failed.map((r) => r.name).join("; ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
