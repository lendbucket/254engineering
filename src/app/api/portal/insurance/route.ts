import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { INSURANCE_CERTIFICATE_MAX_BYTES, certificateLink, recordPolicy, withdrawPolicy } from "@/lib/ops-insurance";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE INSURANCE REGISTER'S ONE DOOR. Robert's addendum of 2026-10-25, item 1.
 *
 * POST with a form upload records a policy from its certificate; POST with JSON
 * { action: "withdraw", id, reason } withdraws one. GET ?certificate=<id>
 * answers with a five minute link to that certificate. Every path needs
 * insurance.manage, the office and the owner, and the library checks it again,
 * because a route that trusts its caller is a door with one lock.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "insurance.manage")) return bad("Only the office or the owner records the firm's insurance.", 403);

  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { action?: string; id?: string; reason?: string } | null;
    if (!body || body.action !== "withdraw" || typeof body.id !== "string") return bad("Say which policy to withdraw.");
    const result = await withdrawPolicy(actor, body.id, String(body.reason ?? ""));
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > INSURANCE_CERTIFICATE_MAX_BYTES + 64 * 1024) return bad("That certificate is over 10 MB. Send the carrier's PDF as issued.", 413);
  const form = await request.formData().catch(() => null);
  if (!form) return bad("Send the policy as a form with its certificate attached.");
  const file = form.get("certificate");
  if (!(file instanceof File)) return bad("Attach the certificate of insurance as a PDF.");
  const field = (name: string) => String(form.get(name) ?? "");
  const result = await recordPolicy(
    actor,
    {
      kind: field("kind"),
      carrier: field("carrier"),
      policyNumber: field("policyNumber"),
      limitPerClaim: field("limitPerClaim"),
      limitAggregate: field("limitAggregate"),
      namedInsureds: field("namedInsureds"),
      effectiveOn: field("effectiveOn"),
      expiresOn: field("expiresOn"),
    },
    new Uint8Array(await file.arrayBuffer()),
  );
  return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
}

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  const id = request.nextUrl.searchParams.get("certificate");
  if (!id) return bad("Say which certificate to open.");
  const link = await certificateLink(actor, id);
  return link.ok ? NextResponse.redirect(link.url) : bad(link.error, can(actor, "insurance.manage") ? 400 : 403);
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
