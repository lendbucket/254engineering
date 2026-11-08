import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery } from "./bounded-read";
import { DB_NOW } from "./db-now";
import { logContact } from "./ops-contact-log";
import { queueEmail } from "./ops-jobs";
import { crmSequenceEmail } from "./email-templates";
import { isSuppressed, unsubscribeUrl } from "./marketing-suppression";
import { lineIsSellableForDisplay } from "./line-gate";
import { SCRIPT_LINE } from "@/content/crm-scripts";
import { canSeeCompany } from "./crm-board-rules";
import { viewerFor } from "./crm-territories";
import { STAGE_LABEL, type CrmStage, type CrmVertical } from "./crm-rules";
import { business } from "@/config/business";
import { displayPhone } from "@/config/contact";
import { CRM_REPLY_DOMAIN } from "@/config/crm-email";
import {
  emailDue,
  firmDay,
  emailVerticalFor,
  ledgerAddress,
  planAfterEmail,
  renderSequenceEmail,
  replyTagAddress,
  type RenderedSequenceEmail,
} from "./crm-email-rules";

/**
 * THE SEQUENCE EMAILS. Robert's sales CRM ruling of 2026-11-02, item R7, with
 * the templates and sequence he approved as drafted (issue #1 comment
 * 6587551356) and his answers 1 and 6 (6587550325).
 *
 * A REP PRESSES SEND. Nothing here runs on a schedule: the call queue screen
 * lists the companies whose next step is an email and is due, each with the
 * email it would send, and the rep sends it or leaves it.
 *
 * WHAT SEND DOES, IN THIS ORDER, and why the order:
 *   1. the company is read and asked again whether its email is due (it may
 *      have moved since the list was drawn), and whether the rep may work it
 *      (R5: their own, or unowned in their territory; a manager, any);
 *   2. the person written to is the primary contact with an address, or the
 *      first person with one;
 *   3. the suppression list is consulted (isSuppressed, which fails closed:
 *      an address it cannot answer for is treated as suppressed), and an
 *      unsubscribe link is signed or nothing goes;
 *   4. the send ledger row is written (0118), which refuses a second send to
 *      the same address on the same firm day whatever happened before it;
 *   5. the email is queued; if queueing fails the ledger row is marked failed,
 *      which frees the day, and the rep is told;
 *   6. the company moves to the next step, conditional on the stage and step
 *      it was read at;
 *   7. the send is written to the contact log through logContact.
 * When nothing can be sent (no address, suppressed, no unsubscribe link), the
 * reason is written to the history as a note and the sequence moves to the
 * next call step, exactly as the approved table says for a bounce or a
 * suppressed address.
 *
 * BOUNCES. Nothing in this platform receives Resend's delivery events today,
 * so a bounce is not seen here; an address the provider refuses is known only
 * from Resend's own log. Recorded as a gap in BACKLOG rather than claimed.
 */

const refuse = (error: string) => ({ ok: false as const, error });

/** The rep's first name for the sign off, from the profile currentActor loads. */
function senderFirstName(actor: Actor): string {
  const name = (actor as Actor & { display_name?: string | null }).display_name?.trim();
  return name ? name.split(/\s+/)[0] : "254 Engineering";
}

type Person = { id: string; name: string | null; email: string | null; isPrimary: boolean };

async function peopleWithEmail(prospectId: string): Promise<{ ok: true; rows: Person[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_prospect_contacts").select("id, full_name, email, is_primary").eq("prospect_id", prospectId).order("is_primary", { ascending: false }).order("created_at", { ascending: true }).range(from, to),
  );
  if (!read.ok) return refuse(`The people at this company could not be read: ${read.error}`);
  return {
    ok: true,
    rows: read.rows.map((r) => ({ id: String(r.id), name: (r.full_name as string | null) ?? null, email: (r.email as string | null)?.trim() || null, isPrimary: Boolean(r.is_primary) })),
  };
}

/** The person a sequence email goes to: the primary contact with an address, otherwise the first person with one. */
function recipientOf(people: Person[]): Person | null {
  return people.find((p) => p.isPrimary && p.email) ?? people.find((p) => p.email) ?? null;
}

async function emailFor(actor: Actor, row: Record<string, unknown>, person: Person | null): Promise<RenderedSequenceEmail> {
  const vertical = row.vertical as CrmVertical;
  /* The line of the email actually shown: the general email follows the roof line even in place of solar (R3 ruling 4). */
  const line = SCRIPT_LINE[emailVerticalFor(vertical, (row.city as string | null) ?? null)];
  const sellable = await lineIsSellableForDisplay(line.serviceSlug, line.tier ?? null);
  return renderSequenceEmail(
    {
      vertical,
      rep: senderFirstName(actor),
      contact: person?.name ?? null,
      company: String(row.company),
      city: (row.city as string | null) ?? null,
      siteUrl: business.url,
      phone: displayPhone(),
    },
    sellable.ok,
  );
}

