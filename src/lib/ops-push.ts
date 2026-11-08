import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAudit } from "./ops-audit";
import { services } from "../content/services";
import { endpointFitsChannel, offerPushText, pushChannelFrom, subscriptionGone, type PushChannel } from "./offer-push-rules";
import { sendEmptyPush, vapidConfig } from "./web-push";
import { sendApns, sendFirebase } from "./native-push";
import { DB_NOW } from "./db-now";

/**
 * A PHONE HEARS OF AN OFFER. Robert's T9 and his answers 6 and 7 of 2026-11-07
 * (6717223376). The rules are in offer-push-rules.ts and the signature in
 * web-push.ts; this file is the database half: a phone's subscription, the
 * push when an offer is made, and the wording the phone asks for when one
 * arrives.
 *
 * Push sits BESIDE the offer's existing notification, never in place of it:
 * the in-app list and the email (on by default) go out exactly as before, and
 * a push that fails changes nothing about either. Email stays on until push is
 * proven on Robert's own phone (answer 6).
 */

type Ctx = { ip?: string | null; userAgent?: string | null };

/** Whether this person may have offer alerts: the technician's own grants. */
function mayHearOfOffers(actor: Actor | null): actor is Actor {
  return Boolean(actor && can(actor, "offers.list_own") && can(actor, "offers.respond"));
}

/** The public key a phone subscribes with, or null when push is not configured on this deployment. */
export function pushPublicKey(): string | null {
  return vapidConfig()?.publicKey ?? null;
}

/**
 * Record this phone for this person. One row per endpoint: a phone handed to
 * somebody else moves to them. The channel says which push service the
 * endpoint belongs to: a browser's (web), or the store app's Firebase (fcm) or
 * Apple (apns) token (Robert's T8, 2026-11-08).
 */
export async function subscribePush(
  actor: (Actor & { email: string }) | null,
  endpoint: unknown,
  userAgent: string | null,
  context: Ctx = {},
  channelValue: unknown = "web",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!mayHearOfOffers(actor)) return { ok: false, error: "Offer alerts are for a technician's own offers." };
  const channel = pushChannelFrom(channelValue);
  if (!channel) return { ok: false, error: "That push service is not one this firm uses." };
  if (channel === "web" && !pushPublicKey()) return { ok: false, error: "Offer alerts are not switched on for the firm yet. Email still tells you of every offer." };
  if (!endpointFitsChannel(channel, endpoint)) return { ok: false, error: "This phone's push address could not be read. Try again." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { error } = await db.from("eng_push_subscriptions").upsert(
    {
      endpoint,
      channel,
      profile_id: actor.id,
      user_agent: userAgent ? userAgent.slice(0, 300) : null,
      revoked_at: null,
      revoked_reason: null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: `Offer alerts were not turned on: ${error.message}` };
  await writeAudit({ actor, action: "push.subscribed", entityType: "profile", entityId: actor.id, summary: "Turned on offer alerts on a phone.", ...context });
  return { ok: true };
}

/** Turn alerts off for this phone. Stamped, not deleted. Only the person it belongs to. */
export async function unsubscribePush(
  actor: (Actor & { email: string }) | null,
  endpoint: unknown,
  context: Ctx = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor) return { ok: false, error: "Not signed in." };
  if (!endpointFitsChannel("web", endpoint) && !endpointFitsChannel("fcm", endpoint)) {
    return { ok: false, error: "This phone's push address could not be read." };
  }
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { error } = await db
    .from("eng_push_subscriptions")
    .update({ revoked_at: DB_NOW, revoked_reason: "turned off by its owner" })
    .eq("endpoint", endpoint)
    .eq("profile_id", actor.id)
    .is("revoked_at", null);
  if (error) return { ok: false, error: `Offer alerts were not turned off: ${error.message}` };
  await writeAudit({ actor, action: "push.unsubscribed", entityType: "profile", entityId: actor.id, summary: "Turned off offer alerts on a phone.", ...context });
  return { ok: true };
}

/**
 * Push to every live phone of one technician that an offer is waiting. Best
 * effort and quiet: the offer's own notification has already gone, and a push
 * service that is down changes nothing about the offer. A phone the push
 * service has forgotten is stamped revoked and never sent to again.
 */
export async function pushOfferTo(
  techId: string,
  /* The offer's own county and service, for the store app's native pushes, which carry their text (Robert's T8). */
  offer: { county: string | null; serviceName: string | null } = { county: null, serviceName: null },
): Promise<{ sent: number; gone: number; failed: number }> {
  const out = { sent: 0, gone: 0, failed: 0 };
  const config = vapidConfig();
  const db = supabaseAdmin();
  if (!db) return out;
  const { data: subs, error } = await db
    .from("eng_push_subscriptions")
    .select("id, endpoint, channel")
    .eq("profile_id", techId)
    .is("revoked_at", null)
    .limit(20);
  if (error || !subs) return out;
  /* County and service only, the one wording every channel shows (answer 7). */
  const text = offerPushText(offer.county, offer.serviceName);
  for (const sub of subs) {
    const channel = (sub.channel as PushChannel | null) ?? "web";
    let status: number | null = null;
    let gone = false;
    if (channel === "web") {
      if (!config) continue;
      status = await sendEmptyPush(sub.endpoint as string, config);
      gone = status !== null && subscriptionGone(status);
    } else {
      const sent = channel === "fcm" ? await sendFirebase(sub.endpoint as string, text) : await sendApns(sub.endpoint as string, text);
      status = sent.status;
      gone = sent.gone;
    }
    if (status !== null && status >= 200 && status < 300) {
      out.sent += 1;
      await db.from("eng_push_subscriptions").update({ last_success_at: DB_NOW }).eq("id", sub.id);
    } else if (status !== null && gone) {
      out.gone += 1;
      await db
        .from("eng_push_subscriptions")
        .update({ revoked_at: DB_NOW, revoked_reason: `the push service answered ${status}` })
        .eq("id", sub.id)
        .is("revoked_at", null);
    } else {
      out.failed += 1;
    }
  }
  return out;
}

/**
 * What the lock screen says, asked by the phone's service worker when a push
 * arrives. The newest offer still open to this technician: its county and its
 * service, through offerPushText, and nothing else. No address, no fee, and
 * nothing about anybody else's offers.
 */
export async function latestOfferPushFor(actor: Actor | null): Promise<{ title: string; body: string } | null> {
  if (!mayHearOfOffers(actor)) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data: offer, error } = await db
    .from("eng_assignments")
    .select("file_id, offered_at")
    .eq("tech_id", actor.id)
    .eq("state", "offered")
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (!offer) return offerPushText(null, null);
  const { data: file } = await db.from("eng_files").select("county, service_slug").eq("id", offer.file_id).maybeSingle();
  const serviceName = file ? (services.find((s) => s.slug === file.service_slug)?.name ?? null) : null;
  return offerPushText((file?.county as string | null) ?? null, serviceName);
}
