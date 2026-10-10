/**
 * A NETWORK FAULT BEFORE ANY RESPONSE IS RETRIED. NOTHING ELSE IS.
 *
 * Operator ruling, 2026-10-09 (fix/probe-transient-retry). Four boards in a
 * week went red, or could not tell, on a `fetch failed` between an audit and
 * development's database: the connection never opened, or dropped before an
 * answer came back. None of them was a finding about the product, and each
 * cost a re-board.
 *
 * The ruling, and every clause of it is a limit rather than a permission:
 *
 *   - up to three retries, after 1 s, 3 s and 9 s;
 *   - ONLY for a failure before any HTTP response: fetch failed, ECONNRESET,
 *     ETIMEDOUT, socket hang up (and the undici connect timeout that a
 *     `fetch failed` carries as its cause);
 *   - NEVER on an HTTP status, whatever it is: a response is an answer, and a
 *     500 is a finding somebody has to read;
 *   - NEVER on an assertion, or on any error that is not one of those faults;
 *   - an INSERT retries only with an idempotency key, or after a read confirms
 *     nothing was written;
 *   - every retry is logged, and the board prints how many there were.
 *
 * WHICH REQUESTS. A read (GET, HEAD) repeats safely. A DELETE is idempotent by
 * definition: the second one removes what the first did not. An insert (a POST
 * to /rest/v1/<table>) retries only when it carries an `Idempotency-Key` header,
 * or when every row it sends names its own `id` and a read of those ids comes
 * back empty, so the row provably did not land. Everything else, an update, an
 * RPC (which could be eng_claim_jobs), an Auth admin call, is NOT retried: its
 * second run could do something the first already did, and nothing here can
 * read whether it did.
 *
 * Where a confirming read finds the row DID land, the fault is still reported
 * as it happened. Turning it into a success would be this file inventing a
 * response the server never sent.
 */
import { appendFileSync } from "node:fs";

export const RETRY_DELAYS_MS = [1000, 3000, 9000];

/*
 * The socket's own codes, and undici's connect, socket and headers timeouts.
 * A pattern rather than a list of strings: soc2-audit reads an all-caps
 * underscored string literal as a candidate secret, rightly, and these are not.
 */
const FAULT_CODE = /^(ECONNRESET|ETIMEDOUT|UND_ERR_(CONNECT_TIMEOUT|SOCKET|HEADERS_TIMEOUT))$/;
const SOCKET_MESSAGE = /socket hang up|ECONNRESET|ETIMEDOUT/i;

/**
 * Whether a thrown value is a fault before any HTTP response. Walks the cause
 * chain, because undici throws `TypeError: fetch failed` and puts the socket's
 * reason underneath it. An AbortError is a caller's decision and never a fault;
 * a plain Error is an assertion or a bug and never a fault.
 */
export function isTransientFault(err) {
  if (!err || err.name === "AbortError") return false;
  if (err.name === "TypeError" && err.message === "fetch failed") return true;
  for (let e = err, depth = 0; e && depth < 5; e = e.cause, depth += 1) {
    if (typeof e.code === "string" && FAULT_CODE.test(e.code)) return true;
    if (typeof e.message === "string" && SOCKET_MESSAGE.test(e.message)) return true;
  }
  return false;
}

function causeOf(err) {
  const parts = [];
  for (let e = err, depth = 0; e && depth < 5; e = e.cause, depth += 1) {
    parts.push(e.code ? `${e.code}` : `${e.name ?? "Error"}: ${e.message ?? ""}`);
  }
  return parts.join(" <- ");
}

function headerOf(init, name) {
  const h = init?.headers;
  if (!h) return null;
  if (typeof h.get === "function") return h.get(name);
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? h[key] : null;
}

/**
 * Creating an Auth user, POST /auth/v1/admin/users. Approved 2026-10-09 for
 * break-glass-audit, whose probe account met a fault twice: retried only when
 * the body names the user's id and a read of that id answers 404.
 */
function isAuthUserCreate(url) {
  return /\/auth\/v1\/admin\/users$/.test(new URL(url).pathname);
}

