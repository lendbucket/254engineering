import "server-only";
import { supabaseAdmin } from "./supabase";
import { catalogFor } from "@data/catalog";
import { orderForCustomerToken } from "./ops-intake";
import { CUSTOMER_STATUS, CUSTOMER_STATUS_REFUND_ISSUED, CUSTOMER_STATUS_REPAIR_SPEC, CUSTOMER_STATUS_REPAIRS, type OrderStatus } from "./ops-orders";
import { money, type Cents } from "./ops-money";
import { REFUND_ISSUED_SENTENCE } from "./refund-update";
import { customerLettersRead, type CustomerLetter } from "./letter-delivery";
import { isOpen } from "./launch";
import { targetDateLine } from "./turnaround-target";
import { requestedDocuments } from "./status-uploads";
import type { UploadSlot } from "./status-upload-rules";

/**
 * What a customer sees about their own order.
 *
 * WHAT THIS DELIBERATELY DOES NOT RETURN
 * --------------------------------------
 * The file number, the technician's name, the engineer's name, the production
 * pay, the margin, and every internal event. A customer asked "where is my
 * letter", and answering it does not require handing them the firm's operating
 * record.
 *
 * The filter is `customer_visible` on the event, set at the point each event is
 * written rather than decided here. That way a new event added next year is
 * private until somebody deliberately makes it public, which is the right
 * default for a table that will accumulate events nobody reviewed.
 */

export type CustomerView = {
  reference: string;
  status: OrderStatus;
  statusLine: string;
  serviceName: string;
  propertyAddress: string;
  city: string | null;
  county: string;
  placedAt: string | null;
  /** What they were told before paying, verbatim, still available afterwards. */
  refundDisclosure: string | null;
  lines: { label: string; amount: string }[];
  total: string;
  /** Only the events marked for them, oldest first. */
  timeline: { at: string; summary: string }[];
  /** What they receive at the end, from the catalog they bought from. */
  receives: string[];
  /** What the firm does not provide, from the same entry. Limits only. */
  notes: string[];
  /** Set when money has come back, so the page leads with it. */
  refunded: { amount: string; retained: string; because: string } | null;
  /**
   * A refund issued and still pending at Stripe (ruling 2026-10-13): said as
   * issued, never as refunded, with the one issued sentence.
   */
  refundIssued: { amount: string; sentence: string } | null;
  /**
   * The sealed letters on this order's file that the customer may download:
   * sealed, visible to the client, with a live seal. Empty until the engineer
   * seals, which is what CUSTOMER_STATUS.complete's "Your document is below"
   * has been waiting for since it was written.
   */
  letters: CustomerLetter[];
  /**
   * The parts of this page that could not be read just now, in the customer's
   * words. Robert's audit of 2026-10-24, finding F29: the timeline, payment,
   * refund and letter reads ignored their errors, so a failed read showed no
   * refund and no sealed letter with nothing saying anything was missing. Empty
   * when everything was read.
   */
  unread: string[];
  /**
   * The firm's target date, as a sentence, or null. Robert's addendum of
   * 2026-10-25, item 6: "The customer status page shows the target date where
   * one exists." Held behind the gate exactly as the published roof figure is
   * (targetDateLine in turnaround-target.ts), so it is null while the firm is
   * not open, and null on a line with no target.
   */
  targetDate: string | null;
  /**
   * The documents the firm is still waiting on, which the customer can send
   * from this page (addendum item 4). Empty when nothing is outstanding.
   */
  requested: UploadSlot[];
};

const cents = (v: unknown): Cents => (v === null || v === undefined ? null : Number(v));

/* The customer's way back in, built in one place: customer-link-url.ts since addendum item 4. */
export { customerStatusUrl } from "./customer-link-url";

/**
 * A timestamp a customer can read.
 *
 * Templates in this repository take dates already formatted, because a template
 * is a pure function with no locale and no opinion about the reader. The order
 * row carries an ISO string, and putting that in front of a customer
 * ("2026-09-03T11:42:07.318Z") reads as a bug in the email rather than as a
 * time. This is the one place that turns one into the other.
 *
 * Written out in the same shape the alert templates already use, so the two
 * halves of this firm's outbound mail state a time the same way.
 */
export function customerWhen(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  /*
   * THE ZONE IS PART OF THE TIME.
   *
   * "September 3, 2026 at 11:42" is a guess presented as a fact: the reader
   * assumes their own zone and this firm's records are Central. Operator
   * ruling. Written as CT rather than CDT or CST because the abbreviation
   * changes twice a year and the reader does not care which side of the
   * changeover a timestamp fell on.
   */
  const when = at.toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  });
  return `${when} CT`;
}

/**
 * Resolve a customer's token to their order.
 *
 * A bad token, a revoked one and an expired one all return null, and the page
 * says the same thing for all three. Telling somebody their link has expired
 * rather than that it is wrong would confirm the order exists to anybody
 * guessing.
 */
