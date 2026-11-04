import { NextResponse } from "next/server";
import { findByToken } from "@/lib/onboarding";
import { recordAttempt } from "@/lib/academy-record";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * A QUIZ ATTEMPT FROM THE PERSON'S OWN ONBOARDING LINK. Robert's ruling P3 of
 * 2026-11-01: every attempt recorded.
 *
 * The same credential as /api/onboarding: the invite token, resolved to the
 * onboarding on the server, and nothing else the caller sends identifies whose
 * attempt it is. A bad, expired or unknown token is a 404 with no further
 * detail. The score is computed on the server from the course in code; the
 * browser sends only the choices made.
 *
 * Only a field technician's onboarding takes the academy: the two courses are
 * the entry requirement for that role and no other.
 */

export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const onboarding = await findByToken(token);
  if (!onboarding) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  if (onboarding.status === "complete") {
    return NextResponse.json({ ok: false, error: "This onboarding is closed." }, { status: 409 });
  }
  if (onboarding.role !== "field_tech") {
    return NextResponse.json({ ok: false, error: "The training courses are for field technicians." }, { status: 403 });
  }

  const result = await recordAttempt(onboarding.id, String(body.course ?? ""), String(body.lesson ?? ""), body.answers);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
