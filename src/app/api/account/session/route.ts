import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { signInCustomer, issueCustomerSession } from "@/lib/customer-auth";
import { CUSTOMER_COOKIE, customerCookieOptions } from "@/lib/customer-session";
import { writeAudit } from "@/lib/ops-audit";
import { takeLoginAttempt, clearLoginAttempts, clientKey } from "@/lib/ops-rate-limit";

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

  /*
   * RATE LIMITED LIKE THE OTHER TWO DOORS, before anything is verified. Found by
   * the product audit, 2026-10-09, and by the break-it sweep of 2026-10-02
   * before it: twelve wrong passwords for one customer address all answered 401
   * and nothing slowed a guess, while the staff and partner sign ins share this
   * limiter (eight per account, twenty per address, fifteen minutes).
   */
  const attempted = email.trim().toLowerCase();
  const limit = await takeLoginAttempt(clientKey(request.headers), attempted || undefined);
  if (!limit.allowed) {
    const res = NextResponse.json(
      { ok: false, error: "Too many attempts. Wait a few minutes and try again.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }

  const result = await signInCustomer(email, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  await clearLoginAttempts(clientKey(request.headers), attempted);

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
