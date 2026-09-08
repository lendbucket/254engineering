import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { business } from "@/config/business";

/**
 * WHO HAS ASKED NOT TO RECEIVE MARKETING, AND THE LINK THAT ASKS.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ----------------------------------------
 * A marketing send consults this. A transactional send never does, and there is
 * deliberately no function here that a transactional path could call to "check
 * whether this person still wants email". Somebody who paid for a sealed
 * document is owed the confirmation, the outcome and the refund arithmetic
 * whatever their marketing preference says.
 *
 * The failure this prevents is specific and it is the operator's own words: a
 * customer who unsubscribed from marketing and then does not get their receipt.
 * email-audit proves the negative by putting a suppressed address through
 * order.confirmed and order.sealed and requiring both to send.
 *
 * WHY THE LINK IS SIGNED RATHER THAN A LOOKUP
 * --------------------------------------------
 * The alternative is /unsubscribe?email=someone@example.com, which lets anybody
 * unsubscribe anybody by editing a URL, and lets a crawler unsubscribe a whole
 * list by following links. A signature over the address means only a link this
 * firm generated works, and the address is still readable in the URL so the
 * page can say whose preference it is about without a database round trip.
 *
 * Signed with OPS_SESSION_SECRET under its own label, so a token from here can
 * never be confused with a session cookie and vice versa. That is the same
 * separation ops-session uses for its own key.
 */

const LABEL = "eng-unsubscribe-v1";

function key(): Buffer | null {
  const secret = process.env.OPS_SESSION_SECRET;
  if (!secret || secret.length < 24) return null;
  return createHmac("sha256", secret).update(LABEL).digest();
}

/** The address as it is stored and compared. One person, one spelling. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sign(email: string): string | null {
  const k = key();
  if (!k) return null;
  return createHmac("sha256", k).update(normaliseEmail(email)).digest("base64url");
}

/**
 * The one click link for an address.
 *
 * Returns null when the signing key is absent, and the caller must then refuse
 * to send rather than send a marketing email with no way out of it. That is not
 * a nicety: a bulk send with a dead unsubscribe is the thing that gets a sending
 * domain blocked.
 */
export function unsubscribeUrl(email: string): string | null {
  const token = sign(email);
  if (!token) return null;
  const address = encodeURIComponent(normaliseEmail(email));
  return `${business.url}/unsubscribe?e=${address}&t=${token}`;
}

/** Whether a presented token is one this firm issued for that address. */
export function tokenValid(email: string, token: string): boolean {
  const expected = sign(email);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  /* Length first: timingSafeEqual throws on a mismatch rather than returning
   * false, and a thrown comparison is a 500 where a refusal belongs. */
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Record that an address has asked to stop.
 *
 * Idempotent by construction: the address is the primary key and a repeat is an
 * upsert, because somebody clicking the same link twice has not done anything
 * wrong and should not see an error.
 */
export async function suppress(
  email: string,
  because: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { error } = await db
    .from("eng_marketing_suppressions")
    .upsert({ email: normaliseEmail(email), because }, { onConflict: "email" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Whether an address has asked not to receive marketing.
 *
 * FAILS CLOSED, and that direction is deliberate. If this cannot be answered,
 * the caller must treat the address as suppressed: sending marketing to
 * somebody who asked to stop is a harm and a legal exposure, and not sending it
 * is a delay. The two are not symmetrical, so the error case is not a coin toss.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return true;

  const { data, error } = await db
    .from("eng_marketing_suppressions")
    .select("email")
    .eq("email", normaliseEmail(email))
    .maybeSingle();

  if (error) {
    console.error("[marketing] the suppression list could not be read:", error.message);
    return true;
  }
  return Boolean(data);
}
