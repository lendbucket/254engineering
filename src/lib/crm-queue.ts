import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery } from "./bounded-read";
import { DB_NOW } from "./db-now";
import { logContact } from "./ops-contact-log";
import { normaliseEmail, suppress } from "./marketing-suppression";
import { lineIsSellableForDisplay } from "./line-gate";
import { SCRIPT_LINE } from "@/content/crm-scripts";
import { scriptFor, type RenderedScript } from "./crm-script-render";
import { STAGE_LABEL, VERTICAL_LABEL, type CrmStage, type CrmVertical } from "./crm-rules";
import {
  CALL_OUTCOMES,
  CALL_OUTCOME_LABEL,
  LOG_OUTCOME,
  callingHoursProblem,
  isDueForCaller,
  planOutcome,
  queueOrder,
  type CallOutcome,
  type QueueCandidate,
} from "./crm-queue-rules";

/**
 * THE CALL QUEUE. Robert's sales CRM ruling of 2026-11-02, item R3.
 *
 * One card at a time: the next company due a call, by due time then score,
 * that is the caller's own or nobody's (R5 adds the territory to the same
 * test, isDueForCaller). Before a card is drawn, a company that asked not to
 * be contacted never comes up, and a company any of whose people is on the
 * suppression list is passed over and counted, so the screen can say how many
 * it skipped and why. Outside 8 AM to 8 PM Central the queue draws nothing and
 * records nothing.
 *
 * Each outcome is recorded in this order: the company moves first, conditional
 * on the stage and step it was read at, so two reps on one company cannot both
 * move it; then the call is written to the contact log through logContact,
 * which audits it; then a stage change, when there was one, is written as its
 * own entry, the way setStage writes it.
 */

const refuse = (error: string) => ({ ok: false as const, error });

export type QueueContact = { id: string; name: string | null; phone: string | null; email: string | null; isPrimary: boolean; reportedWrong: boolean };
export type QueueActivity = { at: string; kind: string; outcome: string | null; body: string | null; byName: string | null };
export type QueueOrders = { count: number; recent: { reference: string; placedAt: string | null; status: string }[] };

export type QueueCard = {
  id: string;
  company: string;
  vertical: CrmVertical;
  verticalLabel: string;
  stage: CrmStage;
  stageLabel: string;
  score: number;
  city: string | null;
  county: string | null;
  website: string | null;
  permitCount: number;
  lastPermitOn: string | null;
  sequenceStep: number;
  nextActionAt: string | null;
  ownerId: string | null;
  contacts: QueueContact[];
  activities: QueueActivity[];
  orders: QueueOrders | null;
  script: RenderedScript;
};

export type QueueView =
  | { ok: true; closed: string }
  | { ok: true; closed: null; card: QueueCard | null; due: number; skippedSuppressed: number }
  | { ok: false; error: string };

/** The rep's first name for the script's "this is ...", from the profile currentActor loads. */
function repFirstName(actor: Actor): string {
  const name = (actor as Actor & { display_name?: string | null }).display_name?.trim();
  return name ? name.split(/\s+/)[0] : "your name";
}

const CANDIDATE_COLUMNS = "id, company, stage, score, next_action_at, next_action_kind, owner_id";

