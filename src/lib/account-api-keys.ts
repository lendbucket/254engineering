import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import type { CustomerPrincipal } from "./customer-auth";

/**
 * Keys for the ordering API.
 *
 * THE ACCOUNT COMES FROM THE KEY, NEVER FROM THE REQUEST
 * ------------------------------------------------------
 * This is the whole security model in one sentence, and it is the same rule
 * /api/order-flow follows for the site and the bulk endpoint follows for the
 * session. A key belongs to one organisation, and the route reads the
 * organisation off the key. There is no field in which a caller could ask to
 * order for somebody else, so the answer is not "we check", it is "there is
 * nothing to check".
 *
 * STORED HASHED, SHOWN ONCE
 * -------------------------
 * Only the SHA-256 is kept, as eng_auth_tokens and eng_customer_access already
 * do, so a database disclosure is not a set of working keys. The plaintext is
 * returned exactly once, at creation, and the platform cannot show it again.
 * The prefix is stored so a key can be identified in a list without being
 * revealed.
 *
 * THE RATE LIMIT IS IN THE DATABASE, AND THAT IS NOT AN OPTIMISATION CHOICE
 * ------------------------------------------------------------------------
 * See migration 0010. A limiter in process memory would be enforced per function
 * instance, so the real ceiling would be the limit times however many instances
 * happened to be warm. That is not a limit.
 */

const PREFIX = "eng_live_";
const KEY_BYTES = 24;

/** Requests per minute when a key does not name its own. Not unlimited. */
export const DEFAULT_RATE_LIMIT = 60;

export type VerifiedKey = {
  keyId: string;
  accountId: string;
  rateLimitPerMinute: number;
};

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Mint a key. The plaintext is returned once and never stored.
 *
 * Owner only, for the same reason the standing access instructions are: a key
 * can place orders that the organisation pays for.
 */
export async function issueApiKey(
  me: CustomerPrincipal,
  label: string,
  rateLimitPerMinute?: number,
): Promise<{ ok: true; key: string; prefix: string; id: string } | { ok: false; error: string }> {
  if (me.accountRole !== "owner") {
    return { ok: false, error: "Only an account owner can create an API key." };
  }
  if (!label.trim()) {
    return { ok: false, error: "Give the key a label so it can be told apart later." };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  const secret = randomBytes(KEY_BYTES).toString("base64url");
  const key = `${PREFIX}${secret}`;
  const prefix = key.slice(0, PREFIX.length + 6);

  const { data, error } = await db
    .from("eng_account_api_keys")
    .insert({
      account_id: me.accountId,
      label: label.trim(),
      prefix,
      key_hash: hashKey(key),
      rate_limit_per_minute: rateLimitPerMinute ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "The key could not be created." };

  await writeAudit({
    actor: { id: null, role: "customer" as never, email: me.email },
    action: "account.api_key_created",
    entityType: "customer_account",
    entityId: me.accountId,
    summary: `${me.displayName} created API key ${prefix} (${label.trim()})`,
  });

  return { ok: true, key, prefix, id: data.id as string };
}

export async function revokeApiKey(
  me: CustomerPrincipal,
  keyId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (me.accountRole !== "owner") {
    return { ok: false, error: "Only an account owner can revoke an API key." };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  const { data } = await db
    .from("eng_account_api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason ?? null })
    .eq("id", keyId)
    .eq("account_id", me.accountId)
    .is("revoked_at", null)
    .select("id, prefix");

  if (!data || data.length === 0) {
    return { ok: false, error: "That key is not on this account, or is already revoked." };
  }

  await writeAudit({
    actor: { id: null, role: "customer" as never, email: me.email },
    action: "account.api_key_revoked",
    entityType: "customer_account",
    entityId: me.accountId,
    summary: `${me.displayName} revoked API key ${data[0].prefix}`,
  });

  return { ok: true };
}

export async function listApiKeys(accountId: string) {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_account_api_keys")
    .select("id, label, prefix, rate_limit_per_minute, last_used_at, revoked_at, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * Verify a presented key.
 *
 * Looked up by HASH, so the plaintext never has to be compared against anything
 * in a query, and a revoked key is refused by the same query rather than by a
 * separate check somebody could forget.
 */
export async function verifyApiKey(presented: string | null): Promise<VerifiedKey | null> {
  if (!presented || !presented.startsWith(PREFIX)) return null;

  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("eng_account_api_keys")
    .select("id, account_id, rate_limit_per_minute, key_hash")
    .eq("key_hash", hashKey(presented))
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) return null;

  /*
   * The hash was the lookup key, so this comparison can only fail if the row
   * changed underneath. It is here anyway, in constant time, because a lookup
   * that returns a row is not the same statement as a credential that matches
   * one, and the two should not be conflated in code that grants access.
   */
  const a = Buffer.from(data.key_hash as string);
  const b = Buffer.from(hashKey(presented));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  /*
   * The account must be active. A suspended organisation whose keys still
   * worked would be a suspension that only applied to the website.
   */
  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("id, status")
    .eq("id", data.account_id)
    .maybeSingle();
  if (!account || account.status !== "active") return null;

  return {
    keyId: data.id as string,
    accountId: data.account_id as string,
    rateLimitPerMinute:
      data.rate_limit_per_minute === null ? DEFAULT_RATE_LIMIT : Number(data.rate_limit_per_minute),
  };
}

/**
 * Count this key's requests in the last minute.
 *
 * Counted BEFORE the request is recorded, so a limit of sixty allows sixty and
 * refuses the sixty first rather than the sixtieth.
 */
export async function withinRateLimit(key: VerifiedKey): Promise<{ ok: boolean; used: number }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, used: 0 };

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("eng_account_api_requests")
    .select("id", { count: "exact", head: true })
    .eq("key_id", key.keyId)
    .gte("created_at", since);

  const used = count ?? 0;
  return { ok: used < key.rateLimitPerMinute, used };
}

/**
 * Record a request, whatever its outcome.
 *
 * A refused request counts against the limit too. Otherwise a caller could send
 * bad bodies at any rate they liked and only the successful ones would be
 * throttled, which is the wrong way round: the refused ones are the ones that
 * look like somebody probing.
 */
export async function recordApiRequest(input: {
  key: VerifiedKey;
  route: string;
  status: number;
  reference?: string | null;
}): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  await db.from("eng_account_api_requests").insert({
    key_id: input.key.keyId,
    account_id: input.key.accountId,
    route: input.route,
    status: input.status,
    reference: input.reference ?? null,
  });

  await db
    .from("eng_account_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", input.key.keyId);
}
