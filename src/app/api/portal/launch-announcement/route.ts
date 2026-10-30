import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { withSaveOutcome } from "@/lib/save-outcome";
import { sendAnnouncementPreview, sendAnnouncementToWaitlist } from "@/lib/ops-announce";

/**
 * The "we are open" button on /portal/launch, 254-WF-024 step 4 (Robert, 10:52
 * Central 2026-10-29). Two steps, preview then send, and every refusal is
 * ops-announce.ts's: who may press it, the gate, no probe, the password, the
 * record first, and a send only of content that was previewed and not yet sent.
 *
 * POST only. A GET that mailed a list would be a GET a browser preload could fire.
 */

export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const step = String(body?.step ?? "");
  const password = String(body?.password ?? "");

  const result =
    step === "preview"
      ? await sendAnnouncementPreview(actor, password)
      : step === "send"
        ? await sendAnnouncementToWaitlist(actor, password, String(body?.contentHash ?? ""))
        : ({ ok: false, status: 400, error: 'Say which step: {"step":"preview"} or {"step":"send"}.' } as const);

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, message: result.message });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
