import "server-only";
import { readEvery, readEveryIn } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { accountBalances } from "./ops-bulk";
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

/**
 * What the accounts screen got, or why it got nothing.
 *
 * A RESULT RATHER THAN AN ARRAY, since 2026-09-24. An empty array meant two
 * different things: the firm has no ordering accounts, which is a real and
 * perfectly good answer, and the reads failed, which is not an answer at all.
 * The screen rendered the same encouraging empty state for both.
 */
export type AccountRowsResult =
  | { ok: true; rows: AccountRow[] }
  | { ok: false; unavailable: string[] };

export async function accountRows(): Promise<AccountRowsResult> {
  const db = supabaseAdmin();
  if (!db) {
    return { ok: false, unavailable: ["The database is not configured, so no account could be read."] };
  }

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
  /*
   * SUPERSEDED ACCOUNTS ARE NOT CUSTOMERS. Operator ruling, 2026-09-14: a
   * duplicate or a typo is superseded rather than deleted, and every read
   * excludes them by default. A superseded row reappearing in this list is a
   * second entry for one organisation, which is the thing supersession exists
   * to remove from view.
   *
   * Closed accounts still appear, because a closed account is a real customer
   * who stopped trading.
   */
  const accountRead = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_customer_accounts")
      .select("id, client_id, status, billing_mode, credit_limit_cents, net_days, created_at")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  /*
   * The roster's own failure is an absence like any other. It used to collapse
   * to an empty array, which the screen rendered as the encouraging "no
   * ordering accounts yet" state: a database that could not be read and a firm
   * with no customers, shown identically.
   */
  if (!accountRead.ok) return { ok: false, unavailable: [`Ordering accounts: ${accountRead.error}`] };
  const accounts = accountRead.rows;
  if (!accounts.length) return { ok: true, rows: [] };

  const ids = accounts.map((a) => a.id as string);
  const clientIds = accounts.map((a) => a.client_id as string);

  /*
   * ===========================================================================
   * CHUNKED, BECAUSE AN `.in()` OF EVERY ACCOUNT ID FAILS WHOLE ABOVE ~350.
   * Operator ruling, 2026-09-24: chunk now, aggregate recorded as the larger
   * option.
   * ===========================================================================
   *
   * All four of these passed the full id list into one filter. Measured, that
   * is fine to 300 ids and returns `TypeError: fetch failed` from 400: a
   * request too large for the transport rather than a slow query. The evidence
   * and the chunk size are in `IN_FILTER_CHUNK` in bounded-read.ts.
   *
   * Development holds 529 accounts, so all four failed, every time.
   *
   * THE LARGER OPTION, RECORDED RATHER THAN TAKEN. The order and seat figures
   * are COUNTS, and a database can count without shipping a row per order. An
   * aggregate view, or an RPC returning one row per account, would remove these
   * reads entirely rather than making them survivable, and would stop the page
   * paging every order that every account has ever placed in order to display a
   * number beside each. It is the right shape and it is a migration, a new
   * declared surface and a second thing for the ledger to carry. Chunking is
   * what was ruled today; this paragraph is so the next person knows the
   * ceiling was chosen rather than missed.
   */
  const [clientRead, orderRead, userRead, statementRead] = await Promise.all([
    // A client missing from this map renders an account with no name.
    readEveryIn<Record<string, unknown>>(clientIds, (chunk, from, to) =>
      db.from("eng_clients").select("id, name").in("id", chunk as string[]).order("id", { ascending: true }).range(from, to),
    ),
    // This is the order COUNT per account, and a partial count is a wrong one.
    readEveryIn<Record<string, unknown>>(ids, (chunk, from, to) =>
      db.from("eng_service_orders").select("account_id, created_at").in("account_id", chunk as string[]).order("created_at", { ascending: true }).range(from, to),
    ),
    // The seat count on an account, billed on, so it cannot be partial.
    readEveryIn<Record<string, unknown>>(ids, (chunk, from, to) =>
      db.from("eng_customer_users").select("account_id").in("account_id", chunk as string[]).eq("status", "active").order("id", { ascending: true }).range(from, to),
    ),
    // An open statement missed here is a bill the screen says does not exist.
    readEveryIn<Record<string, unknown>>(ids, (chunk, from, to) =>
      db
        .from("eng_statements")
        .select("id, account_id, reference, period, status, total_cents")
        .in("account_id", chunk as string[])
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  /*
   * ===========================================================================
   * A FAILED READ IS AN ABSENCE, NOT A ZERO. Operator ruling, 2026-09-24.
   * ===========================================================================
   *
   * This read `clientRead.ok ? clientRead.rows : null` and then every consumer
   * did `?? []`. Each read is a bounded read BECAUSE a partial answer would be
   * wrong, and the comments above them say so: "a partial count is a wrong
   * one", "an open statement missed here is a bill the screen says does not
   * exist". Those guards were written against TRUNCATION. On FAILURE the same
   * code turned the whole set into an empty list.
   *
   * WHAT THAT LOOKED LIKE, read back from this function rather than argued:
   *
   *     117979ms, 529 rows
   *     clientName "Unknown organization": 529 of 529
   *     orders 0:                          529 of 529
   *     users 0:                           529 of 529
   *     openStatement null:                529 of 529
   *
   * beside a first row carrying issuedUnpaidCents 127500 and canOrder true,
   * because the balance was the one read that still worked. Every figure on a
   * billing screen was wrong, confidently, and it took two minutes to say so.
   *
   * So the function now refuses to state anything it could not read. It is the
   * rule every report in this platform already follows: a figure is a number a
   * query produced, the word none because it found nothing, or an absence with
   * a reason. There is no fourth, and "zero because the read failed" was one.
   */
  const failures = [
    clientRead.ok ? null : `Client names: ${clientRead.error}`,
    orderRead.ok ? null : `Orders per account: ${orderRead.error}`,
    userRead.ok ? null : `Seats per account: ${userRead.error}`,
    statementRead.ok ? null : `Open statements: ${statementRead.error}`,
  ].filter((s): s is string => s !== null);

  if (failures.length > 0) return { ok: false, unavailable: failures };

  const clients = clientRead.ok ? clientRead.rows : [];
  const orders = orderRead.ok ? orderRead.rows : [];
  const users = userRead.ok ? userRead.rows : [];
  const statements = statementRead.ok ? statementRead.rows : [];

  /*
   * ONE CHUNKED READ FOR EVERY BALANCE, NOT TWO ROUND TRIPS PER ACCOUNT.
   *
   * `await accountBalance(id)` sat inside the loop below. That function issues
   * two sequential paged reads, so 529 accounts cost 1,058 round trips in
   * series and that is the whole of the two minutes. The four reads above,
   * even failing, accounted for about eight seconds of it.
   *
   * The arithmetic is unchanged and is not duplicated: `accountBalances` reads
   * in bulk and both it and `accountBalance` hand their rows to the same
   * `balanceFrom`. This is the credit gate, and a second account of it would be
   * a second answer to whether somebody may order on invoice.
   */
  const balanceRead = await accountBalances(ids);
  if (!balanceRead.ok) return { ok: false, unavailable: [`Account balances: ${balanceRead.error}`] };

  const nameOf = new Map(clients.map((c) => [c.id as string, c.name as string]));
  const thisPeriod = periodOf(new Date());

  const rows: AccountRow[] = [];

  for (const a of accounts) {
    const id = a.id as string;
    const mine = orders.filter((o) => o.account_id === id);
    const balance = balanceRead.balances.get(id) ?? {
      issuedUnpaidCents: null,
      unbilledCents: null,
      outstandingCents: null,
      oldestUnpaidDays: null,
    };

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
      clientName: nameOf.get(a.client_id as string) ?? "Unknown organization",
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

  return { ok: true, rows };
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
      error: "Accounts are for organizations. An individual orders through the site and gets a link.",
    };
  }

  /* Oldest first: if a client somehow has two accounts for one site, the
   * first one opened is the one that has been billed against. A discarded
   * error read that as no account and would have opened a third. */
  const { data: existingRows, error: existingErr } = await db
    .from("eng_customer_accounts")
    .select("id")
    .eq("client_id", clientId)
    .eq("site", site)
    /*
     * A SUPERSEDED ACCOUNT MUST NOT BLOCK OPENING A NEW ONE.
     *
     * This read decides whether a client already has an account. If it counted
     * superseded rows, the one act supersession exists for, correcting a
     * duplicate and opening it properly, would be refused by the duplicate it
     * was correcting.
     */
    .is("superseded_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingErr) {
    return { ok: false, error: `Could not check whether that client already has an account: ${existingErr.message}` };
  }
  const existing = (existingRows ?? [])[0] ?? null;

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
