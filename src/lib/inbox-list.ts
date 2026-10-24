import type { InboxItem, InboxKind } from "./ops-inbox";

/**
 * WHICH INBOX ITEMS A LIST SHOWS, AND IN WHAT ORDER: the kind filter, the
 * search and the sort the inbox screen applies, in one place, so the screen and
 * its CSV export (office ready, 2026-10-20) can never disagree about the rows.
 * Pure, and it never reorders the items it was given: the read's own order is
 * the "due" order, oldest promise first.
 */
export type InboxListQuery = { kind?: string; q?: string; sort?: string; dir?: string };

export function inboxListRows(items: readonly InboxItem[], query: InboxListQuery): InboxItem[] {
  const kind = (query.kind ?? "all") as InboxKind | "all";
  const needle = (query.q ?? "").trim().toLowerCase();
  const out = items.filter(
    (i) =>
      (kind === "all" || i.kind === kind) &&
      (!needle || [i.name, i.email, i.phone, i.summary].some((v) => (v ?? "").toLowerCase().includes(needle))),
  );
  const sort = query.sort ?? "due";
  const dir = query.dir === "desc" ? -1 : 1;
  if (sort === "received") out.sort((a, b) => (a.receivedAt < b.receivedAt ? -dir : dir));
  else if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name) * dir);
  else if (dir === -1) out.reverse();
  return out;
}
