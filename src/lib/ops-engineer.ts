import "server-only";
import { supabaseAdmin } from "./supabase";
import { deskPackageComplete, orderForFile, settleDecision } from "./ops-payments";
import { writeAudit } from "./ops-audit";
import { can, type Actor, holdsLicence } from "./ops-authz";
import { transitionFile } from "./ops-crm";
import { jobView } from "./ops-field";
import { raise } from "./ops-notify";
import { isPrelaunch } from "./launch";
import {
  ACTION_TARGET,
  canReview,
  chargeLogRow,
  minutesBetween,
  monthlyExportCsv,
  periodOf,
  type ExportRow,
  type ReviewAction,
  type ReviewSubject,
} from "./ops-review";

/**
 * The engineer's side: the queue, the package, the decision, and the three
 * records a decision writes.
 *
 * WHAT A DECISION WRITES, AND WHY IT IS THREE THINGS
 * --------------------------------------------------
 * The file moves, which is operational. The responsible charge log gains a row,
 * which is regulatory. The production ledger gains a row, which is payroll.
 * Those three answer different questions and are read by different people, and
 * deriving any of them from another later is how they come to disagree.
 *
 * They are written in that order, and the ordering is the failure mode chosen:
 * if the log write fails, the file has moved and the log is short a row, which
 * an operator can see and repair. The reverse would be a regulatory record
 * claiming a review that never took effect.
 *
 * PRODUCTION PAY ATTACHES TO THE REVIEW, NOT THE SEAL
 * ---------------------------------------------------
 * Operator ruling, 2026-09-02. A declined file writes a production entry at the
 * same tier a sealed one would have. The reasoning is in ops-review.ts, and the
 * point of writing it in both places is that this is where somebody would
 * otherwise "simplify" it back to paying on seal.
 */

type Context = { ip?: string | null; userAgent?: string | null };

// ------------------------------------------------------------------ the queue

export type QueueRow = {
  id: string;
  file_number: string;
  property_address: string;
  city: string | null;
  county: string;
  service_slug: string;
  status: string;
  twia_county: boolean;
  due_at: string | null;
  evidence_submitted_at: string | null;
  assigned_engineer_id: string | null;
  revision_count: number;
};

const QUEUE_COLUMNS =
  "id, file_number, property_address, city, county, service_slug, status, twia_county, due_at, evidence_submitted_at, assigned_engineer_id, revision_count";

/**
 * What is waiting for an engineer.
 *
 * Files that have been submitted and files already taken into review, oldest
 * submission first. Oldest first rather than newest, because a review queue
 * sorted newest first is one where the file somebody keeps skipping sinks out
 * of sight.
 */
export async function reviewQueue(actor: Actor | null): Promise<QueueRow[]> {
  const db = supabaseAdmin();
  if (!db || !holdsLicence(actor, "review.queue")) return [];
  const { data } = await db
    .from("eng_files")
    .select(QUEUE_COLUMNS)
    .in("status", ["evidence_submitted", "under_review", "revisions_requested"])
    .order("evidence_submitted_at", { ascending: true, nullsFirst: false })
    .limit(200);
  return (data ?? []) as QueueRow[];
}

// -------------------------------------------------------------- the package

export type EvidenceView = {
  id: string;
  itemKey: string;
  label: string;
  kind: string;
  required: boolean;
  instructions: string | null;
  captures: {
    id: string;
    valueText: string | null;
    valueNumber: number | null;
    unit: string | null;
    storageKey: string | null;
    url: string | null;
    capturedAt: string | null;
    lat: number | null;
    lng: number | null;
  }[];
  satisfied: boolean;
  problem: string | null;
};

export type PackageView = {
  file: {
    id: string;
    file_number: string;
    property_address: string;
    city: string | null;
    county: string;
    service_slug: string;
    status: string;
    twia_county: boolean;
    notes: string | null;
    revision_count: number;
    refusal_reason: string | null;
  };
  protocolName: string | null;
  items: EvidenceView[];
  complete: boolean;
  blockers: string[];
  session: { id: string; startedAt: string; minutesSoFar: number } | null;
  technician: { id: string; name: string } | null;
};

