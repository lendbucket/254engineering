import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import type { RoleKey } from "./ops-authz";
import { enqueue } from "./ops-jobs";
import { effectModeFor } from "./fixture-identity";
import {
  NOTIFICATION_KINDS,
  channelsFor,
  defaultPreference,
  kindsForRole,
  type Channel,
  type NotificationKind,
  type Preference,
} from "./ops-comms";

/**
 * Raising a notification, and getting it out of the building.
 *
 * ONE FUNCTION, CALLED FROM EVERYWHERE
 * ------------------------------------
 * Every event that should tell somebody something goes through raise(). Not
 * because that is tidy, but because the alternative is each feature deciding
 * for itself whether to email, and preferences that are honoured on four
 * screens out of six.
 *
 * IT NEVER THROWS AT ITS CALLER
 * -----------------------------
 * A notification is a side effect of something more important. An offer that
 * was accepted, a package that was submitted, a file that was declined: none of
 * those should fail because an email provider was slow. Failures are recorded
 * on the row and returned, and the caller decides whether it cares. Almost
 * nothing does.
 *
 * WHAT IT WILL NOT DO
 * -------------------
 * Send SMS. The columns exist so a provider is a configuration change rather
 * than a migration, and channelsFor never returns sms while none is wired.
 * Recording an SMS that was never sent would be worse than having none.
 */

export type RaiseInput = {
  profileId: string;
  role: RoleKey;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** The address to email. Looked up when absent. */
  email?: string | null;
};

export type RaiseResult = { ok: boolean; channels: Channel[]; emailError?: string };

/** One person's preferences, defaulted for anything they have never set. */
export async function preferencesFor(profileId: string, role: RoleKey): Promise<Preference[]> {
  const db = supabaseAdmin();
  const applicable = kindsForRole(role);
  if (!db) return applicable.map((k) => defaultPreference(k.kind));

  const { data } = await db
    .from("eng_notification_prefs")
    .select("kind, in_app, email, sms")
    .eq("profile_id", profileId);

  const stored = new Map((data ?? []).map((r) => [r.kind as NotificationKind, r as unknown as Preference]));
  return applicable.map((k) => stored.get(k.kind) ?? defaultPreference(k.kind));
}

async function preferenceFor(profileId: string, kind: NotificationKind): Promise<Preference | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  /* Newest first: a second preference row for one person and kind would be a
   * later change of mind, and that is the one to honour. A discarded error read
   * the pair as "no preference" and fell back to the default, which is the
   * quiet way to send somebody something they turned off. */
  const { data, error } = await db
    .from("eng_notification_prefs")
    .select("kind, in_app, email, sms")
    .eq("profile_id", profileId)
    .eq("kind", kind)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error(`[notify] could not read the preference for ${kind}: ${error.message}`);
    return null;
  }
  return ((data ?? [])[0] as unknown as Preference) ?? null;
}

export async function raise(input: RaiseInput): Promise<RaiseResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, channels: [] };

  const preference = await preferenceFor(input.profileId, input.kind);
  const channels = channelsFor(input.kind, input.role, preference);

  /*
   * A kind this role never receives produces nothing at all, and no row. The
   * alternative is a notification centre full of things that were never
   * relevant, which is how people stop reading it.
   */
  if (channels.length === 0) return { ok: true, channels: [] };

  const { data, error } = await db
    .from("eng_notifications")
    .insert({
      profile_id: input.profileId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      channels,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, channels };

  if (!channels.includes("email")) return { ok: true, channels };

  /*
   * THE ROW IS WRITTEN, THE EMAIL IS QUEUED.
   *
   * The insert above already happened, so the bell is correct the moment this
   * request returns. What leaves is the send, because it talks to Resend and
   * nobody raising a notification should wait on a mail provider.
   *
   * The queue is not allowed to turn a raised notification into a failure: an
   * enqueue that could not be written is recorded on the row and reported, and
   * the notification itself still stands. That is the same shape as the old
   * email_error, which is deliberate, because the operator reads that column.
   */
  /*
   * THE ACTOR DECIDES THE MODE HERE TOO, AND THIS GAP WAS FOUND ON A BOARD.
   *
   * queueEmail derives the mode from the message it is handed. This path has
   * no message: it queues an id and the handler resolves the address later. So
   * every notification raised for a probe account was enqueued marked live,
   * and queue-audit REFUSED TO START over one of them on the very next board.
   *
   * The run time backstop in the handler would have stopped the send, because
   * a probe lives at audit-probe.invalid. That is not enough: a row that says
   * it may reach outside is a row every worker and every audit has to reason
   * about, and the whole point of putting the permission ON THE ROW was to
   * stop that reasoning being necessary.
   *
   * One extra read, on a path that has already written its row and is only
   * queueing the email. The recipient is looked up rather than passed in
   * because the caller has a profile id and no address, and asking the caller
   * to fetch one would be a rule somebody has to remember.
   */
  const { data: recipient } = await db
    .from("eng_profiles")
    .select("email")
    .eq("id", input.profileId)
    .maybeSingle();

  const queued = await enqueue(
    "notification.deliver",
    { notificationId: data.id },
    { effectMode: effectModeFor((recipient?.email as string) ?? null) },
  );

  if (!queued.ok) {
    await db
      .from("eng_notifications")
      .update({ email_error: `The email could not be queued: ${queued.error}` })
      .eq("id", data.id);
    return { ok: true, channels, emailError: queued.error };
  }

  return { ok: true, channels };
}

/** Raise the same notification for several people, without stopping on one failure. */
export async function raiseAll(inputs: RaiseInput[]): Promise<void> {
  for (const input of inputs) {
    await raise(input).catch(() => undefined);
  }
}

// ------------------------------------------------------------- the centre

export type NotificationRow = {
  id: number;
  created_at: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  emailed_at: string | null;
  email_error: string | null;
};

export async function listNotifications(profileId: string, limit = 50): Promise<NotificationRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_notifications")
    .select("id, created_at, kind, title, body, href, read_at, emailed_at, email_error")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

export async function unreadCount(profileId: string): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;
  const { count } = await db
    .from("eng_notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);
  return count ?? 0;
}

export async function markRead(profileId: string, ids: number[]): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  const now = new Date().toISOString();
  let query = db.from("eng_notifications").update({ read_at: DB_NOW }).eq("profile_id", profileId).is("read_at", null);
  if (ids.length) query = query.in("id", ids);
  await query;
}

/**
 * Save a preference.
 *
 * A mandatory kind is written with email true whatever the request said. The
 * screen renders it as fixed and the API refuses to store otherwise, so the two
 * cannot disagree: a toggle that appears to save and then does nothing is worse
 * than one that is visibly not there.
 */
export async function savePreference(
  profileId: string,
  kind: NotificationKind,
  wants: { email: boolean; sms: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const spec = NOTIFICATION_KINDS.find((k) => k.kind === kind);
  if (!spec) return { ok: false, error: "Unknown notification kind." };

  const { error } = await db.from("eng_notification_prefs").upsert(
    {
      profile_id: profileId,
      kind,
      in_app: true,
      email: spec.mandatoryEmail ? true : wants.email,
      sms: wants.sms,
    },
    { onConflict: "profile_id,kind" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}
