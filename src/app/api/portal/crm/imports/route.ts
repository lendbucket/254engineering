import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { CRM_VERTICALS, type CrmVertical } from "@/lib/crm-rules";
import { dismissRow, resolveConflict, resolveHeld, runPreview, writeRun } from "@/lib/crm-imports";

export const dynamic = "force-dynamic";

/**
 * THE SALES LIST'S IMPORTS. crm.import, Robert's sales CRM ruling of
 * 2026-11-02, item R2: admin and ops_manager. Every act is audited inside the
 * library through writeAuditOrRefuse; this route only reads the request and
 * answers.
 *
 *   preview          one source, now, by a person; nothing is written to the list
 *   preview_csv      a bought list, through the same dedupe
 *   write            a previewed run, refused if the list moved since
 *   resolve_held     a held record given a phone
 *   resolve_conflict a conflict settled onto the company a person chose
 *   dismiss          a held record or a conflict set aside
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The largest file a person may send as one bought list, in characters. */
const MAX_CSV_CHARS = 8_000_000;

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "crm.import")) return bad("Your role cannot import to the sales list.", 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("The request could not be read.");
  }
  const action = str(body.action);

  if (action === "preview") {
    const result = await runPreview(actor, { source: str(body.source), trigger: "person" });
    return result.ok ? NextResponse.json({ ok: true, runId: result.runId, counts: result.counts }) : bad(result.error, 422);
  }

  if (action === "preview_csv") {
    const text = str(body.csv);
    if (!text.trim()) return bad("Choose a CSV file first.");
    if (text.length > MAX_CSV_CHARS) return bad("That file is larger than 8 MB. Split it and check each part.");
    const vertical = str(body.defaultVertical);
    const defaultVertical = (CRM_VERTICALS as readonly string[]).includes(vertical) ? (vertical as CrmVertical) : null;
    const result = await runPreview(actor, { source: "csv", trigger: "person", csv: { text, fileName: str(body.fileName) || "spreadsheet.csv", defaultVertical } });
    return result.ok ? NextResponse.json({ ok: true, runId: result.runId, counts: result.counts }) : bad(result.error, 422);
  }

  if (action === "write") {
    const result = await writeRun(actor, str(body.runId));
    return result.ok ? NextResponse.json(result) : bad(result.error, 409);
  }

  if (action === "resolve_held") {
    const result = await resolveHeld(actor, str(body.rowId), str(body.phone));
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }

  if (action === "resolve_conflict") {
    const result = await resolveConflict(actor, str(body.rowId), str(body.prospectId));
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error, 422);
  }

  if (action === "dismiss") {
    const result = await dismissRow(actor, str(body.rowId));
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error, 422);
  }

  return bad("That is not something the imports screen does.");
}
