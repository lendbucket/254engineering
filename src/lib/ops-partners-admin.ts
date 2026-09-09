import "server-only";
import { readEvery } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { normaliseCode, looksLikeCode } from "./attribution-rules";
import { issuePartnerToken } from "./partner-auth";
import { netOf, type CompModel, type Tier } from "./partner-comp";
import type { Cents } from "./ops-money";

/**
 * The firm's side of the referral programme.
 *
 * EVERY FUNCTION ASKS can(actor, "partners.manage") AND SAYS SO
 * --------------------------------------------------------------
 * Not the route, and not the page. Both of those exist and both are checked,
 * and neither is the lock: a route is one file somebody forgets to guard when
 * they add the second one. The capability is asked here, where the write is,
 * so a caller that skipped its own check still cannot get past this.
 *
 * partners.manage is admin only by seed. Behind it: who may use the firm's name
 * to win work, what the firm owes somebody outside it, and the record that
 * money left.
 *
 * WHAT IS NOT HERE
 * ----------------
 * Any function that moves money. The payout is recorded in ops-partner-comp and
 * performed by a person somewhere else, which is the rule that whole module is
 * built on and is repeated here because this is the file an operator screen
 * calls.
 */

const REFUSED = "You do not have permission to manage the referral programme.";

export type PartnerRow = {
  id: string;
  organisation: string;
  contactName: string;
  contactEmail: string;
  code: string;
  status: "active" | "suspended" | "ended";
  createdAt: string;
  agreementVersion: string | null;
  /** Live figures, so a roster is worth opening. */
  referrals: number;
  payableCents: number;
  blocked: number;
  people: number;
};

export async function partnerRoster(actor: Actor): Promise<PartnerRow[]> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "partners.manage")) return [];

  const { data: partners } = await db
    .from("eng_partners")
    .select("id, organisation, contact_name, contact_email, code, status, created_at, agreement_version")
    .order("organisation", { ascending: true })
    .limit(200);

  const ids = (partners ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const { data: orders } = await db
    .from("eng_service_orders")
    .select("partner_id")
    .in("partner_id", ids);

  /*
   * PAGED, AND THIS IS THE ONE THAT BREAKS EARLIEST OF ALL THE MONEY READS.
   *
   * Every entry, for every partner on the roster, for all of history, in one
   * request. It is the only read in this repository that multiplies the roster
   * by all of time, so it reaches a thousand rows long before any single
   * partner's own ledger does, and every partner below the cut then shows
   * nothing payable on the administrator's screen.
   */
  const entryRead = await readEvery<{
    partner_id: string; amount_cents: number | null; status: string; statement_id: string | null; payable_at: string;
  }>((from, to) =>
    db
      .from("eng_partner_entries")
      .select("partner_id, amount_cents, status, statement_id, payable_at")
      .in("partner_id", ids)
      .order("occurred_at", { ascending: true })
      .range(from, to),
  );
  const entries = entryRead.ok ? entryRead.rows : null;

  const { data: users } = await db
    .from("eng_partner_users")
    .select("partner_id, status")
    .in("partner_id", ids);

  const now = Date.now();

  return (partners ?? []).map((p) => {
    const id = p.id as string;
    const mine = (entries ?? []).filter((e) => e.partner_id === id);
    const payable = mine
      .filter(
        (e) =>
          e.status === "accrued" &&
          e.amount_cents !== null &&
          !e.statement_id &&
          new Date(e.payable_at as string).getTime() <= now,
      )
      .reduce((n, e) => n + Number(e.amount_cents), 0);

    return {
      id,
      organisation: p.organisation as string,
      contactName: p.contact_name as string,
      contactEmail: p.contact_email as string,
      code: p.code as string,
      status: p.status as PartnerRow["status"],
      createdAt: p.created_at as string,
      agreementVersion: (p.agreement_version as string | null) ?? null,
      referrals: (orders ?? []).filter((o) => o.partner_id === id).length,
      payableCents: payable,
      blocked: mine.filter((e) => e.status === "blocked").length,
      people: (users ?? []).filter((u) => u.partner_id === id && u.status !== "suspended").length,
    };
  });
}

