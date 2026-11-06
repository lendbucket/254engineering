import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import {
  CONTACT_OUTCOMES,
  type ContactChannel,
  type ContactOutcome,
  type ContactSubject,
} from "./contact-log-rules";
import { ACTIVITY_KINDS, CRM_OUTCOMES, CRM_STAGES, type ActivityKind, type CrmOutcome, type CrmStage } from "./crm-rules";

/**
 * THE CALL LOG. Operator ruling, 2026-10-20. 0079.
 *
 * One table for every call, email and note against a prospect, a client, an
 * order or a file. Append only at the database: a record of a call that can be
 * edited afterwards is not a record of the call, so a correction is a second
 * entry that says so.
 *
 * Office ready: a call log entry is one click from any record, so this is the
 * one function every record's panel calls.
 */

export type ContactEntry = {
  id: string;
  createdAt: string;
  byName: string | null;
  channel: ContactChannel;
  direction: "outbound" | "inbound" | null;
  outcome: ContactOutcome | null;
  body: string | null;
  visitAt: string | null;
  followUpOn: string | null;
};

const COLUMN: Record<ContactSubject, string> = {
  prospect: "prospect_id",
  client: "client_id",
  order: "order_id",
  file: "file_id",
};

const TABLE: Record<ContactSubject, string> = {
  prospect: "eng_prospects",
  client: "eng_clients",
  order: "eng_service_orders",
  file: "eng_files",
};

/** Whether this actor may READ the log on this kind of record. Writing is contact_log.write. */
export function canReadContactLog(actor: Actor | null, subject: ContactSubject): boolean {
  if (subject === "prospect") return can(actor, "crm.use");
  if (subject === "order") return can(actor, "orders.read") || can(actor, "payments.reconcile");
  if (subject === "client") return can(actor, "clients.list");
  return can(actor, "files.list");
}