/**
 * The evidence package, as the reviewing engineer sees it.
 *
 * PHOTOGRAPHS ARE SIGNED HERE, NOT LINKED
 * ---------------------------------------
 * The bucket is private and stays private. Every stored object gets a short
 * lived signed URL minted for this request. An engineer reviewing a package
 * needs to see every frame, and a viewer that cannot show them is a viewer that
 * sends them to ask a technician for the photographs by email, which is the
 * whole failure this platform exists to remove.
 *
 * One hour, because a review is a sitting and a link that dies mid review is
 * worse than one that outlives it by forty minutes.
 */
const SIGNED_URL_SECONDS = 60 * 60;

export async function packageFor(actor: Actor | null, fileId: string): Promise<PackageView | null> {
  const db = supabaseAdmin();
  if (!db || !holdsLicence(actor, "review.queue")) return null;

  const view = await jobView(actor, fileId);
  if (!view) return null;

  const { data: file } = await db
    .from("eng_files")
    .select(
      "id, file_number, property_address, city, county, service_slug, deliverable, status, twia_county, notes, revision_count, refusal_reason, assigned_tech_id",
    )
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return null;

  const keys = view.captures.map((c) => c.storage_key).filter((k): k is string => Boolean(k));
  const urlByKey = new Map<string, string>();
  if (keys.length) {
    const { data: signed } = await db.storage.from("eng-evidence").createSignedUrls(keys, SIGNED_URL_SECONDS);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) urlByKey.set(entry.path, entry.signedUrl);
    }
  }

  const items: EvidenceView[] = view.state.items.map((status) => ({
    id: status.item.id,
    itemKey: status.item.itemKey,
    label: status.item.label,
    kind: status.item.kind,
    required: status.item.required,
    instructions: status.item.instructions ?? null,
    satisfied: status.satisfied,
    problem: status.problem,
    captures: view.captures
      .filter((c) => c.item_key === status.item.itemKey)
      .map((c) => ({
        id: c.id,
        valueText: c.value_text,
        valueNumber: c.value_number === null ? null : Number(c.value_number),
        unit: c.unit,
        storageKey: c.storage_key,
        url: c.storage_key ? (urlByKey.get(c.storage_key) ?? null) : null,
        capturedAt: c.captured_at,
        lat: c.captured_lat === null ? null : Number(c.captured_lat),
        lng: c.captured_lng === null ? null : Number(c.captured_lng),
      })),
  }));

  const { data: session } = await db
    .from("eng_review_sessions")
    .select("id, started_at")
    .eq("file_id", fileId)
    .eq("engineer_id", actor!.id)
    .is("ended_at", null)
    .maybeSingle();

  let technician: PackageView["technician"] = null;
  if (file.assigned_tech_id) {
    const { data: tech } = await db
      .from("eng_profiles")
      .select("id, display_name")
      .eq("id", file.assigned_tech_id)
      .maybeSingle();
    if (tech) technician = { id: tech.id as string, name: tech.display_name as string };
  }

  return {
    file: file as PackageView["file"],
    protocolName: view.protocol ? `${view.protocol.name} v${view.protocol.version}` : null,
    items,
    ...(await completeness(fileId, view)),
    session: session
      ? {
          id: session.id as string,
          startedAt: session.started_at as string,
          minutesSoFar: minutesBetween(new Date(session.started_at as string), new Date()),
        }
      : null,
    technician,
  };
}

/**
 * Take a file into review, which starts the clock.
 *
 * The partial unique index means one open session per engineer per file, so a
 * second tab does not start a second clock and produce two answers about how
 * long the review took.
 */
/**
 * Whether this package may be sealed, and why not if it may not.
 *
 * Two different questions depending on what kind of work it is. A field file
 * asks the evidence checklist. A desk file has no protocol and asks whether the
 * customer supplied what the catalog required, because that is what a desk
 * engineer is reviewing. See deskPackageComplete for the blocker that produced
 * this split.
 */
