import "server-only";
import { supabaseAdmin, supabaseConfigured } from "./supabase";
import { checklistFor, type OnboardingRole } from "@/content/onboarding-checklists";
import { generateInvite, hashToken, isExpired, looksLikeToken } from "./onboarding-tokens";

/**
 * Reading and writing onboardings.
 *
 * Every function here runs through the service role client, which is the only
 * thing that can see these tables at all: RLS is on with zero policies, so anon
 * and authenticated read nothing. `import "server-only"` makes a client
 * component that reaches for this file a build error rather than a leak.
 *
 * WHAT THIS FILE WILL NOT DO
 * --------------------------
 * There is no function that returns a plaintext invite token for an existing
 * onboarding, because the database does not hold one. `createOnboarding` and
 * `regenerateInvite` return a token exactly once, to their caller, and after
 * that the only way to get a working link is to issue a new one. A "resend the
 * same link" feature would require storing the token, which is the thing the
 * whole design avoids.
 *
 * WRITE FAILURES RETURN, THEY DO NOT THROW
 * ----------------------------------------
 * Same convention as src/lib/intake.ts. A caller decides what an error means,
 * because the right answer differs: a failed item save should tell the person
 * plainly and let them retry, while a failed status update on an already saved
 * document should not lose their work.
 */

const SITE_KEY = "254";

export type OnboardingStatus = "invited" | "in_progress" | "submitted" | "verified" | "complete";
export type ItemStatus = "pending" | "uploaded" | "accepted" | "rejected";

export type OnboardingRow = {
  id: string;
  created_at: string;
  site: string;
  person_name: string;
  email: string;
  phone: string | null;
  role: OnboardingRole;
  status: OnboardingStatus;
  invited_at: string;
  invite_expires_at: string;
  submitted_at: string | null;
  verified_at: string | null;
  notes: string | null;
};

