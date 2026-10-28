/**
 * PROOF: THE ACCOUNTS SCREEN REFUSES WHAT IT COULD NOT READ.
 *
 * Operator ruling, 2026-09-24: chunk the `.in()` reads, and a failed read must
 * fail loudly rather than become zeros.
 *
 * =============================================================================
 * WHAT WAS WRONG, MEASURED RATHER THAN ARGUED
 * =============================================================================
 *
 * `accountRows()` passed every account id into four `.in()` filters at once.
 * Measured against development, one filter, ids sliced:
 *
 *     in(300):    145ms  filter 11099 chars  ok
 *     in(400):   8116ms  filter 14799 chars  ERROR TypeError: fetch failed
 *
 * A cliff, not a gradient: a request too large for the transport. Development
 * holds well over 400 accounts, so all four failed, every time. Each failure
 * was turned into an empty list by `?? []`, and the screen rendered every
 * account as "Unknown organization" with no orders, no seats and no open
 * statement, beside real outstanding balances, after two minutes.
 *
 * =============================================================================
 * SINCE 2026-10-28 THE SCREEN IS PAGED, AND THIS PROOF FOLLOWED IT
 * =============================================================================
 *
 * Robert's answer 4 of 2026-10-28: the list reads one page of fifty in full,
 * so the orders, seats and open statements are read for fifty ids and never
 * reach the cliff. ONE path still reads a value for every account through the
 * chunked reader: sorting by organization name, which needs every name. So the
 * injection is asked of that path, and the default page is asked what it can
 * still be asked: that it computes, names every account it shows, and counts
 * over every account rather than the page.
 *
 * The order and seat reads used to be proved by "some account somewhere has
 * an order". A page of fifty need not hold one, so this proof now FINDS an
 * account with an order and one with a seat, searches the screen for each by
 * its organization's name, and asserts the row it finds says so. That asks
 * the search as well, over every account, which the old shape never could.
 *
 * =============================================================================
 * WHY THE INJECTION IS THE CHUNK SIZE
 * =============================================================================
 *
 * The honest way to prove a failure path is to make the failure happen, not to
 * stub a client into returning an error. Raising `IN_FILTER_CHUNK` back above
 * the cliff reproduces the ORIGINAL defect exactly, in the real database, over
 * the real query, and asks the code what it does about it. The answer must be
 * a refusal with a reason, never a page of zeros.
 *
 * It patches the constant on disk and reads the world in a CHILD PROCESS,
 * because a module level constant is read once and a fresh import is not fresh
 * enough. It restores in a `finally` and verifies the restore.
 *
 * THE SUBJECT IS ASSERTED FIRST. Below roughly 350 accounts the oversized
 * filter would succeed and the injection would prove nothing, so this refuses
 * to report anything unless the database actually holds enough accounts to
 * cross the cliff.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const BOUNDED = "src/lib/bounded-read.ts";
const BACKUP = "src/lib/bounded-read.ts.accounts-proof.bak";
const OVER_THE_CLIFF = 600;

const READER = `
process.loadEnvFile(".env.local");
const { accountRows } = await import("../../src/lib/ops-accounts-admin.ts");
const { accountListQuery, ACCOUNT_PAGE_SIZE } = await import("../../src/lib/account-list.ts");
const targets = JSON.parse(process.env.ACCOUNTS_PROOF_TARGETS || "{}");
const unknown = (rows) => rows.filter((r) => r.clientName === "Unknown organization").length;
const summary = (r) =>
  r.ok
    ? { ok: true, all: r.all, total: r.total, shown: r.rows.length, unknownNames: unknown(r.rows), blockedUnknown: unknown(r.blocked) }
    : { ok: false, unavailable: r.unavailable };

async function findRow(target) {
  if (!target) return null;
  for (let page = 1; page <= 80; page += 1) {
    const r = await accountRows(accountListQuery({ q: target.name, page: String(page) }));
    if (!r.ok) return { error: r.unavailable.join(" | ") };
    const row = r.rows.find((x) => x.id === target.id);
    if (row) return { found: true, orders: row.orders, users: row.users, total: r.total, all: r.all };
    if (page >= r.pages) return { found: false, total: r.total, all: r.all };
  }
  return { found: false };
}

const began = Date.now();
const first = await accountRows();
const took = Date.now() - began;
const byName = await accountRows(accountListQuery({ sort: "name" }));
const out = {
  took,
  pageSize: ACCOUNT_PAGE_SIZE,
  first: summary(first),
  byName: summary(byName),
  withOrder: process.env.ACCOUNTS_PROOF_SKIP_FIND ? null : await findRow(targets.order),
  withSeat: process.env.ACCOUNTS_PROOF_SKIP_FIND ? null : await findRow(targets.seat),
};
console.log(JSON.stringify(out));
`;

const READER_PATH = "scripts/proofs/.accounts-proof-reader.mts";

function readWorld(label, targets, skipFind = false) {
  writeFileSync(READER_PATH, READER);
  try {
    const r = spawnSync("npx", ["tsx", "--conditions=react-server", READER_PATH], {
      encoding: "utf8",
      shell: true,
      maxBuffer: 32 * 1024 * 1024,
      env: {
        ...process.env,
        ACCOUNTS_PROOF_TARGETS: JSON.stringify(targets ?? {}),
        ...(skipFind ? { ACCOUNTS_PROOF_SKIP_FIND: "1" } : {}),
      },
    });
    const line = (r.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"))
      .pop();
    if (!line) {
      console.error(`could not read the world ${label}. stderr:\n${(r.stderr || "").slice(-900)}`);
      process.exit(1);
    }
    return JSON.parse(line);
  } finally {
    try {
      unlinkSync(READER_PATH);
    } catch {}
  }
}

/*
 * proofs-audit keeps only a proof's last line, so the names of the checks that
 * failed travel on it. Board 40755884083 read "2 check(s) wrong." and nothing
 * else, which left the cause to be inferred.
 */
