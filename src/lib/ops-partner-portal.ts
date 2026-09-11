import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import type { Cents } from "./ops-money";
import { writeAudit } from "./ops-audit";
import { netOf } from "./partner-comp";
import { partnerBalance, partnerLedger, type LedgerRow } from "./ops-partner-comp";
import type { PartnerPrincipal } from "./partner-auth";

/**
 * Everything a partner is allowed to read, and nothing else.
 *
 * WHY THIS IS ONE MODULE RATHER THAN QUERIES ON THE PAGES
 * -------------------------------------------------------
 * Because the boundary is a list of columns, and a list of columns spread
 * across six screens is a list nobody can check. Every read a partner surface
 * makes goes through here, every function takes the partner id from the
 * session, and no function accepts a partner id from a caller who did not get
 * it that way.
 *
 * THE LIST, WHICH IS THE WHOLE POINT
 * ----------------------------------
 * A partner sees the facts of their own referral and their own money. They do
 * not see the property address, the client, the file, the file's status, the
 * evidence, the engineer's decision, any document, what the firm paid a
 * technician or an engineer, or any margin.
 *
 * `partner-audit` asserts that no select list in this file names a forbidden
 * column, against a written list, so adding `property_address` to a query here
 * fails the suite rather than shipping a leak. The reasoning for each exclusion
 * is in docs/partner-portal.md.
 *
 * THE ORDER VALUE IS THE ONE THING THAT LOOKS LIKE AN EXCEPTION
 * -------------------------------------------------------------
 * It is shown where a commission was computed from it, and not otherwise. Under
 * a percentage model a partner cannot check their own statement without it, and
 * a figure a partner cannot check is the thing this entire phase exists to
 * avoid. Under a flat fee no basis is shown, because none was used.
 */

// ------------------------------------------------------------------ overview

export type PartnerOverview = {
  /* Cents, not number: partnerBalance returns null when the ledger could not
   * be read, and a partner is told the figure is not known rather than that
   * they earned nothing. */
  payableCents: Cents;
  heldCents: Cents;
  issuedCents: Cents;
  blocked: number;
  referrals: number;
  delivered: number;
  recent: LedgerRow[];
};

export async function partnerOverview(principal: PartnerPrincipal): Promise<PartnerOverview> {
  const db = supabaseAdmin();
  const balance = await partnerBalance(principal.partnerId);
  const recent = await partnerLedger(principal.partnerId, { limit: 8 });

  let referrals = 0;
  let delivered = 0;

  if (db) {
    const { count } = await db
      .from("eng_service_orders")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", principal.partnerId);
    referrals = count ?? 0;

    /*
     * Delivered is counted from the LEDGER rather than from the files table.
     *
     * Not a shortcut: an accrual exists exactly when the firm delivered
     * something this partner is credited for, and counting files would mean
     * reading a table this module is not allowed to read. The number a partner
     * sees is therefore the number their money is computed from, which is the
     * only version of it they can check.
     */
    const { count: accruals } = await db
      .from("eng_partner_entries")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", principal.partnerId)
      .eq("kind", "accrual");
    delivered = accruals ?? 0;
  }

  return {
    payableCents: balance.payableCents,
    heldCents: balance.heldCents,
    issuedCents: balance.issuedCents,
    blocked: balance.blocked,
    referrals,
    delivered,
    recent,
  };
}

// ----------------------------------------------------------------- referrals

/**
 * The partner facing state of a referral.
 *
 * A DELIBERATE TRANSLATION, NOT THE ORDER'S OWN STATUS
 * ----------------------------------------------------
 * The order machine has states that describe the firm's work on it, and
 * repeating them here would tell a partner more about a client's engineering
 * than they have any business knowing. These five say what a partner needs:
 * has it been paid for, is it done, did the money go back.
 */
export type ReferralState = "received" | "paid" | "underway" | "complete" | "returned";

const REFERRAL_STATE: Record<string, ReferralState> = {
  draft: "received",
  awaiting_payment: "received",
  paid: "paid",
  in_fulfilment: "underway",
  complete: "complete",
  refunded: "returned",
  cancelled: "returned",
};

