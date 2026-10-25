// @runtime react-server
//
// Declared because part D imports src/lib/ops-payments.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * AN EXISTING CLIENT IS MATCHED BY ITS RECORD.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-existing-client-is-matched-by-its-record.mjs
 *
 * Operator rulings, 2026-10-13:
 *
 *   - An existing client paying from a new email address must not stall.
 *     Match the payer to the existing account by the order's client record,
 *     not by the payment email. If no safe match exists, open nothing and
 *     show it on "Paid, work not released" with a one-click staff action to
 *     attach the account. Prove both paths.
 *   - A match links the ORDER to the account and nothing more: the paying
 *     address is not added as a sign in, is sent no invitation or link, and
 *     the account's email does not change. The confirmation goes to the
 *     account's address on file: its active owner, else its billing email,
 *     else none, and the panel says so. The same for staff attach.
 *   - Prove it: a match by client record with a new paying email leaves the
 *     account's identities and email unchanged and sends nothing to the new
 *     address beyond the payment receipt.
 *
 * The payment receipt is Stripe's, sent by Stripe from its own account; this
 * platform sends no receipt. So "nothing beyond the receipt" is proved as this
 * platform queueing nothing to that address at all, and the preload refusing
 * every connection to Stripe proves the run itself asked Stripe for nothing.
 *
 * HOW IT RUNS. As a-payment-event-is-applied-once does, and for its reason:
 * every money table refuses deletes, so the real production build is started
 * against a replay of every migration served as PostgREST
 * (scripts/lib/replay-rest.mjs), events are signed with a throwaway secret,
 * and scripts/lib/no-stripe-outbound.cjs refuses any connection to Stripe.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_existing_client_proof";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_existing_client_proof";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Stripe from "stripe";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startNextServer } = await import("../lib/dev-server.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

if (!existsSync(".next/BUILD_ID")) {
  console.log("  COULD NOT TELL: no production build on disk, so there is nothing to start. Run the board, or npm run build.");
  process.exit(3);
}

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0075 included", files.some((f) => f.startsWith("0075_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = (name) => `${name}@audit-probe.invalid`;

/*
 * Five cases, each with its own client so no case can satisfy another's check.
 *
 *   match    the client has one active account with an active owner, and the
 *            card was paid from an address nobody has seen
 *   billing  the same, and the account has no owner, only a billing email
 *   none     the same, and the account has no owner and no billing email
 *   conflict the client has an account, and the paying address belongs to a
 *            DIFFERENT account: no rule may choose
 *   closed   the client's only account is suspended: a person decides
 *   dup      the client has one account in use and a second, SUPERSEDED as a
 *            duplicate, on the other site (unique site and client allows
 *            exactly that). Superseded means the record should never have
 *            existed, so it is not a second active account: the match is
 *            safe, and nothing may resolve to the superseded row
 */
const C = { match: 1, billing: 2, none: 3, conflict: 4, closed: 5, other: 6, dup: 7 };
const client = (k) => id(C[k]);
const account = (k) => id(C[k] + 10);
const SUPERSEDED_DUP = id(C.dup + 20);
const ORDERS = { match: 101, billing: 102, none: 103, conflict: 104, closed: 105, dup: 106 };
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);
const OWNER = { match: at("existing-client-owner"), other: at("existing-client-other-owner") };
const BILLING = at("existing-client-billing");
const CONFLICT_BILLING = at("existing-client-conflict-billing");
const DUP_BILLING = at("existing-client-dup-billing");
const DUP_STALE_BILLING = at("existing-client-dup-superseded-billing");
const NEW_PAYER = {
  match: at("existing-client-new-payer"),
  billing: at("existing-client-new-payer-b"),
  none: at("existing-client-new-payer-n"),
  conflict: OWNER.other,
  closed: at("existing-client-new-payer-c"),
  dup: at("existing-client-new-payer-d"),
};

