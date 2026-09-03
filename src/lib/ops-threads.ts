import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, canSeeFile, type Actor, type Role } from "./ops-authz";
import { raise } from "./ops-notify";
import { canPostToThread, canReadThread, mentionsIn, recipientsOf, type ThreadSubject } from "./ops-comms";

/**
 * Threads and messages.
 *
 * EVERY READ GOES THROUGH canReadThread
 * -------------------------------------
 * There is no second place that decides who can see a conversation. The rule is
 * pure, comms-audit asserts it exhaustively, and this file's job is to load the
 * facts that rule needs and then do what it says. The most important of those
 * facts is whether the actor can see the FILE a thread belongs to, and that
 * comes from canSeeFile in ops-authz rather than from a fresh guess here.
 *
 * A DIRECT THREAD IS PRIVATE FROM AN ADMINISTRATOR
 * ------------------------------------------------
 * Stated again here because this is the file where somebody would add the
 * override. An admin can see in the audit trail that a thread exists. They
 * cannot read it. That is deliberate and it is the reason anybody would use it.
 */

type Context = { ip?: string | null; userAgent?: string | null };

export type ThreadRow = {
  id: string;
  kind: "file" | "direct" | "channel";
  file_id: string | null;
  name: string | null;
  channel_roles: Role[];
  last_message_at: string | null;
  created_at: string;
};

export type ThreadListItem = ThreadRow & {
  participants: { id: string; name: string; role: Role }[];
  unread: number;
  preview: string | null;
  title: string;
};

const THREAD_COLUMNS = "id, kind, file_id, name, channel_roles, last_message_at, created_at";

async function participantsOf(threadIds: string[]) {
  const db = supabaseAdmin();
  const byThread = new Map<string, { id: string; name: string; role: Role; lastReadAt: string | null }[]>();
  if (!db || threadIds.length === 0) return byThread;

  const { data } = await db
    .from("eng_thread_participants")
    .select("thread_id, profile_id, last_read_at, eng_profiles!inner(display_name, role)")
    .in("thread_id", threadIds);

  for (const row of (data ?? []) as unknown as {
    thread_id: string;
    profile_id: string;
    last_read_at: string | null;
    eng_profiles: { display_name: string; role: Role };
  }[]) {
    byThread.set(row.thread_id, [
      ...(byThread.get(row.thread_id) ?? []),
      {
        id: row.profile_id,
        name: row.eng_profiles.display_name,
        role: row.eng_profiles.role,
        lastReadAt: row.last_read_at,
      },
    ]);
  }
  return byThread;
}

/** The file ids this actor can see, for scoping file threads in one pass. */
async function visibleFileIds(actor: Actor, fileIds: string[]): Promise<Set<string>> {
  const db = supabaseAdmin();
  const visible = new Set<string>();
  if (!db || fileIds.length === 0) return visible;
  if (actor.role === "admin") {
    for (const id of fileIds) visible.add(id);
    return visible;
  }

  const { data: files } = await db
    .from("eng_files")
    .select("id, status, assigned_tech_id, assigned_engineer_id")
    .in("id", fileIds);

  const { data: offers } = await db
    .from("eng_assignments")
    .select("file_id, tech_id")
    .in("file_id", fileIds)
    .eq("tech_id", actor.id);
  const offered = new Set((offers ?? []).map((o) => o.file_id as string));

  for (const file of files ?? []) {
    const subject = {
      id: file.id as string,
      status: file.status as string,
      assigned_tech_id: (file.assigned_tech_id as string | null) ?? null,
      assigned_engineer_id: (file.assigned_engineer_id as string | null) ?? null,
      offered_tech_ids: offered.has(file.id as string) ? [actor.id] : [],
    };
    if (canSeeFile(actor, subject)) visible.add(file.id as string);
  }
  return visible;
}

