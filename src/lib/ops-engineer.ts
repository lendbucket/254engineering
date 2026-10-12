import "server-only";
import { DB_NOW } from "./db-now";
import { clockSentence } from "./clock-skew";
import { supabaseAdmin } from "./supabase";
import { deskPackageComplete } from "./ops-payments";
import { writeAudit } from "./ops-audit";
import { can, type Actor, holdsLicence, licenceRefusal } from "./ops-authz";
import { transitionFile } from "./ops-crm";
import { jobView } from "./ops-field";
import { protocolItemRowsFor } from "./protocol-run";
import type { Determination } from "@/content/protocols";
import { isOpen } from "./launch";
import { orderForFile as liveOrderForFile } from "./order-for-file";
import { catalogFor, deliverablesFor } from "@data/catalog";
import { engineerPayCents, tierForDeliverable, type PayTier } from "@/config/engineer-pay";
import { randomUUID } from "node:crypto";
import { canTransition, STATUS_TIMESTAMP, type FileStatus } from "./ops-files";
import { effectModeFor } from "./fixture-identity";
import { REVIEW_AFTER_DECISION, reviewAfterDecisionKey, type ReviewAfterDecisionPayload } from "./review-jobs";
import {
  ACTION_LABEL,
  ACTION_TARGET,
  actionForDetermination,
  canReview,
  chargeLogRow,
  minutesBetween,
  monthlyExportCsv,
  periodOf,
  reliedOnVerdict,
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

// ------------------------------------------------- waiting on the owners

/**
 * THE FILES THE FIRM IS NOT WORKING ON, AND HAS NOT FINISHED WITH.
 *
 * WHY THIS SCREEN IS WHAT MAKES THE NO-TIMER DECISION SAFE RATHER THAN
 * NEGLIGENT. Operator ruling, 2026-09-19.
 *
 * A file in `repairs_required` does not age out and cannot reach `closed`,
 * because a homeowner who takes four months to afford a roof repair has not
 * abandoned anything and a firm that closes his file is the one who failed.
 * The cost of that ruling is real and it is not a data cost: nothing chases
 * these. If the owner never rings back, nobody notices.
 *
 * The answer is VISIBILITY RATHER THAN EXPIRY. A status that quietly closed
 * itself would turn "waiting" into "forgotten" while looking tidy. A list turns
 * it into "waiting, and we can see for how long", which is what lets somebody
 * ring in month three instead of finding them in year two.
 *
 * OLDEST FIRST, for the reason the review queue is oldest first: a list sorted
 * newest first is one where the awkward case somebody keeps skipping sinks out
 * of sight. Here the oldest is by definition the one most likely to have been
 * forgotten.
 *
 * NO FIGURES ON IT, AND THAT IS THE ENGINEER PRINCIPLE RATHER THAN AN OVERSIGHT.
 * An engineer reaches this screen because these are files HE withheld
 * certification on, which is his accountability. What a job is worth, what
 * anybody is paid and what the firm makes on it are not on it and must not be
 * added: "a number in his head near an engineering judgement is the thing to
 * avoid", and this screen sits closer to an engineering judgement than most.
 */
export type WaitingRow = {
  id: string;
  file_number: string;
  property_address: string;
  city: string | null;
  county: string;
  service_slug: string;
  repairs_required_at: string | null;
  /** How many of the repair list's items are still open, and how many there were. */
  openItems: number;
  totalItems: number;
};

export async function waitingOnOwners(actor: Actor | null): Promise<WaitingRow[]> {
  const db = supabaseAdmin();
  if (!db || !holdsLicence(actor, "review.queue")) return [];

  const { data: files } = await db
    .from("eng_files")
    .select("id, file_number, property_address, city, county, service_slug, repairs_required_at")
    .eq("status", "repairs_required")
    .eq("is_demo", false)
    .order("repairs_required_at", { ascending: true, nullsFirst: true })
    .limit(200);

  const rows = (files ?? []) as Omit<WaitingRow, "openItems" | "totalItems">[];
  if (rows.length === 0) return [];

  /*
   * The repair items for exactly these files, counted here rather than by a
   * query per row. A list screen that issues one query per row is the shape
   * that makes /portal/accounts take fifty seconds.
   */
  const { data: items } = await db
    .from("eng_repair_items")
    .select("file_id, closed_at")
    .in(
      "file_id",
      rows.map((r) => r.id),
    );

  const byFile = new Map<string, { open: number; total: number }>();
  for (const item of (items ?? []) as { file_id: string; closed_at: string | null }[]) {
    const seen = byFile.get(item.file_id) ?? { open: 0, total: 0 };
    seen.total += 1;
    if (item.closed_at === null) seen.open += 1;
    byFile.set(item.file_id, seen);
  }

  return rows.map((r) => ({
    ...r,
    openItems: byFile.get(r.id)?.open ?? 0,
    totalItems: byFile.get(r.id)?.total ?? 0,
  }));
}

/**
 * How long a file has been waiting, in whole days, or null if nobody stamped it.
 *
 * NULL IS A REAL ANSWER AND THE SCREEN SAYS SO. A file that reached this status
 * before 0053 stamped the column, or by a path that forgot to, has an UNKNOWN
 * age rather than an age of zero. Rendering a missing timestamp as "today" would
 * put the oldest file at the top of the list reading as the newest.
 */
export function daysWaiting(since: string | null, now: Date = new Date()): number | null {
  if (!since) return null;
  const started = new Date(since).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((now.getTime() - started) / 86_400_000));
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
    /** 254-RC-001 section 9's third value, as the sentence a person reads. */
    clockSentence: string;
    /** Null where nobody measured, which is not the same as agreeing. */
    clockDisagrees: boolean | null;
  }[];
  satisfied: boolean;
  problem: string | null;
  /**
   * Set when the item was satisfied by a recorded absence rather than by
   * evidence. Appendix C asks the engineer to weigh the package, and "we
   * photographed it" and "we recorded why we could not" are different inputs to
   * that judgement. REVISE's criteria include "Exception used where the
   * condition plainly applied", which he cannot apply if the screen hides which
   * items were excepted.
   */
  exception: { kind: "not_observed" | "not_applicable"; reason: string } | null;
};

