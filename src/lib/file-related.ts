import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { money } from "./ops-money";
import type { FileStatus } from "./ops-files";
import { readEvery } from "./bounded-read";
import { noAccessState, type NoAccessState } from "./no-access";

/**
 * ===========================================================================
 * EVERYTHING A FILE TOUCHES, AND WHAT HAPPENS NEXT. The Killeen call, items 3
 * and 4 (Robert, 2026-11-14), and Part 1 finding 14.
 * ===========================================================================
 *
 * The file record linked to no other record: no client, order, payment,
 * technician, engineer or letter. After Take the job the rep landed on a done
 * panel and then a list. This module reads the file's neighbours once, for the
 * file screen, and says the next step and who owns it.
 *
 * MONEY FOLLOWS RULING 6b-i. The order's figures and payment state are read
 * only for a role holding orders.read; anybody else sees that an order exists
 * and nothing about what it cost. The engineer's own pay is not here at all.
 *
 * A FAILED READ IS SAID. Each neighbour is either the record, absent (null), or
 * a sentence naming what could not be read. Absent and unreadable are different
 * facts, and the screen says which.
 */

export type Linked = { id: string; label: string; href: string };

export type PaymentState =
  | { kind: "none" }
  | { kind: "waiting"; reference: string; amount: string; since: string; lastSent: string | null }
  | { kind: "paid"; reference: string; amount: string; paidAt: string | null }
  | { kind: "other"; reference: string; status: string };

export type FileRelated = {
  client: Linked | null;
  order: Linked | null;
  payment: PaymentState | null;
  /** When the customer last opened their status link, if anybody holds orders.read and it was ever opened. */
  statusLinkOpened: string | null;
  /** When the customer first opened it, from the order's timeline (item 8). */
  statusLinkFirstOpened: string | null;
  technician: Linked | null;
  engineer: Linked | null;
  letters: Linked[];
  /** Who else gets the letter (0132), and when each last opened their letter link (0133). */
  contacts: { role: string; name: string | null; email: string; pays: boolean; lastOpened: string | null }[];
  /** The latest visit the technician could not get into, and its trip fee (0134). Null when the read failed; the failure is in unreadable. */
  noAccess: NoAccessState | null;
  /** Travel on the job and its reason, for a role that sees money (0135, 6b-i). Null for none, or not shown. */
  travel: { amount: string; cents: number; reason: string } | null;
  unreadable: string[];
};

