import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { countClients, listClients } from "@/lib/ops-crm";
import { clientListQuery } from "@/lib/client-list";
import { csv, csvHeaders } from "@/lib/csv";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * THE CLIENTS LIST AS A CSV. GET ONLY, AND IT CHANGES NOTHING.
 *
 * Office ready, operator ruling of 2026-10-20: "export to CSV". Every client
 * matching the screen's search, kind and sort, not one page: the same
 * clientListQuery the screen reads, the same grant as the screen.
 *
 * EVERY ROW OR NO FILE. The rows are read a page at a time and their number is
 * compared with the exact count of the same query before anything is handed
 * over, so a read that stopped short (PostgREST's silent ceiling, a page that
 * failed) refuses rather than producing a file that looks complete.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const PAGE = 1000;
const MOST = 20_000;

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "clients.list")) return bad("Not permitted.", 403);
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = clientListQuery({ q: params.q, kind: params.kind, sort: params.sort, dir: params.dir });

  const total = await countClients(actor, query);
  if (total === null) return bad("The clients could not be counted, so no file was made.", 500);
  if (total > MOST) return bad(`${total} clients match, more than one file carries (${MOST}). Narrow the search.`, 413);

  const rows = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    rows.push(...(await listClients(actor, { limit: PAGE, offset, query })));
  }
  if (rows.length !== total) {
    return bad(`Read ${rows.length} clients against an exact count of ${total}, so no file was made. Try again.`, 500);
  }

  const body = csv({
    preamble: [["Clients", `${total} matching`]],
    headers: ["Client", "Kind", "Type", "Email", "Phone", "City", "County", "Source", "Added"],
    rows: rows.map((c) => [
      c.name,
      c.kind === "organization" ? "Organization" : "Individual",
      c.client_type ? c.client_type.replace(/_/g, " ") : "",
      c.email ?? "",
      c.phone ?? "",
      c.city ?? "",
      c.county ?? "",
      c.converted_from_lead_id ? `converted lead${c.source_site ? ` (${c.source_site})` : ""}` : (c.utm_source ?? "added directly"),
      formatInFirmZone(c.created_at) ?? c.created_at,
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("clients.csv") });
}
