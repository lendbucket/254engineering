import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery } from "./bounded-read";
import { writeAuditOrRefuse } from "./ops-audit";

/**
 * THE ONE INBOX. Operator ruling, 2026-10-20. 0079: inbox.read, inbox.answer.
 *
 * Everything that arrives from a customer or a prospective one, in one list,
 * oldest unanswered first: contact form and waitlist leads, design inquiries,
 * windstorm inquiries. Each opens where its detail already lives.
 *
 * CUSTOMER REPLIES ARE NOT HERE, AND THE SCREEN SAYS SO. An email a customer
 * sends back goes to the firm's support mailbox: there is no inbound email
 * route in this platform, so nothing can put a reply in this list. The ruling
 * is "customer replies as they exist today", and today they exist in that
 * mailbox. Building the route is the staff roles plan's named requirement.
 *
 * Every read is the whole set (readEvery), and a read that fails is said, not
 * shown as an empty inbox: an inbox that reads empty during an outage is the
 * screen telling a rep nobody is waiting.
 */

export type InboxKind = "contact" | "waitlist" | "design" | "windstorm";

export type InboxItem = {
  kind: InboxKind;
  id: string;
  receivedAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  summary: string;
  /** When the firm said it would respond, where a promise was recorded. */
  respondBy: string | null;
  answered: boolean;
  /** When it was answered, where that is recorded. A lead records only that it was contacted, not when. */
  answeredAt: string | null;
  href: string;
};

type UntypedRows = { data: Record<string, unknown>[] | null; count: number | null; error: { message: string } | null };

export type InboxRead = { ok: true; items: InboxItem[]; failed: string[] } | { ok: false; error: string };


export async function inbox(actor: Actor | null, opts: { includeAnswered: boolean }): Promise<InboxRead> {
  if (!can(actor, "inbox.read")) return { ok: false, error: "Your role cannot open the inbox." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so the inbox could not be read." };

  const failed: string[] = [];
  const items: InboxItem[] = [];

  const leads = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_leads")
      .select("id, created_at, form, name, email, phone, company, city, service, message, status")
      .neq("status", "converted")
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  if (!leads.ok) failed.push(`Contact and waitlist submissions could not be read: ${leads.error}`);
  else {
    for (const l of leads.rows) {
      const answered = l.status === "contacted";
      if (answered && !opts.includeAnswered) continue;
      const kind: InboxKind = l.form === "waitlist" ? "waitlist" : "contact";
      items.push({
        kind,
        id: String(l.id),
        receivedAt: String(l.created_at),
        name: String(l.name ?? l.company ?? "No name given"),
        email: (l.email as string | null) ?? null,
        phone: (l.phone as string | null) ?? null,
        summary: [l.company, l.service, l.city, l.message].filter(Boolean).join(". ").slice(0, 240),
        respondBy: null,
        answered,
        answeredAt: null,
        href: "/portal/clients",
      });
    }
  }

  for (const source of [
    { kind: "design" as const, table: "eng_design_inquiries", cols: "id, created_at, name, email, phone, property_address, deliverable, respond_by, responded_at", href: "/portal/inquiries" },
    { kind: "windstorm" as const, table: "eng_windstorm_inquiries", cols: "id, created_at, name, email, phone, property_address, work_done, respond_by, responded_at", href: "/portal/windstorm-inquiries" },
  ]) {
    const read = await readEvery<Record<string, unknown>>((from, to) => {
      let q = db.from(source.table).select(source.cols);
      if (!opts.includeAnswered) q = q.is("responded_at", null);
      /* The select names a variable column list, which the client cannot type, so the row shape is stated. */
      return q.order("respond_by", { ascending: true }).range(from, to) as unknown as PromiseLike<UntypedRows>;
    });
    if (!read.ok) {
      failed.push(`${source.kind === "design" ? "Design" : "Windstorm"} inquiries could not be read: ${read.error}`);
      continue;
    }
    for (const r of read.rows) {
      items.push({
        kind: source.kind,
        id: String(r.id),
        receivedAt: String(r.created_at),
        name: String(r.name),
        email: (r.email as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        summary: [r.property_address, r.deliverable ?? r.work_done].filter(Boolean).join(". ").slice(0, 240),
        respondBy: (r.respond_by as string | null) ?? null,
        answered: r.responded_at !== null && r.responded_at !== undefined,
        answeredAt: (r.responded_at as string | null) ?? null,
        href: `${source.href}?id=${String(r.id)}`,
      });
    }
  }

  /* Unanswered first, then the promise that runs out soonest, then the oldest. */
  items.sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    const ad = a.respondBy ?? a.receivedAt;
    const bd = b.respondBy ?? b.receivedAt;
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
  return { ok: true, items, failed };
}

/**
 * How many are waiting, for the tab title, and how many of those arrived after
 * a moment, so a screen rendered at that moment knows whether it is missing a
 * row. One read for both. Null means it could not be counted.
 */
export async function inboxCountsSince(
  actor: Actor | null,
  sinceMs: number,
): Promise<{ waiting: number; since: number } | null> {
  const read = await inbox(actor, { includeAnswered: false });
  if (!read.ok || read.failed.length) return null;
  const since = read.items.filter((i) => Date.parse(i.receivedAt) > sinceMs).length;
  return { waiting: read.items.length, since };
}

/**
 * Mark a contact or waitlist lead as contacted. A design or windstorm inquiry
 * is answered from its own screen, which records who responded and when in its
 * own columns; a lead has only a status, so who answered is in the audit row.
 */
export async function markLeadContacted(actor: Actor | null, leadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "inbox.answer")) return { ok: false, error: "Your role cannot answer the inbox." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was changed." };
  const { data: lead, error } = await db.from("eng_leads").select("id, name, status").eq("id", leadId).maybeSingle();
  if (error) return { ok: false, error: `The submission could not be read: ${error.message}` };
  if (!lead) return { ok: false, error: "That submission does not exist." };
  if (lead.status === "converted") return { ok: false, error: "That lead is already a client." };

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "lead.contacted",
    entityType: "lead",
    entityId: leadId,
    summary: `${String(lead.name ?? "A lead")} marked contacted.`,
  });
  if (!recorded.ok) return recorded;
  const { error: updateError } = await db.from("eng_leads").update({ status: "contacted" }).eq("id", leadId);
  if (updateError) return { ok: false, error: `The change could not be saved: ${updateError.message}` };
  return { ok: true };
}
