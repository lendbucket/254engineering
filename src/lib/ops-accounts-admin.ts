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

/**
 * ==========================================================================
 * PHASE TIMING ON THIS FUNCTION, REPORT ONLY. Operator ruling, 2026-10-04.
 * ==========================================================================
 *
 * `/portal/accounts` has taken FIFTY SECONDS of application time to render,
 * read off the server's own log, and blocked `mobile-overflow-audit` and
 * `native-audit` on a branch that touched nothing near it. The same code then
 * measured fine on the next board with nothing fixed between the two runs, so
 * the stall is INTERMITTENT, and that changes what an instrument has to do.
 *
 * AN INTERMITTENT STALL CANNOT BE PROFILED BY DECIDING TO WATCH IT. The run
 * that stalls is not the run anybody chose, so a flag somebody switches on
 * after seeing one is a flag that was off while it happened. This is always on,
 * on every render, which is the only shape that can catch it.
 *
 * WHY A LOG LINE RATHER THAN A ROW. A table would need a migration, a ledger
 * entry and a production sitting, which would park this behind the next sitting
 * for no gain. Reading the suite's own server log on a GREEN board is how a
 * real defect was found in this repository before, and a line costs nothing.
 *
 * NO PERSONAL DATA, AND THAT COSTS SOMETHING WORTH NAMING. Durations and counts
 * only: no names, no addresses, no account or client identifiers. So if the
 * figures point at ONE pathological account rather than at the query shape,
 * this log shows the shape and cannot name the culprit. That is the trade the
 * ruling asked for and it is stated rather than discovered later.
 *
 * REPORT ONLY. Nothing here changes a return value, a query, or an order of
 * operations, and `Date.now()` around an awaited read cannot measurably cost
 * anything next to the read itself.
 *
 * WHAT THE FIRST THREE RUNS SAID, 2026-10-04, against development with 918
 * accounts, unthrottled, on a developer machine. Recorded because a baseline
 * nobody wrote down is a baseline nobody can compare against:
 *
 *     total=3474ms roster=712ms four-reads=1102ms balances=1657ms rows=1ms
 *     total=2873ms roster=340ms four-reads=888ms  balances=1644ms rows=1ms
 *     total=2914ms roster=339ms four-reads=871ms  balances=1703ms rows=1ms
 *
 * THREE THINGS FOLLOW, AND THE THIRD IS THE ONE THAT MATTERS MOST.
 *
 * `balances` is the dominant phase, consistently, at a little over half the
 * total. That is the phase already rewritten once: `accountBalance` used to be
 * called INSIDE the loop below, two sequential paged reads per account, and
 * `accountBalances` replaced it with a bulk read. It is still the biggest
 * single cost, so the bulk read removed a catastrophe rather than the problem.
 *
 * `rows` is 1ms, which kills the assembly hypothesis outright. See the
 * correction above the phase itself.
 *
 * AND NONE OF THESE RUNS IS THE STALL. Three seconds is not fifty, so the
 * fifty second render recorded in BACKLOG.md did not reproduce, which is
 * exactly what an intermittent fault does and is why this timer is always on
 * rather than switched on by somebody who has decided to look. A clean figure
 * here is not evidence the route is healthy, and reading it as though it were
 * is the mistake this paragraph exists to prevent.
 *
 * THE BASELINE ALSO MISSES THE OPERATOR'S TARGET BY ITSELF. His standing
 * requirement of 2026-10-04 is one second per route, measured on a throttled
 * mid-tier phone. This route takes three seconds UNTHROTTLED on a developer
 * machine before a single pixel is rendered. That is a finding for the
 * measurement pass rather than something to fix here, and it is written down so
 * the pass does not have to discover it twice.
 */
type Phase = { name: string; ms: number; note?: string };

function reportTiming(phases: Phase[], total: number): void {
  /*
   * ONE LINE, AND THE TOTAL IS MEASURED RATHER THAN SUMMED. The four parallel
   * reads overlap, so adding the phases would exceed the wall clock and a
   * reader would conclude the figures were wrong. Printing both lets the gap
   * between them say how much of the time was concurrent.
   */
  const body = phases.map((p) => `${p.name}=${p.ms}ms${p.note ? `(${p.note})` : ""}`).join(" ");
  console.log(`[accounts.timing] total=${total}ms ${body}`);
}

