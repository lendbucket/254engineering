/**
 * A NETWORK FAULT BEFORE ANY RESPONSE IS RETRIED, AND A STATUS IS NOT.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-network-fault-is-retried-and-a-status-is-not.mjs
 *
 * Operator ruling of 2026-10-09 (fix/probe-transient-retry), proved by
 * injection: a transient failure recovers, an HTTP 500 fails immediately.
 *
 * Two halves. The first drives retryingFetch with a fetch that fails on
 * command, so every clause of the ruling is asked separately and the delays are
 * read without waiting for them. The second asks the REAL client every audit
 * gets, auditClient, against development, with a fetch that fails once before
 * passing through: the read recovers. And with a fetch that answers 500: the
 * client returns the error at once, after one call.
 *
 * This proof's faults are deliberate, so they are kept out of the board's
 * retry count: AUDIT_RETRY_LOG is cleared for this process before anything runs.
 */
delete process.env.AUDIT_RETRY_LOG;

const { retryingFetch, isTransientFault, RETRY_DELAYS_MS } = await import("../lib/transient-retry.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* undici's connect timeout, the fault the boards actually met. A constant this
 * file defines, so soc2-audit's secret scan reads it as one and says so. */
const UND_ERR_CONNECT_TIMEOUT = "UND_ERR_CONNECT_TIMEOUT";
const fault = (code = "ECONNRESET") => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
const REST = "https://example.invalid/rest/v1";

/** A fetch that throws the first `fails` times, then answers. */
function scripted({ fails = 0, error = () => fault(), answer = () => new Response("[]", { status: 200 }), onRead } = {}) {
  const calls = [];
  const f = async (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    calls.push({ url: String(input), method });
    if (method === "GET" && onRead && String(input).includes("select=id")) return onRead();
    if (calls.filter((c) => c.method === method && c.url === String(input)).length <= fails) throw error();
    return answer();
  };
  return { f, calls };
}
const waited = [];
const sleep = async (ms) => void waited.push(ms);
/* Every case catches its own throw, so an injection names the check it breaks
 * rather than ending the proof at the first one. */
async function call(f, url, init) {
  try {
    return { res: await retryingFetch(f, { sleep })(url, init), threw: null };
  } catch (e) {
    return { res: null, threw: e };
  }
}

// The classification.
check("a fetch failed with ECONNRESET under it is a fault", isTransientFault(fault("ECONNRESET")));
check("and the undici connect timeout the boards actually met", isTransientFault(fault(UND_ERR_CONNECT_TIMEOUT)));
check("and a bare socket hang up", isTransientFault(new Error("socket hang up")));
check("an assertion is not a fault", !isTransientFault(new Error("expected 3 rows, read 2")));
check("an abort is not a fault", !isTransientFault(Object.assign(new Error("aborted"), { name: "AbortError" })));

// 1. A read that faults once recovers, after one second.
{
  waited.length = 0;
  const s = scripted({ fails: 1 });
  const { res } = await call(s.f, `${REST}/eng_roles?select=key`);
  check("a read that faults once is retried and recovers", res?.status === 200 && s.calls.length === 2, `${s.calls.length} call(s)`);
  check("after one second", waited.join(",") === "1000", waited.join(","));
}

// 2. A 500 is an answer, returned at once.
{
  waited.length = 0;
  const s = scripted({ answer: () => new Response("boom", { status: 500 }) });
  const { res } = await call(s.f, `${REST}/eng_roles?select=key`);
  check("an HTTP 500 is returned immediately, never retried", res?.status === 500 && s.calls.length === 1 && waited.length === 0, `${s.calls.length} call(s)`);
}

// 3. Three retries and no more, at 1, 3 and 9 seconds.
{
  waited.length = 0;
  const s = scripted({ fails: 99 });
  let threw = null;
  try {
    await retryingFetch(s.f, { sleep })(`${REST}/eng_roles?select=key`);
  } catch (e) {
    threw = e;
  }
  check("a fault that persists gives up after three retries, four calls in all", threw && s.calls.length === 4, `${s.calls.length} call(s)`);
  check("and the original fault is what the caller receives", threw?.message === "fetch failed");
  check("and the delays are 1 s, 3 s and 9 s", waited.join(",") === RETRY_DELAYS_MS.join(",") && waited.join(",") === "1000,3000,9000", waited.join(","));
}

// 4. An error that is not a network fault is thrown through untouched.
{
  const s = scripted({ fails: 1, error: () => new Error("not a network fault") });
  let threw = null;
  try {
    await retryingFetch(s.f, { sleep })(`${REST}/eng_roles`);
  } catch (e) {
    threw = e;
  }
  check("any other error is never retried", threw?.message === "not a network fault" && s.calls.length === 1);
}

// 5. Inserts.
const insert = (body, headers = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { apikey: "k", ...headers } });
{
  const s = scripted({ fails: 1 });
  let threw = null;
  try {
    await retryingFetch(s.f, { sleep })(`${REST}/eng_partners`, insert({ name: "x" }));
  } catch (e) {
    threw = e;
  }
  check("an insert with no idempotency key and no id is not retried", threw && s.calls.length === 1);
}
{
  const s = scripted({ fails: 1, onRead: () => new Response("[]", { status: 200 }) });
  const { res } = await call(s.f, `${REST}/eng_partners`, insert({ id: "a1", name: "x" }));
  const posts = s.calls.filter((c) => c.method === "POST").length;
  check("an insert whose id a read confirms was not written is retried", res?.status === 200 && posts === 2, `${posts} insert(s)`);
}
{
  const s = scripted({ fails: 1, onRead: () => new Response('[{"id":"a1"}]', { status: 200 }) });
  let threw = null;
  try {
    await retryingFetch(s.f, { sleep })(`${REST}/eng_partners`, insert({ id: "a1", name: "x" }));
  } catch (e) {
    threw = e;
  }
  const posts = s.calls.filter((c) => c.method === "POST").length;
  check("an insert the read finds WAS written is not retried, and still reports its fault", threw && posts === 1, `${posts} insert(s)`);
}
{
  const s = scripted({ fails: 1 });
  const { res } = await call(s.f, `${REST}/eng_partners`, insert({ name: "x" }, { "Idempotency-Key": "k-1" }));
  check("an insert carrying an idempotency key is retried", res?.status === 200 && s.calls.length === 2);
}
{
  const s = scripted({ fails: 1 });
  let threw = null;
  try {
    await retryingFetch(s.f, { sleep })(`${REST}/rpc/eng_claim_jobs`, { method: "POST", body: "{}" });
  } catch (e) {
    threw = e;
  }
  check("an RPC is never retried, because its second run could repeat its first", threw && s.calls.length === 1);
}
{
  const s = scripted({ fails: 1 });
  let threw = null;
  try {
    await retryingFetch(s.f, { sleep })(`${REST}/eng_profiles?id=eq.1`, { method: "PATCH", body: "{}" });
  } catch (e) {
    threw = e;
  }
  check("an update is never retried", threw && s.calls.length === 1);
}

