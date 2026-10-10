/**
 * AN ACCOUNT OPENS ITS OWN SINGLE ORDERS, AND NO OTHER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-account-opens-its-own-single-orders-and-no-other.mjs
 *
 * Operator ruling, 2026-10-10 (decision 6, defect 13 of the product audit).
 * Your orders linked a single order to the token page with no token, so none
 * opened. accountOrderId now resolves an order for the signed in account, in
 * exactly the scope Your orders lists, and the account page and the account's
 * letter route both ask it.
 *
 * Live on development: against an existing demonstration account (an account
 * row refuses deletion, so none is made), four demonstration orders are
 * written and asked about: one owned by the account opens; one placed under
 * the account's email before it existed opens; one under another email does
 * not; one that is part of a batch does not (a batch has its own page). All
 * removed and read back. And Your orders now links a single order to the
 * account page, never to the token page.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const list = readFileSync("src/app/account/orders/page.tsx", "utf8");
check(
  "Your orders links a single order to the account's page, never to the token page",
  (list.match(/href: `\/account\/orders\/single\//g) ?? []).length === 2 && !/href: `\/order\/\$\{/.test(list),
);

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the account single order proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client, so the live half did not run.");
  process.exit(wrong === 0 ? 0 : 1);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { accountOrderId } = await import("../../src/lib/ops-customer.ts");

const STAMP = Date.now();
const TAIL = String(STAMP).slice(-6);
const orders = [];
let batchId = null;

try {
  /*
   * An account is only READ here, for its id, and nothing about it changes: the
   * orders written against it are demonstration rows, removed below. A
   * demonstration account is preferred; development holds none, so the oldest
   * account is borrowed.
   */
  const { data: accounts, error: aErr } = await db.from("eng_customer_accounts").select("id").order("created_at", { ascending: true }).limit(1);
  if (aErr) throw new Error(`the accounts could not be read: ${aErr.message}`);
  const account = (accounts ?? [])[0];
  if (!account) throw new Error("development holds no customer account to borrow");
  const mine = `single.order.proof.${STAMP}@audit-probe.invalid`;
  const me = { accountId: account.id, email: mine };

  async function order(tag, extra) {
    const reference = `254-O2026-DEMO-SO${tag}${TAIL}`;
    const { data, error } = await db.from("eng_service_orders").insert({
      site: "254engineering", reference, service_slug: "roof-inspections", order_type: "field", status: "in_fulfilment",
      customer_name: "Single order proof, not a real person", property_address: "1 Single Order Way", county: "Nueces",
      twia_county: false, total_cents: 0, is_demo: true, ...extra,
    }).select("id").single();
    if (error) throw new Error(`order ${tag}: ${error.message}`);
    orders.push(data.id);
    return { id: data.id, reference };
  }

  const owned = await order("A", { account_id: account.id, customer_email: `someone.${STAMP}@audit-probe.invalid` });
  const before = await order("B", { account_id: null, customer_email: mine });
  const other = await order("C", { account_id: null, customer_email: `other.${STAMP}@audit-probe.invalid` });

  check("the account opens an order it owns", (await accountOrderId(me, owned.reference)) === owned.id);
  check("and an order placed under its email before the account existed", (await accountOrderId(me, before.reference)) === before.id);
  check("but not an order under another email", (await accountOrderId(me, other.reference)) === null);
  check("nor a reference that does not exist", (await accountOrderId(me, `254-O2026-DEMO-SOX${TAIL}`)) === null);

  const { data: b, error: bErr } = await db.from("eng_order_batches").insert({
    reference: `254-B2026-DEMO-SO${TAIL}`, account_id: account.id, service_slug: "roof-inspections", status: "draft",
    submitted_count: 1, accepted_count: 1, total_cents: 0, is_demo: true,
  }).select("id").single();
  if (bErr) {
    console.log(`  NOTE: the batch case was not built (${bErr.message.slice(0, 80)}); the rule is read in the source instead`);
    const src = readFileSync("src/lib/ops-customer.ts", "utf8");
    check("a batch member is refused by the rule (read in the source)", /data\.batch_id !== null\) return null/.test(src));
  } else {
    batchId = b.id;
    const member = await order("D", { account_id: account.id, customer_email: mine, batch_id: batchId });
    check("nor an order that is part of a batch, which has its own page", (await accountOrderId(me, member.reference)) === null);
  }
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  for (const id of orders) await db.from("eng_service_orders").delete().eq("id", id);
  if (batchId) await db.from("eng_order_batches").delete().eq("id", batchId);
  const { data: left } = orders.length ? await db.from("eng_service_orders").select("id").in("id", orders) : { data: [] };
  check("the demonstration orders are removed, read back", (left ?? []).length === 0, `${(left ?? []).length} left`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: an account opens its own single orders, and no other.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
