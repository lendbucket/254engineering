import "server-only";
import { DB_NOW } from "./db-now";
import { readEvery } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { orderForFile as liveOrderForFile } from "./order-for-file";
import { writeAudit } from "./ops-audit";
import { isKnown, money, type Cents } from "./ops-money";
import { can, type Actor } from "./ops-authz";
import {
  commissionForDelivery,
  commissionForQualifiedLead,
  netOf,
  payableAt,
  reversalFor,
  type CompModel,
  type Terms,
  type Tier,
} from "./partner-comp";

/**
 * Writing down what a partner earned.
 *
 * The rule is in `partner-comp.ts` and is pure. This is the half that talks to
 * the database, and it does four things and refuses to do a fifth:
 *
 *   accrue when the firm delivers, or when a lead is qualified
 *   reverse by a counter entry when money goes back
 *   gather what is payable into a statement, and issue it
 *   record that somebody paid it
 *
 * THE FIFTH THING IT WILL NOT DO IS MOVE MONEY
 * --------------------------------------------
 * There is no payout API here and there should not be. The firm pays a partner
 * however it pays anybody, and an operator writes down that they did. A
 * platform that could send money to a third party is a platform where a bug, or
 * anybody who reaches it, can send money to a third party.
 *
 * EVERY WRITE IS IDEMPOTENT BY CONSTRAINT RATHER THAN BY CARE
 * -----------------------------------------------------------
 * 0019 carries three partial unique indexes: one accrual per file, one per
 * lead, one reversal per refund payment. This module leans on them rather than
 * checking first and inserting after, because checking first and inserting
 * after is two statements with a gap in the middle, and the gap is where a
 * retried job pays a partner twice.
 */

const DUPLICATE = "23505";

export type PartnerEntryKind = "accrual" | "reversal" | "adjustment";

export type TermsInForce = Terms & { termsId: string };

/**
 * The terms in force for a partner at a moment.
 *
 * Effective dated, and the LATEST one that had started and had not ended.
 * A partner with no terms earns nothing and that is not an error: it is a
 * partner somebody has not finished setting up, and the accrual paths say so
 * out loud rather than inventing a rate.
 */
export async function termsInForce(
  partnerId: string,
  at: Date = new Date(),
): Promise<TermsInForce | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const day = at.toISOString().slice(0, 10);
  const { data } = await db
    .from("eng_partner_terms")
    .select("id, model, percent_bps, flat_cents, tiers, holdback_days, effective_from, effective_to")
    .eq("partner_id", partnerId)
    .lte("effective_from", day)
    .order("effective_from", { ascending: false })
    .limit(10);

  const live = (data ?? []).find(
    (t) => t.effective_to === null || String(t.effective_to) >= day,
  );
  if (!live) return null;

  return {
    termsId: live.id as string,
    model: live.model as CompModel,
    percentBps: live.percent_bps === null ? null : Number(live.percent_bps),
    flatCents: live.flat_cents === null ? null : Number(live.flat_cents),
    tiers: Array.isArray(live.tiers) ? (live.tiers as Tier[]) : null,
    holdbackDays: Number(live.holdback_days ?? 0),
  };
}

// --------------------------------------------------------------- accruals

export type AccrualResult =
  | { ok: true; entryId: string | null; amountCents: number | null; explanation: string }
  | { ok: false; error: string };

/**
 * Accrue on delivery.
 *
 * Called from `transitionFile` the moment a file reaches delivered, which is
 * the only place a file can reach it. The alternative, a job that sweeps for
 * delivered files, would have been more forgiving of a failure here and would
 * have meant the ledger lagged the record by however long the sweep took.
 *
 * A FAILURE HERE DOES NOT UNDO THE DELIVERY
 * -----------------------------------------
 * The file is delivered. That is a fact about the firm and the customer and it
 * is not conditional on a commission being computable. So this returns its
 * problem and the caller records it, rather than throwing and rolling anything
 * back. What it will never do is silently write nothing: a partner file with no
 * entry is exactly the state that makes a margin read too high.
 */