export const REFERRAL_LABEL: Record<ReferralState, string> = {
  received: "Received",
  paid: "Paid for",
  underway: "Underway",
  complete: "Complete",
  returned: "Money returned",
};

export type Referral = {
  id: string;
  reference: string;
  placedAt: string | null;
  state: ReferralState;
  /** Only where a commission was computed from it. Null otherwise. */
  basisCents: Cents;
  earnedCents: Cents;
  /** True when an entry exists whose figure could not be worked out. */
  waiting: boolean;
};

const REFERRAL_PAGE = 100;

export async function partnerReferrals(principal: PartnerPrincipal): Promise<Referral[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data: orders } = await db
    .from("eng_service_orders")
    .select("id, reference, placed_at, status")
    .eq("partner_id", principal.partnerId)
    .order("placed_at", { ascending: false })
    .limit(REFERRAL_PAGE);

  const ids = (orders ?? []).map((o) => o.id as string);
  if (ids.length === 0) return [];

  const { data: entries } = await db
    .from("eng_partner_entries")
    .select("order_id, amount_cents, status, basis_cents")
    .eq("partner_id", principal.partnerId)
    .in("order_id", ids);

  const byOrder = new Map<string, { amountCents: number | null; status: "accrued" | "blocked"; basis: number | null }[]>();
  for (const row of entries ?? []) {
    const key = row.order_id as string;
    byOrder.set(key, [
      ...(byOrder.get(key) ?? []),
      {
        amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
        status: row.status as "accrued" | "blocked",
        basis: row.basis_cents === null ? null : Number(row.basis_cents),
      },
    ]);
  }

  return (orders ?? []).map((order) => {
    const rows = byOrder.get(order.id as string) ?? [];
    const net = netOf(rows.map((r) => ({ amountCents: r.amountCents, status: r.status })));
    const basis = rows.find((r) => r.basis !== null)?.basis ?? null;
    return {
      id: order.id as string,
      reference: order.reference as string,
      placedAt: (order.placed_at as string | null) ?? null,
      state: REFERRAL_STATE[order.status as string] ?? "received",
      basisCents: basis,
      earnedCents: rows.length === 0 ? null : net.blocked > 0 && net.counted === 0 ? null : net.netCents,
      waiting: net.blocked > 0,
    };
  });
}

// ---------------------------------------------------------------- statements

export type PartnerStatementRow = {
  id: string;
  reference: string;
  period: string;
  status: "open" | "issued" | "paid" | "void";
  totalCents: Cents;
  issuedAt: string | null;
  paidAt: string | null;
  payoutReference: string | null;
};

/**
 * A partner's own statements.
 *
 * OPEN ONES ARE NOT SHOWN, AND THAT IS DELIBERATE
 * -----------------------------------------------
 * An open statement is the firm's working total, not a thing the firm has told
 * anybody it owes them. Showing it would mean a partner watching a figure move
 * during a close and asking why it changed, which is the same defect as an
 * editable accrual wearing different clothes.
 *
 * What a partner sees before a statement is issued is their balance, which is
 * labelled as what it is: earned, and not yet on a statement.
 */
export async function partnerStatements(principal: PartnerPrincipal): Promise<PartnerStatementRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data } = await db
    .from("eng_partner_statements")
    .select("id, reference, period, status, total_cents, issued_at, paid_at, payout_reference")
    .eq("partner_id", principal.partnerId)
    .in("status", ["issued", "paid"])
    .order("period", { ascending: false })
    .limit(60);

  return (data ?? []).map((s) => ({
    id: s.id as string,
    reference: s.reference as string,
    period: s.period as string,
    status: s.status as PartnerStatementRow["status"],
    totalCents: s.total_cents === null ? null : Number(s.total_cents),
    issuedAt: (s.issued_at as string | null) ?? null,
    paidAt: (s.paid_at as string | null) ?? null,
    payoutReference: (s.payout_reference as string | null) ?? null,
  }));
}

export type PartnerStatementDetail = {
  statement: PartnerStatementRow;
  lines: LedgerRow[];
};

