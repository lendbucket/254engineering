import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { money } from "./ops-money";
import { paymentProvider } from "./ops-payments";
import { deploymentOrigin } from "./site-url";
import { event } from "./ops-intake";

/**
 * Statements: what an invoiced account owes for a period.
 *
 * WHAT THIS IS, AND THE LINE THE OPERATOR DREW
 * --------------------------------------------
 * "Payment against a statement runs through the existing Stripe path. Do not
 * build dunning or collections; make the state visible to the operator and stop
 * there."
 *
 * So there is no reminder schedule, no escalation, no automatic suspension and
 * no late fee. A statement is opened, issued, and either paid or not, and an
 * overdue one closes further ordering through creditDecision, which is the only
 * automatic consequence in the whole design.
 *
 * That restraint is deliberate rather than unfinished. A rule that decides an
 * account is delinquent and acts on it will one day be wrong about a customer
 * who is on the telephone explaining why, and the firm has three customers, not
 * three thousand.
 *
 * THE LINES ARE COPIED, NOT JOINED
 * --------------------------------
 * A statement line carries its own amount and description rather than reading
 * through to the order. A statement is what the customer was billed, and if the
 * order is later refunded or its price corrected, the statement they were sent
 * must not silently change to disagree with the copy in their filing cabinet.
 *
 * The same reasoning the order already applies to the catalog.
 */

