import "server-only";
import { revalidatePath } from "next/cache";
import { services } from "@/content/services";
import { supabaseAdmin } from "./supabase";
import { captureError } from "./ops-observability";
import { pagesQuoting, VOID_LOOKBACK_MINUTES } from "./scope-quote";

/**
 * A VOIDED PROTOCOL SIGNATURE TAKES ITS SCOPE OFF THE SERVICE PAGES WITHIN
 * ABOUT A MINUTE. Robert, 17:31 and 18:04 Central 2026-10-31 (queue item 15),
 * trigger A: the every-minute jobs cron.
 *
 * No path in the app voids a protocol signature: it goes void by
 * eng_void_seal_act at a sitting, or by a transcription change that ships in a
 * deploy and rebuilds the pages anyway. So this does not wait to be told. Each
 * run reads the protocol seal acts voided in the last few minutes, and
 * revalidates every service page quoting one of them, plus /llms-full.txt. The
 * page then re-reads the signature itself (scope-live.ts) and shows the pending
 * sentence once the read finds the signature void.
 *
 * The lookback is wider than the schedule on purpose: a run that is skipped or
 * slow must not let a void through, and revalidating a page twice costs
 * nothing.
 *
 * A failed read changes no page: nothing is revalidated, the error is
 * recorded, and the next run looks again over the same window.
 */
export async function sweepVoidedProtocolScopes(now: number = Date.now()): Promise<{ looked: boolean; revalidated: string[]; note: string }> {
  try {
    const db = supabaseAdmin();
    if (!db) return { looked: false, revalidated: [], note: "the database is not configured" };
    const since = new Date(now - VOID_LOOKBACK_MINUTES * 60_000).toISOString();
    const { data, error } = await db
      .from("eng_seal_acts")
      .select("protocol_document, voided_at")
      .eq("kind", "protocol")
      .gte("voided_at", since)
      .limit(100);
    if (error) {
      await captureError(new Error(`The voided protocol signatures could not be read: ${error.message}`), {
        kind: "scope-sweep",
        route: "/api/cron/jobs",
      });
      return { looked: false, revalidated: [], note: `the read failed: ${error.message}` };
    }
    const documents = [...new Set((data ?? []).map((r) => String(r.protocol_document)))];
    const pages = pagesQuoting(documents, services);
    for (const page of pages) revalidatePath(page);
    return {
      looked: true,
      revalidated: pages,
      note: documents.length === 0 ? "no protocol signature voided in the window" : `voided: ${documents.join(", ")}`,
    };
  } catch (err) {
    await captureError(err, { kind: "scope-sweep", route: "/api/cron/jobs" });
    return { looked: false, revalidated: [], note: `the sweep threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}
