import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { createTerritory, renameTerritory, setTerritoryCounties, setTerritoryHolder } from "@/lib/crm-territories";

export const dynamic = "force-dynamic";

/**
 * THE SALES TERRITORIES. crm.assign (admin and ops_manager), Robert's sales CRM
 * ruling of 2026-11-02, item R5. Every act is audited first inside the library
 * (writeAuditOrRefuse); this route reads the request and answers.
 *
 *   create        a new territory by name
 *   rename        a territory's name
 *   set_counties  a territory's counties, exactly this list
 *   set_holder    give a person a territory, or take it off them
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "crm.assign")) return bad("Only a sales manager or an administrator manages territories.", 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("The request could not be read.");
  }
  const action = str(body.action);

  if (action === "create") {
    const result = await createTerritory(actor, { name: str(body.name) });
    return result.ok ? NextResponse.json({ ...result, said: "Territory created. Now choose its counties and who holds it." }) : bad(result.error, 422);
  }
  if (action === "rename") {
    const result = await renameTerritory(actor, { territoryId: str(body.territoryId), name: str(body.name) });
    return result.ok ? NextResponse.json({ ok: true, said: "Renamed." }) : bad(result.error, 422);
  }
  if (action === "set_counties") {
    const result = await setTerritoryCounties(actor, { territoryId: str(body.territoryId), counties: strings(body.counties) });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "set_holder") {
    const result = await setTerritoryHolder(actor, { territoryId: str(body.territoryId), profileId: str(body.profileId), holds: body.holds === true });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  return bad("That is not something the territories screen does.");
}
