import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * ===========================================================================
 * WHO ELSE IS ON A JOB: AGENT, LENDER, TITLE, AND WHO PAYS. The Killeen call,
 * item 2 (Robert, 2026-11-14), table eng_file_contacts (0132).
 * ===========================================================================
 *
 * The one place this lived was copy_to, a free text answer nothing read (Part 1
 * finding 4). Each contact here has a role and an email, so item 7 can send each
 * the letter and record that it did.
 *
 * WHO PAYS. At most one contact pays (0132's partial unique index); when none
 * does, the client pays, which is how every job worked before. payerFor is the
 * one answer, read by the payment link, so the link goes to whoever pays.
 */

export const CONTACT_ROLES = ["agent", "lender", "title", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];
export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  agent: "Agent",
  lender: "Lender",
  title: "Title company",
  other: "Somebody else",
};

export type ContactInput = { role: string; name?: string | null; email: string; pays?: boolean };
export type FileContact = { id: string; role: ContactRole; name: string | null; email: string; pays: boolean };

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+$/;

/** The same shape the table's check holds, asked before anything is written, in words the rep can read back. */
export function contactProblem(contacts: readonly ContactInput[]): { error: string; index: number } | null {
  let payers = 0;
  for (let i = 0; i < contacts.length; i += 1) {
    const c = contacts[i];
    if (!(CONTACT_ROLES as readonly string[]).includes(c.role)) return { error: `Copy contact ${i + 1}: choose agent, lender, title company or somebody else.`, index: i };
    if (!EMAIL_SHAPE.test((c.email ?? "").trim())) return { error: `Copy contact ${i + 1}: an email address is needed, because that is where the letter goes.`, index: i };
    if (c.pays) payers += 1;
  }
  if (payers > 1) return { error: "Only one person pays. Choose one copy contact to pay, or the caller.", index: -1 };
  return null;
}

/** Writes the contacts for a newly taken file. The caller has already asked contactProblem. */
export async function addFileContacts(
  fileId: string,
  contacts: readonly ContactInput[],
  addedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (contacts.length === 0) return { ok: true };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { error } = await db.from("eng_file_contacts").insert(
    contacts.map((c) => ({
      file_id: fileId,
      role: c.role,
      name: c.name?.trim() || null,
      email: c.email.trim(),
      pays: Boolean(c.pays),
      added_by: addedBy,
    })),
  );
  return error ? { ok: false, error: `The copy contacts could not be saved: ${error.message}` } : { ok: true };
}

/** The contacts still on a file. A failed read is said, never shown as nobody. */
export async function fileContacts(fileId: string): Promise<{ ok: true; rows: FileContact[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_file_contacts")
    .select("id, role, name, email, pays")
    .eq("file_id", fileId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: `Who else is on this job could not be read: ${error.message}` };
  return {
    ok: true,
    rows: (data ?? []).map((r) => ({ id: r.id as string, role: r.role as ContactRole, name: (r.name as string | null) ?? null, email: r.email as string, pays: Boolean(r.pays) })),
  };
}

/**
 * WHO THE PAYMENT LINK GOES TO. The paying contact when there is one, the
 * client otherwise. A failed read of the contacts refuses rather than falling
 * back to the client, because sending a bill to the wrong person is the error
 * this exists to stop.
 */
export async function payerFor(
  fileId: string,
  client: { name: string; email: string | null; phone: string | null },
): Promise<{ ok: true; name: string; email: string | null; phone: string | null; isClient: boolean } | { ok: false; error: string }> {
  const contacts = await fileContacts(fileId);
  if (!contacts.ok) return contacts;
  const payer = contacts.rows.find((c) => c.pays);
  if (!payer) return { ok: true, ...client, isClient: true };
  return { ok: true, name: payer.name ?? CONTACT_ROLE_LABEL[payer.role], email: payer.email, phone: null, isClient: false };
}
