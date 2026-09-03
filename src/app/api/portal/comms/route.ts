import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import type { Role } from "@/lib/ops-authz";
import { assignTask, createTask, seedComplianceTasks, setTaskStatus } from "@/lib/ops-tasks";
import { createChannel, directThread, fileThread, postMessage } from "@/lib/ops-threads";
import { markRead, savePreference } from "@/lib/ops-notify";
import { TASK_STATUSES, type NotificationKind, type Recurrence, type TaskPriority } from "@/lib/ops-comms";

/**
 * Tasks, threads, and notification preferences.
 *
 * One endpoint for the three because they are the same kind of act: somebody
 * organising their own work. Nothing here moves a file, seals anything, or pays
 * anybody, which is why it is not in with those.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  // -------------------------------------------------------------- tasks

  if (action === "create_task") {
    const result = await createTask(
      actor,
      {
        title: String(body?.title ?? ""),
        description: body?.description ? String(body.description) : null,
        assigneeId: body?.assigneeId ? String(body.assigneeId) : null,
        dueAt: body?.dueAt ? String(body.dueAt) : null,
        priority: (body?.priority as TaskPriority) ?? "normal",
        fileId: body?.fileId ? String(body.fileId) : null,
        recurrence: (body?.recurrence as Recurrence) ?? null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  if (action === "set_task_status") {
    const status = String(body?.status ?? "");
    if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) return bad("Unknown task status.");
    const result = await setTaskStatus(
      actor,
      String(body?.taskId ?? ""),
      status as (typeof TASK_STATUSES)[number],
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, nextId: result.nextId ?? null }) : bad(result.error);
  }

  if (action === "assign_task") {
    const result = await assignTask(
      actor,
      String(body?.taskId ?? ""),
      body?.assigneeId ? String(body.assigneeId) : null,
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "seed_compliance") {
    const result = await seedComplianceTasks(actor, context);
    return result.ok ? NextResponse.json({ ok: true, result: result.result }) : bad(result.error);
  }

  // ------------------------------------------------------------ threads

  if (action === "open_file_thread") {
    const id = await fileThread(actor, String(body?.fileId ?? ""));
    return id ? NextResponse.json({ ok: true, id }) : bad("Could not open that file's thread.");
  }

  if (action === "open_direct") {
    const result = await directThread(actor, String(body?.profileId ?? ""));
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  if (action === "create_channel") {
    const roles = Array.isArray(body?.roles) ? (body.roles.map(String) as Role[]) : [];
    const result = await createChannel(actor, { name: String(body?.name ?? ""), roles }, context);
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  if (action === "post_message") {
    const result = await postMessage(actor, String(body?.threadId ?? ""), String(body?.body ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  // ------------------------------------------------------ notifications

  if (action === "mark_read") {
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
    await markRead(actor.id, ids);
    return NextResponse.json({ ok: true });
  }

  if (action === "save_preference") {
    const result = await savePreference(actor.id, String(body?.kind ?? "") as NotificationKind, {
      email: body?.email === true,
      sms: body?.sms === true,
    });
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  return bad("Unknown action.");
}
