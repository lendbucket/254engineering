import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { supabaseAdmin } from "@/lib/supabase";
import { ORDER_UPLOAD_BUCKET } from "@/lib/order-uploads";

export const dynamic = "force-dynamic";

/**
 * THE PHOTO OR PDF A /start LEAD SENT, OPENED BY THE OFFICE. Robert's add-on of
 * 2026-11-15, item 5: "Something else, or not sure" carries a photo or PDF,
 * and every form saves as a lead the office can see.
 *
 * Who may open it: a signed in, active staff member who may read the inbox the
 * lead arrives in. What it opens: only the storage key written on that lead's
 * own row, and only one under leads/, as a signed link that lasts five
 * minutes; the request names a lead, never a path. Every opening is written to
 * the audit trail, because a customer's document was read.
 */
export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (actor.status !== "active") return NextResponse.json({ ok: false, error: "This account is not active." }, { status: 403 });
  if (!can(actor, "inbox.read")) return NextResponse.json({ ok: false, error: "Your role cannot open the inbox." }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false, error: "That is not a lead." }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "The database is not configured." }, { status: 503 });
  const { data, error } = await db.from("eng_leads").select("id, attachment_key").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: `The lead could not be read: ${error.message}` }, { status: 503 });
  const key = (data?.attachment_key as string | null) ?? null;
  if (!data || !key || !key.startsWith("leads/")) return NextResponse.json({ ok: false, error: "This lead has no attachment." }, { status: 404 });

  const { data: signed, error: signError } = await db.storage.from(ORDER_UPLOAD_BUCKET).createSignedUrl(key, 300);
  if (signError || !signed) return NextResponse.json({ ok: false, error: "The attachment could not be opened." }, { status: 503 });

  await writeAudit({
    actor,
    action: "lead.attachment_opened",
    entityType: "lead",
    entityId: id,
    summary: "Opened the photo or PDF a /start lead sent.",
    ...(await requestContext()),
  });
  return NextResponse.redirect(signed.signedUrl, 302);
}
