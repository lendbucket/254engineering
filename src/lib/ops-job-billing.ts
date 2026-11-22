import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin, SITE_KEY } from "./supabase";
import { writeAudit } from "./ops-audit";
import { acceptOnInvoice, markPaid, startCheckout } from "./ops-payments";
import { landingStatusFor } from "./ops-orders";
import { todayInFirmCalendar } from "./firm-calendar";
import { OUTSIDE_PAYMENT_EVENT, TERMS_AFTER_PAYMENT_EVENT, outsidePaymentStaffRecord, termsAfterPaymentLine } from "./outside-payment-words";
import { accountBalance } from "./ops-bulk";
import { creditDecision } from "./account-credit";
import { queueEmail } from "./ops-jobs";
import { jobPaymentLink, tripFeeLink } from "./email-templates";
import { money } from "./ops-money";
import { noAccessState } from "./no-access";
import { TRIP_FEE_CENTS } from "@/config/prices";
import { isOpen } from "./launch";
import { catalogFor } from "@data/catalog";
import { orderBlockedNow } from "./line-gate";
import { DEMO_FILE_SEGMENT, referenceForCustomer } from "./ops-files";
import { MIN_OVERRIDE_REASON, paymentOptions } from "./job-intake-rules";
import { can } from "./ops-authz";
import { DB_NOW } from "./db-now";
import { raiseSystemTask } from "./system-work";
import { refundDisclosure, travelRefundTerms, TRIP_FEE_REFUND_TERMS } from "./ops-orders";
import { alreadyRaised } from "./billing-rules";
import type { Author } from "./ops-crm";
import { attributeOrder } from "./crm-attribution";
import { attributeOrder as attributeToPartner, fileTouchKey } from "./ops-partners";
import { payerFor } from "./file-contacts";

/**
 * The orders already raised against this job, for the guard in billing-rules.
 * A read that fails refuses the bill: not knowing whether an order exists is
 * exactly when a second one would be raised.
 */
async function secondOrderRefusal(fileId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return "The database is not configured.";
  /* Job orders only: a trip fee (0134) is the one stated exception to one order per job. */
  const { data, error } = await db.from("eng_service_orders").select("reference, status").eq("file_id", fileId).eq("kind", "job");
  if (error) return `Could not check whether this job already has an order, so nothing was raised: ${error.message}`;
  return alreadyRaised((data ?? []) as { reference: string; status: string }[]);
}

/**
 * GETTING PAID FOR A JOB THE CUSTOMER DID NOT PLACE.
 *
 * Phase 10 Section 1 item 4. A job taken over the telephone has no checkout
 * behind it, so the firm needs two ways to be paid that the customer flow never
 * needs: send them a link, or invoice an account that already has terms.
 *
 * THIS CODE HAS NEVER RUN AGAINST A REAL PAYMENT AND CANNOT UNTIL LAUNCH
 * ---------------------------------------------------------------------
 * Both paths are refused by the compliance gate while registration is pending,
 * in those words: no order may be placed and no payment may be taken. So this
 * is written, typechecked, audited and unexercised, exactly as the sealing path
 * is unexercised until the certificate arrives.
 *
 * That is recorded in the launch sequence rather than left as a surprise. The
 * first real use is a deliberate act with somebody watching, not something
 * discovered on a customer.
 *
 * WHY AN ORDER IS CREATED AT ALL WHEN A FILE ALREADY EXISTS
 * ---------------------------------------------------------
 * Money settles on eng_service_orders. eng_order_payments references it,
 * reconciliation reads it, and the refund rules are written against it. A
 * second way to be paid that did not produce an order would be a second ledger,
 * and the firm would have two answers to "what has this customer paid".
 *
 * So the file keeps the DECISION and the order carries the MONEY, which is the
 * same split 0015 records in payment_intent.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * The customer facing reference. Same shape and same alphabet as the order
 * engine's, because a customer reading one down a telephone should not be able
 * to tell which door their job came through.
 */
/* A probe gets a DEMO reference here too; see ops-intake for the reasoning. */
function referenceFor(customerEmail?: string | null): string {
  let suffix = "";
  for (const byte of randomBytes(6)) suffix += ALPHABET[byte % ALPHABET.length];
  return referenceForCustomer(`${SITE_KEY}-O${new Date().getFullYear()}`, suffix, customerEmail);
}

/** What the customer was told they were buying, in the catalog's words. */
function entryName(file: FileForBilling): string {
  const entry = file.deliverable ? catalogFor(file.service_slug, file.deliverable) : undefined;
  return entry?.name ?? file.service_slug;
}

type BillResult =
  | { ok: true; orderId: string; reference: string; checkoutUrl?: string }
  | { ok: false; error: string };

type FileForBilling = {
  id: string;
  file_number: string;
  service_slug: string;
  deliverable: string | null;
  property_address: string;
  city: string | null;
  county: string;
  postal_code: string | null;
  client_price_cents: number | null;
  catalog_price_cents?: number | null;
  coastal_surcharge_cents?: number | null;
  twia_county?: boolean | null;
  payment_intent: string;
  client_id: string;
  /** Travel the administrator typed for this job (0135); null for none. */
  travel_cents?: number | null;
};

/**
 * THE TELEPHONED ORDER CARRIES ITS PRICE BREAKDOWN WHEN THE PRICE IS THE
 * CATALOG'S. Money audit F11, 2026-11-02: the order row carried total_cents
 * only, so checkout fell back to one "Sealed document" line for the whole
 * total and a Nueces customer saw $784.00 with no coastal line, and any report
 * reading coastal_surcharge_cents undercounted the surcharge.
 *
 * The breakdown is written ONLY when the file's price is exactly the catalog
 * price it recorded (catalog_price_cents is the total including the coastal
 * line). An operator override carries no breakdown at all, so checkout keeps
 * its single line at the overridden total: lines that did not add up to the
 * total would charge the wrong amount. The total charged never changes.
 */