let wrong = 0;
const failed = [];
const check = (name, ok, note) => {
  if (!ok) {
    wrong += 1;
    failed.push(`${name}${note ? ` (${String(note).slice(0, 160)})` : ""}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

// ------------------------------------------------- the chunk size is declared

const source = readFileSync(BOUNDED, "utf8");
const declared = /export const IN_FILTER_CHUNK = (\d+);/.exec(source);
check("the chunk size is a declared constant", declared !== null, declared ? declared[1] : "not found");
const chunk = declared ? Number(declared[1]) : 0;
check(
  `and it is below the measured cliff (${chunk} against the last size that worked, 300)`,
  chunk > 0 && chunk <= 300,
  "the last size that WORKED is not a safe size to choose: the limit is on the whole request, not on this filter",
);

// --------------------------------------- an account with an order, and a seat

/*
 * Found by the proof's own read, through the one client construction scripts
 * are allowed (db-target), so the screen is asked about an account that is
 * known to have one rather than about whichever fifty happen to be first.
 */
const { auditClient } = await import("../lib/db-target.mjs");
const db = auditClient("the accounts screen proof");
if (!db) {
  console.error("No database is configured here, so there is no screen to ask. This proof runs where .env.local exists.");
  process.exit(1);
}
async function accountWith(table, filter) {
  let q = db.from(table).select("account_id").not("account_id", "is", null);
  if (filter) q = filter(q);
  const { data, error } = await q.order("account_id", { ascending: true }).limit(1);
  if (error || !data?.length) return null;
  const id = data[0].account_id;
  const { data: account } = await db.from("eng_customer_accounts").select("id, client_id").eq("id", id).maybeSingle();
  if (!account) return null;
  const { data: client } = await db.from("eng_clients").select("name").eq("id", account.client_id).maybeSingle();
  return client?.name ? { id, name: client.name } : null;
}
const targets = {
  order: await accountWith("eng_service_orders"),
  seat: await accountWith("eng_customer_users", (q) => q.eq("status", "active")),
};
check("an account with an order exists to ask about", targets.order !== null, targets.order ? "found" : "none on this database");
check("an account with an active seat exists to ask about", targets.seat !== null, targets.seat ? "found" : "none on this database");

// ------------------------------------------------------------ as it stands

const healthy = readWorld("as it stands", targets);
const first = healthy.first;

check("the screen computes", first.ok === true, first.ok ? `page of ${first.shown} from ${first.all} accounts in ${healthy.took}ms` : JSON.stringify(first.unavailable));

check(
  `the database holds enough accounts to cross the cliff (${first.all ?? 0})`,
  (first.all ?? 0) > 350,
  (first.all ?? 0) > 350
    ? "so the injection below is a real oversized request rather than a hypothetical"
    : "FEWER THAN 350, so an oversized filter would succeed and the injection would prove nothing",
);

check(
  "one page is shown, and the count is over every account rather than the page",
  first.ok === true && first.shown <= healthy.pageSize && first.total === first.all && first.all > first.shown,
  `${first.shown} shown, ${first.total} matching, ${first.all} in all`,
);

check(
  "no account on the page renders as an unnamed organization",
  first.ok === true && first.unknownNames === 0,
  `${first.unknownNames ?? "?"} of ${first.shown ?? "?"} read "Unknown organization"`,
);
check(
  "nor does any account the warning names",
  first.ok === true && first.blockedUnknown === 0,
  `${first.blockedUnknown ?? "?"} unnamed`,
);

check(
  "sorted by name, every account's name is read and the page is named",
  healthy.byName.ok === true && healthy.byName.unknownNames === 0 && healthy.byName.all === first.all,
  healthy.byName.ok ? `${healthy.byName.shown} shown of ${healthy.byName.all}` : JSON.stringify(healthy.byName.unavailable),
);

/*
 * The orders and the seats each come from a DIFFERENT read. Asserting only the
 * names would leave two reads covered by nothing, which is how a green comes to
 * be over a fraction of a fix.
 */
check(
  "searched by its organization's name, an account with an order is found and shows it",
  healthy.withOrder?.found === true && healthy.withOrder.orders > 0,
  JSON.stringify(healthy.withOrder),
);
check(
  "searched by its organization's name, an account with a seat is found and shows it",
  healthy.withSeat?.found === true && healthy.withSeat.users > 0,
  JSON.stringify(healthy.withSeat),
);
check(
  "and a search is counted over every account, not one page",
  healthy.withOrder?.found === true && healthy.withOrder.all === first.all && healthy.withOrder.total <= first.all,
  healthy.withOrder ? `${healthy.withOrder.total} matching of ${healthy.withOrder.all}` : "",
);

// ----------------------------------- the injection: put the chunk over the cliff

copyFileSync(BOUNDED, BACKUP);
let injected = null;
try {
  const anchor = `export const IN_FILTER_CHUNK = ${chunk};`;
  if (source.split(anchor).length - 1 !== 1) {
    console.error(`bounded-read.ts does not carry exactly one ${anchor}`);
    process.exit(1);
  }
  writeFileSync(BOUNDED, source.replace(anchor, `export const IN_FILTER_CHUNK = ${OVER_THE_CLIFF};`));
  injected = readWorld(`with the chunk at ${OVER_THE_CLIFF}`, targets, true);
} finally {
  copyFileSync(BACKUP, BOUNDED);
  unlinkSync(BACKUP);
  const restored = readFileSync(BOUNDED, "utf8");
  if (restored !== source) {
    console.error(`RESTORE FAILED on ${BOUNDED}. It is not byte identical to what this proof read.`);
    process.exit(1);
  }
  console.log(`\n${BOUNDED} restored byte identical, chunk back at ${chunk}.\n`);
}

check(
  "with the chunk over the cliff, the list sorted by name REFUSES rather than stating unnamed accounts",
  injected.byName.ok === false,
  injected.byName.ok === false
    ? injected.byName.unavailable.join(" | ").slice(0, 200)
    : `it returned ${injected.byName.shown} rows, ${injected.byName.unknownNames} of them unnamed. This is the original defect, and it is back.`,
);

check(
  "and the refusal names which read failed",
  injected.byName.ok === false && injected.byName.unavailable.some((u) => /names/i.test(u)),
  injected.byName.ok === false ? `${injected.byName.unavailable.length} reason(s)` : "",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. A read that fails is an absence, not a page of zeros."
    : `\n${wrong} check(s) wrong: ${failed.join(" | ")}`,
);
process.exitCode = wrong === 0 ? 0 : 1;