export async function fileRelated(
  actor: Actor | null,
  file: { id: string; client_id: string | null; assigned_tech_id: string | null; assigned_engineer_id: string | null },
): Promise<FileRelated> {
  const out: FileRelated = { client: null, order: null, payment: null, statusLinkOpened: null, statusLinkFirstOpened: null, technician: null, engineer: null, letters: [], contacts: [], noAccess: null, travel: null, unreadable: [] };
  const db = supabaseAdmin();
  if (!db || !actor) {
    out.unreadable.push("The records this file touches could not be read.");
    return out;
  }

  if (file.client_id) {
    const { data, error } = await db.from("eng_clients").select("id, name").eq("id", file.client_id).maybeSingle();
    if (error) out.unreadable.push(`The client could not be read (${error.message}).`);
    else if (data) out.client = { id: data.id as string, label: data.name as string, href: `/portal/clients/${data.id as string}` };
  }

  const people = [file.assigned_tech_id, file.assigned_engineer_id].filter(Boolean) as string[];
  if (people.length) {
    const { data, error } = await db.from("eng_profiles").select("id, display_name").in("id", people);
    if (error) out.unreadable.push(`Who is assigned could not be read (${error.message}).`);
    const name = (id: string | null) => (data ?? []).find((p) => p.id === id)?.display_name as string | undefined;
    if (file.assigned_tech_id) {
      out.technician = { id: file.assigned_tech_id, label: name(file.assigned_tech_id) ?? "Assigned technician", href: `/portal/techs/${file.assigned_tech_id}` };
    }
    if (file.assigned_engineer_id) {
      /* The engineer's own record is not a screen anybody but an administrator opens, so the link is the review screen for this file. */
      out.engineer = { id: file.assigned_engineer_id, label: name(file.assigned_engineer_id) ?? "Assigned engineer", href: `/portal/review?id=${file.id}` };
    }
  }

  const { data: orders, error: ordersError } = await db
    .from("eng_service_orders")
    .select("id, reference, status, total_cents, created_at, paid_at")
    .eq("file_id", file.id)
    /* The job's order; a trip fee is reported on its own, as noAccess (0134). */
    .eq("kind", "job")
    .order("created_at", { ascending: false })
    .limit(5);
  if (ordersError) out.unreadable.push(`The order could not be read (${ordersError.message}).`);
  const order = (orders ?? []).find((o) => o.status !== "cancelled" && o.status !== "refunded") ?? (orders ?? [])[0];
  if (order) {
    const seesMoney = can(actor, "orders.read");
    out.order = { id: order.id as string, label: order.reference as string, href: `/portal/order-lookup/${order.id as string}` };
    if (seesMoney) {
      const amount = money(Number(order.total_cents));
      if (order.status === "awaiting_payment") {
        const { data: sends } = await db
          .from("eng_order_events")
          .select("created_at")
          .eq("order_id", order.id)
          .in("event", ["payment_link.resent", "email.queued"])
          .order("created_at", { ascending: false })
          .limit(1);
        out.payment = { kind: "waiting", reference: order.reference as string, amount, since: order.created_at as string, lastSent: (sends ?? [])[0]?.created_at as string | undefined ?? null };
      } else if (order.status === "paid" || order.status === "in_fulfilment" || order.status === "complete") {
        out.payment = { kind: "paid", reference: order.reference as string, amount, paidAt: (order.paid_at as string | null) ?? null };
      } else {
        out.payment = { kind: "other", reference: order.reference as string, status: String(order.status).replace(/_/g, " ") };
      }
      const { data: access, error: accessError } = await db
        .from("eng_customer_access")
        .select("last_seen_at")
        .eq("order_id", order.id)
        .not("last_seen_at", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(1);
      if (accessError) out.unreadable.push(`When the customer opened their status link could not be read (${accessError.message}).`);
      else out.statusLinkOpened = ((access ?? [])[0]?.last_seen_at as string | undefined) ?? null;
      /* The first open, written once by orderForCustomerToken (item 8). */
      const { data: first } = await db
        .from("eng_order_events")
        .select("created_at")
        .eq("order_id", order.id)
        .eq("event", "customer_link.first_opened")
        .order("created_at", { ascending: true })
        .limit(1);
      out.statusLinkFirstOpened = ((first ?? [])[0]?.created_at as string | undefined) ?? null;
    }
  } else if (!ordersError) {
    out.payment = can(actor, "orders.read") ? { kind: "none" } : null;
  }

  const { data: docs, error: docsError } = await db
    .from("eng_documents")
    .select("id, title, sealed_at, visibility")
    .eq("file_id", file.id)
    .eq("kind", "deliverable")
    .order("created_at", { ascending: false })
    .limit(10);
  if (docsError) out.unreadable.push(`The letter could not be read (${docsError.message}).`);
  /* Who else gets the letter, and whether each has opened theirs (the Killeen call, items 2 and 7). */
  const { data: contacts, error: contactsError } = await db
    .from("eng_file_contacts")
    .select("id, role, name, email, pays, eng_letter_links(last_seen_at)")
    .eq("file_id", file.id)
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  if (contactsError) out.unreadable.push(`Who else gets the letter could not be read (${contactsError.message}).`);
  out.contacts = (contacts ?? []).map((c) => {
    const opens = ((c.eng_letter_links as { last_seen_at: string | null }[] | null) ?? []).map((l) => l.last_seen_at).filter(Boolean) as string[];
    return {
      role: c.role as string,
      name: (c.name as string | null) ?? null,
      email: c.email as string,
      pays: Boolean(c.pays),
      lastOpened: opens.length ? opens.sort().at(-1) ?? null : null,
    };
  });

  out.letters = (docs ?? [])
    .filter((d) => actor.role === "admin" || d.visibility !== "admin_only")
    .map((d) => ({ id: d.id as string, label: `${d.title as string}${d.sealed_at ? " (sealed)" : ""}`, href: `/api/portal/documents?id=${d.id as string}` }));

  if (can(actor, "orders.read")) {
    const { data: t, error: tError } = await db.from("eng_files").select("travel_cents, travel_reason").eq("id", file.id).maybeSingle();
    if (tError) out.unreadable.push(`The travel on this job could not be read (${tError.message}).`);
    else if (t?.travel_cents) out.travel = { cents: Number(t.travel_cents), amount: money(Number(t.travel_cents)), reason: (t.travel_reason as string | null) ?? "" };
  }

  const access = await noAccessState(file.id);
  if (access.kind === "unknown") out.unreadable.push(`Whether a trip fee is owed could not be read (${access.error}).`);
  else out.noAccess = access;

  return out;
}

/**
 * EVERY FILE A CLIENT HAS, for the client record (the Killeen call, item 4:
 * "the client links back to every file"). Every row, through readEvery, newest
 * first; a failed read is said. files.list is the grant that opens a file.
 */
export async function filesForClient(
  actor: Actor | null,
  clientId: string,
): Promise<{ ok: true; rows: { id: string; fileNumber: string; status: FileStatus; propertyAddress: string; createdAt: string }[] } | { ok: false; error: string } | null> {
  if (!actor || !can(actor, "files.list")) return null;
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_files")
      .select("id, file_number, status, property_address, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return { ok: false, error: `This client's files could not be read: ${read.error}` };
  return {
    ok: true,
    rows: read.rows.map((r) => ({
      id: r.id as string,
      fileNumber: r.file_number as string,
      status: r.status as FileStatus,
      propertyAddress: r.property_address as string,
      createdAt: r.created_at as string,
    })),
  };
}

/**
 * EVERY FILE ASSIGNED TO A TECHNICIAN, for the technician record. The
 * every-role walk of 2026-11-14 found that record linking nowhere but back to
 * the list: the technician's credentials, and none of the jobs they hold.
 * Shaped and guarded as filesForClient is: every row, newest first, a failed
 * read said, and only for a role that may open files.
 */
export async function filesForTechnician(
  actor: Actor | null,
  techId: string,
): Promise<{ ok: true; rows: { id: string; fileNumber: string; status: FileStatus; propertyAddress: string; createdAt: string }[] } | { ok: false; error: string } | null> {
  if (!actor || !can(actor, "files.list")) return null;
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_files")
      .select("id, file_number, status, property_address, created_at")
      .eq("assigned_tech_id", techId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return { ok: false, error: `This technician's jobs could not be read: ${read.error}` };
  return {
    ok: true,
    rows: read.rows.map((r) => ({
      id: r.id as string,
      fileNumber: r.file_number as string,
      status: r.status as FileStatus,
      propertyAddress: r.property_address as string,
      createdAt: r.created_at as string,
    })),
  };
}

/**
 * THE NEXT STEP AND WHO OWNS IT. Part 1 section 3, the ladder Robert approved
 * with his answer 5 of 2026-11-14 (the operations manager owns delivery). One
 * function, so the file screen and anything later that shows a next step say
 * the same thing. Derived from the stored status and the payment state; it
 * stores nothing.
 */
export function nextStepFor(
  status: FileStatus,
  payment: PaymentState | null,
  hasTech: boolean,
  noAccess: NoAccessState | null = null,
  /** Needs travel asked and not yet answered: the link waits for the administrator. */
  travelAsked = false,
): { step: string; owner: string } {
  if (travelAsked && (payment?.kind === "none" || payment === null)) {
    return { step: "Set the travel; the payment link then goes by itself", owner: "Administrator" };
  }
  /* A visit the technician could not get into is booked again only once its trip fee is paid (0134). */
  if (status === "needs_dispatch" && noAccess?.kind === "unpaid") {
    return noAccess.tripOrder
      ? { step: "Chase the trip fee, or send its link again, then rebook", owner: "The rep who took the job" }
      : { step: "Send the trip fee link, then rebook", owner: "The rep who took the job" };
  }
  if (status === "intake") {
    if (payment?.kind === "waiting") return { step: "Chase the payment, or send the link again", owner: "The rep who took the job" };
    if (payment?.kind === "none") return { step: "Send the payment link", owner: "The rep who took the job" };
    return { step: "Release it for dispatch once it is paid or invoiced", owner: "Operations manager" };
  }
  if (status === "needs_dispatch") return { step: hasTech ? "Confirm the technician's visit" : "Offer it to a technician", owner: "Dispatcher" };
  if (status === "dispatched" || status === "evidence_in_progress" || status === "revisions_requested") {
    return { step: "Capture the evidence by its due date", owner: "Technician" };
  }
  if (status === "evidence_submitted" || status === "under_review") return { step: "Review and decide", owner: "Engineer" };
  if (status === "repairs_required") return { step: "Tell the customer what to fix and book the re-check", owner: "The rep who took the job" };
  if (status === "sealed") return { step: "Deliver the letter to the customer and every copy contact", owner: "Operations manager" };
  if (status === "delivered") return { step: "Close it once nothing is owed", owner: "Operations manager" };
  if (status === "refused" || status === "cancelled") return { step: "Settle the money, if any was taken", owner: "Administrator" };
  return { step: "Nothing further", owner: "Nobody" };
}