export type OnboardingItemRow = {
  id: string;
  onboarding_id: string;
  item_key: string;
  label: string;
  status: ItemStatus;
  storage_key: string | null;
  rejected_reason: string | null;
  actor: "person" | "admin";
  sort_order: number;
  updated_at: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const NOT_CONFIGURED = "The database is not configured on this deployment.";

/**
 * Create an onboarding and seed its checklist.
 *
 * The checklist is COPIED from src/content/onboarding-checklists.ts into rows at
 * creation time rather than read live. A hire is asked for what the checklist
 * said on the day they were invited, and editing the file later does not
 * retroactively change somebody's half finished onboarding into a different one.
 */
export async function createOnboarding(input: {
  personName: string;
  email: string;
  phone?: string;
  role: OnboardingRole;
  site?: string;
  notes?: string;
}): Promise<Result<{ onboarding: OnboardingRow; token: string }>> {
  if (!supabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const invite = generateInvite();
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await db
    .from("eng_onboardings")
    .insert({
      site: input.site ?? SITE_KEY,
      person_name: input.personName,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
      status: "invited",
      invite_token_hash: invite.tokenHash,
      invite_expires_at: invite.expiresAt.toISOString(),
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "The onboarding could not be created." };
  }

  const onboarding = data as OnboardingRow;
  const items = checklistFor(input.role).map((item, i) => ({
    onboarding_id: onboarding.id,
    item_key: item.key,
    label: item.label,
    status: "pending" as const,
    actor: item.actor,
    sort_order: i,
  }));

  const { error: itemsError } = await db.from("eng_onboarding_items").insert(items);
  if (itemsError) {
    // The parent row exists with no checklist, which is a half built record the
    // admin would have to reason about. Remove it so creation is all or nothing.
    await db.from("eng_onboardings").delete().eq("id", onboarding.id);
    return { ok: false, error: itemsError.message };
  }

  return { ok: true, data: { onboarding, token: invite.token } };
}

/**
 * Find an onboarding by the token in a URL.
 *
 * Returns null for every failure mode without distinguishing them: malformed,
 * unknown, and expired all look identical to the caller, so a route cannot
 * accidentally render a different status code for a token that exists but has
 * aged out. The route 404s on null.
 *
 * Expiry is checked here rather than in SQL so the comparison happens against
 * the application's clock in one place.
 */
export async function findByToken(token: string): Promise<OnboardingRow | null> {
  if (!supabaseConfigured()) return null;
  if (!looksLikeToken(token)) return null;

  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("eng_onboardings")
    .select()
    .eq("invite_token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;
  const row = data as OnboardingRow;
  if (isExpired(row.invite_expires_at)) return null;
  return row;
}

/** Does a token match a row that exists but has aged out? Used only to offer a new link. */
export async function isExpiredToken(token: string): Promise<boolean> {
  if (!supabaseConfigured() || !looksLikeToken(token)) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const { data } = await db
    .from("eng_onboardings")
    .select("invite_expires_at")
    .eq("invite_token_hash", hashToken(token))
    .maybeSingle();
  return Boolean(data && isExpired((data as { invite_expires_at: string }).invite_expires_at));
}

export async function itemsFor(onboardingId: string): Promise<OnboardingItemRow[]> {
  if (!supabaseConfigured()) return [];
  const db = supabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("eng_onboarding_items")
    .select()
    .eq("onboarding_id", onboardingId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as OnboardingItemRow[];
}

/** Record a completed upload against one item. */
export async function markItemUploaded(params: {
  onboardingId: string;
  itemKey: string;
  storageKey: string;
}): Promise<Result<null>> {
  if (!supabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await db
    .from("eng_onboarding_items")
    .update({
      status: "uploaded",
      storage_key: params.storageKey,
      // A re-upload clears a previous rejection: the reason no longer describes
      // the file that is there now.
      rejected_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("onboarding_id", params.onboardingId)
    .eq("item_key", params.itemKey);

  if (error) return { ok: false, error: error.message };
  await touchInProgress(params.onboardingId);
  return { ok: true, data: null };
}

/** An acknowledge-only item, completed without a file. */
export async function markItemAcknowledged(params: {
  onboardingId: string;
  itemKey: string;
}): Promise<Result<null>> {
  if (!supabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await db
    .from("eng_onboarding_items")
    .update({ status: "uploaded", rejected_reason: null, updated_at: new Date().toISOString() })
    .eq("onboarding_id", params.onboardingId)
    .eq("item_key", params.itemKey);
  if (error) return { ok: false, error: error.message };
  await touchInProgress(params.onboardingId);
  return { ok: true, data: null };
}

/** Admin decision on one item. A rejection reopens it for the person. */
export async function setItemDecision(params: {
  onboardingId: string;
  itemKey: string;
  decision: "accepted" | "rejected";
  reason?: string;
}): Promise<Result<null>> {
  if (!supabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await db
    .from("eng_onboarding_items")
    .update({
      status: params.decision,
      rejected_reason: params.decision === "rejected" ? (params.reason ?? null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("onboarding_id", params.onboardingId)
    .eq("item_key", params.itemKey);
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}

export async function setStatus(
  onboardingId: string,
  status: OnboardingStatus,
): Promise<Result<null>> {
  if (!supabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const stamp =
    status === "submitted"
      ? { submitted_at: new Date().toISOString() }
      : status === "verified"
        ? { verified_at: new Date().toISOString() }
        : {};
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await db
    .from("eng_onboardings")
    .update({ status, ...stamp })
    .eq("id", onboardingId);
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}

/**
 * Issue a fresh invite for an existing onboarding.
 *
 * The old hash is overwritten, so the previous link stops working the moment a
 * new one is generated. That is the intended behaviour for a credential: two
 * live links to the same identity documents is one more than anybody needs.
 */
export async function regenerateInvite(onboardingId: string): Promise<Result<{ token: string }>> {
  if (!supabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const invite = generateInvite();
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await db
    .from("eng_onboardings")
    .update({
      invite_token_hash: invite.tokenHash,
      invite_expires_at: invite.expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    })
    .eq("id", onboardingId);
  return error ? { ok: false, error: error.message } : { ok: true, data: { token: invite.token } };
}

export async function listOnboardings(): Promise<OnboardingRow[]> {
  if (!supabaseConfigured()) return [];
  const db = supabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("eng_onboardings")
    .select()
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as OnboardingRow[];
}

export async function getOnboarding(id: string): Promise<OnboardingRow | null> {
  if (!supabaseConfigured()) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("eng_onboardings").select().eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as OnboardingRow;
}

/** Move `invited` to `in_progress` on the first sign of activity. Never moves it back. */
async function touchInProgress(onboardingId: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  await db
    .from("eng_onboardings")
    .update({ status: "in_progress" })
    .eq("id", onboardingId)
    .eq("status", "invited");
}
