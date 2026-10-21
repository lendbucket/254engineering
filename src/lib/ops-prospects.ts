import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import { DB_NOW } from "./db-now";
import { createCustomerAccount } from "./account-creation";
import { doorFor } from "./account-doors";
import {
  PROSPECT_TYPES,
  readProspectFile,
  sameProspectKeys,
  type ProspectType,
} from "./prospect-import";

/**
 * THE SALES LIST. Operator ruling, 2026-10-20. 0079.
 *
 * Prospects are companies the firm is calling that are not yet customers:
 * roofers, real estate agents, title companies and contractors. A rep imports
 * them from a spreadsheet, works a daily call list sorted by follow-up date,
 * logs every call and email, and converts one into a commercial account with a
 * click.
 *
 * Calls and email only. Texting a prospect needs a recorded opt-in, which
 * nothing here records, so nothing here texts.
 */

export type ProspectStatus = "open" | "converted" | "not_interested";

export type ProspectRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  prospectType: ProspectType;
  status: ProspectStatus;
  followUpOn: string | null;
  ownerId: string | null;
  ownerName: string | null;
  convertedAccountId: string | null;
  lastContactAt: string | null;
};

export type ProspectSort = "follow_up" | "company" | "city" | "created" | "last_contact";

export type ProspectQuery = {
  search?: string;
  status?: ProspectStatus | "all";
  type?: ProspectType | "all";
  city?: string;
  owner?: string | "mine" | "unowned" | "all";
  sort?: ProspectSort;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const SELECT =
  "id, created_at, updated_at, company, contact_name, phone, email, city, prospect_type, status, follow_up_on, owner_id, converted_account_id, owner:eng_profiles!eng_prospects_owner_id_fkey(display_name)";

const refuse = (error: string) => ({ ok: false as const, error });

function rowFrom(r: Record<string, unknown>, lastContact: Map<string, string>): ProspectRow {
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    company: String(r.company),
    contactName: (r.contact_name as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    prospectType: r.prospect_type as ProspectType,
    status: r.status as ProspectStatus,
    followUpOn: (r.follow_up_on as string | null) ?? null,
    ownerId: (r.owner_id as string | null) ?? null,
    ownerName: ((r.owner as { display_name?: string } | null)?.display_name) ?? null,
    convertedAccountId: (r.converted_account_id as string | null) ?? null,
    lastContactAt: lastContact.get(String(r.id)) ?? null,
  };
}

/** The newest contact log entry per prospect, for the "last contact" column and sort. */
async function lastContactFor(ids: string[]): Promise<{ ok: true; map: Map<string, string> } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const read = await readEvery<{ prospect_id: string; created_at: string }>((from, to) =>
      db
        .from("eng_contact_log")
        .select("prospect_id, created_at")
        .in("prospect_id", chunk)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    if (!read.ok) return refuse(`The contact history could not be read: ${read.error}`);
    for (const r of read.rows) if (!map.has(r.prospect_id)) map.set(r.prospect_id, r.created_at);
  }
  return { ok: true, map };
}

/**
 * The list, sorted, filtered, searched and paged on the server. Every prospect
 * matching the filter is read and counted, so the total on the screen is a
 * count of the set rather than of a page.
 */
