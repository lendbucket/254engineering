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

/**
 * One row on the operator's suppression screen.
 *
 * `enteredByOperator` is the whole point of showing this list. A row with a
 * token hash came from somebody clicking a link in an email they were sent; a
 * row without one came from a person on the telephone and somebody typing what
 * they were told. The two are different kinds of evidence and the screen has to
 * say which, because only one of them can be corrected.
 */
export type SuppressionRow = {
  email: string;
  because: string;
  createdAt: string;
  enteredByOperator: boolean;
};

/**
 * The whole list, newest first.
 *
 * Returns null on a failed read rather than an empty array, for the reason the
 * reports module states at length: an empty list and a list nobody could read
 * are different facts, and a screen that renders them the same way tells
 * somebody the firm has suppressed nobody when it has in fact failed to ask.
 */
export async function listSuppressions(): Promise<SuppressionRow[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("eng_marketing_suppressions")
    .select("email, because, created_at, token_hash")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[marketing] the suppression list could not be listed:", error.message);
    return null;
  }

  return (data ?? []).map((r) => ({
    email: r.email as string,
    because: r.because as string,
    createdAt: r.created_at as string,
    enteredByOperator: r.token_hash === null,
  }));
}

/**
 * Remove a suppression somebody entered by hand and should not have.
 *
 * THIS IS A CORRECTION AND IT IS NOT A RESUBSCRIBE. THE DIFFERENCE IS THE
 * WHOLE REASON THIS FUNCTION IS SHAPED THE WAY IT IS.
 *
 * 0026 says there is no delete on this table, and it is right about why:
 * resubscribing is not the inverse of unsubscribing. Somebody who asks to
 * receive marketing again is giving CONSENT, which is a new fact with its own
 * date rather than the absence of an old one, and it gets its own table, its
 * own migration and its own ruling when somebody wants it.
 *
 * What this does is narrower and is a real thing that happens: an operator
 * takes a request over the telephone, types the address wrong, and a customer
 * who never asked for anything stops hearing from the firm. That row is not a
 * record of a decision anybody made. It is a typing mistake, and correcting it
 * asserts nothing about consent.
 *
 * So a row that carries a TOKEN HASH can never be removed here, whatever
 * permission the caller holds. That row exists because a person clicked a link
 * in an email addressed to them, which is the strongest evidence this system
 * has of anything, and removing it would be the platform asserting a consent
 * nobody gave. The refusal is checked against the row rather than trusted to
 * the screen, because a screen is a place a filter goes missing.
 */
export async function removeOperatorEntry(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const address = normaliseEmail(email);
  const { data, error } = await db
    .from("eng_marketing_suppressions")
    .select("email, token_hash")
    .eq("email", address)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That address is not on the list." };

  if (data.token_hash !== null) {
    return {
      ok: false,
      error:
        "That request came from somebody clicking the unsubscribe link in their own email. It cannot be removed here, because removing it would record a consent nobody gave.",
    };
  }

  const { error: delErr } = await db
    .from("eng_marketing_suppressions")
    .delete()
    .eq("email", address)
    .is("token_hash", null);

  if (delErr) return { ok: false, error: delErr.message };
  return { ok: true };
}