async function completeness(
  fileId: string,
  view: { state: { canSubmit: boolean; blockers: string[] } },
): Promise<{ complete: boolean; blockers: string[] }> {
  if (view.state.canSubmit) return { complete: true, blockers: [] };

  const desk = await deskPackageComplete(fileId);
  if (desk.applies) return { complete: desk.complete, blockers: desk.blockers };

  return { complete: view.state.canSubmit, blockers: view.state.blockers };
}

export async function openReview(
  actor: Actor & { email: string },
  fileId: string,
  context: Context = {},
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "review.queue")) return { ok: false, error: "Your role cannot review files." };

  const { data: file } = await db.from("eng_files").select("id, status, file_number").eq("id", fileId).maybeSingle();
  if (!file) return { ok: false, error: "That file does not exist." };

  const { data: existing } = await db
    .from("eng_review_sessions")
    .select("id")
    .eq("file_id", fileId)
    .eq("engineer_id", actor.id)
    .is("ended_at", null)
    .maybeSingle();
  if (existing) return { ok: true, sessionId: existing.id as string };

  if (file.status === "evidence_submitted") {
    const moved = await transitionFile(actor, fileId, "under_review", "Taken into review.", context);
    if (!moved.ok) return { ok: false, error: moved.error };
    await db.from("eng_files").update({ assigned_engineer_id: actor.id }).eq("id", fileId);
  } else if (file.status !== "under_review") {
    return { ok: false, error: "That file is not waiting for a review." };
  }

  const { data, error } = await db
    .from("eng_review_sessions")
    .insert({ file_id: fileId, engineer_id: actor.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not open the review." };

  return { ok: true, sessionId: data.id as string };
}

// ------------------------------------------------------------- the decision

/** What an engineer is paid for a completed review on this service line. */
async function productionFeeFor(serviceSlug: string): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("eng_fee_schedule")
    .select("amount_cents, effective_from, effective_to, tier")
    .eq("kind", "engineer_production")
    .eq("service_slug", serviceSlug)
    .lte("effective_from", today)
    .order("effective_from", { ascending: false })
    .limit(5);
  const live = (data ?? []).find((r) => !r.effective_to || (r.effective_to as string) >= today);
  return live ? Number(live.amount_cents) : null;
}

export type DecisionResult =
  | { ok: true; action: ReviewAction; minutes: number; paidCents: number | null }
  | { ok: false; error: string };

/**
 * Decide a file.
 *
 * Every rule comes from ops-review, which is pure and asserted. This function
 * loads, asks, persists, and writes the three records. It contains no rule of
 * its own, for the reason files-audit taught: a rule here is a rule the suite
 * cannot see.
 */
