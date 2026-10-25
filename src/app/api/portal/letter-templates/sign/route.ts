import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { signLetterTemplate } from "@/lib/letter-template-sign";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE ENGINEER SIGNS A LETTER TEMPLATE HE HAS READ IN THE PORTAL. POST ONLY.
 *
 * Robert's instruction of 2026-10-24, migration 0088: under his own account,
 * with a fresh second factor, recorded as a seal act exactly as a protocol
 * signature is (src/app/api/portal/protocols/sign/route.ts is the pattern). A
 * letter seals only from a template he has signed. The licence is checked here
 * so a refusal costs nothing, again in the library against the register, and
 * again by 0088 at the database.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!holdsLicence(actor, "documents.seal")) {
    return bad("Only the engineer of record signs a letter template. No other role can stand in for him.", 403);
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Send the request as JSON.");
  const signed = await signLetterTemplate(actor, {
    key: typeof body.key === "string" ? body.key : "",
    code: typeof body.code === "string" ? body.code : "",
  });
  return signed.ok ? NextResponse.json({ ok: true, sha256: signed.sha256 }) : bad(signed.error);
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
