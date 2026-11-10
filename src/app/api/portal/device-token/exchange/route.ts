import { NextResponse, type NextRequest } from "next/server";
import { requestContext } from "@/lib/ops-auth";
import { exchangeDeviceToken, revokeDeviceToken } from "@/lib/device-token";
import { OPS_COOKIE, opsCookieOptions, opsSessionConfigured } from "@/lib/ops-session";
import { clientKey, takeLoginAttempt } from "@/lib/ops-rate-limit";
import { homeFor } from "@/lib/ops-authz";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * The store app's kept sign in (0125; Robert's answer of 2026-11-10,
 * 6766967932). OPEN, like /api/portal/session, because it exists for a phone
 * whose session has ended: src/proxy.ts and security-audit's OPEN_BY_DESIGN
 * both name it.
 *
 * POST trades a token from the phone's keystore for a fresh twelve hour full
 * session, or answers "Sign in again" and nothing more. DELETE is sign out on
 * this phone: holding the token is the authority to end it.
 *
 * Counted against the sign in limiter by address before anything is read, as
 * the password door is, so the endpoint cannot be used to try tokens at speed.
 * A token is 32 random bytes, so the count is a second bound, not the defence.
 */
async function handlePOST(request: NextRequest) {
  const limit = await takeLoginAttempt(clientKey(request.headers));
  if (!limit.allowed) {
    const res = NextResponse.json({ ok: false, error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }
  if (!opsSessionConfigured()) {
    return NextResponse.json({ ok: false, error: "The portal is not configured on this deployment." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const context = await requestContext();
  const exchanged = await exchangeDeviceToken(body?.token, context);
  if (!exchanged.ok) return NextResponse.json({ ok: false, error: exchanged.error }, { status: exchanged.status });
  const res = NextResponse.json({ ok: true, redirect: homeFor("field_tech") });
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OPS_COOKIE, exchanged.cookie.value, opsCookieOptions(exchanged.cookie.expiresAt));
  return res;
}

async function handleDELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const context = await requestContext();
  const ended = await revokeDeviceToken(body?.token, context);
  if (!ended.ok) return NextResponse.json({ ok: false, error: ended.error }, { status: ended.status });
  return NextResponse.json({ ok: true });
}

export const POST = withSaveOutcome(handlePOST);
export const DELETE = withSaveOutcome(handleDELETE);
