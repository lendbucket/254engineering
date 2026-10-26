import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { draftLineAddendum } from "@/lib/scope-addendum";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE OWNER DRAFTS A SCOPE ADDENDUM FOR THE ENGINEER TO SIGN. POST ONLY.
 *
 * Robert's ruling of 2026-10-26, 07:10 Central (0095): the owner drafts the
 * addendum (line, amount, text); it waits on the engineer's portal home; he
 * signs it from his own session with a fresh code (/api/portal/addenda/sign).
 * addenda.draft is checked here so a refusal costs nothing, and again in the
 * library. Drafting opens nothing and pays nothing.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "addenda.draft")) return bad("Only the owner drafts a scope addendum.", 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Send the request as JSON.");
  const drafted = await draftLineAddendum(actor, {
    deliverable: typeof body.deliverable === "string" ? body.deliverable : "",
    payDollars: typeof body.payDollars === "string" ? body.payDollars : "",
    scope: typeof body.scope === "string" ? body.scope : "",
  });
  return drafted.ok ? NextResponse.json({ ok: true, id: drafted.id }) : bad(drafted.error);
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