export async function accrueForDelivery(fileId: string): Promise<AccrualResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: file } = await db
    .from("eng_files")
    .select("id, file_number, partner_id, delivered_at")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { ok: false, error: "That file does not exist." };

  // No partner, nothing to accrue, and this is the ordinary case.
  if (!file.partner_id) {
    return { ok: true, entryId: null, amountCents: 0, explanation: "No partner is attributed to this file." };
  }

  const partnerId = file.partner_id as string;

  /*
   * The LIVE order, by the precedence in order-for-file.ts, and on this call
   * site the difference is money: a commission is owed against the engagement
   * that took payment, so choosing the most recent row would attach a partner's
   * earnings to a cancelled quote that never paid anybody anything.
   */
  const order = await liveOrderForFile(fileId, "reference, total_cents");

  const occurredAt = new Date((file.delivered_at as string | null) ?? Date.now());
  const terms = await termsInForce(partnerId, occurredAt);

  if (!terms) {
    /*
     * A partner with attribution and no terms. The commission is owed and its
     * figure is unknowable, which is the definition of blocked, and it is
     * exactly the case where writing nothing would be worst: the file would
     * read as costing the firm no commission for as long as nobody noticed.
     */
    return await insertEntry(db, {
      partnerId,
      kind: "accrual",
      amountCents: null,
      status: "blocked",
      explanation:
        "This partner has no compensation terms in force on the date of delivery, so what they earned cannot be worked out. The commission is owed and recorded with no figure until somebody sets the terms.",
      fileId,
      orderId: (order?.id as string | undefined) ?? null,
      occurredAt,
      payableAtMs: occurredAt.getTime(),
    });
  }

  /*
   * How many of this partner's deliveries have already accrued in the period.
   *
   * Counted from the LEDGER rather than from the files table, because the
   * ledger is what the tier is about: an accrual that was written is a delivery
   * that counted. A file delivered and blocked has not earned a tier step.
   */
  const priorQualifyingCount = await accrualsInPeriod(db, partnerId, occurredAt);

  const commission = commissionForDelivery({
    terms,
    orderTotalCents: order?.total_cents === null || order?.total_cents === undefined ? null : Number(order.total_cents),
    priorQualifyingCount,
  });

  if (!commission.ok && commission.reason === "not_earned_here") {
    /*
     * A REAL ZERO, WRITTEN DOWN.
     *
     * A partner paid per qualified lead earns nothing from a delivery, and that
     * is a knowable cost of nothing rather than a missing figure. Writing the
     * zero entry is what lets the margin on this file be complete instead of
     * permanently unknown, and it carries the sentence explaining why.
     */
    return await insertEntry(db, {
      partnerId,
      kind: "accrual",
      amountCents: 0,
      status: "accrued",
      explanation: commission.explanation,
      model: commission.model,
      fileId,
      orderId: (order?.id as string | undefined) ?? null,
      occurredAt,
      payableAtMs: payableAt(occurredAt.getTime(), terms.holdbackDays),
      termsId: terms.termsId,
    });
  }

  if (!commission.ok) {
    return await insertEntry(db, {
      partnerId,
      kind: "accrual",
      amountCents: null,
      status: "blocked",
      explanation: commission.explanation,
      model: commission.model,
      fileId,
      orderId: (order?.id as string | undefined) ?? null,
      occurredAt,
      payableAtMs: payableAt(occurredAt.getTime(), terms.holdbackDays),
      termsId: terms.termsId,
    });
  }

  return await insertEntry(db, {
    partnerId,
    kind: "accrual",
    amountCents: commission.amountCents,
    status: "accrued",
    explanation: commission.explanation,
    model: commission.model,
    percentBps: commission.percentBps,
    flatCents: commission.flatCents,
    basisCents: commission.basisCents,
    fileId,
    orderId: (order?.id as string | undefined) ?? null,
    occurredAt,
    payableAtMs: payableAt(occurredAt.getTime(), terms.holdbackDays),
    termsId: terms.termsId,
  });
}

/**
 * Accrue on a lead the firm qualified.
 *
 * Qualified means somebody at the firm converted it into a client and a file.
 * That is the firm's own act rather than the partner's claim, which is the only
 * definition of a qualified lead that cannot be gamed by sending more forms.
 *
 * Silent for every other model, deliberately: a partner paid per order has not
 * earned anything by a lead being converted, and writing a zero entry against
 * the lead would put a line on their statement for something that is not part
 * of their terms.
 */
