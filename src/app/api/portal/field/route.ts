import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";
import type { EvidenceKind } from "@/lib/ops-evidence";
import {
  acceptOffer,
  addProtocolItem,
  createProtocol,
  declineOffer,
  deleteCapture,
  publishProtocol,
  recordCapture,
  removeProtocolItem,
  sendOffers,
  setLedgerStatus,
  setTechBase,
  submitEvidence,
} from "@/lib/ops-field";

/**
 * Everything in the field that changes something: protocols, offers, captures,
 * submission, and the pay ledger.
 *
 * One endpoint with an action, for the reason the files endpoint gives: every
 * branch needs the actor read from the database, an authorization check, and the
 * request context for the audit row, and five routes would be four more places
 * to forget one of the three.
 *
 * THE UPLOAD BRANCH IS THE ODD ONE, AND DELIBERATELY SO
 * -----------------------------------------------------
 * `sign_upload` returns a signed URL and the phone PUTs the photograph straight
 * to storage. The bytes never pass through this function. A ten megabyte body
 * through a serverless handler on one bar of signal, in a county where one bar
 * is the normal condition, is the upload that times out, and it would time out
 * after the technician has already climbed down.
 *
 * The closed door still holds: the signed URL is a plain HTTPS endpoint, the
 * browser holds no Supabase credential, and no NEXT_PUBLIC key exists.
 */

export const dynamic = "force-dynamic";

const EVIDENCE_BUCKET = "eng-evidence";

const ALLOWED_CAPTURE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

/** 15MB, matching the bucket. A phone camera on a bright roof clears ten. */
const MAX_CAPTURE_BYTES = 15 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const nullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  // ------------------------------------------------------------- protocols

  if (action === "create_protocol") {
    const result = await createProtocol(
      actor,
      {
        serviceSlug: String(body?.serviceSlug ?? ""),
        name: String(body?.name ?? ""),
        summary: body?.summary ? String(body.summary) : null,
        copyFromId: body?.copyFromId ? String(body.copyFromId) : null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  if (action === "add_protocol_item") {
    const result = await addProtocolItem(
      actor,
      String(body?.templateId ?? ""),
      {
        itemKey: String(body?.itemKey ?? ""),
        kind: String(body?.kind ?? "photo") as EvidenceKind,
        label: String(body?.label ?? ""),
        instructions: body?.instructions ? String(body.instructions) : null,
        required: body?.required !== false,
        unit: body?.unit ? String(body.unit) : null,
        minValue: nullableNumber(body?.minValue),
        maxValue: nullableNumber(body?.maxValue),
        minCount: nullableNumber(body?.minCount),
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "remove_protocol_item") {
    const result = await removeProtocolItem(
      actor,
      String(body?.templateId ?? ""),
      String(body?.itemId ?? ""),
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "publish_protocol") {
    const result = await publishProtocol(actor, String(body?.id ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  // -------------------------------------------------------------- dispatch

  if (action === "send_offers") {
    const techIds = Array.isArray(body?.techIds) ? body.techIds.map(String) : [];
    const result = await sendOffers(
      actor,
      String(body?.fileId ?? ""),
      techIds,
      { expiresInHours: nullableNumber(body?.expiresInHours) ?? undefined },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, sent: result.sent }) : bad(result.error);
  }

  if (action === "accept_offer") {
    const result = await acceptOffer(actor, String(body?.offerId ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true, fileId: result.fileId }) : bad(result.error);
  }

  if (action === "decline_offer") {
    const result = await declineOffer(
      actor,
      String(body?.offerId ?? ""),
      body?.reason ? String(body.reason) : null,
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  // -------------------------------------------------------------- evidence

  if (action === "sign_upload") {
    if (!can(actor, "evidence.capture") && !can(actor, "evidence.review")) {
      return bad("Not permitted.", 403);
    }
    const db = supabaseAdmin();
    if (!db) return bad("Storage is not configured.", 503);

    const fileId = String(body?.fileId ?? "");
    const captureId = String(body?.captureId ?? "");
    const contentType = String(body?.contentType ?? "");
    const size = Number(body?.size ?? 0);

    if (!UUID.test(fileId)) return bad("Malformed file reference.");
    /*
     * The capture id becomes part of a storage path, so it is checked as
     * strictly as the file id. It is minted on the device by newCaptureId, so
     * the shape is known: cap_ and a uuid, or cap_ and a timestamp fallback for
     * a browser with no crypto.randomUUID.
     */
    if (!/^cap_[A-Za-z0-9-]{8,60}$/.test(captureId)) return bad("Malformed capture reference.");
    if (!ALLOWED_CAPTURE_TYPES.includes(contentType)) {
      return bad("That file type is not accepted. Photographs or a PDF.");
    }
    if (!Number.isFinite(size) || size <= 0) return bad("That file looks empty.");
    if (size > MAX_CAPTURE_BYTES) return bad("That file is over 15MB.");

    const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] ?? "jpg";
    const path = `${fileId}/${captureId}.${ext}`;
    const { data, error } = await db.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !data) return bad(error?.message ?? "Could not prepare the upload.");

    return NextResponse.json({ ok: true, url: data.signedUrl, path: data.path });
  }

  if (action === "record_capture") {
    const result = await recordCapture(
      actor,
      String(body?.fileId ?? ""),
      {
        clientCaptureId: String(body?.captureId ?? ""),
        itemKey: String(body?.itemKey ?? ""),
        kind: String(body?.kind ?? "photo") as EvidenceKind,
        valueText: body?.valueText ? String(body.valueText) : null,
        valueNumber: nullableNumber(body?.valueNumber),
        storageKey: body?.storageKey ? String(body.storageKey) : null,
        capturedAt: body?.capturedAt ? String(body.capturedAt) : null,
        lat: nullableNumber(body?.lat),
        lng: nullableNumber(body?.lng),
        accuracy: nullableNumber(body?.accuracy),
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  if (action === "delete_capture") {
    const result = await deleteCapture(actor, String(body?.fileId ?? ""), String(body?.captureId ?? ""));
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "submit_evidence") {
    const result = await submitEvidence(
      actor,
      String(body?.fileId ?? ""),
      body?.note ? String(body.note) : null,
      context,
    );
    /*
     * The blockers travel with the refusal. A technician at a property needs to
     * know which photograph is missing, not that the form is incomplete, and
     * making them navigate back to find out is how the second visit happens.
     */
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, error: result.error, blockers: result.blockers ?? [] }, { status: 400 });
  }

  // ---------------------------------------------------------------- roster

  if (action === "set_ledger_status") {
    const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    const status = String(body?.status ?? "");
    if (!["approved", "paid", "void"].includes(status)) return bad("Unknown ledger status.");
    const result = await setLedgerStatus(actor, ids, status as "approved" | "paid" | "void", context);
    return result.ok ? NextResponse.json({ ok: true, count: result.count }) : bad(result.error);
  }

  if (action === "set_tech_base") {
    const result = await setTechBase(
      actor,
      String(body?.techId ?? ""),
      {
        baseCity: body?.baseCity ? String(body.baseCity) : null,
        baseCounty: body?.baseCounty ? String(body.baseCounty) : null,
        lat: nullableNumber(body?.lat),
        lng: nullableNumber(body?.lng),
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  return bad("Unknown action.");
}
