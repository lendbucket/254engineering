import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { answerDeletionRequest, recordDeletionRequest, type RequestChannel } from "@/lib/deletion-requests";

export const dynamic = "force-dynamic";

/**
 * TAKING A REQUEST TO BE FORGOTTEN, AND RECORDING WHAT THE FIRM SAID BACK.
 *
 * Operator ruling: A DELETION REQUEST PRODUCES A TASK, NOT A DELETION. There is
 * no verb in this file that removes anything, and there is no path from here to
 * `runRetention`. A person holding `retention.execute` plans a run against a
 * table the declaration allows, and that is the only way a row is ever removed.
 *
 * WHY IT SITS BEHIND suppressions.manage
 * ---------------------------------------
 * Same permission, same desk, same telephone call. The person who takes "stop
 * writing to me" is the person who takes "delete everything about me", and the
 * two arrive in the same sentence more often than not. Giving this its own
 * grant would mean a firm where the person answering the call can record half
 * of what they were told.
 *
 * It is emphatically NOT retention.execute. That is the point of the ruling:
 * taking the request and acting on it are different acts by different people,
 * and 0030 seeded the deleting permission to the administrator alone so this
 * screen could never grow into one that deletes.
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function gate() {
  const actor = await currentActor();
  if (!actor) return { error: bad("Not signed in.", 401) };
  if (actor.status !== "active") return { error: bad("This account is not active.", 403) };
  if (!can(actor, "suppressions.manage")) {
    return { error: bad("You cannot record a deletion request.", 403) };
  }
  return { actor };
}

const CHANNELS = new Set<RequestChannel>(["telephone", "email", "letter", "in_person", "other"]);

export async function POST(request: NextRequest) {
  const gated = await gate();
  if (gated.error) return gated.error;
  const { actor } = gated;
  if (!actor.email) return bad("This account has no address on it, so a request could not name who took it.");

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const channel = String(body.channel ?? "");
  if (!CHANNELS.has(channel as RequestChannel)) return bad("How did it reach the firm?");

  const done = await recordDeletionRequest(actor as typeof actor & { email: string }, {
    subjectEmail: String(body.subjectEmail ?? ""),
    subjectNote: typeof body.subjectNote === "string" ? body.subjectNote : undefined,
    channel: channel as RequestChannel,
    channelNote: typeof body.channelNote === "string" ? body.channelNote : undefined,
    askedFor: String(body.askedFor ?? ""),
  });

  if (!done.ok) return bad(done.error);

  await writeAudit({
    actor,
    action: "deletion_request.recorded",
    entityType: "deletion_request",
    entityId: done.id,
    summary:
      `Recorded a deletion request from ${String(body.subjectEmail ?? "").toLowerCase()}, taken through ${channel}. ` +
      `${done.suppressed ? "Marketing was stopped for that address immediately. " : "MARKETING WAS NOT STOPPED, see the request. "}` +
      `${done.taskId ? `Task ${done.taskId} was raised. ` : "NO TASK WAS RAISED, see the request. "}` +
      "Nothing was deleted: what the firm may remove is with counsel, and the only path that removes a row is a retention run.",
    ...(await requestContext()),
  });

  return NextResponse.json({ ok: true, id: done.id, warning: done.warning });
}

export async function PATCH(request: NextRequest) {
  const gated = await gate();
  if (gated.error) return gated.error;
  const { actor } = gated;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  const because = String(body.because ?? "");
  if (!id) return bad("Which request?");

  const done = await answerDeletionRequest(actor, id, because);
  if (!done.ok) return bad(done.error, done.error.includes("already been answered") ? 409 : 400);

  await writeAudit({
    actor,
    action: "deletion_request.answered",
    entityType: "deletion_request",
    entityId: id,
    summary: `Answered a deletion request: ${because.trim()}`,
    ...(await requestContext()),
  });

  return NextResponse.json({ ok: true });
}
