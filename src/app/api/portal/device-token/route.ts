import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { issueDeviceToken } from "@/lib/device-token";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * The store app asks to keep this sign in on the phone (0125; Robert's answer
 * of 2026-11-10, 6766967932). Behind the perimeter: only a FULL session reaches
 * it, because currentActor reads none other, so a token can only be made by a
 * sign in that has already passed the second factor where the role asks for
 * one. Only a field technician may hold one. The raw token is in this response
 * and nowhere else, ever; the server keeps its sha256.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { platform?: unknown } | null;
  const context = await requestContext();
  const issued = await issueDeviceToken({ id: actor.id, role: actor.role, email: actor.email }, body?.platform, context);
  if (!issued.ok) return NextResponse.json({ ok: false, error: issued.error }, { status: issued.status });
  const res = NextResponse.json({ ok: true, token: issued.token });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const POST = withSaveOutcome(handlePOST);