await db.exec(`
  insert into eng_clients (id, kind, name) values
    ${Object.keys(C).map((k) => `('${client(k)}', 'organization', 'Existing client proof ${k}, not a real firm')`).join(",\n    ")};
  insert into eng_customer_accounts (id, site, client_id, status, billing_email) values
    ('${account("match")}', '254', '${client("match")}', 'active', null),
    ('${account("billing")}', '254', '${client("billing")}', 'active', '${BILLING}'),
    ('${account("none")}', '254', '${client("none")}', 'active', null),
    ('${account("conflict")}', '254', '${client("conflict")}', 'active', '${CONFLICT_BILLING}'),
    ('${account("closed")}', '254', '${client("closed")}', 'suspended', null),
    ('${account("other")}', '254', '${client("other")}', 'active', null),
    ('${account("dup")}', '254', '${client("dup")}', 'active', '${DUP_BILLING}');
  insert into eng_customer_accounts
    (id, site, client_id, status, billing_email, superseded_at, superseded_reason, superseded_by_email) values
    ('${SUPERSEDED_DUP}', '254engineering', '${client("dup")}', 'active', '${DUP_STALE_BILLING}',
     now(), 'Opened twice for the same proof client, kept as the duplicate', '${at("existing-client-operator")}');
  insert into eng_customer_users (account_id, email, display_name, status, account_role, origin) values
    ('${account("match")}', '${OWNER.match}', 'Existing client proof owner, not a real person', 'active', 'owner', 'operator_created'),
    ('${account("other")}', '${OWNER.other}', 'Existing client proof other owner, not a real person', 'active', 'owner', 'operator_created');
`);
for (const [k, n] of Object.entries(ORDERS)) {
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-EC-F-${n}', '${client(k)}', 'roof-inspections', '${n} Proof Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id)
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-EC-${n}', 'roof-inspections', 'field',
       'Existing client proof payer, not a real person', '${NEW_PAYER[k]}', '${n} Proof Way', 'Nueces',
       'awaiting_payment', 50000, '${fileId(k)}', '${client(k)}');
  `);
}

/* ------------------------------------------------------- the stand-in and app */

const rest = await startReplayRest(db, PORTS.replayRest);
const PRELOAD = resolve("scripts/lib/no-stripe-outbound.cjs");
let server;
try {
  server = await startNextServer({
    port: PORTS.replayApp,
    timeoutMs: 120_000,
    env: {
      SUPABASE_URL: rest.url,
      SUPABASE_SERVICE_ROLE_KEY: "replay-stand-in",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      ORDER_PAYMENTS_FAKE: "",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(PRELOAD)}`.trim(),
    },
  });
} catch (err) {
  console.log(`  COULD NOT TELL: the production build did not start against the replay: ${err.message}`);
  await rest.close();
  process.exit(3);
}
const APP = server.base;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
let created = 1_760_400_000;
function completed(eventId, k) {
  created += 1;
  return {
    id: eventId, object: "event", api_version: "2024-06-20", type: "checkout.session.completed", livemode: false, created,
    data: {
      object: {
        /* payment_status as Stripe sends it on a paid card session; readEvent records only a paid one (audit finding F11). */
        id: `cs_${eventId}`, object: "checkout.session", payment_intent: `pi_ec_${k}`, amount_total: 50000, payment_status: "paid",
        metadata: { order_id: orderId(k) },
      },
    },
  };
}
async function deliver(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const n = async (sql, params = []) => Number((await one(sql, params))?.n ?? 0);

/* Every identity and every address an account has, so "unchanged" is measured. */
const identities = (acct) =>
  many(
    `select u.id, u.email, u.status, u.account_role, u.password_hash is not null as has_password
       from eng_customer_users u where u.account_id = $1 order by u.id`,
    [acct],
  ).then((rows) => JSON.stringify(rows));
const accountRow = (acct) =>
  one(`select id, client_id, status, billing_email, billing_mode, site from eng_customer_accounts where id = $1`, [acct]).then(
    (r) => JSON.stringify(r),
  );
/* Everything this platform queued to an address, of any kind. */
const mailTo = (address) =>
  n(`select count(*)::int as n from eng_jobs where kind = 'email.send' and lower(payload->>'to') = lower($1)`, [address]);
const confirmationsTo = (order) =>
  many(
    `select payload->>'to' as "to" from eng_jobs where kind = 'email.send' and payload->>'id' = 'order.confirmed' and payload->>'orderId' = $1`,
    [order],
  );
const usersWith = (address) => n(`select count(*)::int as n from eng_customer_users where lower(email) = lower($1)`, [address]);
const tokensFor = (address) =>
  n(
    `select count(*)::int as n from eng_customer_auth_tokens t join eng_customer_users u on u.id = t.customer_user_id where lower(u.email) = lower($1)`,
    [address],
  );
const links = (order) => n(`select count(*)::int as n from eng_customer_access where order_id = $1`, [order]);
const eventsNamed = (order, name) =>
  n(`select count(*)::int as n from eng_order_events where order_id = $1 and event = $2`, [order, name]);
const accountOf = async (order) => (await one(`select account_id from eng_service_orders where id = $1`, [order]))?.account_id ?? null;
const ledgerOf = (eventId) => one(`select status from eng_payment_events where event_id = $1`, [eventId]);

const before = {};
for (const k of Object.keys(C)) before[k] = { ids: await identities(account(k)), row: await accountRow(account(k)) };
const allAccounts = await n(`select count(*)::int as n from eng_customer_accounts`);
const supersededBefore = await accountRow(SUPERSEDED_DUP);

try {
  /* ============ A. a match by client record, owner on file ==================== */
  {
    const first = await deliver(completed("evt_ec_match", "match"));
    check("a match: the payment answers 200", first.status === 200, `${first.status} ${JSON.stringify(first.body)}`);
    check("a match: the order is linked to its client's account", (await accountOf(orderId("match"))) === account("match"));
    check("a match: says it was linked by the client record", (await eventsNamed(orderId("match"), "account.linked_by_client")) === 1);
    check("a match: the payment event is done", (await ledgerOf("evt_ec_match"))?.status === "done");
    check(
      "a match: the account's identities are unchanged",
      (await identities(account("match"))) === before.match.ids,
      await identities(account("match")),
    );
    check("a match: the account's row and email are unchanged", (await accountRow(account("match"))) === before.match.row);
    check("a match: the paying address is not a sign in anywhere", (await usersWith(NEW_PAYER.match)) === 0);
    check("a match: no sign in or set password link was issued to it", (await tokensFor(NEW_PAYER.match)) === 0);
    check(
      "a match: this platform queued nothing to the paying address",
      (await mailTo(NEW_PAYER.match)) === 0,
      `${await mailTo(NEW_PAYER.match)} message(s)`,
    );
    const to = await confirmationsTo(orderId("match"));
    check(
      "a match: one confirmation, to the account's active owner",
      to.length === 1 && to[0].to === OWNER.match,
      JSON.stringify(to),
    );
    check("a match: no second account was opened", (await n(`select count(*)::int as n from eng_customer_accounts`)) === allAccounts);

    const again = await deliver(completed("evt_ec_match", "match"));
    check(
      "a match delivered again: 200, and still one confirmation and nothing to the payer",
      again.status === 200 && (await confirmationsTo(orderId("match"))).length === 1 && (await mailTo(NEW_PAYER.match)) === 0,
      `${again.status}`,
    );
  }

  /* ============ B. a match, billing email only ================================ */
  {
    const r = await deliver(completed("evt_ec_billing", "billing"));
    const to = await confirmationsTo(orderId("billing"));
    check(
      "no active owner: the confirmation goes to the billing email, and the payment is done",
      r.status === 200 && to.length === 1 && to[0].to === BILLING && (await ledgerOf("evt_ec_billing"))?.status === "done",
      `${r.status} ${JSON.stringify(to)}`,
    );
    check(
      "no active owner: the account and its identities are unchanged, and the payer is sent nothing",
      (await identities(account("billing"))) === before.billing.ids &&
        (await accountRow(account("billing"))) === before.billing.row &&
        (await mailTo(NEW_PAYER.billing)) === 0 &&
        (await usersWith(NEW_PAYER.billing)) === 0,
    );
  }

  /* ============ B2. a match beside a superseded duplicate ===================== */
  {
    const r = await deliver(completed("evt_ec_dup", "dup"));
    const to = await confirmationsTo(orderId("dup"));
    check(
      "a superseded duplicate is not a second account: the order is linked to the one in use and the payment is done",
      r.status === 200 &&
        (await accountOf(orderId("dup"))) === account("dup") &&
        (await eventsNamed(orderId("dup"), "account.match_needed")) === 0 &&
        (await ledgerOf("evt_ec_dup"))?.status === "done",
      `${r.status} ${JSON.stringify(r.body)} account ${await accountOf(orderId("dup"))}`,
    );
    check(
      "and the confirmation goes to the account in use, never to the superseded record's address",
      to.length === 1 && to[0].to === DUP_BILLING && (await mailTo(DUP_STALE_BILLING)) === 0,
      JSON.stringify(to),
    );
    check(
      "and the superseded record, and the payer, are untouched",
      (await accountRow(SUPERSEDED_DUP)) === supersededBefore &&
        (await identities(SUPERSEDED_DUP)) === "[]" &&
        (await mailTo(NEW_PAYER.dup)) === 0 &&
        (await usersWith(NEW_PAYER.dup)) === 0,
    );
  }

  /* ============ C. a match, no address on file ================================ */
  {
    const r = await deliver(completed("evt_ec_none", "none"));
    check(
      "no address on file: linked, nothing sent to anybody, and the payment stays claimed",
      r.status >= 400 &&
        (await accountOf(orderId("none"))) === account("none") &&
        (await confirmationsTo(orderId("none"))).length === 0 &&
        (await mailTo(NEW_PAYER.none)) === 0 &&
        (await links(orderId("none"))) === 0 &&
        (await ledgerOf("evt_ec_none"))?.status === "claimed",
      `${r.status} ${JSON.stringify(r.body)}`,
    );
    await deliver(completed("evt_ec_none", "none"));
    check("no address on file: says so once across two deliveries", (await eventsNamed(orderId("none"), "email.no_account_address")) === 1);
  }

  /* ============ D. no safe match, and the staff action ======================== */
  {
    const conflict = await deliver(completed("evt_ec_conflict", "conflict"));
    check(
      "the paying address belongs to another account: nothing opened, attached, linked or sent, and the payment stays claimed",
      conflict.status >= 400 &&
        (await accountOf(orderId("conflict"))) === null &&
        (await links(orderId("conflict"))) === 0 &&
        (await confirmationsTo(orderId("conflict"))).length === 0 &&
        (await n(`select count(*)::int as n from eng_customer_accounts`)) === allAccounts &&
        (await ledgerOf("evt_ec_conflict"))?.status === "claimed",
      `${conflict.status} ${JSON.stringify(conflict.body)}`,
    );
    const closed = await deliver(completed("evt_ec_closed", "closed"));
    check(
      "the client's only account is suspended: nothing opened or attached, the payment stays claimed",
      closed.status >= 400 && (await accountOf(orderId("closed"))) === null && (await ledgerOf("evt_ec_closed"))?.status === "claimed",
      `${closed.status}`,
    );
    await deliver(completed("evt_ec_conflict", "conflict"));
    check(
      "no safe match: says why once across two deliveries",
      (await eventsNamed(orderId("conflict"), "account.match_needed")) === 1,
    );

    process.env.SUPABASE_URL = rest.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
    const { ordersAwaitingAccount, attachOrderToAccount, accountCandidatesFor } = await import("../../src/lib/ops-payments.ts");

    /* A person is never offered the superseded record either. */
    const dupOffered = await accountCandidatesFor(orderId("dup"));
    check(
      "a person is offered the account in use and never the superseded duplicate",
      JSON.stringify((dupOffered ?? []).map((c) => c.accountId)) === JSON.stringify([account("dup")]),
      JSON.stringify(dupOffered),
    );

    const panel = await ordersAwaitingAccount();
    const row = (k) => (panel ?? []).find((o) => o.orderId === orderId(k));
    check(
      "the panel lists the conflict with exactly its client's account and the paying address's account",
      row("conflict")?.needs === "account" &&
        JSON.stringify(row("conflict").candidates.map((c) => [c.accountId, c.because]).sort()) ===
          JSON.stringify([[account("conflict"), "the order's client"], [account("other"), "the paying address"]].sort()),
      JSON.stringify(row("conflict")),
    );
    check("the panel lists the suspended one, naming the account's state", /suspended/.test(row("closed")?.reason ?? ""), row("closed")?.reason);
    check("the panel lists the order with no address on file, as needing an address", row("none")?.needs === "address");
    check("the panel does not list a matched order", !row("match") && !row("billing"));

    const staff = (grants) => ({
      id: id(900),
      role: "admin",
      status: "active",
      grants: new Set(grants),
      email: at("existing-client-staff"),
    });
    const refused = await attachOrderToAccount(staff(["payments.reconcile"]), orderId("conflict"), account("conflict"));
    check("attaching without accounts.manage is refused", !refused.ok && refused.status === 403, JSON.stringify(refused));
    const stranger = await attachOrderToAccount(staff(["accounts.manage"]), orderId("conflict"), account("billing"));
    check(
      "attaching to an account the order does not offer is refused",
      !stranger.ok && stranger.status === 400 && (await accountOf(orderId("conflict"))) === null,
      JSON.stringify(stranger),
    );

    const otherBefore = await identities(account("other"));
    const attached = await attachOrderToAccount(staff(["accounts.manage"]), orderId("conflict"), account("conflict"));
    const to = await confirmationsTo(orderId("conflict"));
    check(
      "a person attaches it: the order names the account, the payment is done, and its work is released",
      attached.ok && attached.released &&
        (await accountOf(orderId("conflict"))) === account("conflict") &&
        (await ledgerOf("evt_ec_conflict"))?.status === "done" &&
        (await links(orderId("conflict"))) === 1,
      JSON.stringify(attached),
    );
    check(
      "attached: one confirmation, to the chosen account's address on file, not to the address that paid",
      to.length === 1 && to[0].to === CONFLICT_BILLING,
      JSON.stringify(to),
    );
    check(
      "attached: no identity added to either account, the account unchanged, and the paying address sent nothing",
      (await identities(account("conflict"))) === before.conflict.ids &&
        (await identities(account("other"))) === otherBefore &&
        (await accountRow(account("conflict"))) === before.conflict.row &&
        (await mailTo(NEW_PAYER.conflict)) === 0,
      `${await mailTo(NEW_PAYER.conflict)} message(s) to the paying address`,
    );
    check(
      "attached: it leaves the panel",
      !((await ordersAwaitingAccount()) ?? [{ orderId: orderId("conflict") }]).some((o) => o.orderId === orderId("conflict")),
    );
    check(
      "attached: audited as the person who did it",
      (await n(
        `select count(*)::int as n from eng_audit_events where action = 'order.account_attached' and entity_id = $1 and actor_email = $2`,
        [orderId("conflict"), at("existing-client-staff")],
      )) === 1,
    );
    const twice = await attachOrderToAccount(staff(["accounts.manage"]), orderId("conflict"), account("other"));
    check(
      "attaching an order that already has an account is refused and changes nothing",
      !twice.ok && twice.status === 409 && (await accountOf(orderId("conflict"))) === account("conflict"),
      JSON.stringify(twice),
    );
  }
} finally {
  await server.stop();
  await rest.close();
}

/* ============================ E. nothing reached Stripe ======================= */
{
  const log = readFileSync(server.logPath, "utf8");
  const refusals = (log.match(/\[no-stripe-outbound\] refused/g) ?? []).length;
  check("no call reached Stripe", !/ACCOUNT MISMATCH/.test(log), `${refusals} outbound attempt${refusals === 1 ? "" : "s"} refused`);
}

await db.close();
console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: an existing client is matched by its record, the order and nothing more, and a person decides where no rule can.");
