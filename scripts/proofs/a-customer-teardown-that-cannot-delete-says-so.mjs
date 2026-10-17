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
       * `.is(column, null)` is used by supersedeProbeAccount, which is now on
       * the only path: the hard delete was removed because 0048 refuses every
       * account delete. Added when removing that path made this call reachable
       * in the fake for the first time.
       */
      is() {
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
      /*
       * `.not(column, "like", "seed-%")` was missing and the teardown threw on
       * it, 2026-10-09, when the sweeps learned to leave the audit seed alone.
       * Added and APPLIED rather than accepted, so a row this fake holds under a
       * seed address is excluded exactly as the database would exclude it: a
       * fake that ignored it would be testing a different function.
       */
      not(column, op, pattern) {
        if (op === "like" && pattern.endsWith("%")) api._notPrefix = { column, prefix: pattern.slice(0, -1) };
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
        const kept = (rows[name] ?? []).filter(
          (r) => !api._notPrefix || !String(r[api._notPrefix.column] ?? "").startsWith(api._notPrefix.prefix),
        );
        return Promise.resolve({
          data: api._in ? kept.filter((r) => api._in.includes(r.id)) : kept,
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

/*
 * 1. The refusal that must still turn a run red.
 *
 * THE FIXTURE CHANGED WITH THE DESIGN, and that is the point of re-reading a
 * test when a ruling moves. It used to refuse the CLIENT delete, because that
 * was the delete the old code fired and silently ignored. That delete is no
 * longer attempted at all: a client held by a superseded account is kept by
 * design. So refusing it exercised nothing, and the assertion passed for the
 * wrong reason until it was pointed at the right subject.
 *
 * What must still make a run red is a customer USER that cannot be removed,
 * because that is the row that can sign in. Everything else the schema keeps is
 * kept, named, and not a failure.
 */
const refusing = fakeClient({ refuseDeleteOn: ["eng_customer_users"] });
probe.__setProbeClientForTests(refusing);
const refused = await probe.destroyCustomerProbes("proof");

/*
 * FOUR OF THESE ASSERTIONS TESTED A DESIGN THAT WAS WITHDRAWN, and they are
 * rewritten rather than the code bent to satisfy them.
 *
 * The hard delete of a probe account was ruled and withdrawn the same day, once
 * it turned out migration 0048 installs a trigger refusing EVERY account delete.
 * The attempt is gone, so "the client delete was attempted" and "it hard deleted
 * the account" now assert the opposite of the rule. A proof kept green by
 * reverting a ruling is a proof about nothing.
 */
rec(
  "a customer user that cannot be removed returns ok false",
  refused.ok === false && refused.left > 0,
  refused.ok === false
    ? `left ${refused.left}: a row that can sign in is the one thing that must never be reported as clean`
    : `returned ok ${refused.ok}, left ${refused.left}`,
);
rec(
  "and the refusal is reported rather than discarded",
  (refused.errors ?? []).some((e) => /eng_customer_users/.test(e)),
  (refused.errors ?? []).join(" | ") || "errors was empty, so the delete's return value was not read",
);
rec(
  "the account is superseded and reported as kept, naming 0048",
  (refused.kept ?? []).some((k) => /superseded, never deleted \(migration 0048\)/.test(k)),
  (refused.kept ?? []).join(" | ") || "kept was empty",
);
rec(
  "and no delete is fired at an account, because 0048 refuses every one",
  !refusing._calls.some((c) => c.table === "eng_customer_accounts" && c.op === "delete"),
  "a call refused every time is a path somebody later reads as possible, and its error handling is dead code that looks live",
);
rec(
  "and a client held by a superseded account is kept rather than attempted",
  (refused.kept ?? []).some((k) => /eng_clients .* held by .* on delete restrict/.test(k)) &&
    !refusing._calls.some((c) => c.table === "eng_clients" && c.op === "delete"),
  "firing that delete every run produced the error that masked the real state for nineteen days",
);

/* 2. The ordinary path: nothing can sign in, and what the schema keeps is named. */
const clean = fakeClient();
probe.__setProbeClientForTests(clean);
const cleaned = await probe.destroyCustomerProbes("proof");

rec(
  "an ordinary run returns ok true with the kept rows named",
  cleaned.ok === true && cleaned.left === 0 && (cleaned.keptCount ?? 0) >= 2,
  cleaned.ok === true
    ? `left ${cleaned.left}, kept ${cleaned.keptCount}. Kept is not failed: counting the schema working as designed would be a permanent red`
    : `ok ${cleaned.ok}, left ${cleaned.left}`,
);
rec(
  "and left counts only what can still sign in",
  cleaned.counts?.eng_customer_users === 0 && cleaned.left === 0,
  `counts ${JSON.stringify(cleaned.counts ?? {})}, left ${cleaned.left}. The account and its client survive by design and do not make the run red`,
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
