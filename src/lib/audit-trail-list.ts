import "server-only";
import { supabaseAdmin } from "./supabase";
import { readEvery } from "./bounded-read";
import { cleanSearchTerm } from "./search-rules";

/**
 * ===========================================================================
 * THE AUDIT TRAIL, SEARCHED AND PAGED ON THE SERVER. Office ready, CLAUDE.md
 * section 2d: "Every list sorts, filters, searches and pages."
 * ===========================================================================
 *
 * The screen read the newest 200 events and said so ("capped at 200 for
 * now"), so anything older was unreachable from the portal at all. This trail
 * is the firm's regulatory memory and grows without end, so unlike the small
 * registers in staff-lists.ts it is never read whole for a page: the search,
 * the filter, the order and the page are asked of the database, and the count
 * comes back with the page as an exact count of the whole matching set.
 *
 * One query builder, so the screen and the CSV cannot disagree about which
 * events match. The export reads every matching row through readEvery, which
 * refuses rather than returning a capped list as the set.
 */

export const AUDIT_PAGE_SIZE = 100;

export type AuditEvent = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  ip: string | null;
};

export type AuditTrailQuery = { term: string; who: "" | "people" | "system"; ascending: boolean; page: number };

export function auditTrailQuery(params: Record<string, string | undefined>): AuditTrailQuery {
  const who = params.who === "people" || params.who === "system" ? params.who : "";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  return { term: cleanSearchTerm(params.q ?? ""), who, ascending: params.dir === "asc", page };
}

const COLUMNS = "id, created_at, actor_email, actor_role, action, entity_type, entity_id, summary, ip";

function matching(db: NonNullable<ReturnType<typeof supabaseAdmin>>, query: AuditTrailQuery, count: boolean) {
  let read = db.from("eng_audit_events").select(COLUMNS, count ? { count: "exact" } : undefined);
  if (query.term) {
    const like = `%${query.term}%`;
    read = read.or(`summary.ilike.${like},actor_email.ilike.${like},action.ilike.${like},entity_type.ilike.${like},entity_id.ilike.${like}`);
  }
  if (query.who === "system") read = read.is("actor_email", null);
  if (query.who === "people") read = read.not("actor_email", "is", null);
  return read.order("created_at", { ascending: query.ascending }).order("id", { ascending: true });
}

const toEvent = (row: Record<string, unknown>): AuditEvent => ({ ...(row as AuditEvent), id: String(row.id) });

/** One page, and the exact size of the whole matching set beside it. */
export async function auditTrailPage(
  query: AuditTrailQuery,
): Promise<{ ok: true; rows: AuditEvent[]; total: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const from = (query.page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await matching(db, query, true).range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error) return { ok: false, error: error.message };
  /* A count that did not come back is a failed read, never a total of zero. */
  if (count === null || count === undefined) return { ok: false, error: "The trail answered with no count, so the total is not known." };
  return { ok: true, rows: ((data ?? []) as Record<string, unknown>[]).map(toEvent), total: count };
}

/** Every event the query matches, for the CSV. */
export async function auditTrailEvery(query: AuditTrailQuery): Promise<{ ok: true; rows: AuditEvent[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<Record<string, unknown>>((from, to) => matching(db, query, false).range(from, to));
  return read.ok ? { ok: true, rows: read.rows.map(toEvent) } : { ok: false, error: read.error };
}