export async function accrueForQualifiedLead(leadId: string): Promise<AccrualResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: lead } = await db
    .from("eng_leads")
    .select("id, partner_id, created_at")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "That lead does not exist." };
  if (!lead.partner_id) {
    return { ok: true, entryId: null, amountCents: 0, explanation: "No partner is attributed to this lead." };
  }

  const partnerId = lead.partner_id as string;
  const occurredAt = new Date();
  const terms = await termsInForce(partnerId, occurredAt);

  if (!terms) {
    return {
      ok: true,
      entryId: null,
      amountCents: 0,
      explanation:
        "This partner has no compensation terms in force, so converting their lead accrues nothing. Setting terms decides what a lead is worth from then on.",
    };
  }

  const commission = commissionForQualifiedLead(terms);
  if (!commission.ok && commission.reason === "not_earned_here") {
    return { ok: true, entryId: null, amountCents: 0, explanation: commission.explanation };
  }

  if (!commission.ok) {
    return await insertEntry(db, {
      partnerId,
      kind: "accrual",
      amountCents: null,
      status: "blocked",
      explanation: commission.explanation,
      model: commission.model,
      leadId,
      occurredAt,
      payableAtMs: payableAt(occurredAt.getTime(), terms.holdbackDays),
      termsId: terms.termsId,
    });
  }

  return await insertEntry(db, {
    partnerId,
    kind: "accrual",
    amountCents: commission.amountCents,
    status: "accrued",
    explanation: commission.explanation,
    model: commission.model,
    flatCents: commission.flatCents,
    leadId,
    occurredAt,
    payableAtMs: payableAt(occurredAt.getTime(), terms.holdbackDays),
    termsId: terms.termsId,
  });
}

// --------------------------------------------------------------- reversals

/**
 * Money went back to the customer, so some of the commission goes back too.
 *
 * NOTHING HERE EDITS AN ACCRUAL. The accrual stands, a counter entry is written
 * beside it, and the two net. That is the same rule the payment ledger applies
 * to a refund, and a partner is owed the same honesty the firm gives itself.
 *
 * Called from every path that records a refund. There are three of them, and
 * that is one more reason the idempotence lives in a unique index on the
 * payment row rather than in whichever of the three remembered to check.
 */
export async function reverseForRefund(input: {
  orderId: string;
  /** eng_order_payments.id of the refund row. The idempotence key. */
  paymentId: string | null;
  refundedCents: number;
}): Promise<{ ok: true; reversed: number; note: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: entries } = await db
    .from("eng_partner_entries")
    .select("id, partner_id, kind, amount_cents, status, model, basis_cents, file_id, order_id, payable_at")
    .eq("order_id", input.orderId)
    .eq("kind", "accrual");

  if (!entries || entries.length === 0) {
    return { ok: true, reversed: 0, note: "No commission was accrued on that order, so nothing is reversed." };
  }

  let reversed = 0;
  const notes: string[] = [];

  for (const accrual of entries) {
    if (accrual.status === "blocked" || accrual.amount_cents === null) {
      /*
       * A blocked accrual has no figure to reverse a proportion of. It is left
       * alone and said out loud: whoever fills the figure in has to know a
       * refund happened, and the ledger showing both is how they find out.
       */
      notes.push("An accrual on this order has no figure yet, so it was left for somebody to settle by hand.");
      continue;
    }

    const verdict = reversalFor({
      model: (accrual.model as CompModel | null) ?? "percent_of_order",
      accruedCents: Number(accrual.amount_cents),
      basisCents: accrual.basis_cents === null ? null : Number(accrual.basis_cents),
      refundedCents: input.refundedCents,
    });

    if (!verdict.reverse) {
      notes.push(verdict.explanation);
      continue;
    }

    const written = await insertEntry(db, {
      partnerId: accrual.partner_id as string,
      kind: "reversal",
      amountCents: verdict.amountCents,
      status: "accrued",
      explanation: verdict.explanation,
      model: (accrual.model as CompModel | null) ?? null,
      basisCents: accrual.basis_cents === null ? null : Number(accrual.basis_cents),
      fileId: (accrual.file_id as string | null) ?? null,
      orderId: input.orderId,
      reversesId: accrual.id as string,
      paymentId: input.paymentId,
      occurredAt: new Date(),
      /*
       * A reversal is payable immediately rather than held back. The holdback
       * exists to stop the firm paying out money it might have to take back;
       * applying it to the taking back would delay the correction and let a
       * statement go out owing more than the firm owes.
       */
      payableAtMs: Date.now(),
    });

    if (written.ok && written.entryId) reversed += 1;
    if (written.ok && !written.entryId) {
      notes.push("This refund had already been reversed, so nothing was written twice.");
    }
    if (!written.ok) notes.push(written.error);
  }

  return {
    ok: true,
    reversed,
    note: notes.join(" ") || `${reversed} counter entr${reversed === 1 ? "y" : "ies"} written.`,
  };
}

// ----------------------------------------------------------- adjustments

/**
 * A correction, written beside what it corrects.
 *
 * THIS IS HOW AN ATTRIBUTION DISPUTE IS SETTLED, and it is the only how.
 * 0014 freezes the attribution columns on a paid order, so the answer cannot be
 * rewritten. The operator records a decision and a compensating entry, and both
 * the original and the correction stand where a partner can read them.
 *
 * The reason is required and long enough to be a sentence. An adjustment with
 * no explanation is a figure a partner cannot check, which is the one thing
 * this ledger exists to prevent, and whoever needs the explanation most is
 * whoever is asked about it in two years.
 */
