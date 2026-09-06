import { NextResponse, type NextRequest } from "next/server";
import { signInPartner, issuePartnerSession } from "@/lib/partner-auth";
import { PARTNER_COOKIE, partnerCookieOptions, partnerSessionConfigured } from "@/lib/partner-session";
import { takeLoginAttempt, clearLoginAttempts, clientKey } from "@/lib/ops-rate-limit";
import { writeAudit } from "@/lib/ops-audit";
import { requestContext } from "@/lib/ops-auth";

/**
 * Partner sign in and sign out.
 *
 * TWO CONTENT TYPES, ONE ENDPOINT
 * -------------------------------
 * The form posts JSON once React has hydrated and form encoded before it has,
 * and both are accepted. The form encoded path answers with a redirect because
 * a browser following a form submission has nowhere to put a JSON body.
 *
 * Getting this wrong is how the admin login once leaked a passphrase into a
 * URL. It is written out again here rather than assumed from the staff route.
 *
 * ONE REFUSAL FOR EVERY FAILURE
 * -----------------------------
 * Unknown address, wrong password, invited but never set one, suspended person,
 * suspended partner: all the same sentence. Distinguishing them turns this
 * endpoint into a way of asking the firm who its partners are, which is
 * commercially interesting to a competitor in a way a staff list is not.
 *
 * The one exception is a suspended PARTNER, and only after the password has
 * been verified, because at that point the caller has already proved they hold
 * the credentials and telling them why they cannot get in is the difference
 * between a closed door and a broken one.
 */

export const dynamic = "force-dynamic";

const GENERIC = "That email address and password do not match an account.";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded");

  let email = "";
  let password = "";

  if (isForm) {
    const form = await request.formData();
    email = String(form.get("email") ?? "");
    password = String(form.get("password") ?? "");
  } else {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    email = String(body?.email ?? "");
    password = String(body?.password ?? "");
  }

  const fail = (status: number, error: string, code?: string) =>
    isForm
      ? NextResponse.redirect(
          new URL(`/partner/login${code ? `?${code}=1` : "?error=1"}`, request.url),
          { status: 303 },
        )
      : NextResponse.json({ ok: false, error }, { status });

  const attempted = email.trim().toLowerCase();

  /*
   * Rate limited on the same limiter the staff sign in uses, keyed by address
   * and identity together. Before anything is verified, and before the
   * configuration check, because a limiter that runs after the password check
   * has not limited anything and an unconfigured deployment that short circuits
   * first answers every attempt forever without counting one. security-audit
   * caught that second case against production once.
   */
  const limit = takeLoginAttempt(clientKey(request.headers), attempted || undefined);
  if (!limit.allowed) {
    const res = isForm
      ? NextResponse.redirect(new URL("/partner/login?throttled=1", request.url), { status: 303 })
      : NextResponse.json(
          {
            ok: false,
            error: "Too many attempts. Wait a few minutes and try again.",
            retryAfterSeconds: limit.retryAfterSeconds,
          },
          { status: 429 },
        );
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }

  if (!partnerSessionConfigured()) {
    return NextResponse.json(
      { ok: false, error: "The partner programme is not configured on this deployment." },
      { status: 503 },
    );
  }

  if (!email || !password) return fail(400, GENERIC);

  const result = await signInPartner(attempted, password);
  const { ip, userAgent } = await requestContext();

  if (!result.ok) {
    /*
     * A failed partner sign in is recorded in the firm's audit trail, with the
     * address that was tried and nothing else. Somebody working through a list
     * of partner addresses is a thing the firm should be able to see later.
     */
    await writeAudit({
      actor: null,
      action: "partner.sign_in_failed",
      entityType: "partner_session",
      entityId: attempted,
      summary: "Failed partner sign in",
      ip,
      userAgent,
    });
    const suspended = result.error.includes("not currently active");
    return suspended
      ? isForm
        ? NextResponse.redirect(new URL("/partner/login?suspended=1", request.url), { status: 303 })
        : NextResponse.json({ ok: false, error: result.error }, { status: 403 })
      : fail(401, GENERIC);
  }

  clearLoginAttempts(clientKey(request.headers), attempted);

  const session = issuePartnerSession(result.principal.id, result.principal.partnerId);
  if (!session) return fail(503, "The partner programme is not configured.");

  await writeAudit({
    actor: { id: null, role: "admin", email: result.principal.email },
    action: "partner.sign_in",
    entityType: "partner",
    entityId: result.principal.partnerId,
    summary: `${result.principal.partner.organisation}: ${result.principal.displayName} signed in`,
    ip,
    userAgent,
  });

  /*
   * No `next` parameter, deliberately.
   *
   * The staff sign in takes one so a deep link survives a session expiring.
   * This surface has four screens, so the value of that is close to nothing,
   * and an open redirect out of a sign in page is a phishing primitive: a real
   * link, to a real login, that lands somewhere else. Not accepting the
   * parameter at all is the version with no validation to get wrong.
   */
  const res = isForm
    ? NextResponse.redirect(new URL("/partner", request.url), { status: 303 })
    : NextResponse.json({ ok: true, redirect: "/partner" });

  res.cookies.set(PARTNER_COOKIE, session.value, partnerCookieOptions(session.expiresAt));
  return res;
}

/** Sign out. Clears the cookie whether or not one was valid. */
export async function DELETE(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARTNER_COOKIE, "", partnerCookieOptions());

  const { ip, userAgent } = await requestContext();
  await writeAudit({
    actor: null,
    action: "partner.sign_out",
    entityType: "partner_session",
    summary: "Partner signed out",
    ip,
    userAgent,
  });
  void request;
  return res;
}
