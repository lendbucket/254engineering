import "server-only";
import { readEvery } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { accountBalance } from "./ops-bulk";
import { creditDecision } from "./account-credit";
import type { Cents } from "./ops-money";

/**
 * What the operator sees about every ordering account.
 *
 * ONE ROW PER ORGANISATION, WITH THE FIGURE THAT DECIDES THINGS
 * -------------------------------------------------------------
 * Volume, outstanding balance, terms, and whether the account can order right
 * now. That last one is the useful column: an operator looking at a list of
 * accounts wants to know which ones are stuck, and computing it here from the
 * same creditDecision the ordering path uses means the screen and the refusal
 * can never disagree.
 *
 * The balance is split into billed and unbilled rather than summed, because
 * "what do they owe" and "what have we not billed yet" are different questions
 * and a single number hides which one is growing.
 */

export type AccountRow = {
  id: string;
  clientId: string;
  clientName: string;
  status: "active" | "suspended" | "closed";
  billingMode: "card" | "invoice";
  creditLimitCents: Cents;
  netDays: number;
  orders: number;
  ordersThisPeriod: number;
  issuedUnpaidCents: Cents;
  unbilledCents: Cents;
  oldestUnpaidDays: number | null;
  /** Whether a further order would be accepted right now, and why not. */
  canOrder: boolean;
  blockedReason: string;
  users: number;
  openStatement: { id: string; reference: string; period: string; totalCents: Cents } | null;
};

function periodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function accountRows(): Promise<AccountRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  /*
   * FIVE READS, AND THE ORDERS ONE BREAKS FIRST BY A LONG WAY.
   *
   * The roster itself is bounded by how many accounts the firm has. The orders
   * lookup is every order EVER placed by every one of them, which is the
   * account count multiplied by all of history, and it feeds the per account
   * order counts on the screen.
   *
   * Each is paged separately rather than the whole thing being given one bound,
   * because they truncate at different sizes and a shared bound would hide
   * which one ran out.
   */
  const accountRead = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_customer_accounts")
      .select("id, client_id, status, billing_mode, credit_limit_cents, net_days, created_at")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  const accounts = accountRead.ok ? accountRead.rows : [];
  if (!accounts.length) return [];

  const ids = accounts.map((a) => a.id as string);
  const clientIds = accounts.map((a) => a.client_id as string);

  const [clientRead, orderRead, userRead, statementRead] = await Promise.all([
    // readEvery: a client missing from this map renders an account with no name.
    readEvery<Record<string, unknown>>((from, to) =>
      db.from("eng_clients").select("id, name").in("id", clientIds).order("id", { ascending: true }).range(from, to),
    ),
    // readEvery: this is the order COUNT per account, and a partial count is a wrong one.
    readEvery<Record<string, unknown>>((from, to) =>
      db.from("eng_service_orders").select("account_id, created_at").in("account_id", ids).order("created_at", { ascending: true }).range(from, to),
    ),
    // readEvery: the seat count on an account, billed on, so it cannot be partial.
    readEvery<Record<string, unknown>>((from, to) =>
      db.from("eng_customer_users").select("account_id").in("account_id", ids).eq("status", "active").order("id", { ascending: true }).range(from, to),
    ),
    // readEvery: an open statement missed here is a bill the screen says does not exist.
    readEvery<Record<string, unknown>>((from, to) =>
      db
        .from("eng_statements")
        .select("id, account_id, reference, period, status, total_cents")
        .in("account_id", ids)
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  const clients = clientRead.ok ? clientRead.rows : null;
  const orders = orderRead.ok ? orderRead.rows : null;
  const users = userRead.ok ? userRead.rows : null;
  const statements = statementRead.ok ? statementRead.rows : null;

  const nameOf = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));
  const thisPeriod = periodOf(new Date());

  const rows: AccountRow[] = [];

  for (const a of accounts) {
    const id = a.id as string;
    const mine = (orders ?? []).filter((o) => o.account_id === id);
    const balance = await accountBalance(id);

    const verdict = creditDecision(
      {
        billingMode: a.billing_mode as "card" | "invoice",
        status: a.status as "active" | "suspended" | "closed",
        creditLimitCents: a.credit_limit_cents === null ? null : Number(a.credit_limit_cents),
        outstandingCents: balance.outstandingCents,
        oldestUnpaidDays: balance.oldestUnpaidDays,
        netDays: Number(a.net_days),
      },
      /*
       * Zero, because this asks "can they order at all", not "can they order
       * this". A row that reported a block only for some hypothetical amount
       * would be a column nobody could act on.
       */
      0,
    );

    const open = (statements ?? []).find((s) => s.account_id === id);

    rows.push({
      id,
      clientId: a.client_id as string,
      clientName: nameOf.get(a.client_id as string) ?? "Unknown organisation",
      status: a.status as AccountRow["status"],
      billingMode: a.billing_mode as AccountRow["billingMode"],
      creditLimitCents: a.credit_limit_cents === null ? null : Number(a.credit_limit_cents),
      netDays: Number(a.net_days),
      orders: mine.length,
      ordersThisPeriod: mine.filter((o) => periodOf(new Date(o.created_at as string)) === thisPeriod).length,
      issuedUnpaidCents: balance.issuedUnpaidCents,
      unbilledCents: balance.unbilledCents,
      oldestUnpaidDays: balance.oldestUnpaidDays,
      canOrder: verdict.ok,
      blockedReason: verdict.ok ? "" : verdict.message,
      users: (users ?? []).filter((u) => u.account_id === id).length,
      openStatement: open
        ? {
            id: open.id as string,
            reference: open.reference as string,
            period: open.period as string,
            totalCents: open.total_cents === null ? null : Number(open.total_cents),
          }
        : null,
    });
  }

  return rows;
}

/**
 * Turn an existing client into an account holder.
 *
 * An INSERT rather than a migration of anything. The organisation's files,
 * documents and audit trail already point at its eng_clients row, and the
 * account references that row rather than replacing it, so converting loses no
 * history. That is the whole reason accounts hang off clients.
 */
export async function convertClientToAccount(
  clientId: string,
  site: string,
): Promise<{ ok: true; accountId: string; alreadyExisted: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: client } = await db
    .from("eng_clients")
    .select("id, kind, name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "That client does not exist." };

  /*
   * Organisations only, per the specification. An individual homeowner ordering
   * one certification does not want an account, and giving them one would be a
   * password to forget for a thing they will do once.
   */
  if (client.kind !== "organization") {
    return {
      ok: false,
      error: "Accounts are for organisations. An individual orders through the site and gets a link.",
    };
  }

  const { data: existing } = await db
    .from("eng_customer_accounts")
    .select("id")
    .eq("client_id", clientId)
    .eq("site", site)
    .maybeSingle();

  if (existing) {
    return { ok: true, accountId: existing.id as string, alreadyExisted: true };
  }

  const { data: created, error } = await db
    .from("eng_customer_accounts")
    .insert({ client_id: clientId, site, status: "active", billing_mode: "card" })
    .select("id")
    .single();

  if (error || !created) return { ok: false, error: "The account could not be created." };
  return { ok: true, accountId: created.id as string, alreadyExisted: false };
}
