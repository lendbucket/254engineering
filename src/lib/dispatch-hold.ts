import "server-only";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, licenceRefusal, type Actor } from "./ops-authz";
import { protocolForLine } from "@/content/protocols";
import { protocolRoutesToEngineer } from "@data/protocol-fields";
import { answersFor } from "./ops-file-inputs";
import { writeAudit } from "./ops-audit";
import { SYSTEM_AUTHOR, transitionFile } from "./ops-crm";
import { orderForFile, settleDecision } from "./ops-payments";

/**
 * ===========================================================================
 * A JOB THE PROTOCOL ROUTES TO THE ENGINEER IS HELD BEFORE DISPATCH.
 * ===========================================================================
 *
 * Operator ruling 1 of 2026-10-07, refined the same day. RC-001's questions 8
 * to 12 (an open insurance claim, litigation, an active leak, an adverse
 * report, storm damage in the last twelve months) say that a yes "routes this
 * job to the engineer before anybody is dispatched". protocolRoutesToEngineer
 * implemented that and nothing called it, so a yes was dispatched like a no.
 *
 * The rule, as ruled:
 *   - ANY yes holds the job before dispatch. An open insurance claim holds it
 *     like any other yes; NOTHING here declines anything automatically.
 *   - The engineer reviews it and records ACCEPT or DECLINE himself. Accept
 *     releases the hold. Decline needs a referral in his words, cancels the
 *     file, and refunds the order in full, because nobody has attended.
 *   - His screen shows a standing ruling beside the question it governs, as
 *     the reason he may rely on, never as a decision made for him.
 *
 * The decision is a FILE EVENT (prereview.accepted / prereview.declined), which
 * eng_file_events keeps for ever: who decided, when, and the referral. No
 * column and no migration, because the record already has a home that refuses
 * edits.
 */

export const PREREVIEW_ACCEPTED = "prereview.accepted";
export const PREREVIEW_DECLINED = "prereview.declined";

/**
 * Standing rulings shown beside the question they govern. Shown, not applied:
 * the engineer records the decision himself, by the operator's ruling.
 */
export const STANDING_RULINGS: Record<number, string> = {
  8: "Aman's standing ruling: open insurance claim roofs are declined with a referral.",
};

export type HoldQuestion = { number: number; question: string; standingRuling: string | null };
export type HoldState =
  | { held: false; reason: "no protocol" | "no yes" | "decided"; decision?: { kind: string; at: string; by: string | null } }
  | { held: true; questions: HoldQuestion[] }
  | { held: null; error: string };

/** Pure: which questions hold a job, from its answers. Exported so the proof can drive it question by question. */
export function holdQuestions(serviceSlug: string, answers: Record<string, string>): HoldQuestion[] {
  const protocol = protocolForLine(serviceSlug);
  if (!protocol) return [];
  const routed = protocolRoutesToEngineer(protocol, answers);
  return routed.because.map((line) => {
    const number = Number(/Question (\d+)/.exec(line)?.[1] ?? NaN);
    return { number, question: line, standingRuling: STANDING_RULINGS[number] ?? null };
  });
}

/**
 * Is this file held? A failed read is NOT "not held": the answer is the shut
 * one, null with the error, and dispatch refuses on it.
 */
export async function holdFor(fileId: string): Promise<HoldState> {
  const db = supabaseAdmin();
  if (!db) return { held: null, error: "The database is not configured." };
  const { data: file, error } = await db.from("eng_files").select("id, service_slug").eq("id", fileId).maybeSingle();
  if (error || !file) return { held: null, error: error?.message ?? "That file does not exist." };
  if (!protocolForLine(file.service_slug as string)) return { held: false, reason: "no protocol" };

  const questions = holdQuestions(file.service_slug as string, await answersFor(fileId));
  if (questions.length === 0) return { held: false, reason: "no yes" };

  const { data: decided, error: decidedError } = await db
    .from("eng_file_events")
    .select("kind, created_at, actor_id")
    .eq("file_id", fileId)
    .in("kind", [PREREVIEW_ACCEPTED, PREREVIEW_DECLINED])
    .order("created_at", { ascending: false })
    .limit(1);
  if (decidedError) return { held: null, error: `Whether the engineer has decided could not be read: ${decidedError.message}` };
  const last = (decided ?? [])[0];
  if (last) return { held: false, reason: "decided", decision: { kind: last.kind as string, at: last.created_at as string, by: (last.actor_id as string | null) ?? null } };
  return { held: true, questions };
}