/** The companies due a call for this caller, in queue order. Every open company is read, never a page of them. */
async function dueCandidates(actor: Actor, now: Date): Promise<{ ok: true; rows: QueueCandidate[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the queue could not be read.");
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_prospects")
      .select(CANDIDATE_COLUMNS)
      .in("status", ["open", "converted"])
      .not("stage", "in", "(do_not_contact,dormant)")
      .or(`owner_id.eq.${actor.id},owner_id.is.null`)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return refuse(`The queue could not be read: ${read.error}`);
  const rows: QueueCandidate[] = read.rows.map((r) => ({
    id: String(r.id),
    company: String(r.company),
    stage: r.stage as CrmStage,
    score: Number(r.score ?? 0),
    nextActionAt: (r.next_action_at as string | null) ?? null,
    nextActionKind: (r.next_action_kind as "call" | "email" | null) ?? null,
    ownerId: (r.owner_id as string | null) ?? null,
  }));
  return { ok: true, rows: rows.filter((c) => isDueForCaller(c, actor.id, now)).sort(queueOrder) };
}

async function contactsOf(prospectId: string): Promise<{ ok: true; rows: QueueContact[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const people = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_prospect_contacts").select("id, full_name, phone, email, is_primary").eq("prospect_id", prospectId).order("is_primary", { ascending: false }).order("created_at", { ascending: true }).range(from, to),
  );
  if (!people.ok) return refuse(`The people at this company could not be read: ${people.error}`);
  /* A number is "reported wrong" when a call to that person was recorded as a wrong number. */
  const wrong = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_contact_log").select("contact_id").eq("prospect_id", prospectId).eq("crm_outcome", "wrong_number").not("contact_id", "is", null).order("created_at", { ascending: true }).range(from, to),
  );
  if (!wrong.ok) return refuse(`The calls to this company could not be read: ${wrong.error}`);
  const wrongIds = new Set(wrong.rows.map((r) => String(r.contact_id)));
  return {
    ok: true,
    rows: people.rows.map((r) => ({
      id: String(r.id),
      name: (r.full_name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      isPrimary: Boolean(r.is_primary),
      reportedWrong: wrongIds.has(String(r.id)),
    })),
  };
}

/** Which of these addresses are on the suppression list. Fails closed: a failed read is an error, never "none". */
async function suppressedAmong(emails: string[]): Promise<{ ok: true; set: Set<string> } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the suppression list could not be read.");
  const wanted = [...new Set(emails.filter(Boolean).map(normaliseEmail))];
  const set = new Set<string>();
  for (let i = 0; i < wanted.length; i += 200) {
    const chunk = wanted.slice(i, i + 200);
    const { data, error } = await db.from("eng_marketing_suppressions").select("email").in("email", chunk).is("voided_at", null);
    if (error) return refuse(`The suppression list could not be read, so no card is shown: ${error.message}`);
    for (const r of data ?? []) set.add(String(r.email));
  }
  return { ok: true, set };
}

/** The newest three entries in the company's history, described for a card. A sample, named as one on the screen. */
async function lastThree(prospectId: string): Promise<{ ok: true; rows: QueueActivity[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const { data, error } = await db
    .from("eng_contact_log")
    .select("created_at, channel, activity_kind, crm_outcome, outcome, body, by:eng_profiles!eng_contact_log_by_id_fkey(display_name)")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) return refuse(`This company's history could not be read: ${error.message}`);
  return {
    ok: true,
    rows: (data ?? []).map((r: Record<string, unknown>) => ({
      at: String(r.created_at),
      kind: String(r.activity_kind ?? r.channel),
      outcome: (r.crm_outcome as string | null) ?? (r.outcome as string | null) ?? null,
      body: (r.body as string | null) ?? null,
      byName: ((r.by as { display_name?: string } | null)?.display_name) ?? null,
    })),
  };
}

/** A converted company's orders: how many and when, never what they cost (a rep sees no revenue; attribution is R8). */
async function ordersOf(accountId: string): Promise<{ ok: true; orders: QueueOrders } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_service_orders").select("reference, placed_at, status, created_at").eq("account_id", accountId).order("created_at", { ascending: false }).range(from, to),
  );
  if (!read.ok) return refuse(`This account's orders could not be read: ${read.error}`);
  return {
    ok: true,
    orders: {
      count: read.rows.length,
      recent: read.rows.slice(0, 3).map((r) => ({ reference: String(r.reference), placedAt: (r.placed_at as string | null) ?? null, status: String(r.status) })),
    },
  };
}

/**
 * The queue as the caller sees it now: closed outside calling hours, otherwise
 * the next card, how many companies are due, and how many were passed over
 * because somebody there is on the suppression list.
 */
