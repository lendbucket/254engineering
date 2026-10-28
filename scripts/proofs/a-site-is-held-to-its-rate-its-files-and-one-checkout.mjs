/**
 * A SITE IS HELD TO ITS RATE, ITS OWN FILES, AND ONE CHECKOUT PER ORDER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-site-is-held-to-its-rate-its-files-and-one-checkout.mjs
 *
 * Robert's ruling 6 of 2026-10-27, 22:05 Central, before Sealed's ordering
 * opens: "a 20 a minute per-site limit on /api/orders; a signed upload door for
 * sister-site files; and a fresh checkout returned when a repeated request
 * finds an unpaid order." The Sealed switch stays closed.
 *
 * No database. Four things are proved:
 *   1. the rate: twenty, pinned here as a literal (CLAUDE.md 6c); a count that
 *      could not be read refuses rather than opening; the request is recorded
 *      even when it is refused, and nothing is recorded when the count fails.
 *      The counting function is driven with an injected client.
 *   2. the files: an order or quote may attach only a file under its own
 *      request in the uploads bucket.
 *   3. the repeat: an unpaid order is given a checkout again; any other state
 *      gets its status and no checkout.
 *   4. the door: the limit is asked after the switch and the gate and before
 *      anything is signed, placed or priced; the upload is signed by the same
 *      function 254's order flow uses; the file rule is asked before an order
 *      is placed; a repeat reads the order's state and asks the repeat rule.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const rules = await import("../../src/lib/sister-order-door-rules.ts");
const door = await import("../../src/lib/sister-order-door.ts");

/* ------------------------------------------------------------- 1. the rate */
/* THE RULING, AS A LITERAL. Moving it is an edit to the rules file AND to this line. */
check("the limit is twenty requests a minute per site (ruling 6)", rules.SITE_ORDER_RATE_PER_MINUTE === 20, String(rules.SITE_ORDER_RATE_PER_MINUTE));
check("nineteen before this one is allowed", rules.siteOrderRateRefusal(19) === null);
const over = rules.siteOrderRateRefusal(20);
check("twenty before this one is refused with 429", over?.status === 429, JSON.stringify(over));
check("and the refusal says what failed and that nothing was placed", /More than 20 requests in a minute from this site/.test(over?.error ?? "") && /Nothing was placed/.test(over?.error ?? ""), over?.error);
check("a count that could not be read refuses with 503 rather than opening", rules.siteOrderRateRefusal(null)?.status === 503);
check("and so does a count that is not a number", rules.siteOrderRateRefusal(Number.NaN)?.status === 503);

/* The counting function, with a client that answers what the proof says and records what it was asked. */
function fakeDb({ count, countError = null, insertError = null }) {
  const inserted = [];
  const filters = [];
  return {
    inserted,
    filters,
    from(table) {
      return {
        select() {
          const q = {
            eq(col, val) { filters.push([table, col, val]); return q; },
            gte(col) { filters.push([table, col, "since"]); return Promise.resolve({ count, error: countError }); },
          };
          return q;
        },
        insert(row) { inserted.push([table, row]); return Promise.resolve({ error: insertError }); },
      };
    },
  };
}

const under = fakeDb({ count: 3 });
check("under the limit the request is allowed", (await door.siteOrderRate("sealed", "order", under)) === null);
check("and it is recorded, with its site and intent, in the request log", under.inserted.length === 1 && under.inserted[0][0] === "eng_site_order_requests" && under.inserted[0][1].site === "sealed" && under.inserted[0][1].intent === "order", JSON.stringify(under.inserted));
check("and the count was of this site's rows only", under.filters.some(([t, c, v]) => t === "eng_site_order_requests" && c === "site" && v === "sealed"), JSON.stringify(under.filters));

const hammer = fakeDb({ count: 25 });
const hammered = await door.siteOrderRate("sealed", "unreadable", hammer);
check("over the limit the request is refused with 429", hammered?.status === 429);
check("and is still recorded, so a caller that keeps hammering stays held", hammer.inserted.length === 1);

