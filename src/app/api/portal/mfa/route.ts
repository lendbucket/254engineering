import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requestContext } from "@/lib/ops-auth";
import {
  OPS_COOKIE,
  issueOpsSession,
  opsCookieOptions,
  readOpsSession,
  readPendingSession,
} from "@/lib/ops-session";
import { answerChallenge, beginEnrolment, confirmEnrolment, mfaStateFor } from "@/lib/ops-mfa";
import { breakGlassMatches, breakGlassConfigured } from "@/lib/ops-mfa-breakglass";
import { clearEnrolment } from "@/lib/ops-mfa";
import { writeAudit } from "@/lib/ops-audit";
import { qrSvg } from "@/lib/qr";
import { takeLoginAttempt, clientKey } from "@/lib/ops-rate-limit";
import { supabaseAdmin } from "@/lib/supabase";
import { homeFor } from "@/lib/ops-authz";

/**
 * The second factor: the challenge, the enrolment, and the break glass.
 *
 * THIS IS ONE OF EXACTLY TWO PLACES THAT MAY SEE A PENDING SESSION
 * ----------------------------------------------------------------
 * `readPendingSession` is imported here and in the screen this endpoint serves,
 * and nowhere else in the codebase. Everything else calls `readOpsSession`,
 * which returns null for a pending cookie, so the whole portal refuses a half
 * authenticated session without any of it knowing that MFA exists.
 *
 * Adding a third caller of readPendingSession is how that stops being true, so
 * mfa-audit counts them.
 *
 * WHY THE RATE LIMITER USES A SEPARATE BUCKET
 * -------------------------------------------
 * Recorded during the account creation scoping and it applies exactly here: if
 * code attempts counted into the sign in bucket, anybody could lock a real
 * person out of signing in by hammering this endpoint with their address. Same
 * shape of limiter, different key.
 */

export const dynamic = "force-dynamic";

/** A separate bucket from sign in. See the note above. */
const MFA_SCOPE = "mfa";

type Body = {
  action?: "verify" | "begin" | "confirm" | "break_glass";
  code?: string;
  token?: string;
};

