import { regions } from "@/content/regions";
import { CRM_SOURCES, CRM_STAGES, CRM_VERTICALS, CUSTOMER_STAGES, territoryFor, type CrmSource, type CrmStage, type CrmVertical } from "./crm-rules";
import type { StaffListSpec } from "./staff-lists";

/**
 * THE PIPELINE AND THE LISTS, AS RULES. Robert's sales CRM ruling of
 * 2026-11-02, item R4.
 *
 * Client safe and free of the database, so the board, the list, the company
 * page, the route and the proof read one set of rules. crm-pipeline.ts loads
 * the rows; everything that decides what a person sees, what a filter keeps,
 * where a card sits and what a bulk act may touch is here.
 */

/* ------------------------------------------------------------- who sees what */

/**
 * WHO SEES WHICH COMPANY. Robert's R5, verbatim: "a rep sees only their own and
 * unassigned in their territory, managers see all." A manager holds crm.assign
 * (admin and ops_manager, his answer 2). Anybody else sees the companies they
 * own, and the companies nobody owns whose county is in a territory they hold.
 * Nobody else's, and no unassigned company outside their territories.
 *
 * `counties` holds the canonical names (territoryFor) of every county in the
 * person's territories. A company with no county, or one the coverage map does
 * not know, is in no territory, so an unowned one is a manager's to place.
 *
 * This is the one rule. R4's board, list, company page and bulk acts, R3's call
 * queue and the older /portal/prospects screens all ask it (R5, 2026-11-02).
 * R4 shipped "their own and every unowned company" here pending territories,
 * R3's queue carried the same, and the prospects screens had no rule at all.
 */
export type Viewer = { id: string; seesAll: boolean; counties: ReadonlySet<string> };

export function canSeeCompany(viewer: Viewer, ownerId: string | null, county: string | null): boolean {
  if (viewer.seesAll) return true;
  if (ownerId === viewer.id) return true;
  if (ownerId !== null) return false;
  const place = territoryFor(county);
  return place !== null && viewer.counties.has(place.county);
}

/** What the visibility rule needs of a company. */
export type CompanyPlace = { ownerId: string | null; county: string | null };

/**
 * Which companies a bulk act may touch. Bulk assign is a manager's act
 * (crm.assign), so a viewer without it is refused outright; bulk tag is any
 * crm.use holder's, on the companies they can see and own or that nobody owns.
 * Returns the ids it may touch and the ones it refused, so the screen can say
 * how many were left alone and why.
 */
export function bulkTargets(
  viewer: Viewer,
  act: "assign" | "tag",
  requested: readonly string[],
  owners: ReadonlyMap<string, CompanyPlace>,
): { ok: true; ids: string[]; refused: number } | { ok: false; error: string } {
  if (act === "assign" && !viewer.seesAll) return { ok: false, error: "Only a sales manager or an administrator assigns companies." };
  const unique = [...new Set(requested.filter(Boolean))];
  if (unique.length === 0) return { ok: false, error: "Tick at least one company first." };
  if (unique.length > 500) return { ok: false, error: "Act on at most 500 companies at a time. Narrow the filter and do the rest next." };
  const ids: string[] = [];
  let refused = 0;
  for (const id of unique) {
    if (!owners.has(id)) {
      refused += 1;
      continue;
    }
    const place = owners.get(id)!;
    if (canSeeCompany(viewer, place.ownerId, place.county)) ids.push(id);
    else refused += 1;
  }
  if (ids.length === 0) return { ok: false, error: "None of those companies is yours to change." };
  return { ok: true, ids, refused };
}

/** A tag is a short lower case word or phrase. */
export function cleanTag(tag: string): { ok: true; tag: string } | { ok: false; error: string } {
  const t = tag.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return { ok: false, error: "Type the tag to add." };
  if (t.length > 40) return { ok: false, error: "A tag is at most 40 characters." };
  if (!/^[a-z0-9][a-z0-9 _-]*$/.test(t)) return { ok: false, error: "A tag uses letters, numbers, spaces, hyphens and underscores only." };
  return { ok: true, tag: t };
}

/* ----------------------------------------------------------------- the rows */

export type CrmListRow = {
  id: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  county: string | null;
  vertical: CrmVertical;
  stage: CrmStage;
  score: number;
  ownerId: string | null;
  ownerName: string | null;
  tags: string[];
  sources: CrmSource[];
  nextActionAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
};

/** The region a row's county belongs to, from the region map. Never stored. */
export function regionOf(row: Pick<CrmListRow, "county">): string | null {
  return territoryFor(row.county)?.regionSlug ?? null;
}

/* ------------------------------------------------------------- the filters */

export const SCORE_BANDS = [
  { value: "0-24", label: "0 to 24", min: 0, max: 24 },
  { value: "25-49", label: "25 to 49", min: 25, max: 49 },
  { value: "50-74", label: "50 to 74", min: 50, max: 74 },
  { value: "75-100", label: "75 to 100", min: 75, max: 100 },
] as const;

export const ACTIVITY_WINDOWS = [
  { value: "7", label: "In the last 7 days" },
  { value: "30", label: "In the last 30 days" },
  { value: "90", label: "In the last 90 days" },
  { value: "older", label: "More than 90 days ago" },
  { value: "never", label: "Never" },
] as const;

const DAY = 24 * 60 * 60 * 1000;

function within(at: string | null, days: number, nowMs: number): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && nowMs - t <= days * DAY;
}

/**
 * The list's search, filters and sorts, for one viewer at one moment ("mine"
 * and "in the last 7 days" both depend on who and when). The staff list engine
 * runs it, so every count is of the whole matching set.
 */