export type PackageView = {
  file: {
    id: string;
    file_number: string;
    property_address: string;
    city: string | null;
    county: string;
    service_slug: string;
    /** The catalogue tier key, when the file records it; read for the pay tier. */
    deliverable: string | null;
    status: string;
    twia_county: boolean;
    notes: string | null;
    revision_count: number;
    refusal_reason: string | null;
    /** Who took it into review, which is who decides it (canReview, 2026-10-10). */
    assigned_engineer_id: string | null;
    /** Read so the decision can tell the technician BEFORE it releases them. */
    assigned_tech_id: string | null;
  };
  protocolName: string | null;
  /**
   * The protocol document number, or null. Read rather than the template name,
   * because the registry is keyed on the DOCUMENT and the name is a label
   * somebody typed.
   */
  protocolDocument: string | null;
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
      "id, file_number, property_address, city, county, service_slug, deliverable, status, twia_county, notes, revision_count, refusal_reason, assigned_tech_id, assigned_engineer_id",
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
    exception: status.exception
      ? { kind: status.exception.kind, reason: status.exception.reason }
      : null,
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
        /*
         * THE THIRD TIME VALUE REACHES THE ENGINEER, because he is the person
         * the protocol wrote it for. Section 9: a disagreeing clock is
         * "recorded as disagreeing rather than presented as certain", and the
         * presenting happens here, on the screen where he decides what the
         * evidence supports.
         *
         * The SENTENCE is built from one home in clock-skew.ts rather than
         * here, so the technician's screen and this one cannot describe the
         * same row differently.
         */
        clockSentence: clockSentence(
          c.clock_skew_seconds === null || c.clock_disagrees === null
            ? null
            : { skewSeconds: Number(c.clock_skew_seconds), disagrees: c.clock_disagrees },
        ),
        clockDisagrees: c.clock_disagrees,
      })),
  }));

  const { data: sessionRows, error: sessionErr } = await db
    .from("eng_review_sessions")
    .select("id, started_at")
    .eq("file_id", fileId)
    .eq("engineer_id", actor!.id)
    .is("ended_at", null)
    /* Oldest open session first. Two open sessions on one file is a state
     * nothing prevents, and reading it as "none open" would show an engineer
     * no session while they are inside one. */
    .order("started_at", { ascending: true })
    .limit(1);
  if (sessionErr) {
    console.error(`[engineer] could not read the open review session for ${fileId}: ${sessionErr.message}`);
  }
  const session = (sessionRows ?? [])[0] ?? null;

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
    protocolDocument: view.protocol?.document_number ?? null,
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
  if (!holdsLicence(actor, "review.queue")) return { ok: false, error: licenceRefusal("Taking a file into review") };

  const { data: file } = await db
    .from("eng_files")
    .select("id, status, file_number, assigned_engineer_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { ok: false, error: "That file does not exist." };

  /*
   * Another engineer's review is not opened. Product audit, 2026-10-10: a file
   * already under review opened a second session for whoever asked, and the
   * decision check could not tell them apart (see canReview).
   */
  if (file.status === "under_review" && file.assigned_engineer_id && file.assigned_engineer_id !== actor.id) {
    return { ok: false, error: "Another engineer has this file under review." };
  }

  const { data: existingRows, error: existingErr } = await db
    .from("eng_review_sessions")
    .select("id")
    .eq("file_id", fileId)
    .eq("engineer_id", actor.id)
    .is("ended_at", null)
    /* Oldest open session first, and the error is read below: this is the
     * check that stops a second session being opened, so a duplicate reading
     * as "none" is the one state that would open a third. */
    .order("started_at", { ascending: true })
    .limit(1);
  if (existingErr) return { ok: false, error: `Could not check for an open review session: ${existingErr.message}` };
  const existing = (existingRows ?? [])[0] ?? null;
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

/*
 * =========================================================================
 * WHAT AN ENGINEER IS CREDITED FOR A DECISION HAS ONE HOME:
 * src/config/engineer-pay.ts. Operator ruling 1 of 2026-10-10.
 * =========================================================================
 *
 * This read `eng_fee_schedule` (kind engineer_production) by service line,
 * while the price book and every margin read the tiers in the executed
 * agreement. Two homes for one fact, and they disagreed: development's
 * schedule held $95 for windstorm and nothing else, and PRODUCTION'S SCHEDULE
 * IS EMPTY, so on production every decision the engineer made, roof included,
 * credited him nothing, and the review screen said "no production rate is set".
 *
 * The credit is now the tier the JOB attracted, read the way the agreement
 * defines it (by deliverable, not by line): the file's own deliverable, else
 * the deliverable of the order it is worked under, else the line's only
 * deliverable when it sells exactly one. Where none of those answers, NO
 * figure is invented; the decision says why nothing was credited.
 * `eng_fee_schedule` keeps `tech_pay`, which is a different fact.
 */
export type ProductionCredit =
  | { ok: true; deliverable: string; tier: PayTier; cents: number }
  | { ok: false; reason: string };

/**
 * The credit for a decided review on this file. Exported for the proof that
 * reads it against real rows; decideReview writes exactly its figure.
 */
export async function productionCreditFor(file: {
  id: string;
  service_slug: string;
  deliverable: string | null;
}): Promise<ProductionCredit> {
  const slug = file.service_slug;
  let deliverable: string | null =
    file.deliverable && catalogFor(slug, file.deliverable) ? file.deliverable : null;
  if (!deliverable) {
    const order = await liveOrderForFile(file.id, "tier");
    const orderTier = (order?.tier as string | null | undefined) ?? null;
    if (orderTier && catalogFor(slug, orderTier)) deliverable = orderTier;
  }
  if (!deliverable) {
    const only = deliverablesFor(slug);
    if (only.length === 1) deliverable = only[0].tier;
  }
  if (!deliverable) {
    return {
      ok: false,
      reason:
        "this file does not record which deliverable it is, and its service line sells more than one, " +
        "so the pay tier cannot be read",
    };
  }
  const tier = tierForDeliverable(slug, deliverable);
  if (tier === null) {
    return { ok: false, reason: `no pay tier is ruled for ${slug} (${deliverable})` };
  }
  return { ok: true, deliverable, tier, cents: engineerPayCents(tier) };
}

export type DecisionResult =
  | {
      ok: true;
      action: ReviewAction;
      minutes: number;
      paidCents: number | null;
      /** Why nothing was credited, when paidCents is null; a sentence for the engineer. */
      payNote: string | null;
    }
  | { ok: false; error: string };

/**
 * Decide a file.
 *
 * Every rule comes from ops-review, which is pure and asserted. This function
 * loads, asks, persists, and writes the three records. It contains no rule of
 * its own, for the reason files-audit taught: a rule here is a rule the suite
 * cannot see.
 */
/**
 * WHAT THE ENGINEER CONCLUDED, AND WHAT HE LOOKED AT TO CONCLUDE IT.
 *
 * Appendix C: "One determination is recorded per review." So this rides the
 * decision rather than being a second call somebody could forget: a review that
 * moved a file and left no determination is precisely the record the protocol
 * exists to prevent.
 */
export type DeterminationInput = {
  determination: Determination;
  reliedOnItemKeys: string[];
  reliedOnEvidenceIds: string[];
  note: string | null;
  /**
   * What the owner must have repaired, one requirement per entry.
   *
   * Carried on the determination rather than beside it because 0053 makes
   * `determination_id` NOT NULL on a repair item: a requirement with no
   * determination behind it is a demand nobody is accountable for.
   *
   * Empty for every determination except REPAIRS REQUIRED, and required for
   * that one, because "certification withheld and a repair list issued" without
   * a list is the withholding with the reason left out.
   */
  repairRequirements: string[];
};

export async function decideReview(
  actor: Actor & { email: string },
  fileId: string,
  action: ReviewAction,
  reason: string | null,
  context: Context = {},
  determination: DeterminationInput | null = null,
): Promise<DecisionResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const pkg = await packageFor(actor, fileId);
  if (!pkg) return { ok: false, error: "That file does not exist, or is not yours to review." };

  /*
   * ONE DECISION AT A TIME. Since 2026-10-07 a passing decision leaves the file
   * under review until the engineer seals its letter. A second decision on top
   * of an unsealed pass would leave two determinations on one file with only
   * one able to become a letter, so it is refused, naming what is waiting.
   */
  {
    const { data: passes } = await db
      .from("eng_determinations")
      .select("id")
      .eq("file_id", fileId)
      .eq("determination", "pass");
    const passIds = (passes ?? []).map((p) => p.id as string);
    if (passIds.length > 0) {
      const { data: acts, error: actsError } = await db
        .from("eng_seal_acts")
        .select("determination_id")
        .in("determination_id", passIds)
        .is("voided_at", null);
      if (actsError) {
        return {
          ok: false,
          error: `Whether this file's passing determination is already sealed could not be read (${actsError.message}), so no second decision is recorded.`,
        };
      }
      const sealedIds = new Set((acts ?? []).map((a) => a.determination_id as string));
      if (passIds.some((id) => !sealedIds.has(id))) {
        return {
          ok: false,
          error: "This file already has a passing determination waiting for your seal. Seal its letter from the panel on this screen.",
        };
      }
    }
  }

  /*
   * =====================================================================
   * THE DETERMINATION, WHICH IS REQUIRED WHEN A SIGNED PROTOCOL GOVERNS.
   * =====================================================================
   *
   * REQUIRED RATHER THAN OFFERED, and the condition is the protocol rather than
   * a setting. A file worked to 254-RC-001 was worked to a document whose
   * Appendix C says one determination is recorded per review, and a review that
   * skips it has not followed the protocol the letter will rest on.
   *
   * Files with no registry protocol are not forced through this, because
   * inventing an Appendix C for a service line that has no signed document
   * would be the fabrication the whole gate exists to prevent. The condition is
   * read from the protocol's document number, so the first day a second
   * protocol is registered, its files are covered with no change here.
   */
  const governing = protocolItemRowsFor(pkg.protocolDocument) === null ? null : pkg.protocolDocument;

  if (governing && !determination) {
    return {
      ok: false,
      error: `${governing} requires one determination per review. Record what you concluded and what you relied on.`,
    };
  }

  if (governing && determination) {
    const relied = reliedOnVerdict({
      itemKeys: determination.reliedOnItemKeys,
      evidenceIds: determination.reliedOnEvidenceIds,
      protocolItemKeys: pkg.items.map((i) => i.itemKey),
      fileEvidenceIds: pkg.items.flatMap((i) => i.captures.map((c) => c.id)),
    });
    if (!relied.ok) return { ok: false, error: relied.reason };

    /*
     * THE ACTION IS DERIVED FROM THE DETERMINATION RATHER THAN ACCEPTED BESIDE
     * IT. A determination of PASS with an action of "decline to seal" is a
     * contradiction the record should not be able to hold, so the two are not
     * asked separately: what arrives is checked against what the determination
     * implies, and a disagreement is refused by name.
     */
    /*
     * A WITHHOLDING WITH NO LIST IS THE WITHHOLDING WITH ITS REASON LEFT OUT.
     *
     * Refused here rather than at the database, because 0053 cannot express
     * "this determination needs rows in another table": the constraint it CAN
     * express, and does, is the one that matters more, that a file cannot be
     * sealed while any of those rows is open. This is the sentence a person
     * gets; that is the impossibility.
     */
    const requirements = (determination.repairRequirements ?? [])
      .map((r) => r.trim())
      .filter((r) => r.length >= 3);
    if (determination.determination === "repairs-required" && requirements.length === 0) {
      return {
        ok: false,
        error:
          "Repairs required issues a repair list, and none was given. Each item is verified on its " +
          "own at the revisit, so each one has to be written on its own.",
      };
    }
    if (determination.determination !== "repairs-required" && requirements.length > 0) {
      return {
        ok: false,
        error: `A repair list belongs to a determination of repairs-required, and this one is ${determination.determination}.`,
      };
    }

    const implied = actionForDetermination(determination.determination);
    if (!implied.ok) return { ok: false, error: implied.reason };
    if (implied.action !== action) {
      return {
        ok: false,
        error: `A determination of ${determination.determination} is ${ACTION_LABEL[implied.action].toLowerCase()}, and this review asked for ${ACTION_LABEL[action].toLowerCase()}.`,
      };
    }
  }

  const subject: ReviewSubject = {
    status: pkg.file.status as ReviewSubject["status"],
    packageComplete: pkg.complete,
    /* The FILE's assignee, never the caller: passing actor.id made canReview's check vacuous (2026-10-10). */
    assignedEngineerId: pkg.file.assigned_engineer_id ?? null,
  };

  const verdict = canReview(actor, subject, action, reason, { prelaunch: !isOpen() });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  /*
   * =====================================================================
   * ONE WRITE, OR NONE. Operator ruling, 2026-10-10; migration 0068.
   * =====================================================================
   *
   * Everything above this line READS and JUDGES. Everything a decision writes
   * is handed to eng_record_review_decision, which records it in one
   * transaction: the determination and its repair list, the status move with
   * its stamp, file event and audit row, the refusal or revision fields, the
   * technician released, the review session closed, the responsible charge log
   * row, the production ledger credit and the decision's audit row. Until
   * 2026-10-10 those were a dozen separate requests, and a failure between two
   * of them could leave a decided review with no pay, which is the state the
   * ruling names.
   *
   * WHAT REACHES OUTSIDE IS QUEUED, NOT RUN. Two things here used to run inline
   * after the writes: the notices raise() sends (the technician on revisions or
   * a site visit, the administrators on a refusal), and on a refusal
   * settleDecision, which can REFUND A CARD through Stripe and could send the
   * order's email. Both are now one eng_jobs row of kind review.after_decision,
   * inserted by the same transaction under an idempotency key, and done by the
   * job runner after commit (job-handlers.ts). A rolled back decision leaves no
   * job; a committed one cannot lose its refund to a crash in between.
   *
   * The rules stay here, in TypeScript, where their audits read them. The
   * function re-checks the one thing only the database can: that the file is
   * still in the status the rules were judged against.
   */
  const now = new Date();
  const session = pkg.session;
  const minutes = session ? minutesBetween(new Date(session.startedAt), now) : 0;
  const target = ACTION_TARGET[action];
  const note = reason?.trim() || null;

  /*
   * A PASSING DECISION IS NOT A SEAL. Operator ruling of 2026-10-06: the file
   * stays under review until the engineer seals its letter, and
   * src/lib/letter-seal.ts moves it at the seal act. Every other action is
   * judged by the same grammar transitionFile applies.
   */
  if (action !== "seal") {
    const verdict = canTransition(actor, pkg.file.status as FileStatus, target, {
      assignedTech: Boolean(pkg.file.assigned_tech_id),
    });
    if (!verdict.ok) return { ok: false, error: verdict.reason };
  }

  const requirements = (determination?.repairRequirements ?? []).map((r) => r.trim()).filter((r) => r.length >= 3);

  // The credit: productionCreditFor's figure and nothing else's (engineer-pay.ts).
  let payNote: string | null = null;
  const credit = session ? await productionCreditFor(pkg.file) : null;
  if (!session) {
    payNote = "No review session was open for this decision, so no production was credited.";
  } else if (credit && !credit.ok) {
    payNote =
      `No production was credited: ${credit.reason}. It is on the administrators' attention list, ` +
      "and the review is credited when the office records the file's deliverable.";
  }

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

  /* The queued work, only for the actions that have any. */
  const decisionId = randomUUID();
  let job: { kind: string; payload: ReviewAfterDecisionPayload; idempotency_key: string; effect_mode: string } | null = null;
  if (action === "revisions" || action === "site_visit" || action === "refuse") {
    const order = action === "refuse" ? await liveOrderForFile(fileId, "customer_email") : null;
    job = {
      kind: REVIEW_AFTER_DECISION,
      payload: {
        fileId,
        fileNumber: pkg.file.file_number,
        decisionId,
        action,
        note,
        actorId: actor.id,
        techId: pkg.file.assigned_tech_id ?? null,
      },
      idempotency_key: reviewAfterDecisionKey(fileId, decisionId),
      /* No outside effect for a probe engineer or a probe customer (fixture-identity.ts). */
      effect_mode: effectModeFor(actor.email, (order?.customer_email as string | null | undefined) ?? null),
    };
  }

  const { error: recordError } = await db.rpc("eng_record_review_decision", {
    p: {
      file_id: fileId,
      expected_status: pkg.file.status,
      action,
      target_status: action === "seal" ? null : target,
      stamp_column: action === "seal" ? null : (STATUS_TIMESTAMP[target] ?? null),
      note,
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role,
      ip: context.ip ?? null,
      user_agent: context.userAgent ?? null,
      transition_summary: `${pkg.file.file_number}: ${pkg.file.status} to ${target}`,
      decision_summary: `${pkg.file.file_number}: ${action === "refuse" ? "declined to seal" : action}${
        session ? ` after ${minutes} minutes` : ""
      }`,
      determination:
        governing && determination
          ? {
              protocol_document: governing,
              determination: determination.determination,
              relied_on_item_keys: determination.reliedOnItemKeys,
              relied_on_evidence_ids: determination.reliedOnEvidenceIds,
              note: determination.note?.trim() || null,
            }
          : null,
      repairs: governing && determination ? requirements : [],
      session: session ? { id: session.id, minutes } : null,
      charge_log: row,
      credit:
        session && credit && credit.ok
          ? {
              amount_cents: credit.cents,
              period: periodOf(now),
              note: `${pkg.file.file_number}, ${action === "refuse" ? "declined to seal" : action}, tier ${credit.tier}`,
            }
          : null,
      job,
    },
  });
  if (recordError) {
    return { ok: false, error: `Nothing was recorded, so decide again: ${recordError.message}` };
  }

  const paidCents = session && credit && credit.ok ? credit.cents : null;
  return { ok: true, action, minutes, paidCents, payNote };
}

