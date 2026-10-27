/**
 * A JOB IS BILLED FROM A SCREEN, ONCE, THROUGH THE DOOR THAT ALREADY EXISTED,
 * AND THE GATE'S SWITCHES ARE SHOWN, NOT FLIPPED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-job-is-billed-once-from-its-screen.mjs
 *
 * Robert's W2 ruling of 2026-10-27: "The first W2 screen is sending a payment
 * link and an account invoice. Today only code can send them", and screens for
 * self-service sign-up and the insurance override, "owner or admin only and
 * audited". No database.
 *
 *   1. what each job offers: the gate, a missing price, a missing account, a
 *      missing email, and a job already billed each close the right option, in
 *      the words the door uses;
 *   2. once: the door refuses a second order for a job that has one that is not
 *      cancelled or refunded, and asks that before it raises one, on both paths;
 *   3. the list: waiting, search by telephone digits, and a missing price
 *      sorting last in both directions;
 *   4. the screen is the owner's and the administrator's, its nav entry matches
 *      its guard, and its buttons post to the existing door;
 *   5. the switches panel reads the configuration and writes nothing.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { billChoices, alreadyRaised, billListRows, isWaiting } = await import("../../src/lib/billing-rules.ts");

const job = (over = {}) => ({
  id: "f1", fileNumber: "254-2026-0001", createdAt: "2026-10-20T15:00:00Z", status: "needs_dispatch",
  serviceSlug: "roof-inspections", deliverable: null, propertyAddress: "100 Fictional Way", county: "Nueces",
  priceCents: 60000, paymentIntent: "unset", paymentNote: null, clientName: "Probe Client",
  clientEmail: "bill-probe@audit-probe.invalid", clientPhone: "(361) 555-0100", accountCanInvoice: true, ...over,
});
const pick = (choices, intent) => choices.find((c) => c.intent === intent);

/* ------------------------------------------------------ 1. what each job offers */
const shut = billChoices(job(), true);
check("the screen offers exactly the link and the invoice", shut.length === 2 && pick(shut, "link_sent") && pick(shut, "invoiced"));
check("while the gate is shut, neither is open, and each says why", shut.every((c) => !c.available && /not yet accepting engagements/.test(c.because ?? "")));
const open = billChoices(job(), false);
check("a priced job with an invoicing account and an email offers both", open.every((c) => c.available));
check("a job with no price cannot be sent a link", !pick(billChoices(job({ priceCents: null }), false), "link_sent").available);
check("a client with no account on terms cannot be invoiced", !pick(billChoices(job({ accountCanInvoice: false }), false), "invoiced").available);
const noEmail = billChoices(job({ clientEmail: null }), false);
check("a client with no email is offered neither, and is told why", noEmail.every((c) => !c.available && /no email address/.test(c.because ?? "")));
for (const intent of ["link_sent", "invoiced", "paid"]) {
  const c = billChoices(job({ paymentIntent: intent }), false);
  check(`a job already ${intent} is offered neither, and is sent to Order lookup`, c.every((x) => !x.available && /Order lookup/.test(x.because ?? "")));
}

/* --------------------------------------------------------------------- 2. once */
check("a job with no order may be billed", alreadyRaised([]) === null);
check("a cancelled order leaves the job billable", alreadyRaised([{ reference: "254-O2026-AAAAAA", status: "cancelled" }]) === null);
check("so does a refunded one", alreadyRaised([{ reference: "254-O2026-AAAAAA", status: "refunded" }]) === null);
const twice = alreadyRaised([{ reference: "254-O2026-AAAAAA", status: "cancelled" }, { reference: "254-O2026-BBBBBB", status: "awaiting_payment" }]);
check("an order waiting for payment refuses a second, naming it", typeof twice === "string" && twice.includes("254-O2026-BBBBBB") && /paying twice/.test(twice), String(twice));
check("and a paid one refuses it too", typeof alreadyRaised([{ reference: "R", status: "paid" }]) === "string");

const billing = readFileSync("src/lib/ops-job-billing.ts", "utf8");
for (const [fn, mode] of [["sendPaymentLink", "card"], ["invoiceAccount", "invoice"]]) {
  const start = billing.indexOf(`export async function ${fn}(`);
  const next = billing.indexOf("export async function", start + 1);
  const body = billing.slice(start, next === -1 ? undefined : next);
  const guard = body.indexOf("await secondOrderRefusal(fileId)");
  const raise = body.indexOf(`createOrderForFile(actor, file, client, "${mode}")`);
  check(`${fn} asks whether the job already has an order before it raises one`, guard > -1 && raise > -1 && guard < raise, `guard ${guard}, raise ${raise}`);
}
check("a failed read of the job's orders refuses rather than raising", /Could not check whether this job already has an order, so nothing was raised/.test(billing));

