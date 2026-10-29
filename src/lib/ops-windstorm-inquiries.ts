import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { overdueBy } from "./ops-inquiries";
import { INQUIRY_PAGE_SIZE, inquiryListQuery, inquirySearchOr, type InquiryListQuery } from "./inquiry-list";
import { readEvery } from "./bounded-read";

/**
 * ===========================================================================
 * WINDSTORM BRIEFS, FOR AN EXISTING BUILDING.
 * ===========================================================================
 *
 * A sibling of `ops-inquiries.ts` and deliberately not a generalisation of it.
 * The two tables overlap and the QUESTIONS are not the same questions, which is
 * the whole reason 0054 exists rather than a column migration on the design
 * table. Sharing a reader would have meant one function with two column lists
 * and a discriminator, which is the shape that ends up selecting a column the
 * other table does not have.
 *
 * **THREE THINGS ARE REUSED RATHER THAN REBUILT**, on the operator's ruling:
 * the task-from-record shape, the three flags with no default where an
 * unanswered one is refused by name, and `overdueBy`, which is imported from
 * the design reader rather than copied. That function checks `responded_at`
 * FIRST, and the reason is worth carrying: an answered brief is never overdue
 * whatever its deadline said, and a copy that forgot the ordering would turn a
 * brief answered on time red the moment its 24 hours elapsed.
 */

export type WindstormInquiryRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  asking_as: string;
  property_address: string;
  county: string | null;
  /** Context for the engineer, never the eligibility test. See 0054. */
  year_built: number | null;
  /** The test. Work on or after January 1, 1988 is in scope. Null is undated. */
  most_recent_work_year: number | null;
  work_done: string;
  what_is_covered: string;
  openings_rated: string;
  will_open_up: string;
  deadline: string | null;
  open_insurance_claim: boolean;
  active_litigation: boolean;
  prior_adverse_report: boolean;
  respond_by: string;
  responded_at: string | null;
  responded_by: string | null;
};

/*
 * ONE STRING LITERAL, NOT A CONCATENATION. supabase-js infers the row type from
 * this argument, and splitting it across an expression collapses the inference
 * to `any`, which is how a selected column that does not exist stops being a
 * compile error. Recorded on ops-field.ts for the same reason.
 */
const COLUMNS =
  "id, created_at, name, email, phone, asking_as, property_address, county, year_built, most_recent_work_year, work_done, what_is_covered, openings_rated, will_open_up, deadline, open_insurance_claim, active_litigation, prior_adverse_report, respond_by, responded_at, responded_by";

/**
 * Every brief, the ones still owed a reply first.
 *
 * GATED ON `files.create`, NOT `files.list`. The same ruling the design briefs
 * carry: an intake is intake. An engineer holds `files.list` and has no reason
 * to be handed a queue of enquiries nobody has scoped, and the person who
 * answers these is the one who can open a job from one.
 *
 * UNANSWERED FIRST AND OLDEST PROMISE FIRST WITHIN THAT. A list sorted newest
 * first is one where the awkward item somebody keeps skipping sinks out of
 * sight, and here the one sinking would be the person waiting longest.
 */
/*
 * OFFICE READY, 2026-10-24, AND A FAILED READ IS NOT AN EMPTY LIST. This
 * returned `data ?? []`, so a read that failed or stalled rendered "No briefs
 * yet", the defect the operator's ruling of 2026-10-12 removed from the design
 * briefs and this sibling kept. It also stopped at 200 rows and the screen
 * counted those. Now, as the design briefs: the search, filter, sort and page in
 * the database, an exact count of what matches, exact open and answered counts,
 * and any of the three failing is a failed read.
 */
export type WindstormListRead =
  | { ok: true; rows: WindstormInquiryRow[]; total: number; open: number; answered: number }
  | { ok: false; error: string };