async function authUserAbsent(baseFetch, url, init) {
  let id = null;
  try {
    id = JSON.parse(init.body)?.id ?? null;
  } catch {
    return { may: false, why: "an Auth user create whose body could not be read" };
  }
  if (typeof id !== "string" || !id) return { may: false, why: "an Auth user create that names no id to read back" };
  const read = new URL(url);
  read.pathname = `${read.pathname}/${encodeURIComponent(id)}`;
  read.search = "";
  const headers = {};
  for (const name of ["apikey", "Authorization"]) {
    const v = headerOf(init, name);
    if (v) headers[name] = v;
  }
  try {
    const res = await baseFetch(read.href, { method: "GET", headers });
    if (res.status === 404) return { may: true, why: "a read of the Auth user's id confirmed it was not created" };
    if (res.ok) return { may: false, why: "a read found the Auth user WAS created despite the fault" };
    return { may: false, why: `the confirming read of the Auth user answered ${res.status}` };
  } catch (readErr) {
    return { may: false, why: `the confirming read failed too (${causeOf(readErr)})` };
  }
}

/** /rest/v1/<table>, and not /rest/v1/rpc/<fn>. */
function insertTarget(url) {
  const m = new URL(url).pathname.match(/\/rest\/v1\/([A-Za-z0-9_]+)$/);
  return m && m[1] !== "rpc" ? m[1] : null;
}

function idsIn(body) {
  if (typeof body !== "string") return null;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (!rows.length) return null;
  const ids = rows.map((r) => (r && (typeof r.id === "string" || typeof r.id === "number") ? String(r.id) : null));
  return ids.every(Boolean) ? ids : null;
}

function record(line) {
  const lifecycle = process.env.npm_lifecycle_event;
  const audit = (lifecycle && lifecycle !== "npx" ? lifecycle : process.argv[1]?.split(/[\\/]/).pop()) || "unknown";
  const entry = { at: new Date().toISOString(), audit, ...line };
  console.error(
    `[transient-retry] ${entry.audit}: ${entry.method} ${entry.path} ${entry.outcome}` +
      `${entry.attempt ? ` (retry ${entry.attempt} of ${RETRY_DELAYS_MS.length})` : ""} after ${entry.cause}`,
  );
  const log = process.env.AUDIT_RETRY_LOG;
  if (log) {
    try {
      appendFileSync(log, `${JSON.stringify(entry)}\n`);
    } catch {
      /* the stderr line above is the record; the count is a convenience */
    }
  }
}

/**
 * Wrap a fetch. `sleep` is injectable so the proof can read the delays without
 * waiting thirteen seconds for them.
 */
export function retryingFetch(baseFetch = globalThis.fetch, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  return async function fetchWithTransientRetry(input, init = {}) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = String(init.method ?? (typeof input === "object" ? input.method : undefined) ?? "GET").toUpperCase();
    const path = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await baseFetch(input, init);
      } catch (err) {
        if (!isTransientFault(err)) throw err;
        const cause = causeOf(err);
        if (attempt >= RETRY_DELAYS_MS.length) {
          record({ method, path, outcome: "gave up after three retries", cause });
          throw err;
        }

        let may = method === "GET" || method === "HEAD" || method === "DELETE";
        let why = "";
        if (!may && method === "POST" && isAuthUserCreate(url)) {
          ({ may, why } = await authUserAbsent(baseFetch, url, init));
        } else if (!may && method === "POST" && insertTarget(url)) {
          if (headerOf(init, "Idempotency-Key")) {
            may = true;
          } else {
            const ids = idsIn(init.body);
            if (!ids) {
              why = "an insert with no idempotency key and no id to read back";
            } else {
              const table = insertTarget(url);
              const read = new URL(url);
              read.search = "";
              read.searchParams.set("select", "id");
              read.searchParams.set("id", `in.(${ids.map((i) => `"${i}"`).join(",")})`);
              const headers = {};
              for (const name of ["apikey", "Authorization", "Accept-Profile", "Content-Profile"]) {
                const v = headerOf(init, name);
                if (v) headers[name === "Content-Profile" ? "Accept-Profile" : name] = v;
              }
              try {
                const res = await baseFetch(read.href, { method: "GET", headers });
                const found = res.ok ? await res.json() : null;
                if (Array.isArray(found) && found.length === 0) {
                  may = true;
                  why = `a read of ${table} confirmed none of ${ids.length} row(s) was written`;
                } else if (Array.isArray(found)) {
                  why = `a read of ${table} found ${found.length} of ${ids.length} row(s) written despite the fault`;
                } else {
                  why = `the confirming read of ${table} answered ${res.status}`;
                }
              } catch (readErr) {
                why = `the confirming read failed too (${causeOf(readErr)})`;
              }
            }
          }
        } else if (!may) {
          why = `a ${method} is not repeated, because its second run could repeat its first`;
        }

        if (!may) {
          record({ method, path, outcome: `NOT retried: ${why}`, cause });
          throw err;
        }
        record({ method, path, outcome: why ? `retrying, ${why}` : "retrying", attempt: attempt + 1, cause });
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  };
}