export async function listThreads(actor: Actor | null): Promise<ThreadListItem[]> {
  const db = supabaseAdmin();
  if (!db || !actor || actor.status !== "active") return [];

  const { data } = await db
    .from("eng_threads")
    .select(THREAD_COLUMNS)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const rows = (data ?? []) as ThreadRow[];
  const byThread = await participantsOf(rows.map((r) => r.id));
  const visibleFiles = await visibleFileIds(
    actor,
    rows.filter((r) => r.file_id).map((r) => r.file_id as string),
  );

  const readable = rows.filter((row) => {
    const subject: ThreadSubject = {
      id: row.id,
      kind: row.kind,
      fileId: row.file_id,
      participantIds: (byThread.get(row.id) ?? []).map((p) => p.id),
      channelRoles: row.channel_roles ?? [],
    };
    return canReadThread(actor, subject, row.file_id ? visibleFiles.has(row.file_id) : false);
  });

  if (readable.length === 0) return [];

  // Titles for file threads, and the last message for a preview.
  const fileIds = readable.filter((r) => r.file_id).map((r) => r.file_id as string);
  const { data: files } = fileIds.length
    ? await db.from("eng_files").select("id, file_number, property_address").in("id", fileIds)
    : { data: [] };
  const fileById = new Map((files ?? []).map((f) => [f.id as string, f]));

  const { data: lastMessages } = await db
    .from("eng_messages")
    .select("thread_id, body, created_at")
    .in("thread_id", readable.map((r) => r.id))
    .order("created_at", { ascending: false })
    .limit(400);

  const previewByThread = new Map<string, string>();
  const countsByThread = new Map<string, { body: string; created_at: string }[]>();
  for (const m of lastMessages ?? []) {
    const id = m.thread_id as string;
    if (!previewByThread.has(id)) previewByThread.set(id, m.body as string);
    countsByThread.set(id, [...(countsByThread.get(id) ?? []), m as { body: string; created_at: string }]);
  }

  return readable.map((row) => {
    const participants = byThread.get(row.id) ?? [];
    const me = participants.find((p) => p.id === actor.id);
    const messages = countsByThread.get(row.id) ?? [];
    const unread = me?.lastReadAt
      ? messages.filter((m) => m.created_at > (me.lastReadAt as string)).length
      : messages.length;

    const file = row.file_id ? fileById.get(row.file_id) : null;
    const title =
      row.kind === "file"
        ? `${file?.file_number ?? "File"}: ${file?.property_address ?? "a file"}`
        : row.kind === "direct"
          ? participants
              .filter((p) => p.id !== actor.id)
              .map((p) => p.name)
              .join(", ") || "Direct message"
          : (row.name ?? "Channel");

    return {
      ...row,
      participants: participants.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      unread,
      preview: previewByThread.get(row.id) ?? null,
      title,
    };
  });
}

export type MessageRow = {
  id: number;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_role: Role | null;
  body: string;
  mentions: string[];
};

export type ThreadView = {
  thread: ThreadListItem;
  messages: MessageRow[];
  canPost: boolean;
};