// --------------------------------------------- reviews that credited nothing

/*
 * A DECIDED REVIEW THAT CREDITED NOTHING IS THE OFFICE'S TO FIX. Operator
 * ruling 2 of 2026-10-10.
 *
 * productionCreditFor refuses to guess a tier, so a windstorm file that records
 * neither completed nor ongoing credits nothing, and the engineer is told why.
 * That is right and it is not enough: somebody has to fix the record and the
 * review has to be credited then. So every ended review session with a decision
 * and no production ledger row is on the administrators' attention list,
 * naming the file and what is missing, and creditUncreditedReviews records the
 * deliverable (when that is what is missing) and writes the credit.
 *
 * This list also holds every decision made while production's fee schedule
 * was empty, which is true: each of those credited the engineer nothing.
 */
export type UncreditedReview = {
  sessionId: string;
  fileId: string;
  fileNumber: string;
  decision: string;
  endedAt: string;
  /** What is missing, in a sentence, or null when a credit is due and simply was never written. */
  missing: string | null;
  /** The deliverables an administrator may choose between, when the deliverable is what is missing. */
  choices: string[];
  dueCents: number | null;
};

export async function uncreditedReviews(): Promise<UncreditedReview[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data: sessions } = await db
    .from("eng_review_sessions")
    .select("id, file_id, decision, ended_at")
    .not("ended_at", "is", null)
    .not("decision", "is", null)
    .order("ended_at", { ascending: false })
    .limit(500);
  const ids = (sessions ?? []).map((s) => s.id as string);
  if (ids.length === 0) return [];
  const { data: credited } = await db.from("eng_production_ledger").select("review_session_id").in("review_session_id", ids);
  const done = new Set((credited ?? []).map((r) => r.review_session_id as string));
  const open = (sessions ?? []).filter((s) => !done.has(s.id as string));
  if (open.length === 0) return [];
  const { data: files } = await db
    .from("eng_files")
    .select("id, file_number, service_slug, deliverable, is_demo")
    .in("id", [...new Set(open.map((s) => s.file_id as string))]);
  const byId = new Map((files ?? []).map((f) => [f.id as string, f]));
  const out: UncreditedReview[] = [];
  for (const s of open) {
    const f = byId.get(s.file_id as string);
    if (!f || f.is_demo) continue;
    const credit = await productionCreditFor({
      id: f.id as string,
      service_slug: f.service_slug as string,
      deliverable: (f.deliverable as string | null) ?? null,
    });
    out.push({
      sessionId: s.id as string,
      fileId: f.id as string,
      fileNumber: f.file_number as string,
      decision: s.decision as string,
      endedAt: s.ended_at as string,
      missing: credit.ok ? null : credit.reason,
      choices: credit.ok ? [] : deliverablesFor(f.service_slug as string).map((d) => d.tier),
      dueCents: credit.ok ? credit.cents : null,
    });
  }
  return out;
}