export function orderBreakdownFor(file: Pick<FileForBilling, "client_price_cents" | "catalog_price_cents" | "coastal_surcharge_cents" | "twia_county">): {
  price_cents: number | null;
  coastal_surcharge_cents: number | null;
  twia_county: boolean;
} {
  const twia = Boolean(file.twia_county);
  const total = file.client_price_cents === null || file.client_price_cents === undefined ? null : Number(file.client_price_cents);
  const catalog = file.catalog_price_cents === null || file.catalog_price_cents === undefined ? null : Number(file.catalog_price_cents);
  if (total === null || catalog === null || total !== catalog) {
    return { price_cents: null, coastal_surcharge_cents: null, twia_county: twia };
  }
  const coastal = file.coastal_surcharge_cents === null || file.coastal_surcharge_cents === undefined ? 0 : Number(file.coastal_surcharge_cents);
  if (!Number.isInteger(coastal) || coastal < 0 || coastal > total) {
    return { price_cents: null, coastal_surcharge_cents: null, twia_county: twia };
  }
  /* Checkout draws the coastal line only for a TWIA county; a coastal amount without the flag would make the lines short of the total. */
  if (coastal > 0 && !twia) {
    return { price_cents: null, coastal_surcharge_cents: null, twia_county: twia };
  }
  return { price_cents: total - coastal, coastal_surcharge_cents: coastal > 0 ? coastal : null, twia_county: twia };
}

async function loadFile(fileId: string): Promise<FileForBilling | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_files")
    .select(
      "id, file_number, service_slug, deliverable, property_address, city, county, postal_code, client_price_cents, catalog_price_cents, coastal_surcharge_cents, twia_county, payment_intent, client_id, travel_cents",
    )
    .eq("id", fileId)
    .maybeSingle();
  return (data as FileForBilling) ?? null;
}

async function loadClient(clientId: string) {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_clients")
    .select("id, name, email, phone")
    .eq("id", clientId)
    .maybeSingle();
  return data;
}

/**
 * The order row behind a telephoned job.
 *
 * Deliberately NOT placeOrder. That function is the customer's door: it
 * re-derives the price from the catalog, re-evaluates the qualifiers, and
 * refuses outright under the gate. Here the price is already decided and may
 * legitimately be an override the operator recorded a reason for, and
 * re-deriving it would silently discard that.
 */
async function createOrderForFile(
  actor: Author,
  file: FileForBilling,
  client: { name: string; email: string | null; phone: string | null },
  billingMode: "card" | "invoice",
  /* The account an invoiced job is billed to (Q7, money F3); null for a payment link. */
  accountId: string | null = null,
): Promise<{ ok: true; orderId: string; reference: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  if (!client.email) {
    return {
      ok: false,
      error: "That client has no email address, so there is nowhere to send a link or an invoice.",
    };
  }
  if (file.client_price_cents === null) {
    return { ok: false, error: "This job has no price, so there is nothing to charge." };
  }

  const entry = file.deliverable ? catalogFor(file.service_slug, file.deliverable) : undefined;

  /*
   * THE TERMS ARE RECORDED ON THE ORDER, FROM THE SAME SOURCE THE WEB USES.
   *
   * refundDisclosure(entry) is the function the customer flow calls, so a job
   * taken by telephone stores the identical sentences a job taken online does,
   * and the operator reads the customer the thing the order will afterwards say
   * they were read. Two doors, one set of terms.
   *
   * inspection_fee_cents rides along because refundFor cannot work out a refund
   * after a site visit without it, and an order that cannot compute its own
   * refund is the defect this whole guard exists to prevent. Null is correct for
   * a desk service, which has no visit and therefore no fee: termsGap above has
   * already refused the field services where null would matter.
   *
   * The price is still NOT re-derived; see the note on this function. What is
   * derived here is the terms, which are not the operator's to override.
   */
  if (!entry) {
    return {
      ok: false,
      error: "That deliverable is not in the order catalog, so its refund terms cannot be stated.",
    };
  }
  /*
   * TRAVEL, INSIDE THE TOTAL AND ON ITS OWN LINE (0135). The file's price stays
   * the service's, so the coastal breakdown below is unchanged; the order's
   * total is that price plus the travel, and the terms say what happens to the
   * travel on a decline (Robert's answer 12).
   */
  const travel = file.travel_cents !== null && file.travel_cents !== undefined ? Number(file.travel_cents) : 0;
  const disclosure = [...refundDisclosure(entry), ...(travel > 0 ? [travelRefundTerms(travel, file.county)] : [])].join("\n\n");

  const reference = referenceFor(client.email);

  const { data, error } = await db
    .from("eng_service_orders")
    .insert({
      site: SITE_KEY,
      reference,
      /* The database's own rule, on the reference just computed; see placeOrder. */
      is_demo: reference.includes(`-${DEMO_FILE_SEGMENT}-`),
      service_slug: file.service_slug,
      tier: file.deliverable,
      order_type: entry?.orderType ?? "desk",
      customer_name: client.name,
      customer_email: client.email,
      customer_phone: client.phone,
      property_address: file.property_address,
      city: file.city,
      county: file.county,
      postal_code: file.postal_code,
      /* Money audit F11: the breakdown only when the price is the catalog's; see orderBreakdownFor. */
      ...orderBreakdownFor(file),
      total_cents: file.client_price_cents + travel,
      travel_cents: travel > 0 ? travel : null,
      inspection_fee_cents: entry.inspectionFeeCents,
      refund_disclosure: disclosure,
      status: "awaiting_payment",
      billing_mode: billingMode,
      /*
       * closePeriod and accountBalance select by account_id, so an invoiced
       * order without one was on no statement and in no exposure, ever (Q7,
       * money F3).
       */
      account_id: accountId,
      client_id: file.client_id,
      file_id: file.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "order.raised_for_file",
    entityType: "service_order",
    entityId: data.id,
    summary: `${reference} raised against ${file.file_number} for ${billingMode === "invoice" ? "invoicing" : "a payment link"}.`,
  });

  /*
   * THE PARTNER, BY THE CHECKOUT'S OWN RULES. Part 1 finding 3, Robert's answer
   * 1 of 2026-11-14. A code given on the telephone is a touch under the file's
   * key (takeJob), and this is the same attributeOrder the web checkout calls,
   * reading that key: the window, a code beating a click, and an existing
   * customer crediting nobody all apply unchanged. It used to run for no phone
   * order at all, so a partner who referred by telephone was never credited.
   * Never throws; a failed read leaves the order undecided with its reason, as
   * on the web.
   */
  await attributeToPartner({
    orderId: data.id,
    reference,
    customerEmail: client.email,
    visitorKey: fileTouchKey(file.id),
  });

  return { ok: true, orderId: data.id, reference };
}