export async function recordAdjustment(
  actor: Actor & { email?: string },
  input: {
    partnerId: string;
    amountCents: number;
    reason: string;
    orderId?: string | null;
    reversesId?: string | null;
  },
): Promise<AccrualResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "partners.manage")) {
    return { ok: false, error: "You do not have permission to manage the referral programme." };
  }

  const reason = input.reason.trim();
  if (reason.length < 20) {
    return {
      ok: false,
      error:
        "Say what is being corrected and why, in a sentence. It goes on the statement, and it is the only account of this anybody will have.",
    };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
    return { ok: false, error: "An adjustment is a whole number of cents, and not zero." };
  }

  const written = await insertEntry(db, {
    partnerId: input.partnerId,
    kind: "adjustment",
    amountCents: input.amountCents,
    status: "accrued",
    explanation: `Recorded by the firm: ${reason}`,
    orderId: input.orderId ?? null,
    reversesId: input.reversesId ?? null,
    occurredAt: new Date(),
    /*
     * Payable at once. An adjustment is the firm settling something it has
     * already decided, and holding back a correction it made itself would mean
     * a partner waiting thirty days for money the firm agrees it owes.
     */
    payableAtMs: Date.now(),
  });

  if (written.ok) {
    await writeAudit({
      actor,
      action: "partner.adjustment",
      entityType: "partner",
      entityId: input.partnerId,
      summary: `${money(input.amountCents)} adjustment: ${reason}`,
    });
  }

  return written;
}

// ------------------------------------------------------------ the margin read

/**
 * What each file's partner commission actually is, for `marginOf`.
 *
 * THE THREE ANSWERS, AND WHY THE THIRD IS NOT ZERO
 * ------------------------------------------------
 *   no partner on the file      0, a real cost of nothing
 *   a partner and a net ledger  that net
 *   a partner and no entry, or  null. Something is coming and its size is not
 *   any blocked entry           known, so the margin is unknown rather than
 *                               optimistic by the commission.
 *
 * The third case is the whole reason the fourth cost is nullable. A file
 * attributed to a partner and delivered tomorrow has a commission the firm
 * cannot state today, and stating zero would make every such file's margin too
 * high, in the direction nobody questions.
 */
export async function partnerCostByFile(
  files: { id: string; partnerId: string | null }[],
): Promise<Map<string, Cents>> {
  const out = new Map<string, Cents>();
  for (const file of files) out.set(file.id, file.partnerId ? null : 0);

  const withPartner = files.filter((f) => f.partnerId).map((f) => f.id);
  if (withPartner.length === 0) return out;

  const db = supabaseAdmin();
  if (!db) return out;

  const { data } = await db
    .from("eng_partner_entries")
    .select("file_id, amount_cents, status")
    .in("file_id", withPartner);

  const byFile = new Map<string, { amountCents: number | null; status: "accrued" | "blocked" }[]>();
  for (const row of data ?? []) {
    const key = row.file_id as string;
    byFile.set(key, [
      ...(byFile.get(key) ?? []),
      {
        amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
        status: row.status as "accrued" | "blocked",
      },
    ]);
  }

  for (const [fileId, entries] of byFile) {
    const net = netOf(entries);
    out.set(fileId, net.blocked > 0 ? null : net.netCents);
  }

  return out;
}

// -------------------------------------------------------------- statements

export type PartnerCloseResult =
  | {
      ok: true;
      /** Null when there was nothing to pay, which is not a failure. */
      statementId: string | null;
      reference: string | null;
      entries: number;
      totalCents: number;
      blocked: number;
      note: string;
    }
  | { ok: false; error: string };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function partnerStatementReference(period: string): string {
  let tail = "";
  for (let i = 0; i < 5; i += 1) tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `254-P${period.replace("-", "")}-${tail}`;
}

