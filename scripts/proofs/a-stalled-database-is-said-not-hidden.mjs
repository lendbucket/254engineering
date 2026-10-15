// @runtime react-server
//
// Declared because part E imports src/lib/ops-jobs.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A STALLED DATABASE IS SAID, NOT HIDDEN.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-stalled-database-is-said-not-hidden.mjs
 *
 * Operator rulings, 2026-10-12. Every application database request is bounded
 * at 20 seconds (src/lib/bounded-fetch.ts), and what a person is told when the
 * bound fires is his wording, proved here against a FORCED stall rather than
 * argued from the code:
 *
 *   A. The session read every portal screen shares stalls. The screen says "The
 *      portal could not reach the database. You are still signed in. Try again
 *      in a moment." It does not redirect to the login screen and sets no
 *      cookie, and the login screen says the same rather than offering the form.
 *      A request with no session still goes to the login screen.
 *   B. The design brief list stalls. It says "This list could not be loaded.
 *      Try again." with a retry control, never "No briefs yet".
 *   C. The administrator's dashboard reads stall. Each one is reported under
 *      "What could not be counted".
 *   D. A save stalls. The answer is "This may not have saved. Check before
 *      trying again.", and the write was sent exactly once: nothing retried it.
 *   E. A queued job's write stalls. The job is dead lettered with that sentence
 *      rather than retried, and a retry by hand keeps the job's idempotency key.
 *
 * HOW THE STALL IS FORCED. A proxy on a local port forwards to development and
 * holds chosen requests open without ever answering, which is exactly what a
 * stalled socket looks like from the application. The production build is
 * started with SUPABASE_URL pointed at the proxy, so the product code runs
 * unaltered. A stalled request is never forwarded, so no stalled write reaches
 * the database. Part E runs the job worker's own path in this process, through
 * the same proxy, without claiming anybody else's queued work.
 *
 * Needs a production build on disk (the board makes one). Writes on
 * development: one probe administrator and its sign in (the sign in leaves
 * permanent audit rows, as every probe does), one probe design brief and one
 * probe job row, each removed and read back.
 */
import http from "node:http";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { PORTS } = await import("../lib/ports.mjs");
const { auditClient } = await import("../lib/db-target.mjs");
const { startNextServer } = await import("../lib/dev-server.mjs");
const { createProbe, destroyProbes } = await import("../lib/portal-probe.mjs");
const COPY = await import("../../src/lib/outcome-copy.ts");

const LABEL = "stall";
const db = auditClient("the stalled database proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so nothing ran.");
  process.exit(3);
}
if (!existsSync(".next/BUILD_ID")) {
  console.log("  COULD NOT TELL: no production build on disk, so there is nothing to start. Run the board, or npm run build.");
  process.exit(3);
}

const UPSTREAM = process.env.SUPABASE_URL;
const BOUND_S = 20;

/* ------------------------------------------------------------- the proxy */

/** Which requests to hold open. Replaced per part. */
let stallRule = () => false;
/** Every request the proxy saw, in order: method, table path, and whether it was held. */
const seen = [];
const sinceMark = (mark) => seen.slice(mark);
const countOf = (list, method, path) => list.filter((r) => r.method === method && r.path === path).length;

const proxy = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://proxy");
  const entry = { method: req.method, path: url.pathname, held: false };
  seen.push(entry);
  if (stallRule(req.method, url.pathname)) {
    entry.held = true;
    /* Never answered and never forwarded. The application's own bound ends it. */
    req.on("close", () => res.destroy());
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  try {
    const upstream = await fetch(UPSTREAM + req.url, {
      method: req.method,
      headers,
      body: chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined,
    });
    const out = {};
    upstream.headers.forEach((v, k) => {
      /* fetch has already decoded the body, so its encoding and length no longer describe it. */
      if (k !== "content-encoding" && k !== "content-length" && k !== "transfer-encoding") out[k] = v;
    });
    res.writeHead(upstream.status, out);
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
  } catch (err) {
    res.writeHead(502);
    res.end(String(err));
  }
});
await new Promise((resolve) => proxy.listen(PORTS.stallProxy, "127.0.0.1", resolve));
const PROXY_URL = `http://127.0.0.1:${PORTS.stallProxy}`;

/* GET and HEAD by default: a count is a HEAD request, and a rule holding GET alone never stalled one. */
const stallOn = (tables, methods = ["GET", "HEAD"]) => {
  stallRule = (method, path) => methods.includes(method) && tables.some((t) => path === `/rest/v1/${t}`);
};
const stallNothing = () => {
  stallRule = () => false;
};

/* ------------------------------------------------------------ the server */

let server = null;
let probe = null;
let inquiryId = null;
let jobId = null;

const timed = async (fn) => {
  const started = Date.now();
  const value = await fn();
  return { value, seconds: (Date.now() - started) / 1000 };
};

