import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { SEAL_IMAGE_MAX_BYTES, uploadSealImage } from "@/lib/seal-store";

/**
 * THE ENGINEER STORES HIS OWN SEAL AND SIGNATURE IMAGES HERE, AND NOTHING ELSE.
 *
 * Rulings 2 and 5 of 2026-10-06. POST only: there is no GET, because no route
 * in this platform serves a seal image to anybody. The images are read by the
 * sealing step and by nothing that returns a file.
 *
 * Multipart, with three fields: `kind` (seal or signature), `file` (a PNG) and
 * `code` (the six digit code from his authenticator app, checked fresh for this
 * upload). Every refusal is a sentence the screen shows as it is.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!holdsLicence(actor, "documents.seal")) {
    return bad("Only a licensed engineer of record can store a seal or signature, and only his own.", 403);
  }

  /*
   * Refused before the body is read when the request says it is too large, so
   * an oversized upload costs nothing. The library checks the real size again,
   * because a declared length is only a claim.
   */
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > SEAL_IMAGE_MAX_BYTES + 64 * 1024) {
    return bad("That file is over 2 MB. A seal scanned at 600 dpi is a few hundred kilobytes.", 413);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return bad("Send the image as a form upload.");
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file arrived.");

  const result = await uploadSealImage({
    actor,
    kind: String(form.get("kind") ?? ""),
    bytes: new Uint8Array(await file.arrayBuffer()),
    code: String(form.get("code") ?? ""),
  });
  return result.ok
    ? NextResponse.json({ ok: true, kind: result.kind, fingerprint: result.fingerprint })
    : bad(result.error);
}