/**
 * One statement and the entries on it.
 *
 * Looked up by reference AND partner id together. A reference is short enough
 * to guess at, and a lookup by reference alone would hand one partner another's
 * statement to anybody who tried.
 */
export async function partnerStatement(
  principal: PartnerPrincipal,
  reference: string,
): Promise<PartnerStatementDetail | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("eng_partner_statements")
    .select("id, reference, period, status, total_cents, issued_at, paid_at, payout_reference")
    .eq("partner_id", principal.partnerId)
    .eq("reference", reference)
    .in("status", ["issued", "paid"])
    .maybeSingle();
  if (!data) return null;

  const lines = await partnerLedger(principal.partnerId, {
    statementId: data.id as string,
    limit: 500,
  });

  return {
    statement: {
      id: data.id as string,
      reference: data.reference as string,
      period: data.period as string,
      status: data.status as PartnerStatementRow["status"],
      totalCents: data.total_cents === null ? null : Number(data.total_cents),
      issuedAt: (data.issued_at as string | null) ?? null,
      paidAt: (data.paid_at as string | null) ?? null,
      payoutReference: (data.payout_reference as string | null) ?? null,
    },
    lines,
  };
}

// ----------------------------------------------------------------- agreement

export type Agreement = { version: string; body: string; summary: string | null; publishedAt: string };

/** The current published agreement, which is the latest one with a date on it. */
export async function currentAgreement(): Promise<Agreement | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("eng_partner_agreements")
    .select("version, body, summary, published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  return {
    version: data.version as string,
    body: data.body as string,
    summary: (data.summary as string | null) ?? null,
    publishedAt: data.published_at as string,
  };
}

/**
 * Accept the current agreement.
 *
 * TWO WRITES, AND BOTH ARE NEEDED
 * -------------------------------
 * `eng_partner_acceptances` is the append only record that this person, at this
 * moment, from this address, agreed to this version. It refuses UPDATE and
 * DELETE by trigger, because it is the record the firm would produce if a
 * partner ever presented itself as an engineering firm.
 *
 * `eng_partners.agreement_version` is the working answer to "are they current",
 * which is a question every page asks and should not answer by scanning a log.
 * The log is the truth; the column is the index.
 */
export async function acceptAgreement(
  principal: PartnerPrincipal,
  version: string,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The partner system is not configured." };

  const agreement = await currentAgreement();
  if (!agreement) return { ok: false, error: "There is no published agreement to accept." };

  /*
   * The version accepted must be the CURRENT one. A stale form left open in a
   * tab would otherwise record acceptance of a document that is no longer the
   * agreement, which is exactly the thing the versioning exists to prevent.
   */
  if (agreement.version !== version) {
    return {
      ok: false,
      error: "The agreement has changed since this page was opened. Read the current one and accept that.",
    };
  }

  /*
   * DB_NOW. When a partner accepted the agreement, and which version, is the
   * evidence a dispute is settled with. It is stamped by the database, and one
   * value is written to two columns so they cannot disagree.
   */
  const acceptedAt = DB_NOW;

  const { error } = await db.from("eng_partner_acceptances").insert({
    partner_id: principal.partnerId,
    user_id: principal.id,
    agreement_version: version,
    accepted_at: acceptedAt,
    ip: context.ip ?? null,
    user_agent: context.userAgent ?? null,
  });
  if (error) return { ok: false, error: "That could not be recorded, so it has not been accepted." };

  await db
    .from("eng_partners")
    .update({ agreement_version: version, agreement_accepted_at: acceptedAt })
    .eq("id", principal.partnerId);

  await writeAudit({
    actor: { id: null, role: "admin", email: principal.email },
    action: "partner.agreement_accepted",
    entityType: "partner",
    entityId: principal.partnerId,
    summary: `${principal.partner.organisation}: ${principal.displayName} accepted version ${version}`,
    ip: context.ip ?? null,
    userAgent: context.userAgent ?? null,
  });

  return { ok: true };
}

/** Is this partner current on the published agreement? */
export function agreementOutstanding(principal: PartnerPrincipal, agreement: Agreement | null): boolean {
  if (!agreement) return false;
  return principal.partner.agreementVersion !== agreement.version;
}