/**
 * THE TERMS MUST EXIST BEFORE THE MONEY DOES.
 *
 * Operator ruling, 2026-09-08. No payment link and no invoice is ever raised for
 * an order that cannot state its refund terms, and it holds on BOTH creation
 * paths rather than only on the customer's.
 *
 * WHAT WAS WRONG. The web door refuses a field service whose inspection fee is
 * unpublished, in `orderBlockedReason`, in these words: "the refund rule cannot
 * be stated without it". This door asked a different question. `refusedBecause`
 * consults the compliance gate and whether a price exists, and nothing else, so
 * a job typed in over the telephone could be charged for while the firm had no
 * published terms to refund under. `createOrderForFile` then wrote neither the
 * disclosure nor the fee, so the order carried no record of what the customer
 * had been told, because nothing had been said.
 *
 * The consequence is the one this build has been avoiding since Phase 7: take
 * the money, decline to seal after a visit, and then be unable to compute what
 * to give back. refundFor refuses to guess, correctly, which turns a refund into
 * something an operator settles by hand against a customer who was never told
 * the rule.
 *
 * WHY IT IS THE SAME FUNCTION AND NOT A SECOND RULE. Asking
 * `orderBlockedReason` means the two doors cannot drift. A service that becomes
 * orderable online becomes billable by telephone in the same commit, and a
 * service whose fee is withdrawn stops being both.
 *
 * The prelaunch clause is skipped deliberately. `refusedBecause` already applies
 * the gate through paymentOptions, in the words the screen uses, and asking it
 * twice would replace that message with a less specific one.
 */
async function termsGap(file: FileForBilling): Promise<string | null> {
  const entry = file.deliverable ? catalogFor(file.service_slug, file.deliverable) : undefined;
  if (!entry) {
    return "That deliverable is not in the order catalog, so its refund terms cannot be stated and it cannot be billed.";
  }
  /*
   * "open" for the mode, which is what `false` for prelaunch meant before the
   * parameter became a mode on 2026-09-23. The gate is refusedBecause's to
   * report, not this function's, and passing a shut mode here would mask the
   * fee problem behind it.
   *
   * IT IS NOT A CLAIM THAT THE FIRM IS OPEN. It is this function declining to
   * answer a question that is not its own, and the value now says which
   * question it is skipping rather than which boolean it is passing.
   */
  /* A MONEY DOOR, ruling 11: the engineer's signed record is read before a job is billed. */
  const blocked = await orderBlockedNow(entry, "open");
  if (blocked) return `${blocked} It cannot be billed by telephone either.`;
  return null;
}

/**
 * The gate, asked once, in the same words the screen asked it.
 *
 * The screen decides which buttons to draw and this decides what may actually
 * happen, so a hand crafted request reaches the same refusal a person sees.
 */
function refusedBecause(intent: "link_sent" | "invoiced", accountCanInvoice: boolean, priced: boolean) {
  const option = paymentOptions({ prelaunch: !isOpen(), accountCanInvoice, priced }).find(
    (o) => o.intent === intent,
  );
  return option?.available ? null : (option?.because ?? "That payment route is not available.");
}

/**
 * Send the customer a link that charges them for this job.
 *
 * UNEXERCISED UNTIL LAUNCH. See the header.
 */
