import "server-only";
import { supabaseAdmin } from "./supabase";
import { readEvery } from "./bounded-read";
import { createTask } from "./ops-tasks";
import { normaliseEmail, suppress } from "./marketing-suppression";
import type { Actor } from "./ops-authz";
/*
 * The channel list lives in a module with no server-only on it, because the
 * screen needs the same values this validates against. Re-exported here so a
 * server caller has one import rather than two.
 */
export { CHANNELS, CHANNEL_VALUES, type RequestChannel } from "./deletion-request-kinds";
import type { RequestChannel } from "./deletion-request-kinds";

/**
 * SOMEBODY ASKED TO BE FORGOTTEN.
 *
 * Phase 12 Section 3, the customer side. Operator ruling: A DELETION REQUEST
 * PRODUCES A TASK, NOT A DELETION. Nothing in this file removes a row from
 * anything, and nothing in it can reach `runRetention`.
 *
 * WHY THAT SEPARATION IS THE WHOLE DESIGN AND NOT A LIMITATION
 * ------------------------------------------------------------
 * The obvious build wires this to retention: a request comes in, a sweep goes
 * out. It would be wrong twice over.
 *
 * It would be wrong about the LAW. What the firm may delete is with counsel and
 * TBPELS; 41 tables in retention-policy.ts say `kept_pending_counsel` for
 * exactly that reason, and the published privacy policy already tells the
 * public that engineering records are kept for the periods Texas requires. A
 * request that deleted things would make that policy false the first time
 * somebody used it.
 *
 * And it would be wrong about the MACHINERY. Retention deletes by table against
 * a declared floor, planning the whole set and reconciling it against a rollup.
 * There is no shape of that for "everything about one person", and inventing
 * one to satisfy a screen is how a platform ends up with a second deletion path
 * that none of Section 2's guards are watching.
 *
 * So the request is recorded, a task is raised, and a person decides. The
 * one thing the firm can do immediately and without a ruling is stop writing to
 * them, and this does that in the same motion.
 */

const db = () => supabaseAdmin();

export type DeletionRequest = {
  id: string;
  createdAtCt: string;
  subjectEmail: string;
  subjectNote: string | null;
  channel: RequestChannel;
  channelNote: string | null;
  askedFor: string;
  takenByEmail: string | null;
  taskId: string | null;
  suppressed: boolean;
  answered: { at: string; because: string } | null;
};

type Row = Record<string, unknown>;

const toRequest = (r: Row): DeletionRequest => ({
  id: String(r.id),
  createdAtCt: String(r.created_at_ct),
  subjectEmail: String(r.subject_email),
  subjectNote: r.subject_note === null || r.subject_note === undefined ? null : String(r.subject_note),
  channel: r.channel as RequestChannel,
  channelNote: r.channel_note === null || r.channel_note === undefined ? null : String(r.channel_note),
  askedFor: String(r.asked_for),
  takenByEmail: r.taken_by_email === null || r.taken_by_email === undefined ? null : String(r.taken_by_email),
  taskId: r.task_id === null || r.task_id === undefined ? null : String(r.task_id),
  suppressed: Boolean(r.suppressed),
  answered:
    r.answered_at === null || r.answered_at === undefined
      ? null
      : { at: String(r.answered_at), because: String(r.answered_because ?? "") },
});

export type RecordInput = {
  subjectEmail: string;
  subjectNote?: string;
  channel: RequestChannel;
  channelNote?: string;
  askedFor: string;
};

export type RecordResult =
  | { ok: true; id: string; taskId: string | null; suppressed: boolean; warning: string | null }
  | { ok: false; error: string };

/**
 * Write down what somebody asked, raise the task, and stop writing to them.
 *
 * THE ORDER MATTERS AND IT IS THE OPPOSITE OF THE OBVIOUS ONE.
 *
 * The request row goes FIRST, before the task and before the suppression. A
 * failure after it leaves a recorded request with a missing follow up, which is
 * visible on the screen and fixable. A failure before it leaves a person who
 * rang the firm and asked to be forgotten with nothing anywhere saying they
 * did, which is the one outcome nobody can find later.
 *
 * That is the same reasoning the retention manifest uses: write the evidence
 * before doing the thing, because the crash you cannot describe is worse than
 * the one you can.
 */
