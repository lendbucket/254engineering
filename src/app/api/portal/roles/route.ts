import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { setGrants, setUserRole, createRole, deleteRole } from "@/lib/ops-roles";
import type { Action } from "@/lib/ops-authz";

export const dynamic = "force-dynamic";

/**
 * Roles, grants, and who holds them.
 *
 * Every action here is an access change, and every one is refused to anybody
 * without roles.manage. That permission governs the permission screen itself,
 * which is why the lockout guard counts it rather than counting administrators:
 * the owner may have created another role that also holds it.
 *
 * The guard lives in role-rules.ts and is applied by ops-roles, not here. A
 * second copy in this file would be a second answer to whether the firm can
 * lock itself out.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (!can(actor, "roles.manage")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const refuse = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

  if (action === "set_grants") {
    const grants = Array.isArray(body.grants) ? (body.grants as Action[]) : [];
    const result = await setGrants(actor, String(body.roleKey ?? ""), grants);
    return result.ok ? NextResponse.json(result) : refuse(result.error);
  }

  if (action === "set_user_role") {
    const result = await setUserRole(actor, String(body.userId ?? ""), String(body.roleKey ?? ""));
    return result.ok ? NextResponse.json(result) : refuse(result.error);
  }

  if (action === "create_role") {
    const result = await createRole(actor, {
      key: String(body.key ?? ""),
      name: String(body.name ?? ""),
      landingPath: String(body.landingPath ?? ""),
      description: body.description ? String(body.description) : null,
    });
    return result.ok ? NextResponse.json(result) : refuse(result.error);
  }

  if (action === "delete_role") {
    const result = await deleteRole(actor, String(body.roleKey ?? ""));
    return result.ok ? NextResponse.json(result) : refuse(result.error);
  }

  return refuse("Unknown action.");
}