export async function decideReview(
  actor: Actor & { email: string },
  fileId: string,
  action: ReviewAction,
  reason: string | null,
  context: Context = {},
): Promise<DecisionResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const pkg = await packageFor(actor, fileId);
  if (!pkg) return { ok: false, error: "That file does not exist, or is not yours to review." };

  const subject: ReviewSubject = {
    status: pkg.file.status as ReviewSubject["status"],
    packageComplete: pkg.complete,
    assignedEngineerId: actor.id,
  };

  const verdict = canReview(actor, subject, action, reason, { prelaunch: isPrelaunch() });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const now = new Date();
  const session = pkg.session;
  const minutes = session ? minutesBetween(new Date(session.startedAt), now) : 0;

  // 1. The file moves.
  const target = ACTION_TARGET[action];
  const note = reason?.trim() || null;
  const moved = await transitionFile(actor, fileId, target, note, context);
  if (!moved.ok) return { ok: false, error: moved.error };

  if (action === "refuse") {
    await db
      .from("eng_files")
      .update({ refused_at: now.toISOString(), refusal_reason: note, refused_by: actor.id })
      .eq("id", fileId);
  }
  if (action === "revisions" || action === "site_visit") {
    await db
      .from("eng_files")
      .update({ revision_count: pkg.file.revision_count + 1 })
      .eq("id", fileId);
  }
  if (action === "site_visit") {
    /*
     * A site visit is a new journey. The file goes back through dispatch, so the
     * technician who held it is released rather than left assigned to a file
     * that is being offered to somebody else.
     */
    await db.from("eng_files").update({ assigned_tech_id: null }).eq("id", fileId);
    await db
      .from("eng_assignments")
      .update({ state: "withdrawn", responded_at: now.toISOString() })
      .eq("file_id", fileId)
      .eq("state", "accepted");
  }

  // Close the clock.
  if (session) {
    await db
      .from("eng_review_sessions")
      .update({ ended_at: now.toISOString(), decision: action, minutes })
      .eq("id", session.id);
  }

  // 2. The responsible charge log. Built by the pure module, inserted here.
  const row = chargeLogRow({
    engineerId: actor.id,
    fileId,
    documentType: pkg.file.service_slug,
    propertyAddress: pkg.file.property_address,
    county: pkg.file.county,
    action,
    reviewMinutes: session ? minutes : null,
    revisionCount: pkg.file.revision_count,
    siteVisit: action === "site_visit",
    reason: note,
    at: now,
  });
  const { error: logError } = await db
    .from("eng_responsible_charge_log")
    .insert({ ...row, review_session_id: session?.id ?? null });
  if (logError && !/duplicate key/i.test(logError.message)) {
    /*
     * Reported rather than swallowed. The file has already moved, which is the
     * ordering this module chose deliberately, and an operator seeing this
     * message can repair a log that is short a row. A regulatory record that
     * silently missed a review is the outcome worth shouting about.
     */
    return {
      ok: false,
      error:
        `The file moved but the responsible charge log entry failed: ${logError.message}. ` +
        "The regulatory record is now short a row for this review and needs repairing.",
    };
  }

  // 3. The production ledger. Paid on the completed review, not on the seal.
  let paidCents: number | null = null;
  if (session) {
    const fee = await productionFeeFor(pkg.file.service_slug);
    if (fee !== null) {
      const { error } = await db.from("eng_production_ledger").insert({
        engineer_id: actor.id,
        file_id: fileId,
        review_session_id: session.id,
        decision: action,
        amount_cents: fee,
        period: periodOf(now),
        status: "pending",
        note: `${pkg.file.file_number}, ${action === "refuse" ? "declined to seal" : action}`,
      });
      if (!error) paidCents = fee;
      else if (!/duplicate key/i.test(error.message)) {
        return { ok: false, error: `The review was recorded but production pay failed: ${error.message}` };
      }
    }
  }

  /*
   * Who a decision reaches depends on what it was.
   *
   * A technician is told when their package comes back, because they are the
   * one who has to act. A refusal goes to administrators, because it is a
   * commercial and regulatory event rather than a field one, and because
   * telling a technician "an engineer would not certify your work" as a push
   * notification is not how that conversation should start.
   */
  const { data: admins } = await db
    .from("eng_profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active");

  if (action === "revisions" || action === "site_visit") {
    const { data: file } = await db
      .from("eng_files")
      .select("assigned_tech_id")
      .eq("id", fileId)
      .maybeSingle();
    const techId = (file?.assigned_tech_id as string | null) ?? null;
    if (techId) {
      await raise({
        profileId: techId,
        role: "field_tech",
        kind: "review.revisions",
        title:
          action === "revisions"
            ? `${pkg.file.file_number} came back for revisions`
            : `${pkg.file.file_number} needs another site visit`,
        body: note,
        href: `/portal/jobs/${fileId}`,
        entityType: "file",
        entityId: fileId,
      });
    }
  }

  for (const admin of admins ?? []) {
    if ((admin.id as string) === actor.id) continue;
    if (action === "refuse") {
      await raise({
        profileId: admin.id as string,
        role: "admin",
        kind: "review.refused",
        title: `An engineer declined to seal ${pkg.file.file_number}`,
        body: note,
        href: `/portal/review?id=${fileId}`,
        entityType: "file",
        entityId: fileId,
      });
    } else if (action === "seal") {
      await raise({
        profileId: admin.id as string,
        role: "admin",
        kind: "review.sealed",
        title: `${pkg.file.file_number} was sealed`,
        body: `${pkg.file.property_address}, ${pkg.file.county} County.`,
        href: `/portal/files?id=${fileId}`,
        entityType: "file",
        entityId: fileId,
      });
    }
  }

  await writeAudit({
    actor,
    action: `review.${action}`,
    entityType: "file",
    entityId: fileId,
    summary: `${pkg.file.file_number}: ${action === "refuse" ? "declined to seal" : action}${
      session ? ` after ${minutes} minutes` : ""
    }`,
    ...context,
  });

  /*
   * THE DECISION SETTLES THE MONEY, AND IT HAPPENS HERE
   * --------------------------------------------------
   * settleDecision is called for a seal as well as a refusal, so exactly one
   * place knows what a decision does to a customer's payment. A caller that had
   * to remember to skip it on a seal is one that will one day forget on a
   * refusal, and the customer would be left charged for work the firm declined.
   *
   * It is called after the decision is already recorded, and its failure does
   * not undo the decision. An engineer's professional judgment is not
   * contingent on a payment provider being reachable: the file stays declined,
   * the refund is recorded as needing a hand, and the operator can see it.
   *
   * A file with no order behind it, which is every file staff opened by hand,
   * settles to nothing and says so.
   */
  const order = await orderForFile(fileId);
  if (order && (action === "seal" || action === "refuse")) {
    const settled = await settleDecision({
      orderId: order.id as string,
      outcome: action === "seal" ? "seal" : "refuse",
      actorId: actor.id,
    });
    if (!settled.ok) {
      console.error(
        `[review] ${pkg.file.file_number}: the decision stands and the refund did not: ${settled.error}`,
      );
    }
  }

  return { ok: true, action, minutes, paidCents };
}