export async function listProspects(
  actor: Actor | null,
  q: ProspectQuery,
): Promise<{ ok: true; rows: ProspectRow[]; total: number; page: number; pageSize: number } | { ok: false; error: string }> {
  if (!can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the sales list could not be read.");

  const read = await readEvery<Record<string, unknown>>((from, to) => {
    let query = db.from("eng_prospects").select(SELECT);
    const status = q.status ?? "open";
    if (status !== "all") query = query.eq("status", status);
    if (q.type && q.type !== "all") query = query.eq("prospect_type", q.type);
    if (q.city?.trim()) query = query.ilike("city", q.city.trim());
    if (q.owner === "mine" && actor) query = query.eq("owner_id", actor.id);
    else if (q.owner === "unowned") query = query.is("owner_id", null);
    else if (q.owner && q.owner !== "all") query = query.eq("owner_id", q.owner);
    return query.order("created_at", { ascending: true }).range(from, to);
  });
  if (!read.ok) return refuse(`The sales list could not be read: ${read.error}`);

  const needle = (q.search ?? "").trim().toLowerCase();
  const digits = needle.replace(/[^0-9]/g, "");
  const matched = needle
    ? read.rows.filter((r) => {
        const hay = [r.company, r.contact_name, r.email, r.city].map((v) => String(v ?? "").toLowerCase());
        if (hay.some((h) => h.includes(needle))) return true;
        return digits.length >= 3 && String(r.phone ?? "").replace(/[^0-9]/g, "").includes(digits);
      })
    : read.rows;

  const last = await lastContactFor(matched.map((r) => String(r.id)));
  if (!last.ok) return last;
  const rows = matched.map((r) => rowFrom(r, last.map));

  const sort = q.sort ?? "follow_up";
  const dir = q.direction === "desc" ? -1 : 1;
  const key = (r: ProspectRow): string => {
    if (sort === "company") return r.company.toLowerCase();
    if (sort === "city") return (r.city ?? "").toLowerCase();
    if (sort === "created") return r.createdAt;
    if (sort === "last_contact") return r.lastContactAt ?? "";
    /* No follow-up date sorts after every dated one, in either direction. */
    return r.followUpOn ?? (dir === 1 ? "9999-12-31" : "0000-01-01");
  };
  rows.sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : a.company.localeCompare(b.company)));

  const pageSize = Math.min(Math.max(q.pageSize ?? 50, 10), 200);
  const page = Math.max(1, q.page ?? 1);
  return { ok: true, rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

/**
 * TODAY'S CALL LIST: every open prospect whose follow-up date is today or has
 * passed, oldest date first, so the one that has waited longest is called
 * first. The date is the firm's calendar, America/Chicago, not the server's.
 *
 * `mineOnly` is the rep's home screen: their own prospects and the ones
 * nobody owns yet. The full list is the manager's.
 */
export async function callList(
  actor: Actor | null,
  opts: { mineOnly: boolean },
): Promise<{ ok: true; today: string; rows: ProspectRow[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the call list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the call list could not be read.");
  const today = todayInFirmCalendar();

  const read = await readEvery<Record<string, unknown>>((from, to) => {
    let query = db.from("eng_prospects").select(SELECT).eq("status", "open").lte("follow_up_on", today);
    if (opts.mineOnly) query = query.or(`owner_id.eq.${actor.id},owner_id.is.null`);
    return query.order("follow_up_on", { ascending: true }).order("company", { ascending: true }).range(from, to);
  });
  if (!read.ok) return refuse(`The call list could not be read: ${read.error}`);
  const last = await lastContactFor(read.rows.map((r) => String(r.id)));
  if (!last.ok) return last;
  return { ok: true, today, rows: read.rows.map((r) => rowFrom(r, last.map)) };
}

export async function prospectById(
  actor: Actor | null,
  id: string,
): Promise<{ ok: true; row: ProspectRow | null } | { ok: false; error: string }> {
  if (!can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const { data, error } = await db.from("eng_prospects").select(SELECT).eq("id", id).maybeSingle();
  if (error) return refuse(`The prospect could not be read: ${error.message}`);
  if (!data) return { ok: true, row: null };
  const last = await lastContactFor([id]);
  if (!last.ok) return last;
  return { ok: true, row: rowFrom(data as Record<string, unknown>, last.map) };
}

export type ProspectInput = {
  company: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  prospectType: string;
  followUpOn?: string | null;
};

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function cleanInput(input: ProspectInput): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const company = input.company?.trim();
  if (!company) return refuse("A prospect needs a company name.");
  if (!(PROSPECT_TYPES as readonly string[]).includes(input.prospectType)) return refuse("Choose roofer, agent, title or contractor.");
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  if (!phone && !email) return refuse("A prospect needs a phone number or an email address, or nobody can reach them.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return refuse("That email address is not valid.");
  const followUpOn = input.followUpOn?.trim() || null;
  if (followUpOn && !DATE.test(followUpOn)) return refuse("The follow-up date is not a date.");
  return {
    ok: true,
    row: {
      company,
      contact_name: input.contactName?.trim() || null,
      phone,
      email,
      city: input.city?.trim() || null,
      prospect_type: input.prospectType,
      follow_up_on: followUpOn,
    },
  };
}

export async function createProspect(
  actor: Actor | null,
  input: ProspectInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot add to the sales list.");
  const clean = cleanInput(input);
  if (!clean.ok) return clean;
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was added.");

  const existing = await existingKeys();
  if (!existing.ok) return existing;
  const dupe = sameProspectKeys({ email: clean.row.email as string | null, phone: clean.row.phone as string | null }).find((k) => existing.keys.has(k));
  if (dupe) return refuse(`That ${dupe.startsWith("e:") ? "email" : "phone number"} is already on the sales list. Open the prospect rather than adding a second one.`);

  const id = randomUUID();
  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.created",
    entityType: "prospect",
    entityId: id,
    summary: `Prospect added: ${clean.row.company as string}.`,
  });
  if (!recorded.ok) return recorded;
  const { error } = await db.from("eng_prospects").insert({ id, ...clean.row, owner_id: actor.id, created_by: actor.id });
  if (error) return refuse(`The prospect could not be saved: ${error.message}`);
  return { ok: true, id };
}

export async function updateProspect(
  actor: Actor | null,
  id: string,
  change: { followUpOn?: string | null; ownerId?: string | null; status?: "open" | "not_interested"; details?: ProspectInput },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const current = await prospectById(actor, id);
  if (!current.ok) return current;
  if (!current.row) return refuse("That prospect does not exist.");
  if (current.row.status === "converted") return refuse("This prospect is already a customer. Change the account instead.");

  const patch: Record<string, unknown> = {};
  if (change.followUpOn !== undefined) {
    if (change.followUpOn && !DATE.test(change.followUpOn)) return refuse("The follow-up date is not a date.");
    patch.follow_up_on = change.followUpOn || null;
  }
  if (change.ownerId !== undefined) patch.owner_id = change.ownerId || null;
  if (change.status !== undefined) {
    if (change.status !== "open" && change.status !== "not_interested") return refuse("That status cannot be set by hand.");
    patch.status = change.status;
  }
  if (change.details) {
    const clean = cleanInput(change.details);
    if (!clean.ok) return clean;
    Object.assign(patch, clean.row);
  }
  if (Object.keys(patch).length === 0) return refuse("Nothing to change.");

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.updated",
    entityType: "prospect",
    entityId: id,
    summary: `Prospect ${current.row.company} changed: ${Object.keys(patch).join(", ")}.`,
    diff: patch,
  });
  if (!recorded.ok) return recorded;
  const { error } = await db.from("eng_prospects").update(patch).eq("id", id);
  if (error) return refuse(`The change could not be saved: ${error.message}`);
  return { ok: true };
}

