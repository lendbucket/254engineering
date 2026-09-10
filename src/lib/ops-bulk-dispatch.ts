import "server-only";
import { can, type Actor } from "./ops-authz";
import { filesByIds } from "./ops-crm";
import { dispatchContext, sendOffers } from "./ops-field";
import { EXPORT_LIMIT } from "./ops-bulk-files";

/**
 * Dispatching many files, as N plans a person reviews.
 *
 * Phase 12 Section 4, Section 1. Operator ruling at gate 1, 2026-09-09:
 *
 *   Bulk dispatch reproduces the single file dispatch rule EXACTLY and
 *   introduces no selection rule. Whatever the single path does for a file,
 *   bulk does N times, and the operator reviews N plans before any offer goes
 *   out. No technician is chosen by a bulk path that the single path would not
 *   have chosen for that file.
 *
 * WHAT THE SINGLE PATH ACTUALLY DOES, WHICH IS WHAT THIS HAD TO FIND OUT FIRST
 * -----------------------------------------------------------------------------
 * DispatchPanel opens with `useState<string[]>([])`. Nothing is preselected.
 * The panel shows the plan, ranked, with every ineligible technician and the
 * reason they are ineligible, and the dispatcher ticks the ones they want.
 *
 * So there is no default to reproduce, and the ruling anticipated that: bulk
 * dispatch is a review screen with N picks and no shortcut. This module builds
 * the N plans and sends the N sets of picks. It chooses nobody.
 *
 * WHY THERE IS NO "OFFER TO EVERYONE ELIGIBLE" BUTTON HERE
 * ---------------------------------------------------------
 * Because that would be a selection rule, invented by the bulk path, that the
 * single path does not have. Offers are how field technicians get work; a bulk
 * action that fanned every plan out to everyone eligible would route the firm's
 * field spend by a rule nobody ruled on, and it is the shape most likely to
 * look fine for a month.
 *
 * WHY IT CALLS sendOffers RATHER THAN WRITING OFFERS
 * ---------------------------------------------------
 * The same argument ops-bulk.ts makes about placeOrder, and it is the whole
 * reason that file is a wrapper. sendOffers refuses a file that already has a
 * technician, refuses a service line with no published protocol because a
 * technician accepting it would open an empty checklist, writes the assignment
 * rows, the file event and the audit row, and notifies. A second implementation
 * here would be a second answer to "may this work be offered", and the two
 * would drift.
 *
 * PARTIAL FAILURE IS EXPLICIT, WHICH IS ops-bulk's RULE AND IS THIS ONE TOO
 * --------------------------------------------------------------------------
 * Each file gets its own outcome and its own reason. A bulk action that
 * reported "12 dispatched" over three silent refusals would be describing work
 * that did not happen.
 */

export type DispatchPlanRow = {
  fileId: string;
  fileNumber: string;
  propertyAddress: string;
  county: string;
  status: string;
  /** Technicians who may be offered this file, in the plan's own order. */
  offers: { techId: string; displayName: string; rank: number; miles: number | null; openJobs: number; amountCents: number | null }[];
  /** And the ones who may not, with the reason, because a shorter list is not an answer. */
  ineligible: { id: string; displayName: string; reason: string }[];
  /**
   * Why this file cannot be dispatched at all, when that is the case.
   *
   * Present rather than the file being dropped from the list. A file missing
   * from a review screen reads as a file that was fine.
   */
  blocked: string | null;
};

export type BulkDispatchResult = {
  sent: { fileId: string; fileNumber: string; count: number }[];
  refused: { fileId: string; fileNumber: string; reason: string }[];
};

/**
 * One plan per file, in the order the files were given.
 *
 * A file the actor may not read simply does not come back, exactly as the
 * export behaves, and the caller compares what it asked for against what it
 * got rather than being told a shorter list is the whole list.
 */