export async function windstormInquiries(
  actor: Actor | null,
  query: InquiryListQuery = inquiryListQuery({}),
  /* "page" is the screen's fifty; "every" is every brief the query matches, for the CSV export, read in full. */
  scope: "page" | "every" = "page",
): Promise<WindstormListRead> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "files.create")) return { ok: true, rows: [], total: 0, open: 0, answered: 0 };
  const search = inquirySearchOr(query.term);

  /* One filter and one order, for the page and for every row alike. */
  const filtered = (withCount: boolean) => {
    let read = db.from("eng_windstorm_inquiries").select(COLUMNS, withCount ? { count: "exact" } : undefined);
    if (search) read = read.or(search);
    if (query.show === "open") read = read.is("responded_at", null);
    if (query.show === "answered") read = read.not("responded_at", "is", null);
    if (query.sort === "due") {
      read = read.order("responded_at", { ascending: true, nullsFirst: true }).order("respond_by", { ascending: query.ascending });
    } else {
      read = read.order(query.sort === "name" ? "name" : "created_at", { ascending: query.ascending });
    }
    return read.order("id", { ascending: true });
  };
  let data: unknown[] | null = null;
  let error: { message: string } | null = null;
  let count: number | null = null;
  if (scope === "every") {
    const every = await readEvery<unknown>((from, to) => filtered(false).range(from, to));
    if (every.ok) {
      data = every.rows;
      count = every.rows.length;
    } else {
      error = { message: every.error };
    }
  } else {
    const from = (query.page - 1) * INQUIRY_PAGE_SIZE;
    const page = await filtered(true).range(from, from + INQUIRY_PAGE_SIZE - 1);
    data = page.data;
    error = page.error;
    count = page.count;
  }

  const figure = async (answered: boolean) => {
    let c = db.from("eng_windstorm_inquiries").select("id", { count: "exact", head: true });
    if (search) c = c.or(search);
    c = answered ? c.not("responded_at", "is", null) : c.is("responded_at", null);
    return c;
  };
  const [open, answered] = await Promise.all([figure(false), figure(true)]);

  const failed = error ?? open.error ?? answered.error;
  if (failed || count === null || open.count === null || answered.count === null) {
    const message = failed?.message ?? "a count did not come back";
    console.error(`[windstorm-inquiries] the windstorm briefs could not be read: ${message}`);
    return { ok: false, error: message };
  }
  return { ok: true, rows: (data ?? []) as WindstormInquiryRow[], total: count, open: open.count, answered: answered.count };
}

/**
 * Record that somebody replied.
 *
 * BOTH COLUMNS OR NEITHER, which 0054 enforces with a check constraint and this
 * honours rather than duplicates: a record saying somebody was contacted
 * without saying who contacted them is the `customer_link.issued` defect
 * wearing different columns.
 *
 * IT RECORDS A REPLY, IT DOES NOT SEND ONE. The reply is a person telling
 * another person what can be established about their building, which cannot be
 * scoped from a form. A platform offering to send it would be offering to write
 * an engineering opinion from a dropdown.
 */
export async function markWindstormInquiryResponded(
  actor: Actor & { email: string },
  inquiryId: string,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  /* Or inbox.answer, the one inbox's own grant (0079), so the two staff levels answer without files.update. */
  if (!can(actor, "files.update") && !can(actor, "inbox.answer")) return { ok: false, error: "Your role cannot answer an inquiry." };

  const { data: row } = await db
    .from("eng_windstorm_inquiries")
    .select("id, name, responded_at")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!row) return { ok: false, error: "That inquiry does not exist." };
  if ((row as { responded_at: string | null }).responded_at !== null) {
    return { ok: false, error: "That inquiry is already recorded as answered." };
  }

  const { error } = await db
    .from("eng_windstorm_inquiries")
    .update({ responded_at: DB_NOW, responded_by: actor.id, status: "answered" })
    .eq("id", inquiryId)
    /*
     * The write carries the condition rather than trusting the read above. Two
     * people on the queue at once both pass a check that read the row a moment
     * ago, and the second should change nothing rather than overwrite who
     * answered it.
     */
    .is("responded_at", null);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "windstorm_inquiry.answered",
    entityType: "windstorm_inquiry",
    entityId: inquiryId,
    summary: `Answered the windstorm inquiry from ${(row as { name: string }).name}`,
    ...context,
  });
  return { ok: true };
}

/** Re-exported so a screen reads one name rather than importing across two modules. */
export { overdueBy };