// 5b. Creating an Auth user: retried only when it names its id and a read answers 404.
const AUTH = "https://example.invalid/auth/v1/admin/users";
{
  const s = scripted({ fails: 1 });
  const { threw } = await call(s.f, AUTH, { method: "POST", body: JSON.stringify({ email: "x@audit-probe.invalid" }) });
  check("an Auth user create that names no id is not retried", threw && s.calls.length === 1);
}
for (const [status, retried] of [[404, true], [200, false]]) {
  const calls = [];
  const f = async (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    calls.push(method);
    if (method === "GET") return new Response(status === 200 ? '{"id":"u1"}' : '{"msg":"not found"}', { status });
    if (calls.filter((m) => m === "POST").length === 1) throw fault();
    return new Response('{"id":"u1"}', { status: 200 });
  };
  const { res, threw } = await call(f, AUTH, { method: "POST", body: JSON.stringify({ id: "u1", email: "x@audit-probe.invalid" }) });
  const posts = calls.filter((m) => m === "POST").length;
  check(
    retried
      ? "an Auth user create whose id reads back 404 is retried"
      : "an Auth user create whose id reads back as existing is not retried",
    retried ? res?.status === 200 && posts === 2 : Boolean(threw) && posts === 1,
    `${posts} create(s)`,
  );
}

