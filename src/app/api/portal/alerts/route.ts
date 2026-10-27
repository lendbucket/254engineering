import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { addAlertRecipient, removeAlertRecipient } from "@/lib/alert-recipients";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * WHERE THE OFFICE'S ALERTS GO, EDITED BY THE OWNER. Robert's addendum of
 * 2026-10-25, item 8b; table eng_alert_recipients, 0099.
 *
 * alerts.manage, the owner alone. The library checks the grant again and writes
 * the audit row before it changes anything, so this route is not the only
 * thing standing between a request and the list.
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (actor.status !== "active") return bad("This account is not active.", 403);
  if (!can(actor, "alerts.manage")) return bad("You cannot change where alerts go.", 403);

  const body = (await request.json().catch(() => null)) as { action?: unknown; email?: unknown; id?: unknown } | null;
  if (!body) return bad("That request was not readable.");

  if (body.action === "add") {
    const done = await addAlertRecipient(actor, typeof body.email === "string" ? body.email : "");
    return done.ok ? NextResponse.json({ ok: true }) : bad(done.error);
  }
  if (body.action === "remove") {
    const done = await removeAlertRecipient(actor, typeof body.id === "string" ? body.id : "");
    return done.ok ? NextResponse.json({ ok: true }) : bad(done.error);
  }
  return bad("Say whether to add or remove an address.");
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
