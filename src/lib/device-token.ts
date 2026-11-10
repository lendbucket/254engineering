import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { readSessionEpoch } from "./session-epoch";
import { issueOpsSession } from "./ops-session";
import { writeAudit, writeAuditOrRefuse } from "./ops-audit";
import {
  SIGNED_OUT,
  exchangeVerdict,
  hashDeviceToken,
  knownPlatform,
  mayHoldDeviceToken,
  mintDeviceToken,
  wellFormedDeviceToken,
  type DevicePlatform,
} from "./device-token-rules";

/**
 * Issue, exchange and revoke the store app's sign in token (0125). The rules
 * are in device-token-rules.ts; this file is the reads and writes around them.
 *
 * EVERY TIME IS THE DATABASE'S. A token's life is 0125's default, now() plus
 * thirty days, and whether it is still live is asked of the database in the
 * same query that finds it, so the application's clock decides nothing.
 */

type Context = { ip: string | null; userAgent: string | null };
type Who = { id: string; role: string; email: string };

/**
 * Make a token for the phone this full session is on. The issue is audited
 * BEFORE the row is written, through writeAuditOrRefuse: a credential nobody
 * can show was handed out is one that is not handed out.
 */
export async function issueDeviceToken(
  who: Who,
  platform: unknown,
  context: Context,
): Promise<{ ok: true; token: string } | { ok: false; status: number; error: string }> {
  if (!mayHoldDeviceToken(who.role)) return { ok: false, status: 403, error: "Only a field technician signs in on the store app." };
  if (!knownPlatform(platform)) return { ok: false, status: 400, error: "The app did not say which phone this is." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, status: 503, error: "The portal is not configured." };
  const epoch = await readSessionEpoch(db, "eng_profiles", who.id);
  if (!epoch.ok) return { ok: false, status: 503, error: epoch.error };

  const token = mintDeviceToken();
  const hash = hashDeviceToken(token);
  const audited = await writeAuditOrRefuse({
    actor: who,
    action: "auth.device_token_issued",
    entityType: "profile",
    entityId: who.id,
    summary: `A sign in was kept on a ${platform === "ios" ? "iPhone" : "Android phone"} in the store app`,
    diff: { platform, token_hash_prefix: hash.slice(0, 12) },
    ip: context.ip,
    userAgent: context.userAgent,
  });
  if (!audited.ok) return { ok: false, status: 503, error: "The phone's sign in could not be recorded, so it was not kept." };

  const { error } = await db.from("eng_device_sessions").insert({
    profile_id: who.id,
    platform: platform as DevicePlatform,
    token_hash: hash,
    epoch_at_issue: epoch.epoch,
  });
  if (error) return { ok: false, status: 503, error: `The phone's sign in could not be kept: ${error.message}` };
  return { ok: true, token };
}

/**
 * Turn a presented token into a fresh full session, or refuse it and say
 * nothing about why to the caller. The reason goes to the audit trail, and a
 * token that has died for good is stamped revoked so it is never asked about
 * again.
 */
export async function exchangeDeviceToken(
  presented: unknown,
  context: Context,
): Promise<
  | { ok: true; cookie: { value: string; expiresAt: Date }; profileId: string }
  | { ok: false; status: number; error: string }
> {
  const refused = { ok: false as const, status: 401, error: "Sign in again." };
  if (!wellFormedDeviceToken(presented)) return refused;
  const db = supabaseAdmin();
  if (!db) return { ok: false, status: 503, error: "The portal is not configured." };
  const hash = hashDeviceToken(presented);

  const found = await db
    .from("eng_device_sessions")
    .select("id, profile_id, revoked_at, epoch_at_issue, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (found.error) return { ok: false, status: 503, error: "Your sign in could not be checked just now. Try again in a moment." };
  const row = found.data as { id: string; profile_id: string; revoked_at: string | null; epoch_at_issue: unknown } | null;

  /* Live is the database's answer: the same row, asked again with expires_at after its now(). */
  let live = false;
  if (row) {
    const still = await db.from("eng_device_sessions").select("id").eq("id", row.id).gt("expires_at", DB_NOW).maybeSingle();
    if (still.error) return { ok: false, status: 503, error: "Your sign in could not be checked just now. Try again in a moment." };
    live = Boolean(still.data);
  }

  let profile: { id: string; email: string; display_name: string; role: string; status: string; session_epoch: unknown } | null = null;
  if (row) {
    const p = await db
      .from("eng_profiles")
      .select("id, email, display_name, role, status, session_epoch")
      .eq("id", row.profile_id)
      .maybeSingle();
    if (p.error) return { ok: false, status: 503, error: "Your account could not be checked just now. Try again in a moment." };
    profile = p.data as typeof profile;
  }

  const verdict = exchangeVerdict(row ? { revoked_at: row.revoked_at, live, epoch_at_issue: row.epoch_at_issue } : null, profile);
  if (!verdict.ok) {
    if (row && verdict.revoke) {
      await db
        .from("eng_device_sessions")
        .update({ revoked_at: DB_NOW, revoked_reason: verdict.revoke })
        .eq("id", row.id)
        .is("revoked_at", null);
    }
    await writeAudit({
      actor: null,
      action: "auth.device_token_refused",
      entityType: "session",
      entityId: row?.profile_id ?? hash.slice(0, 12),
      summary: `A phone's kept sign in was refused (${verdict.why})`,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return refused;
  }

  const cookie = issueOpsSession(profile!.id, profile!.role, "full", Date.now(), verdict.epoch);
  if (!cookie) return { ok: false, status: 503, error: "The portal is not configured." };
  await db.from("eng_device_sessions").update({ last_used_at: DB_NOW }).eq("id", row!.id);
  await db.from("eng_profiles").update({ last_sign_in_at: DB_NOW }).eq("id", profile!.id);
  await writeAudit({
    actor: { id: profile!.id, role: profile!.role, email: profile!.email },
    action: "auth.device_token_exchanged",
    entityType: "session",
    entityId: profile!.id,
    summary: `${profile!.display_name} was signed in again by the phone's kept sign in`,
    ip: context.ip,
    userAgent: context.userAgent,
  });
  return { ok: true, cookie, profileId: profile!.id };
}

/**
 * Sign out on this phone: the token stops working for good. Holding the token
 * is the authority to revoke it, so this needs no session, which matters
 * because the session has usually ended by the time somebody signs out of an
 * app they opened this morning. It answers the same whether or not the token
 * matched anything, so it tells a stranger nothing.
 */
export async function revokeDeviceToken(presented: unknown, context: Context): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!wellFormedDeviceToken(presented)) return { ok: true };
  const db = supabaseAdmin();
  if (!db) return { ok: false, status: 503, error: "The portal is not configured." };
  const hash = hashDeviceToken(presented);
  const { data, error } = await db
    .from("eng_device_sessions")
    .update({ revoked_at: DB_NOW, revoked_reason: SIGNED_OUT })
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .select("profile_id");
  if (error) return { ok: false, status: 503, error: "The phone's sign in could not be ended just now. Try again." };
  const ended = (data ?? []) as { profile_id: string }[];
  if (ended.length) {
    await writeAudit({
      actor: null,
      action: "auth.device_token_revoked",
      entityType: "profile",
      entityId: ended[0]!.profile_id,
      summary: "A phone's kept sign in was ended by signing out on it",
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }
  return { ok: true };
}