const ROW_COLUMNS = "id, company, vertical, stage, status, city, county, owner_id, sequence_step, next_action_kind, next_action_at, sequence_paused_at";

export type DueEmail = {
  prospectId: string;
  company: string;
  stageLabel: string;
  to: string | null;
  toName: string | null;
  preview: RenderedSequenceEmail;
};

export type DueEmails = { ok: true; rows: DueEmail[] } | { ok: false; error: string };

/**
 * The companies whose next step is an email and is due, that this rep may work
 * (their own or unowned, through canSeeCompany), each with the email it would
 * send. Every open company is read, never a page of them.
 */
export async function emailsDueFor(actor: Actor | null, now = new Date()): Promise<DueEmails> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the sales emails.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the emails due could not be read.");
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_prospects")
      .select(ROW_COLUMNS)
      .eq("next_action_kind", "email")
      .is("sequence_paused_at", null)
      .lte("next_action_at", now.toISOString())
      .not("stage", "in", "(do_not_contact,dormant)")
      .or(`owner_id.eq.${actor.id},owner_id.is.null`)
      .order("next_action_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return refuse(`The emails due could not be read: ${read.error}`);
  const rows: DueEmail[] = [];
  for (const row of read.rows) {
    if (!canSeeCompany(who.viewer, (row.owner_id as string | null) ?? null, (row.county as string | null) ?? null)) continue;
    const people = await peopleWithEmail(String(row.id));
    if (!people.ok) return people;
    const person = recipientOf(people.rows);
    rows.push({
      prospectId: String(row.id),
      company: String(row.company),
      stageLabel: STAGE_LABEL[row.stage as CrmStage],
      to: person?.email ?? null,
      toName: person?.name ?? null,
      preview: await emailFor(actor, row, person),
    });
  }
  return { ok: true, rows };
}

/** Move the company to the step after the email and write what happened. Shared by the sent and the not sent paths. */
async function advance(
  actor: Actor,
  row: Record<string, unknown>,
  sent: boolean,
  now: Date,
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const from = row.stage as CrmStage;
  const step = Number(row.sequence_step ?? 0);
  const plan = planAfterEmail({ stage: from, sequenceStep: step }, sent, now);
  const patch: Record<string, unknown> = {
    next_action_at: plan.nextActionAt,
    next_action_kind: plan.nextActionKind,
    sequence_step: plan.sequenceStep,
    owner_id: (row.owner_id as string | null) ?? actor.id,
  };
  /* A customer keeps its customer stage (0112 holds converted and the two customer stages together). */
  if (row.status !== "converted") patch.stage = plan.stage;
  let move = db.from("eng_prospects").update(patch).eq("id", String(row.id)).eq("stage", from).eq("sequence_step", step);
  move = row.owner_id ? move.eq("owner_id", String(row.owner_id)) : move.is("owner_id", null);
  const { data: moved, error } = await move.select("id");
  if (error) return refuse(`The company could not be moved to its next step: ${error.message}`);
  if (!moved?.length) return refuse("Somebody else moved this company just now. Open it again.");
  const to = (patch.stage as CrmStage | undefined) ?? from;
  if (to !== from) {
    const note = await logContact(actor, {
      subject: "prospect",
      subjectId: String(row.id),
      channel: "note",
      body: `Stage moved from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]} by the sequence email.`,
      crm: { activityKind: "stage_change", stageFrom: from, stageTo: to },
    });
    if (!note.ok) return refuse(`The company moved and the stage change could not be written to its history: ${note.error}`);
  }
  return { ok: true, said: plan.said };
}

/** Write why nothing was sent, then move to the next call step. */
async function notSent(actor: Actor, row: Record<string, unknown>, why: string, now: Date): Promise<{ ok: true; sent: false; said: string } | { ok: false; error: string }> {
  const logged = await logContact(actor, {
    subject: "prospect",
    subjectId: String(row.id),
    channel: "note",
    body: `The sequence email was not sent: ${why}`,
    crm: { activityKind: "sequence" },
  });
  if (!logged.ok) return refuse(`Nothing was sent, and the reason could not be written to the history: ${logged.error}`);
  const moved = await advance(actor, row, false, now);
  if (!moved.ok) return moved;
  return { ok: true, sent: false, said: `Not sent: ${why} ${moved.said}` };
}

