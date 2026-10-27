import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery, readEveryIn } from "./bounded-read";
import type { BillRow } from "./billing-rules";
import type { PaymentIntent } from "./job-intake-rules";

/**
 * EVERY JOB NOT YET PAID, WITH ITS CLIENT AND WHETHER THE CLIENT CAN BE
 * INVOICED, for the payment links screen and its CSV (W2, Robert 2026-10-27).
 *
 * The owner or the administrator only, on payments.charge, which is the grant
 * the door asks to invoice an account and one of the two it accepts for a link.
 * Robert's words for every W2 screen were "owner or admin only and audited":
 * the reading is not audited, and every send is, by the door it calls
 * (order.raised_for_file, file.payment_link_sent, file.invoiced).
 *
 * Every row is read, never a first page: a staff money list that stops at a
 * transport cap shows a short list as if it were the whole (bounded-read.ts).
 * A failed read is said, never shown as nothing to bill. Demonstration files are
 * left out by their own flag.
 */
export type BillRead = { ok: true; rows: BillRow[] } | { ok: false; error: string };

export async function listBillableJobs(actor: Actor | null): Promise<BillRead> {
  if (!actor || !can(actor, "payments.charge")) return { ok: false, error: "Only the owner or the administrator bills a job." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const files = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_files")
      .select(
        "id, file_number, created_at, status, service_slug, deliverable, property_address, county, client_price_cents, payment_intent, payment_note, client_id",
      )
      .neq("payment_intent", "paid")
      .not("is_demo", "is", true)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  if (!files.ok) return { ok: false, error: `The jobs could not be read: ${files.error}` };

  const clientIds = [...new Set(files.rows.map((f) => f.client_id as string).filter(Boolean))];
  const clients = await readEveryIn<Record<string, unknown>>(clientIds, (chunk, from, to) =>
    db.from("eng_clients").select("id, name, email, phone").in("id", chunk as string[]).order("id").range(from, to),
  );
  if (!clients.ok) return { ok: false, error: `The clients could not be read: ${clients.error}` };

  /* Read the way invoiceAccount reads it: not superseded, oldest first, the first one counts. */
  const accounts = await readEveryIn<Record<string, unknown>>(clientIds, (chunk, from, to) =>
    db
      .from("eng_customer_accounts")
      .select("client_id, status, billing_mode, created_at, id")
      .in("client_id", chunk as string[])
      .is("superseded_at", null)
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, to),
  );
  if (!accounts.ok) return { ok: false, error: `The ordering accounts could not be read: ${accounts.error}` };

  const clientById = new Map(clients.rows.map((c) => [c.id as string, c]));
  const firstAccount = new Map<string, Record<string, unknown>>();
  for (const a of [...accounts.rows].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))) {
    if (!firstAccount.has(a.client_id as string)) firstAccount.set(a.client_id as string, a);
  }

  return {
    ok: true,
    rows: files.rows.map((f) => {
      const client = clientById.get(f.client_id as string);
      const account = firstAccount.get(f.client_id as string);
      return {
        id: f.id as string,
        fileNumber: f.file_number as string,
        createdAt: f.created_at as string,
        status: f.status as string,
        serviceSlug: f.service_slug as string,
        deliverable: (f.deliverable as string | null) ?? null,
        propertyAddress: (f.property_address as string) ?? "",
        county: (f.county as string) ?? "",
        priceCents: f.client_price_cents === null || f.client_price_cents === undefined ? null : Number(f.client_price_cents),
        paymentIntent: f.payment_intent as PaymentIntent,
        paymentNote: (f.payment_note as string | null) ?? null,
        clientName: (client?.name as string | undefined) ?? "Client not found",
        clientEmail: (client?.email as string | null | undefined) ?? null,
        clientPhone: (client?.phone as string | null | undefined) ?? null,
        accountCanInvoice: Boolean(account && account.status === "active" && account.billing_mode === "invoice"),
      };
    }),
  };
}