/** Every email and phone already on the list, for duplicate checks. */
async function existingKeys(): Promise<{ ok: true; keys: Set<string> } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const read = await readEvery<{ email: string | null; phone: string | null }>((from, to) =>
    db.from("eng_prospects").select("email, phone").order("id").range(from, to),
  );
  if (!read.ok) return refuse(`The sales list could not be read to check for duplicates: ${read.error}`);
  const keys = new Set<string>();
  for (const r of read.rows) for (const k of sameProspectKeys(r)) keys.add(k);
  return { ok: true, keys };
}

export type ImportResult = {
  batchId: string;
  imported: number;
  /** One line per row that did not import, with the reason. */
  refused: { line: number; reason: string }[];
};

/**
 * Import a CSV. `dryRun` reads and checks every row and writes nothing, which
 * is the preview the screen shows before anybody commits a file.
 */
export async function importProspects(
  actor: Actor | null,
  input: { csv: string; defaultType: string | null; dryRun: boolean },
): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot import prospects.");
  const defaultType =
    input.defaultType && (PROSPECT_TYPES as readonly string[]).includes(input.defaultType) ? (input.defaultType as ProspectType) : null;
  const parsed = readProspectFile(input.csv, defaultType);
  if (parsed.error) return refuse(parsed.error);

  const existing = await existingKeys();
  if (!existing.ok) return existing;

  const refused: { line: number; reason: string }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const seen = new Set(existing.keys);
  const batchId = randomUUID();
  for (const row of parsed.rows) {
    if (!row.ok) {
      refused.push({ line: row.line, reason: row.reason });
      continue;
    }
    const keys = sameProspectKeys(row.prospect);
    if (keys.some((k) => seen.has(k))) {
      refused.push({ line: row.line, reason: `${row.prospect.company} is already on the list, or appears twice in this file.` });
      continue;
    }
    keys.forEach((k) => seen.add(k));
    toInsert.push({
      company: row.prospect.company,
      contact_name: row.prospect.contactName,
      phone: row.prospect.phone,
      email: row.prospect.email,
      city: row.prospect.city,
      prospect_type: row.prospect.prospectType,
      follow_up_on: todayInFirmCalendar(),
      owner_id: actor.id,
      created_by: actor.id,
      import_batch_id: batchId,
    });
  }

  if (input.dryRun) return { ok: true, result: { batchId, imported: toInsert.length, refused } };
  if (toInsert.length === 0) return { ok: true, result: { batchId, imported: 0, refused } };

  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was imported.");
  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.imported",
    entityType: "prospect_import",
    entityId: batchId,
    summary: `${toInsert.length} prospects imported, ${refused.length} rows not imported.`,
    diff: { imported: toInsert.length, refused: refused.length },
  });
  if (!recorded.ok) return recorded;

  for (let i = 0; i < toInsert.length; i += 500) {
    const { error } = await db.from("eng_prospects").insert(toInsert.slice(i, i + 500));
    if (error) {
      return refuse(
        `${i} of ${toInsert.length} rows were imported and the rest could not be saved: ${error.message}. ` +
          `Those ${i} are batch ${batchId}; import the file again and they will be listed as already on the list.`,
      );
    }
  }
  return { ok: true, result: { batchId, imported: toInsert.length, refused } };
}

