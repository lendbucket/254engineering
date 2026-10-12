import { NextResponse, type NextRequest } from "next/server";
import { setCustomerPassword } from "@/lib/customer-auth";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * Spend a one time link and set a customer's password.
 *
 * It does not sign them in afterwards. The staff flow does not either, and the
 * reason is the same: setting a password from a link that arrived by email and
 * being handed a live session are two different grants, and somebody who set a
 * password on a shared machine should have to type it once.
 */
async function handlePOST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ ok: false, error: "That link is not valid." }, { status: 400 });
  }

  const result = await setCustomerPassword(token, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, redirect: "/account/login" });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