export type PartnerDetail = {
  partner: PartnerRow & { payoutMethod: string | null; payoutReference: string | null; notes: string | null };
  terms: {
    id: string;
    model: CompModel;
    percentBps: number | null;
    flatCents: number | null;
    tiers: Tier[] | null;
    holdbackDays: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    note: string | null;
  }[];
  people: { id: string; email: string; displayName: string; status: string; lastSignInAt: string | null }[];
  statements: {
    id: string;
    reference: string;
    period: string;
    status: string;
    totalCents: Cents;
    issuedAt: string | null;
    paidAt: string | null;
  }[];
  ledger: {
    id: string;
    kind: string;
    amountCents: Cents;
    status: string;
    explanation: string;
    occurredAt: string;
    payableAt: string;
    statementId: string | null;
    orderId: string | null;
  }[];
  netCents: number;
  blocked: number;
};

export async function partnerDetail(actor: Actor, partnerId: string): Promise<PartnerDetail | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "partners.manage")) return null;

  const { data: p } = await db
    .from("eng_partners")
    .select(
      "id, organisation, contact_name, contact_email, code, status, created_at, agreement_version, payout_method, payout_reference, notes",
    )
    .eq("id", partnerId)
    .maybeSingle();
  if (!p) return null;

  const [{ data: terms }, { data: people }, { data: statements }, { data: ledger }, { count: referrals }] =
    await Promise.all([
      db
        .from("eng_partner_terms")
        .select("id, model, percent_bps, flat_cents, tiers, holdback_days, effective_from, effective_to, note")
        .eq("partner_id", partnerId)
        .order("effective_from", { ascending: false }),
      db
        .from("eng_partner_users")
        .select("id, email, display_name, status, last_sign_in_at")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: true }),
      db
        .from("eng_partner_statements")
        .select("id, reference, period, status, total_cents, issued_at, paid_at")
        .eq("partner_id", partnerId)
        .order("period", { ascending: false })
        .limit(24),
      db
        .from("eng_partner_entries")
        .select("id, kind, amount_cents, status, explanation, occurred_at, payable_at, statement_id, order_id")
        .eq("partner_id", partnerId)
        .order("occurred_at", { ascending: false })
        .limit(100),
      db
        .from("eng_service_orders")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId),
    ]);

  const rows = (ledger ?? []).map((e) => ({
    id: e.id as string,
    kind: e.kind as string,
    amountCents: e.amount_cents === null ? null : Number(e.amount_cents),
    status: e.status as string,
    explanation: e.explanation as string,
    occurredAt: e.occurred_at as string,
    payableAt: e.payable_at as string,
    statementId: (e.statement_id as string | null) ?? null,
    orderId: (e.order_id as string | null) ?? null,
  }));

  const net = netOf(
    rows.map((r) => ({ amountCents: r.amountCents, status: r.status as "accrued" | "blocked" })),
  );

  return {
    partner: {
      id: p.id as string,
      organisation: p.organisation as string,
      contactName: p.contact_name as string,
      contactEmail: p.contact_email as string,
      code: p.code as string,
      status: p.status as PartnerRow["status"],
      createdAt: p.created_at as string,
      agreementVersion: (p.agreement_version as string | null) ?? null,
      referrals: referrals ?? 0,
      payableCents: 0,
      blocked: net.blocked,
      people: (people ?? []).length,
      payoutMethod: (p.payout_method as string | null) ?? null,
      payoutReference: (p.payout_reference as string | null) ?? null,
      notes: (p.notes as string | null) ?? null,
    },
    terms: (terms ?? []).map((t) => ({
      id: t.id as string,
      model: t.model as CompModel,
      percentBps: t.percent_bps === null ? null : Number(t.percent_bps),
      flatCents: t.flat_cents === null ? null : Number(t.flat_cents),
      tiers: Array.isArray(t.tiers) ? (t.tiers as Tier[]) : null,
      holdbackDays: Number(t.holdback_days),
      effectiveFrom: t.effective_from as string,
      effectiveTo: (t.effective_to as string | null) ?? null,
      note: (t.note as string | null) ?? null,
    })),
    people: (people ?? []).map((u) => ({
      id: u.id as string,
      email: u.email as string,
      displayName: u.display_name as string,
      status: u.status as string,
      lastSignInAt: (u.last_sign_in_at as string | null) ?? null,
    })),
    statements: (statements ?? []).map((st) => ({
      id: st.id as string,
      reference: st.reference as string,
      period: st.period as string,
      status: st.status as string,
      totalCents: st.total_cents === null ? null : Number(st.total_cents),
      issuedAt: (st.issued_at as string | null) ?? null,
      paidAt: (st.paid_at as string | null) ?? null,
    })),
    ledger: rows,
    netCents: net.netCents,
    blocked: net.blocked,
  };
}

