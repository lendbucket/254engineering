import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { INQUIRY_PAGE_SIZE, inquiryListQuery, inquirySearchOr, type InquiryListQuery } from "./inquiry-list";

/**
 * ===========================================================================
 * DESIGN INQUIRIES, AND THE PROMISE THAT COMES WITH THEM.
 * ===========================================================================
 *
 * 0050 records a brief with `respond_by` NOT NULL, defaulting to 24 hours after
 * the row is written, and `responded_at` separate and nullable, because "we said
 * we would" and "we did" are two facts and folding them into one is how a queue
 * starts lying.
 *
 * WHY THIS MODULE EXISTS AT ALL, AND IT IS THE SAME SHAPE AS 0053's LOCK. The
 * form writes rows carrying a promise. Without somewhere to read them, the
 * promise is recorded and can never be discharged: briefs would arrive into a
 * table nobody opens, and a person who filled in eleven fields in good faith
 * would hear nothing. A write path with no read path is a feature that looks
 * finished and does nothing.
 *
 * OVERDUE IS COMPUTED FROM respond_by RATHER THAN FROM created_at, so a promise
 * the firm extends deliberately moves the deadline rather than leaving a
 * permanently red row that everybody learns to scroll past.
 */

export type InquiryRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  asking_as: string;
  work_kind: string;
  deliverable: string;
  property_address: string;
  jurisdiction: string | null;
  square_feet: number | null;
  storeys: number | null;
  drawings: string | null;
  soil_report: boolean | null;
  permit_status: string | null;
  deadline: string | null;
  open_insurance_claim: boolean;
  active_litigation: boolean;
  prior_adverse_report: boolean;
  respond_by: string;
  responded_at: string | null;
  responded_by: string | null;
};

const COLUMNS =
  "id, created_at, name, email, phone, asking_as, work_kind, deliverable, property_address, jurisdiction, square_feet, storeys, drawings, soil_report, permit_status, deadline, open_insurance_claim, active_litigation, prior_adverse_report, respond_by, responded_at, responded_by";

/**
 * Every brief, the ones still owed a reply first.
 *
 * UNANSWERED FIRST AND OLDEST PROMISE FIRST WITHIN THAT, which is the same
 * ordering the review queue and the waiting list use: a list sorted newest
 * first is one where the awkward item somebody keeps skipping sinks out of
 * sight, and here the one sinking would be the person waiting longest.
 *
 * A FAILED READ IS NOT AN EMPTY LIST. Operator ruling, 2026-10-12. This
 * returned `data ?? []`, so a read that failed or stalled rendered "No briefs
 * yet" over briefs waiting on a promised reply; the 2026-10-11 board lost this
 * screen to exactly such a stall. It now says the read failed, and the screen
 * says the list could not be loaded.
 */
/*
 * OFFICE READY, 2026-10-24: ONE PAGE OF WHAT MATCHES, WITH EXACT COUNTS. The
 * read used to stop at 200 rows and the screen printed "N awaiting a reply, M
 * answered" from them, a bounded read's length stated as the totals. Now the
 * search, the open or answered filter, the sort and the page are applied in the
 * database, the page carries an exact count of what matches, and the open and
 * answered figures are exact counts of their own. Any of the three failing is a
 * failed read, never a smaller number.
 */
export type InquiryListRead =
  | { ok: true; rows: InquiryRow[]; total: number; open: number; answered: number }
  | { ok: false; error: string };

