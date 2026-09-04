import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { retryDeadJob } from "@/lib/ops-jobs";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * Retrying a dead job by hand.
 *
 * POST only and no GET, because the queue screen reads the queue directly on
 * the server. There is nothing here for a browser to fetch.
 *
 * Audited, because a retry re-runs a side effect: it can send an email a
 * customer already had, or move money adjacent work forward. That the operator
 * chose to is worth a row.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!can(actor, "jobs.manage")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.action !== "retry") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  const id = typeof body?.id === "number" ? body.id : Number(body?.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Which job?" }, { status: 400 });
  }

  const result = await retryDeadJob(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await writeAudit({
    actor: { id: actor.id, role: actor.role, email: actor.email },
    action: "jobs.retried",
    entityType: "job",
    entityId: String(id),
    summary: `${actor.email} put dead job ${id} back on the queue`,
  });

  return NextResponse.json({ ok: true });
}