// ------------------------------------------------------------------ writing

export async function createPartner(
  actor: Actor & { email?: string },
  input: { organisation: string; contactName: string; contactEmail: string; code: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "partners.manage")) return { ok: false, error: REFUSED };

  const organisation = input.organisation.trim();
  const contactName = input.contactName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  const code = normaliseCode(input.code);

  if (organisation.length < 2) return { ok: false, error: "Give the partner organisation a name." };
  if (contactName.length < 2) return { ok: false, error: "Name somebody to contact there." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) return { ok: false, error: "That is not an email address." };

  /*
   * The code goes through the SAME normaliser and the same shape rule the
   * capture endpoint uses. A code an operator can create but a customer cannot
   * type is a partner who never gets credited, and the failure would appear as
   * an attribution problem months later rather than as a validation error now.
   */
  if (!looksLikeCode(code)) {
    return {
      ok: false,
      error: "A code is three to thirty two characters, and it has to be sayable down a telephone.",
    };
  }

  const { data: taken } = await db.from("eng_partners").select("id").eq("code", code).maybeSingle();
  if (taken) return { ok: false, error: "Another partner already has that code." };

  const { data, error } = await db
    .from("eng_partners")
    .insert({
      organisation,
      contact_name: contactName,
      contact_email: contactEmail,
      code,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "The partner could not be created." };

  await writeAudit({
    actor,
    action: "partner.created",
    entityType: "partner",
    entityId: data.id as string,
    summary: `${organisation} added to the referral programme with code ${code}`,
  });

  return { ok: true, id: data.id as string };
}

/**
 * Suspend, restore, or end a partner.
 *
 * SUSPENDING STOPS THEM EARNING AS WELL AS SIGNING IN, and that is one row
 * doing two jobs on purpose: `partnerByCode` refuses a partner who is not
 * active, so their links stop crediting the moment this is set. A version that
 * only closed the door would leave a suspended partner accruing commission on
 * work they were suspended for.
 *
 * WHAT IT DOES NOT DO IS TOUCH THE LEDGER. What they earned before is still
 * owed. Ending a relationship and refusing to pay for work already delivered
 * are different decisions, and the second one is not a status change.
 */
export async function setPartnerStatus(
  actor: Actor & { email?: string },
  partnerId: string,
  status: "active" | "suspended" | "ended",
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "partners.manage")) return { ok: false, error: REFUSED };
  if (reason.trim().length < 10) {
    return { ok: false, error: "Say why. This stops their links earning, and somebody will ask when." };
  }

  const { data: partner } = await db
    .from("eng_partners")
    .select("id, organisation, status")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return { ok: false, error: "That partner does not exist." };

  await db.from("eng_partners").update({ status }).eq("id", partnerId);

  await writeAudit({
    actor,
    action: "partner.status_changed",
    entityType: "partner",
    entityId: partnerId,
    summary: `${partner.organisation}: ${partner.status} to ${status}. ${reason.trim()}`,
  });

  return { ok: true };
}

export type InviteResult =
  | { ok: true; setPasswordUrl: string; expiresAt: string; alreadyExisted: boolean }
  | { ok: false; error: string };

/**
 * Add somebody who can sign in for a partner, and hand back the one time link.
 *
 * THE LINK IS RETURNED AND NOT EMAILED, exactly as the firm's own accounts are
 * issued. The operator sends it themselves, with whatever context the person
 * needs, and no credential moves through a mail server this firm does not run.
 *
 * The address is checked against every partner rather than this one: an address
 * that already signs in for a different partner cannot be given a second
 * account, because the session carries one partner id and the person would see
 * whichever the login resolved to.
 */