export async function threadView(actor: Actor | null, threadId: string): Promise<ThreadView | null> {
  const db = supabaseAdmin();
  if (!db || !actor) return null;

  const all = await listThreads(actor);
  const thread = all.find((t) => t.id === threadId);
  if (!thread) return null;

  const { data } = await db
    .from("eng_messages")
    .select("id, created_at, author_id, body, mentions, eng_profiles(display_name, role)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);

  const messages = ((data ?? []) as unknown as {
    id: number;
    created_at: string;
    author_id: string | null;
    body: string;
    mentions: string[];
    eng_profiles: { display_name: string; role: Role } | null;
  }[]).map((m) => ({
    id: m.id,
    created_at: m.created_at,
    author_id: m.author_id,
    author_name: m.eng_profiles?.display_name ?? "Somebody who has left",
    author_role: m.eng_profiles?.role ?? null,
    body: m.body,
    mentions: m.mentions ?? [],
  }));

  // Reading it marks it read. Anything else needs a button nobody presses.
  await db
    .from("eng_thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("profile_id", actor.id);

  return {
    thread,
    messages,
    canPost: canPostToThread(
      actor,
      {
        id: thread.id,
        kind: thread.kind,
        fileId: thread.file_id,
        participantIds: thread.participants.map((p) => p.id),
        channelRoles: thread.channel_roles ?? [],
      },
      thread.file_id ? true : false,
    ),
  };
}

/**
 * The thread for a file, created on first use.
 *
 * Participants are whoever is on the file right now. A technician assigned
 * later is added when they are, rather than the thread being a fixed cast from
 * the moment somebody first typed in it.
 */
export async function fileThread(actor: Actor & { email: string }, fileId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data: existing } = await db.from("eng_threads").select("id").eq("file_id", fileId).maybeSingle();
  const { data: file } = await db
    .from("eng_files")
    .select("id, file_number, assigned_tech_id, assigned_engineer_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return null;

  let threadId = existing?.id as string | undefined;
  if (!threadId) {
    const { data: created, error } = await db
      .from("eng_threads")
      .insert({ kind: "file", file_id: fileId, created_by: actor.id })
      .select("id")
      .single();
    if (error || !created) return null;
    threadId = created.id as string;
  }

  const { data: admins } = await db.from("eng_profiles").select("id").eq("role", "admin").eq("status", "active");
  const wanted = new Set<string>([
    actor.id,
    ...(admins ?? []).map((a) => a.id as string),
    ...(file.assigned_tech_id ? [file.assigned_tech_id as string] : []),
    ...(file.assigned_engineer_id ? [file.assigned_engineer_id as string] : []),
  ]);

  await db
    .from("eng_thread_participants")
    .upsert(
      [...wanted].map((profile_id) => ({ thread_id: threadId, profile_id })),
      { onConflict: "thread_id,profile_id", ignoreDuplicates: true },
    );

  return threadId;
}

/**
 * A direct thread between two people, created once.
 *
 * The direct_key is the two ids sorted, so a second attempt to start the same
 * conversation finds the first. Without it, two people click "message" at the
 * same time and the conversation splits, with each side reading a different
 * half and neither knowing.
 */
export async function directThread(
  actor: Actor & { email: string },
  otherId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (otherId === actor.id) return { ok: false, error: "You cannot message yourself." };

  const { data: other } = await db
    .from("eng_profiles")
    .select("id, status")
    .eq("id", otherId)
    .maybeSingle();
  if (!other || other.status !== "active") return { ok: false, error: "That person is not on the platform." };

  const key = [actor.id, otherId].sort().join(":");
  const { data: existing } = await db.from("eng_threads").select("id").eq("direct_key", key).maybeSingle();
  if (existing) return { ok: true, id: existing.id as string };

  const { data: created, error } = await db
    .from("eng_threads")
    .insert({ kind: "direct", created_by: actor.id, direct_key: key })
    .select("id")
    .single();
  if (error || !created) {
    /*
     * A unique violation means somebody else created the same conversation
     * between the two clicks. Finding theirs is the correct answer, not an
     * error: the point of the key is that there is one thread.
     */
    const { data: raced } = await db.from("eng_threads").select("id").eq("direct_key", key).maybeSingle();
    if (raced) return { ok: true, id: raced.id as string };
    return { ok: false, error: error?.message ?? "Could not start that conversation." };
  }

  await db.from("eng_thread_participants").insert([
    { thread_id: created.id, profile_id: actor.id },
    { thread_id: created.id, profile_id: otherId },
  ]);
  return { ok: true, id: created.id as string };
}

/** Create a role scoped channel. Administrators only. */
export async function createChannel(
  actor: Actor & { email: string },
  input: { name: string; roles: Role[] },
  context: Context = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.list")) return { ok: false, error: "Only an administrator creates a channel." };
  if (!input.name.trim()) return { ok: false, error: "A channel needs a name." };
  if (input.roles.length === 0) {
    return { ok: false, error: "Choose at least one role, or the channel is readable by nobody." };
  }

  const { data, error } = await db
    .from("eng_threads")
    .insert({ kind: "channel", name: input.name.trim(), channel_roles: input.roles, created_by: actor.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the channel." };

  await db.from("eng_thread_participants").insert({ thread_id: data.id, profile_id: actor.id });

  await writeAudit({
    actor,
    action: "channel.create",
    entityType: "thread",
    entityId: data.id,
    summary: `Created channel ${input.name.trim()} for ${input.roles.join(", ")}`,
    ...context,
  });
  return { ok: true, id: data.id as string };
}

/**
 * Post a message.
 *
 * The notification kind depends on whether somebody was named. A mention is a
 * direct request for attention and defaults to email; an ordinary message does
 * not, because a thread that emails on every line is a thread people mute and
 * then miss the one that mattered.
 */
export async function postMessage(
  actor: Actor & { email: string },
  threadId: string,
  body: string,
  context: Context = {},
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const text = body.trim();
  if (!text) return { ok: false, error: "An empty message is not a message." };
  if (text.length > 5000) return { ok: false, error: "That is too long for a message. Attach it to the file instead." };

  const view = await threadView(actor, threadId);
  if (!view) return { ok: false, error: "That conversation is not yours." };
  if (!view.canPost) return { ok: false, error: "You cannot post to that conversation." };

  const mentions = mentionsIn(text, view.thread.participants.map((p) => ({ id: p.id, displayName: p.name })));

  const { data, error } = await db
    .from("eng_messages")
    .insert({ thread_id: threadId, author_id: actor.id, body: text, mentions })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not post that." };

  await db.from("eng_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
  await db
    .from("eng_thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("profile_id", actor.id);

  const recipients = recipientsOf(
    {
      id: threadId,
      kind: view.thread.kind,
      fileId: view.thread.file_id,
      participantIds: view.thread.participants.map((p) => p.id),
      channelRoles: view.thread.channel_roles ?? [],
    },
    actor.id,
  );

  const roleById = new Map(view.thread.participants.map((p) => [p.id, p.role]));
  for (const profileId of recipients) {
    const role = roleById.get(profileId);
    if (!role) continue;
    const mentioned = mentions.includes(profileId);
    await raise({
      profileId,
      role,
      kind: mentioned ? "mention" : "message.received",
      title: mentioned
        ? `${actor.email.split("@")[0]} mentioned you in ${view.thread.title}`
        : `New message in ${view.thread.title}`,
      body: text.length > 160 ? `${text.slice(0, 157)}...` : text,
      href: `/portal/messages?id=${threadId}`,
      entityType: "thread",
      entityId: threadId,
    });
  }

  return { ok: true, id: data.id as number };
}

/** People this actor may start a direct conversation with. */
export async function messageablepeople(actor: Actor | null): Promise<{ id: string; name: string; role: Role }[]> {
  const db = supabaseAdmin();
  if (!db || !actor || actor.status !== "active") return [];
  const { data } = await db
    .from("eng_profiles")
    .select("id, display_name, role")
    .eq("status", "active")
    .neq("id", actor.id)
    .order("display_name");
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.display_name as string,
    role: p.role as Role,
  }));
}