async function profileFor(userId: string) {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_profiles")
    .select("id, email, display_name, role")
    .eq("id", userId)
    .maybeSingle();
  return data as { id: string; email: string; display_name: string; role: string } | null;
}

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const raw = jar.get(OPS_COOKIE)?.value;

  /*
   * A pending session for the challenge and the enrolment during sign in, and a
   * FULL one for somebody enrolling voluntarily from their account screen. Both
   * are legitimate and they are read separately rather than with one permissive
   * helper, so the difference stays visible.
   */
  const pending = readPendingSession(raw);
  const full = readOpsSession(raw);
  const claims = pending ?? full;

  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const action = body?.action ?? "verify";

  const profile = await profileFor(claims.sub);
  if (!profile) return NextResponse.json({ ok: false, error: "That account is gone." }, { status: 401 });

  const { ip, userAgent } = await requestContext();
  const actor = { id: profile.id, role: profile.role, email: profile.email };

  /* ------------------------------------------------------------- begin */

  if (action === "begin") {
    const started = await beginEnrolment(profile.id, profile.email);
    if (!started.ok) return NextResponse.json({ ok: false, error: started.error }, { status: 503 });
    /*
     * No audit row here on purpose. Starting an enrolment changes nothing that
     * can be used: the active secret is untouched until a code confirms it. The
     * row is written when it COMPLETES, which is the moment the account's
     * security actually changed.
     */
    /*
     * The QR is rendered HERE, on the server, from the otpauth uri. Nothing
     * about the secret reaches a third party, and the browser receives inert
     * markup rather than a library and a string to encode itself.
     */
    return NextResponse.json({
      ok: true,
      secret: started.secret,
      uri: started.uri,
      qr: qrSvg(started.uri, { size: 200, label: "Scan this with your authenticator app" }),
    });
  }

  /* ----------------------------------------------------------- confirm */

  if (action === "confirm") {
    const limit = takeLoginAttempt(clientKey(request.headers), `${MFA_SCOPE}:${profile.id}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Wait a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const done = await confirmEnrolment(profile.id, String(body?.code ?? ""));
    if (!done.ok) return NextResponse.json({ ok: false, error: done.error }, { status: 400 });

    await writeAudit({
      actor,
      action: "mfa.enrolled",
      entityType: "profile",
      entityId: profile.id,
      summary: `${profile.display_name} enrolled a second factor`,
      ip,
      userAgent,
    });

    /*
     * Enrolling satisfies the challenge for this sign in. Somebody who has just
     * proved they hold the secret should not immediately be asked to prove it
     * again, and sending them back to a challenge screen would be the platform
     * doubting a code it accepted a moment ago.
     */
    const session = issueOpsSession(profile.id, profile.role, "full");
    const res = NextResponse.json({
      ok: true,
      recoveryCodes: done.recoveryCodes,
      redirect: homeFor(profile.role),
    });
    if (session) res.cookies.set(OPS_COOKIE, session.value, opsCookieOptions(session.expiresAt));
    return res;
  }

  /* ------------------------------------------------------- break glass */

  if (action === "break_glass") {
    /*
     * Only from a pending session. A full session has nothing to break out of,
     * and allowing it there would turn the variable into a way to strip a
     * factor from an account somebody is already inside.
     */
    if (!pending) {
      return NextResponse.json({ ok: false, error: "That is not available here." }, { status: 400 });
    }
    if (!breakGlassConfigured()) {
      return NextResponse.json({ ok: false, error: "That is not available." }, { status: 404 });
    }
    if (!breakGlassMatches(profile.email, String(body?.token ?? ""))) {
      await writeAudit({
        actor,
        action: "mfa.break_glass_refused",
        entityType: "profile",
        entityId: profile.id,
        summary: `A break glass attempt for ${profile.display_name} did not match`,
        ip,
        userAgent,
      });
      return NextResponse.json({ ok: false, error: "That is not available." }, { status: 404 });
    }

    const cleared = await clearEnrolment(profile.id);
    if (!cleared.ok) {
      return NextResponse.json({ ok: false, error: cleared.error ?? "It could not be cleared." }, { status: 503 });
    }

    await writeAudit({
      actor,
      action: "mfa.break_glass_used",
      entityType: "profile",
      entityId: profile.id,
      summary: `BREAK GLASS used for ${profile.display_name}. The second factor was removed and must be enrolled again. Remove MFA_BREAK_GLASS now.`,
      ip,
      userAgent,
    });

    /*
     * Still pending afterwards. The account has no factor now, so the next step
     * is enrolling one, not walking into the portal. Break glass recovers an
     * account; it does not skip the requirement.
     */
    return NextResponse.json({ ok: true, redirect: "/portal/mfa/enrol" });
  }

  /* ------------------------------------------------------------ verify */

  const limit = takeLoginAttempt(clientKey(request.headers), `${MFA_SCOPE}:${profile.id}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!pending) {
    return NextResponse.json({ ok: false, error: "There is nothing to verify." }, { status: 400 });
  }

  const answered = await answerChallenge(profile.id, String(body?.code ?? ""));
  if (!answered.ok) {
    await writeAudit({
      actor,
      action: "mfa.challenge_failed",
      entityType: "profile",
      entityId: profile.id,
      summary: `A second factor attempt for ${profile.display_name} was refused`,
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: false, error: answered.error }, { status: 401 });
  }

  if (answered.used === "recovery") {
    /*
     * A recovery code use is a privileged act and reads as one, with the count
     * left, because the useful moment to notice you have two remaining is
     * before you need the last one.
     */
    await writeAudit({
      actor,
      action: "mfa.recovery_code_used",
      entityType: "profile",
      entityId: profile.id,
      summary: `${profile.display_name} signed in with a recovery code. ${answered.remaining} remaining.`,
      ip,
      userAgent,
    });
  }

  const session = issueOpsSession(profile.id, profile.role, "full");
  if (!session) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });

  const res = NextResponse.json({
    ok: true,
    redirect: homeFor(profile.role),
    ...(answered.used === "recovery" ? { recoveryRemaining: answered.remaining } : {}),
  });
  res.cookies.set(OPS_COOKIE, session.value, opsCookieOptions(session.expiresAt));
  return res;
}

/**
 * What the account screen needs to render its second factor section.
 *
 * A FULL session only. A pending one has no business reading state beyond what
 * the challenge screen already shows it.
 */
export async function GET() {
  const jar = await cookies();
  const claims = readOpsSession(jar.get(OPS_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  try {
    const state = await mfaStateFor(claims.sub);
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "It could not be read." },
      { status: 503 },
    );
  }
}
