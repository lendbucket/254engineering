import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { sendBulkOffers } from "@/lib/ops-bulk-dispatch";

export const dynamic = "force-dynamic";

/**
 * Sending the picks a dispatcher made across many files.
 *
 * Phase 12 Section 4, Section 1, operator ruling at gate 1. The plans are built
 * server side and rendered by /portal/files/dispatch; this takes back only what
 * a person ticked.
 *
 * WHAT IS NOT TRUSTED
 * --------------------
 * Everything in the body. The file ids are resolved through the same scoped
 * read the review screen used, and each file then goes through the single file
 * sendOffers, which refuses a file that already has a technician and refuses a
 * service line with no published protocol. The browser carries picks, never a
 * decision.
 *
 * PARTIAL SUCCESS IS THE NORMAL ANSWER
 * -------------------------------------
 * It answers 200 with what was sent AND what was refused, per file, rather than
 * failing the whole request on one refusal. A dispatcher who ticked twelve
 * files and got a 400 would have no idea which eleven were fine.
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (actor.status !== "active") return bad("This account is not active.", 403);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return bad("Send a JSON body naming the picks.");
  }

  const raw = (body as { picks?: unknown })?.picks;
  if (!Array.isArray(raw)) return bad("Send picks as a list.");

  const picks = raw
    .filter((p): p is { fileId: string; techIds: unknown } =>
      Boolean(p) && typeof (p as { fileId?: unknown }).fileId === "string",
    )
    .map((p) => ({
      fileId: p.fileId,
      techIds: Array.isArray(p.techIds)
        ? [...new Set(p.techIds.filter((t): t is string => typeof t === "string" && t.length > 0))]
        : [],
    }));

  const hours = Number((body as { expiresInHours?: unknown })?.expiresInHours);
  const options = Number.isFinite(hours) && hours > 0 ? { expiresInHours: hours } : {};

  const context = await requestContext();
  const outcome = await sendBulkOffers({ ...actor, email: actor.email }, picks, options, context);
  if (!outcome.ok) return bad(outcome.error, 403);

  return NextResponse.json({ ok: true, ...outcome.result });
}
