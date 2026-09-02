import { NextResponse, type NextRequest } from "next/server";
import { verifyCredentials, requestContext } from "@/lib/ops-auth";
import { issueOpsSession, opsCookieOptions, OPS_COOKIE, opsSessionConfigured } from "@/lib/ops-session";
import { takeLoginAttempt, clearLoginAttempts, clientKey } from "@/lib/ops-rate-limit";
import { writeAudit } from "@/lib/ops-audit";
import { homeFor } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Sign in and sign out.
 *
 * TWO CONTENT TYPES, ONE ENDPOINT
 * -------------------------------
 * The form posts JSON once React has hydrated and form encoded before it has.
 * Both are accepted here, and the form encoded path answers with a redirect
 * rather than JSON because the browser is following a form submission and has
 * nowhere to put a JSON body.
 *
 * Getting this wrong is how the admin login leaked a passphrase into a URL. See
 * the note in the login form.
 *
 * WHAT A FAILURE SAYS
 * -------------------
 * "Check the email and password" for a wrong password AND for an unknown email.
 * Distinguishing them turns this endpoint into an account enumerator, and the
 * staff of this firm are named on a public careers page.
 *
 * A suspended account is told it is suspended, and only after the password has
 * been verified, so the message is not available to somebody guessing.
 */

export const dynamic = "force-dynamic";

const GENERIC = "Check the email and password.";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded");

  let email = "";
  let password = "";
  let next = "";

  if (isForm) {
    const form = await request.formData();
    email = String(form.get("email") ?? "");
    password = String(form.get("password") ?? "");
    next = String(form.get("next") ?? "");
  } else {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; password?: string; next?: string }
      | null;
    email = String(body?.email ?? "");
    password = String(body?.password ?? "");
    next = String(body?.next ?? "");
  }

  const fail = (status: number, error: string, code?: string) =>
    isForm
      ? NextResponse.redirect(
          new URL(`/portal/login${code ? `?${code}=1` : "?error=1"}`, request.url),
          { status: 303 },
        )
      : NextResponse.json({ ok: false, error }, { status });

  const attempted = email.trim().toLowerCase();

  /*
   * RATE LIMIT HERE: after the body is read, before anything is verified.
   *
   * After, because the email is half the key. Counting by address alone is what
   * locked the operator out of his own portal with a handful of typos, and a
   * control that stops the owner working is one that gets switched off. Keyed by
   * address AND account, a typo costs eight attempts against that one account
   * rather than against everything.
   *
   * Before verification, because a limiter that runs after the password check
   * has not limited anything.
   *
   * And before the configuration check, because that short circuit used to come
   * first and meant an unconfigured deployment answered every attempt forever
   * without counting one. security-audit caught that against production.
   */
  const limit = takeLoginAttempt(clientKey(request.headers), attempted || undefined);
  if (!limit.allowed) {
    const res = isForm
      ? NextResponse.redirect(new URL("/portal/login?throttled=1", request.url), { status: 303 })
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

  if (!opsSessionConfigured()) {
    return NextResponse.json(
      { ok: false, error: "The portal is not configured on this deployment." },
      { status: 503 },
    );
  }

  if (!email || !password) return fail(400, GENERIC);

  const result = await verifyCredentials(attempted, password);

  if (!result.ok) {
    const { ip, userAgent } = await requestContext();
    await writeAudit({
      actor: null,
      action: "auth.sign_in_failed",
      entityType: "session",
      entityId: email.trim().toLowerCase(),
      summary: `Failed sign in (${result.reason})`,
      ip,
      userAgent,
    });

    if (result.reason === "suspended") {
      return isForm
        ? NextResponse.redirect(new URL("/portal/login?suspended=1", request.url), { status: 303 })
        : NextResponse.json({ ok: false, error: "That account is suspended." }, { status: 403 });
    }
    if (result.reason === "unconfigured") return fail(503, "The portal is not configured.");
    return fail(401, GENERIC);
  }

  clearLoginAttempts(clientKey(request.headers), attempted);

  const session = issueOpsSession(result.profile.id, result.profile.role);
  if (!session) return fail(503, "The portal is not configured.");

  const db = supabaseAdmin();
  await db
    ?.from("eng_profiles")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", result.profile.id);

  const { ip, userAgent } = await requestContext();
  await writeAudit({
    actor: { id: result.profile.id, role: result.profile.role, email: result.profile.email },
    action: "auth.sign_in",
    entityType: "session",
    entityId: result.profile.id,
    summary: `${result.profile.display_name} signed in`,
    ip,
    userAgent,
  });

  const safeNext = next.startsWith("/portal") && !next.startsWith("//") ? next : homeFor(result.profile.role);

  const res = isForm
    ? NextResponse.redirect(new URL(safeNext, request.url), { status: 303 })
    : NextResponse.json({ ok: true, redirect: safeNext });

  res.cookies.set(OPS_COOKIE, session.value, opsCookieOptions(session.expiresAt));
  return res;
}

/** Sign out. Clears the cookie whether or not one was valid. */
export async function DELETE(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, "", opsCookieOptions());

  const { ip, userAgent } = await requestContext();
  await writeAudit({
    actor: null,
    action: "auth.sign_out",
    entityType: "session",
    summary: "Signed out",
    ip,
    userAgent,
  });
  void request;
  return res;
}
