/**
 * A SISTER'S ORDER IS A NORMAL ORDER, AND IT IS TAKEN ONLY BEHIND ITS SWITCH.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-sister-order-is-a-normal-order-behind-its-switch.mjs
 *
 * Robert's addendum of 2026-10-25, item 10: "confirm /api/orders accepts a
 * Sealed site key and creates a normal order with checkout ... Sealed ordering
 * stays closed until it uses this."
 *
 * No database. Four things are proved:
 *   1. the switch: 254 is never refused by it; Sealed and Stamp are refused as
 *      shipped; a site the switch does not name is refused; an open entry passes.
 *      The shipped closed state is pinned here as a literal, a ruling.
 *   2. the door, called in process with a real key map: no key and a wrong key
 *      answer 404 alike; Sealed's real key answers 409 "not open yet" and carries
 *      no checkout; 254's key reaches the compliance gate, which this process
 *      reads as shut, and is refused there.
 *   3. the normal order: the door places through placeOrder and opens checkout
 *      with startCheckout, the two functions 254's own order flow uses, and
 *      nothing under src writes the legacy eng_orders table.
 *   4. the order of questions: the switch is asked before the body is read.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------ 1. the switch */
const { sisterOrderingRefusal } = await import("../../src/lib/sister-ordering.ts");
const { sisterOrdering } = await import("../../src/config/sister-ordering.ts");

check("the firm's own site is never refused by the switch", sisterOrderingRefusal("254", "254") === null);
check("Sealed is refused as shipped", typeof sisterOrderingRefusal("sealed", "254") === "string");
check("StampMyPlans is refused as shipped", typeof sisterOrderingRefusal("stamp", "254") === "string");
check("a site the switch does not name is refused, not opened", typeof sisterOrderingRefusal("sealedengineering", "254") === "string");
check("a name off Object.prototype opens nothing", typeof sisterOrderingRefusal("constructor", "254") === "string");
const openTable = { sealed: { open: true, openedBy: "Proof", openedOn: "2026-10-27", because: "proof" } };
check("an entry marked open passes", sisterOrderingRefusal("sealed", "254", openTable) === null);
check("and only that entry", typeof sisterOrderingRefusal("stamp", "254", openTable) === "string");
/* THE RULING, AS A LITERAL. Opening Sealed is an edit to the config AND to this line. */
check("Sealed ordering is closed in the shipped configuration (addendum item 10)", sisterOrdering.sealed.open === false && sisterOrdering.sealed.openedBy === null);
check("StampMyPlans ordering is closed in the shipped configuration", sisterOrdering.stamp.open === false);

/* --------------------------------------------------------------- 2. the door */
process.env.ORDER_INTAKE_KEYS = JSON.stringify({ "254": "proof-key-254", sealed: "proof-key-sealed" });
delete process.env.LAUNCH_MODE;
const { POST } = await import("../../src/app/api/orders/route.ts");
const { isOpen } = await import("../../src/lib/launch.ts");

const body = JSON.stringify({
  clientRequestId: "proof-sister-order-1",
  serviceSlug: "roof-inspections",
  customer: { name: "Probe Contact, not a real person", email: "sister-probe@audit-probe.invalid" },
  property: { propertyAddress: "100 Fictional Way", county: "Nueces" },
});
const call = async (key) => {
  const headers = { "content-type": "application/json" };
  if (key !== null) headers["x-intake-key"] = key;
  const res = await POST(new NextRequest("https://254engineering.com/api/orders", { method: "POST", headers, body }));
  return { status: res.status, text: await res.text() };
};

const none = await call(null);
const bad = await call("not-a-real-key");
check("no key answers 404", none.status === 404, `HTTP ${none.status}`);
check("and a wrong key answers the same", bad.status === 404 && bad.text === none.text, `HTTP ${bad.status}`);

const sealed = await call("proof-key-sealed");
check("Sealed's real key is refused while its switch is closed", sealed.status === 409 && /not open yet/.test(sealed.text), `HTTP ${sealed.status}: ${sealed.text}`);
check("and the refusal carries no checkout and no order", !/checkout|orderId|reference/.test(sealed.text), sealed.text);

const own = await call("proof-key-254");
const gateShut = !isOpen();
check(
  gateShut
    ? "254's key passes the switch and is refused by the compliance gate, which is shut in this process"
    : "254's key passes the switch (the gate reads open in this process)",
  gateShut ? own.status === 409 && /"prelaunch":true/.test(own.text) : own.status !== 404 && !/not open yet/.test(own.text),
  `HTTP ${own.status}`,
);

/* ------------------------------------------------------- 3. a normal order */
const route = readFileSync("src/app/api/orders/route.ts", "utf8");
const flow = readFileSync("src/app/api/order-flow/route.ts", "utf8");
check("the door places the order through placeOrder", /await placeOrder\(\{/.test(route));
check("and opens checkout through startCheckout on the order it placed", /startCheckout\(result\.orderId\)/.test(route));
check("254's own order flow uses the same two functions", /placeOrder\(/.test(flow) && /startCheckout\(/.test(flow));
check("the door writes no table itself", !/\.from\(/.test(route));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
};
walk("src");
const legacy = files.filter((f) => /from\(\s*["'`]eng_orders["'`]\s*\)/.test(readFileSync(f, "utf8")));
check("nothing under src touches the legacy eng_orders table", legacy.length === 0, legacy.join(", ") || `${files.length} files read`);

/* ------------------------------------------------------ 4. the order of questions */
const switchAt = route.indexOf("sisterOrderingRefusal(site");
const bodyAt = route.indexOf("await request.json()");
check("the switch is asked after the key and before the body is read", switchAt > route.indexOf("siteFromKey(") && switchAt < bodyAt, `switch ${switchAt}, body ${bodyAt}`);

console.log(wrong === 0 ? "\nPASS: a sister's order is a normal order, and it is taken only behind its switch." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