/* --------------------------------------------------------------------- 3. the list */
const rows = [
  job({ id: "a", priceCents: 10000, createdAt: "2026-10-01T00:00:00Z" }),
  job({ id: "b", priceCents: null, createdAt: "2026-10-02T00:00:00Z" }),
  job({ id: "c", priceCents: 50000, createdAt: "2026-10-03T00:00:00Z", clientPhone: "(512) 555-0199" }),
  job({ id: "d", paymentIntent: "invoiced" }),
  job({ id: "e", status: "cancelled" }),
];
const waiting = billListRows(rows, {});
check("waiting leaves out a job invoiced and a job cancelled", waiting.map((r) => r.id).sort().join() === "a,b,c", waiting.map((r) => r.id).join());
check("and isWaiting agrees", rows.filter(isWaiting).length === 3);
check("search finds a client by telephone digits", billListRows(rows, { q: "5120555" }).length === 0 && billListRows(rows, { q: "555-0199" }).map((r) => r.id).join() === "c");
check("a missing price sorts last going up", billListRows(rows, { sort: "amount", dir: "asc" }).map((r) => r.id).join() === "a,c,b");
check("and last going down", billListRows(rows, { sort: "amount", dir: "desc" }).map((r) => r.id).join() === "c,a,b");
check("every job not paid is shown under all", billListRows(rows, { show: "all" }).length === 5);

/* ------------------------------------------------------- 4. the owner's screen */
const page = readFileSync("src/app/portal/(app)/payment-links/page.tsx", "utf8");
const client = readFileSync("src/app/portal/(app)/payment-links/PaymentLinksClient.tsx", "utf8");
const list = readFileSync("src/lib/ops-bill-list.ts", "utf8");
const nav = readFileSync("src/components/portal/nav.ts", "utf8");
const route = readFileSync("src/app/api/portal/files/route.ts", "utf8");
check("the screen opens on payments.charge, the owner's and the administrator's", /if \(!actor \|\| !can\(actor, "payments\.charge"\)\) notFound\(\)/.test(page));
check("and so does the read behind it", /can\(actor, "payments\.charge"\)/.test(list));
check("its nav entry asks the same grant", /href: "\/portal\/payment-links"[^}]*action: "payments\.charge"/.test(nav));
check("its buttons post to the existing door and nowhere else", /postJson\("\/api\/portal\/files", \{ action, fileId \}\)/.test(client) && (client.match(/postJson\(/g) ?? []).length === 1);
check("and the door still asks payments.charge to invoice", /: can\(actor, "payments\.charge"\);/.test(route));
check("the list reads every row rather than a first page", /readEvery</.test(list) && /readEveryIn</.test(list));
check("and leaves demonstration files out by their flag", /\.not\("is_demo", "is", true\)/.test(list));

/* -------------------------------------------------- 5. shown, not flipped */
const { configSwitches } = await import("../../src/lib/config-switches.ts");
const { selfServiceSignUp } = await import("../../src/config/launch-conditions.ts");
const { sisterOrdering } = await import("../../src/config/sister-ordering.ts");
const { insuranceStandsOn } = await import("../../src/lib/launch.ts");
const switches = configSwitches("2026-10-27");
const signUp = switches.find((s) => s.name === "Self-service sign-up");
check("the sign-up row says what the configuration says", signUp && (signUp.state === "Cleared") === (selfServiceSignUp.cleared === true), signUp?.state);
const ins = switches.find((s) => s.name === "Insurance override");
const standing = insuranceStandsOn("2026-10-27");
check(
  "the insurance row says what the gate stands on",
  ins && (standing.on === "override" ? ins.state === `In force to ${standing.expires}` : standing.on === "policy" ? ins.state === "Not needed" : ins.state === "Not in force"),
  ins?.state,
);
check("a past expiry reads as not in force", configSwitches("2099-01-01").find((s) => s.name === "Insurance override")?.state !== `In force to ${standing.on === "override" ? standing.expires : ""}`);
check("every sister switch has a row", switches.filter((s) => / orders$|^Orders from /.test(s.name)).length === Object.keys(sisterOrdering).length);
const launch = readFileSync("src/app/portal/(app)/launch/page.tsx", "utf8");
const switchesSrc = readFileSync("src/lib/config-switches.ts", "utf8");
check("the launch screen renders the switches and posts nothing", /configSwitches\(\)/.test(launch) && !/postJson|fetch\(|"use client"/.test(launch));
check("and the switches read no database", !/supabase|readEvery|\.from\(/.test(switchesSrc));

console.log(wrong === 0 ? "\nPASS: a job is billed from a screen, once, and the gate's switches are shown, not flipped." : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