export async function invitePartnerUser(
  actor: Actor & { email?: string },
  partnerId: string,
  input: { email: string; displayName: string },
  origin: string,
): Promise<InviteResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "partners.manage")) return { ok: false, error: REFUSED };

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "That is not an email address." };
  if (displayName.length < 2) return { ok: false, error: "Give the person a name." };

  const { data: partner } = await db
    .from("eng_partners")
    .select("id, organisation")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return { ok: false, error: "That partner does not exist." };

  /*
   * THE SHARPEST OF THE THREE: THIS IS A UNIQUENESS GUARD, AND IT WAS BYPASSED
   * BY THE THING IT GUARDS AGAINST.
   *
   * "One address, one partner" is enforced by the refusal below and by nothing
   * else. With `.maybeSingle()` and the error discarded, two rows for an
   * address answered PGRST116, read as "no existing user", and the guard passed
   * silently, attaching that address to a second partner. The state it exists
   * to prevent was the state that defeated it.
   *
   * Oldest first: the earliest row is the partner the address already belongs
   * to, which is the one the refusal has to name.
   */
  const { data: existingRows, error: existingErr } = await db
    .from("eng_partner_users")
    .select("id, partner_id")
    .ilike("email", email)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingErr) {
    return { ok: false, error: `Could not check whether that address already signs in somewhere: ${existingErr.message}` };
  }
  const existing = (existingRows ?? [])[0] ?? null;

  if (existing && existing.partner_id !== partnerId) {
    return {
      ok: false,
      error: "That address already signs in for a different partner. One address, one partner.",
    };
  }

  let userId = existing?.id as string | undefined;

  if (!userId) {
    const { data: created, error } = await db
      .from("eng_partner_users")
      .insert({ partner_id: partnerId, email, display_name: displayName, status: "invited" })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "The account could not be created." };
    userId = created.id as string;
  }

  const token = await issuePartnerToken(userId, existing ? "reset_password" : "set_password", actor.id);
  if (!token) return { ok: false, error: "The link could not be issued." };

  await writeAudit({
    actor,
    action: existing ? "partner.user_reset" : "partner.user_invited",
    entityType: "partner",
    entityId: partnerId,
    summary: `${partner.organisation}: a set password link was issued for ${email}, to be delivered by hand`,
    /*
     * The link itself is never written to the trail. A one time credential in
     * a table that refuses deletes is a one time credential forever.
     */
    diff: { delivery: "hand", address: email },
  });

  return {
    ok: true,
    setPasswordUrl: `${origin}/partner/set-password?token=${encodeURIComponent(token.token)}`,
    expiresAt: token.expiresAt.toISOString(),
    alreadyExisted: Boolean(existing),
  };
}

/**
 * Set the terms, effective dated.
 *
 * A NEW ROW, NEVER AN EDIT. What a partner earned was computed under the terms
 * in force at the time, and changing the row would change history: the ledger
 * entry snapshots the model and the rate, so the two would disagree and the
 * entry would be right while the terms it points at said something else.
 *
 * The previous terms are closed the day before the new ones start, so there is
 * never a day with two answers or a day with none.
 */
export async function setPartnerTerms(
  actor: Actor & { email?: string },
  partnerId: string,
  input: {
    model: CompModel;
    percentBps?: number | null;
    flatCents?: number | null;
    tiers?: Tier[] | null;
    holdbackDays: number;
    effectiveFrom: string;
    note?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "partners.manage")) return { ok: false, error: REFUSED };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
    return { ok: false, error: "The date these terms start is a calendar date." };
  }
  if (input.holdbackDays < 0 || input.holdbackDays > 365) {
    return { ok: false, error: "A holdback is between zero and three hundred and sixty five days." };
  }

  /*
   * The figure the model needs has to be present. Terms that cannot produce a
   * commission are terms that write a blocked entry on every delivery, and the
   * firm would find out weeks later from a screen saying it owes an unknown
   * amount.
   */
  if (input.model === "percent_of_order" && (input.percentBps ?? null) === null) {
    return { ok: false, error: "A percentage model needs a rate." };
  }
  if (
    (input.model === "flat_per_order" || input.model === "flat_per_qualified_lead") &&
    (input.flatCents ?? null) === null
  ) {
    return { ok: false, error: "A flat fee model needs an amount." };
  }
  if (input.model === "tiered_by_volume" && !(input.tiers ?? []).some((t) => Number(t.min) === 0)) {
    return {
      ok: false,
      error: "A volume ladder needs a step starting at zero, or the first delivery of every period earns nothing.",
    };
  }

  const dayBefore = new Date(new Date(`${input.effectiveFrom}T00:00:00Z`).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);

  await db
    .from("eng_partner_terms")
    .update({ effective_to: dayBefore })
    .eq("partner_id", partnerId)
    .is("effective_to", null)
    .lt("effective_from", input.effectiveFrom);

  const { error } = await db.from("eng_partner_terms").insert({
    partner_id: partnerId,
    model: input.model,
    percent_bps: input.percentBps ?? null,
    flat_cents: input.flatCents ?? null,
    tiers: input.tiers ?? null,
    holdback_days: input.holdbackDays,
    effective_from: input.effectiveFrom,
    set_by: actor.id,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "partner.terms_set",
    entityType: "partner",
    entityId: partnerId,
    summary: `Terms from ${input.effectiveFrom}: ${input.model}, holdback ${input.holdbackDays} days`,
  });

  return { ok: true };
}

