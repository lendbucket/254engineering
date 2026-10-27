import { NextResponse, type NextRequest } from "next/server";
import { recordStatusUpload, signStatusUpload, STATUS_UPLOAD_NOT_HERE } from "@/lib/status-uploads";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * A DOCUMENT THE FIRM ASKED FOR, SENT FROM THE CUSTOMER'S STATUS PAGE.
 * Robert's addendum of 2026-10-25, item 4.
 *
 * Two steps, as the order flow does it. "sign" prepares a signed upload into
 * the private bucket for one requested document; the browser sends the file
 * there directly, which is how a 40 MB plan set travels without passing
 * through a function. "record" then checks the file arrived and records it on
 * the job as that document.
 *
 * The token in the body is the credential on both steps, resolved afresh each
 * time, and only a document the firm is still waiting on can be sent. No
 * token and a wrong one get the same answer, so neither tells a guesser which
 * of their tokens was real.
 */

const noStore = { "Cache-Control": "no-store" };
const notHere = () => NextResponse.json({ ok: false, error: STATUS_UPLOAD_NOT_HERE }, { status: 404, headers: noStore });

async function handlePOST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const token = str(body?.token);
  const fieldId = str(body?.fieldId);
  if (!token || !fieldId) return notHere();

  if (body?.action === "sign") {
    const signed = await signStatusUpload({
      token,
      fieldId,
      filename: str(body?.filename),
      contentType: str(body?.contentType),
      size: Number(body?.size ?? 0),
    });
    if (signed.ok) return NextResponse.json(signed, { headers: noStore });
    return signed.error === STATUS_UPLOAD_NOT_HERE
      ? notHere()
      : NextResponse.json({ ok: false, error: signed.error }, { status: 400, headers: noStore });
  }

  if (body?.action === "record") {
    const recorded = await recordStatusUpload({
      token,
      fieldId,
      storageKey: str(body?.storageKey),
      contentType: str(body?.contentType),
      byteSize: Number(body?.byteSize ?? 0),
    });
    if (recorded.ok) return NextResponse.json(recorded, { headers: noStore });
    return recorded.error === STATUS_UPLOAD_NOT_HERE
      ? notHere()
      : NextResponse.json({ ok: false, error: recorded.error }, { status: 400, headers: noStore });
  }

  return notHere();
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