/**
 * Close a period for one partner: gather what has become payable.
 *
 * WHICH ENTRIES BELONG TO A PERIOD, WHICH IS NOT THE OBVIOUS ANSWER
 * -----------------------------------------------------------------
 * Not the ones that were EARNED in it. The ones that have become PAYABLE by the
 * end of it, whenever they were earned. That is what a holdback means: a
 * commission earned on the 28th with a thirty day window is not September's to
 * pay, it is October's, and a partner reading their statement should find it
 * where the window says it will be.
 *
 * A reversal is payable at once, so a refund arriving after its accrual was
 * paid lands as a negative on the next statement. The two net across periods,
 * which is the arithmetic a partner can follow, rather than the firm quietly
 * writing off the difference or asking for a cheque back.
 *
 * NOTHING IS OPENED WHEN NOTHING IS OWED
 * --------------------------------------
 * If the net is zero or negative, no statement row is created and the balance
 * carries into the next close. An empty statement is a document that says the
 * firm settled with somebody when it did not, and a negative one is an invoice
 * to a partner, which this program does not issue.
 */
export async function closePartnerPeriod(
  partnerId: string,
  period: string,
  options: { actorEmail?: string; now?: Date } = {},
): Promise<PartnerCloseResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const now = options.now ?? new Date();
  const periodEnd = endOfPeriod(period);
  if (!periodEnd) return { ok: false, error: "That is not a period. Use YYYY-MM." };

  const cutoff = new Date(Math.min(periodEnd.getTime(), now.getTime()));

  /*
   * The same as the customer side, and the same reason: no unique constraint on
   * (partner_id, period), so two statements for a month is reachable, and a
   * discarded PGRST116 read it as none and issued another. On this side the
   * consequence is paying a partner twice for the same period.
   *
   * Oldest first, because the earliest is the one the partner was sent.
   */
  const { data: existingRows, error: existingErr } = await db
    .from("eng_partner_statements")
    .select("id, reference, status, total_cents")
    .eq("partner_id", partnerId)
    .eq("period", period)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingErr) {
    return { ok: false, error: `Could not check whether that period already has a statement: ${existingErr.message}` };
  }
  const existing = (existingRows ?? [])[0] ?? null;

  /*
   * An issued statement is closed, exactly as on the customer side. A late
   * entry lands on the next period, which is where it belongs, rather than
   * changing a document the partner has already been sent.
   */
  if (existing && existing.status !== "open") {
    return {
      ok: true,
      statementId: existing.id as string,
      reference: existing.reference as string,
      entries: 0,
      totalCents: Number(existing.total_cents ?? 0),
      blocked: 0,
      note: `That statement is already ${existing.status}. Anything since lands on the next period.`,
    };
  }

  /*
   * PAGED, BECAUSE A CLAIM CANNOT BE PARTIAL.
   *
   * Every row here is claimed into the statement by the update below and paid
   * on. A truncated read bills the partner for the first thousand entries and
   * silently leaves the rest unclaimed, so the issued statement is short and
   * the backlog grows at every close without anybody seeing it.
   *
   * There is no honest "some of it" for this: it is money owed to a person.
   */
  const claim = await readEvery<{ id: string; amount_cents: number | null; status: string; kind: string }>(
    (from, to) =>
      db
        .from("eng_partner_entries")
        .select("id, amount_cents, status, kind")
        .eq("partner_id", partnerId)
        .is("statement_id", null)
        .lte("payable_at", cutoff.toISOString())
        .order("occurred_at", { ascending: true })
        .range(from, to),
  );

  if (!claim.ok) {
    return {
      ok: false,
      error:
        "The partner ledger could not be read in full, so nothing was claimed and no statement was issued. " +
        claim.error,
    };
  }

  const claimable = claim.rows;
  const payable = claimable.filter((e) => e.status === "accrued" && e.amount_cents !== null);
  const blocked = claimable.filter((e) => e.status === "blocked").length;

  const net = netOf(
    payable.map((e) => ({
      amountCents: e.amount_cents === null ? null : Number(e.amount_cents),
      status: e.status as "accrued" | "blocked",
    })),
  );

  if (payable.length === 0 || net.netCents <= 0) {
    const note =
      payable.length === 0
        ? "Nothing has become payable in this period, so no statement was opened."
        : `The entries in this period net to ${money(net.netCents)}, so no statement was opened and the balance carries into the next close.`;
    await writeAudit({
      actor: { id: null, role: "admin", email: options.actorEmail ?? "partner-engine@254engineering.com" },
      action: "partner.period_closed_empty",
      entityType: "partner",
      entityId: partnerId,
      summary: `${period}: ${note}${blocked ? ` ${blocked} entr${blocked === 1 ? "y is" : "ies are"} waiting for a figure.` : ""}`,
    });
    return {
      ok: true,
      statementId: null,
      reference: null,
      entries: 0,
      totalCents: net.netCents,
      blocked,
      note,
    };
  }

  let statementId = existing?.id as string | undefined;
  let reference = existing?.reference as string | undefined;

  if (!statementId) {
    reference = partnerStatementReference(period);
    const { data: created, error } = await db
      .from("eng_partner_statements")
      .insert({ partner_id: partnerId, reference, period, status: "open" })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "The statement could not be opened." };
    statementId = created.id as string;
  }

  /*
   * Claiming is the lock, exactly as setting statement_id on an order is on the
   * customer side. An entry with a statement is never gathered again, so two
   * closes running at once cannot put one commission on two statements.
   */
  const ids = payable.map((e) => e.id as string);
  const { error: claimError } = await db
    .from("eng_partner_entries")
    .update({ statement_id: statementId })
    .in("id", ids)
    .is("statement_id", null);
  if (claimError) return { ok: false, error: `The entries could not be attached: ${claimError.message}` };

  /*
   * The total is recomputed from what is actually attached rather than from
   * what this run intended to attach, so a close that raced with another
   * cannot leave a header disagreeing with its own lines.
   */
  /*
   * PAGED, for the reason the comment above already gives: this recompute
   * exists so a header cannot disagree with its own lines, and a truncated read
   * is precisely what would make it disagree.
   */
  const attachedRead = await readEvery<{ amount_cents: number | null; status: string }>((from, to) =>
    db
      .from("eng_partner_entries")
      .select("amount_cents, status")
      .eq("statement_id", statementId)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const attached = attachedRead.ok ? attachedRead.rows : null;

  const headerNet = netOf(
    (attached ?? []).map((e) => ({
      amountCents: e.amount_cents === null ? null : Number(e.amount_cents),
      status: e.status as "accrued" | "blocked",
    })),
  );

  await db
    .from("eng_partner_statements")
    .update({ total_cents: headerNet.netCents })
    .eq("id", statementId);

  await writeAudit({
    actor: { id: null, role: "admin", email: options.actorEmail ?? "partner-engine@254engineering.com" },
    action: "partner.period_closed",
    entityType: "partner",
    entityId: partnerId,
    summary: `${reference}: ${period} closed with ${attached?.length ?? 0} entr${(attached?.length ?? 0) === 1 ? "y" : "ies"}, ${money(headerNet.netCents)}${blocked ? `, ${blocked} still waiting for a figure` : ""}`,
  });

  return {
    ok: true,
    statementId,
    reference: reference!,
    entries: attached?.length ?? 0,
    totalCents: headerNet.netCents,
    blocked,
    note: blocked
      ? `${blocked} entr${blocked === 1 ? "y is" : "ies are"} owed with no figure and were left off rather than counted as nothing.`
      : "",
  };
}

