import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import type { RoleKey } from "@/lib/ops-authz";
import { assignTask, createTask, seedComplianceTasks, setTaskStatus } from "@/lib/ops-tasks";
import {
  createChannel,
  directThread,
  fileThread,
  postMessage,
  searchMessages,
  threadView,
  MESSAGE_BUCKET,
} from "@/lib/ops-threads";
import { supabaseAdmin } from "@/lib/supabase";
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

/** Matching the eng-messages bucket, which is set to the same list. */
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

/** 20MB, matching the bucket. A modern phone camera clears twelve. */
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** Per message. More than this is a folder, not a message. */
const MAX_ATTACHMENTS = 6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const roles = Array.isArray(body?.roles) ? body.roles.map(String) : [];
    const result = await createChannel(actor, { name: String(body?.name ?? ""), roles }, context);
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  /*
   * THE UPLOAD IS PREPARED, NOT PERFORMED.
   *
   * A signed upload url, the same mechanism the evidence path uses, so the
   * photograph goes from the phone straight to storage and never through this
   * function. A 12MB image through a serverless request is a timeout waiting
   * for a bad signal, which is exactly the signal a technician on a roof has.
   *
   * The key is namespaced by THREAD, so an object can be traced to the
   * conversation it belongs to without reading the message row.
   */
  if (action === "prepare_attachment") {
    const threadId = String(body?.threadId ?? "");
    const contentType = String(body?.contentType ?? "");
    const byteSize = Number(body?.byteSize ?? 0);

    if (!UUID.test(threadId)) return bad("That is not a conversation.");
    if (!ALLOWED_ATTACHMENT_TYPES.includes(contentType)) {
      return bad("That kind of file cannot be attached to a message.");
    }
    if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_ATTACHMENT_BYTES) {
      return bad("That file is too large to attach.");
    }

    /*
     * PERMISSION IS CHECKED BEFORE A URL IS ISSUED, not when the message is
     * posted. A signed upload url handed to somebody who cannot post is a write
     * into the firm's storage by somebody with no business there, whether or
     * not a message ever appears.
     */
    const view = await threadView(actor, threadId);
    if (!view || !view.canPost) return bad("You cannot post to that conversation.", 403);

    const db = supabaseAdmin();
    if (!db) return bad("The database is not configured.", 503);

    /*
     * The extension comes from the CONTENT TYPE, never from a name the sender
     * supplied. Same rule as the evidence path and for the same reason: a
     * filename is not a fact about a file.
     */
    const ext = contentType === "application/pdf" ? "pdf" : (contentType.split("/")[1] ?? "jpg");
    const path = `${threadId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await db.storage
      .from(MESSAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data) return bad(error?.message ?? "Could not prepare the upload.");

    return NextResponse.json({ ok: true, url: data.signedUrl, key: data.path });
  }

  if (action === "post_message") {
    /*
     * Attachments are rebuilt from the request rather than trusted wholesale.
     * The key must be one this thread issued, which is what the prefix check
     * enforces: a caller cannot attach an object belonging to a conversation
     * they are not in by naming its key.
     */
    const threadId = String(body?.threadId ?? "");
    const raw = Array.isArray(body?.attachments) ? body.attachments : [];
    const attachments = raw
      .slice(0, MAX_ATTACHMENTS)
      .map((a: Record<string, unknown>) => ({
        key: String(a?.key ?? ""),
        name: String(a?.name ?? "attachment").slice(0, 120),
        contentType: String(a?.contentType ?? ""),
        byteSize: Number(a?.byteSize ?? 0),
      }))
      .filter(
        (a) =>
          a.key.startsWith(`${threadId}/`) &&
          ALLOWED_ATTACHMENT_TYPES.includes(a.contentType) &&
          Number.isFinite(a.byteSize) &&
          a.byteSize > 0 &&
          a.byteSize <= MAX_ATTACHMENT_BYTES,
      );

    const result = await postMessage(actor, threadId, String(body?.body ?? ""), context, attachments);
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  if (action === "search_messages") {
    const found = await searchMessages(actor, {
      text: body?.text ? String(body.text) : null,
      authorId: body?.authorId ? String(body.authorId) : null,
      fileId: body?.fileId ? String(body.fileId) : null,
      since: body?.since ? String(body.since) : null,
      until: body?.until ? String(body.until) : null,
    });
    return NextResponse.json({ ok: true, ...found });
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