const blind = fakeDb({ count: null, countError: { message: "timeout" } });
check("a failed count refuses with 503", (await door.siteOrderRate("sealed", "order", blind))?.status === 503);
check("and records nothing", blind.inserted.length === 0);

const unwritten = fakeDb({ count: 1, insertError: { message: "refused" } });
check("a request that cannot be recorded refuses with 503, because the limit would not hold", (await door.siteOrderRate("sealed", "order", unwritten))?.status === 503);

/* ------------------------------------------------------------- 2. the files */
const mine = { key: "plans", bucket: "eng-uploads", storageKey: "orders/req-1/plans/a.pdf" };
check("a file under this request in the uploads bucket is accepted", rules.siteFileProblem("req-1", [mine]) === null);
check("no files is accepted", rules.siteFileProblem("req-1", []) === null);
check("a file under another request is refused", typeof rules.siteFileProblem("req-1", [mine, { ...mine, storageKey: "orders/req-2/plans/b.pdf" }]) === "string");
check("a file from another bucket is refused", typeof rules.siteFileProblem("req-1", [{ ...mine, bucket: "eng-documents" }]) === "string");
check("a file from the status space is refused", typeof rules.siteFileProblem("req-1", [{ ...mine, storageKey: "status/req-1/plans/c.pdf" }]) === "string");

/* ------------------------------------------------------------ 3. the repeat */
check("a repeat that finds an unpaid order gets a checkout", rules.repeatAnswer("awaiting_payment") === "checkout");
for (const s of ["paid", "canceled", "refunded", "in_progress", "delivered"]) {
  check(`a repeat that finds a ${s} order gets its status and no checkout`, rules.repeatAnswer(s) === "status");
}

/* -------------------------------------------------------------- 4. the door */
const route = readFileSync("src/app/api/orders/route.ts", "utf8");
const at = (s) => route.indexOf(s);
const rateAt = at("await siteOrderRate(site, intent)");
check("the door asks the limit", rateAt > 0);
check("after the switch", rateAt > at("sisterOrderingRefusal(site"), `switch ${at("sisterOrderingRefusal(site")}, rate ${rateAt}`);
check("and after the compliance gate, so a closed gate writes nothing", rateAt > at("if (!isOpen())"), `gate ${at("if (!isOpen())")}`);
check("and before anything is signed, quoted or placed", rateAt < at("await signOrderUpload(") && rateAt < at("await requestQuote(") && rateAt < at("await placeOrder("));
check("a body that is not JSON still counts", /!body\s*\?\s*"unreadable"/.test(route) && rateAt < at('error: "Send a JSON body."'));
check("the upload is signed by signOrderUpload, the order flow's own function, under orders/", /await signOrderUpload\(\{[\s\S]{0,300}space: "orders"/.test(route));
check("and keyed on the request's idempotency key", /draftId: body\.clientRequestId/.test(route));
const fileRefusal = /const fileProblem = siteFileProblem\(body\.clientRequestId \?\? "", files\);\s*if \(fileProblem\) return NextResponse\.json\(\{ ok: false, error: fileProblem, field: "files" \}, \{ status: 422 \}\);/;
check(
  "the file rule is asked before an order is placed, and a file it names refuses the request",
  fileRefusal.test(route) && route.search(fileRefusal) < at("await placeOrder("),
);
check("an injection that skips the refusal is caught by that line, not passed", !fileRefusal.test(route.replace("if (fileProblem)", "if (fileProblem && false)")));
check("a repeat reads the order's state", /if \(result\.duplicate\) \{\s*status = await orderStatus\(result\.orderId\)/.test(route));
check("and opens a checkout only when the repeat rule says so", /repeatAnswer\(status\) === "checkout"\) \{\s*const started = await startCheckout\(result\.orderId\)/.test(route));
check("the door still writes no table itself", !/\.from\(/.test(route));

console.log(wrong === 0 ? "\nPASS: a site is held to its rate, its own files, and one checkout per order." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
