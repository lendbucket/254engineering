import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { inbox } from "@/lib/ops-inbox";
import { inboxListRows } from "@/lib/inbox-list";
import { csv, csvHeaders } from "@/lib/csv";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * THE INBOX AS A CSV. GET ONLY, AND IT CHANGES NOTHING.
 *
 * Office ready, operator ruling of 2026-10-20: "Order summaries and reports
 * print cleanly and export to CSV." Every item the screen would show for the
 * same answered, kind, search and sort, not one page: the rows come from
 * inboxListRows, the function the screen uses. The same grant as the screen.
 *
 * A PARTIAL READ IS SAID, NOT HIDDEN. The inbox reads several sources and one
 * can fail while the others answer; the screen says which, and so does the
 * file, in its preamble, so a short list is never handed over as the whole.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "inbox.read")) return bad("Not permitted.", 403);
  const params = request.nextUrl.searchParams;
  const read = await inbox(actor, { includeAnswered: params.get("answered") === "all" });
  if (!read.ok) return bad(read.error, 500);
  const rows = inboxListRows(read.items, {
    kind: params.get("kind") ?? undefined,
    q: params.get("q") ?? undefined,
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") ?? undefined,
  });
  const preamble: [string, unknown][] = [["Inbox", `${rows.length} matching`]];
  for (const f of read.failed) preamble.push(["Not included, could not be read", f]);
  const body = csv({
    preamble,
    headers: ["Kind", "Received", "From", "Email", "Phone", "About", "Respond by", "Answered", "Answered at"],
    rows: rows.map((i) => [
      i.kind,
      formatInFirmZone(i.receivedAt) ?? i.receivedAt,
      i.name,
      i.email ?? "",
      i.phone ?? "",
      i.summary,
      i.respondBy ? (formatInFirmZone(i.respondBy) ?? i.respondBy) : "",
      i.answered ? "yes" : "no",
      i.answeredAt ? (formatInFirmZone(i.answeredAt) ?? i.answeredAt) : "",
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("inbox.csv") });
}