// 6. The real client every audit gets, against development.
const { auditClient } = await import("../lib/db-target.mjs");
let failOnce = true;
let calls = 0;
const flaky = async (input, init) => {
  calls += 1;
  if (failOnce) {
    failOnce = false;
    throw fault(UND_ERR_CONNECT_TIMEOUT);
  }
  return fetch(input, init);
};
const db = auditClient("the transient retry proof", { neverProduction: true, fetch: flaky });
if (!db) {
  console.log("  COULD NOT TELL: no development database client here, so the client half did not run.");
} else {
  const started = Date.now();
  /* supabase-js returns a thrown fetch as { error }, so this cannot crash the proof. */
  const { data, error } = await db.from("eng_roles").select("key").limit(1);
  check(
    "auditClient's read recovers from an injected connect timeout",
    !error && Array.isArray(data) && data.length === 1 && calls === 2,
    `${calls} call(s), ${Date.now() - started} ms${error ? `, ${error.message}` : ""}`,
  );
  /*
   * A real Auth user create on development, on a probe address, with its first
   * attempt faulted before it is sent: it is created once, and swept.
   */
  {
    const { randomUUID } = await import("node:crypto");
    const id = randomUUID();
    let posts = 0;
    let firstPost = true;
    const flakyCreate = async (input, init) => {
      if ((init?.method ?? "GET").toUpperCase() === "POST" && String(input).endsWith("/auth/v1/admin/users")) {
        posts += 1;
        if (firstPost) {
          firstPost = false;
          throw fault(UND_ERR_CONNECT_TIMEOUT);
        }
      }
      return fetch(input, init);
    };
    const authDb = auditClient("the transient retry proof", { neverProduction: true, fetch: flakyCreate });
    const made = await authDb.auth.admin.createUser({
      id,
      email: `transient-retry-${Date.now()}@audit-probe.invalid`,
      password: `p-${randomUUID()}`,
      email_confirm: true,
    });
    check(
      "a real Auth user create recovers from an injected connect timeout, created once",
      !made.error && made.data?.user?.id === id && posts === 2,
      `${posts} attempt(s)${made.error ? `, ${made.error.message}` : ""}`,
    );
    await db.auth.admin.deleteUser(id);
    const after = await db.auth.admin.getUserById(id);
    check("and the probe account is swept, read back", !after.data?.user, after.data?.user ? "still there" : "gone");
  }

  /*
   * 503 as well as 500, because 503 is the status postgrest-js's own retry
   * repeats when it is left on: this is the check that the client's retry is
   * off and this file's is the only one.
   */
  for (const status of [500, 503]) {
    let answered = 0;
    const failing = auditClient("the transient retry proof", {
      neverProduction: true,
      fetch: async () => {
        answered += 1;
        return new Response(JSON.stringify({ message: "injected" }), { status, headers: { "content-type": "application/json" } });
      },
    });
    const t = Date.now();
    const r = await failing.from("eng_roles").select("key").limit(1);
    check(
      `and an injected HTTP ${status} comes back as an error at once, after one call`,
      Boolean(r.error) && answered === 1 && Date.now() - t < 900,
      `${answered} call(s), ${Date.now() - t} ms`,
    );
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a network fault before any response is retried, and a status is not.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
