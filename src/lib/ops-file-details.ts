import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { FILE_DETAIL_FIELDS } from "./file-detail-fields";

/**
 * EDITING A JOB'S CONTACT, ACCESS AND SCHEDULING DETAILS, AND NOTHING ELSE.
 *
 * Operator ruling, 2026-10-20, on files.update: neither staff level edits any
 * price, coastal line, total or refund term. They edit contact, access and
 * scheduling fields only. So this is its own action, files.update_details,
 * and the set it may write is a closed list in file-detail-fields.ts.
 *
 * WHAT IS DELIBERATELY NOT IN THE LIST. The roof's `access` answer looks like
 * an access field and is a QUALIFIER: "Can the roof be reached safely on the
 * day?" with No ruling the job out. Editing it after the fact would walk a job
 * past its own disqualifier, so it stays the customer's answer. The owner's
 * name decides who has authority to order, and the letter fields (addressed
 * to, requiring party, hard deadline) end up in a sealed document. None of
 * those is contact, access or scheduling.
 */

const CLOSED = ["sealed", "delivered", "closed", "cancelled"];

export async function updateFileDetails(
  actor: Actor | null,
  input: { fileId: string; values: Record<string, string> },
): Promise<{ ok: true; changed: string[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "files.update_details")) return { ok: false, error: "Your role cannot change a job's details." };

  const allowed = new Set<string>(FILE_DETAIL_FIELDS.map((f) => f.id));
  const entries = Object.entries(input.values ?? {});
  const refused = entries.filter(([id]) => !allowed.has(id)).map(([id]) => id);
  if (refused.length) {
    return { ok: false, error: `Only contact, access and scheduling details can be changed here. Not changed: ${refused.join(", ")}.` };
  }
  if (entries.length === 0) return { ok: false, error: "Nothing to change." };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was changed." };

  const { data: file, error: fileError } = await db
    .from("eng_files")
    .select("id, file_number, status")
    .eq("id", input.fileId)
    .maybeSingle();
  if (fileError) return { ok: false, error: `The job could not be read: ${fileError.message}` };
  if (!file) return { ok: false, error: "That job does not exist." };
  if (CLOSED.includes(file.status as string)) {
    return { ok: false, error: `${file.file_number} is ${file.status}, so its details are no longer changed.` };
  }

  const changed = entries.map(([id]) => id);
  const recorded = await writeAuditOrRefuse({
    actor,
    action: "file.details_updated",
    entityType: "file",
    entityId: input.fileId,
    summary: `${file.file_number}: ${changed.join(", ")} changed by staff.`,
    diff: Object.fromEntries(entries.map(([k, v]) => [k, v.trim()])),
  });
  if (!recorded.ok) return recorded;

  const rows = entries.map(([field_id, value]) => ({
    file_id: input.fileId,
    field_id,
    value_text: value.trim() || null,
    source: "firm",
    recorded_by: actor.id,
  }));
  const { error } = await db.from("eng_file_inputs").upsert(rows, { onConflict: "file_id,field_id" });
  if (error) return { ok: false, error: `The details could not be saved: ${error.message}` };
  return { ok: true, changed };
}