export async function sendPaymentLink(actor: Author, fileId: string): Promise<BillResult> {
  const file = await loadFile(fileId);
  if (!file) return { ok: false, error: "That file does not exist." };

  const refusal = refusedBecause("link_sent", false, file.client_price_cents !== null);

  /* The terms before the money, on both doors. */
  const gap = await termsGap(file);
  if (gap) return { ok: false, error: gap };
  if (refusal) return { ok: false, error: refusal };

  const loaded = await loadClient(file.client_id);
  if (!loaded) return { ok: false, error: "That file has no client." };
  /*
   * THE LINK GOES TO WHOEVER PAYS (the Killeen call, item 2; 0132): the paying
   * copy contact when one is named, the client otherwise. A failed read of the
   * contacts refuses rather than billing the client by default.
   */
  const payer = await payerFor(fileId, { name: loaded.name as string, email: (loaded.email as string | null) ?? null, phone: (loaded.phone as string | null) ?? null });
  if (!payer.ok) return { ok: false, error: `${payer.error} No link was sent.` };
  if (!payer.email) {
    return { ok: false, error: `${payer.isClient ? "That client" : "The person paying"} has no email address, so there is nowhere to send a link.` };
  }
  const client = { name: payer.name, email: payer.email, phone: payer.phone };

  /* One order per job: a second press is refused naming the first (billing-rules, alreadyRaised). */
  const second = await secondOrderRefusal(fileId);
  if (second) return { ok: false, error: second };

  /* HELD while travel is asked for and not set (Needs travel); setting it sends this link by itself. A failed read holds too. */
  const travelAsked = await travelRequestFor(fileId);
  if (travelAsked.pending === null) return { ok: false, error: `No link was sent: ${travelAsked.error}.` };
  if (travelAsked.pending) return { ok: false, error: TRAVEL_REQUESTED_SAYS };

  const order = await createOrderForFile(actor, file, client, "card");
  if (!order.ok) return order;

  const checkout = await startCheckout(order.orderId);
  if (!checkout.ok) {
    /*
     * The order exists and nobody has been charged. Said plainly rather than
     * rolled back: the operator needs to know a reference exists so they do not
     * raise a second one, which is how a customer ends up paying twice.
     */
    return {
      ok: false,
      error: `Order ${order.reference} was raised and the payment link could not be created: ${checkout.error}`,
    };
  }

  /*
   * A composed template, not a string built here.
   *
   * The first version of this wrote the body inline and cast the result to
   * satisfy the type, which would have put the one customer facing email on
   * this path outside every rule email-audit enforces: the voice blocklist, the
   * plaintext part, the 375px layout, the signed sender. A template the audit
   * cannot see is a template nothing checks.
   */
  /*
   * THE QUEUE'S ANSWER IS READ, AND THE RECORD SAYS QUEUED, NOT SENT. Robert's
   * answer 4 of 2026-11-21 (issue #1, 7072967992), on Q5 of the morning of
   * 2026-10-15: this wrote "Payment link sent to ..." whatever the queue said,
   * so a link that never left read as sent on the file and in the audit trail.
   * Queued is what is known here; delivery is known only when the provider
   * accepts it, which the handler writes to the order's own timeline (the
   * orderId below, as the resend path already passes). On a failed queue the
   * order and its checkout still exist, so the file says so, says "Nothing was
   * sent", and points at Resend, which finds that waiting order; a second Send
   * stays refused by secondOrderRefusal above.
   */
  const queued = await queueEmail(
    jobPaymentLink({
      customerName: client.name,
      customerEmail: client.email,
      reference: order.reference,
      propertyAddress: file.property_address,
      deliverableName: entryName(file),
      /* The total the checkout charges: the price and any travel (0135). */
      amount: money((file.client_price_cents ?? 0) + (file.travel_cents ? Number(file.travel_cents) : 0)),
      payUrl: checkout.url,
      takenBy: actor.email,
    }),
    { orderId: order.orderId },
  );

  const notSent = queued.ok
    ? null
    : `Order ${order.reference} was raised and its payment link could not be queued: ${queued.error}. Nothing was sent. Use Resend on this file.`;

  const db = supabaseAdmin();
  await db
    ?.from("eng_files")
    .update({
      payment_intent: "link_sent",
      payment_note: notSent ?? `Payment link queued to ${client.email} against ${order.reference}.`,
    })
    .eq("id", fileId);

  await writeAudit({
    actor,
    action: "file.payment_link_sent",
    entityType: "file",
    entityId: fileId,
    summary: notSent
      ? `${file.file_number}: ${notSent}`
      : `${file.file_number}: a payment link was queued to ${client.email} against ${order.reference}.`,
  });

  if (notSent) return { ok: false, error: notSent };
  return { ok: true, orderId: order.orderId, reference: order.reference, checkoutUrl: checkout.url };
}

/**
 * SEND THE SAME PAYMENT LINK AGAIN. The Killeen call, item 3 (Robert,
 * 2026-11-14): the file carries a resend button, and the unpaid follow-up task
 * (item 6) carries the same action.
 *
 * Never a second order: a second press of Send was refused as already billed,
 * and that refusal stands. This finds the job's one order still waiting for
 * payment, asks startCheckout for its checkout (the same function the first
 * send used), and queues the same template to the same address. Unlike the
 * first send, whose queue result is not read, a resend that could not be queued
 * says so and records nothing as sent.
 */
