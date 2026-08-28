import { NextResponse } from "next/server";
import { adminAuthConfigured, verifyPassphrase } from "@/lib/admin-auth";
import { ADMIN_COOKIE, issueSession, sessionCookieOptions } from "@/lib/admin-session";
import { clearLoginAttempts, clientKey, takeLoginAttempt } from "@/lib/admin-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign in and sign out.
 *
 * ONE GENERIC FAILURE MESSAGE
 * ---------------------------
 * A wrong passphrase and a rate limited attempt say different things, because
 * those are different situations for the operator and telling them apart costs
 * an attacker nothing they could not measure anyway. Everything else is one
 * message. In particular there is no branch that distinguishes "no passphrase
 * submitted" from "wrong passphrase", because that is a free bit.
 *
 * The unconfigured case is the exception and it is deliberate: an operator whose
 * ADMIN_PASSPHRASE is unset needs to be told that rather than left retyping a
 * correct passphrase. The portal is empty and unreachable in that state, so the
 * disclosure costs nothing.
 *
 * THE RATE LIMIT IS TAKEN BEFORE THE COMPARISON
 * ---------------------------------------------
 * Otherwise a limited attacker still gets a timing signal from the comparison
 * running. It also means a flood cannot spin the hash.
 */
export async function POST(request: Request) {
  const key = clientKey(request.headers);
  const rate = takeLoginAttempt(key);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  if (!adminAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "The admin portal has no passphrase configured." },
      { status: 503 },
    );
  }

  let passphrase: unknown;
  try {
    const body = await request.json();
    passphrase = (body as { passphrase?: unknown })?.passphrase;
  } catch {
    passphrase = undefined;
  }

  if (!verifyPassphrase(passphrase)) {
    return NextResponse.json({ ok: false, error: "That passphrase is not correct." }, { status: 401 });
  }

  const session = issueSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session could not be issued." }, { status: 503 });
  }

  clearLoginAttempts(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session, sessionCookieOptions());
  return res;
}

/** Sign out. Clears the cookie by writing an already expired one. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  return res;
}
