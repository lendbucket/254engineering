import "server-only";
import { readEvery, readEveryIn } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { openBalancesForEveryAccount } from "./ops-bulk";
import { accountListQuery, pageOfAccounts, type AccountListQuery, type RosterEntry } from "./account-list";
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
  | {
      ok: true;
      /** The page shown: at most ACCOUNT_PAGE_SIZE rows, every figure on them read. */
      rows: AccountRow[];
      /** How many accounts match the search and filters, over EVERY account. */
      total: number;
      /** How many ordering accounts the firm has, whatever the search says. */
      all: number;
      page: number;
      pages: number;
      /** Every active account the credit rule refuses, over every account, not this page. */
      blocked: { id: string; clientName: string; reason: string }[];
      /** How many accounts have work no statement covers yet, over every account. */
      unbilledAccounts: number;
    }
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

export async function accountRows(query: AccountListQuery = accountListQuery({})): Promise<AccountRowsResult> {
  const startedAt = Date.now();
  const phases: Phase[] = [];
  const since = (t: number) => Date.now() - t;

  const db = supabaseAdmin();
  if (!db) {
    return { ok: false, unavailable: ["The database is not configured, so no account could be read."] };
  }

  /*
   * ===========================================================================
   * ONE PAGE IS READ IN FULL; EVERY ACCOUNT IS READ ONLY FOR WHAT IT TAKES TO
   * COUNT, FILTER AND WARN. Robert's answer 4 of 2026-10-28.
   * ===========================================================================
   *
   * Board 40733329479 timed this function at 10.0 to 10.2 seconds over about
   * 3,020 accounts: roster 1.1 to 1.5, four reads 3.2 to 3.8, balances 4.6 to
   * 5.2, and the screen then showed fifty. Two of those three costs were spent
   * on accounts nobody was looking at.
   *
   * WHAT IS STILL READ FOR EVERY ACCOUNT, AND WHY:
   *   - the roster, because the total, the filters and the paging are over
   *     every account, and a page's length is not a count;
   *   - the open balances, because the warning above the list names EVERY
   *     account that cannot order, and that verdict needs the balance. They are
   *     read without an id filter (openBalancesForEveryAccount), so their cost
   *     is the firm's outstanding work rather than its number of accounts;
   *   - the names of the accounts that warning names, and every name when the
   *     list is sorted by name or searched.
   *
   * WHAT IS READ FOR THE PAGE ONLY: the order counts, the seats and the open
   * statement. Those are the reads that scaled with every order every account
   * ever placed.
   *
   * SUPERSEDED ACCOUNTS ARE NOT CUSTOMERS. Operator ruling, 2026-09-14: a
   * duplicate or a typo is superseded rather than deleted, and every read
   * excludes them by default. Closed accounts still appear, because a closed
   * account is a real customer who stopped trading.
   */
  const rosterAt = Date.now();
  const accountRead = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_customer_accounts")
      .select("id, client_id, status, billing_mode, credit_limit_cents, net_days, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
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
    return { ok: true, rows: [], total: 0, all: 0, page: 1, pages: 1, blocked: [], unbilledAccounts: 0 };
  }

  /*
   * The credit verdict of every account, from the same creditDecision the
   * ordering path uses, so this screen and the refusal a customer sees can
   * never disagree about why. A failed balance read is an absence: it refuses
   * the screen rather than reading as zero, because creditDecision grants on a
   * zero and refuses on an unknown.
   */
  const balancesAt = Date.now();
  const balanceRead = await openBalancesForEveryAccount();
  phases.push({
    name: "balances",
    ms: since(balancesAt),
    note: balanceRead.ok ? `${accounts.length} accounts from ${balanceRead.rowsRead} open rows` : "failed",
  });
  if (!balanceRead.ok) {
    reportTiming(phases, since(startedAt));
    return { ok: false, unavailable: [`Account balances: ${balanceRead.error}`] };
  }

  const verdictOf = new Map<string, ReturnType<typeof creditDecision>>();
  for (const a of accounts) {
    const balance = balanceRead.balanceOf(a.id as string);
    verdictOf.set(
      a.id as string,
      creditDecision(
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
      ),
    );
  }

  const roster: RosterEntry[] = accounts.map((a) => ({
    id: a.id as string,
    clientId: a.client_id as string,
    status: a.status as string,
    billingMode: a.billing_mode as string,
    createdAt: a.created_at as string,
    cannotOrder: a.status === "active" && !verdictOf.get(a.id as string)!.ok,
  }));
  const unbilledAccounts = accounts.filter((a) => (balanceRead.balanceOf(a.id as string).unbilledCents ?? 0) > 0).length;

  /*
   * THE SEARCH IS OVER EVERY ACCOUNT, IN THE DATABASE. A name lives on the
   * client, so the search asks eng_clients which names match and keeps the
   * accounts whose client is one of them. A filter applied to the page alone
   * would look like a search and be a search of fifty.
   */
  let matchingClients: Set<string> | null = null;
  if (query.term) {
    const searchAt = Date.now();
    const searchRead = await readEvery<Record<string, unknown>>((from, to) =>
      db.from("eng_clients").select("id").ilike("name", `%${query.term}%`).order("id", { ascending: true }).range(from, to),
    );
    phases.push({ name: "search", ms: since(searchAt), note: searchRead.ok ? `${searchRead.rows.length} names` : "failed" });
    if (!searchRead.ok) {
      reportTiming(phases, since(startedAt));
      return { ok: false, unavailable: [`The search by organization name: ${searchRead.error}`] };
    }
    matchingClients = new Set(searchRead.rows.map((c) => c.id as string));
  }

  /*
   * ===========================================================================
   * CHUNKED, BECAUSE AN `.in()` OF EVERY ACCOUNT ID FAILS WHOLE ABOVE ~350.
   * Operator ruling, 2026-09-24. The evidence and the chunk size are in
   * `IN_FILTER_CHUNK` in bounded-read.ts.
   * ===========================================================================
   *
   * Sorting by name is the one path that still reads a name for every account,
   * and it goes through the same chunked reader, so it crosses that cliff
   * safely or refuses. Every other path reads names for the page and for the
   * accounts the warning names.
   */
  const blockedIds = roster.filter((a) => a.cannotOrder).map((a) => a.id);
  const accountById = new Map(accounts.map((a) => [a.id as string, a]));
  const clientOf = (id: string) => accountById.get(id)!.client_id as string;

  let allNames: Map<string, string> | null = null;
  if (query.sort === "name") {
    const namesAt = Date.now();
    const nameRead = await readEveryIn<Record<string, unknown>>(
      [...new Set(roster.map((a) => a.clientId))],
      (chunk, from, to) => db.from("eng_clients").select("id, name").in("id", chunk as string[]).order("id", { ascending: true }).range(from, to),
    );
    phases.push({ name: "names", ms: since(namesAt), note: nameRead.ok ? `${nameRead.rows.length} names` : "failed" });
    if (!nameRead.ok) {
      reportTiming(phases, since(startedAt));
      return { ok: false, unavailable: [`Client names: ${nameRead.error}`] };
    }
    allNames = new Map(nameRead.rows.map((c) => [c.id as string, c.name as string]));
  }

  const shown = pageOfAccounts(roster, query, matchingClients, allNames);
  const ids = shown.ids;

  /*
   * ===========================================================================
   * A FAILED READ IS AN ABSENCE, NOT A ZERO. Operator ruling, 2026-09-24.
   * ===========================================================================
   *
   * Each of these used to fail into `?? []`, and on 2026-09-24 the screen
   * rendered 529 accounts every one of which read "Unknown organization" with
   * no orders, no seats and no open statement, beside real outstanding
   * balances. So the function refuses to state anything it could not read.
   * A figure is a number a query produced, the word none because it found
   * nothing, or an absence with a reason. There is no fourth.
   *
   * THE FOUR ARE TIMED TOGETHER BECAUSE THEY RUN TOGETHER, and the counts are
   * per read, because which of them is large is the thing worth knowing.
   */
  const fourAt = Date.now();
  const nameIds = allNames ? [] : [...new Set([...ids, ...blockedIds].map(clientOf))];
  const [clientRead, orderRead, userRead, statementRead] = await Promise.all([
    // A client missing from this map renders an account with no name.
    readEveryIn<Record<string, unknown>>(nameIds, (chunk, from, to) =>
      db.from("eng_clients").select("id, name").in("id", chunk as string[]).order("id", { ascending: true }).range(from, to),
    ),
    // This is the order COUNT per account on the page, and a partial count is a wrong one.
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
  phases.push({
    name: "four-reads",
    ms: since(fourAt),
    note:
      `page=${ids.length} ` +
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

  const nameOf = allNames ?? new Map((clientRead.ok ? clientRead.rows : []).map((c) => [c.id as string, c.name as string]));
  const orders = orderRead.ok ? orderRead.rows : [];
  const users = userRead.ok ? userRead.rows : [];
  const statements = statementRead.ok ? statementRead.rows : [];
  const thisPeriod = periodOf(new Date());

  const assemblyAt = Date.now();
  const rows: AccountRow[] = [];

  for (const id of ids) {
    const a = accountById.get(id)!;
    const mine = orders.filter((o) => o.account_id === id);
    const balance = balanceRead.balanceOf(id);
    const verdict = verdictOf.get(id)!;
    const open = statements.find((s) => s.account_id === id);

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
      users: users.filter((u) => u.account_id === id).length,
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

  const blocked = blockedIds.map((id) => {
    const verdict = verdictOf.get(id)!;
    return {
      id,
      clientName: nameOf.get(clientOf(id)) ?? "Unknown organization",
      reason: verdict.ok ? "" : verdict.message,
    };
  });

  /*
   * ASSEMBLY IS TIMED TOO, AND ITS FIRST READING KILLED A HYPOTHESIS. A comment
   * here once said the per account filters were the phase nobody suspected;
   * three runs on 918 accounts measured rows=1ms. Kept as a correction, because
   * a wrong explanation is the thing that makes the next reader stop looking.
   */
  phases.push({ name: "rows", ms: since(assemblyAt), note: `${rows.length} rows of ${shown.total}` });
  reportTiming(phases, since(startedAt));

  return {
    ok: true,
    rows,
    total: shown.total,
    all: accounts.length,
    page: shown.page,
    pages: shown.pages,
    blocked,
    unbilledAccounts,
  };
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
