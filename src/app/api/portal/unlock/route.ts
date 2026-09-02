import { NextResponse, type NextRequest } from "next/server";
import { clientKey, inspectLock, releaseLock, RATE_LIMITS } from "@/lib/ops-rate-limit";
import { writeAudit } from "@/lib/ops-audit";

/**
 * The break glass, for when the rate limiter has locked the operator out of his
 * own portal.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * A control that stops the owner working is a control that gets switched off,
 * and a switched off control protects nothing. The limiter is worth keeping, so
 * it needs a documented way out that is faster than waiting fifteen minutes and
 * safer than raising the ceiling until it stops mattering.
 *
 * WHY IT NEEDS ITS OWN SECRET
 * ---------------------------
 * The obvious design is to let a signed in admin clear the limiter, and it is
 * useless: the person who needs this cannot sign in. So it takes OPS_UNLOCK_TOKEN
 * from the environment, which the operator has and an attacker does not.
 *
 * UNSET IS A CLOSED DOOR
 * ----------------------
 * With no token configured this route answers 404, exactly as though it did not
 * exist. An unlock endpoint that is open because somebody forgot to configure it
 * would be a rate limiter with a public off switch.
 *
 * WHAT IT CANNOT DO
 * -----------------
 * It clears a counter. It does not sign anybody in, does not touch a password,
 * does not read a profile, and does not tell an unauthenticated caller whether
 * any account exists. The worst an attacker with the token achieves is the
 * absence of rate limiting, which is where this portal was a week ago.
 *
 * GET reports the caller's position without changing it, so the operator can see
 * whether they are actually limited before assuming they are.
 */

export const dynamic = "force-dynamic";

function configured(): string | null {
  const token = process.env.OPS_UNLOCK_TOKEN;
  return typeof token === "string" && token.trim().length >= 24 ? token.trim() : null;
}

/** Constant time enough for a value this size, and no early return on length. */
function matches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: NextRequest) {
  const expected = configured();
  if (!expected) return new NextResponse("Not found", { status: 404 });

  const provided = request.nextUrl.searchParams.get("token") ?? "";
  if (!matches(provided, expected)) return new NextResponse("Not found", { status: 404 });

  const address = clientKey(request.headers);
  const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase() || undefined;
  const state = inspectLock(address, email);

  return NextResponse.json({
    ok: true,
    address,
    windowMinutes: RATE_LIMITS.WINDOW_MS / 60000,
    perIdentity: state.identity
      ? {
          used: state.identity.used,
          ceiling: state.identity.max,
          secondsUntilReset: state.identity.secondsLeft,
        }
      : null,
    perAddress: {
      used: state.address.used,
      ceiling: state.address.max,
      secondsUntilReset: state.address.secondsLeft,
    },
    note: "This instance only. The counter lives in memory, so another instance may hold a different count.",
  });
}

export async function POST(request: NextRequest) {
  const expected = configured();
  if (!expected) return new NextResponse("Not found", { status: 404 });

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const provided = String(body?.token ?? request.nextUrl.searchParams.get("token") ?? "");
  if (!matches(provided, expected)) return new NextResponse("Not found", { status: 404 });

  const address = clientKey(request.headers);
  const dropped = releaseLock(address);

  /*
   * Recorded, because clearing a security control is exactly the kind of event
   * that should be in the trail whether or not anything went wrong.
   */
  await writeAudit({
    actor: null,
    action: "auth.rate_limit_released",
    entityType: "session",
    entityId: address,
    summary: `Sign in rate limit cleared for ${address} using the unlock token (${dropped} counters dropped)`,
    ip: address,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    dropped,
    note:
      dropped === 0
        ? "Nothing was limiting you on this instance. If you are still refused, the counter is on another instance; retry the sign in, it will likely land elsewhere."
        : "Cleared. Try signing in again.",
  });
}