export async function resendPaymentLink(actor: Author, fileId: string): Promise<BillResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const file = await loadFile(fileId);
  if (!file) return { ok: false, error: "That file does not exist." };

  const refusal = refusedBecause("link_sent", false, file.client_price_cents !== null);
  if (refusal) return { ok: false, error: refusal };

  const { data: waiting, error: readError } = await db
    .from("eng_service_orders")
    .select("id, reference, customer_name, customer_email, total_cents, status, billing_mode")
    .eq("file_id", fileId)
    /* The job's own link; a waiting trip fee has its own button (0134). */
    .eq("kind", "job")
    .eq("status", "awaiting_payment")
    .eq("billing_mode", "card")
    .order("created_at", { ascending: true })
    .limit(1);
  if (readError) return { ok: false, error: `The job's order could not be read: ${readError.message}` };
  const order = (waiting ?? [])[0];
  if (!order) return { ok: false, error: "No payment link is waiting on this job. Send one first, or it has already been paid." };
  if (!order.customer_email) return { ok: false, error: `Order ${order.reference} has no email address to send the link to.` };

  const checkout = await startCheckout(order.id as string);
  if (!checkout.ok) return { ok: false, error: `The payment link for ${order.reference} could not be made again: ${checkout.error}` };

  const queued = await queueEmail(
    jobPaymentLink({
      customerName: order.customer_name as string,
      customerEmail: order.customer_email as string,
      reference: order.reference as string,
      propertyAddress: file.property_address,
      deliverableName: entryName(file),
      amount: money(Number(order.total_cents)),
      payUrl: checkout.url,
      takenBy: actor.email,
    }),
    { orderId: order.id as string },
  );
  if (!queued.ok) return { ok: false, error: `The payment link for ${order.reference} could not be queued: ${queued.error}. Nothing was sent.` };

  await db.from("eng_order_events").insert({
    order_id: order.id,
    event: "payment_link.resent",
    customer_visible: false,
    /* Queued, not sent: delivery is written by the email handler when the provider accepts it (answer 4, 2026-11-21). */
    summary: `The payment link was queued again to ${order.customer_email}.`,
  });
  await writeAudit({
    actor,
    action: "file.payment_link_resent",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: the payment link for ${order.reference} was queued again to ${order.customer_email}.`,
  });

  return { ok: true, orderId: order.id as string, reference: order.reference as string, checkoutUrl: checkout.url };
}

/**
 * TRAVEL ON A JOB, TYPED BY THE ADMINISTRATOR BEFORE THE LINK. Robert's
 * rulings of 2026-11-14 (travel typed per job; answers 12 to 15), 0135.
 *
 * Held to the price override's rules: pricing.override_at_intake, which the
 * administrator holds, a reason of at least MIN_OVERRIDE_REASON characters, and
 * an audit row. A field job only, because travel is the trip to the property.
 * Refused once the job's order exists: the customer was quoted a total, and a
 * travel line appearing after the link went out would be a charge nobody read
 * back. A null amount clears it, under the same rules.
 */
export async function setTravel(
  actor: Author,
  fileId: string,
  travelCents: number | null,
  reason: string,
): Promise<{ ok: true; answered: boolean } | { ok: false; error: string }> {
  if (!can(actor, "pricing.override_at_intake")) return { ok: false, error: "Only an administrator sets travel on a job." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const file = await loadFile(fileId);
  if (!file) return { ok: false, error: "That file does not exist." };
  const entry = file.deliverable ? catalogFor(file.service_slug, file.deliverable) : undefined;
  if (entry?.orderType !== "field") return { ok: false, error: "Travel is set only on a job somebody visits." };
  if (travelCents !== null && (!Number.isInteger(travelCents) || travelCents <= 0)) {
    return { ok: false, error: "Travel is a whole amount above zero, or nothing." };
  }
  const why = reason.trim();
  if (why.length < MIN_OVERRIDE_REASON) return { ok: false, error: `Say why, in at least ${MIN_OVERRIDE_REASON} characters. Staff read it; the customer does not.` };
  const raised = await secondOrderRefusal(fileId);
  if (raised) return { ok: false, error: `Travel is set before the payment link. ${raised}` };

  const { error } = await db
    .from("eng_files")
    .update(
      travelCents === null
        ? { travel_cents: null, travel_reason: null, travel_set_by: null, travel_set_at: null }
        : { travel_cents: travelCents, travel_reason: why, travel_set_by: actor.id, travel_set_at: DB_NOW },
    )
    .eq("id", fileId);
  if (error) return { ok: false, error: `Travel could not be saved: ${error.message}` };

  await writeAudit({
    actor,
    action: travelCents === null ? "file.travel_cleared" : "file.travel_set",
    entityType: "file",
    entityId: fileId,
    summary:
      travelCents === null
        ? `${file.file_number}: travel cleared. ${why}`
        : `${file.file_number}: travel of ${money(travelCents)} set. ${why}`,
    diff: { travel_cents: travelCents, previous_travel_cents: file.travel_cents ?? null },
  });

  /* Somebody asked for this travel: the link goes now and they are told (Robert's ruling, Needs travel). */
  if (travelCents !== null) {
    const request = await travelRequestFor(fileId);
    if (request.pending === true) {
      await answerTravelRequest(actor, fileId, request);
      return { ok: true, answered: true };
    }
  }
  return { ok: true, answered: false };
}

/*
 * ===========================================================================
 * NEEDS TRAVEL. Robert's ruling of 2026-11-14, on the walk's finding that a rep
 * cannot set travel: the amount stays the administrator's, and anyone who can
 * take a job asks for it. The request raises a task to the administrator naming
 * the county and the file, holds the payment link until travel is set, and the
 * rep reads "Travel requested. The payment link goes when it is set." When the
 * administrator sets it, the link goes by itself and the rep is told.
 * ===========================================================================
 *
 * Held as FILE EVENTS, read from rows the way the engineer's pre-review hold is
 * (dispatch-hold.ts): a request is pending while it is newer than the last
 * answer to one. eng_file_events refuses edits, so who asked and when stays.
 */
export const TRAVEL_REQUESTED = "travel.requested";
export const TRAVEL_REQUEST_ANSWERED = "travel.request_answered";
export const TRAVEL_REQUESTED_SAYS = "Travel requested. The payment link goes when it is set.";

export type TravelRequest =
  | { pending: false }
  | { pending: true; eventId: string; requestedBy: string | null; at: string }
  | { pending: null; error: string };

/** Whether this file has a travel request nobody has answered yet. */
export async function travelRequestFor(fileId: string): Promise<TravelRequest> {
  const db = supabaseAdmin();
  if (!db) return { pending: null, error: "the database is not configured" };
  const { data, error } = await db
    .from("eng_file_events")
    .select("id, kind, actor_id, created_at")
    .eq("file_id", fileId)
    .in("kind", [TRAVEL_REQUESTED, TRAVEL_REQUEST_ANSWERED])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) return { pending: null, error: `the travel request could not be read: ${error.message}` };
  const last = (data ?? [])[0];
  if (!last || last.kind !== TRAVEL_REQUESTED) return { pending: false };
  return { pending: true, eventId: String(last.id), requestedBy: (last.actor_id as string | null) ?? null, at: last.created_at as string };
}

/** The longest-standing active administrator, who gets the task. Null when none can be read. */
async function administratorId(): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  return ((data ?? [])[0]?.id as string | undefined) ?? null;
}

/**
 * ASK FOR TRAVEL. files.create, the same permission as taking the job. A field
 * job with no travel and no order yet; a second press while one is pending
 * changes nothing.
 */
export async function requestTravel(
  actor: Author,
  fileId: string,
): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  if (!can(actor, "files.create")) return { ok: false, error: "Your role cannot ask for travel on a job." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const file = await loadFile(fileId);
  if (!file) return { ok: false, error: "That file does not exist." };
  const entry = file.deliverable ? catalogFor(file.service_slug, file.deliverable) : undefined;
  if (entry?.orderType !== "field") return { ok: false, error: "Travel applies only to a job somebody visits." };
  if (file.travel_cents) return { ok: false, error: "Travel is already set on this job." };
  const raised = await secondOrderRefusal(fileId);
  if (raised) return { ok: false, error: `Travel is set before the payment link. ${raised}` };

  const state = await travelRequestFor(fileId);
  if (state.pending === null) return { ok: false, error: `Nothing was asked: ${state.error}.` };
  if (state.pending) return { ok: true, already: true };

  const { data: event, error } = await db
    .from("eng_file_events")
    .insert({ file_id: fileId, actor_id: actor.id, kind: TRAVEL_REQUESTED, body: `${file.county} County` })
    .select("id")
    .single();
  if (error || !event) return { ok: false, error: `The request could not be recorded: ${error?.message ?? "nothing came back"}.` };

  const task = await raiseSystemTask({
    key: `travel-request:${event.id as string}`,
    title: `Set travel for ${file.file_number}, ${file.county} County`,
    description: `${actor.email} asked for travel on ${file.file_number} at ${file.property_address}, ${file.county} County. The payment link is held until travel is set, and goes by itself when you set it on the file.`,
    assigneeId: await administratorId(),
    fileId,
  });
  await writeAudit({
    actor,
    action: "file.travel_requested",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: travel requested for ${file.county} County; the payment link is held until it is set.`,
  });
  if (!task.ok) return { ok: false, error: `The request is recorded and the administrator's task could not be raised: ${task.error}. Tell the administrator.` };
  return { ok: true, already: false };
}

