import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { recordOutcome } from "@/lib/crm-queue";
import { firmInstant } from "@/lib/crm-queue-rules";
import { readReply, sendSequenceEmail } from "@/lib/crm-email";

export const dynamic = "force-dynamic";

/**
 * THE CALL QUEUE'S ONE ACT: record what happened on a call. crm.use and
 * contact_log.write, Robert's sales CRM ruling of 2026-11-02, item R3. The
 * library checks calling hours, the company's owner and the outcome, writes
 * the call through the contact log (which audits it) and says what comes next;
 * this route only reads the request and answers.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "crm.use") || !can(actor, "contact_log.write")) return bad("Your role cannot record a call.", 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("The request could not be read.");
  }
  /* R7: a rep presses Send on a due sequence email, or reads a reply. The library asks everything again. */
  if (str(body.action) === "send_email") {
    const sent = await sendSequenceEmail(actor, { prospectId: str(body.prospectId) });
    return sent.ok ? NextResponse.json(sent) : bad(sent.error, 422);
  }
  if (str(body.action) === "read_reply") {
    const read = await readReply(actor, { replyId: str(body.replyId) });
    return read.ok ? NextResponse.json(read) : bad(read.error, 422);
  }
  if (str(body.action) !== "outcome") return bad("That is not something the call queue does.");

  /* A callback is typed as a date and a time on the firm's clock (Central), whatever the phone's own zone. */
  let callbackAt: string | null = null;
  const cbDate = str(body.callbackDate);
  const cbTime = str(body.callbackTime);
  if (cbDate || cbTime) {
    const t = cbTime.match(/^(\d{2}):(\d{2})$/);
    callbackAt = t ? firmInstant(cbDate, Number(t[1]), Number(t[2])) : null;
    if (!callbackAt) return bad("The callback needs a date and a time.");
  }

  const result = await recordOutcome(actor, {
    prospectId: str(body.prospectId),
    outcome: str(body.outcome),
    contactId: str(body.contactId) || null,
    callbackAt,
    reason: str(body.reason) || null,
    note: str(body.note) || null,
  });
  return result.ok ? NextResponse.json(result) : bad(result.error, 422);
}
