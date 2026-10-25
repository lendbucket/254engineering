// @runtime react-server
//
// Declared because it imports src/lib/ops-bulk.ts, which carries server-only.

/**
 * A BULK SUBMISSION'S KEY ANSWERS ONLY ITS OWN ACCOUNT, AND EVERY ORDER IN A
 * BATCH IS JOINED TO IT OR COUNTED AS A FAILURE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-submission-key-answers-only-its-own-account.mjs
 *
 * Robert's audit of 2026-10-24.
 *
 * F5. placeBatch found an existing batch by client_request_id alone, and that
 * key is unique across every account (0009). A second account or API client
 * sending a key another account had used got the first account's batch back,
 * references, shares and total, and the bulk and v1 routes then opened
 * checkout on it. The duplicate's orders read ignored its error, and its
 * billing mode was always reported as card. Driven here against a fake
 * PostgREST, the duplicate path only, which is where every one of those lived.
 *
 * F4. The update joining each placed order to its batch discarded its result,
 * so an order whose join failed was still counted and charged as accepted.
 * Asserted on the source: reaching that update in process needs the whole
 * placement path faked, and this proof does not pretend to have done that.
 */
process.env.SUPABASE_URL = "http://batch-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "batch-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const MINE = "00000000-0000-4000-8000-0000000000a1";
const THEIRS = "00000000-0000-4000-8000-0000000000a2";
const BATCH = "00000000-0000-4000-8000-0000000000b1";
const state = { owner: THEIRS, failBatch: false, failOrders: false, mode: "invoice" };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const fail = (what) => json({ message: `proof: the ${what} read failed`, code: "XX000" }, 500);
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_order_batches") {
    if (state.failBatch) return fail("batch");
    return json([{ id: BATCH, reference: "254-B-PROOF-0001", total_cents: 141800, status: "accepted", account_id: state.owner }]);
  }
  if (table === "eng_service_orders") {
    if (state.failOrders) return fail("orders");
    return json([
      { id: "o1", reference: "254-PROOF-0001", batch_share_cents: 70900, billing_mode: state.mode },
      { id: "o2", reference: "254-PROOF-0002", batch_share_cents: 70900, billing_mode: state.mode },
    ]);
  }
  return json([]);
};

const { placeBatch } = await import("../../src/lib/ops-bulk.ts");
const submit = () =>
  placeBatch({
    site: "254engineering",
    clientRequestId: "the-same-key",
    accountId: MINE,
    serviceSlug: "roof-inspections",
    customer: { name: "Batch proof, not a real person", email: "batch-proof@audit-probe.invalid" },
    properties: [],
  });

state.owner = THEIRS;
const other = await submit();
check(
  "a key another account already used is refused, and nothing of that account's batch is returned",
  other.ok === false && !JSON.stringify(other).includes("254-B-PROOF-0001") && !JSON.stringify(other).includes("70900"),
  JSON.stringify(other),
);

state.owner = MINE;
const own = await submit();
check("this account's own retry finds its batch", own.ok === true && own.duplicate === true && own.reference === "254-B-PROOF-0001", JSON.stringify(own));
check("and reports the batch's own billing mode, invoice here, rather than card", own.ok === true && own.billingMode === "invoice", own.ok ? own.billingMode : "");

state.mode = "card";
const card = await submit();
check("a card batch still reads as card", card.ok === true && card.billingMode === "card", card.ok ? card.billingMode : "");

state.failOrders = true;
const noOrders = await submit();
check("a failed read of the batch's orders is said, never a batch with no orders", noOrders.ok === false && /could not be read/.test(noOrders.error), JSON.stringify(noOrders));
state.failOrders = false;

state.failBatch = true;
const noBatch = await submit();
check("a failed read of whether the key was used places nothing", noBatch.ok === false && /nothing was placed/.test(noBatch.error), JSON.stringify(noBatch));

const source = readFileSync("src/lib/ops-bulk.ts", "utf8");
check(
  "F4: the join of each order to its batch is checked, and a failed join is a failure for that property",
  /const \{ data: linked, error: linkError \} = await db\s*\.from\("eng_service_orders"\)\s*\.update\(\{\s*batch_id: batch\.id,/.test(source) &&
    /if \(linkError \|\| !linked \|\| linked\.length !== 1\) \{\s*failures\.push\(/.test(source),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a submission key answers only its own account, and an order is joined to its batch or counted as a failure.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
