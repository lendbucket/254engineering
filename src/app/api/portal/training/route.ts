import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { approveCourse } from "@/lib/academy-record";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * APPROVING A TRAINING COURSE. Robert's ruling P3 of 2026-11-01: course 1 is
 * drafted from the signed protocols and awaits the engineer's approval; course
 * 2 is Robert's. Who may approve which is decided in approveCourse
 * (academy-record.ts), from the session: the engineer of record by his licence,
 * the owner by his profile, nobody else by any grant. The record goes to the
 * audit log before the approval is written.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }
  if (body.action !== "approve") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });

  const context = await requestContext();
  const result = await approveCourse(actor, String(body.course ?? ""), Number(body.version), context);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