try {
  server = await startNextServer({ port: PORTS.stallApp, env: { SUPABASE_URL: PROXY_URL }, timeoutMs: 120_000 });
  const base = server.base;

  probe = await createProbe(base, "admin", LABEL);
  if (!probe.cookie) {
    console.log(`  COULD NOT TELL: the probe administrator could not sign in (${probe.fault}).`);
    process.exitCode = 3;
  } else {
    const cookie = `eng_ops=${probe.cookie}`;
    const page = (path, withCookie = true) =>
      fetch(base + path, {
        redirect: "manual",
        headers: withCookie ? { cookie } : {},
        signal: AbortSignal.timeout(90_000),
      });

    /* ---------------- A: the session read stalls ---------------- */
    console.log("\nA. The session read stalls");
    stallOn(["eng_profiles"]);
    let mark = seen.length;
    const a = await timed(async () => {
      const r = await page("/portal/inquiries");
      return { status: r.status, location: r.headers.get("location"), setCookie: r.headers.get("set-cookie"), body: await r.text() };
    });
    const aSeen = sinceMark(mark);
    check("the screen says the portal could not reach the database and the person is still signed in", a.value.body.includes(COPY.PORTAL_UNREACHABLE));
    check("and it is not a redirect to the login screen", a.value.status < 300 || a.value.status >= 400, `HTTP ${a.value.status}${a.value.location ? ` to ${a.value.location}` : ""}`);
    check("and it sets no cookie, so nobody is signed out", !a.value.setCookie, a.value.setCookie ?? "no set-cookie header");
    check("and it carries a retry control", a.value.body.includes(">Try again<"));
    check(
      `and the 20 second bound is what ended it`,
      a.seconds >= BOUND_S - 1 && a.seconds < 45,
      `${a.seconds.toFixed(1)} s, under the 45 second probe`,
    );
    check(
      "and the stalled read was sent once: an abandoned read is not retried, and the layout and page share it",
      countOf(aSeen, "GET", "/rest/v1/eng_profiles") === 1,
      `${countOf(aSeen, "GET", "/rest/v1/eng_profiles")} GET(s) of eng_profiles`,
    );

    const login = await page("/portal/login");
    const loginBody = await login.text();
    check("the login screen, signed in, says the same rather than offering the form", loginBody.includes(COPY.PORTAL_UNREACHABLE) && !/type="password"/.test(loginBody), `HTTP ${login.status}`);

    stallNothing();
    const anon = await page("/portal/inquiries", false);
    check(
      "a request with no session still goes to the login screen",
      anon.status >= 300 && anon.status < 400 && (anon.headers.get("location") ?? "").includes("/portal/login"),
      `HTTP ${anon.status} to ${anon.headers.get("location")}`,
    );

    /* ---------------- B: the brief list stalls ---------------- */
    console.log("\nB. The design brief list stalls");
    stallOn(["eng_design_inquiries"]);
    const b = await (await page("/portal/inquiries")).text();
    check("the list says it could not be loaded, in his words", b.includes(COPY.LIST_NOT_LOADED));
    check("and never that there are no briefs", !b.includes("No briefs yet"));
    check("and carries a retry control", b.includes(">Try again<"));
    stallNothing();
    const bOk = await (await page("/portal/inquiries")).text();
    check("unstalled, the same screen renders the list or its empty state, not the failure", !bOk.includes(COPY.LIST_NOT_LOADED));

    /* ---------------- C: the dashboard's reads stall ---------------- */
    console.log("\nC. The administrator's dashboard reads stall");
    const dashboardCases = [
      { tables: ["eng_tasks"], says: "Tasks could not be read" },
      { tables: ["eng_credentials"], says: "Credentials could not be read" },
      { tables: ["eng_service_orders"], says: "Orders, payments or checkout records could not be read" },
      { tables: ["eng_partner_entries", "eng_files"], says: "The files or the partner ledger could not be read" },
      { tables: ["eng_review_sessions"], says: "Review sessions, the production ledger or their files could not be read" },
      { tables: ["eng_notifications"], says: "Notifications could not be read" },
    ];
    /* Stalled together where they run together, so the part costs two bounds rather than six. */
    stallOn(dashboardCases.slice(0, 5).flatMap((c) => c.tables));
    const c1 = await (await page("/portal")).text();
    stallOn(dashboardCases[5].tables);
    const c2 = await (await page("/portal")).text();
    stallNothing();
    for (const [i, c] of dashboardCases.entries()) {
      const body = i < 5 ? c1 : c2;
      check(`${c.tables.join(" and ")} stalled: reported under "What could not be counted"`, body.includes("What could not be counted") && body.includes(c.says));
    }
    const healthy = await (await page("/portal")).text();
    check("unstalled, the money dashboard carries no such list", !healthy.includes("What could not be counted"));

    /* ---------------- D: a save stalls ---------------- */
    console.log("\nD. A save stalls");
    const { data: inserted, error: insertError } = await db
      .from("eng_design_inquiries")
      .insert({
        name: "Audit Probe Stall",
        email: `probe-stall-${Date.now()}@audit-probe.invalid`,
        asking_as: "owner",
        work_kind: "repair",
        deliverable: "design_review",
        property_address: "1 Probe Way",
        open_insurance_claim: false,
        active_litigation: false,
        prior_adverse_report: false,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      check("a probe brief to answer could be made", false, insertError?.message ?? "no row");
    } else {
      inquiryId = inserted.id;
      stallOn(["eng_design_inquiries"], ["PATCH"]);
      mark = seen.length;
      const res = await fetch(`${base}/api/portal/inquiries`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_answered", inquiryId }),
        signal: AbortSignal.timeout(90_000),
      });
      const json = await res.json().catch(() => null);
      check("the save answers that it may not have saved, in his words", json?.error === COPY.MAY_NOT_HAVE_SAVED, `HTTP ${res.status}: ${json?.error}`);
      check("and says the outcome is unknown rather than failed", json?.ok === false && json?.outcome === "unknown");
      /* Long enough for any retry with backoff to have been sent. */
      await new Promise((r) => setTimeout(r, 8000));
      const writes = countOf(sinceMark(mark), "PATCH", "/rest/v1/eng_design_inquiries");
      check("and the write was sent once: nothing retried it", writes === 1, `${writes} PATCH(es) of eng_design_inquiries, 8 s after the answer`);
      stallNothing();
    }

    /* ---------------- E: a queued job's write stalls ---------------- */
    console.log("\nE. A queued job's write stalls");
    process.env.SUPABASE_URL = PROXY_URL;
    const jobs = await import("../../src/lib/ops-jobs.ts");
    const rules = await import("../../src/lib/job-rules.ts");
    await jobs.loadHandlers();
    const handler = jobs.handlerFor("metrics.rollup");
    stallOn(["eng_metrics_daily"], ["POST"]);
    mark = seen.length;
    const job = { id: -1, kind: "metrics.rollup", payload: { day: "2000-01-01" }, attempts: 1, maxAttempts: 5, effectMode: "live" };
    const outcome = await jobs.runOne(handler, job);
    stallNothing();
    const next = rules.nextState(job, outcome);
    check("the job's outcome is fatal, not a retry", outcome.kind === "fatal", outcome.kind);
    check("and it opens with his sentence", outcome.kind !== "done" && outcome.error.startsWith(COPY.MAY_NOT_HAVE_SAVED), outcome.kind !== "done" ? outcome.error.slice(0, 140) : "");
    check("so the job goes to the dead letter queue for a person", next.status === "dead", next.status);
    const upserts = countOf(sinceMark(mark), "POST", "/rest/v1/eng_metrics_daily");
    check("and the write was sent once", upserts === 1, `${upserts} POST(s) of eng_metrics_daily`);

    const key = `rollup-stall-probe-${randomUUID()}`;
    const { data: deadRow, error: deadError } = await db
      .from("eng_jobs")
      .insert({ kind: "metrics.rollup", payload: { day: "2000-01-01" }, idempotency_key: key, status: "dead", attempts: 1, last_error: COPY.MAY_NOT_HAVE_SAVED })
      .select("id")
      .single();
    if (deadError || !deadRow) {
      check("a dead letter to retry by hand could be made", false, deadError?.message ?? "no row");
    } else {
      jobId = deadRow.id;
      const retried = await jobs.retryDeadJob(jobId);
      const { data: after } = await db.from("eng_jobs").select("status, idempotency_key").eq("id", jobId).single();
      check("a retry by hand puts it back", retried.ok && after?.status === "pending", `${after?.status}`);
      check("and keeps its idempotency key", after?.idempotency_key === key);
    }
  }
} catch (err) {
  check("the proof ran to the end", false, err instanceof Error ? err.message : String(err));
} finally {
  stallNothing();
  if (jobId !== null) {
    await db.from("eng_jobs").delete().eq("id", jobId);
    const { count } = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("id", jobId);
    check("the probe job row is gone", count === 0, `${count} left`);
  }
  if (inquiryId !== null) {
    await db.from("eng_design_inquiries").delete().eq("id", inquiryId);
    const { count } = await db.from("eng_design_inquiries").select("id", { count: "exact", head: true }).eq("id", inquiryId);
    check("the probe brief is gone", count === 0, `${count} left`);
  }
  if (probe) {
    const swept = await destroyProbes(LABEL);
    check("the probe administrator is gone", swept?.ok !== false, JSON.stringify(swept ?? {}).slice(0, 120));
  }
  if (server) await server.stop();
  await new Promise((resolve) => proxy.close(resolve));
}

console.log("");
if (wrong === 0 && process.exitCode !== 3) {
  console.log("PASS: a stalled database is said, not hidden, and nothing it abandoned is retried.");
  process.exitCode = 0;
} else if (process.exitCode !== 3) {
  console.log(`FAIL: ${wrong} check(s) did not hold.`);
  process.exitCode = 1;
}