/**
 * ONE CLICK FROM PROSPECT TO COMMERCIAL ACCOUNT.
 *
 * Through the operator door that already exists (account-doors.ts), so the
 * account is made exactly as one opened from a call is: a client, a customer
 * user, and an account with card billing and NO credit. Terms and credit are
 * accounts.manage, the administrator's, and nothing here sets them.
 *
 * The welcome email with the set password link goes to the prospect's address.
 * From development that is only ever an @audit-probe.invalid address.
 */
export async function convertProspect(
  actor: (Actor & { email: string }) | null,
  id: string,
): Promise<
  | { ok: true; accountId: string; clientId: string; link: { token: string; expiresIn: string } | null; email: string; displayName: string }
  | { ok: false; error: string }
> {
  if (!actor || !can(actor, "crm.use") || !can(actor, "clients.create")) return refuse("Your role cannot convert a prospect.");
  const current = await prospectById(actor, id);
  if (!current.ok) return current;
  const p = current.row;
  if (!p) return refuse("That prospect does not exist.");
  if (p.status === "converted") return refuse("This prospect is already a customer.");
  if (!p.email) return refuse("An account is opened against an email address, and this prospect has none. Add one first.");

  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was converted.");

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.converting",
    entityType: "prospect",
    entityId: id,
    summary: `Converting prospect ${p.company} into a commercial account.`,
  });
  if (!recorded.ok) return recorded;

  const created = await createCustomerAccount({
    email: p.email,
    displayName: p.contactName || p.company,
    organisation: p.company,
    phone: p.phone,
    origin: doorFor("operator_created").origin,
    actor: { id: actor.id, email: actor.email, role: actor.role },
  });
  if (!created.ok) {
    return refuse(
      created.error === "already_exists"
        ? "That email address already has an account. Open it from the account list and mark this prospect not interested."
        : created.error,
    );
  }

  const { data: account, error: accountError } = await db
    .from("eng_customer_accounts")
    .select("id, client_id")
    .eq("id", created.accountId)
    .is("superseded_at", null)
    .maybeSingle();
  if (accountError || !account) {
    return refuse(`The account was opened and could not be read back to link this prospect: ${accountError?.message ?? "no row"}.`);
  }

  const { error } = await db
    .from("eng_prospects")
    .update({
      status: "converted",
      converted_at: DB_NOW,
      converted_by: actor.id,
      converted_client_id: account.client_id,
      converted_account_id: account.id,
    })
    .eq("id", id);
  if (error) return refuse(`The account was opened and the prospect could not be marked converted: ${error.message}`);

  await writeAuditOrRefuse({
    actor,
    action: "prospect.converted",
    entityType: "prospect",
    entityId: id,
    summary: `Prospect ${p.company} converted into account ${String(account.id)}.`,
    diff: { account_id: account.id, client_id: account.client_id },
  });
  return {
    ok: true,
    accountId: String(account.id),
    clientId: String(account.client_id),
    link: created.link,
    email: p.email,
    displayName: p.contactName || p.company,
  };
}
