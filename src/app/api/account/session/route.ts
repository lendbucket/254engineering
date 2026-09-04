import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { signInCustomer, issueCustomerSession } from "@/lib/customer-auth";
import { CUSTOMER_COOKIE, customerCookieOptions } from "@/lib/customer-session";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * Customer sign in and sign out.
 *
 * Deliberately NOT /api/portal/session. That route mints a staff cookie from
 * Supabase Auth; this one mints a customer cookie from eng_customer_users. They
 * share no code, no cookie, no signing key and no credential store, and the
 * only thing they have in common is the shape of the problem.
 *
 * EVERY FAILURE ANSWERS THE SAME WAY
 * ----------------------------------
 * signInCustomer returns one message for a missing address, a wrong password, an
 * invited account that never set one, and a suspended user. A response that
 * distinguished them would tell somebody which addresses have accounts here.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Enter your email address and password." },
      { status: 400 },
    );
  }

  const result = await signInCustomer(email, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  const session = issueCustomerSession(result.principal.id, result.principal.accountId);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Accounts are not available on this deployment." },
      { status: 503 },
    );
  }

  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, session.value, customerCookieOptions(session.expiresAt));

  /*
   * Audited on the firm's trail, not the customer's. A customer signing in is
   * something the firm should be able to show happened, and eng_order_events is
   * per order rather than per person.
   *
   * The actor is recorded as the customer's own email with a role naming what
   * they are. It is NOT one of the three staff roles, so nothing reading the
   * trail can mistake this for a member of staff.
   */
  await writeAudit({
    actor: { id: null, role: "customer" as never, email: result.principal.email },
    action: "customer.signed_in",
    entityType: "customer_account",
    entityId: result.principal.accountId,
    summary: `${result.principal.displayName} signed into the account`,
  });

  return NextResponse.json({ ok: true, redirect: "/account" });
}

export async function DELETE() {
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, "", customerCookieOptions());
  return NextResponse.json({ ok: true, redirect: "/account/login" });
}
