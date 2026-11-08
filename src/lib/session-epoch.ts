import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EPOCH_TABLES, validEpoch, type EpochTable } from "./session-epoch-rules";

/**
 * Bump one person's session epoch, ending every cookie issued before now.
 *
 * PostgREST cannot write `session_epoch = session_epoch + 1`, and staff
 * passwords live in Supabase Auth where no statement of ours can reach them, so
 * the bump is a read and a CONDITIONAL write: the update carries
 * `.eq("session_epoch", read)` and its row count is checked, so two bumps that
 * race both land (the loser re-reads and tries again) and a bump can never move
 * the epoch backwards. Where the change being made writes the same row (a
 * customer or partner password, a staff suspension), the caller folds
 * `session_epoch: next` into that same update with the same condition instead,
 * which makes it one statement.
 *
 * A failed bump is reported, never swallowed: a password changed while the old
 * sessions survive is the exact hole this exists to close, so callers refuse or
 * say so rather than reporting success.
 */
export async function bumpSessionEpoch(
  db: SupabaseClient,
  table: EpochTable,
  id: string,
): Promise<{ ok: true; epoch: number } | { ok: false; error: string }> {
  if (!(EPOCH_TABLES as readonly string[]).includes(table)) return { ok: false, error: "Not a table with sessions." };
  for (let attempt = 0; attempt < 3; attempt++) {
    const read = await db.from(table).select("session_epoch").eq("id", id).maybeSingle();
    if (read.error) return { ok: false, error: `The sessions could not be read: ${read.error.message}` };
    if (!read.data) return { ok: false, error: "That account no longer exists." };
    const current = (read.data as { session_epoch: unknown }).session_epoch;
    if (!validEpoch(current)) return { ok: false, error: "The sessions on this account could not be read." };
    const next = current + 1;
    const write = await db
      .from(table)
      .update({ session_epoch: next })
      .eq("id", id)
      .eq("session_epoch", current)
      .select("id");
    if (write.error) return { ok: false, error: `The sessions could not be ended: ${write.error.message}` };
    if ((write.data ?? []).length === 1) return { ok: true, epoch: next };
  }
  return { ok: false, error: "The sessions could not be ended just now. Try again." };
}

/** Read one person's current epoch, for issuing a cookie under it. */
export async function readSessionEpoch(
  db: SupabaseClient,
  table: EpochTable,
  id: string,
): Promise<{ ok: true; epoch: number } | { ok: false; error: string }> {
  const read = await db.from(table).select("session_epoch").eq("id", id).maybeSingle();
  if (read.error) return { ok: false, error: `The account could not be read: ${read.error.message}` };
  const epoch = (read.data as { session_epoch: unknown } | null)?.session_epoch;
  if (!validEpoch(epoch)) return { ok: false, error: "The account could not be read." };
  return { ok: true, epoch };
}
