import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { addToNotes, bulkAssign, bulkTag, companyThread, deleteView, moveStage, postCompanyNote, saveView } from "@/lib/crm-pipeline";

export const dynamic = "force-dynamic";

/**
 * THE PIPELINE'S ACTS. crm.use, Robert's sales CRM ruling of 2026-11-02, item
 * R4: move a company's stage (from the board's drag or its select), assign
 * companies (crm.assign, the sales manager's), tag them, keep a saved view,
 * and write a company's notes. The library decides every refusal; this route
 * reads the request and answers.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "crm.use")) return bad("Your role cannot change the sales list.", 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("The request could not be read.");
  }
  const action = str(body.action);

  if (action === "move_stage") {
    const result = await moveStage(actor, { prospectId: str(body.prospectId), from: str(body.from), to: str(body.to) });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "bulk_assign") {
    if (!can(actor, "crm.assign")) return bad("Only a sales manager or an administrator assigns companies.", 403);
    const result = await bulkAssign(actor, { ids: ids(body.ids), ownerId: str(body.ownerId) || null });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "bulk_tag") {
    const result = await bulkTag(actor, { ids: ids(body.ids), tag: str(body.tag) });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "save_view") {
    const query = body.query && typeof body.query === "object" ? (body.query as Record<string, unknown>) : {};
    const result = await saveView(actor, { name: str(body.name), view: str(body.view), query });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "delete_view") {
    const result = await deleteView(actor, str(body.id));
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "post_note") {
    const result = await postCompanyNote(actor, { prospectId: str(body.prospectId), body: str(body.body) });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "join_notes") {
    const result = await companyThread(actor, str(body.prospectId));
    return result.ok ? NextResponse.json({ ok: true, said: "You are in this company's notes." }) : bad(result.error, 422);
  }
  if (action === "add_to_notes") {
    const result = await addToNotes(actor, { prospectId: str(body.prospectId), profileId: str(body.profileId) });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  return bad("That is not something the sales list does.");
}