export async function dispatchPlans(
  actor: Actor & { email: string },
  fileIds: string[],
): Promise<{ ok: true; plans: DispatchPlanRow[] } | { ok: false; error: string }> {
  if (!can(actor, "offers.dispatch")) return { ok: false, error: "Your role cannot dispatch." };
  if (fileIds.length === 0) return { ok: false, error: "Nothing selected." };
  if (fileIds.length > EXPORT_LIMIT) {
    return {
      ok: false,
      error: `That is ${fileIds.length} files. This screen reviews at most ${EXPORT_LIMIT} at a time.`,
    };
  }

  const files = await filesByIds(actor, fileIds);
  const plans: DispatchPlanRow[] = [];

  for (const file of files) {
    const context = await dispatchContext(actor, {
      id: file.id,
      county: file.county,
      service_slug: file.service_slug,
      latitude: file.latitude,
      longitude: file.longitude,
    });

    /*
     * The two reasons a file is here and cannot be offered, both of which
     * sendOffers would refuse anyway. Said on the review screen so the operator
     * learns it before ticking rather than after pressing.
     */
    const blocked = file.assigned_tech_id
      ? "This file already has a technician."
      : !context
        ? "No dispatch plan could be built for this file."
        : context.plan.offers.length === 0
          ? `No technician covers ${file.county} County for this service line.`
          : null;

    plans.push({
      fileId: file.id,
      fileNumber: file.file_number,
      propertyAddress: file.property_address,
      county: file.county,
      status: file.status,
      /*
       * THE PLAN'S OWN ORDER AND THE PLAN'S OWN NUMBERS, carried through
       * untouched. Re-ranking here would be this module having an opinion about
       * who should get work, which is the one thing the ruling forbids it.
       */
      offers: (context?.plan.offers ?? []).map((o) => ({
        techId: o.techId,
        displayName: o.displayName,
        rank: o.rank,
        miles: o.distanceMiles,
        openJobs: o.openJobs,
        amountCents: o.amountCents,
      })),
      ineligible: context?.plan.ineligible ?? [],
      blocked,
    });
  }

  return { ok: true, plans };
}

/**
 * Send the picks, one file at a time, through the single file path.
 *
 * Sequential rather than parallel, deliberately. Each call writes assignment
 * rows and raises notifications, and the queue is what absorbs the sending; a
 * fan out here would buy nothing but a harder failure to describe.
 */
export async function sendBulkOffers(
  actor: Actor & { email: string },
  picks: { fileId: string; techIds: string[] }[],
  options: { expiresInHours?: number } = {},
  context: Record<string, unknown> = {},
): Promise<{ ok: true; result: BulkDispatchResult } | { ok: false; error: string }> {
  if (!can(actor, "offers.dispatch")) return { ok: false, error: "Your role cannot dispatch." };

  const wanted = picks.filter((p) => p.techIds.length > 0);
  if (wanted.length === 0) return { ok: false, error: "No technician was chosen for any file." };
  if (wanted.length > EXPORT_LIMIT) {
    return { ok: false, error: `That is ${wanted.length} files. Dispatch at most ${EXPORT_LIMIT} at a time.` };
  }

  /*
   * The ids are resolved through the same scoped read the review screen used,
   * so a browser cannot dispatch a file by knowing its id. sendOffers checks
   * the capability again; this checks the SCOPE, which sendOffers does not.
   */
  const allowed = await filesByIds(
    actor,
    wanted.map((p) => p.fileId),
  );
  const byId = new Map(allowed.map((f) => [f.id, f]));

  const sent: BulkDispatchResult["sent"] = [];
  const refused: BulkDispatchResult["refused"] = [];

  for (const pick of wanted) {
    const file = byId.get(pick.fileId);
    if (!file) {
      refused.push({
        fileId: pick.fileId,
        fileNumber: pick.fileId,
        reason: "That file is not one you can see, or it no longer exists.",
      });
      continue;
    }

    const outcome = await sendOffers(actor, pick.fileId, pick.techIds, options, context);
    if (outcome.ok) {
      sent.push({ fileId: pick.fileId, fileNumber: file.file_number, count: outcome.sent });
    } else {
      refused.push({ fileId: pick.fileId, fileNumber: file.file_number, reason: outcome.error });
    }
  }

  return { ok: true, result: { sent, refused } };
}
