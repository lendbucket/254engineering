import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { muteErrorType } from "@/lib/ops-observability";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * Muting a fault, and nothing else.
 *
 * POST only. The status page reads everything it needs on the server; there is
 * nothing here for a browser to fetch.
 *
 * WHY MUTING IS AUDITED
 * ---------------------
 * It is a decision to stop being told about something, and the question it
 * eventually produces is "why did nobody know". A row naming who silenced which
 * fault and when is the answer, and it is a row somebody will be glad exists.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!can(actor, "jobs.manage")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.action !== "mute") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint : "";
  if (!fingerprint) {
    return NextResponse.json({ ok: false, error: "Which fault?" }, { status: 400 });
  }

  /*
   * The flag is read explicitly rather than toggled from whatever is stored.
   *
   * A toggle would depend on the client's idea of the current state, and two
   * operators on the page at once would flip each other's decision. The client
   * says what it wants the value to be and the server writes that.
   */
  const muted = body.muted === true;

  const result = await muteErrorType(fingerprint, muted);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await writeAudit({
    actor: { id: actor.id, role: actor.role, email: actor.email },
    action: muted ? "errors.muted" : "errors.unmuted",
    entityType: "error_type",
    entityId: fingerprint.slice(0, 200),
    summary: `${actor.email} ${muted ? "stopped" : "resumed"} alerting on ${fingerprint.slice(0, 120)}`,
  });

  return NextResponse.json({ ok: true });
}