export async function queueFor(actor: Actor | null, now = new Date()): Promise<QueueView> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the call queue.");
  const closed = callingHoursProblem(now);
  if (closed) return { ok: true, closed };

  const due = await dueCandidates(actor, now);
  if (!due.ok) return due;

  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  let skippedSuppressed = 0;
  for (const candidate of due.rows) {
    const people = await contactsOf(candidate.id);
    if (!people.ok) return people;
    const suppressed = await suppressedAmong(people.rows.map((p) => p.email ?? ""));
    if (!suppressed.ok) return suppressed;
    if (people.rows.some((p) => p.email && suppressed.set.has(normaliseEmail(p.email)))) {
      skippedSuppressed += 1;
      continue;
    }

    const { data: row, error } = await db
      .from("eng_prospects")
      .select("id, company, vertical, stage, score, city, county, website, permit_count, last_permit_on, sequence_step, next_action_at, owner_id, status, converted_account_id")
      .eq("id", candidate.id)
      .maybeSingle();
    if (error) return refuse(`The company could not be read: ${error.message}`);
    /* Moved off the queue between the two reads: it is somebody else's now, or done. Take the next one. */
    if (!row || row.stage === "do_not_contact") continue;

    const activities = await lastThree(candidate.id);
    if (!activities.ok) return activities;
    let orders: QueueOrders | null = null;
    if (row.converted_account_id) {
      const read = await ordersOf(String(row.converted_account_id));
      if (!read.ok) return read;
      orders = read.orders;
    }
    const vertical = row.vertical as CrmVertical;
    const line = SCRIPT_LINE[vertical];
    const sellable = await lineIsSellableForDisplay(line.serviceSlug, line.tier ?? null);
    const primary = people.rows.find((p) => p.isPrimary) ?? people.rows[0] ?? null;
    const script = scriptFor(
      { vertical, rep: repFirstName(actor), contact: primary?.name ?? null, company: String(row.company), city: (row.city as string | null) ?? null },
      sellable.ok,
    );

    return {
      ok: true,
      closed: null,
      due: due.rows.length,
      skippedSuppressed,
      card: {
        id: String(row.id),
        company: String(row.company),
        vertical,
        verticalLabel: VERTICAL_LABEL[vertical],
        stage: row.stage as CrmStage,
        stageLabel: STAGE_LABEL[row.stage as CrmStage],
        score: Number(row.score ?? 0),
        city: (row.city as string | null) ?? null,
        county: (row.county as string | null) ?? null,
        website: (row.website as string | null) ?? null,
        permitCount: Number(row.permit_count ?? 0),
        lastPermitOn: (row.last_permit_on as string | null) ?? null,
        sequenceStep: Number(row.sequence_step ?? 0),
        nextActionAt: (row.next_action_at as string | null) ?? null,
        ownerId: (row.owner_id as string | null) ?? null,
        contacts: people.rows,
        activities: activities.rows,
        orders,
        script,
      },
    };
  }
  return { ok: true, closed: null, card: null, due: due.rows.length, skippedSuppressed };
}

/**
 * Record one outcome on one company and say what happens next. The caller is
 * the rep on the telephone; the company must be theirs or nobody's, and a
 * company nobody owned becomes theirs, because they are the one working it.
 */