export async function creditUncreditedReviews(
  actor: Actor & { email: string },
  fileId: string,
  deliverable: string | null,
): Promise<{ ok: true; credited: number } | { ok: false; error: string }> {
  if (!can(actor, "ledger.approve")) return { ok: false, error: "Only somebody who approves pay can credit a review." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data: file } = await db
    .from("eng_files")
    .select("id, file_number, service_slug, deliverable")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { ok: false, error: "That file does not exist." };

  let recorded = (file.deliverable as string | null) ?? null;
  if (!recorded && deliverable) {
    if (!catalogFor(file.service_slug as string, deliverable)) {
      return { ok: false, error: `${deliverable} is not a deliverable of ${file.service_slug}.` };
    }
    const { error } = await db.from("eng_files").update({ deliverable }).eq("id", fileId).is("deliverable", null);
    if (error) return { ok: false, error: `The deliverable did not record: ${error.message}` };
    recorded = deliverable;
    await writeAudit({
      actor,
      action: "file.deliverable_recorded",
      entityType: "file",
      entityId: fileId,
      summary: `${file.file_number}: deliverable recorded as ${deliverable}, so its reviews can be credited`,
    });
  }

  const credit = await productionCreditFor({ id: fileId, service_slug: file.service_slug as string, deliverable: recorded });
  if (!credit.ok) return { ok: false, error: `Still nothing to credit: ${credit.reason}.` };

  const open = (await uncreditedReviews()).filter((r) => r.fileId === fileId);
  const { data: sessions } = await db
    .from("eng_review_sessions")
    .select("id, engineer_id, decision, ended_at")
    .in("id", open.map((r) => r.sessionId));
  let credited = 0;
  for (const s of sessions ?? []) {
    const { error } = await db.from("eng_production_ledger").insert({
      engineer_id: s.engineer_id,
      file_id: fileId,
      review_session_id: s.id,
      decision: s.decision,
      amount_cents: credit.cents,
      period: periodOf(new Date(s.ended_at as string)),
      status: "pending",
      note: `${file.file_number}, ${s.decision === "refuse" ? "declined to seal" : s.decision}, tier ${credit.tier}, credited after the record was fixed`,
    });
    if (error && !/duplicate key/i.test(error.message)) return { ok: false, error: `A credit did not write: ${error.message}` };
    if (!error) credited += 1;
  }
  await writeAudit({
    actor,
    action: "ledger.credited_late",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: ${credited} review(s) credited at tier ${credit.tier}, ${credit.cents} cents each`,
  });
  return { ok: true, credited };
}

// ------------------------------------------------------- the charge log view

export type ChargeLogEntry = ExportRow & { id: number; file_id: string | null };

/**
 * HOW MANY ROWS THE CHARGE LOG READS AT ONCE, AND WHY IT IS DECLARED.
 *
 * Operator ruling, 2026-09-09, after the silent thousand survey ranked the two
 * reads in this file first and second of twenty four.
 *
 * PostgREST returns at most 1000 rows and reports nothing when it truncates.
 * This page size is 500, comfortably under that, so the CAP is never the thing
 * that silences a read here. What matters is that a caller can tell whether it
 * received everything, which is what `total` is for.
 */
const CHARGE_LOG_PAGE = 500;

/**
 * Read the log, and say how many rows there were.
 *
 * The screen wants a page. The regulator's export wants ALL of it or nothing,
 * and until this returned a total it had no way to tell the two apart. Both go
 * through here so the permission rule is written once.
 */
async function readChargeLog(
  actor: Actor | null,
  options: { engineerId?: string; period?: string; limit?: number } = {},
): Promise<{ rows: ChargeLogEntry[]; total: number } | null> {
  const db = supabaseAdmin();
  if (!db || !actor) return null;

  const all = can(actor, "responsible_charge.read_all");
  if (!all && !can(actor, "responsible_charge.read_own")) return null;

  let query = db
    .from("eng_responsible_charge_log")
    .select(
      "id, file_id, decision, reviewed_at, property_address, county, document_type, review_minutes, revision_count, site_visit, refused, refusal_reason",
      { count: "exact" },
    )
    .order("reviewed_at", { ascending: false })
    .limit(options.limit ?? CHARGE_LOG_PAGE);

  /*
   * An engineer reads their own log and nobody else's, even though they hold
   * responsible_charge.read_own. This is the record their licence stands on;
   * one engineer browsing another's review times is not a feature anybody asked
   * for and would change how people work.
   */
  query = all && options.engineerId ? query.eq("engineer_id", options.engineerId) : all ? query : query.eq("engineer_id", actor.id);
  if (options.period) query = query.eq("period", options.period);

  const { data, count, error } = await query;
  if (error) {
    console.error("[charge log] could not be read:", error.message);
    return null;
  }

  const rows = (data ?? []) as ChargeLogEntry[];
  return { rows, total: count ?? rows.length };
}

export async function chargeLog(
  actor: Actor | null,
  options: { engineerId?: string; period?: string } = {},
): Promise<ChargeLogEntry[]> {
  return (await readChargeLog(actor, options))?.rows ?? [];
}

/**
 * The months that have entries, for the export picker.
 *
 * PAGED, BECAUSE THIS ASKED FOR 2000 AND RECEIVED 1000 WITHOUT AN ERROR.
 *
 * It carried `.limit(2000)`, which was the only limit in this repository above
 * PostgREST's thousand row cap, so on any firm with that much history it was
 * already truncating and the months past the cut simply vanished from the
 * picker. A regulator is never offered a month that is not on the list, and
 * nothing anywhere said a month was missing.
 *
 * It pages now, in the order the index gives, until a page comes back short.
 * The set of distinct months is small however long the firm has traded, so this
 * is a handful of round trips at worst and the answer is complete rather than
 * capped. A hard stop guards against a page that never shrinks, and it is set
 * far beyond any real history rather than at a number somebody might reach.
 */
export async function chargeLogPeriods(actor: Actor | null, engineerId?: string): Promise<string[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];
  const all = can(actor, "responsible_charge.read_all");
  if (!all && !can(actor, "responsible_charge.read_own")) return [];

  const periods = new Set<string>();
  const PAGE = CHARGE_LOG_PAGE;
  const MAX_PAGES = 200; // 100,000 rows. A firm reaching this has other problems.

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = db
      .from("eng_responsible_charge_log")
      .select("period")
      .order("reviewed_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    query = all && engineerId ? query.eq("engineer_id", engineerId) : all ? query : query.eq("engineer_id", actor.id);

    const { data, error } = await query;
    if (error) {
      console.error("[charge log] the period list could not be read:", error.message);
      return [...periods].sort().reverse();
    }

    for (const row of data ?? []) if (row.period) periods.add(row.period as string);
    if ((data ?? []).length < PAGE) break;
  }

  return [...periods].sort().reverse();
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

  /*
   * ALL OF IT OR NONE OF IT. A REGULATOR IS NEVER HANDED A TRUNCATED CSV.
   *
   * Operator ruling, 2026-09-09. This read 500 rows and returned whatever came
   * back, so a month with more than 500 reviews produced a file that looked
   * complete, was short, and said nothing. It is the record an engineer's
   * licence stands on, and it goes to a regulator, which makes a quiet omission
   * worse here than anywhere else in the platform: the reader has no way to
   * know a row is missing and every reason to assume it is not.
   *
   * It is also the case a ROW_CEILING guard would never have caught, because
   * the limit was BELOW the cap. The count is what catches it, and the count
   * comes back on the same request so the two cannot disagree.
   */
  const read = await readChargeLog(actor, { engineerId: subjectId, period });
  if (!read) return { ok: false, error: "The responsible charge log could not be read." };

  if (read.total > read.rows.length) {
    return {
      ok: false,
      error:
        `${period} holds ${read.total.toLocaleString("en-US")} reviews and this export reads ` +
        `${read.rows.length.toLocaleString("en-US")} at a time, so no file was produced. A short ` +
        `responsible charge log is worse than none: a regulator reading it has no way to know a ` +
        `row is missing. Export a narrower period, or ask for the paged export, which is not built.`,
    };
  }

  const rows = read.rows;

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
    /* DB_NOW when the caller supplied nothing. A supplied startedAt is the
     * engineer saying when they began; the fallback is the database's own
     * clock rather than whichever machine served the request. */
    started_at: input.startedAt || DB_NOW,
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
