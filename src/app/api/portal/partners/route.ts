import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { createPartner } from "@/lib/ops-partners-admin";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * Creating a partner.
 *
 * The capability is checked here AND in the module. Neither is redundant: this
 * one answers the request with a 403 the screen can show, and the one in the
 * module is what a second route added next month cannot skip.
 */

export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!can(actor, "partners.manage")) {
    return NextResponse.json(
      { ok: false, error: "You do not have permission to manage the referral program." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { organisation?: string; contactName?: string; contactEmail?: string; code?: string }
    | null;

  const result = await createPartner(actor, {
    organisation: String(body?.organisation ?? ""),
    contactName: String(body?.contactName ?? ""),
    contactEmail: String(body?.contactEmail ?? ""),
    code: String(body?.code ?? ""),
  });

  return result.ok
    ? NextResponse.json({ ok: true, id: result.id })
    : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
