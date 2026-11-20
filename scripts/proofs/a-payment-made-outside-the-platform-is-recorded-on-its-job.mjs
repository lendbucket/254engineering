/**
 * A PAYMENT MADE OUTSIDE THE PLATFORM IS RECORDED ON ITS JOB, AND SAYS SO.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-payment-made-outside-the-platform-is-recorded-on-its-job.mjs
 *
 * Robert's answers 2 to 5 of the night of 2026-11-18 (issue #1, on 6992466384
 * and the plan 6992348494), migration 0138. Peter Bulatao paid by a Stripe
 * dashboard invoice, which no checkout names, so nothing could reach his job.
 *
 *   A  the administrator alone: the grant is the administrator's in the
 *      migration and in DEFAULT_ROLES, and both the route and the function ask it
 *   B  answer 3: the amount must equal the job's total, refused BEFORE any order
 *      is raised or anything written; and a Stripe reference is recorded once
 *   C  the payment goes through markPaid, the one path, with source
 *      staff_recorded, and 0138 lets the database take that source
 *   D  work already under way is not pulled back: the order's work.released line
 *      is written first, so the release leaves the file where it is
 *   E  answer 4: the words, pinned as shown to Robert (7002473972); the customer's
 *      page drops "What you were told before you paid" for these orders only
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const migration = readFileSync("supabase/migrations/0138_a_payment_received_outside_the_platform_is_recorded.sql", "utf8");
const authz = readFileSync("src/lib/ops-authz.ts", "utf8");
const route = readFileSync("src/app/api/portal/files/route.ts", "utf8");
const billing = readFileSync("src/lib/ops-job-billing.ts", "utf8");
const page = readFileSync("src/app/(order)/order/[reference]/page.tsx", "utf8");
const customer = readFileSync("src/lib/ops-customer.ts", "utf8");

/* A */
check("A: 0138 grants payments.record_outside to the administrator", /\('admin', 'payments\.record_outside'\)/.test(migration));
check("A: and asserts no other role holds it", /action = 'payments\.record_outside' and role_key <> 'admin'/.test(migration));
check("A: DEFAULT_ROLES declares it", /"payments\.record_outside",/.test(authz) && /\| "payments\.record_outside"/.test(authz));
check("A: the route asks it", /if \(action === "record_outside_payment"\) \{\s*if \(!can\(actor, "payments\.record_outside"\)\)/.test(route));

const fnAt = billing.indexOf("export async function recordOutsidePayment(");
const fn = billing.slice(fnAt, billing.indexOf("\n}\n", fnAt) + 2);
check("A: and the function asks it again, first", fnAt !== -1 && fn.indexOf('can(actor as never, "payments.record_outside")') !== -1 && fn.indexOf('can(actor as never, "payments.record_outside")') < fn.indexOf("supabaseAdmin()"));

/* B */
const totalCheck = fn.indexOf("if (input.amountCents !== totalCents)");
const firstWrite = fn.indexOf("await createOrderForFile(");
check("B: the amount must equal the job's price plus travel", /const totalCents = file\.client_price_cents \+ \(file\.travel_cents \? Number\(file\.travel_cents\) : 0\);/.test(fn) && totalCheck !== -1);
check("B: refused before any order is raised", totalCheck !== -1 && firstWrite > totalCheck);
check("B: a reference is recorded once, read before any order is raised", fn.indexOf('.eq("event_id", eventId)') !== -1 && fn.indexOf('.eq("event_id", eventId)') < firstWrite);

/* C */
check("C: through markPaid, as staff_recorded, with the reference as the charge", /await markPaid\(\{\s*eventId,\s*source: "staff_recorded",\s*orderId: order\.orderId,\s*chargeRef: reference,/.test(fn));
check("C: 0138 lets the database take that source, and keeps the old two", /check \(source in \('stripe_webhook', 'reconcile', 'staff_recorded'\)\)/.test(migration));

/* D */
check("D: past where a payment lands, the work is under way", /const underWay = landing !== null && status !== "intake" && status !== landing;/.test(fn));
check(
  "D: and its work.released line is written before markPaid, so the release leaves the file alone",
  /if \(underWay\) \{\s*lines\.push\(\{[\s\S]*?event: "work\.released",/.test(fn) && fn.indexOf('event: "work.released"') < fn.indexOf("await markPaid("),
);

/* E */
const words = await import("../../src/lib/outside-payment-words.ts");
const A = words.outsidePaymentStaffRecord({ amount: "$884.00", reference: "in_X", paidOn: "2026-11-17", recordedBy: "r@x", recordedOn: "2026-11-19", reason: "Billed by invoice" });
check(
  "E: A, the staff record, as shown",
  A ===
    "Paid outside the platform: $884.00 by Stripe invoice in_X on 2026-11-17, recorded by r@x on 2026-11-19. The refund terms below were stated after payment; they were not shown to the customer before they paid. Reason given: Billed by invoice",
);
check(
  "E: B, the customer's line, as shown",
  words.termsAfterPaymentLine("2026-11-17") === "These are the terms of your order. We set them out here after your payment, which you made by invoice on 2026-11-17.",
);
check("E: the page heads these terms differently, and only these", /view\.termsAfterPayment \? TERMS_AFTER_PAYMENT_HEADING : "What you were told before you paid"/.test(page) && words.TERMS_AFTER_PAYMENT_HEADING === "The terms of your order");
check("E: B is customer visible and kept out of the timeline", /customer_visible: true, summary: termsAfterPaymentLine/.test(fn) && /\.filter\(\(e\) => e\.event !== TERMS_AFTER_PAYMENT_EVENT\)/.test(customer));

console.log(wrong === 0 ? "PASS: a payment made outside the platform is recorded on its job, and says so." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
