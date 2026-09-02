import { NextResponse, type NextRequest } from "next/server";
import { changeOwnPassword, currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/** A signed in person changing their own password. Never anybody else's. */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!can(actor, "profiles.update_self")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { current?: string; next?: string }
    | null;
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (!current || !next) {
    return NextResponse.json({ ok: false, error: "Both passwords are required." }, { status: 400 });
  }

  const result = await changeOwnPassword(actor!.id, current, next);
  const { ip, userAgent } = await requestContext();

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

  return NextResponse.json({ ok: true });
}
