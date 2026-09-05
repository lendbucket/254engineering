import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin, SITE_KEY } from "./supabase";
import { writeAudit } from "./ops-audit";
import { startCheckout } from "./ops-payments";
import { queueEmail } from "./ops-jobs";
import { jobPaymentLink } from "./email-templates";
import { money } from "./ops-money";
import { isPrelaunch } from "./launch";
import { catalogFor } from "@data/catalog";
import { paymentOptions } from "./job-intake-rules";
import type { Author } from "./ops-crm";

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
function referenceFor(): string {
  let suffix = "";
  for (const byte of randomBytes(6)) suffix += ALPHABET[byte % ALPHABET.length];
  return `${SITE_KEY}-O${new Date().getFullYear()}-${suffix}`;
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
  payment_intent: string;
  client_id: string;
};

async function loadFile(fileId: string): Promise<FileForBilling | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_files")
    .select(
      "id, file_number, service_slug, deliverable, property_address, city, county, postal_code, client_price_cents, payment_intent, client_id",
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
  const reference = referenceFor();

  const { data, error } = await db
    .from("eng_service_orders")
    .insert({
      site: SITE_KEY,
      reference,
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
      total_cents: file.client_price_cents,
      status: "awaiting_payment",
      billing_mode: billingMode,
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

  return { ok: true, orderId: data.id, reference };
}

/**
 * The gate, asked once, in the same words the screen asked it.
 *
 * The screen decides which buttons to draw and this decides what may actually
 * happen, so a hand crafted request reaches the same refusal a person sees.
 */
function refusedBecause(intent: "link_sent" | "invoiced", accountCanInvoice: boolean, priced: boolean) {
  const option = paymentOptions({ prelaunch: isPrelaunch(), accountCanInvoice, priced }).find(
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
  if (refusal) return { ok: false, error: refusal };

  const client = await loadClient(file.client_id);
  if (!client) return { ok: false, error: "That file has no client." };

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
  await queueEmail(
    jobPaymentLink({
      customerName: client.name,
      customerEmail: client.email,
      reference: order.reference,
      propertyAddress: file.property_address,
      deliverableName: entryName(file),
      amount: money(file.client_price_cents),
      payUrl: checkout.url,
      takenBy: actor.email,
    }),
  );

  const db = supabaseAdmin();
  await db
    ?.from("eng_files")
    .update({
      payment_intent: "link_sent",
      payment_note: `Payment link sent to ${client.email} against ${order.reference}.`,
    })
    .eq("id", fileId);

  await writeAudit({
    actor,
    action: "file.payment_link_sent",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: a payment link was sent to ${client.email} against ${order.reference}.`,
  });

  return { ok: true, orderId: order.orderId, reference: order.reference, checkoutUrl: checkout.url };
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

  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("id, status, billing_mode")
    .eq("client_id", file.client_id)
    .maybeSingle();

  const canInvoice = Boolean(account && account.status === "active" && account.billing_mode === "invoice");
  const refusal = refusedBecause("invoiced", canInvoice, file.client_price_cents !== null);
  if (refusal) return { ok: false, error: refusal };

  const client = await loadClient(file.client_id);
  if (!client) return { ok: false, error: "That file has no client." };

  const order = await createOrderForFile(actor, file, client, "invoice");
  if (!order.ok) return order;

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