export async function customerView(token: string): Promise<CustomerView | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const subject = await orderForCustomerToken(token);
  if (!subject?.orderId) return null;

  const { data: order } = await db
    .from("eng_service_orders")
    .select(
      "id, reference, status, file_id, service_slug, tier, property_address, city, county, price_cents, coastal_surcharge_cents, total_cents, inspection_fee_cents, twia_county, placed_at, refund_disclosure, catalog_snapshot",
    )
    .eq("id", subject.orderId)
    .maybeSingle();
  if (!order) return null;

  const entry = catalogFor(order.service_slug as string, (order.tier as string | null) ?? undefined);

  /* What could not be read is collected and said on the page (F29), never shown as nothing. */
  const unread: string[] = [];

  const { data: events, error: eventsError } = await db
    .from("eng_order_events")
    .select("created_at, summary")
    .eq("order_id", order.id)
    .eq("customer_visible", true)
    .order("created_at", { ascending: true });
  if (eventsError) unread.push("the progress of your order");

  const { data: payments, error: paymentsError } = await db
    .from("eng_order_payments")
    .select("kind, amount_cents, status, refund_case")
    .eq("order_id", order.id)
    .eq("status", "succeeded");
  if (paymentsError) unread.push("what has been paid and refunded");

  const charged = (payments ?? [])
    .filter((p) => p.kind === "charge")
    .reduce((n, p) => n + Number(p.amount_cents), 0);
  const refundedCents = (payments ?? [])
    .filter((p) => p.kind === "refund")
    .reduce((n, p) => n + Number(p.amount_cents), 0);
  const refundCase = (payments ?? []).find((p) => p.kind === "refund")?.refund_case as string | undefined;

  const { data: pendingRefunds, error: pendingError } = await db
    .from("eng_order_payments")
    .select("amount_cents")
    .eq("order_id", order.id)
    .eq("kind", "refund")
    .eq("status", "pending");
  if (pendingError && !paymentsError) unread.push("what has been paid and refunded");
  const issuedCents = (pendingRefunds ?? []).reduce((n, p) => n + Number(p.amount_cents), 0);

  /*
   * An order underway whose file waits on repairs says so (ruling Q3,
   * 2026-10-19). A failed read falls back to the plain underway line, which
   * is true of every order in fulfilment and claims nothing about repairs.
   */
  let awaitingRepairs = false;
  if (order.status === "in_fulfilment" && order.file_id) {
    const { data: file } = await db
      .from("eng_files")
      .select("status")
      .eq("id", order.file_id as string)
      .maybeSingle();
    awaitingRepairs = file?.status === "repairs_required";
  }

  /*
   * An agreed price is labelled as one (finding F3, 2026-10-25). The order's
   * price is the account's agreed price, and a figure that differs from the
   * published one with nothing saying why reads as an error. Compared with the
   * published price AT PLACEMENT (the catalogue snapshot), so a later change to
   * the published price never relabels an old order.
   */
  const snapshotPrice = (order.catalog_snapshot as { priceCents?: number | null } | null)?.priceCents ?? null;
  const isAgreed = order.price_cents !== null && typeof snapshotPrice === "number" && Number(order.price_cents) !== snapshotPrice;
  const lines: CustomerView["lines"] = [
    {
      label: `${entry?.name ?? (order.service_slug as string)}${isAgreed ? " (agreed price)" : ""}`,
      amount: money(cents(order.price_cents)),
    },
  ];
  if (order.twia_county && order.coastal_surcharge_cents !== null) {
    lines.push({ label: "Coastal county", amount: money(cents(order.coastal_surcharge_cents)) });
  }

  const lettersRead = await customerLettersRead(subject.orderId);
  if (!lettersRead.ok) unread.push("your sealed documents");

  /* The target date, read off the file, said only when the gate is open (addendum item 6). */
  let dueAt: string | null = null;
  if (order.file_id) {
    const { data: due, error: dueError } = await db
      .from("eng_files")
      .select("due_at")
      .eq("id", order.file_id as string)
      .maybeSingle();
    if (dueError) unread.push("the firm's target date");
    dueAt = (due?.due_at as string | null) ?? null;
  }

  /* The documents still asked for, which this page can take (addendum item 4). */
  const requested = await requestedDocuments(subject.orderId);
  if (!requested.ok) unread.push(requested.error);

  return {
    reference: order.reference as string,
    status: order.status as OrderStatus,
    // "Refund issued." until every refund on the order has succeeded (ruling 2026-10-14).
    statusLine:
      order.status === "refunded" && issuedCents > 0
        ? CUSTOMER_STATUS_REFUND_ISSUED
        : awaitingRepairs
          ? CUSTOMER_STATUS_REPAIRS
          : order.status === "in_fulfilment" && order.service_slug === "repair-specifications"
            ? CUSTOMER_STATUS_REPAIR_SPEC
            : CUSTOMER_STATUS[order.status as OrderStatus],
    serviceName: entry?.name ?? (order.service_slug as string),
    propertyAddress: order.property_address as string,
    city: (order.city as string | null) ?? null,
    county: order.county as string,
    placedAt: (order.placed_at as string | null) ?? null,
    refundDisclosure: (order.refund_disclosure as string | null) ?? null,
    lines,
    total: money(cents(order.total_cents)),
    timeline: (events ?? []).map((e) => ({
      at: e.created_at as string,
      summary: e.summary as string,
    })),
    receives: entry?.receives ?? [],
    notes: entry?.notes ?? [],
    refunded:
      refundedCents > 0
        ? {
            amount: money(refundedCents),
            retained: money(charged - refundedCents),
            because: refundCase ?? "The engineer could not seal this.",
          }
        : null,
    refundIssued: issuedCents > 0 ? { amount: money(issuedCents), sentence: REFUND_ISSUED_SENTENCE } : null,
    letters: lettersRead.ok ? lettersRead.letters : [],
    unread,
    targetDate: targetDateLine(dueAt, isOpen()),
    requested: requested.ok ? requested.slots : [],
  };
}