/** Send one company's due sequence email. A rep presses Send; nothing calls this on a schedule. */
export async function sendSequenceEmail(
  actor: Actor | null,
  input: { prospectId: string },
  now = new Date(),
): Promise<{ ok: true; sent: boolean; said: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use") || !can(actor, "contact_log.write")) return refuse("Your role cannot send a sales email.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was sent.");
  const { data: row, error } = await db.from("eng_prospects").select(ROW_COLUMNS).eq("id", input.prospectId).maybeSingle();
  if (error) return refuse(`The company could not be read, so nothing was sent: ${error.message}`);
  if (!row) return refuse("That company is not on the sales list.");
  if (row.owner_id && row.owner_id !== actor.id && !can(actor, "crm.assign")) return refuse("Another rep is working this company.");
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  if (!canSeeCompany(who.viewer, (row.owner_id as string | null) ?? null, (row.county as string | null) ?? null)) {
    return refuse("This company is outside your territories.");
  }
  const due = emailDue(
    {
      stage: row.stage as CrmStage,
      sequenceStep: Number(row.sequence_step ?? 0),
      nextActionKind: (row.next_action_kind as "call" | "email" | null) ?? null,
      nextActionAt: (row.next_action_at as string | null) ?? null,
      sequencePausedAt: (row.sequence_paused_at as string | null) ?? null,
    },
    now,
  );
  if (!due.ok) return due;

  const people = await peopleWithEmail(input.prospectId);
  if (!people.ok) return people;
  const person = recipientOf(people.rows);
  if (!person?.email) return notSent(actor, row, "nobody at this company has an email address on file.", now);
  /* Fails closed: an address the list cannot answer for is treated as suppressed. */
  if (await isSuppressed(person.email)) return notSent(actor, row, `${person.email} is on the suppression list.`, now);
  const unsubscribe = unsubscribeUrl(person.email);
  if (!unsubscribe) return notSent(actor, row, "no unsubscribe link could be signed, and this email does not go without one.", now);

  const rendered = await emailFor(actor, row, person);
  if (!rendered.ok) return refuse(`Nothing was sent: ${rendered.error}`);

  const address = ledgerAddress(person.email);
  const day = firmDay(now);
  const { data: ledger, error: ledgerError } = await db
    .from("eng_crm_email_sends")
    .insert({
      prospect_id: input.prospectId,
      contact_id: person.id,
      address,
      firm_day: day,
      sequence_step: Number(row.sequence_step ?? 0),
      variant: rendered.variant,
      vertical: rendered.usedVertical,
      sent_by: actor.id,
    })
    .select("id")
    .single();
  if (ledgerError) {
    if (ledgerError.code === "23505") return refuse(`${person.email} was already sent a sales email today. One a day, so this waits until tomorrow.`);
    return refuse(`The send could not be recorded, so nothing was sent: ${ledgerError.message}`);
  }

  const replyTo = CRM_REPLY_DOMAIN ? replyTagAddress(input.prospectId, CRM_REPLY_DOMAIN) : undefined;
  const queued = await queueEmail(
    crmSequenceEmail({ to: person.email, subject: rendered.subject, paragraphs: rendered.paragraphs, signOff: rendered.signOff, unsubscribeUrl: unsubscribe, replyTo }),
  );
  if (!queued.ok) {
    await db.from("eng_crm_email_sends").update({ status: "failed", failure: queued.error || "the email could not be queued" }).eq("id", ledger.id).eq("status", "queued");
    return refuse(`The email could not be queued, so nothing was sent and you can press Send again: ${queued.error}`);
  }

  const moved = await advance(actor, row, true, now);
  if (!moved.ok) return refuse(`The email is queued to ${person.email}, and then ${moved.error.charAt(0).toLowerCase()}${moved.error.slice(1)}`);
  const logged = await logContact(actor, {
    subject: "prospect",
    subjectId: input.prospectId,
    channel: "email",
    direction: "outbound",
    outcome: "sent",
    body: `Sequence email (${rendered.variant}): ${rendered.subject}`,
    crm: { activityKind: "email", contactId: person.id },
  });
  if (!logged.ok) return refuse(`The email is queued and the company moved, and the send could not be written to its history: ${logged.error}`);
  return { ok: true, sent: true, said: `Queued to ${person.email}. ${moved.said}` };
}

/* ----------------------------------------------------------------- replies */

export type ReplyRow = {
  id: string;
  receivedAt: string;
  prospectId: string | null;
  company: string | null;
  fromAddress: string | null;
  subject: string | null;
  body: string | null;
  matchedBy: "tag" | "sender" | "none";
  readAt: string | null;
};

