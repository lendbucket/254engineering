import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { csvHeaders } from "@/lib/csv";
import { exportFiles, EXPORT_LIMIT } from "@/lib/ops-bulk-files";

export const dynamic = "force-dynamic";

/**
 * Exporting the files somebody selected on the Files screen.
 *
 * Phase 12 Section 4, Section 1.
 *
 * WHY POST FOR A READ
 * --------------------
 * A selection is up to 300 ids, which is roughly eleven kilobytes of query
 * string, and browsers and proxies disagree about where they stop accepting
 * one. A GET that silently truncated would export a subset of what somebody
 * ticked, which is the shape this export's own preamble exists to make
 * impossible: a spreadsheet that reads as a complete list and is not.
 *
 * It writes an audit row either way, so it is not a pure read in the sense that
 * matters here.
 *
 * WHAT IS NOT TRUSTED
 * --------------------
 * Everything in the body. The ids are resolved through the same scoped query
 * the Files screen uses, so a person cannot reach a file by knowing its id, and
 * the capability is checked in ops-bulk-files rather than here so that a second
 * caller cannot arrive without it.
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (actor.status !== "active") return bad("This account is not active.", 403);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return bad("Send a JSON body naming the files.");
  }

  const raw = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(raw)) return bad("Send ids as a list.");

  /*
   * Deduplicated here, so "asked for" in the export's preamble is a count of
   * DISTINCT files rather than of clicks. A reader comparing asked against
   * returned should not have to wonder whether the difference is a permission
   * or a repeat.
   */
  const ids = [...new Set(raw.filter((v): v is string => typeof v === "string" && v.length > 0))];

  if (ids.length === 0) return bad("Nothing selected.");
  if (ids.length > EXPORT_LIMIT) {
    return bad(`That is ${ids.length} files. This export names at most ${EXPORT_LIMIT} at a time.`);
  }

  const context = await requestContext();
  const result = await exportFiles({ ...actor, email: actor.email }, ids, context);
  if (!result.ok) return bad(result.error, 403);

  return new NextResponse(result.body, { headers: csvHeaders(result.filename) });
}
