import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { draftForDetermination, sealLetter } from "@/lib/letter-seal";
import { ownDocumentUploadUrl, previewOwnDocument, sealOwnDocument } from "@/lib/own-document-seal";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE ENGINEER'S LETTER: READ THE DRAFT, THEN SEAL IT. POST ONLY.
 *
 * Sealing piece two, docs/sealing-controls.md. Five actions, all his alone:
 *
 *   draft        returns the drafted lines for him to read. Reads no seal image.
 *   seal         applies his seal with a fresh code from his authenticator.
 *   own-upload   a signed URL for his own specification PDF (controls 12, 13).
 *   own-preview  a ten minute link to that PDF with the page the platform adds,
 *                stamped without the images (control 14).
 *   own-seal     seals it as previewed, with a fresh code (controls 15 to 17).
 *
 * The licence is checked here so a refusal is a status code before any work,
 * and checked again in src/lib/letter-seal.ts against the determination's own
 * engineer, and again by the database in 0062. There is no GET: nothing here
 * serves a document, and the customer's copy is served by its own route, which
 * re-hashes it on every read.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!holdsLicence(actor, "documents.seal")) {
    return bad("Only the engineer of record drafts and seals a letter. No other role can stand in for him.", 403);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Send the request as JSON.");
  const determinationId = typeof body.determinationId === "string" ? body.determinationId : "";
  if (!determinationId) return bad("Name the determination whose letter this is.");
  const entered = {
    recipientAddress: typeof body.recipientAddress === "string" ? body.recipientAddress : "",
    recipientSalutation: typeof body.recipientSalutation === "string" ? body.recipientSalutation : "",
    /* The foundation letter's observed condition, his words (ruling 7, 2026-10-23). */
    observedCondition: typeof body.observedCondition === "string" ? body.observedCondition : "",
  };

  if (body.action === "draft") {
    const draft = await draftForDetermination(actor, determinationId, entered);
    /* The letterhead, the seal block as text and the draft's digest travel with the lines (L2d); no image does. */
    return draft.ok
      ? NextResponse.json({
          ok: true,
          lines: draft.lines,
          determination: draft.determination,
          title: draft.title,
          letterhead: draft.letterhead,
          sealBlock: draft.sealBlock,
          /* The page a roof B or C letter calls attached (F14, L2f). */
          attachment: draft.attachment,
          draftSha256: draft.draftSha256,
        })
      : NextResponse.json({ ok: false, error: draft.why, missing: draft.missing }, { status: 400 });
  }

  if (body.action === "seal") {
    /* The digest and the lines he read, so sealing seals only that draft (L2d). */
    const previewLines = Array.isArray(body.previewLines)
      ? (body.previewLines as unknown[])
          .filter((l): l is { kind: string; text: string } => typeof (l as { text?: unknown })?.text === "string" && typeof (l as { kind?: unknown })?.kind === "string")
          .map((l) => ({ kind: l.kind, text: l.text }))
      : undefined;
    const sealed = await sealLetter(actor, {
      determinationId,
      code: typeof body.code === "string" ? body.code : "",
      ...entered,
      previewSha256: typeof body.previewSha256 === "string" ? body.previewSha256 : undefined,
      previewLines,
      context: {
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request.headers.get("user-agent"),
      },
    });
    return sealed.ok
      ? NextResponse.json({
          ok: true,
          documentId: sealed.documentId,
          sha256: sealed.sha256,
          delivered: sealed.delivered,
          warning: sealed.warning,
        })
      : bad(sealed.error);
  }

  /*
   * THE ENGINEER'S OWN DOCUMENT, the repair specification (Robert's ruling of
   * 2026-10-25, 23:51 Central, item C; docs/sealing-controls.md controls 12 to
   * 17). Three steps, his alone: a signed URL to upload his PDF straight to
   * storage, a preview of it with the page the platform adds, and the seal.
   * No PDF passes through this route in either direction.
   */
  if (body.action === "own-upload") {
    const url = await ownDocumentUploadUrl(actor, {
      determinationId,
      contentType: typeof body.contentType === "string" ? body.contentType : "",
      size: typeof body.size === "number" ? body.size : Number.NaN,
    });
    return url.ok ? NextResponse.json({ ok: true, url: url.url }) : bad(url.error);
  }
  if (body.action === "own-preview") {
    const preview = await previewOwnDocument(actor, determinationId);
    return preview.ok
      ? NextResponse.json({
          ok: true,
          url: preview.url,
          previewSha256: preview.previewSha256,
          pages: preview.pages,
          title: preview.title,
          letterhead: preview.frame.letterhead,
          sealBlock: preview.frame.sealBlock,
        })
      : bad(preview.error);
  }
  if (body.action === "own-seal") {
    const sealed = await sealOwnDocument(actor, {
      determinationId,
      code: typeof body.code === "string" ? body.code : "",
      previewSha256: typeof body.previewSha256 === "string" ? body.previewSha256 : undefined,
      context: {
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request.headers.get("user-agent"),
      },
    });
    return sealed.ok
      ? NextResponse.json({ ok: true, documentId: sealed.documentId, sha256: sealed.sha256, delivered: sealed.delivered, warning: sealed.warning })
      : bad(sealed.error);
  }

  return bad("The action is draft, seal, own-upload, own-preview or own-seal.");
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