/**
 * Travel was set on a file somebody asked about: the answer is written, the
 * link goes, and whoever asked is told, in a task on the file, either way.
 */
async function answerTravelRequest(actor: Author, fileId: string, request: { eventId: string; requestedBy: string | null }): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db.from("eng_file_events").insert({ file_id: fileId, actor_id: actor.id, kind: TRAVEL_REQUEST_ANSWERED, body: "Travel set." });
  const sent = await sendPaymentLink(actor, fileId);
  const file = await loadFile(fileId);
  const number = file?.file_number ?? "the job";
  await raiseSystemTask({
    key: `travel-set:${request.eventId}`,
    title: sent.ok ? `Travel set on ${number}: the payment link has gone` : `Travel set on ${number}: the payment link did not go`,
    description: sent.ok
      ? `The administrator set the travel you asked for, and the payment link went out against ${sent.reference}. Tell the caller to look for it.`
      : `The administrator set the travel you asked for, and the payment link did not go: ${sent.error} Open the file: if an order was raised, send its link again from the payment block; if not, send the payment link from there.`,
    assigneeId: request.requestedBy,
    fileId,
  });
}

/**
 * SEND THE TRIP FEE LINK. Robert's answers 7 to 10 of 2026-11-14 (E5), 0134.
 *
 * For the file's latest visit the technician could not get into: a second,
 * separate order of $125, kind trip_fee, naming the visit, through the same
 * checkout and to the same payer as the job's own link. It is the one stated
 * exception to one order per job, and it is never the order the file is
 * worked under (order-for-file.ts reads job orders only), so it earns no
 * partner commission (answer 9) and the job's refund leaves it alone (answer
 * 10). No partner attribution is run on it for the same reason.
 *
 * A press with a trip fee already waiting sends that one again rather than
 * raising a second; the unique index on the visit refuses two live ones.
 */