export function crmListSpec(viewerId: string, nowMs: number): StaffListSpec<CrmListRow> {
  const one = <K extends string>(keys: readonly K[], pick: (row: CrmListRow) => K | null) =>
    Object.fromEntries(keys.map((k) => [k, (row: CrmListRow) => pick(row) === k])) as Record<string, (row: CrmListRow) => boolean>;
  return {
    text: (r) => [r.company, r.contactName, r.phone, r.email, r.city, r.county, r.ownerName, ...r.tags],
    filters: {
      vertical: one(CRM_VERTICALS, (r) => r.vertical),
      stage: one(CRM_STAGES, (r) => r.stage),
      territory: one(regions.map((g) => g.slug), (r) => regionOf(r)),
      source: Object.fromEntries(CRM_SOURCES.map((s) => [s, (r: CrmListRow) => r.sources.includes(s)])),
      owner: {
        mine: (r) => r.ownerId === viewerId,
        unowned: (r) => r.ownerId === null,
      },
      score: Object.fromEntries(SCORE_BANDS.map((b) => [b.value, (r: CrmListRow) => r.score >= b.min && r.score <= b.max])),
      activity: {
        "7": (r) => within(r.lastActivityAt, 7, nowMs),
        "30": (r) => within(r.lastActivityAt, 30, nowMs),
        "90": (r) => within(r.lastActivityAt, 90, nowMs),
        older: (r) => Boolean(r.lastActivityAt) && !within(r.lastActivityAt, 90, nowMs),
        never: (r) => !r.lastActivityAt,
      },
    },
    sorts: {
      next: { key: (r) => r.nextActionAt, ascending: true },
      score: { key: (r) => r.score, ascending: false },
      company: { key: (r) => r.company, ascending: true },
      activity: { key: (r) => r.lastActivityAt, ascending: false },
      added: { key: (r) => r.createdAt, ascending: false },
    },
    defaultSort: "next",
  };
}

/* --------------------------------------------------------------- the board */

/** The most cards one column draws. Its count is always the whole column. */
export const BOARD_COLUMN_CARDS = 50;

export type BoardColumn = { stage: CrmStage; count: number; rows: CrmListRow[]; more: number; acceptsDrop: boolean };

/**
 * The board: a column per stage, in the stage order, each with its whole count
 * and at most BOARD_COLUMN_CARDS cards (the rest are "N more in the list").
 * The two customer stages accept no drop, because a company reaches them by
 * converting and by its first order, never by a drag (stageMove says so too).
 */
export function boardColumns(rows: readonly CrmListRow[]): BoardColumn[] {
  return CRM_STAGES.map((stage) => {
    const inStage = rows.filter((r) => r.stage === stage);
    return {
      stage,
      count: inStage.length,
      rows: inStage.slice(0, BOARD_COLUMN_CARDS),
      more: Math.max(0, inStage.length - BOARD_COLUMN_CARDS),
      acceptsDrop: !CUSTOMER_STAGES.includes(stage),
    };
  });
}

/* ------------------------------------------------------------ saved views */

/** The query parameters a saved view keeps, and nothing else: never a page number. */
export const SAVED_VIEW_KEYS = ["q", "vertical", "stage", "territory", "source", "owner", "score", "activity", "sort", "dir"] as const;

export function cleanSavedQuery(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SAVED_VIEW_KEYS) {
    const v = params[k];
    if (typeof v === "string" && v.trim() && v.length <= 200) out[k] = v.trim();
  }
  return out;
}

export function savedViewNameProblem(name: string): string | null {
  const n = name.trim();
  if (!n) return "Give the view a name.";
  if (n.length > 80) return "A view's name is at most 80 characters.";
  return null;
}

/* ----------------------------------------------------------- the timeline */

export type TimelineEntry = {
  at: string;
  kind: "call" | "email" | "note" | "stage_change" | "assignment" | "import" | "sequence" | "message" | "source";
  title: string;
  body: string | null;
  byName: string | null;
};

/**
 * One history from three: the contact log (calls, emails sent, notes, stage
 * changes), the company's notes thread, and the sources it arrived from.
 * Newest first; entries at the same moment keep the order they were given in,
 * so a call and the stage change it caused read in the order they were written.
 */
export function mergeTimeline(...parts: readonly (readonly TimelineEntry[])[]): TimelineEntry[] {
  return parts
    .flat()
    .map((e, i) => ({ e, i, t: Date.parse(e.at) }))
    .sort((a, b) => (Number.isFinite(b.t) ? b.t : 0) - (Number.isFinite(a.t) ? a.t : 0) || a.i - b.i)
    .map((x) => x.e);
}

/* ------------------------------------------------------- the linked account */

/**
 * What the company page shows of a converted company's account. Counts, dates
 * and statuses only, for everybody, in R4: what an order cost is revenue, and
 * a rep sees revenue only on their own attributed orders, which R8 records.
 * The shape has no money field at all, so no screen can print one by mistake.
 */
export type LinkedAccountView = {
  accountId: string;
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  recent: { reference: string; placedAt: string | null; status: string }[];
};

export function linkedAccountView(
  accountId: string,
  orders: readonly { reference: string; placed_at: string | null; created_at: string; status: string }[],
): LinkedAccountView {
  const placed = orders.map((o) => o.placed_at ?? o.created_at).filter(Boolean).sort();
  const newest = [...orders].sort((a, b) => String(b.placed_at ?? b.created_at).localeCompare(String(a.placed_at ?? a.created_at)));
  return {
    accountId,
    orderCount: orders.length,
    firstOrderAt: placed[0] ?? null,
    lastOrderAt: placed[placed.length - 1] ?? null,
    recent: newest.slice(0, 5).map((o) => ({ reference: o.reference, placedAt: o.placed_at, status: o.status })),
  };
}