/**
 * Issue: the moment a working total becomes a thing the firm has told a partner
 * it owes them.
 *
 * Split from the close for the reason the customer side splits them: gathering
 * what is owed and telling somebody they are owed it are different acts, and a
 * mistake in the first must not automatically become a mistake in the second.
 */
export async function issuePartnerStatement(
  statementId: string,
  actorEmail?: string,
): Promise<{ ok: true; reference: string; totalCents: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: statement } = await db
    .from("eng_partner_statements")
    .select("id, reference, status, partner_id, total_cents")
    .eq("id", statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "That statement does not exist." };
  if (statement.status !== "open") {
    return { ok: false, error: `That statement is ${statement.status} and cannot be issued again.` };
  }
  if (statement.total_cents === null || Number(statement.total_cents) <= 0) {
    return { ok: false, error: "That statement has nothing on it, so there is nothing to issue." };
  }

  await db
    .from("eng_partner_statements")
    .update({ status: "issued", issued_at: DB_NOW })
    .eq("id", statementId);

  await writeAudit({
    actor: { id: null, role: "admin", email: actorEmail ?? "partner-engine@254engineering.com" },
    action: "partner.statement_issued",
    entityType: "partner",
    entityId: statement.partner_id as string,
    summary: `${statement.reference}: ${money(Number(statement.total_cents))} issued to the partner`,
  });

  return {
    ok: true,
    reference: statement.reference as string,
    totalCents: Number(statement.total_cents),
  };
}

/**
 * Record that the money moved, which happened somewhere else.
 *
 * The reference is required. A payout with no reference is a claim that
 * somebody paid with nothing to check it against, and the whole point of this
 * row is being able to answer "when, and how" three years later.
 */