export async function sendTripFeeLink(actor: Author, fileId: string): Promise<BillResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const file = await loadFile(fileId);
  if (!file) return { ok: false, error: "That file does not exist." };

  const refusal = refusedBecause("link_sent", false, true);
  if (refusal) return { ok: false, error: refusal };

  const state = await noAccessState(fileId);
  if (state.kind === "unknown") return { ok: false, error: `Whether a trip fee is owed could not be read, so nothing was sent: ${state.error}.` };
  if (state.kind === "none") return { ok: false, error: "No visit on this job is waiting for a trip fee." };
  if (state.kind === "paid") return { ok: false, error: `The trip fee for the last visit is paid (${state.tripOrder.reference}). Offer the job again from dispatch.` };

  const loaded = await loadClient(file.client_id);
  if (!loaded) return { ok: false, error: "That file has no client." };
  const payer = await payerFor(fileId, { name: loaded.name as string, email: (loaded.email as string | null) ?? null, phone: (loaded.phone as string | null) ?? null });
  if (!payer.ok) return { ok: false, error: `${payer.error} No link was sent.` };
  if (!payer.email) {
    return { ok: false, error: `${payer.isClient ? "That client" : "The person paying"} has no email address, so there is nowhere to send a link.` };
  }

  let orderId: string;
  let reference: string;
  if (state.tripOrder) {
    orderId = state.tripOrder.id;
    reference = state.tripOrder.reference;
  } else {
    reference = referenceFor(payer.email);
    const { data, error } = await db
      .from("eng_service_orders")
      .insert({
        site: SITE_KEY,
        reference,
        is_demo: reference.includes(`-${DEMO_FILE_SEGMENT}-`),
        kind: "trip_fee",
        trip_for_visit: state.visitId,
        service_slug: file.service_slug,
        tier: file.deliverable,
        order_type: "field",
        customer_name: payer.name,
        customer_email: payer.email,
        customer_phone: payer.phone,
        property_address: file.property_address,
        city: file.city,
        county: file.county,
        postal_code: file.postal_code,
        price_cents: TRIP_FEE_CENTS,
        coastal_surcharge_cents: null,
        twia_county: false,
        total_cents: TRIP_FEE_CENTS,
        inspection_fee_cents: null,
        refund_disclosure: TRIP_FEE_REFUND_TERMS,
        status: "awaiting_payment",
        billing_mode: "card",
        client_id: file.client_id,
        file_id: file.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `The trip fee could not be raised: ${error.message}` };
    orderId = data.id as string;
    await writeAudit({
      actor,
      action: "order.trip_fee_raised",
      entityType: "service_order",
      entityId: orderId,
      summary: `${reference}: a ${money(TRIP_FEE_CENTS)} trip fee raised against ${file.file_number} for a visit that could not get in.`,
    });
  }

  const checkout = await startCheckout(orderId);
  if (!checkout.ok) return { ok: false, error: `Trip fee ${reference} was raised and its payment link could not be created: ${checkout.error}` };

  const queued = await queueEmail(
    tripFeeLink({
      customerName: payer.name,
      customerEmail: payer.email,
      reference,
      propertyAddress: file.property_address,
      amount: money(TRIP_FEE_CENTS),
      payUrl: checkout.url,
    }),
    { orderId },
  );
  if (!queued.ok) return { ok: false, error: `The trip fee link for ${reference} could not be queued: ${queued.error}. Nothing was sent.` };

  await db.from("eng_order_events").insert({
    order_id: orderId,
    event: state.tripOrder ? "trip_fee.link_resent" : "trip_fee.link_sent",
    customer_visible: false,
    summary: `The trip fee link was sent to ${payer.email}.`,
  });
  await writeAudit({
    actor,
    action: "file.trip_fee_link_sent",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: the trip fee link for ${reference} was sent to ${payer.email}.`,
  });

  return { ok: true, orderId, reference, checkoutUrl: checkout.url };
}

/**
 * Bill this job to the client's account rather than charging a card.
 *
 * UNEXERCISED UNTIL LAUNCH. See the header.
 */
export async function invoiceAccount(actor: Author, fileId: string): Promise<BillResult> {
  const file = await loadFile(fileId);
  if (!file) return { ok: false, error: "That file does not exist." };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  /* A client can hold more than one account, one per site, so this is ordered
   * and limited rather than asked for as a single row. Oldest first, which is
   * the account the client has been billed against. A discarded error read two
   * accounts as none and refused an invoice the client was entitled to. */
  const { data: accountRows, error: accountErr } = await db
    .from("eng_customer_accounts")
    .select("id, status, billing_mode, credit_limit_cents, net_days")
    .eq("client_id", file.client_id)
    /*
     * A superseded duplicate found by client_id would be billed against instead
     * of the real account. See src/lib/account-scope.ts.
     */
    .is("superseded_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (accountErr) {
    return { ok: false, error: `Could not read the ordering account for that client: ${accountErr.message}` };
  }
  const account = (accountRows ?? [])[0] ?? null;

  const canInvoice = Boolean(account && account.status === "active" && account.billing_mode === "invoice");
  const refusal = refusedBecause("invoiced", canInvoice, file.client_price_cents !== null);

  /* The terms before the money, on both doors. */
  const gap = await termsGap(file);
  if (gap) return { ok: false, error: gap };
  if (refusal) return { ok: false, error: refusal };

  const client = await loadClient(file.client_id);
  if (!client) return { ok: false, error: "That file has no client." };

  /* One order per job, as on the link path. */
  const second = await secondOrderRefusal(fileId);
  if (second) return { ok: false, error: second };

  /*
   * THE CREDIT GATE, THE SAME ONE A BULK SUBMISSION MEETS. Robert's ruling Q7,
   * money finding F3, 2026-11-02. This door ran no creditDecision at all: a
   * $5,000.00 account with $4,900.00 outstanding was invoiced a $709.00
   * telephoned job without a word. It is asked here, against the same
   * accountBalance, before any order exists, and refuses in its own sentence.
   */
  if (!account) return { ok: false, error: "That client has no ordering account to invoice." };
  const balance = await accountBalance(account.id as string);
  const verdict = creditDecision(
    {
      billingMode: "invoice",
      status: account.status as "active" | "suspended" | "closed",
      creditLimitCents: account.credit_limit_cents === null ? null : Number(account.credit_limit_cents),
      outstandingCents: balance.outstandingCents,
      oldestUnpaidDays: balance.oldestUnpaidDays,
      netDays: Number(account.net_days),
    },
    file.client_price_cents,
  );
  if (!verdict.ok) return { ok: false, error: verdict.message };

  const order = await createOrderForFile(actor, file, client, "invoice", account.id as string);
  if (!order.ok) return order;

  /* The sales attribution (R8, 0119): a telephoned job invoiced to an account that came from a prospect is credited to that prospect's rep, as an order placed online is. */
  await attributeOrder(order.orderId, account ? String(account.id) : null);

  /*
   * ACCEPTED ON THE ACCOUNT, SO closePeriod PICKS IT UP (Q7, F3). The order used
   * to sit at awaiting_payment with no checkout, which no statement selects and
   * the orders screen listed as stuck for ever. acceptOnInvoice is the bulk
   * path's own step: in_fulfilment, the customer told it goes on the next
   * statement, and the file released for the work, as a paid link would be.
   */
  const accepted = await acceptOnInvoice(order.orderId);
  if (!accepted.ok) {
    await writeAudit({
      actor,
      action: "file.invoice_not_accepted",
      entityType: "file",
      entityId: fileId,
      summary: `${file.file_number}: ${order.reference} was raised on the account and could not be accepted on it: ${accepted.error}`,
    });
    return {
      ok: false,
      error: `${order.reference} was raised on the account and could not be accepted on it, so it is not on a statement yet: ${accepted.error} A person settles it from the orders screen.`,
    };
  }

  await db
    .from("eng_files")
    .update({
      payment_intent: "invoiced",
      payment_note: `Invoiced to the account against ${order.reference}. It joins the next statement.`,
    })
    .eq("id", fileId);

  await writeAudit({
    actor,
    action: "file.invoiced",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: invoiced to the account against ${order.reference}.`,
  });

  return { ok: true, orderId: order.orderId, reference: order.reference };
}

/* ======================================================================== */
/* A PAYMENT RECEIVED OUTSIDE THE PLATFORM (0138)                            */
/* ======================================================================== */

/* The words, A and B, live in outside-payment-words.ts, shared with the customer's order page. */

/**
 * Record on a job a payment received outside the platform. Robert's answers 2,
 * 3 and 5 of the night of 2026-11-18 (issue #1, 6992466384, plan 6992348494).
 *
 * The administrator alone (payments.record_outside, 0138). The amount must
 * equal the job's total, its price and any travel (answer 3): a different
 * amount is refused before anything is written, naming the figure to fix.
 *
 * It raises the job's order exactly as the payment link does
 * (createOrderForFile, so the order carries the catalog price, the travel, the
 * inspection fee and the refund terms), starts no checkout, and applies the
 * payment through markPaid, the one path every payment takes, with the source
 * staff_recorded and the Stripe reference as the charge. Revenue, the release
 * and every report then read it as a card payment.
 *
 * WORK ALREADY UNDER WAY. A job opened unpaid may have been dispatched, or
 * further, before its payment is recorded. The release would try to move the
 * file back to where a payment lands it, be refused, and write "work.blocked",
 * which reads as paid work stuck. So when the file is past that point, the
 * order's own work.released line is written FIRST, saying the work was already
 * under way, and the release finds it and leaves the file where it is.
 *
 * Once per Stripe reference: a reference already recorded is refused, naming
 * it, so the same invoice cannot be recorded on two jobs.
 */
