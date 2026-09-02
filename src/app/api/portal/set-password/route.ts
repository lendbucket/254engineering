import { NextResponse, type NextRequest } from "next/server";
import { consumeTokenAndSetPassword, requestContext } from "@/lib/ops-auth";
import { takeLoginAttempt, clientKey } from "@/lib/admin-rate-limit";
import { writeAudit } from "@/lib/ops-audit";

/**
 * Spend a one time link and set the password behind it.
 *
 * Open by design: the whole point is that the person is not signed in yet. The
 * token is the credential, and it is rate limited on the same limiter the sign
 * in uses, because a 256 bit token is not guessable but an endpoint that will
 * answer forever is still worth closing.
 *
 * The password never appears in the audit trail. What is recorded is that a
 * password was set, by whom, and when.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = takeLoginAttempt(clientKey(request.headers));
  if (!limit.allowed) {
    const res = NextResponse.json({ ok: false, error: "Too many attempts. Wait a moment." }, { status: 429 });
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }

  const contentType = request.headers.get("content-type") ?? "";
  let token = "";
  let password = "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
    password = String(form.get("password") ?? "");
  } else {
    const body = (await request.json().catch(() => null)) as
      | { token?: string; password?: string }
      | null;
    token = String(body?.token ?? "");
    password = String(body?.password ?? "");
  }

  if (!token || !password) {
    return NextResponse.json({ ok: false, error: "That link is not valid." }, { status: 400 });
  }

  const result = await consumeTokenAndSetPassword(token, password);
  const { ip, userAgent } = await requestContext();

  if (!result.ok) {
    await writeAudit({
      actor: null,
      action: "auth.set_password_failed",
      entityType: "profile",
      summary: result.error,
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await writeAudit({
    actor: { id: result.profile.id, role: result.profile.role, email: result.profile.email },
    action: "auth.set_password",
    entityType: "profile",
    entityId: result.profile.id,
    summary: `${result.profile.display_name} set their password and activated the account`,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