/** The sentence a dispatcher reads when a held job is refused. */
export function holdRefusal(hold: HoldState): string | null {
  if (hold.held === null) return `This job could not be checked for an engineer hold, so it is not dispatched: ${hold.error}`;
  if (!hold.held) return null;
  return `This job is held for the engineer before dispatch, because the customer answered yes to ${hold.questions
    .map((q) => `question ${q.number}`)
    .join(", ")}. The engineer records accept or decline first.`;
}

/** Every file waiting in dispatch that is held, for the engineer's screen. */
export async function heldFiles(): Promise<
  { ok: true; files: { id: string; fileNumber: string; address: string; questions: HoldQuestion[] }[] } | { ok: false; error: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_files")
    .select("id, file_number, property_address, service_slug")
    .eq("status", "needs_dispatch")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return { ok: false, error: error.message };
  const out: { id: string; fileNumber: string; address: string; questions: HoldQuestion[] }[] = [];
  for (const f of data ?? []) {
    if (!protocolForLine(f.service_slug as string)) continue;
    const hold = await holdFor(f.id as string);
    if (hold.held === true) out.push({ id: f.id as string, fileNumber: f.file_number as string, address: f.property_address as string, questions: hold.questions });
  }
  return { ok: true, files: out };
}

/**
 * The engineer's decision. Only his licence, only on a file that is actually
 * held, and a decline only with a referral written by him.
 */
export async function recordPrereview(
  actor: (Actor & { email: string }) | null,
  fileId: string,
  decision: "accept" | "decline",
  note: string,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !holdsLicence(actor, "review.queue")) return { ok: false, error: licenceRefusal("Deciding a held job") };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const hold = await holdFor(fileId);
  if (hold.held === null) return { ok: false, error: hold.error };
  if (!hold.held) return { ok: false, error: "That job is not held for an engineer's decision." };

  const written = note.trim();
  if (decision === "decline" && written.length < 10) {
    return { ok: false, error: "A decline needs the referral, in your words: where the customer should go instead." };
  }

  /*
   * A DECLINE CLOSES THE FILE FIRST, AND ONLY THEN IS IT RECORDED. Found by the
   * order path walk: the decision was written before the file moved, the move
   * was refused, and a recorded decline sat on an open file. No assignment is
   * written: bulk-audit holds that only accepting work writes one, and the
   * platform moves the file, so the engineer need not hold it.
   */
  if (decision === "decline") {
    /*
     * Moved by the platform, recording him: the engineer role holds no grant to
     * cancel a file, and widening it would let him cancel any file. The
     * decision is his (the event and the audit row below carry his id); the
     * platform carries it out, as the order engine does for a payment.
     */
    const moved = await transitionFile(
      SYSTEM_AUTHOR,
      fileId,
      "cancelled",
      `Declined before dispatch by ${actor.email}, engineer. Referral: ${written}`,
      context,
    );
    if (!moved.ok) return { ok: false, error: `Nothing was recorded, because the file did not close: ${moved.error}` };
  }

  const { error: eventError } = await db.from("eng_file_events").insert({
    file_id: fileId,
    actor_id: actor.id,
    kind: decision === "accept" ? PREREVIEW_ACCEPTED : PREREVIEW_DECLINED,
    body: written || null,
    meta: { questions: hold.questions.map((q) => q.number) },
  });
  if (eventError) return { ok: false, error: `The decision was not recorded: ${eventError.message}` };

  await writeAudit({
    actor,
    action: decision === "accept" ? "file.prereview_accepted" : "file.prereview_declined",
    entityType: "file",
    entityId: fileId,
    summary: `${decision === "accept" ? "Accepted" : "Declined"} before dispatch on question(s) ${hold.questions.map((q) => q.number).join(", ")}${written ? `: ${written}` : ""}`,
    ...context,
  });

  if (decision === "decline") {
    /*
     * Nobody has attended, so the decline refunds in full: settleDecision's
     * own rule, the one the order's disclosure promised.
     */
    const order = await orderForFile(fileId);
    if (order) {
      const settled = await settleDecision({ orderId: order.id as string, outcome: "refuse", actorId: actor.id });
      if (!settled.ok) return { ok: false, error: `The decline was recorded and the refund did not go through: ${settled.error}` };
    }
  }
  return { ok: true };
}