// ------------------------------------------------------- the charge log view

export type ChargeLogEntry = ExportRow & { id: number; file_id: string | null };

export async function chargeLog(
  actor: Actor | null,
  options: { engineerId?: string; period?: string } = {},
): Promise<ChargeLogEntry[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];

  const all = can(actor, "responsible_charge.read_all");
  if (!all && !can(actor, "responsible_charge.read_own")) return [];

  let query = db
    .from("eng_responsible_charge_log")
    .select(
      "id, file_id, decision, reviewed_at, property_address, county, document_type, review_minutes, revision_count, site_visit, refused, refusal_reason",
    )
    .order("reviewed_at", { ascending: false })
    .limit(500);

  /*
   * An engineer reads their own log and nobody else's, even though they hold
   * responsible_charge.read_own. This is the record their licence stands on;
   * one engineer browsing another's review times is not a feature anybody asked
   * for and would change how people work.
   */
  query = all && options.engineerId ? query.eq("engineer_id", options.engineerId) : all ? query : query.eq("engineer_id", actor.id);
  if (options.period) query = query.eq("period", options.period);

  const { data } = await query;
  return (data ?? []) as ChargeLogEntry[];
}

/** The months that have entries, for the export picker. */
export async function chargeLogPeriods(actor: Actor | null, engineerId?: string): Promise<string[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];
  const all = can(actor, "responsible_charge.read_all");
  if (!all && !can(actor, "responsible_charge.read_own")) return [];

  let query = db.from("eng_responsible_charge_log").select("period").limit(2000);
  query = all && engineerId ? query.eq("engineer_id", engineerId) : all ? query : query.eq("engineer_id", actor.id);
  const { data } = await query;
  return [...new Set((data ?? []).map((r) => r.period as string).filter(Boolean))].sort().reverse();
}

/**
 * The monthly export a regulator reads.
 *
 * Built from rows nobody could edit, by a pure function the audit asserts,
 * including the escaping that stops an engineer's stated reason being evaluated
 * as a spreadsheet formula.
 */
