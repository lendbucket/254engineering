import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import {
  FRANCHISEE_CERTIFICATE_MAX_BYTES,
  franchiseeCertificateLink,
  recordCertificate,
  withdrawCertificate,
} from "@/lib/franchisee-onboarding";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * A FRANCHISEE'S CERTIFICATES OF INSURANCE (0128, Robert's X4). Behind
 * franchise.manage, which only admin holds. A form with the PDF records one; a
 * JSON body withdraws one with a reason; a GET opens one through a five minute
 * signed link. The shape of /api/portal/insurance, for a register kept apart
 * from the firm's own policies.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const NOT_ALLOWED = "Only an administrator keeps the franchisee record.";

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "franchise.manage")) return bad(NOT_ALLOWED, 403);

  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { action?: string; id?: string; reason?: string } | null;
    if (!body || body.action !== "withdraw" || typeof body.id !== "string") return bad("Say which certificate to withdraw.");
    const result = await withdrawCertificate(actor, body.id, String(body.reason ?? ""));
    return result.ok ? NextResponse.json({ ok: true, said: "Withdrawn. It stays on the record with the reason." }) : bad(result.error, 422);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > FRANCHISEE_CERTIFICATE_MAX_BYTES + 64 * 1024) return bad("That certificate is over 10 MB. Send the carrier's PDF as issued.", 413);
  const form = await request.formData().catch(() => null);
  if (!form) return bad("Send the certificate as a form with its PDF attached.");
  const file = form.get("certificate");
  if (!(file instanceof File)) return bad("Attach the certificate of insurance as a PDF.");
  const field = (name: string) => String(form.get(name) ?? "");
  const result = await recordCertificate(
    actor,
    {
      franchiseeId: field("franchiseeId"),
      kind: field("kind"),
      carrier: field("carrier"),
      policyNumber: field("policyNumber"),
      effectiveOn: field("effectiveOn"),
      expiresOn: field("expiresOn"),
    },
    new Uint8Array(await file.arrayBuffer()),
  );
  return result.ok ? NextResponse.json({ ok: true, id: result.id, said: "Certificate recorded." }) : bad(result.error, 422);
}

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "franchise.manage")) return bad(NOT_ALLOWED, 403);
  const id = request.nextUrl.searchParams.get("certificate");
  if (!id) return bad("Say which certificate to open.");
  const link = await franchiseeCertificateLink(actor, id);
  return link.ok ? NextResponse.redirect(link.url) : bad(link.error);
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