/** The replies the webhook recorded, unread first then newest. A reply that matched no company says so. */
export async function repliesFor(actor: Actor | null, opts: { includeRead: boolean }): Promise<{ ok: true; rows: ReplyRow[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the sales replies.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the replies could not be read.");
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  const read = await readEvery<Record<string, unknown>>((from, to) => {
    let q = db
      .from("eng_crm_email_replies")
      .select("id, created_at, received_at, prospect_id, matched_by, from_address, subject, body_text, read_at, prospect:eng_prospects(company, owner_id, county)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (!opts.includeRead) q = q.is("read_at", null);
    return q.range(from, to);
  });
  if (!read.ok) return refuse(`The replies could not be read: ${read.error}`);
  const rows: ReplyRow[] = [];
  for (const r of read.rows) {
    const p = r.prospect as { company?: string; owner_id?: string | null; county?: string | null } | null;
    /* A matched reply follows the company's visibility; an unmatched one is for whoever can open the sales list. */
    if (p && !canSeeCompany(who.viewer, p.owner_id ?? null, p.county ?? null)) continue;
    rows.push({
      id: String(r.id),
      receivedAt: String(r.received_at ?? r.created_at),
      prospectId: (r.prospect_id as string | null) ?? null,
      company: p?.company ?? null,
      fromAddress: (r.from_address as string | null) ?? null,
      subject: (r.subject as string | null) ?? null,
      body: (r.body_text as string | null) ?? null,
      matchedBy: r.matched_by as ReplyRow["matchedBy"],
      readAt: (r.read_at as string | null) ?? null,
    });
  }
  rows.sort((a, b) => Number(Boolean(a.readAt)) - Number(Boolean(b.readAt)));
  return { ok: true, rows };
}

/**
 * A rep reads a reply. The reply is written to the company's history as an
 * inbound email by this rep (every row of the contact log has a person as its
 * author, 0079), the company moves to connected (a customer keeps its stage),
 * and the sequence, which the reply paused, hands over to the rep: the next
 * step is a call, due now.
 */
export async function readReply(actor: Actor | null, input: { replyId: string }): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use") || !can(actor, "contact_log.write")) return refuse("Your role cannot record a reply.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was recorded.");
  const { data: reply, error } = await db.from("eng_crm_email_replies").select("id, prospect_id, from_address, subject, read_at").eq("id", input.replyId).maybeSingle();
  if (error) return refuse(`The reply could not be read: ${error.message}`);
  if (!reply) return refuse("That reply is not on file.");
  if (reply.read_at) return refuse("That reply is already read.");

  if (reply.prospect_id) {
    const { data: row, error: rowError } = await db.from("eng_prospects").select("id, stage, status, owner_id, county").eq("id", reply.prospect_id).maybeSingle();
    if (rowError) return refuse(`The company could not be read: ${rowError.message}`);
    if (!row) return refuse("The company this reply matched is not on the sales list.");
    const who = await viewerFor(actor);
    if (!who.ok) return who;
    if (!canSeeCompany(who.viewer, (row.owner_id as string | null) ?? null, (row.county as string | null) ?? null)) return refuse("This company is outside your territories.");
    const logged = await logContact(actor, {
      subject: "prospect",
      subjectId: String(row.id),
      channel: "email",
      direction: "inbound",
      outcome: "replied",
      body: `Reply from ${reply.from_address ?? "an unknown address"}: ${reply.subject ?? "(no subject)"}`,
      crm: { activityKind: "email", crmOutcome: "connected" },
    });
    if (!logged.ok) return refuse(`The reply could not be written to the company's history: ${logged.error}`);
    const from = row.stage as CrmStage;
    const keepsStage = row.status === "converted" || from === "do_not_contact";
    const to: CrmStage = keepsStage ? from : "connected";
    const { error: moveError } = await db
      .from("eng_prospects")
      .update({ ...(keepsStage ? {} : { stage: to }), sequence_paused_at: null, next_action_kind: from === "do_not_contact" ? null : "call", next_action_at: from === "do_not_contact" ? null : DB_NOW, owner_id: (row.owner_id as string | null) ?? actor.id })
      .eq("id", String(row.id))
      .eq("stage", from);
    if (moveError) return refuse(`The reply is in the history, and the company could not be moved: ${moveError.message}`);
    if (to !== from) {
      const note = await logContact(actor, {
        subject: "prospect",
        subjectId: String(row.id),
        channel: "note",
        body: `Stage moved from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]} by their reply.`,
        crm: { activityKind: "stage_change", stageFrom: from, stageTo: to },
      });
      if (!note.ok) return refuse(`The company moved and the stage change could not be written to its history: ${note.error}`);
    }
  }
  const { data: marked, error: markError } = await db.from("eng_crm_email_replies").update({ read_at: DB_NOW, read_by: actor.id }).eq("id", input.replyId).is("read_at", null).select("id");
  if (markError) return refuse(`The reply could not be marked read: ${markError.message}`);
  if (!marked?.length) return refuse("Somebody else read this reply just now.");
  return { ok: true, said: reply.prospect_id ? "Read, written to the company's history, and the company is connected. A call is due now." : "Read. It matched no company on the sales list." };
}