// -------------------------------------------------------------- the dispute

export type TouchRow = {
  id: string;
  partnerId: string;
  organisation: string;
  code: string;
  kind: "link" | "code";
  occurredAt: string;
  landingPath: string | null;
};

export type DisputeView = {
  order: { id: string; reference: string; placedAt: string | null; totalCents: Cents; paidAt: string | null };
  attributed: { partnerId: string | null; code: string | null; reason: string | null; at: string | null };
  touches: TouchRow[];
  /*
   * WHETHER THE LINK TOUCHES CAN BE SHOWN AT ALL.
   *
   * An order attributed before 0022 did not store the visitor key it was
   * decided under, so its link touches cannot be found. The screen has to say
   * that: an empty list would be the claim that there were no touches, which
   * is a different statement and not one this platform can make.
   */
  reconstructable: boolean;
};

/**
 * Everything that decides one order's attribution, in one place.
 *
 * THE LOSING TOUCHES ARE THE POINT. 0014 keeps every touch, including the ones
 * that lost, because a dispute cannot be settled if the evidence was
 * overwritten by the decision. This is the screen that reasoning was for: a
 * partner who thinks an order was theirs is shown the touch that beat theirs
 * and when it happened.
 */
export async function disputeView(actor: Actor, orderReference: string): Promise<DisputeView | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "partners.manage")) return null;

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, reference, placed_at, total_cents, paid_at, partner_id, partner_code, attribution_reason, attributed_at, visitor_key")
    .eq("reference", orderReference.trim())
    .maybeSingle();
  if (!order) return null;

  /*
   * BOTH KEYS, WHICH IS WHAT attributeOrder USED.
   *
   * A touch is joined by visitor_key, the opaque first party cookie value. A
   * code typed at checkout is written under the synthetic key `order:<id>`,
   * because there may be no cookie at all.
   *
   * Reading only one of them is how this screen would quietly show half the
   * evidence, and half the evidence in a dispute is worse than none.
   */
  const visitorKey = (order.visitor_key as string | null) ?? null;
  const keys = [visitorKey, `order:${order.id as string}`].filter(Boolean) as string[];

  const { data: touches } = await db
    .from("eng_partner_touches")
    .select("id, partner_id, code, kind, occurred_at, landing_path")
    .in("visitor_key", keys)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const partnerIds = [...new Set((touches ?? []).map((t) => t.partner_id as string))];
  const { data: partners } = partnerIds.length
    ? await db.from("eng_partners").select("id, organisation").in("id", partnerIds)
    : { data: [] };
  const nameOf = new Map((partners ?? []).map((p) => [p.id as string, p.organisation as string]));

  return {
    reconstructable: visitorKey !== null,
    order: {
      id: order.id as string,
      reference: order.reference as string,
      placedAt: (order.placed_at as string | null) ?? null,
      totalCents: order.total_cents === null ? null : Number(order.total_cents),
      paidAt: (order.paid_at as string | null) ?? null,
    },
    attributed: {
      partnerId: (order.partner_id as string | null) ?? null,
      code: (order.partner_code as string | null) ?? null,
      reason: (order.attribution_reason as string | null) ?? null,
      at: (order.attributed_at as string | null) ?? null,
    },
    touches: (touches ?? []).map((t) => ({
      id: String(t.id),
      partnerId: t.partner_id as string,
      organisation: nameOf.get(t.partner_id as string) ?? "a partner who has since been removed",
      code: t.code as string,
      kind: t.kind as "link" | "code",
      occurredAt: t.occurred_at as string,
      landingPath: (t.landing_path as string | null) ?? null,
    })),
  };
}