export async function designInquiries(actor: Actor | null, query: InquiryListQuery = inquiryListQuery({})): Promise<InquiryListRead> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  /* files.create, the intake grant. See the note on the page: an engineer
   * holds files.list, and the ruling is that design briefs are intake. */
  if (!can(actor, "files.create")) return { ok: true, rows: [], total: 0, open: 0, answered: 0 };
  const search = inquirySearchOr(query.term);

  let read = db.from("eng_design_inquiries").select(COLUMNS, { count: "exact" });
  if (search) read = read.or(search);
  if (query.show === "open") read = read.is("responded_at", null);
  if (query.show === "answered") read = read.not("responded_at", "is", null);
  if (query.sort === "due") {
    read = read.order("responded_at", { ascending: true, nullsFirst: true }).order("respond_by", { ascending: query.ascending });
  } else {
    read = read.order(query.sort === "name" ? "name" : "created_at", { ascending: query.ascending });
  }
  const from = (query.page - 1) * INQUIRY_PAGE_SIZE;
  const { data, error, count } = await read.order("id", { ascending: true }).range(from, from + INQUIRY_PAGE_SIZE - 1);

  /* The two figures above the list: exact, over the same search, never derived from one page. */
  const figure = async (answered: boolean) => {
    let c = db.from("eng_design_inquiries").select("id", { count: "exact", head: true });
    if (search) c = c.or(search);
    c = answered ? c.not("responded_at", "is", null) : c.is("responded_at", null);
    return c;
  };
  const [open, answered] = await Promise.all([figure(false), figure(true)]);

  const failed = error ?? open.error ?? answered.error;
  if (failed || count === null || open.count === null || answered.count === null) {
    const message = failed?.message ?? "a count did not come back";
    console.error(`[inquiries] the design briefs could not be read: ${message}`);
    return { ok: false, error: message };
  }
  return { ok: true, rows: (data ?? []) as InquiryRow[], total: count, open: open.count, answered: answered.count };
}

/**
 * Record that somebody replied.
 *
 * BOTH COLUMNS OR NEITHER, which 0050 enforces with a check constraint and this
 * honours rather than duplicates: a record saying somebody was contacted
 * without saying who contacted them is the `customer_link.issued` defect
 * wearing different columns, and that one cost a paying customer a phone call
 * to find out nothing had been sent.
 *
 * IT RECORDS A REPLY, IT DOES NOT SEND ONE. The reply is a person writing to
 * another person about work that cannot be scoped from a form, and a platform
 * that offered to send it would be offering to write an engineering opinion
 * from a dropdown. What this marks is that the conversation happened.
 */
export async function markInquiryResponded(
  actor: Actor & { email: string },
  inquiryId: string,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  /* Or inbox.answer, the one inbox's own grant (0079), so the two staff levels answer without files.update. */
  if (!can(actor, "files.update") && !can(actor, "inbox.answer")) return { ok: false, error: "Your role cannot answer an inquiry." };

  const { data: row } = await db
    .from("eng_design_inquiries")
    .select("id, name, responded_at")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!row) return { ok: false, error: "That inquiry does not exist." };
  if ((row as { responded_at: string | null }).responded_at !== null) {
    return { ok: false, error: "That inquiry is already recorded as answered." };
  }

  const { error } = await db
    .from("eng_design_inquiries")
    .update({ responded_at: DB_NOW, responded_by: actor.id, status: "answered" })
    .eq("id", inquiryId)
    /*
     * The write carries the condition rather than trusting the read above, for
     * the reason closeRepairItem does: two people on the queue at once both
     * pass a check that read the row a moment ago, and the second should change
     * nothing rather than overwrite who answered it.
     */
    .is("responded_at", null);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "design_inquiry.answered",
    entityType: "design_inquiry",
    entityId: inquiryId,
    summary: `Answered the design inquiry from ${(row as { name: string }).name}`,
    ...context,
  });
  return { ok: true };
}

/**
 * Is this promise past its deadline, and by how long.
 *
 * ABSENT IS NOT ZERO. An answered inquiry is never overdue whatever its
 * deadline said, and that is why `responded_at` is checked first: a row that
 * was answered on time and then sat there would otherwise turn red the moment
 * its 24 hours elapsed, which is the figure telling the opposite of the truth.
 */
export function overdueBy(row: { respond_by: string; responded_at: string | null }, now: Date = new Date()): number | null {
  if (row.responded_at !== null) return null;
  const due = new Date(row.respond_by).getTime();
  if (Number.isNaN(due)) return null;
  const late = now.getTime() - due;
  return late > 0 ? Math.floor(late / 3_600_000) : null;
}
