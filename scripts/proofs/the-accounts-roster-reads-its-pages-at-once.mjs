// @runtime react-server
/**
 * THE ACCOUNTS ROSTER ASKS FOR ITS PAGES AT ONCE, AND READS EXACTLY WHAT THE
 * PAGE-BY-PAGE READ DID.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-accounts-roster-reads-its-pages-at-once.mjs
 *
 * Robert's overnight list of 2026-11-25, item 3, for question 5 of 7137015658.
 * The `/portal/accounts` roster read 5,366 accounts in six pages, each waiting
 * for the one before, and the six page times added up exactly to the roster's
 * (profile 7131172223). `readEveryAtOnce` in src/lib/bounded-read.ts asks for
 * the pages together.
 *
 * What this proves, with no database, against a fake that answers each page
 * after a fixed delay and records how many requests were in flight together:
 *
 *   1. It returns the same rows in the same order as readEvery, at every size
 *      that matters: empty, one short page, an exact multiple of the page, the
 *      development roster's 5,366, and more than one batch.
 *   2. It waits about one round trip for a set that fits in a batch, where
 *      readEvery waits one per page. Measured as requests in flight, not wall
 *      time, so a slow machine cannot make it pass or fail.
 *   3. A failed page fails the whole read, as readEvery does.
 *   4. A page past the end that carries rows fails it, because the set moved
 *      while it was read.
 *   5. The roster read in ops-accounts-admin.ts calls it, on the same query.
 */
import { readFileSync } from "node:fs";
import { readEvery, readEveryAtOnce } from "../../src/lib/bounded-read.ts";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PAGE = 1000;

/* A table of n rows, answered a page at a time after a delay, counting concurrency. */
function fakeTable(n, options = {}) {
  const stats = { requests: 0, inFlight: 0, peak: 0, waves: 0 };
  let lastStart = -1;
  const build = (from, to) =>
    new Promise((resolve) => {
      stats.requests += 1;
      stats.inFlight += 1;
      stats.peak = Math.max(stats.peak, stats.inFlight);
      /* A new wave is a request that starts when nothing else is in flight. */
      if (stats.inFlight === 1) stats.waves += 1;
      lastStart = from;
      setTimeout(() => {
        stats.inFlight -= 1;
        if (options.failAt === from) return resolve({ data: null, count: null, error: { message: "fake page failed" } });
        const extra = options.movedAt === from ? [{ i: -1 }] : [];
        const rows = [];
        for (let i = from; i <= Math.min(to, n - 1); i += 1) rows.push({ i });
        resolve({ data: [...rows, ...extra], count: null, error: null });
      }, 5);
    });
  return { build, stats, lastStart: () => lastStart };
}

const same = (a, b) => a.length === b.length && a.every((r, i) => r.i === b[i].i);

for (const n of [0, 999, 1000, 5366, 8000, 9001, 17500]) {
  const seq = fakeTable(n);
  const one = await readEvery(seq.build, { pageSize: PAGE });
  const par = fakeTable(n);
  const all = await readEveryAtOnce(par.build, { pageSize: PAGE });
  check(
    `${n} rows: the same rows in the same order as readEvery`,
    one.ok && all.ok && same(one.rows, all.rows) && all.rows.length === n && all.complete === true,
    all.ok ? `${all.rows.length} read` : all.error,
  );
  if (n === 5366) {
    check(
      "5,366 rows, development's roster: one wave of requests where readEvery took one per page",
      par.stats.waves === 1 && seq.stats.waves === 6 && par.stats.peak === 8,
      `at once: ${par.stats.waves} wave(s), ${par.stats.requests} requests, ${par.stats.peak} in flight together; page by page: ${seq.stats.waves} waves`,
    );
  }
  if (n === 9001) {
    check(
      "9,001 rows, past one batch of eight: a second wave, and only because the first came back full",
      par.stats.waves === 2 && par.stats.requests === 16,
      `${par.stats.waves} waves, ${par.stats.requests} requests`,
    );
  }
}

{
  const t = fakeTable(5366, { failAt: 2000 });
  const r = await readEveryAtOnce(t.build, { pageSize: PAGE });
  check("a page that fails fails the whole read, never a shorter roster", !r.ok && /fake page failed/.test(r.error ?? ""), r.ok ? `${r.rows.length} rows returned` : r.error);
}
{
  /* Page 7 (rows 7000 on) answers with a row although page 6 came back short. */
  const t = fakeTable(5366, { movedAt: 7000 });
  const r = await readEveryAtOnce(t.build, { pageSize: PAGE });
  check("a page past the end that carries rows fails the read, because the set moved", !r.ok && /changed while it was being read/.test(r.error ?? ""), r.ok ? `${r.rows.length} rows returned` : r.error);
}
{
  /* The control for the check above: the same moved row, read page by page, is silently missed. */
  const t = fakeTable(5366, { movedAt: 7000 });
  const r = await readEvery(t.build, { pageSize: PAGE });
  check("and readEvery, given the same table, stops early without noticing (the control)", r.ok && r.rows.length === 5366);
}

const admin = readFileSync("src/lib/ops-accounts-admin.ts", "utf8");
check(
  "the /portal/accounts roster calls readEveryAtOnce, on the roster's own query and order",
  /const accountRead = await readEveryAtOnce<Record<string, unknown>>\(/.test(admin) &&
    /\.from\("eng_customer_accounts"\)\s*\.select\("id, client_id, status, billing_mode, credit_limit_cents, net_days, created_at, superseded_at"\)\s*\.order\("created_at", \{ ascending: true \}\)\s*\.order\("id", \{ ascending: true \}\)\s*\.range\(from, to\)/.test(admin),
);
check("and its timing line says the pages were asked for at once", /pages at once=\$\{rosterPages\.join\("\/"\)\}ms/.test(admin));

console.log("");
if (wrong === 0) {
  console.log("PASS: the accounts roster asks for its pages at once and reads exactly what the page-by-page read did.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
