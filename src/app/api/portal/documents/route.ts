import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { documentUrl } from "@/lib/ops-docs";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * Opening one filed document.
 *
 * The buckets are private and there is no public URL for anything in them. This
 * hands out a link that Supabase signs and that expires in an hour, and it does
 * it only after checking the same visibility rule the list screen checked.
 *
 * The redirect is deliberate rather than proxying the bytes: the file goes from
 * storage to the person, and nothing in between keeps a copy.
 */
export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!can(actor, "documents.read")) {
    return NextResponse.json({ ok: false, error: "Your role cannot open documents." }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "Which document?" }, { status: 400 });

  const url = await documentUrl(actor, id);
  if (!url) {
    /*
     * One message for "does not exist" and for "not yours". Telling the
     * difference would confirm the existence of a document somebody is not
     * allowed to know about.
     */
    return NextResponse.json({ ok: false, error: "That document is not available to you." }, { status: 404 });
  }

  await writeAudit({
    actor,
    action: "document.open",
    entityType: "document",
    entityId: id,
    summary: "Opened a filed document",
    ...(await requestContext()),
  });

  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store, max-age=0" } });
}