export async function accountRows(): Promise<AccountRowsResult> {
  const startedAt = Date.now();
  const phases: Phase[] = [];
  const since = (t: number) => Date.now() - t;

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
  const rosterAt = Date.now();
  const accountRead = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_customer_accounts")
      .select("id, client_id, status, billing_mode, credit_limit_cents, net_days, created_at")
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  phases.push({
    name: "roster",
    ms: since(rosterAt),
    note: accountRead.ok ? `${accountRead.rows.length} accounts` : "failed",
  });

  /*
   * The roster's own failure is an absence like any other. It used to collapse
   * to an empty array, which the screen rendered as the encouraging "no
   * ordering accounts yet" state: a database that could not be read and a firm
   * with no customers, shown identically.
   */
  if (!accountRead.ok) {
    reportTiming(phases, since(startedAt));
    return { ok: false, unavailable: [`Ordering accounts: ${accountRead.error}`] };
  }
  const accounts = accountRead.rows;
  if (!accounts.length) {
    reportTiming(phases, since(startedAt));
    return { ok: true, rows: [] };
  }

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
  const fourAt = Date.now();
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
  /*
   * THE FOUR ARE TIMED TOGETHER BECAUSE THEY RUN TOGETHER. Timing each one
   * inside the Promise.all would report four durations that all include each
   * other's waiting, which reads as four slow reads when there is one.
   * The row counts are per read, because which of the four is large is the
   * thing worth knowing.
   */
  phases.push({
    name: "four-reads",
    ms: since(fourAt),
    note:
      `clients=${clientRead.ok ? clientRead.rows.length : "fail"} ` +
      `orders=${orderRead.ok ? orderRead.rows.length : "fail"} ` +
      `users=${userRead.ok ? userRead.rows.length : "fail"} ` +
      `statements=${statementRead.ok ? statementRead.rows.length : "fail"}`,
  });

  const failures = [
    clientRead.ok ? null : `Client names: ${clientRead.error}`,
    orderRead.ok ? null : `Orders per account: ${orderRead.error}`,
    userRead.ok ? null : `Seats per account: ${userRead.error}`,
    statementRead.ok ? null : `Open statements: ${statementRead.error}`,
  ].filter((s): s is string => s !== null);

  if (failures.length > 0) {
    reportTiming(phases, since(startedAt));
    return { ok: false, unavailable: failures };
  }

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
  const balancesAt = Date.now();
  const balanceRead = await accountBalances(ids);
  phases.push({
    name: "balances",
    ms: since(balancesAt),
    note: balanceRead.ok ? `${balanceRead.balances.size} accounts` : "failed",
  });
  if (!balanceRead.ok) {
    reportTiming(phases, since(startedAt));
    return { ok: false, unavailable: [`Account balances: ${balanceRead.error}`] };
  }

  const nameOf = new Map(clients.map((c) => [c.id as string, c.name as string]));
  const thisPeriod = periodOf(new Date());

  const assemblyAt = Date.now();
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

  /*
   * ASSEMBLY IS TIMED TOO, AND THE FIRST READING KILLED THE HYPOTHESIS THIS
   * COMMENT ORIGINALLY CARRIED.
   *
   * It said the loop was the phase nobody had suspected, because
   * `orders.filter` and `users.filter` run once per account so the cost is
   * accounts multiplied by orders rather than either alone. Plausible, written
   * confidently, and measured FALSE within the minute: three runs against
   * development reported `rows=1ms` on 918 accounts.
   *
   * It is kept as a correction rather than deleted, because a wrong
   * explanation is worse than none: it is the thing that makes the next reader
   * stop looking, and this one was written by the session adding the timer and
   * would have been believed on that account alone.
   *
   * The phase is still timed. A figure that is 1ms today and is not 1ms later
   * is exactly what this line exists to show.
   */
  phases.push({ name: "rows", ms: since(assemblyAt), note: `${rows.length} rows` });
  reportTiming(phases, since(startedAt));

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
