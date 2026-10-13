import { NextResponse, type NextRequest } from "next/server";
import { currentPartner } from "@/lib/partner-auth";
import { submitMaterial } from "@/lib/ops-partner-assets";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * A partner sending material to the firm.
 *
 * The partner comes from the SESSION and never from the body, the same rule the
 * agreement route follows and for the same reason: a submission is a record of
 * who asked, and a route that accepted a partner id would let anybody file one
 * against anybody.
 *
 * It does not refuse copy that fails the firm's own rules. The check runs, and
 * its verdict comes back as advice. Refusing here would mean the firm never
 * sees the thing the partner was about to publish anyway.
 */

export const dynamic = "force-dynamic";

async function handlePOST(request: NextRequest) {
  const principal = await currentPartner();
  if (!principal) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { kind?: string; title?: string; body?: string; link?: string }
    | null;

  const kind = String(body?.kind ?? "copy");
  if (!["copy", "artwork", "page", "other"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "That is not a kind of material." }, { status: 400 });
  }

  const result = await submitMaterial(principal, {
    kind: kind as "copy" | "artwork" | "page" | "other",
    title: String(body?.title ?? ""),
    body: body?.body ? String(body.body) : undefined,
    link: body?.link ? String(body.link) : undefined,
  });

  return result.ok
    ? NextResponse.json({ ok: true, advice: result.advice })
    : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
