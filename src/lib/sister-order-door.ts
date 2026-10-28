import "server-only";
import { supabaseAdmin } from "./supabase";
import { siteOrderRateRefusal, type RateRefusal } from "./sister-order-door-rules";

/**
 * The reads and writes behind the rules in sister-order-door-rules.ts.
 * Robert's ruling 6 of 2026-10-27, 22:05 Central.
 */

export type SiteOrderIntent = "order" | "quote" | "upload" | "unreadable";

/**
 * Counts this site's requests in the last minute, records this one, and says
 * whether it is over the limit (0100).
 *
 * The row is written even when the answer is 429, because a refused request
 * still counts (0010's reasoning): a caller that keeps hammering stays held
 * until it stops for a minute. A count that cannot be read, or a row that
 * cannot be written, refuses with 503, because either way the limit would not
 * be enforced.
 */
export async function siteOrderRate(
  site: string,
  intent: SiteOrderIntent,
  /* Injected only by the proof; the route always uses the admin client. */
  db: ReturnType<typeof supabaseAdmin> = supabaseAdmin(),
): Promise<RateRefusal | null> {
  if (!db) return { status: 503, error: "The order system is not configured." };

  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await db
    .from("eng_site_order_requests")
    .select("id", { count: "exact", head: true })
    .eq("site", site)
    .gte("created_at", minuteAgo);
  const counted = error || typeof count !== "number" ? null : count;
  if (counted === null) return siteOrderRateRefusal(null);

  const { error: insertError } = await db.from("eng_site_order_requests").insert({ site, intent });
  if (insertError) {
    console.error(`[orders] the request log could not be written for site "${site}": ${insertError.message}`);
    return { status: 503, error: "The order door could not record this request just now. Nothing was placed; send it again." };
  }

  return siteOrderRateRefusal(counted);
}

/** An order's status, or null when it could not be read. */
export async function orderStatus(orderId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("eng_service_orders").select("status").eq("id", orderId).maybeSingle();
  if (error || !data) return null;
  return data.status as string;
}