export async function monthlyExport(
  actor: Actor | null,
  period: string,
  engineerId?: string,
): Promise<{ ok: true; csv: string; filename: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db || !actor) return { ok: false, error: "Not signed in." };
  if (!/^\d{4}-\d{2}$/.test(period)) return { ok: false, error: "That is not a month." };

  const all = can(actor, "responsible_charge.read_all");
  const subjectId = all && engineerId ? engineerId : actor.id;
  if (!all && !can(actor, "responsible_charge.read_own")) {
    return { ok: false, error: "Your role cannot read a responsible charge log." };
  }

  const { data: profile } = await db
    .from("eng_profiles")
    .select("display_name, license_number")
    .eq("id", subjectId)
    .maybeSingle();

  const rows = await chargeLog(actor, { engineerId: subjectId, period });

  return {
    ok: true,
    csv: monthlyExportCsv(rows, {
      engineerName: (profile?.display_name as string) ?? "Unknown",
      licenseNumber: (profile?.license_number as string | null) ?? null,
      period,
    }),
    filename: `responsible-charge-${period}.csv`,
  };
}

// ------------------------------------------------- production ledger and time

export type ProductionRow = {
  id: string;
  created_at: string;
  engineer_id: string;
  file_id: string | null;
  amount_cents: number;
  decision: string | null;
  period: string | null;
  status: string;
  note: string | null;
};

export async function productionLedger(
  actor: Actor | null,
  engineerId?: string,
): Promise<ProductionRow[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];
  const all = can(actor, "ledger.read_all");
  if (!all && !can(actor, "ledger.read_own")) return [];

  let query = db
    .from("eng_production_ledger")
    .select("id, created_at, engineer_id, file_id, amount_cents, decision, period, status, note")
    .order("created_at", { ascending: false })
    .limit(300);
  query = all && engineerId ? query.eq("engineer_id", engineerId) : all ? query : query.eq("engineer_id", actor.id);

  const { data } = await query;
  return ((data ?? []) as ProductionRow[]).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) }));
}

export type TimeRow = {
  id: string;
  created_at: string;
  file_id: string | null;
  kind: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  note: string | null;
  entered_manually: boolean;
};

export async function timeLog(actor: Actor | null, profileId?: string): Promise<TimeRow[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];
  if (!can(actor, "time.log_own")) return [];
  const subjectId = actor.role === "admin" && profileId ? profileId : actor.id;

  const { data } = await db
    .from("eng_time_log")
    .select("id, created_at, file_id, kind, started_at, ended_at, minutes, note, entered_manually")
    .eq("profile_id", subjectId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(300);
  return (data ?? []) as TimeRow[];
}

/**
 * Correct or add a time entry by hand.
 *
 * Flagged as manual, always, and the flag is never optional. The measured
 * number and the corrected number are both legitimate and they are not the same
 * kind of fact: one is what the clock saw, the other is what a person says
 * happened. A log that cannot tell them apart is a log where the measurement
 * stops meaning anything.
 */
export async function recordTime(
  actor: Actor & { email: string },
  input: { fileId?: string | null; kind: string; minutes: number; note?: string | null; startedAt?: string | null },
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "time.log_own")) return { ok: false, error: "Your role does not keep a time log." };
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
    return { ok: false, error: "Minutes has to be a number above zero." };
  }
  if (input.minutes > 24 * 60) {
    return { ok: false, error: "That is more than a day. Split it across the days it happened on." };
  }

  const { error } = await db.from("eng_time_log").insert({
    profile_id: actor.id,
    file_id: input.fileId || null,
    kind: input.kind,
    minutes: Math.round(input.minutes),
    started_at: input.startedAt || new Date().toISOString(),
    note: input.note?.trim() || null,
    entered_manually: true,
  });
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "time.record",
    entityType: "profile",
    entityId: actor.id,
    summary: `Recorded ${Math.round(input.minutes)} minutes of ${input.kind} by hand`,
    ...context,
  });
  return { ok: true };
}