export async function recordPartnerPayout(input: {
  statementId: string;
  reference: string;
  note?: string;
  actorId?: string | null;
  actorEmail?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const reference = input.reference.trim();
  if (reference.length < 3) {
    return { ok: false, error: "A payout needs the reference it was paid under, so it can be checked later." };
  }

  const { data: statement } = await db
    .from("eng_partner_statements")
    .select("id, reference, status, partner_id, total_cents")
    .eq("id", input.statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "That statement does not exist." };
  if (statement.status === "paid") return { ok: false, error: "That statement is already recorded as paid." };
  if (statement.status !== "issued") {
    return { ok: false, error: "A statement is issued to the partner before it is paid." };
  }

  await db
    .from("eng_partner_statements")
    .update({
      status: "paid",
      paid_at: DB_NOW,
      payout_reference: reference,
      paid_by: input.actorId ?? null,
      paid_note: input.note?.trim() || null,
    })
    .eq("id", input.statementId);

  await writeAudit({
    actor: { id: input.actorId ?? null, role: "admin", email: input.actorEmail },
    action: "partner.payout_recorded",
    entityType: "partner",
    entityId: statement.partner_id as string,
    summary: `${statement.reference}: ${money(Number(statement.total_cents ?? 0))} recorded as paid under ${reference}`,
  });

  return { ok: true };
}

// ------------------------------------------------------------------ reading

export type LedgerRow = {
  id: string;
  kind: PartnerEntryKind;
  amountCents: Cents;
  status: "accrued" | "blocked";
  explanation: string;
  occurredAt: string;
  payableAt: string;
  statementId: string | null;
  fileId: string | null;
  orderId: string | null;
  leadId: string | null;
};

/** One partner's ledger, newest first. */
export async function partnerLedger(
  partnerId: string,
  options: { limit?: number; statementId?: string } = {},
): Promise<LedgerRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  let query = db
    .from("eng_partner_entries")
    .select("id, kind, amount_cents, status, explanation, occurred_at, payable_at, statement_id, file_id, order_id, lead_id")
    .eq("partner_id", partnerId)
    .order("occurred_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.statementId) query = query.eq("statement_id", options.statementId);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as PartnerEntryKind,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    status: row.status as "accrued" | "blocked",
    explanation: row.explanation as string,
    occurredAt: row.occurred_at as string,
    payableAt: row.payable_at as string,
    statementId: (row.statement_id as string | null) ?? null,
    fileId: (row.file_id as string | null) ?? null,
    orderId: (row.order_id as string | null) ?? null,
    leadId: (row.lead_id as string | null) ?? null,
  }));
}

/** What a partner is owed and has not been paid, and what is still on hold. */
/**
 * What a partner is owed, and null when it could not be worked out.
 *
 * THIS USED TO RETURN ZEROS ON A FAILED READ, AND IT TOLD AN OUTSIDER THEY HAD
 * EARNED NOTHING.
 *
 * Found in the Phase 12 Section 2 figure inventory. An unconfigured database
 * returned `{ payableCents: 0, ... }` and neither query inspected `error`, so a
 * partner opening their own portal during an outage saw four confident figures
 * reading $0.00. Every other absent value in this codebase says it does not
 * know; this one asserted the answer was nothing, to somebody outside the firm,
 * about their own money.
 *
 * The blocked entry handling below was already right, which is exactly what
 * made this easy to miss: the function looked careful because in one respect it
 * was.
 *
 * Null now propagates to the screen, which renders "not set" through the same
 * money() every other figure uses, and the count of blocked entries is still
 * reported separately so a partner can see that something is owed even when the
 * figure is not yet known.
 */
export type PartnerBalance = {
  payableCents: Cents;
  heldCents: Cents;
  blocked: number;
  issuedCents: Cents;
};

