import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { SYSTEM_AUTHOR } from "./ops-crm";
import {
  attribute,
  looksLikeCode,
  normaliseCode,
  type Touch,
  ATTRIBUTION_WINDOW_DAYS,
} from "./attribution-rules";

/**
 * Partners, touches, and the one place an order gets attributed.
 *
 * The RULE is in attribution-rules.ts and is pure. This module is the part that
 * reads rows, calls the rule, and writes the answer down. Keeping them apart is
 * what lets the rule be argued with and tested exactly.
 */

export type PartnerRow = {
  id: string;
  organisation: string;
  code: string;
  status: "active" | "suspended" | "ended";
};

/** The cookie that joins a click on Tuesday to an order on Friday. */
export const VISITOR_COOKIE = "eng_ref";

/**
 * Opaque and random, and it identifies nothing about a person.
 *
 * It exists to join two events on one browser. It is not derived from an IP, a
 * user agent or anything else about the visitor, so it cannot be used to
 * recognise somebody who clears it, which is the correct property for a cookie
 * a customer never agreed to.
 */
export function newVisitorKey(): string {
  return randomBytes(16).toString("base64url");
}

export const VISITOR_TTL_DAYS = ATTRIBUTION_WINDOW_DAYS;

/**
 * Resolve a code to a partner, and only an ACTIVE one.
 *
 * A suspended partner's links stop working, which is the operator ruling in
 * Section 6 made real at the only point where it matters. Hiding a suspended
 * partner from the roster while their links kept earning would be the feature
 * doing the opposite of what the button says.
 */
export async function partnerByCode(raw: string): Promise<PartnerRow | null> {
  if (!looksLikeCode(raw)) return null;

  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("eng_partners")
    .select("id, organisation, code, status")
    .eq("code", normaliseCode(raw))
    .maybeSingle();

  if (!data) return null;
  if (data.status !== "active") return null;
  return data as PartnerRow;
}

/**
 * Record a touch. Never throws, for the same reason enqueue never throws: the
 * visitor is trying to read a page, and a tracking failure must not become
 * their problem.
 */
export async function recordTouch(input: {
  code: string;
  kind: Touch["kind"];
  visitorKey: string;
  landingPath?: string | null;
  referrer?: string | null;
}): Promise<{ ok: true; partnerId: string } | { ok: false; reason: string }> {
  try {
    const partner = await partnerByCode(input.code);
    if (!partner) return { ok: false, reason: "no active partner has that code" };

    const db = supabaseAdmin();
    if (!db) return { ok: false, reason: "not configured" };

    await db.from("eng_partner_touches").insert({
      partner_id: partner.id,
      code: partner.code,
      kind: input.kind,
      visitor_key: input.visitorKey,
      landing_path: input.landingPath ?? null,
      referrer: input.referrer ?? null,
    });

    return { ok: true, partnerId: partner.id };
  } catch (err) {
    console.error(`[partner] could not record a touch: ${err instanceof Error ? err.message : "unknown"}`);
    return { ok: false, reason: "the touch could not be recorded" };
  }
}

/**
 * Which partner, if any, a browser currently belongs to.
 *
 * WHY A LEAD IS ATTRIBUTED WITH THE SAME RULE AND NOT A SIMPLER ONE
 * ----------------------------------------------------------------
 * A lead carries no money, so none of the protective machinery around orders
 * applies to it and it would be easy to justify "just take the newest touch".
 * That is exactly how two rules start to disagree. The same function decides
 * both; a lead simply has no purchase history to weigh, which is what
 * firstPaidOrderAtMs of null means.
 *
 * Rule 4 is therefore inactive here by construction rather than by exception,
 * and that is correct: an existing customer sending a contact form is still a
 * lead worth knowing the source of, and nobody is paid for it.
 */
export async function partnerForVisitor(
  visitorKey: string | null | undefined,
): Promise<{ partnerId: string; code: string } | null> {
  if (!visitorKey) return null;

  const db = supabaseAdmin();
  if (!db) return null;

  const { data: rows } = await db
    .from("eng_partner_touches")
    .select("partner_id, code, kind, occurred_at")
    .eq("visitor_key", visitorKey)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (!rows?.length) return null;

  const decision = attribute({
    touches: rows.map((r) => ({
      partnerId: r.partner_id as string,
      code: r.code as string,
      kind: r.kind as Touch["kind"],
      occurredAtMs: Date.parse(r.occurred_at as string),
    })),
    orderAtMs: Date.now(),
    firstPaidOrderAtMs: null,
  });

  return decision.attributed ? { partnerId: decision.partnerId, code: decision.code } : null;
}

