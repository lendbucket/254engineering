import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { addCaptureItem, recordEngineerFact, recordOfficeFact, recordTriage } from "@/lib/letter-facts";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * The facts a foundation or permit letter prints that somebody records, the
 * engineer's triage, and his added capture items. Operator ruling 7 of
 * 2026-10-23, migration 0085. Every permission and every rule is in
 * src/lib/letter-facts.ts; this only reads the body and answers.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const fileId = String(body?.fileId ?? "");
  const context = await requestContext();

  const result =
    action === "office_fact"
      ? await recordOfficeFact(actor, fileId, String(body?.fact ?? "") as "authority_address", String(body?.value ?? ""), context)
      : action === "engineer_fact"
        ? await recordEngineerFact(actor, fileId, String(body?.fact ?? "") as "foundation_type", String(body?.value ?? ""), context)
        : action === "triage"
          ? await recordTriage(actor, fileId, String(body?.basis ?? "") as "site", context)
          : action === "capture_item"
            ? await addCaptureItem(actor, fileId, String(body?.label ?? ""), context)
            : ({ ok: false, error: "Unknown action." } as const);

  return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