export async function recordOutsidePayment(
  actor: Author & { email: string },
  input: { fileId: string; amountCents: number; reference: string; paidOn: string; reason: string },
): Promise<{ ok: true; reference: string; orderId: string } | { ok: false; error: string }> {
  if (!can(actor as never, "payments.record_outside")) {
    return { ok: false, error: "Only the administrator records a payment made outside the platform." };
  }
  const reference = input.reference.trim();
  const reason = input.reason.trim();
  if (!reference) return { ok: false, error: "Type the Stripe invoice number or payment reference." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return { ok: false, error: "Give the date it was paid." };
  if (reason.length < MIN_OVERRIDE_REASON) {
    return { ok: false, error: `Say why it was paid outside the platform, in at least ${MIN_OVERRIDE_REASON} characters.` };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "Type the amount paid as a plain number of dollars above zero." };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const file = await loadFile(input.fileId);
  if (!file) return { ok: false, error: "That file does not exist." };

  /* Answer 3: the amount must equal the job's total, read off the file, before anything is written. */
  if (file.client_price_cents === null) return { ok: false, error: "This job has no price, so a payment cannot be matched to it." };
  const totalCents = file.client_price_cents + (file.travel_cents ? Number(file.travel_cents) : 0);
  if (input.amountCents !== totalCents) {
    return {
      ok: false,
      error:
        `The amount paid, ${money(input.amountCents)}, is not this job's total, ${money(totalCents)} ` +
        `(${money(file.client_price_cents)} price${file.travel_cents ? ` and ${money(Number(file.travel_cents))} travel` : ""}). ` +
        "Correct the job's price or travel first, or the amount, and record it again. Nothing was recorded.",
    };
  }

  /* Once per reference. The event id is the reference, so this is the read the database's primary key would refuse. */
  const eventId = `staff_recorded:${reference}`;
  const { data: prior, error: priorError } = await db.from("eng_payment_events").select("order_id").eq("event_id", eventId).maybeSingle();
  if (priorError) return { ok: false, error: `Whether that reference was already recorded could not be read: ${priorError.message}. Nothing was recorded.` };
  if (prior) return { ok: false, error: `The reference ${reference} is already recorded on another payment. Nothing was recorded.` };

  const gap = await termsGap(file);
  if (gap) return { ok: false, error: gap };

  const loaded = await loadClient(file.client_id);
  if (!loaded) return { ok: false, error: "That file has no client." };
  const payer = await payerFor(input.fileId, { name: loaded.name as string, email: (loaded.email as string | null) ?? null, phone: (loaded.phone as string | null) ?? null });
  if (!payer.ok) return { ok: false, error: `${payer.error} Nothing was recorded.` };
  const client = { name: payer.name, email: payer.email, phone: payer.phone };

  const second = await secondOrderRefusal(input.fileId);
  if (second) return { ok: false, error: second };

  const { data: fileRow, error: fileError } = await db.from("eng_files").select("status").eq("id", input.fileId).maybeSingle();
  if (fileError || !fileRow) return { ok: false, error: `The file's status could not be read${fileError ? `: ${fileError.message}` : ""}. Nothing was recorded.` };

  const order = await createOrderForFile(actor, file, client, "card");
  if (!order.ok) return order;

  const entry = file.deliverable ? catalogFor(file.service_slug, file.deliverable) : undefined;
  const landing = entry ? landingStatusFor(entry.orderType) : null;
  const status = String(fileRow.status);
  const underWay = landing !== null && status !== "intake" && status !== landing;

  /* The firm's calendar, as every date this platform states (and not this process's clock, which db-guard-audit refuses). */
  const recordedOn = todayInFirmCalendar();
  const staffRecord = outsidePaymentStaffRecord({
    amount: money(input.amountCents),
    reference,
    paidOn: input.paidOn,
    recordedBy: actor.email,
    recordedOn,
    reason,
  });
  const lines: { order_id: string; event: string; customer_visible: boolean; summary: string; detail?: Record<string, unknown> }[] = [
    { order_id: order.orderId, event: OUTSIDE_PAYMENT_EVENT, customer_visible: false, summary: staffRecord, detail: { reference, paid_on: input.paidOn } },
    { order_id: order.orderId, event: TERMS_AFTER_PAYMENT_EVENT, customer_visible: true, summary: termsAfterPaymentLine(input.paidOn), detail: { paid_on: input.paidOn } },
  ];
  if (underWay) {
    lines.push({
      order_id: order.orderId,
      event: "work.released",
      customer_visible: false,
      summary: `The work was already under way (the file is ${status}) when this payment was recorded, so it was left where it is.`,
    });
  }
  const { error: linesError } = await db.from("eng_order_events").insert(lines);
  if (linesError) {
    return { ok: false, error: `Order ${order.reference} was raised and its record could not be written: ${linesError.message}. No payment was recorded on it.` };
  }

  const paid = await markPaid({
    eventId,
    source: "staff_recorded",
    orderId: order.orderId,
    chargeRef: reference,
    amountCents: input.amountCents,
    provider: "stripe_invoice",
  });
  if (!paid.ok) return { ok: false, error: `Order ${order.reference} was raised and the payment could not be recorded on it: ${paid.error}` };

  await writeAudit({
    actor: actor as never,
    action: "payment.recorded_outside",
    entityType: "service_order",
    entityId: order.orderId,
    summary: staffRecord,
  });

  return { ok: true, reference: order.reference, orderId: order.orderId };
}
