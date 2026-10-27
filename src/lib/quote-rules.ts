/**
 * THE RULES A QUOTE IS PRICED, LISTED AND ACCEPTED BY, as pure functions so
 * they can be proved. Robert's addendum of 2026-10-25, item 3. The screen, the
 * CSV export, the send door and the accept door all read these, so none of them
 * can hold a second copy of a rule.
 */
import type { QuoteStatus } from "./ops-orders";

export type QuoteRow = {
  id: string;
  createdAt: string;
  reference: string;
  site: string;
  serviceSlug: string;
  tier: string | null;
  status: QuoteStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerCompany: string | null;
  propertyAddress: string | null;
  city: string | null;
  county: string | null;
  brief: string | null;
  neededBy: string | null;
  quotedCents: number | null;
  scope: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
  declineReason: string | null;
  convertedOrderId: string | null;
  fileCount: number;
};

/**
 * The days a sent quote holds: the office chooses each time. No period has been
 * ruled, so the bounds only refuse a figure that cannot be meant (none, or more
 * than a year), and the default the form offers is 30 days, asked of Robert.
 */
export const QUOTE_HOLD_DAYS = { min: 1, max: 365, default: 30 } as const;

/**
 * Dollars as a person types them, to cents, or a sentence saying what is wrong.
 * Never a guess. No ceiling is set here, because none has been ruled; the
 * screen shows the figure back and asks before it sends.
 */
export function parseQuotePrice(raw: string): { ok: true; cents: number } | { ok: false; error: string } {
  const text = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, error: "Type the price in dollars, such as 2400 or 2400.50." };
  const cents = Math.round(Number(text) * 100);
  if (cents <= 0) return { ok: false, error: "A quote states a price above zero." };
  if (!Number.isSafeInteger(cents)) return { ok: false, error: "That price is not a figure this screen can send." };
  return { ok: true, cents };
}

export function parseHoldDays(raw: unknown): { ok: true; days: number } | { ok: false; error: string } {
  const days = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isInteger(days) || days < QUOTE_HOLD_DAYS.min || days > QUOTE_HOLD_DAYS.max) {
    return { ok: false, error: `A quote holds for ${QUOTE_HOLD_DAYS.min} to ${QUOTE_HOLD_DAYS.max} days.` };
  }
  return { ok: true, days };
}

/**
 * WHETHER A SENT QUOTE HAS LAPSED, judged at a moment the caller supplies. A
 * sent quote with its expiry at or before that moment cannot be accepted,
 * whatever its stored status still says: the status is written when somebody
 * next touches it, and the date is the rule.
 */
export function hasLapsed(row: Pick<QuoteRow, "status" | "expiresAt">, atMs: number): boolean {
  if (row.status !== "sent") return false;
  if (!row.expiresAt) return true;
  const ends = Date.parse(row.expiresAt);
  return Number.isNaN(ends) || ends <= atMs;
}

/** The status a person reads: a sent quote past its date reads as lapsed before anybody writes it. */
export function shownStatus(row: Pick<QuoteRow, "status" | "expiresAt">, atMs: number, labels: Record<QuoteStatus, string>): string {
  return hasLapsed(row, atMs) ? "Lapsed, not yet marked expired" : labels[row.status];
}

export type QuoteListQuery = { q?: string; status?: string; sort?: string; dir?: string };

export const QUOTE_SORTS = [
  { value: "asked", label: "Date asked" },
  { value: "expires", label: "Expiry" },
  { value: "amount", label: "Quoted price" },
  { value: "customer", label: "Customer" },
  { value: "reference", label: "Reference" },
] as const;

/**
 * WHICH QUOTES A LIST SHOWS, AND IN WHAT ORDER. Office ready, 2026-10-20: every
 * list sorts, filters, searches and pages, and the CSV is the same rows. Search
 * covers anything staff would type: the reference, the customer's name, email,
 * telephone and company, and the address. An absent figure sorts last in either
 * direction rather than as zero.
 */
export function quoteListRows(rows: readonly QuoteRow[], query: QuoteListQuery): QuoteRow[] {
  const needle = (query.q ?? "").trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const status = query.status && query.status !== "all" ? query.status : null;
  const out = rows.filter((r) => {
    if (status === "open" && !["new", "scoping", "sent"].includes(r.status)) return false;
    if (status && status !== "open" && r.status !== status) return false;
    if (!needle) return true;
    const text = [r.reference, r.customerName, r.customerEmail, r.customerCompany, r.propertyAddress, r.city]
      .some((v) => (v ?? "").toLowerCase().includes(needle));
    const phone = digits.length >= 4 && (r.customerPhone ?? "").replace(/\D/g, "").includes(digits);
    return text || phone;
  });
  const dir = query.dir === "asc" ? 1 : -1;
  const sort = query.sort ?? "asked";
  const key = (r: QuoteRow): string | number | null =>
    sort === "amount" ? r.quotedCents
    : sort === "expires" ? r.expiresAt
    : sort === "customer" ? r.customerName.toLowerCase()
    : sort === "reference" ? r.reference
    : r.createdAt;
  out.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null && kb === null) return a.id < b.id ? -1 : 1;
    if (ka === null) return 1;
    if (kb === null) return -1;
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return a.id < b.id ? -1 : 1;
  });
  return out;
}

/** The order a converted quote is placed under, so a retried acceptance finds the order it already made. */
export function quoteOrderRequestId(quoteId: string): string {
  return `quote-${quoteId}`;
}
