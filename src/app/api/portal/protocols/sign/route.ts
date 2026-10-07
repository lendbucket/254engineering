import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { signProtocol } from "@/lib/protocol-sign";

export const dynamic = "force-dynamic";

/**
 * THE ENGINEER SIGNS A PROTOCOL HE HAS READ IN THE PORTAL. POST ONLY.
 *
 * Ruling 2a of 2026-10-06, src/lib/protocol-sign.ts. The licence is checked
 * here so a refusal costs nothing, again in the library against the register,
 * and again by 0063 at the database.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!holdsLicence(actor, "protocols.author")) {
    return bad("Only the engineer of record signs a protocol. No other role can stand in for him.", 403);
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Send the request as JSON.");
  const signed = await signProtocol(actor, {
    documentNumber: typeof body.documentNumber === "string" ? body.documentNumber : "",
    code: typeof body.code === "string" ? body.code : "",
  });
  return signed.ok ? NextResponse.json({ ok: true, sha256: signed.sha256 }) : bad(signed.error);
}
