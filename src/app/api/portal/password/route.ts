import { NextResponse, type NextRequest } from "next/server";
import { changeOwnPassword, currentActor, requestContext, signOutEverywhere } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { withSaveOutcome } from "@/lib/save-outcome";
import { OPS_COOKIE, issueOpsSession, opsCookieOptions } from "@/lib/ops-session";

export const dynamic = "force-dynamic";

/**
 * A signed in person changing their own password, or signing out everywhere.
 * Never anybody else's.
 *
 * Auth M2 (Robert, 2026-11-02, option A, rollout 1): a changed password ends
 * every other session by bumping the profile's session epoch, and this
 * response carries a fresh cookie under the new epoch so the tab in use stays
 * signed in. "Sign out everywhere" bumps it too and clears this cookie, so
 * every session ends, this one included.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!can(actor, "profiles.update_self")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { action?: string; current?: string; next?: string }
    | null;
  const { ip, userAgent } = await requestContext();

  if (body?.action === "sign_out_everywhere") {
    const ended = await signOutEverywhere(actor!.id);
    if (!ended.ok) {
      return NextResponse.json({ ok: false, error: `Your sessions could not be ended: ${ended.error}` }, { status: 503 });
    }
    await writeAudit({
      actor: { id: actor!.id, role: actor!.role, email: actor!.email },
      action: "auth.sign_out_everywhere",
      entityType: "profile",
      entityId: actor!.id,
      summary: `${actor!.display_name} signed out of every session`,
      ip,
      userAgent,
    });
    const res = NextResponse.json({ ok: true, signedOut: true });
    res.cookies.set(OPS_COOKIE, "", opsCookieOptions());
    return res;
  }

  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (!current || !next) {
    return NextResponse.json({ ok: false, error: "Both passwords are required." }, { status: 400 });
  }

  const result = await changeOwnPassword(actor!.id, current, next);

  if (!result.ok) {
    await writeAudit({
      actor: { id: actor!.id, role: actor!.role, email: actor!.email },
      action: "auth.change_password_failed",
      entityType: "profile",
      entityId: actor!.id,
      summary: result.error,
      ip,
      userAgent,
    });
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await writeAudit({
    actor: { id: actor!.id, role: actor!.role, email: actor!.email },
    action: "auth.change_password",
    entityType: "profile",
    entityId: actor!.id,
    summary: `${actor!.display_name} changed their own password`,
    ip,
    userAgent,
  });

  const res = NextResponse.json({ ok: true });
  const fresh = issueOpsSession(actor!.id, actor!.role, "full", Date.now(), result.epoch);
  if (fresh) res.cookies.set(OPS_COOKIE, fresh.value, opsCookieOptions(fresh.expiresAt));
  return res;
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
