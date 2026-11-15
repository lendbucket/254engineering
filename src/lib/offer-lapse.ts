import "server-only";
import { supabaseAdmin } from "./supabase";
import { DB_NOW } from "./db-now";
import { captureError } from "./ops-observability";
import { formatInFirmZone } from "./firm-calendar";

/**
 * ===========================================================================
 * AN OFFER NOBODY ANSWERED IS RECORDED AS LAPSED. Part 1 finding 19, Robert's
 * answer 1 of 2026-11-14.
 * ===========================================================================
 *
 * OfferState has carried "expired" since 0001 and the database allows it, and
 * nothing ever wrote it. Acceptance was refused correctly once the time passed
 * (canRespondToOffer), but the row stayed "offered", so the dispatcher's
 * "Offers outstanding" counted an offer nobody could take any more and nobody
 * was told it had lapsed.
 *
 * This runs from the jobs cron after the batch, every minute, in the shape of
 * sweepVoidedProtocolScopes: it never throws, it records its own faults, and it
 * says what it did. Each lapse is moved only from "offered" (a technician who
 * accepted in the same second keeps the job) and is written to the file's
 * timeline, which is what the dispatcher reads; the dispatcher's home names the
 * files left with nobody offered (ops-dashboard.ts).
 *
 * BOUNDED PER RUN, AND SAYS SO. At most LAPSE_BATCH rows a minute. The note
 * reports how many it moved, never how many exist, because a bounded read is
 * a sample of the set and not its size.
 */
export const LAPSE_BATCH = 200;

export async function sweepLapsedOffers(now: number = Date.now()): Promise<{ looked: boolean; lapsed: number; note: string }> {
  try {
    const db = supabaseAdmin();
    if (!db) return { looked: false, lapsed: 0, note: "the database is not configured" };
    const { data, error } = await db
      .from("eng_assignments")
      .select("id, file_id, expires_at")
      .eq("state", "offered")
      .lt("expires_at", new Date(now).toISOString())
      .order("expires_at", { ascending: true })
      .limit(LAPSE_BATCH);
    if (error) {
      await captureError(new Error(`The lapsed offers could not be read: ${error.message}`), { kind: "offer-lapse", route: "/api/cron/jobs" });
      return { looked: false, lapsed: 0, note: `the read failed: ${error.message}` };
    }

    let lapsed = 0;
    for (const row of data ?? []) {
      const { data: moved, error: moveError } = await db
        .from("eng_assignments")
        .update({ state: "expired", responded_at: DB_NOW })
        .eq("id", row.id)
        .eq("state", "offered")
        .select("id");
      if (moveError) {
        await captureError(new Error(`Offer ${row.id} could not be marked lapsed: ${moveError.message}`), { kind: "offer-lapse", route: "/api/cron/jobs" });
        continue;
      }
      /* Answered in the same moment: the answer stands and there is nothing to record. */
      if (!moved?.length) continue;
      lapsed += 1;
      const when = formatInFirmZone(row.expires_at as string, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const { error: eventError } = await db.from("eng_file_events").insert({
        file_id: row.file_id,
        actor_id: null,
        kind: "dispatch",
        body: `An offer lapsed${when ? ` at ${when}` : ""} with no answer from the technician.`,
      });
      if (eventError) {
        await captureError(new Error(`The lapse of offer ${row.id} could not be written to its file: ${eventError.message}`), { kind: "offer-lapse", route: "/api/cron/jobs" });
      }
    }
    return {
      looked: true,
      lapsed,
      note: lapsed === 0 ? "no offer lapsed" : `${lapsed} offer(s) marked lapsed this run${(data ?? []).length === LAPSE_BATCH ? ", more may be waiting" : ""}`,
    };
  } catch (err) {
    await captureError(err, { kind: "offer-lapse", route: "/api/cron/jobs" });
    return { looked: false, lapsed: 0, note: `the sweep threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}