export async function recordOutcome(
  actor: Actor | null,
  input: { prospectId: string; outcome: string; contactId?: string | null; callbackAt?: string | null; reason?: string | null; note?: string | null },
  now = new Date(),
): Promise<{ ok: true; said: string; openConversion: boolean } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use") || !can(actor, "contact_log.write")) return refuse("Your role cannot record a call.");
  const closed = callingHoursProblem(now);
  if (closed) return refuse(closed);
  if (!(CALL_OUTCOMES as readonly string[]).includes(input.outcome)) return refuse("That is not an outcome the queue records.");
  const outcome = input.outcome as CallOutcome;

  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was recorded.");
  const { data: row, error } = await db
    .from("eng_prospects")
    .select("id, company, stage, status, sequence_step, owner_id, tags")
    .eq("id", input.prospectId)
    .maybeSingle();
  if (error) return refuse(`The company could not be read: ${error.message}`);
  if (!row) return refuse("That company is not on the sales list.");
  if (row.owner_id && row.owner_id !== actor.id) return refuse("Another rep is working this company. Take the next card.");

  const people = await contactsOf(input.prospectId);
  if (!people.ok) return people;
  const contactId = input.contactId?.trim() || null;
  if (contactId && !people.rows.some((p) => p.id === contactId)) return refuse("That person is not at this company.");
  if (outcome === "wrong_number" && !contactId) return refuse("Say which number was wrong.");
  const anotherWorkingPhone = people.rows.some((p) => p.phone && !p.reportedWrong && p.id !== contactId);

  const from = row.stage as CrmStage;
  const step = Number(row.sequence_step ?? 0);
  const planned = planOutcome(outcome, { stage: from, sequenceStep: step }, { callbackAt: input.callbackAt, reason: input.reason, anotherWorkingPhone }, now);
  if (!planned.ok) return planned;
  const plan = planned.plan;

  const tags = [...new Set([...((row.tags as string[] | null) ?? []), ...plan.addTags])];
  const patch: Record<string, unknown> = {
    stage: plan.stage,
    next_action_at: plan.nextActionAt,
    next_action_kind: plan.nextActionKind,
    sequence_step: plan.sequenceStep,
    tags,
    owner_id: actor.id,
  };
  /*
   * A customer keeps its customer stage and status (0111 holds converted and
   * the two customer stages together): the call is logged and the next call is
   * scheduled, and a do not call still puts their addresses on the suppression
   * list below.
   */
  if (row.status !== "converted") patch.status = plan.status;
  else patch.stage = from;
  if (plan.stage === "do_not_contact" && row.status !== "converted") Object.assign(patch, { do_not_contact_at: DB_NOW, do_not_contact_by: actor.id });

  let move = db.from("eng_prospects").update(patch).eq("id", input.prospectId).eq("stage", from).eq("sequence_step", step);
  move = row.owner_id ? move.eq("owner_id", actor.id) : move.is("owner_id", null);
  const { data: moved, error: moveError } = await move.select("id");
  if (moveError) return refuse(`The company could not be moved: ${moveError.message}`);
  if (!moved?.length) return refuse("Somebody else recorded a call on this company just now. Nothing was changed; take the next card.");

  const callbackAt = outcome === "callback" ? plan.nextActionAt : null;
  const logged = await logContact(actor, {
    subject: "prospect",
    subjectId: input.prospectId,
    channel: "call",
    direction: "outbound",
    outcome: LOG_OUTCOME[outcome],
    body: input.note?.trim() || `${CALL_OUTCOME_LABEL[outcome]}.`,
    crm: {
      activityKind: "call",
      crmOutcome: outcome,
      callbackAt,
      notInterestedReason: outcome === "not_interested" ? input.reason ?? null : null,
      contactId,
    },
  });
  if (!logged.ok) return refuse(`The company moved and the call could not be written to its history: ${logged.error}`);

  const stageTo = patch.stage as CrmStage;
  if (stageTo !== from) {
    const stageNote = await logContact(actor, {
      subject: "prospect",
      subjectId: input.prospectId,
      channel: "note",
      body: `Stage moved from ${STAGE_LABEL[from]} to ${STAGE_LABEL[stageTo]} by the call.`,
      crm: { activityKind: "stage_change", stageFrom: from, stageTo },
    });
    if (!stageNote.ok) return refuse(`The call was recorded and the stage change could not be written to the history: ${stageNote.error}`);
  }

  if (plan.suppressEmails) {
    for (const person of people.rows) {
      if (!person.email) continue;
      const done = await suppress(person.email, "do not contact, said on a sales call");
      if (!done.ok) return refuse(`Recorded as do not contact, and ${person.email} could not be added to the suppression list: ${done.error}. Add it on the suppressions screen.`);
    }
  }

  return { ok: true, said: plan.said, openConversion: plan.openConversion && row.status !== "converted" };
}
