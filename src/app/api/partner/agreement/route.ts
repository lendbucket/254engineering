import { NextResponse, type NextRequest } from "next/server";
import { currentPartner } from "@/lib/partner-auth";
import { acceptAgreement } from "@/lib/ops-partner-portal";
import { requestContext } from "@/lib/ops-auth";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * Accepting the programme agreement.
 *
 * The partner comes from the SESSION and never from the body. A route that
 * accepted a partner id would let anybody record an acceptance against anybody,
 * which on an append only table means a permanent false record that the firm
 * cannot remove and would have to explain.
 *
 * The address and the user agent are recorded with it, because the value of
 * this row is being able to say who agreed, when, and from where.
 */

export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest) {
  const principal = await currentPartner();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { version?: string } | null;
  const version = String(body?.version ?? "").trim();
  if (!version) {
    return NextResponse.json({ ok: false, error: "No version was named." }, { status: 400 });
  }

  const { ip, userAgent } = await requestContext();
  const result = await acceptAgreement(principal, version, { ip, userAgent });

  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
