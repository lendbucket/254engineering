import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { queueEmail } from "./ops-jobs";
import { filesOverdueAlert } from "./email-templates";
import { business } from "@/config/business";
import { ENVIRONMENT } from "./ops-observability";
import { OVERDUE_STATUSES } from "./turnaround-target";
import { STATUS_LABEL, type FileStatus } from "./ops-files";
import { catalogFor } from "@data/catalog";
import { formatInFirmZone } from "./firm-calendar";

/**
 * FILES PAST THEIR TARGET DATE, TOLD TO THE OFFICE. Robert's addendum of
 * 2026-10-25, item 6: "Overdue files alert the office."
 *
 * It rides on the health watch for the reason the payments watch gives: a
 * cheap read on a five minute schedule, and a second cron is a second thing
 * that can be missing from Vercel without anybody noticing. Its email is
 * queued, because an overdue file is ordinary work, not a stalled queue.
 *
 * ONCE A DAY AT MOST, through the same cooldown table the other watchers use,
 * stamped only when the email was actually queued. A target is counted in
 * business days, so an email every hour about the same late file would teach
 * the office to filter it. The figure is pinned in turnaround-audit.
 *
 * A FAILED READ IS NOT "NOTHING IS LATE". It reports that it could not look.
 */

const KEY = "files.overdue";
export const OVERDUE_COOLDOWN_HOURS = 24;

export type OverdueWatchResult = { looked: boolean; count: number | null; sent: boolean; note: string };

export async function watchOverdueFiles(now: number = Date.now()): Promise<OverdueWatchResult> {
  const db = supabaseAdmin();
  if (!db) return { looked: false, count: null, sent: false, note: "no database" };

  const { data: late, error, count } = await db
    .from("eng_files")
    .select("file_number, service_slug, deliverable, due_at, status", { count: "exact" })
    .eq("is_demo", false)
    .in("status", [...OVERDUE_STATUSES])
    .not("due_at", "is", null)
    .lt("due_at", new Date(now).toISOString())
    .order("due_at", { ascending: true })
    .range(0, 9);
  if (error) return { looked: false, count: null, sent: false, note: `the files could not be read: ${error.message}` };

  const total = count ?? 0;
  if (total === 0) return { looked: true, count: 0, sent: false, note: "no file is past its target date" };

  const summary = `${total} file${total === 1 ? "" : "s"} past the target date`;

  const { data: state, error: stateError } = await db
    .from("eng_alert_state")
    .select("last_alerted_at")
    .eq("key", KEY)
    .maybeSingle();
  if (stateError) {
    return { looked: false, count: total, sent: false, note: `${summary}; the alert cooldown could not be read, so no email was decided: ${stateError.message}` };
  }
  const last = state?.last_alerted_at ? Date.parse(state.last_alerted_at as string) : null;
  if (last !== null && now - last < OVERDUE_COOLDOWN_HOURS * 3_600_000) {
    return { looked: true, count: total, sent: false, note: `${summary}; alerted within the last ${OVERDUE_COOLDOWN_HOURS} hours` };
  }

  const queued = await queueEmail(
    filesOverdueAlert({
      files: (late ?? []).map((f) => ({
        fileNumber: String(f.file_number),
        service: catalogFor(String(f.service_slug), (f.deliverable as string | null) ?? undefined)?.name ?? String(f.service_slug),
        dueOn: formatInFirmZone(f.due_at as string) ?? "an unreadable date",
        status: STATUS_LABEL[f.status as FileStatus] ?? String(f.status),
      })),
      total,
      cooldownHours: OVERDUE_COOLDOWN_HOURS,
      checkedAt: new Date(now).toISOString(),
      filesUrl: `${business.url}/portal/files`,
      environment: ENVIRONMENT,
    }),
  );
  if (!queued.ok) return { looked: true, count: total, sent: false, note: `${summary}; the alert could not be queued: ${queued.error}` };

  const { error: stampError } = await db.from("eng_alert_state").upsert(
    { key: KEY, last_alerted_at: DB_NOW, detail: summary, updated_at: DB_NOW },
    { onConflict: "key" },
  );
  if (stampError) {
    console.error(`[overdue-watch] the alert was queued but the cooldown was not recorded, so it will send again: ${stampError.message}`);
  }
  return { looked: true, count: total, sent: true, note: `${summary}; alert queued` };
}