export async function recordDeletionRequest(
  actor: Actor & { email: string },
  input: RecordInput,
): Promise<RecordResult> {
  const client = db();
  if (!client) return { ok: false, error: "The database is not configured." };

  const subject = normaliseEmail(input.subjectEmail);
  if (!subject || !subject.includes("@")) {
    return { ok: false, error: "Which address did they ask about?" };
  }

  const askedFor = input.askedFor.trim();
  if (!askedFor) {
    return {
      ok: false,
      error:
        "Write down what they actually asked for, in their words. A paraphrase is the firm's account of what somebody wanted, and that is the thing this record exists so nobody has to take on trust.",
    };
  }

  const channelNote = (input.channelNote ?? "").trim();
  if (input.channel === "other" && !channelNote) {
    return { ok: false, error: "Say how it reached the firm. Something else with no note is not a channel." };
  }

  const { data, error } = await client
    .from("eng_deletion_requests")
    .insert({
      subject_email: subject,
      subject_note: (input.subjectNote ?? "").trim() || null,
      channel: input.channel,
      channel_note: channelNote || null,
      asked_for: askedFor,
      taken_by: actor.id,
      taken_by_email: actor.email,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: `The request was not recorded, so nothing else was done: ${error?.message ?? "no row returned"}` };
  }

  const id = String(data.id);
  const notes: string[] = [];

  /*
   * The one thing the firm can do immediately and without a ruling.
   *
   * Somebody asking to be forgotten has unambiguously asked not to be written
   * to, so the address goes on the do not contact list now rather than waiting
   * on the task. It is narrower than what they asked for and it is real, and
   * the screen says exactly that rather than letting the tick read as "done".
   */
  const put = await suppress(
    subject,
    `Asked to be forgotten on ${new Date().toISOString().slice(0, 10)}, taken by ${actor.email}. ` +
      `Marketing stopped immediately; what else the firm may do is with counsel. Request ${id}.`,
  );
  if (put.ok) {
    await client.from("eng_deletion_requests").update({ suppressed: true }).eq("id", id);
  } else {
    notes.push(`the address was NOT added to the do not contact list: ${put.error}`);
  }

  /*
   * And the task, which is the ruling: a request produces work for a person,
   * never a deletion. Unassigned on purpose. Assigning it to whoever took the
   * call would put a decision about a regulatory record on the desk of the
   * person who answered the telephone.
   */
  let taskId: string | null = null;
  const task = await createTask(actor, {
    title: `Deletion request from ${subject}`,
    description:
      `${askedFor}\n\n` +
      `Taken by ${actor.email} through ${input.channel}${channelNote ? ` (${channelNote})` : ""}. ` +
      `${put.ok ? "Marketing has already been stopped for this address." : "MARKETING WAS NOT STOPPED, see the request."} ` +
      `Nothing has been deleted and nothing will be by this task: what the firm may remove is with counsel, and the ` +
      `only path that removes a row is a retention run an administrator plans against a declared floor. ` +
      `Answer the person, and record what was said on the request itself.`,
    priority: "high",
  });

  if (task.ok) {
    taskId = task.id;
    await client.from("eng_deletion_requests").update({ task_id: task.id }).eq("id", id);
  } else {
    notes.push(`no task was raised: ${task.error}`);
  }

  return {
    ok: true,
    id,
    taskId,
    suppressed: put.ok,
    warning: notes.length ? `The request is recorded, and ${notes.join("; ")}.` : null,
  };
}

/**
 * Record what the firm said, in the words of whoever said it.
 *
 * There is no status to set. Every value an enum could carry here is a decision
 * about what the firm may do with an engineering record, and none of those
 * decisions has been made; shipping one would be this platform inventing the
 * answer and then offering it on a screen.
 */
export async function answerDeletionRequest(
  actor: Actor,
  id: string,
  because: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = db();
  if (!client) return { ok: false, error: "The database is not configured." };

  const said = because.trim();
  if (!said) {
    return { ok: false, error: "What was said to them? A request marked answered with no words records somebody closing a screen." };
  }

  const { data: existing } = await client
    .from("eng_deletion_requests")
    .select("answered_at")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "There is no request with that id." };
  if (existing.answered_at) {
    return {
      ok: false,
      error:
        "That request has already been answered. What was said is not edited afterwards; if there is more to say, it belongs where the conversation is.",
    };
  }

  const { error } = await client
    .from("eng_deletion_requests")
    .update({ answered_at: new Date().toISOString(), answered_by: actor.id, answered_because: said })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Every request, newest first.
 *
 * `readEvery` rather than `readAll`, and the reason the ruling asks for: this
 * list may never be partial. A screen showing some of the people who asked to
 * be forgotten, with no sign that it is showing some, is a screen somebody
 * works through believing they have finished.
 *
 * Returns null on a failed read rather than an empty list, because a firm that
 * has received no requests and a firm that could not read them are different
 * facts and only one of them means there is nothing to do.
 */
export async function listDeletionRequests(): Promise<DeletionRequest[] | null> {
  const client = db();
  if (!client) return null;

  const read = await readEvery<Row>((from, to) =>
    client
      .from("eng_deletion_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  if (!read.ok) {
    console.error("[deletion] the requests could not be listed:", read.error);
    return null;
  }
  return read.rows.map(toRequest);
}
