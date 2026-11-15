import "server-only";
import { supabaseAdmin } from "./supabase";
import { DB_NOW } from "./db-now";
import { queueEmail } from "./ops-jobs";
import { priceEmail } from "./email-templates";
import { isSuppressed, unsubscribeUrl } from "./marketing-suppression";
import { captureError } from "./ops-observability";
import { letterBySlug, priceEmailDueAt, quoteFor, type Coastal } from "./start-finder";
import { lineOffer } from "./ordering";
import { money } from "@/config/prices";
import { business } from "@/config/business";

/**
 * ===========================================================================
 * "EMAIL ME THE PRICE": THREE EMAILS, STOPPED BY AN ORDER. Robert's add-on of
 * 2026-11-15, item 14, and his answer 1 of 13:11 Central.
 * ===========================================================================
 *
 * The first goes when the request is saved (startPriceEmails); the second and
 * third are sent by the jobs cron, every minute, when they fall due
 * (sweepDuePriceEmails). Before EVERY send, three things are asked, and any one
 * of them stops the sequence for good, recorded on the lead with its reason:
 *
 *   1. Has this address placed an order since it asked? Then it ordered, and
 *      a reminder to order is the wrong email. "ordered"
 *   2. Is it on the marketing suppression list? isSuppressed fails closed, so
 *      a list that cannot be read counts as suppressed. "suppressed"
 *   3. Has the lead been stopped already, or have all three gone? "complete"
 *
 * THE PRICE IS THE ONE THE FINDER SHOWED, read back from the lead's own row
 * (quoted_cents, written by the server from the price book when the request
 * was saved), never from anything a browser sends later.
 *
 * Each step is claimed by a conditional update on follow_up_step before the
 * email is queued, so two workers can never send the same step twice.
 * Proved by scripts/proofs/the-price-emails-stop-when-the-person-orders.mjs.
 */

type LeadForEmail = {
  id: string;
  email: string | null;
  created_at: string;
  quoted_service: string | null;
  quoted_cents: number | null;
  quoted_coastal: Coastal | null;
  follow_up_step: number;
  follow_up_stopped_at: string | null;
};

const SELECT = "id, email, created_at, quoted_service, quoted_cents, quoted_coastal, follow_up_step, follow_up_stopped_at";

/** Why a sequence stops, or null when it may go on. Pure over what was read, so the proof can drive it. */
export function stopReason(input: { ordered: boolean; suppressed: boolean; step: number; stopped: boolean }): string | null {
  if (input.stopped) return "complete";
  if (input.ordered) return "ordered";
  if (input.suppressed) return "suppressed";
  if (input.step >= 3) return "complete";
  return null;
}

async function orderedSince(email: string, since: string): Promise<boolean | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { count, error } = await db
    .from("eng_service_orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_email", email.trim().toLowerCase())
    .gte("created_at", since)
    .neq("status", "draft");
  return error ? null : (count ?? 0) > 0;
}

async function stop(id: string, why: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db
    .from("eng_leads")
    .update({ follow_up_stopped_at: DB_NOW, follow_up_stopped_why: why, follow_up_next_at: null })
    .eq("id", id)
    .is("follow_up_stopped_at", null);
}

const askedOn = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric" }).format(new Date(iso));

/** Send the next step of one lead's sequence, if it may go. Returns the step sent, or null. */
async function sendNext(lead: LeadForEmail): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db || !lead.email) return null;
  const step = (lead.follow_up_step + 1) as 1 | 2 | 3;

  const ordered = await orderedSince(lead.email, lead.created_at);
  /* An order check that could not be answered stops nothing and sends nothing: it is asked again on the next run. */
  if (ordered === null) return null;
  const why = stopReason({ ordered, suppressed: await isSuppressed(lead.email), step: lead.follow_up_step, stopped: Boolean(lead.follow_up_stopped_at) });
  if (why) {
    await stop(lead.id, why);
    return null;
  }

  const letter = letterBySlug(lead.quoted_service);
  if (!letter || lead.quoted_cents === null) {
    await stop(lead.id, "no quote on the lead");
    return null;
  }
  const quote = quoteFor(letter, lead.quoted_coastal);
  const coastalNote =
    quote.kind === "fixed" && lead.quoted_coastal === "unsure" && quote.unsureCents !== null
      ? `If the property is in one of the 14 first tier coastal counties, it is ${money(quote.unsureCents)}.`
      : null;
  const unsubscribe = unsubscribeUrl(lead.email);
  if (!unsubscribe) {
    await stop(lead.id, "no unsubscribe link could be made");
    return null;
  }
  const offer = lineOffer(letter.slug);
  const orderUrl = offer.href.startsWith("http") ? offer.href : `${business.url}${offer.href}`;

  /* The claim: only the worker whose update moves this exact step sends it. */
  const next = step < 3 ? priceEmailDueAt(new Date(lead.created_at), (step + 1) as 2 | 3).toISOString() : null;
  const { data: claimed, error: claimError } = await db
    .from("eng_leads")
    .update({
      follow_up_step: step,
      follow_up_next_at: next,
      ...(step === 3 ? { follow_up_stopped_at: DB_NOW, follow_up_stopped_why: "complete" } : {}),
    })
    .eq("id", lead.id)
    .eq("follow_up_step", lead.follow_up_step)
    .is("follow_up_stopped_at", null)
    .select("id");
  if (claimError || !claimed || claimed.length !== 1) return null;

  const queued = await queueEmail(
    priceEmail({
      step,
      to: lead.email,
      letterName: letter.name,
      priceLine: money(lead.quoted_cents),
      coastalNote,
      orderUrl,
      askedOn: askedOn(lead.created_at),
      unsubscribeUrl: unsubscribe,
    }),
  );
  if (!queued.ok) await captureError(new Error(`A price email was not queued: ${queued.error}`), { kind: "price-emails" });
  return queued.ok ? step : null;
}

/** The first email, at once, for a lead the /start route has just saved. */
export async function startPriceEmails(leadId: string): Promise<{ sent: boolean; why?: string }> {
  const db = supabaseAdmin();
  if (!db) return { sent: false, why: "the database is not configured" };
  const { data, error } = await db.from("eng_leads").select(SELECT).eq("id", leadId).maybeSingle();
  if (error || !data) return { sent: false, why: error?.message ?? "the lead could not be read" };
  const sent = await sendNext(data as LeadForEmail);
  return sent ? { sent: true } : { sent: false, why: "stopped before the first email" };
}

/** The second and third emails, as they fall due. Called by the jobs cron; it cannot fail the worker. */
export async function sweepDuePriceEmails(now: number = Date.now()): Promise<{ looked: boolean; sent: number; note: string }> {
  try {
    const db = supabaseAdmin();
    if (!db) return { looked: false, sent: 0, note: "the database is not configured" };
    const { data, error } = await db
      .from("eng_leads")
      .select(SELECT)
      .eq("form", "email_price")
      .is("follow_up_stopped_at", null)
      .not("follow_up_next_at", "is", null)
      .lte("follow_up_next_at", new Date(now).toISOString())
      .order("follow_up_next_at", { ascending: true })
      .limit(50);
    if (error) return { looked: false, sent: 0, note: `the read failed: ${error.message}` };
    let sent = 0;
    for (const lead of (data ?? []) as LeadForEmail[]) if (await sendNext(lead)) sent += 1;
    return { looked: true, sent, note: `${sent} price email(s) queued` };
  } catch (err) {
    await captureError(err, { kind: "price-emails", route: "/api/cron/jobs" });
    return { looked: false, sent: 0, note: "the sweep threw" };
  }
}