/** Period keys are YYYY-MM, matching eng_production_ledger and the billing screen. */
export function periodKey(when: Date = new Date()): string {
  return `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type StatementResult =
  | { ok: true; statementId: string; reference: string; lines: number; totalCents: number; alreadyExisted: boolean }
  | { ok: false; error: string };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function statementReference(period: string): string {
  let tail = "";
  for (let i = 0; i < 5; i += 1) tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `254-S${period.replace("-", "")}-${tail}`;
}

/**
 * Close a period for one account.
 *
 * Gathers every invoiced order that is not already on a statement and attaches
 * it to one. Idempotent by construction: the unique index on
 * (account_id, period) means a second close finds the existing statement, and
 * the unique index on (statement_id, order_id) means an order cannot appear on
 * one twice.
 *
 * ORDERS ARE CLAIMED BY SETTING statement_id, WHICH IS THE LOCK
 * -------------------------------------------------------------
 * An order with a statement_id is never gathered again. Without that, two closes
 * running at once would each gather the same orders and the second would fail on
 * the line index having already billed them, or worse, bill them onto a second
 * statement in a different period.
 */
export async function closePeriod(
  accountId: string,
  period: string,
  options: { actorEmail?: string } = {},
): Promise<StatementResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("id, billing_mode, net_days, status")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { ok: false, error: "That account does not exist." };
  if (account.billing_mode !== "invoice") {
    return { ok: false, error: "That account pays by card, so it has nothing to be invoiced for." };
  }

  const { data: existing } = await db
    .from("eng_statements")
    .select("id, reference, status, total_cents")
    .eq("account_id", accountId)
    .eq("period", period)
    .maybeSingle();

  /*
   * An issued statement is closed. Reopening it to add a late order would change
   * a document the customer has already been sent, so a late order lands on the
   * NEXT period instead, which is where it belongs.
   */
  if (existing && existing.status !== "open") {
    return {
      ok: true,
      statementId: existing.id as string,
      reference: existing.reference as string,
      lines: 0,
      totalCents: Number(existing.total_cents ?? 0),
      alreadyExisted: true,
    };
  }

  let statementId = existing?.id as string | undefined;
  let reference = existing?.reference as string | undefined;

  if (!statementId) {
    reference = statementReference(period);
    const { data: created, error } = await db
      .from("eng_statements")
      .insert({ account_id: accountId, reference, period, status: "open" })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "The statement could not be opened." };
    statementId = created.id as string;
  }

  /*
   * Everything invoiced, delivered or underway, and not yet billed. A draft or
   * an awaiting_payment order is not billable: nothing has been agreed.
   */
  const { data: orders, error: ordersError } = await db
    .from("eng_service_orders")
    .select("id, reference, property_address, service_slug, total_cents")
    .eq("account_id", accountId)
    .eq("billing_mode", "invoice")
    .is("statement_id", null)
    .in("status", ["paid", "in_fulfilment", "complete"]);

  if (ordersError) return { ok: false, error: "The unbilled orders could not be read." };

  let lines = 0;
  let totalCents = 0;

  for (const o of orders ?? []) {
    /*
     * An order with no total cannot be billed. Skipped and said out loud rather
     * than billed as zero, which is the Phase 6 rule applied to invoicing: an
     * absent figure is not a zero, and a zero line on a statement is a claim
     * that the work was free.
     */
    if (o.total_cents === null) {
      await event(
        o.id as string,
        "statement.skipped",
        false,
        "This order has no total, so it was left off the statement rather than billed as nothing.",
      );
      continue;
    }

    const amount = Number(o.total_cents);
    const { error: lineError } = await db.from("eng_statement_lines").insert({
      statement_id: statementId,
      order_id: o.id,
      description: `${o.reference}: ${o.property_address}`,
      amount_cents: amount,
    });

    // 23505 means this order is already on this statement. Not an error.
    if (lineError && lineError.code !== "23505") continue;

    await db.from("eng_service_orders").update({ statement_id: statementId }).eq("id", o.id);
    if (!lineError) {
      lines += 1;
      totalCents += amount;
    }
  }

  /*
   * The total is recomputed from the LINES rather than accumulated, so a close
   * that ran twice, or one that skipped an order, cannot leave a header that
   * disagrees with what is printed beneath it.
   */
  const { data: allLines } = await db
    .from("eng_statement_lines")
    .select("amount_cents")
    .eq("statement_id", statementId);
  const headerTotal = (allLines ?? []).reduce((n, l) => n + Number(l.amount_cents), 0);

  await db.from("eng_statements").update({ total_cents: headerTotal }).eq("id", statementId);

  await writeAudit({
    actor: { id: null, role: "admin", email: options.actorEmail ?? "order-engine@254engineering.com" },
    action: "statement.period_closed",
    entityType: "customer_account",
    entityId: accountId,
    summary: `${reference}: ${period} closed with ${allLines?.length ?? 0} line(s), ${money(headerTotal)}`,
  });

  return {
    ok: true,
    statementId: statementId!,
    reference: reference!,
    lines,
    totalCents: headerTotal,
    alreadyExisted: Boolean(existing),
  };
}

/**
 * Issue a statement: the moment it becomes a bill rather than a working total.
 *
 * The due date is set from the account's terms HERE, and stored, rather than
 * computed later from net_days. If the terms change next month, a statement
 * already sent must not silently acquire a different due date.
 */
export async function issueStatement(
  statementId: string,
  actorEmail?: string,
): Promise<{ ok: true; dueAt: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: statement } = await db
    .from("eng_statements")
    .select("id, reference, status, account_id, total_cents")
    .eq("id", statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "That statement does not exist." };
  if (statement.status !== "open") {
    return { ok: false, error: `That statement is ${statement.status} and cannot be issued again.` };
  }
  if (statement.total_cents === null || Number(statement.total_cents) <= 0) {
    return { ok: false, error: "That statement has nothing on it, so there is nothing to issue." };
  }

  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("net_days")
    .eq("id", statement.account_id)
    .maybeSingle();

  const netDays = Number(account?.net_days ?? 30);
  const dueAt = new Date(Date.now() + netDays * 24 * 60 * 60 * 1000).toISOString();

  await db
    .from("eng_statements")
    .update({ status: "issued", issued_at: new Date().toISOString(), due_at: dueAt })
    .eq("id", statementId);

  await writeAudit({
    actor: { id: null, role: "admin", email: actorEmail ?? "order-engine@254engineering.com" },
    action: "statement.issued",
    entityType: "customer_account",
    entityId: statement.account_id as string,
    summary: `${statement.reference}: ${money(Number(statement.total_cents))} issued, due in ${netDays} days`,
  });

  return { ok: true, dueAt };
}

/**
 * A checkout for a statement, through the same Stripe path everything else uses.
 *
 * One line per order, for the same reason a batch's checkout is per property: a
 * receipt somebody can check against what they were sent beats a single number
 * they have to trust.
 */
export async function startStatementCheckout(
  statementId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const provider = paymentProvider();
  if (!provider.configured()) {
    return { ok: false, error: "Payments are not configured on this deployment." };
  }

  const { data: statement } = await db
    .from("eng_statements")
    .select("id, reference, status, total_cents, currency, account_id")
    .eq("id", statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "That statement does not exist." };
  if (statement.status !== "issued") {
    return { ok: false, error: `That statement is ${statement.status} and is not awaiting payment.` };
  }

  const { data: lines } = await db
    .from("eng_statement_lines")
    .select("description, amount_cents")
    .eq("statement_id", statementId);

  if (!lines?.length) return { ok: false, error: "That statement has no lines." };

  const lineTotal = lines.reduce((n, l) => n + Number(l.amount_cents), 0);
  if (lineTotal !== Number(statement.total_cents)) {
    console.error(
      `[statements] ${statement.reference}: lines total ${lineTotal} and the statement says ${statement.total_cents}. Refusing to charge.`,
    );
    return {
      ok: false,
      error: "The lines on this statement do not add up to its total. Nothing was charged.",
    };
  }

  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("billing_email, client_id")
    .eq("id", statement.account_id)
    .maybeSingle();

  const { data: client } = account
    ? await db.from("eng_clients").select("email").eq("id", account.client_id).maybeSingle()
    : { data: null };

  const email = (account?.billing_email as string) || (client?.email as string) || "";
  if (!email) return { ok: false, error: "This account has no billing email to send a receipt to." };

  const session = await provider.createCheckout({
    reference: statement.reference as string,
    subjectKind: "statement",
    orderId: statement.id as string,
    amountCents: Number(statement.total_cents),
    currency: (statement.currency as string) ?? "usd",
    customerEmail: email,
    description: `Statement ${statement.reference}`,
    lines: lines.map((l) => ({ label: l.description as string, amountCents: Number(l.amount_cents) })),
    successUrl: `${deploymentOrigin()}/account/statements/${statement.reference}?paid=1`,
    cancelUrl: `${deploymentOrigin()}/account/statements/${statement.reference}?cancelled=1`,
  });

  return { ok: true, url: session.url };
}

/**
 * A statement was paid.
 *
 * One charge row against the statement, for the same reason a batch gets one:
 * one payment happened. The orders beneath it are already in fulfilment and are
 * not touched, because paying the bill does not change the work.
 */
export async function markStatementPaid(input: {
  statementId: string;
  chargeRef: string;
  amountCents: number;
  provider: string;
}): Promise<{ ok: true; alreadyRecorded: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: statement } = await db
    .from("eng_statements")
    .select("id, reference, account_id")
    .eq("id", input.statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "That statement does not exist." };

  const { error } = await db.from("eng_order_payments").insert({
    statement_id: input.statementId,
    kind: "charge",
    amount_cents: input.amountCents,
    provider: input.provider,
    provider_ref: input.chargeRef,
    status: "succeeded",
  });

  if (error) {
    if (error.code === "23505") return { ok: true, alreadyRecorded: true };
    return { ok: false, error: error.message };
  }

  await db
    .from("eng_statements")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", input.statementId);

  await writeAudit({
    actor: { id: null, role: "admin", email: "order-engine@254engineering.com" },
    action: "statement.paid",
    entityType: "customer_account",
    entityId: statement.account_id as string,
    summary: `${statement.reference}: ${money(input.amountCents)} received`,
  });

  return { ok: true, alreadyRecorded: false };
}

/** Statements for one account, newest first. */
export async function statementsFor(accountId: string) {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_statements")
    .select("id, reference, period, status, total_cents, issued_at, due_at, paid_at")
    .eq("account_id", accountId)
    .order("period", { ascending: false });
  return data ?? [];
}