/**
 * Attribute an order, once, at the moment it is placed.
 *
 * WHY THIS RUNS AT PLACEMENT AND NOT AT PAYMENT
 * ---------------------------------------------
 * The touches that decide it are the ones that existed when the customer
 * decided to buy. Running it at payment would let a touch that arrived between
 * placing and paying, which is a window of minutes and entirely gameable, take
 * credit for a decision already made.
 *
 * The trigger in 0014 then freezes it the moment the order is paid.
 */
export async function attributeOrder(input: {
  orderId: string;
  reference: string;
  customerEmail: string;
  visitorKey: string | null;
  /** A code typed at checkout, if any. */
  typedCode?: string | null;
  orderAt?: Date;
}): Promise<{ attributed: boolean; partnerId?: string; because: string }> {
  const db = supabaseAdmin();
  if (!db) return { attributed: false, because: "not configured" };

  const orderAtMs = (input.orderAt ?? new Date()).getTime();

  /*
   * A typed code is recorded as a touch before it is judged, so the evidence
   * exists whether or not it wins. A partner told "your code did not win" can
   * be shown that it was received.
   */
  if (input.typedCode && looksLikeCode(input.typedCode)) {
    await recordTouch({
      code: input.typedCode,
      kind: "code",
      visitorKey: input.visitorKey ?? `order:${input.orderId}`,
      landingPath: "checkout",
    });
  }

  const keys = [input.visitorKey, `order:${input.orderId}`].filter(Boolean) as string[];
  const { data: rows } = await db
    .from("eng_partner_touches")
    .select("partner_id, code, kind, occurred_at")
    .in("visitor_key", keys)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const touches: Touch[] = (rows ?? []).map((r) => ({
    partnerId: r.partner_id as string,
    code: r.code as string,
    kind: r.kind as Touch["kind"],
    occurredAtMs: Date.parse(r.occurred_at as string),
  }));

  /*
   * Rule 4 needs to know whether this buyer was already a customer. The
   * question is asked of the EMAIL, which is the only identity a one off
   * customer has, and only of orders that were actually paid: an abandoned
   * checkout is not a relationship.
   */
  const { data: prior } = await db
    .from("eng_service_orders")
    .select("paid_at")
    .eq("customer_email", input.customerEmail.trim().toLowerCase())
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: true })
    .limit(1);

  const firstPaidOrderAtMs = prior?.[0]?.paid_at ? Date.parse(prior[0].paid_at as string) : null;

  const decision = attribute({ touches, orderAtMs, firstPaidOrderAtMs });

  await db
    .from("eng_service_orders")
    .update({
      partner_id: decision.attributed ? decision.partnerId : null,
      partner_code: decision.attributed ? decision.code : null,
      attributed_at: new Date().toISOString(),
      attribution_reason: decision.because,
    })
    .eq("id", input.orderId);

  /*
   * Every partner attributed event lands in the audit trail, including the ones
   * that attributed to nobody. "Why did this order not go to a partner" is the
   * question that gets asked, and an audit trail that only records successes
   * cannot answer it.
   */
  await writeAudit({
    /*
     * The platform acting on its own, exactly as order.placed does. Written the
     * same way rather than a second way, so the trail reads consistently to
     * somebody scanning it for one order.
     */
    actor: { id: null, role: "admin", email: SYSTEM_AUTHOR.email },
    action: decision.attributed ? "partner.attributed" : "partner.not_attributed",
    entityType: "service_order",
    entityId: input.orderId,
    summary: decision.attributed
      ? `${input.reference} attributed to partner ${decision.code}: ${decision.because}`
      : `${input.reference} attributed to no partner: ${decision.because}`,
  });

  return decision.attributed
    ? { attributed: true, partnerId: decision.partnerId, because: decision.because }
    : { attributed: false, because: decision.because };
}
