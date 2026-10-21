import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { logContact } from "@/lib/ops-contact-log";
import { CONTACT_SUBJECTS, type ContactChannel, type ContactOutcome, type ContactSubject } from "@/lib/contact-log-rules";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * Log a call, an email or a note against any record. contact_log.write,
 * 2026-10-20. The entry is append only at the database, and the audit row is
 * written first by logContact through writeAuditOrRefuse.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!can(actor, "contact_log.write")) return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const subject = String(body?.subject ?? "") as ContactSubject;
  if (!(CONTACT_SUBJECTS as readonly string[]).includes(subject)) {
    return NextResponse.json({ ok: false, error: "That is not something a call can be logged against." }, { status: 400 });
  }
  const str = (k: string) => (typeof body?.[k] === "string" && (body[k] as string).trim() ? (body[k] as string) : null);
  const result = await logContact(actor, {
    subject,
    subjectId: String(body?.subjectId ?? ""),
    channel: String(body?.channel ?? "") as ContactChannel,
    direction: (str("direction") as "outbound" | "inbound" | null) ?? null,
    outcome: (str("outcome") as ContactOutcome | null) ?? null,
    body: str("body"),
    visitAt: str("visitAt"),
    followUpOn: str("followUpOn"),
  });
  return result.ok
    ? NextResponse.json(result)
    : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
