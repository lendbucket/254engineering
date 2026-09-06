import { NextResponse, type NextRequest } from "next/server";
import { setPartnerPassword } from "@/lib/partner-auth";
import { writeAudit } from "@/lib/ops-audit";
import { requestContext } from "@/lib/ops-auth";

/**
 * Spend a one time link and set a partner's password.
 *
 * Open to an unauthenticated caller, and it has to be: the person using it has
 * no password yet, which is the whole point. What makes that safe is that the
 * token is the credential, it is stored only as a sha256 hash, it is single use
 * by a conditional update rather than by a check followed by a write, and it
 * expires in three days.
 *
 * It is one of two paths in PARTNER_OPEN_PATHS in the proxy, and that list
 * stays two entries long.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded");

  let token = "";
  let password = "";

  if (isForm) {
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

  const result = await setPartnerPassword(token, password);

  if (!result.ok) {
    return isForm
      ? NextResponse.redirect(new URL("/partner/login?error=1", request.url), { status: 303 })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const { ip, userAgent } = await requestContext();
  await writeAudit({
    actor: null,
    action: "partner.password_set",
    entityType: "partner_user",
    entityId: result.userId,
    summary: "A partner set their password from a one time link",
    ip,
    userAgent,
  });

  /*
   * No session is issued here. Setting a password and signing in are two acts,
   * and making the first perform the second means a link that lands in the
   * wrong inbox is a session rather than a password prompt.
   */
  return isForm
    ? NextResponse.redirect(new URL("/partner/login?set=1", request.url), { status: 303 })
    : NextResponse.json({ ok: true });
}
