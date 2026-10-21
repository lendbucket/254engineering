import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery } from "./bounded-read";

/**
 * LOOKING AN ORDER UP. Operator ruling, 2026-10-20. 0079: orders.read.
 *
 * The rep and the operations manager find an order by anything a customer on
 * the telephone would say: the reference, a name, an email, a phone number, the
 * property address or the city. They see what the customer was charged,
 * because that is the number the customer is asking about, and nothing about
 * what the work costs the firm: no technician or engineer figure, no margin,
 * no partner commission. Those columns are not selected here, so no screen
 * built on this can show them.
 *
 * Reading changes nothing. Refunds are a request (refunds.request), and
 * reconciliation stays on /portal/orders under payments.reconcile.
 */

export type OrderRow = {
  id: string;
  reference: string;
  status: string;
  serviceSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerCompany: string | null;
  propertyAddress: string;
  city: string | null;
  county: string;
  totalCents: number | null;
  placedAt: string | null;
  paidAt: string | null;
  fileId: string | null;
  accountId: string | null;
};

export type OrderSort = "placed" | "reference" | "customer" | "status" | "total";

export type OrderQuery = {
  search?: string;
  status?: string | "all";
  sort?: OrderSort;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const COLUMNS =
  "id, reference, status, service_slug, customer_name, customer_email, customer_phone, customer_company, property_address, city, county, total_cents, placed_at, paid_at, file_id, account_id";

export function canLookUpOrders(actor: Actor | null): boolean {
  return can(actor, "orders.read") || can(actor, "payments.reconcile");
}

function rowFrom(r: Record<string, unknown>): OrderRow {
  return {
    id: String(r.id),
    reference: String(r.reference),
    status: String(r.status),
    serviceSlug: String(r.service_slug),
    customerName: String(r.customer_name ?? ""),
    customerEmail: String(r.customer_email ?? ""),
    customerPhone: (r.customer_phone as string | null) ?? null,
    customerCompany: (r.customer_company as string | null) ?? null,
    propertyAddress: String(r.property_address ?? ""),
    city: (r.city as string | null) ?? null,
    county: String(r.county ?? ""),
    totalCents: r.total_cents === null || r.total_cents === undefined ? null : Number(r.total_cents),
    placedAt: (r.placed_at as string | null) ?? null,
    paidAt: (r.paid_at as string | null) ?? null,
    fileId: (r.file_id as string | null) ?? null,
    accountId: (r.account_id as string | null) ?? null,
  };
}

/** Does this order match what somebody typed? Any field staff would type, digits matched as digits. */
export function orderMatches(r: OrderRow, typed: string): boolean {
  const needle = typed.trim().toLowerCase();
  if (!needle) return true;
  const hay = [r.reference, r.customerName, r.customerEmail, r.customerCompany, r.propertyAddress, r.city, r.county]
    .map((v) => String(v ?? "").toLowerCase());
  if (hay.some((h) => h.includes(needle))) return true;
  const digits = needle.replace(/[^0-9]/g, "");
  return digits.length >= 3 && String(r.customerPhone ?? "").replace(/[^0-9]/g, "").includes(digits);
}

export async function listOrders(
  actor: Actor | null,
  q: OrderQuery,
): Promise<{ ok: true; rows: OrderRow[]; total: number; page: number; pageSize: number; statuses: string[] } | { ok: false; error: string }> {
  if (!canLookUpOrders(actor)) return { ok: false, error: "Your role cannot look orders up." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so no order could be read." };

  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_service_orders")
      .select(COLUMNS)
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (!read.ok) return { ok: false, error: `Orders could not be read: ${read.error}` };

  const all = read.rows.map(rowFrom);
  const statuses = [...new Set(all.map((r) => r.status))].sort();
  const filtered = all.filter((r) => (q.status && q.status !== "all" ? r.status === q.status : true) && orderMatches(r, q.search ?? ""));

  const sort = q.sort ?? "placed";
  const dir = q.direction === "asc" ? 1 : -1;
  const key = (r: OrderRow): string | number => {
    if (sort === "reference") return r.reference;
    if (sort === "customer") return r.customerName.toLowerCase();
    if (sort === "status") return r.status;
    if (sort === "total") return r.totalCents ?? -1;
    return r.placedAt ?? "";
  };
  filtered.sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : 0));

  const pageSize = Math.min(Math.max(q.pageSize ?? 50, 10), 200);
  const page = Math.max(1, q.page ?? 1);
  return {
    ok: true,
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    statuses,
  };
}

/** A client's orders, newest first, for the client's own screen. */
export async function ordersForClient(
  actor: Actor | null,
  clientId: string,
): Promise<{ ok: true; rows: OrderRow[] } | { ok: false; error: string }> {
  if (!canLookUpOrders(actor)) return { ok: false, error: "Your role cannot look orders up." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_service_orders").select(COLUMNS).eq("client_id", clientId).order("created_at", { ascending: false }).range(from, to),
  );
  if (!read.ok) return { ok: false, error: `The client's orders could not be read: ${read.error}` };
  return { ok: true, rows: read.rows.map(rowFrom) };
}

export type OrderEvent = { at: string; event: string; text: string | null };

export async function orderDetail(
  actor: Actor | null,
  id: string,
): Promise<{ ok: true; order: OrderRow | null; events: OrderEvent[] } | { ok: false; error: string }> {
  if (!canLookUpOrders(actor)) return { ok: false, error: "Your role cannot look orders up." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db.from("eng_service_orders").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: `The order could not be read: ${error.message}` };
  if (!data) return { ok: true, order: null, events: [] };

  const events = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_order_events")
      .select("created_at, event, summary")
      .eq("order_id", id)
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  if (!events.ok) return { ok: false, error: `The order's history could not be read: ${events.error}` };
  return {
    ok: true,
    order: rowFrom(data as Record<string, unknown>),
    events: events.rows.map((e) => ({ at: String(e.created_at), event: String(e.event), text: (e.summary as string | null) ?? null })),
  };
}
