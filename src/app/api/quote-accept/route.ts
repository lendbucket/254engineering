import { NextResponse, type NextRequest } from "next/server";
import { acceptQuote, customerQuote } from "@/lib/ops-quotes";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * ===========================================================================
 * THE CUSTOMER ACCEPTS A QUOTE. PUBLIC, AND THE TOKEN IS THE WHOLE AUTHORITY.
 * ===========================================================================
 *
 * Robert's addendum of 2026-10-25, item 3: "the customer accepts by a tokened
 * link and pays; it converts with convertibleToOrder." POST { token }. The
 * token is the one eng_customer_access holds for the quote, the same mechanism
 * every order link uses. acceptQuote is the money door: it reads the signed
 * record, refuses a lapsed quote, converts once, and opens the platform's one
 * checkout. The answer is the checkout link, never a charge.
 *
 * A missing token and a wrong one get the same 404 and the same sentence, so
 * the route cannot be used to learn which quotes exist (security-audit).
 */
const NOT_HERE = "This link does not open a quote. The most recent email from the firm is the one that works.";
const noStore = { "Cache-Control": "no-store" };

async function handlePOST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || !(await customerQuote(token))) {
    return NextResponse.json({ ok: false, error: NOT_HERE }, { status: 404, headers: noStore });
  }
  const result = await acceptQuote(token);
  return result.ok
    ? NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl, reference: result.reference }, { headers: noStore })
    : NextResponse.json({ ok: false, error: result.error }, { status: 409, headers: noStore });
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