export async function logContact(
  actor: Actor | null,
  input: {
    subject: ContactSubject;
    subjectId: string;
    channel: ContactChannel;
    direction?: "outbound" | "inbound" | null;
    outcome?: ContactOutcome | null;
    body?: string | null;
    visitAt?: string | null;
    followUpOn?: string | null;
    /*
     * The sales CRM's activity fields, 0112 (Robert, 2026-11-02, R1): every
     * call, email, note and stage change on a prospect is a row of this log,
     * so these ride on the one writer rather than a second table. Each is
     * prospect only, and 0112's checks refuse them on anything else.
     */
    crm?: {
      activityKind?: ActivityKind;
      crmOutcome?: CrmOutcome | null;
      callbackAt?: string | null;
      stageFrom?: CrmStage | null;
      stageTo?: CrmStage | null;
      notInterestedReason?: string | null;
      contactId?: string | null;
    };
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "contact_log.write")) return { ok: false, error: "Your role cannot record a call or a note." };
  if (!canReadContactLog(actor, input.subject)) return { ok: false, error: "Your role cannot open this record." };
  if (!(input.subject in COLUMN)) return { ok: false, error: "That is not something a call can be logged against." };
  if (!["call", "email", "note"].includes(input.channel)) return { ok: false, error: "A call, an email or a note." };

  const body = input.body?.trim() || null;
  const isNote = input.channel === "note";
  const direction = isNote ? null : input.direction ?? "outbound";
  const outcome = isNote ? null : input.outcome ?? null;
  if (outcome && !(CONTACT_OUTCOMES as readonly string[]).includes(outcome)) return { ok: false, error: "That outcome is not one the log records." };
  if (isNote && !body) return { ok: false, error: "A note needs some words in it." };

  const visitAt = input.visitAt?.trim() || null;
  if (visitAt) {
    if (input.subject !== "file" || input.channel !== "call") {
      return { ok: false, error: "A visit time is agreed on a call about a job." };
    }
    if (Number.isNaN(Date.parse(visitAt))) return { ok: false, error: "The visit time is not a date and time." };
  }
  const followUpOn = input.followUpOn?.trim() || null;
  if (followUpOn && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(followUpOn)) return { ok: false, error: "The follow-up date is not a date." };

  const crm = input.crm ?? null;
  const crmRow: Record<string, unknown> = {};
  if (crm) {
    if (input.subject !== "prospect") return { ok: false, error: "A sales activity is recorded against a company on the sales list." };
    const kind = crm.activityKind ?? input.channel;
    if (!(ACTIVITY_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "That is not an activity the sales list records." };
    if (crm.crmOutcome && !(CRM_OUTCOMES as readonly string[]).includes(crm.crmOutcome)) return { ok: false, error: "That is not a call outcome the sales list records." };
    const isStageChange = kind === "stage_change";
    if (isStageChange !== Boolean(crm.stageTo)) return { ok: false, error: "A stage change names the stage it moved to, and only a stage change does." };
    if (isStageChange && input.channel !== "note") return { ok: false, error: "A stage change is recorded as a note." };
    for (const s of [crm.stageFrom, crm.stageTo]) {
      if (s && !(CRM_STAGES as readonly string[]).includes(s)) return { ok: false, error: "That is not a stage on the sales list." };
    }
    const callbackAt = crm.callbackAt?.trim() || null;
    if ((crm.crmOutcome === "callback") !== Boolean(callbackAt)) return { ok: false, error: "A callback needs the date and time to call back, and only a callback has one." };
    if (callbackAt && Number.isNaN(Date.parse(callbackAt))) return { ok: false, error: "The callback time is not a date and time." };
    const reason = crm.notInterestedReason?.trim() || null;
    if (crm.crmOutcome === "not_interested" && !reason) return { ok: false, error: "Say why they are not interested." };
    Object.assign(crmRow, {
      activity_kind: kind,
      crm_outcome: crm.crmOutcome ?? null,
      callback_at: callbackAt,
      stage_from: crm.stageFrom ?? null,
      stage_to: crm.stageTo ?? null,
      not_interested_reason: reason,
      contact_id: crm.contactId ?? null,
    });
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was recorded." };

  const { data: subject, error: subjectError } = await db
    .from(TABLE[input.subject])
    .select("id")
    .eq("id", input.subjectId)
    .maybeSingle();
  if (subjectError) return { ok: false, error: `The record could not be read: ${subjectError.message}` };
  if (!subject) return { ok: false, error: "That record does not exist." };

  const recorded = await writeAuditOrRefuse({
    actor,
    action: `contact.${input.channel}_logged`,
    entityType: input.subject,
    entityId: input.subjectId,
    summary:
      `${input.channel === "note" ? "Note" : input.channel === "call" ? "Call" : "Email"} logged` +
      (outcome ? `, ${outcome.replace(/_/g, " ")}` : "") +
      (visitAt ? `, visit time ${visitAt}` : "") +
      ".",
  });
  if (!recorded.ok) return recorded;

  const { data, error } = await db
    .from("eng_contact_log")
    .insert({
      by_id: actor.id,
      subject_type: input.subject,
      [COLUMN[input.subject]]: input.subjectId,
      channel: input.channel,
      direction,
      outcome: visitAt ? "visit_time_set" : outcome,
      body,
      visit_at: visitAt,
      follow_up_on: followUpOn,
      ...crmRow,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `The entry could not be saved: ${error?.message ?? "no row"}` };

  /* A follow-up date on a prospect's entry moves the prospect's own date, which the call list sorts on. */
  if (input.subject === "prospect" && (followUpOn || outcome === "not_interested")) {
    const patch: Record<string, unknown> = {};
    if (followUpOn) patch.follow_up_on = followUpOn;
    /* A refusal is dormant as well as not interested: 0112's eng_prospects_refusal_is_closed holds the pair together. */
    if (outcome === "not_interested") Object.assign(patch, { status: "not_interested", stage: "dormant" });
    const { error: moveError } = await db.from("eng_prospects").update(patch).eq("id", input.subjectId).eq("status", "open");
    if (moveError) {
      return { ok: false, error: `The call was logged and the prospect's follow-up could not be moved: ${moveError.message}` };
    }
  }
  return { ok: true, id: String(data.id) };
}

export async function contactLogFor(
  actor: Actor | null,
  subject: ContactSubject,
  subjectId: string,
): Promise<{ ok: true; rows: ContactEntry[] } | { ok: false; error: string }> {
  if (!canReadContactLog(actor, subject)) return { ok: false, error: "Your role cannot open this record's history." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so the history could not be read." };
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_contact_log")
      .select("id, created_at, channel, direction, outcome, body, visit_at, follow_up_on, by:eng_profiles!eng_contact_log_by_id_fkey(display_name)")
      .eq(COLUMN[subject], subjectId)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (!read.ok) return { ok: false, error: `The history could not be read: ${read.error}` };
  return {
    ok: true,
    rows: read.rows.map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      byName: ((r.by as { display_name?: string } | null)?.display_name) ?? null,
      channel: r.channel as ContactChannel,
      direction: (r.direction as "outbound" | "inbound" | null) ?? null,
      outcome: (r.outcome as ContactOutcome | null) ?? null,
      body: (r.body as string | null) ?? null,
      visitAt: (r.visit_at as string | null) ?? null,
      followUpOn: (r.follow_up_on as string | null) ?? null,
    })),
  };
}
