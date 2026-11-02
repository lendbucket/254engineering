import type { StaffListSpec } from "./staff-lists";

/**
 * ===========================================================================
 * THE REVIEW QUEUE SEARCHES, FILTERS AND SORTS, AND ITS FIRST VIEW DOES NOT
 * MOVE. Robert's ruling P4, 2026-11-01 evening: "add search, filter and sort.
 * The default order stays exactly what it is today; filters only narrow. No
 * change to what the engineer sees first unless he chooses it."
 * ===========================================================================
 *
 * It replaces the ruling of 2026-10-29 (standing orders item 25, "no
 * re-sorting on /portal/review"), and keeps what that ruling protected: the
 * order he reviews in. The default sort is "waiting", whose key is the row's
 * place in the reviewQueue read, so with no parameter the list is the read
 * exactly as it came back: oldest evidence first, then by id. Every filter and
 * the search only drop rows, and under the default sort the rows that remain
 * keep their places relative to each other. Another order appears only when
 * he picks one.
 *
 * The shared staff list engine does the work (staff-lists.ts), so the search
 * is read the same way it is on every other staff list. Pure: a proof hands
 * it rows and reads what comes back.
 */

export type ReviewQueueListRow = {
  file_number: string;
  property_address: string;
  city?: string | null;
  county: string | null;
  service_slug: string;
  status: string;
  evidence_submitted_at: string | null;
  assigned_engineer_id: string | null;
  revision_count: number;
};

/** The three statuses the queue reads, and the words the filter shows for each. */
export const REVIEW_STATUS_FILTER: { value: string; label: string; status: string }[] = [
  { value: "submitted", label: "Submitted", status: "evidence_submitted" },
  { value: "reviewing", label: "Under review", status: "under_review" },
  { value: "revisions", label: "Revisions requested", status: "revisions_requested" },
];

export function reviewQueueList(
  serviceName: (slug: string) => string,
  serviceSlugs: readonly string[],
  engineerId: string | null,
): StaffListSpec<ReviewQueueListRow> {
  return {
    text: (r) => [r.file_number, r.property_address, r.city, r.county, serviceName(r.service_slug)],
    filters: {
      status: Object.fromEntries(REVIEW_STATUS_FILTER.map((s) => [s.value, (r: ReviewQueueListRow) => r.status === s.status])),
      service: Object.fromEntries(serviceSlugs.map((slug) => [slug, (r: ReviewQueueListRow) => r.service_slug === slug])),
      assigned: {
        mine: (r) => engineerId !== null && r.assigned_engineer_id === engineerId,
        unassigned: (r) => r.assigned_engineer_id === null,
      },
    },
    sorts: {
      waiting: { key: (_r, readAt) => readAt, ascending: true },
      county: { key: (r) => r.county, ascending: true },
      service: { key: (r) => serviceName(r.service_slug), ascending: true },
      address: { key: (r) => r.property_address, ascending: true },
      revisions: { key: (r) => r.revision_count, ascending: false },
    },
    defaultSort: "waiting",
  };
}