export async function partnerBalance(
  partnerId: string,
  now: Date = new Date(),
): Promise<PartnerBalance> {
  const unknown: PartnerBalance = {
    payableCents: null,
    heldCents: null,
    blocked: 0,
    issuedCents: null,
  };

  const db = supabaseAdmin();
  if (!db) return unknown;

  /*
   * PAGED. This is a LIFETIME read with no period bound, and the figure is what
   * a partner is paid on, so the highest volume partner is both the first to
   * exceed a page and the one it costs most. An absence is available here,
   * because `unknown` is already the shape of this function's failure, but the
   * honest answer is the whole ledger and that is cheap enough to fetch.
   */
  const ledger = await readEvery<{
    amount_cents: number | null; status: string; payable_at: string; statement_id: string | null;
  }>((from, to) =>
    db
      .from("eng_partner_entries")
      .select("amount_cents, status, payable_at, statement_id")
      .eq("partner_id", partnerId)
      .order("occurred_at", { ascending: true })
      .range(from, to),
  );

  if (!ledger.ok) {
    console.error("[partner] the ledger could not be read:", ledger.error);
    return unknown;
  }
  const data = ledger.rows;

  let payable = 0;
  let held = 0;
  let blocked = 0;
  for (const row of data ?? []) {
    if (row.status === "blocked" || row.amount_cents === null) {
      blocked += 1;
      continue;
    }
    if (row.statement_id) continue;
    const amount = Number(row.amount_cents);
    if (new Date(row.payable_at as string) <= now) payable += amount;
    else held += amount;
  }

  const { data: issued, error: issuedError } = await db
    .from("eng_partner_statements")
    .select("total_cents")
    .eq("partner_id", partnerId)
    .eq("status", "issued");

  if (issuedError) {
    console.error("[partner] the issued statements could not be read:", issuedError.message);
    /*
     * The ledger read succeeded, so payable and held are real. Only the issued
     * total is unknown, and it says so rather than dragging the two figures
     * that ARE known down with it.
     */
    return { payableCents: payable, heldCents: held, blocked, issuedCents: null };
  }

  /*
   * A statement with no total is excluded rather than counted as zero, the same
   * way a blocked entry is. `sum` stays null if every statement is missing its
   * figure, which is the honest answer to "what has been issued".
   */
  const totals = (issued ?? [])
    .map((s) => (s.total_cents === null ? null : Number(s.total_cents)))
    .filter((v): v is number => isKnown(v));

  return {
    payableCents: payable,
    heldCents: held,
    blocked,
    issuedCents: (issued ?? []).length > 0 && totals.length === 0 ? null : totals.reduce((n, v) => n + v, 0),
  };
}

// ------------------------------------------------------------------ writing

type InsertInput = {
  partnerId: string;
  kind: PartnerEntryKind;
  amountCents: number | null;
  status: "accrued" | "blocked";
  explanation: string;
  model?: CompModel | null;
  percentBps?: number | null;
  flatCents?: number | null;
  basisCents?: number | null;
  fileId?: string | null;
  orderId?: string | null;
  leadId?: string | null;
  reversesId?: string | null;
  paymentId?: string | null;
  termsId?: string | null;
  occurredAt: Date;
  payableAtMs: number;
};

/**
 * One insert, and one place that knows a duplicate is not an error.
 *
 * A 23505 here means the unique index did its job: this file, lead or refund
 * already has its entry. That is the expected result of a retry, so it returns
 * ok with no entry id rather than an error somebody has to interpret. Every
 * other failure is returned as itself.
 */
async function insertEntry(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  input: InsertInput,
): Promise<AccrualResult> {
  const { data, error } = await db
    .from("eng_partner_entries")
    .insert({
      partner_id: input.partnerId,
      kind: input.kind,
      amount_cents: input.amountCents,
      status: input.status,
      explanation: input.explanation,
      model: input.model ?? null,
      percent_bps: input.percentBps ?? null,
      flat_cents: input.flatCents ?? null,
      basis_cents: input.basisCents ?? null,
      file_id: input.fileId ?? null,
      order_id: input.orderId ?? null,
      lead_id: input.leadId ?? null,
      reverses_id: input.reversesId ?? null,
      payment_id: input.paymentId ?? null,
      terms_id: input.termsId ?? null,
      occurred_at: input.occurredAt.toISOString(),
      payable_at: new Date(input.payableAtMs).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === DUPLICATE) {
      return {
        ok: true,
        entryId: null,
        amountCents: input.amountCents,
        explanation: "This had already been recorded, so nothing was written twice.",
      };
    }
    return { ok: false, error: error.message };
  }

  await writeAudit({
    actor: { id: null, role: "admin", email: "partner-engine@254engineering.com" },
    action: `partner.${input.kind}`,
    entityType: "partner",
    entityId: input.partnerId,
    summary: `${input.status === "blocked" ? "Owed, figure unknown" : money(input.amountCents)}: ${input.explanation}`,
  });

  return {
    ok: true,
    entryId: data.id as string,
    amountCents: input.amountCents,
    explanation: input.explanation,
  };
}

/** How many accruals this partner already has in the period a date falls in. */
async function accrualsInPeriod(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  partnerId: string,
  at: Date,
): Promise<number> {
  const period = at.toISOString().slice(0, 7);
  const start = `${period}-01T00:00:00.000Z`;
  const end = endOfPeriod(period)?.toISOString() ?? at.toISOString();

  const { count } = await db
    .from("eng_partner_entries")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("kind", "accrual")
    .eq("status", "accrued")
    .gte("occurred_at", start)
    .lte("occurred_at", end);

  return count ?? 0;
}

/** The last instant of a YYYY-MM period, or null if that is not one. */
export function endOfPeriod(period: string): Date | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return new Date(Date.UTC(year, month, 1) - 1);
}
