import { NextResponse } from "next/server";
import { currentPartner } from "@/lib/partner-auth";
import { startPartnerCheckout } from "@/lib/partner-billing";
import { deploymentOrigin } from "@/lib/site-url";

/*
 * A partner starts paying for the program (0074, operator ruling 2026-10-11).
 * The partner is the session's, never the request's. While partner billing is
 * off, startPartnerCheckout refuses before anything reaches Stripe, so this
 * answers 409 and charges nothing.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const principal = await currentPartner();
  if (!principal) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const result = await startPartnerCheckout({
    partnerId: principal.partnerId,
    email: principal.email,
    successUrl: `${deploymentOrigin()}/partner?billing=started`,
    cancelUrl: `${deploymentOrigin()}/partner`,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
  return NextResponse.redirect(result.url, 303);
}
