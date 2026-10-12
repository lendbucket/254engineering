import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, canSeeFile, redactFile, type Actor } from "./ops-authz";
import { listFiles, type FileRow } from "./ops-crm";

/**
 * ONE SEARCH FOR A RECORD. Operator ruling, 2026-10-10 (gap 6 of the product
 * audit): a member of staff with a customer on the telephone has an order
 * reference, an email address, a phone number or a street address, and had to
 * know which screen holds which. This answers all four at once, returning
 * orders and files.
 *
 * NOTHING HERE WIDENS WHAT ANYBODY MAY SEE. Files come through listFiles, which
 * applies the actor's scope in SQL and redacts money, plus the files whose
 * CLIENT matches an email or phone, each checked with canSeeFile and redacted
 * the same way. Orders appear only to somebody who may reconcile payments,
 * which is who reads the orders screen today. Demonstration rows are shown and
 * marked, never mixed in silently.
 *
 * BOUNDED AND SAYS SO: up to LIMIT of each, newest first, and the screen says
 * when there are more rather than presenting a page as the whole.
 */
export const SEARCH_MIN_LENGTH = 3;
export const SEARCH_LIMIT = 50;

export type OrderHit = {
  reference: string;
  status: string;
  service_slug: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  property_address: string | null;
  file_id: string | null;
  created_at: string;
  is_demo: boolean;
};

export type SearchResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      term: string;
      files: FileRow[];
      filesMore: boolean;
      orders: OrderHit[] | null;
      ordersMore: boolean;
    };

/** The term as a pattern can carry it: the characters PostgREST's or() treats as syntax removed. */
function clean(raw: string): string {
  return raw.replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchRecords(actor: Actor | null, raw: string): Promise<SearchResult> {
  /* files.list, the permission the Files screen itself checks. */
  if (!can(actor, "files.list")) return { ok: false, reason: "Searching records needs access to files." };
  const term = clean(raw ?? "");
  if (term.length < SEARCH_MIN_LENGTH) {
    return { ok: false, reason: `Type at least ${SEARCH_MIN_LENGTH} characters of a reference, email, phone or address.` };
  }
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "The database is not configured." };

  /*
   * A phone number is matched on its digits, however it was typed or STORED.
   * Client phones are stored as typed, "(361) 555-1234", so the pattern allows
   * anything between digits; matching the bare digits missed every formatted
   * one, which the proof found on its first run.
   */
  const digits = term.replace(/\D/g, "");
  const phoneLike = `%${digits.split("").join("%")}%`;
  const like = `%${term}%`;

  /* Files by number or address, through the actor's own scope. */
  const byFile = await listFiles(actor, { search: term });

  /* Files whose client matches an email or a phone. */
  const clientOr = [`email.ilike.${like}`, ...(digits.length >= 7 ? [`phone.ilike.${phoneLike}`] : [])].join(",");
  const { data: clients } = await db.from("eng_clients").select("id").or(clientOr).limit(SEARCH_LIMIT);
  const clientIds = (clients ?? []).map((c) => c.id as string);
  let byClient: FileRow[] = [];
  if (clientIds.length) {
    const { data } = await db
      .from("eng_files")
      .select("*")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT);
    byClient = ((data ?? []) as FileRow[])
      .filter((f) => canSeeFile(actor, f as unknown as Parameters<typeof canSeeFile>[1]))
      .map((f) => redactFile(actor, f as unknown as Record<string, unknown>) as unknown as FileRow);
  }
  const seen = new Set<string>();
  const files = [...byFile, ...byClient].filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));

  let orders: OrderHit[] | null = null;
  let ordersMore = false;
  if (can(actor, "payments.reconcile")) {
    const orderOr = [
      `reference.ilike.${like}`,
      `customer_email.ilike.${like}`,
      `property_address.ilike.${like}`,
      ...(digits.length >= 7 ? [`customer_phone.ilike.${phoneLike}`] : []),
    ].join(",");
    const { data } = await db
      .from("eng_service_orders")
      .select("reference, status, service_slug, customer_name, customer_email, customer_phone, property_address, file_id, created_at, is_demo")
      .or(orderOr)
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT + 1);
    const rows = (data ?? []) as OrderHit[];
    ordersMore = rows.length > SEARCH_LIMIT;
    orders = rows.slice(0, SEARCH_LIMIT);
  }

  return {
    ok: true,
    term,
    files: files.slice(0, SEARCH_LIMIT),
    filesMore: files.length > SEARCH_LIMIT,
    orders,
    ordersMore,
  };
}
